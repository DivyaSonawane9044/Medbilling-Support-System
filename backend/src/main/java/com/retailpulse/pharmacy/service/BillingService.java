package com.retailpulse.pharmacy.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.retailpulse.pharmacy.dto.SaleLineItemDTO;
import com.retailpulse.pharmacy.dto.SalesRequestDTO;
import com.retailpulse.pharmacy.exception.ApiException;
import com.retailpulse.pharmacy.model.Customer;
import com.retailpulse.pharmacy.model.InventoryBatch;
import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.model.SalesInvoice;
import com.retailpulse.pharmacy.model.SalesInvoiceItem;
import com.retailpulse.pharmacy.repositories.CustomerRepository;
import com.retailpulse.pharmacy.repositories.InventoryBatchRepository;
import com.retailpulse.pharmacy.repositories.PaymentRepository;
import com.retailpulse.pharmacy.repositories.ProductRepository;
import com.retailpulse.pharmacy.repositories.SalesInvoiceRepository;

@Service
public class BillingService {

    private static final BigDecimal DEFAULT_GST = new BigDecimal("12.00");
    private static final DateTimeFormatter INVOICE_TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final SalesInvoiceRepository salesInvoiceRepository;
    private final InventoryBatchRepository batchRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final ProductService productService;
    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;
    private final StockService stockService;
    private final NotificationService notificationService;

    public BillingService(SalesInvoiceRepository salesInvoiceRepository, InventoryBatchRepository batchRepository,
            CustomerRepository customerRepository, ProductRepository productRepository, ProductService productService,
            PaymentRepository paymentRepository, PaymentService paymentService, StockService stockService,
            NotificationService notificationService) {
        this.salesInvoiceRepository = salesInvoiceRepository;
        this.batchRepository = batchRepository;
        this.customerRepository = customerRepository;
        this.productRepository = productRepository;
        this.productService = productService;
        this.paymentRepository = paymentRepository;
        this.paymentService = paymentService;
        this.stockService = stockService;
        this.notificationService = notificationService;
    }

    /** One batch's share of a requested line. */
    private record Allocation(Product product, InventoryBatch batch, int units, SaleLineItemDTO request,
            GstCalculator.Line price) {
    }

    /** Prices a cart exactly as {@link #processNewSale} would, without saving or touching stock. */
    @Transactional(readOnly = true)
    public Map<String, Object> quote(SalesRequestDTO dto) {
        BigDecimal discount = validateAndGetDiscount(dto);
        List<Allocation> allocations = allocate(dto, discount, false);
        Map<String, Object> m = new LinkedHashMap<>();
        Totals t = totals(allocations);
        m.put("discountPercent", discount);
        m.put("totalDiscount", t.discount);
        m.put("totalTaxableAmount", t.taxable);
        m.put("totalCgst", t.cgst);
        m.put("totalSgst", t.sgst);
        m.put("grandTotal", t.grand);
        m.put("items", allocations.stream().map(a -> line(a.product, a.batch, a.units, a.price.unitPrice(),
                a.price.discount(), a.price.taxable(), a.price.cgst(), a.price.sgst(), a.price.total(), a.request))
                .toList());
        return m;
    }

