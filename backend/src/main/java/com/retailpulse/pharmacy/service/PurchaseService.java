package com.retailpulse.pharmacy.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.retailpulse.pharmacy.dto.BatchItemDTO;
import com.retailpulse.pharmacy.dto.PurchaseRequestDTO;
import com.retailpulse.pharmacy.exception.ApiException;
import com.retailpulse.pharmacy.model.InventoryBatch;
import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.model.PurchaseInvoice;
import com.retailpulse.pharmacy.model.Supplier;
import com.retailpulse.pharmacy.repositories.ProductRepository;
import com.retailpulse.pharmacy.repositories.PurchaseInvoiceRepository;
import com.retailpulse.pharmacy.repositories.SupplierRepository;

@Service
public class PurchaseService {

    public static final String PENDING = "PENDING";
    public static final String RECEIVED = "RECEIVED";

    private final PurchaseInvoiceRepository invoiceRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;

    public PurchaseService(PurchaseInvoiceRepository invoiceRepository, SupplierRepository supplierRepository,
            ProductRepository productRepository, StockService stockService) {
        this.invoiceRepository = invoiceRepository;
        this.supplierRepository = supplierRepository;
        this.productRepository = productRepository;
        this.stockService = stockService;
    }

    /** Records an order placed with a supplier; no stock or ledger change until it is received. */
    @Transactional
    public PurchaseInvoice createPendingOrder(PurchaseRequestDTO dto) {
        Supplier supplier = requireSupplier(dto.getSupplierId());
        String number = requireInvoiceNumber(dto.getInvoiceNumber());
        ensureUniqueNumber(supplier, number);
        if (dto.getTotalAmount() != null && dto.getTotalAmount().signum() < 0) {
            throw ApiException.badRequest("Order total cannot be negative");
        }
        PurchaseInvoice invoice = new PurchaseInvoice();
        invoice.setSupplier(supplier);
        invoice.setInvoiceNumber(number);
        invoice.setPurchaseDate(dto.getPurchaseDate() != null ? dto.getPurchaseDate() : LocalDate.now());
        invoice.setTotalAmount(dto.getTotalAmount() != null ? dto.getTotalAmount() : BigDecimal.ZERO);
        invoice.setStatus(PENDING);
        return invoiceRepository.save(invoice);
    }

    /**
     * Receives goods: creates one inventory batch per line, adds the invoice total to the
     * supplier's ledger, and (when purchaseInvoiceId is given) closes the pending order.
     */
    @Transactional
    public PurchaseInvoice processSupplierInvoice(PurchaseRequestDTO dto) {
        Supplier supplier = requireSupplier(dto.getSupplierId());
        if (dto.getBatchItems() == null || dto.getBatchItems().isEmpty()) {
            throw ApiException.badRequest("Add at least one batch line to receive");
        }

        PurchaseInvoice invoice;
        if (dto.getPurchaseInvoiceId() != null) {
            invoice = invoiceRepository.findById(dto.getPurchaseInvoiceId())
                    .orElseThrow(() -> ApiException.notFound("Purchase order not found: " + dto.getPurchaseInvoiceId()));
            if (!PENDING.equalsIgnoreCase(invoice.getStatus())) {
                throw ApiException.conflict("Purchase order " + invoice.getInvoiceNumber() + " was already " + invoice.getStatus());
            }
            if (!invoice.getSupplier().getSupplierId().equals(supplier.getSupplierId())) {
                throw ApiException.badRequest("Purchase order belongs to a different supplier");
            }
        } else {
            String number = requireInvoiceNumber(dto.getInvoiceNumber());
            ensureUniqueNumber(supplier, number);
            invoice = new PurchaseInvoice();
            invoice.setInvoiceNumber(number);
            invoice.setSupplier(supplier);
            invoice.setPurchaseDate(dto.getPurchaseDate() != null ? dto.getPurchaseDate() : LocalDate.now());
        }

        BigDecimal computedTotal = BigDecimal.ZERO;
        Set<Product> touched = new LinkedHashSet<>();
        for (BatchItemDTO item : dto.getBatchItems()) {
            Product product = validateLine(item);
            InventoryBatch batch = new InventoryBatch();
            batch.setProduct(product);
            batch.setSupplier(supplier);
            batch.setBatchNumber(item.getBatchNumber().trim());
            batch.setMfgDate(item.getMfgDate());
            batch.setExpiryDate(item.getExpiryDate());
            batch.setMrp(item.getMrp());
            batch.setCostPrice(item.getCostPrice());
            batch.setSellingPrice(item.getSellingPrice());
            batch.setStripStock(item.getStripQuantity());
            batch.setTabletStock(0);
            batch.setReceivedStrips(item.getStripQuantity());
            invoice.addBatch(batch);
            touched.add(product);
            computedTotal = computedTotal.add(item.getCostPrice().multiply(BigDecimal.valueOf(item.getStripQuantity())));
        }

        BigDecimal total = dto.getTotalAmount() != null ? dto.getTotalAmount() : computedTotal;
        if (total.signum() < 0) {
            throw ApiException.badRequest("Invoice total cannot be negative");
        }
        invoice.setTotalAmount(total);
        invoice.setStatus(RECEIVED);
        PurchaseInvoice saved = invoiceRepository.save(invoice);

        supplier.setLedgerBalance(supplier.getLedgerBalance().add(total));
        supplierRepository.save(supplier);
        touched.forEach(stockService::refreshProductQuantity);
        return saved;
    }

