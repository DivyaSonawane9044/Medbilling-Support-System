package com.retailpulse.pharmacy.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.retailpulse.pharmacy.dto.SaleLineItemDTO;
import com.retailpulse.pharmacy.dto.SalesRequestDTO;
import com.retailpulse.pharmacy.model.Customer;
import com.retailpulse.pharmacy.model.InventoryBatch;
import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.model.SalesInvoice;
import com.retailpulse.pharmacy.model.SalesInvoiceItem;
import com.retailpulse.pharmacy.repositories.CustomerRepository;
import com.retailpulse.pharmacy.repositories.InventoryBatchRepository;
import com.retailpulse.pharmacy.repositories.ProductRepository;
import com.retailpulse.pharmacy.repositories.SalesInvoiceRepository;

import jakarta.transaction.Transactional;

@Service
public class BillingService {

    @Autowired
    private SalesInvoiceRepository salesInvoiceRepository;

    @Autowired
    private InventoryBatchRepository batchRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductService productService;

    @Autowired
    private com.retailpulse.pharmacy.repositories.PaymentRepository paymentRepository;

    @Autowired
    private NotificationService notificationService;

    @Transactional
    public SalesInvoice processNewSale(SalesRequestDTO dto) {
        // 1. Customer Handling
        Customer customer = handleCustomer(dto);

        // 2. Initialize Invoice
        SalesInvoice invoice = new SalesInvoice();
        invoice.setInvoiceNumber("INV-" + System.currentTimeMillis());
        invoice.setCustomer(customer);
        invoice.setSaleDateTime(LocalDateTime.now());
        invoice.setGrandTotal(BigDecimal.ZERO);
        invoice.setTotalTaxableAmount(BigDecimal.ZERO);
        invoice.setTotalCgst(BigDecimal.ZERO);
        invoice.setTotalSgst(BigDecimal.ZERO);

        // 3. Process Line Items
        for (SaleLineItemDTO lineDto : dto.getLineItems()) {
            Product product = productRepository.findById(lineDto.getProductId())
                    .orElseThrow(() -> new RuntimeException("Product not found: " + lineDto.getProductId()));

            // Find best batch using FEFO (First Expiry, First Out)
            InventoryBatch selectedBatch = findBestBatch(product.getProductId(), lineDto.getQuantitySoldTablets());

            // Price Calculations
            BigDecimal perTabletPrice = calculatePerTabletPrice(selectedBatch);
            BigDecimal lineTotal = perTabletPrice.multiply(new BigDecimal(lineDto.getQuantitySoldTablets()));

            // Create Sales Item
            SalesInvoiceItem item = new SalesInvoiceItem();
            item.setBatch(selectedBatch);
            item.setQuantitySoldTablets(lineDto.getQuantitySoldTablets());
            item.setUnitSellingPrice(perTabletPrice);
            
            // Map Dosage Array Options
            item.setMorning(lineDto.getMorning());
            item.setAfternoon(lineDto.getAfternoon());
            item.setEvening(lineDto.getEvening());
            item.setNight(lineDto.getNight());
            item.setBeforeFood(lineDto.getBeforeFood());
            item.setAfterFood(lineDto.getAfterFood());
            item.setDurationDays(lineDto.getDurationDays());

            // Tax calculation
            calculateItemTaxes(item, lineTotal);
            
            invoice.addItem(item);

            // 4. Update Stock
            deductStock(selectedBatch, lineDto.getQuantitySoldTablets());
        }

        // 5. Finalize Totals
        calculateInvoiceTotals(invoice);

        SalesInvoice saved = salesInvoiceRepository.save(invoice);
        recordPaymentForSale(saved, dto, customer);
        if (customer != null) {
            notificationService.sendBillViaSms(customer, saved);
            notificationService.sendBillViaWhatsApp(customer, saved);
        }
        return saved;
    }

    private void recordPaymentForSale(SalesInvoice invoice, SalesRequestDTO dto, Customer customer) {
        java.math.BigDecimal paid = dto.getAmountPaid() != null ? dto.getAmountPaid() : invoice.getGrandTotal();
        String method = dto.getPaymentMethod() != null ? dto.getPaymentMethod() : "Cash";

        com.retailpulse.pharmacy.model.Payment payment = new com.retailpulse.pharmacy.model.Payment();
        payment.setInvoice(invoice);
        payment.setAmountPaid(paid);
        payment.setPaymentMethod(method);
        payment.setPaymentStatus("SUCCESS");
        payment.setTransactionReference("SALE-" + invoice.getInvoiceNumber());
        paymentRepository.save(payment);

        if (customer != null && paid.compareTo(invoice.getGrandTotal()) < 0) {
            java.math.BigDecimal due = invoice.getGrandTotal().subtract(paid);
            customer.setRemainingBalance(customer.getRemainingBalance().add(due));
            customerRepository.save(customer);
        }
    }

