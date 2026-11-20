package com.retailpulse.pharmacy.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.dto.PurchaseRequestDTO;
import com.retailpulse.pharmacy.repositories.PurchaseInvoiceRepository;
import com.retailpulse.pharmacy.service.PurchaseService;

@RestController
@RequestMapping("/api/purchases")
public class PurchaseController {

    private final PurchaseService purchaseService;
    private final PurchaseInvoiceRepository purchaseInvoiceRepository;

    public PurchaseController(PurchaseService purchaseService, PurchaseInvoiceRepository purchaseInvoiceRepository) {
        this.purchaseService = purchaseService;
        this.purchaseInvoiceRepository = purchaseInvoiceRepository;
    }

    @GetMapping
    public List<Map<String, Object>> getAllPurchases() {
        return purchaseInvoiceRepository.findAllByOrderByPurchaseDateDescInvoiceIdDesc().stream()
                .map(purchaseService::toSummary).toList();
    }

    @PostMapping("/order")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createPurchaseOrder(@RequestBody PurchaseRequestDTO dto) {
        return purchaseService.toSummary(purchaseService.createPendingOrder(dto));
    }

    @PostMapping("/receive")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> receiveStock(@RequestBody PurchaseRequestDTO dto) {
        return purchaseService.toSummary(purchaseService.processSupplierInvoice(dto));
    }

    @GetMapping("/pending")
    public List<Map<String, Object>> getPendingPurchases() {
        return purchaseInvoiceRepository.findByStatusIgnoreCase(PurchaseService.PENDING).stream()
                .map(purchaseService::toSummary).toList();
    }
}
