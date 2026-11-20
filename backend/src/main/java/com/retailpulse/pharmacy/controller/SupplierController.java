package com.retailpulse.pharmacy.controller;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.exception.ApiException;
import com.retailpulse.pharmacy.model.Supplier;
import com.retailpulse.pharmacy.repositories.PurchaseInvoiceRepository;
import com.retailpulse.pharmacy.service.SupplierService;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {

    private final SupplierService supplierService;
    private final PurchaseInvoiceRepository purchaseInvoiceRepository;

    public SupplierController(SupplierService supplierService, PurchaseInvoiceRepository purchaseInvoiceRepository) {
        this.supplierService = supplierService;
        this.purchaseInvoiceRepository = purchaseInvoiceRepository;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Supplier createSupplier(@RequestBody Supplier supplier) {
        return supplierService.create(supplier);
    }

    @GetMapping
    public List<Supplier> getAllSuppliers(@RequestParam(name = "search", required = false) String search) {
        return supplierService.searchSuppliers(search);
    }

    @GetMapping("/search")
    public List<Supplier> searchSuppliers(@RequestParam String name) {
        return supplierService.searchSuppliers(name);
    }

    @GetMapping("/{id}")
    public Supplier getSupplierById(@PathVariable Long id) {
        return supplierService.require(id);
    }

    @GetMapping("/{id}/history")
    public List<Map<String, Object>> getSupplierHistory(@PathVariable Long id) {
        supplierService.require(id);
        return purchaseInvoiceRepository.findBySupplier_SupplierIdWithBatches(id).stream()
                .sorted(java.util.Comparator.comparing(
                        (com.retailpulse.pharmacy.model.PurchaseInvoice pi) -> pi.getPurchaseDate()).reversed())
                .map(invoice -> {
                    Map<String, Object> record = new HashMap<>();
                    record.put("invoiceId", invoice.getInvoiceId());
                    record.put("invoiceNumber", invoice.getInvoiceNumber());
                    record.put("purchaseDate", invoice.getPurchaseDate());
                    record.put("totalAmount", invoice.getTotalAmount());
                    record.put("status", invoice.getStatus());
                    record.put("items", invoice.getBatches().stream().map(batch -> {
                        Map<String, Object> item = new HashMap<>();
                        item.put("productName", batch.getProduct().getName());
                        item.put("company", batch.getProduct().getCompany());
                        item.put("batchNumber", batch.getBatchNumber());
                        item.put("expiryDate", batch.getExpiryDate());
                        // Quantity received on this invoice (older rows without it fall back to current stock)
                        item.put("quantity", batch.getReceivedStrips() != null ? batch.getReceivedStrips() : batch.getStripStock());
                        item.put("remainingStrips", batch.getStripStock());
                        item.put("costPrice", batch.getCostPrice());
                        item.put("sellingPrice", batch.getSellingPrice());
                        item.put("mrp", batch.getMrp());
                        return item;
                    }).toList());
                    return record;
                })
                .toList();
    }

    @PutMapping("/{id}")
    public Supplier updateSupplier(@PathVariable Long id, @RequestBody Supplier supplierDetails) {
        return supplierService.update(id, supplierDetails);
    }

    /** Body: {amount}. Records money paid to the supplier and reduces what we owe them. */
    @PostMapping("/{id}/pay")
    public Map<String, Object> processSupplierPayment(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        BigDecimal amount = PaymentController.optionalAmount(payload);
        if (amount == null || amount.signum() <= 0) {
            throw ApiException.badRequest("Payment amount must be greater than zero");
        }
        Supplier s = supplierService.recordPayment(id, amount);
        return Map.of("supplierId", s.getSupplierId(), "amountPaid", amount, "ledgerBalance", s.getLedgerBalance());
    }
}