    private Customer handleCustomer(SalesRequestDTO dto) {
        if (dto.getCustomerId() != null) {
            return customerRepository.findById(dto.getCustomerId()).orElse(null);
        }
        if (dto.getCustomerName() == null || dto.getCustomerName().trim().isEmpty()) {
            return null;
        }
        return customerRepository.findByNameIgnoreCase(dto.getCustomerName())
                .map(existing -> {
                    if (dto.getContactNumber() != null) existing.setContactNumber(dto.getContactNumber());
                    if (dto.getDoctorName() != null) existing.setDoctorName(dto.getDoctorName());
                    if (dto.getPrescriptionImageUrl() != null) existing.setPrescriptionImageUrl(dto.getPrescriptionImageUrl());
                    return customerRepository.save(existing);
                })
                .orElseGet(() -> {
                    Customer newCustomer = new Customer();
                    newCustomer.setName(dto.getCustomerName());
                    newCustomer.setContactNumber(dto.getContactNumber());
                    newCustomer.setDoctorName(dto.getDoctorName());
                    if (dto.getPrescriptionImageUrl() != null) {
                        newCustomer.setPrescriptionImageUrl(dto.getPrescriptionImageUrl());
                    }
                    return customerRepository.save(newCustomer);
                });
    }

    public SalesInvoice getInvoiceForReprint(Long invoiceId) {
        return salesInvoiceRepository.findByIdWithDetails(invoiceId)
                .orElseThrow(() -> new RuntimeException("Invoice not found: " + invoiceId));
    }

    private BigDecimal calculatePerTabletPrice(InventoryBatch batch) {
        Product product = batch.getProduct();
        BigDecimal stripPrice = batch.getSellingPrice();
        int stripSize = getEffectiveStripSize(product);

        return stripPrice.divide(new BigDecimal(stripSize), 4, RoundingMode.HALF_UP);
    }

    private int getEffectiveStripSize(Product product) {
        // For Syrups, Bottles, or unit-based items, strip size is effectively 1
        if ("Syrup".equalsIgnoreCase(product.getDosageForm()) || "Bottle".equalsIgnoreCase(product.getUnitType())) {
            return 1;
        }
        return (product.getStripSize() != null && product.getStripSize() > 0) ? product.getStripSize() : 1;
    }

    private InventoryBatch findBestBatch(Long productId, Integer requiredTablets) {
        // Fetch batches for product, sorted by expiry date ascending
        List<InventoryBatch> batches = batchRepository.findAllBatchesForProductForSale(productId);

        for (InventoryBatch batch : batches) {
            int stripSize = getEffectiveStripSize(batch.getProduct());
            int totalAvailableTablets = (batch.getStripStock() * stripSize) + batch.getTabletStock();
            if (totalAvailableTablets >= requiredTablets) {
                return batch;
            }
        }
        
        // Feature: Automatically suggest alternatives if out of stock
        List<Product> alternatives = productService.getAlternatives(productId);
        String altMessage = alternatives.isEmpty() ? "" : 
            " Consider alternatives: " + alternatives.stream().map(Product::getName).collect(java.util.stream.Collectors.joining(", "));

        throw new RuntimeException("Insufficient stock for product ID: " + productId + "." + altMessage);
    }

    private void deductStock(InventoryBatch batch, Integer tabletsToDeduct) {
        int stripSize = getEffectiveStripSize(batch.getProduct());
        
        // Convert current stock to total tablets
        int currentTotalTablets = (batch.getStripStock() * stripSize) + batch.getTabletStock();
        int remainingTotalTablets = currentTotalTablets - tabletsToDeduct;

        if (remainingTotalTablets < 0) {
            throw new RuntimeException("Stock went negative during deduction for batch: " + batch.getBatchNumber());
        }

        // Convert back to strips and loose tablets
        batch.setStripStock(remainingTotalTablets / stripSize);
        batch.setTabletStock(remainingTotalTablets % stripSize);

        batchRepository.save(batch);
    }

    private void calculateInvoiceTotals(SalesInvoice invoice) {
        BigDecimal totalTaxable = BigDecimal.ZERO;
        BigDecimal totalCgst = BigDecimal.ZERO;
        BigDecimal totalSgst = BigDecimal.ZERO;
        BigDecimal grandTotal = BigDecimal.ZERO;

        for (SalesInvoiceItem item : invoice.getItems()) {
            if(item.getLineTaxableAmount() != null) totalTaxable = totalTaxable.add(item.getLineTaxableAmount());
            if(item.getLineCgst() != null) totalCgst = totalCgst.add(item.getLineCgst());
            if(item.getLineSgst() != null) totalSgst = totalSgst.add(item.getLineSgst());
            if(item.getLineTotal() != null) grandTotal = grandTotal.add(item.getLineTotal());
        }

        invoice.setTotalTaxableAmount(totalTaxable.setScale(2, RoundingMode.HALF_UP));
        invoice.setTotalCgst(totalCgst.setScale(2, RoundingMode.HALF_UP));
        invoice.setTotalSgst(totalSgst.setScale(2, RoundingMode.HALF_UP));
        invoice.setGrandTotal(grandTotal.setScale(2, RoundingMode.HALF_UP));
    }
    private void calculateItemTaxes(SalesInvoiceItem item, BigDecimal taxableAmount) {
        // Assuming a standard 12% GST (6% CGST + 6% SGST)
        // You can also fetch GST % from the Product Master if you added it there
        BigDecimal taxRate = new BigDecimal("0.06"); // 6%
        
        BigDecimal cgst = taxableAmount.multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal sgst = taxableAmount.multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
        
        item.setLineTaxableAmount(taxableAmount);
        item.setLineCgst(cgst);
        item.setLineSgst(sgst);
        item.setLineTotal(taxableAmount.add(cgst).add(sgst));
    }
}