    @Transactional
    public SalesInvoice processNewSale(SalesRequestDTO dto) {
        BigDecimal discount = validateAndGetDiscount(dto);
        List<Allocation> allocations = allocate(dto, discount, true);
        Totals t = totals(allocations);

        BigDecimal tendered = dto.getAmountPaid() == null ? t.grand : dto.getAmountPaid();
        if (tendered.signum() < 0) {
            throw ApiException.badRequest("Amount paid cannot be negative");
        }
        // Change is handed back, so at most the bill amount is recorded as paid
        BigDecimal paidNow = tendered.min(t.grand).setScale(2, RoundingMode.HALF_UP);
        BigDecimal due = t.grand.subtract(paidNow);

        Customer customer = resolveCustomer(dto);
        if (due.signum() > 0 && customer == null) {
            throw ApiException.badRequest("A customer name is required for a credit (partly paid) sale");
        }

        SalesInvoice invoice = new SalesInvoice();
        invoice.setInvoiceNumber(nextInvoiceNumber());
        invoice.setCustomer(customer);
        invoice.setSaleDateTime(LocalDateTime.now());
        invoice.setDiscountPercent(discount);
        invoice.setTotalDiscount(t.discount);
        invoice.setTotalTaxableAmount(t.taxable);
        invoice.setTotalCgst(t.cgst);
        invoice.setTotalSgst(t.sgst);
        invoice.setGrandTotal(t.grand);

        for (Allocation a : allocations) {
            SalesInvoiceItem item = new SalesInvoiceItem();
            item.setBatch(a.batch);
            item.setQuantitySoldTablets(a.units);
            item.setUnitSellingPrice(a.price.unitPrice());
            item.setLineTaxableAmount(a.price.taxable());
            item.setLineCgst(a.price.cgst());
            item.setLineSgst(a.price.sgst());
            item.setLineTotal(a.price.total());
            SaleLineItemDTO r = a.request;
            item.setMorning(r.getMorning());
            item.setAfternoon(r.getAfternoon());
            item.setEvening(r.getEvening());
            item.setNight(r.getNight());
            item.setBeforeFood(r.getBeforeFood());
            item.setAfterFood(r.getAfterFood());
            item.setDurationDays(r.getDurationDays());
            invoice.addItem(item);

            stockService.removeUnits(a.batch, a.units);
        }
        allocations.stream().map(Allocation::product).distinct().forEach(stockService::refreshProductQuantity);

        SalesInvoice saved = salesInvoiceRepository.save(invoice);

        if (paidNow.signum() > 0) {
            String method = dto.getPaymentMethod() == null || dto.getPaymentMethod().isBlank()
                    ? "Cash" : dto.getPaymentMethod().trim();
            paymentService.recordSuccess(saved, customer, paidNow, method, "SALE-" + saved.getInvoiceNumber());
        }
        if (customer != null && due.signum() > 0) {
            customer.setRemainingBalance(nz(customer.getRemainingBalance()).add(due));
            customerRepository.save(customer);
        }
        if (customer != null) {
            notificationService.sendBillViaSms(customer, saved);
        }
        return saved;
    }

    public SalesInvoice getInvoiceForReprint(Long invoiceId) {
        return salesInvoiceRepository.findByIdWithDetails(invoiceId)
                .orElseThrow(() -> ApiException.notFound("Invoice not found: " + invoiceId));
    }

    // ---- invoice JSON (flat maps; never serialize entities with lazy graphs) ----

    public Map<String, Object> toSummary(SalesInvoice inv) {
        Map<String, Object> m = new HashMap<>();
        BigDecimal paid = nz(paymentRepository.sumSuccessfulForInvoice(inv.getInvoiceId()));
        BigDecimal grand = nz(inv.getGrandTotal());
        BigDecimal balance = grand.subtract(paid).max(BigDecimal.ZERO);
        m.put("invoiceId", inv.getInvoiceId());
        m.put("invoiceNumber", inv.getInvoiceNumber());
        m.put("saleDateTime", inv.getSaleDateTime());
        m.put("grandTotal", grand);
        m.put("totalTaxableAmount", inv.getTotalTaxableAmount());
        m.put("totalCgst", inv.getTotalCgst());
        m.put("totalSgst", inv.getTotalSgst());
        m.put("discountPercent", nz(inv.getDiscountPercent()));
        m.put("totalDiscount", nz(inv.getTotalDiscount()));
        m.put("customerId", inv.getCustomer() != null ? inv.getCustomer().getCustomerId() : null);
        m.put("customerName", inv.getCustomer() != null ? inv.getCustomer().getName() : "Walk-in");
        m.put("itemCount", inv.getItems() != null ? inv.getItems().size() : 0);
        m.put("amountPaid", paid);
        m.put("balanceDue", balance);
        m.put("paymentStatus", balance.signum() == 0 ? "PAID" : paid.signum() == 0 ? "UNPAID" : "PARTIAL");
        return m;
    }

