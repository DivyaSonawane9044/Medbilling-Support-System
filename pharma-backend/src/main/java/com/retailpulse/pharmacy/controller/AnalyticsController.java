package com.retailpulse.pharmacy.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.dto.DashboardDTO;
import com.retailpulse.pharmacy.service.AnalyticsService;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    @Autowired
    private AnalyticsService analyticsService;

    @Autowired
    private com.retailpulse.pharmacy.repositories.SalesInvoiceRepository salesInvoiceRepository;

    @Autowired
    private com.retailpulse.pharmacy.service.InventoryService inventoryService;

    // Feature 6 & 9: Dashboard and Reporting Endpoint
    @GetMapping("/dashboard")
    public ResponseEntity<DashboardDTO> getDashboard() {
        DashboardDTO dashboard = analyticsService.getDashboardMetrics();
        return ResponseEntity.ok(dashboard);
    }

    // Feature 5 & 9: Export GST Report as CSV
    @GetMapping("/export/gst")
    public void exportGstReport(jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        response.setContentType("text/csv");
        response.setHeader("Content-Disposition", "attachment; filename=\"gst_report.csv\"");
        
        java.io.PrintWriter writer = response.getWriter();
        writer.println("Invoice Number,Date,Taxable Amount,CGST,SGST,Grand Total");
        for (com.retailpulse.pharmacy.model.SalesInvoice inv : salesInvoiceRepository.findAll()) {
            writer.printf("%s,%s,%s,%s,%s,%s%n",
                    inv.getInvoiceNumber(),
                    inv.getSaleDateTime() != null ? inv.getSaleDateTime().toLocalDate() : "",
                    inv.getTotalTaxableAmount(),
                    inv.getTotalCgst(),
                    inv.getTotalSgst(),
                    inv.getGrandTotal());
        }
        writer.flush();
    }

    // Feature 2 & 9: Export Expiry Report as CSV
    @GetMapping("/export/expiry")
    public void exportExpiryReport(jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        response.setContentType("text/csv");
        response.setHeader("Content-Disposition", "attachment; filename=\"expiry_report.csv\"");
        
        java.io.PrintWriter writer = response.getWriter();
        writer.println("Batch Number,Product Name,Expiry Date,Stock Strips,Stock Tablets");
        for (com.retailpulse.pharmacy.dto.InventoryBatchDTO batch : inventoryService.getNearExpiryItems()) {
            String productName = batch.getProduct() != null ? batch.getProduct().getName() : "";
            writer.printf("%s,%s,%s,%s,%s%n",
                    batch.getBatchNumber(),
                    productName,
                    batch.getExpiryDate(),
                    batch.getStripStock(),
                    batch.getTabletStock());
        }
        writer.flush();
    }

    // New: Get products below a specific stock percentage threshold (e.g., 30, 40)
    @GetMapping("/stock-alerts")
    public ResponseEntity<java.util.List<com.retailpulse.pharmacy.model.Product>> getLowStockByPercentage(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "30") double threshold) {
        return ResponseEntity.ok(analyticsService.getProductsBelowThreshold(threshold));
    }
}
