package com.retailpulse.pharmacy.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.dto.InventoryBatchDTO;
import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.model.PurchaseInvoice;
import com.retailpulse.pharmacy.service.AnalyticsService;
import com.retailpulse.pharmacy.service.InventoryService;
import com.retailpulse.pharmacy.repositories.PurchaseInvoiceRepository;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final AnalyticsService analyticsService;
    private final InventoryService inventoryService;
    private final PurchaseInvoiceRepository purchaseInvoiceRepository;

    public NotificationController(
            AnalyticsService analyticsService,
            InventoryService inventoryService,
            PurchaseInvoiceRepository purchaseInvoiceRepository) {
        this.analyticsService = analyticsService;
        this.inventoryService = inventoryService;
        this.purchaseInvoiceRepository = purchaseInvoiceRepository;
    }

    @GetMapping("/alerts")
    public ResponseEntity<Map<String, Object>> getAlerts(
            @RequestParam(defaultValue = "30") double stockThreshold) {
        List<Product> lowStock = analyticsService.getProductsBelowThreshold(stockThreshold);
        List<InventoryBatchDTO> nearExpiry = inventoryService.getNearExpiryItems();
        List<InventoryBatchDTO> expired = inventoryService.getExpiredItems();
        List<PurchaseInvoice> pending = purchaseInvoiceRepository.findByStatusIgnoreCase("PENDING");

        Map<String, Object> payload = new HashMap<>();
        payload.put("lowStock", lowStock);
        payload.put("nearExpiry", nearExpiry);
        payload.put("expired", expired);
        payload.put("pendingPurchases", pending.stream().map(pi -> {
            Map<String, Object> m = new HashMap<>();
            m.put("invoiceId", pi.getInvoiceId());
            m.put("invoiceNumber", pi.getInvoiceNumber());
            m.put("supplierName", pi.getSupplier() != null ? pi.getSupplier().getName() : "");
            m.put("totalAmount", pi.getTotalAmount());
            m.put("status", pi.getStatus());
            return m;
        }).collect(Collectors.toList()));
        return ResponseEntity.ok(payload);
    }
}
