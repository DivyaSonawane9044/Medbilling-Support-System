package com.retailpulse.pharmacy.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.dto.SalesRequestDTO;
import com.retailpulse.pharmacy.model.SalesInvoice;
import com.retailpulse.pharmacy.service.BillingService;

@RestController
@RequestMapping("/api/sales")
public class SalesController {

    @Autowired
    private BillingService billingService;

    @PostMapping("/process")
    public ResponseEntity<SalesInvoice> createSale(@RequestBody SalesRequestDTO salesRequest) {
        try {
            SalesInvoice invoice = billingService.processNewSale(salesRequest);
            return ResponseEntity.ok(invoice);
        } catch (RuntimeException e) {
            // Handle specific errors like "Insufficient Stock"
            return ResponseEntity.badRequest().body(null);
        }
    }
}