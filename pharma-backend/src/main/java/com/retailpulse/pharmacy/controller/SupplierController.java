package com.retailpulse.pharmacy.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.model.Supplier;
import com.retailpulse.pharmacy.repositories.PurchaseInvoiceRepository;
import com.retailpulse.pharmacy.service.SupplierService;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {
    private final SupplierService supplierService;
    private final PurchaseInvoiceRepository purchaseInvoiceRepository;

    @Autowired
    public SupplierController(SupplierService supplierService,
                              PurchaseInvoiceRepository purchaseInvoiceRepository) {
        this.supplierService = supplierService;
        this.purchaseInvoiceRepository = purchaseInvoiceRepository;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Supplier createSupplier(@RequestBody Supplier supplier) {
        return supplierService.saveOrUpdateSupplier(supplier);
    }

    @GetMapping
    public ResponseEntity<List<Supplier>> getAllSuppliers(@RequestParam(name = "search", required = false) String search) {
        if (search == null || search.trim().isEmpty()) {
            return ResponseEntity.ok(supplierService.getAllSuppliers());
        }
        return ResponseEntity.ok(supplierService.searchSuppliers(search));
    }

    @GetMapping("/search")
    public ResponseEntity<List<Supplier>> searchSuppliers(@RequestParam String name) {
        return ResponseEntity.ok(supplierService.searchSuppliers(name));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Supplier> getSupplierById(@PathVariable Long id) {
        return supplierService.getSupplierById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<Map<String, Object>>> getSupplierHistory(@PathVariable Long id) {
        Optional<Supplier> supplier = supplierService.getSupplierById(id);
        if (supplier.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        List<Map<String, Object>> history = purchaseInvoiceRepository
                .findBySupplier_SupplierIdWithBatches(id)
                .stream()
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
                        item.put("quantity", batch.getStripStock());
                        item.put("costPrice", batch.getCostPrice());
                        item.put("sellingPrice", batch.getSellingPrice());
                        item.put("mrp", batch.getMrp());
                        return item;
                    }).collect(Collectors.toList()));
                    return record;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(history);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Supplier> updateSupplier(@PathVariable Long id, @RequestBody Supplier supplierDetails) {
        supplierDetails.setSupplierId(id);
        Supplier updatedSupplier = supplierService.saveOrUpdateSupplier(supplierDetails);
        return ResponseEntity.ok(updatedSupplier);
    }

    @PostMapping("/{id}/pay")
    public ResponseEntity<String> processSupplierPayment(@PathVariable Long id, @RequestBody java.util.Map<String, Object> payload) {
        return supplierService.getSupplierById(id).map(supplier -> {
            java.math.BigDecimal amountPaid = new java.math.BigDecimal(payload.get("amount").toString());
            supplierService.updateSupplierLedger(id, amountPaid.negate());
            return ResponseEntity.ok("Payment to supplier logged successfully. Amount: " + amountPaid);
        }).orElse(ResponseEntity.notFound().build());
    }
}