    public Map<String, Object> toDetail(SalesInvoice inv) {
        Map<String, Object> m = toSummary(inv);
        m.put("doctorName", inv.getCustomer() != null ? inv.getCustomer().getDoctorName() : null);
        m.put("contactNumber", inv.getCustomer() != null ? inv.getCustomer().getContactNumber() : null);
        m.put("items", inv.getItems().stream().map(item -> {
            SaleLineItemDTO dosage = new SaleLineItemDTO();
            dosage.setMorning(item.getMorning());
            dosage.setAfternoon(item.getAfternoon());
            dosage.setEvening(item.getEvening());
            dosage.setNight(item.getNight());
            dosage.setBeforeFood(item.getBeforeFood());
            dosage.setAfterFood(item.getAfterFood());
            dosage.setDurationDays(item.getDurationDays());
            BigDecimal tax = nz(item.getLineCgst()).add(nz(item.getLineSgst()));
            return line(item.getBatch().getProduct(), item.getBatch(), item.getQuantitySoldTablets(),
                    item.getUnitSellingPrice(), null, item.getLineTaxableAmount(), item.getLineCgst(),
                    item.getLineSgst(), nz(item.getLineTaxableAmount()).add(tax), dosage);
        }).toList());
        return m;
    }

    private Map<String, Object> line(Product p, InventoryBatch b, int units, BigDecimal unitPrice, BigDecimal discount,
            BigDecimal taxable, BigDecimal cgst, BigDecimal sgst, BigDecimal total, SaleLineItemDTO dosage) {
        Map<String, Object> line = new HashMap<>();
        line.put("productId", p.getProductId());
        line.put("productName", p.getName());
        line.put("hsnCode", p.getHsnCode());
        line.put("gstRate", p.getGstRate() != null ? p.getGstRate() : DEFAULT_GST);
        line.put("batchId", b.getBatchId());
        line.put("batchNumber", b.getBatchNumber());
        line.put("expiryDate", b.getExpiryDate());
        line.put("mrp", b.getMrp());
        line.put("unitsPerPack", StockService.unitsPerPack(p));
        line.put("quantityTablets", units);
        line.put("unitPrice", unitPrice);
        line.put("discount", discount);
        line.put("taxable", taxable);
        line.put("cgst", cgst);
        line.put("sgst", sgst);
        line.put("total", total);
        line.put("morning", dosage.getMorning());
        line.put("afternoon", dosage.getAfternoon());
        line.put("evening", dosage.getEvening());
        line.put("night", dosage.getNight());
        line.put("beforeFood", dosage.getBeforeFood());
        line.put("afterFood", dosage.getAfterFood());
        line.put("durationDays", dosage.getDurationDays());
        return line;
    }

    // ---- internals ----

