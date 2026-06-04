package com.retailpulse.pharmacy.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.service.AnalyticsService;

@RestController
@RequestMapping("/api/accounting")
public class AccountingController {

    @Autowired
    private AnalyticsService analyticsService;

    @GetMapping("/summary")
    public ResponseEntity<?> getSummary(@RequestParam(defaultValue = "today") String period) {
        return ResponseEntity.ok(analyticsService.getAccountingSummary(period));
    }
}
