// retailpulse-backend/src/main/java/com/retailpulse/pharmacy/controller/PurchaseController.java
package com.retailpulse.pharmacy.controller;

import com.retailpulse.pharmacy.dto.PurchaseRequestDTO;
import com.retailpulse.pharmacy.model.PurchaseInvoice;
import com.retailpulse.pharmacy.service.PurchaseService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/purchases")
public class PurchaseController {

    private final PurchaseService purchaseService;
    private final com.retailpulse.pharmacy.repositories.PurchaseInvoiceRepository purchaseInvoiceRepository;

    @Autowired
    public PurchaseController(
            PurchaseService purchaseService,
            com.retailpulse.pharmacy.repositories.PurchaseInvoiceRepository purchaseInvoiceRepository) {
        this.purchaseService = purchaseService;
        this.purchaseInvoiceRepository = purchaseInvoiceRepository;
    }

    @GetMapping
    public java.util.List<java.util.Map<String, Object>> getAllPurchases() {
        return purchaseInvoiceRepository.findAll().stream().map(pi -> {
            java.util.Map<String, Object> m = new java.util.HashMap<>();
            m.put("invoiceId", pi.getInvoiceId());
            m.put("invoiceNumber", pi.getInvoiceNumber());
            m.put("purchaseDate", pi.getPurchaseDate());
            m.put("totalAmount", pi.getTotalAmount());
            m.put("status", pi.getStatus());
            m.put("supplierId", pi.getSupplier() != null ? pi.getSupplier().getSupplierId() : null);
            m.put("supplierName", pi.getSupplier() != null ? pi.getSupplier().getName() : "");
            m.put("batchCount", pi.getBatches() != null ? pi.getBatches().size() : 0);
            return m;
        }).collect(java.util.stream.Collectors.toList());
    }

    
    @PostMapping("/order")
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseInvoice createPurchaseOrder(@RequestBody PurchaseRequestDTO dto) {
        return purchaseService.createPendingOrder(dto);
    }

    @PostMapping("/receive")
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseInvoice receiveStock(@RequestBody PurchaseRequestDTO dto) {
        return purchaseService.processSupplierInvoice(dto);
    }

    @GetMapping("/pending")
    public java.util.List<PurchaseInvoice> getPendingPurchases() {
        return purchaseInvoiceRepository.findByStatusIgnoreCase("PENDING");
    }
}