    private BigDecimal validateAndGetDiscount(SalesRequestDTO dto) {
        if (dto == null || dto.getLineItems() == null || dto.getLineItems().isEmpty()) {
            throw ApiException.badRequest("Add at least one medicine to the bill");
        }
        for (SaleLineItemDTO l : dto.getLineItems()) {
            if (l == null || l.getProductId() == null) {
                throw ApiException.badRequest("Every bill line needs a productId");
            }
            if (l.getQuantitySoldTablets() == null || l.getQuantitySoldTablets() <= 0) {
                throw ApiException.badRequest("Quantity must be greater than zero for product " + l.getProductId());
            }
            if (l.getDurationDays() != null && l.getDurationDays() < 0) {
                throw ApiException.badRequest("Duration cannot be negative");
            }
        }
        BigDecimal d = dto.getDiscountPercent() == null ? BigDecimal.ZERO : dto.getDiscountPercent();
        if (d.signum() < 0 || d.compareTo(new BigDecimal("100")) > 0) {
            throw ApiException.badRequest("Discount must be between 0 and 100 percent");
        }
        return d.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * FEFO: takes stock from the earliest-expiring unexpired batches first, splitting a
     * line across batches when one batch is not enough. Repeated products are merged.
     */
    private List<Allocation> allocate(SalesRequestDTO dto, BigDecimal discount, boolean lock) {
        Map<Long, List<SaleLineItemDTO>> byProduct = dto.getLineItems().stream()
                .collect(Collectors.groupingBy(SaleLineItemDTO::getProductId, LinkedHashMap::new, Collectors.toList()));

        List<Allocation> result = new ArrayList<>();
        for (Map.Entry<Long, List<SaleLineItemDTO>> e : byProduct.entrySet()) {
            Product product = productRepository.findById(e.getKey())
                    .orElseThrow(() -> ApiException.notFound("Product not found: " + e.getKey()));
            int needed = e.getValue().stream().mapToInt(SaleLineItemDTO::getQuantitySoldTablets).sum();
            SaleLineItemDTO request = e.getValue().get(0);
            List<InventoryBatch> batches = lock
                    ? batchRepository.lockBatchesForSale(product.getProductId())
                    : batchRepository.findAllBatchesForProductForSale(product.getProductId());

            int available = batches.stream().mapToInt(StockService::unitsIn).sum();
            if (available < needed) {
                throw ApiException.conflict(insufficientMessage(product, needed, available));
            }
            int remaining = needed;
            for (InventoryBatch batch : batches) {
                if (remaining == 0) {
                    break;
                }
                int take = Math.min(remaining, StockService.unitsIn(batch));
                if (take == 0) {
                    continue;
                }
                result.add(new Allocation(product, batch, take, request, priceFor(product, batch, take, discount)));
                remaining -= take;
            }
        }
        return result;
    }

    private GstCalculator.Line priceFor(Product product, InventoryBatch batch, int units, BigDecimal discount) {
        // MRP is the legal ceiling and is tax-inclusive; never bill a pack above it
        BigDecimal packPrice = batch.getSellingPrice();
        if (batch.getMrp() != null && packPrice.compareTo(batch.getMrp()) > 0) {
            packPrice = batch.getMrp();
        }
        BigDecimal rate = product.getGstRate() != null ? product.getGstRate() : DEFAULT_GST;
        return GstCalculator.price(packPrice, StockService.unitsPerPack(product), units, rate, discount);
    }

    private String insufficientMessage(Product product, int needed, int available) {
        String alternatives = productService.getAlternatives(product.getProductId()).stream()
                .map(Product::getName).limit(5).collect(Collectors.joining(", "));
        return "Insufficient stock for " + product.getName() + ": requested " + needed + ", available " + available
                + (alternatives.isEmpty() ? "" : ". Alternatives in stock: " + alternatives);
    }

    private record Totals(BigDecimal discount, BigDecimal taxable, BigDecimal cgst, BigDecimal sgst, BigDecimal grand) {
    }

    private Totals totals(List<Allocation> allocations) {
        BigDecimal discount = BigDecimal.ZERO, taxable = BigDecimal.ZERO, cgst = BigDecimal.ZERO,
                sgst = BigDecimal.ZERO, grand = BigDecimal.ZERO;
        for (Allocation a : allocations) {
            discount = discount.add(a.price.discount());
            taxable = taxable.add(a.price.taxable());
            cgst = cgst.add(a.price.cgst());
            sgst = sgst.add(a.price.sgst());
            grand = grand.add(a.price.total());
        }
        return new Totals(discount, taxable, cgst, sgst, grand);
    }

    /**
     * Uses the customer by id when given; otherwise matches on name + phone (or a unique
     * name when no phone is given) so two different patients with the same name are not merged.
     */
    private Customer resolveCustomer(SalesRequestDTO dto) {
        if (dto.getCustomerId() != null) {
            Customer c = customerRepository.findById(dto.getCustomerId())
                    .orElseThrow(() -> ApiException.notFound("Customer not found: " + dto.getCustomerId()));
            applyVisitDetails(c, dto);
            return customerRepository.save(c);
        }
        String name = dto.getCustomerName() == null ? "" : dto.getCustomerName().trim();
        if (name.isEmpty()) {
            return null;
        }
        String phone = dto.getContactNumber() == null || dto.getContactNumber().isBlank() ? null
                : dto.getContactNumber().trim();
        List<Customer> matches = phone != null
                ? customerRepository.findAllByNameIgnoreCaseAndContactNumber(name, phone)
                : customerRepository.findAllByNameIgnoreCase(name);
        Customer c;
        if (matches.size() == 1) {
            c = matches.get(0);
        } else {
            c = new Customer();
            c.setName(name);
            c.setContactNumber(phone);
        }
        applyVisitDetails(c, dto);
        return customerRepository.save(c);
    }

    private void applyVisitDetails(Customer c, SalesRequestDTO dto) {
        if (dto.getDoctorName() != null && !dto.getDoctorName().isBlank()) {
            c.setDoctorName(dto.getDoctorName().trim());
        }
        if (dto.getPrescriptionImageUrl() != null && !dto.getPrescriptionImageUrl().isBlank()) {
            c.setPrescriptionImageUrl(dto.getPrescriptionImageUrl());
        }
    }

    private String nextInvoiceNumber() {
        String n;
        do {
            n = "INV-" + LocalDateTime.now().format(INVOICE_TS) + "-"
                    + String.format("%03d", ThreadLocalRandom.current().nextInt(1000));
        } while (salesInvoiceRepository.existsByInvoiceNumber(n));
        return n;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