    public Map<String, Object> toSummary(PurchaseInvoice pi) {
        Map<String, Object> m = new HashMap<>();
        m.put("invoiceId", pi.getInvoiceId());
        m.put("invoiceNumber", pi.getInvoiceNumber());
        m.put("purchaseDate", pi.getPurchaseDate());
        m.put("totalAmount", pi.getTotalAmount());
        m.put("status", pi.getStatus());
        m.put("supplierId", pi.getSupplier() != null ? pi.getSupplier().getSupplierId() : null);
        m.put("supplierName", pi.getSupplier() != null ? pi.getSupplier().getName() : "");
        m.put("batchCount", pi.getBatches() != null ? pi.getBatches().size() : 0);
        return m;
    }

    private Product validateLine(BatchItemDTO item) {
        if (item.getProductId() == null) {
            throw ApiException.badRequest("Each line needs a productId");
        }
        Product product = productRepository.findById(item.getProductId())
                .orElseThrow(() -> ApiException.notFound("Product not found: " + item.getProductId()));
        String label = " for " + product.getName();
        if (item.getBatchNumber() == null || item.getBatchNumber().isBlank()) {
            throw ApiException.badRequest("Batch number is required" + label);
        }
        if (item.getStripQuantity() == null || item.getStripQuantity() <= 0) {
            throw ApiException.badRequest("Quantity must be greater than zero" + label);
        }
        if (item.getMfgDate() == null || item.getExpiryDate() == null) {
            throw ApiException.badRequest("Manufacturing and expiry dates are required" + label);
        }
        if (item.getMfgDate().isAfter(LocalDate.now())) {
            throw ApiException.badRequest("Manufacturing date cannot be in the future" + label);
        }
        if (!item.getExpiryDate().isAfter(item.getMfgDate()) || !item.getExpiryDate().isAfter(LocalDate.now())) {
            throw ApiException.badRequest("Expiry date must be in the future and after the manufacturing date" + label);
        }
        if (isNotPositive(item.getMrp()) || isNotPositive(item.getCostPrice()) || isNotPositive(item.getSellingPrice())) {
            throw ApiException.badRequest("MRP, cost price and selling price must be greater than zero" + label);
        }
        if (item.getSellingPrice().compareTo(item.getMrp()) > 0) {
            throw ApiException.badRequest("Selling price cannot exceed MRP" + label);
        }
        return product;
    }

    private Supplier requireSupplier(Long id) {
        if (id == null) {
            throw ApiException.badRequest("supplierId is required");
        }
        return supplierRepository.findById(id).orElseThrow(() -> ApiException.notFound("Supplier not found: " + id));
    }

    private static String requireInvoiceNumber(String n) {
        if (n == null || n.isBlank()) {
            throw ApiException.badRequest("Supplier invoice / order number is required");
        }
        return n.trim();
    }

    private void ensureUniqueNumber(Supplier supplier, String number) {
        if (invoiceRepository.existsBySupplier_SupplierIdAndInvoiceNumberIgnoreCase(supplier.getSupplierId(), number)) {
            throw ApiException.conflict("Invoice " + number + " from " + supplier.getName() + " is already recorded");
        }
    }

    private static boolean isNotPositive(BigDecimal v) {
        return v == null || v.signum() <= 0;
    }
}
