package com.retailpulse.pharmacy.controller;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.repositories.SalesInvoiceRepository;
import com.retailpulse.pharmacy.service.ReportService;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    @Autowired
    private ReportService reportService;

    @Autowired
    private SalesInvoiceRepository salesInvoiceRepository;

    private ResponseEntity<InputStreamResource> pdfResponse(ByteArrayInputStream bis, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename);
        return ResponseEntity.ok().headers(headers).contentType(MediaType.APPLICATION_PDF)
                .body(new InputStreamResource(bis));
    }

    @GetMapping("/daily")
    public ResponseEntity<InputStreamResource> getDailyReport() {
        LocalDateTime start = LocalDateTime.now().with(LocalTime.MIN);
        LocalDateTime end = LocalDateTime.now().with(LocalTime.MAX);
        return pdfResponse(reportService.generateSalesPdfReport(start, end, "Daily Sales - " + LocalDate.now()), "daily_sales.pdf");
    }

    @GetMapping("/monthly")
    public ResponseEntity<InputStreamResource> getMonthlyReport() {
        LocalDateTime start = LocalDateTime.now().with(TemporalAdjusters.firstDayOfMonth()).with(LocalTime.MIN);
        LocalDateTime end = LocalDateTime.now().with(TemporalAdjusters.lastDayOfMonth()).with(LocalTime.MAX);
        return pdfResponse(reportService.generateSalesPdfReport(start, end, "Monthly Sales - " + LocalDate.now().getMonth()), "monthly_sales.pdf");
    }

    @GetMapping("/yearly")
    public ResponseEntity<InputStreamResource> getYearlyReport() {
        LocalDateTime start = LocalDateTime.now().with(TemporalAdjusters.firstDayOfYear()).with(LocalTime.MIN);
        LocalDateTime end = LocalDateTime.now().with(TemporalAdjusters.lastDayOfYear()).with(LocalTime.MAX);
        return pdfResponse(reportService.generateSalesPdfReport(start, end, "Yearly Sales - " + LocalDate.now().getYear()), "yearly_sales.pdf");
    }

    @GetMapping("/stock")
    public ResponseEntity<InputStreamResource> stockReport() {
        return pdfResponse(reportService.generateStockPdfReport(), "stock_report.pdf");
    }

    @GetMapping("/expiry")
    public ResponseEntity<InputStreamResource> expiryReport() {
        return pdfResponse(reportService.generateExpiryPdfReport(), "expiry_report.pdf");
    }

    @GetMapping("/profit-loss")
    public ResponseEntity<InputStreamResource> profitLossReport() {
        return pdfResponse(reportService.generateProfitLossPdfReport(), "profit_loss.pdf");
    }

    @GetMapping("/purchases")
    public ResponseEntity<InputStreamResource> purchaseReport() {
        return pdfResponse(reportService.generatePurchasePdfReport(), "purchase_report.pdf");
    }

    @GetMapping("/medicines")
    public ResponseEntity<InputStreamResource> medicinesReport() {
        return pdfResponse(reportService.generateMedicinesPdfReport(), "medicines_alphabetical.pdf");
    }

    @GetMapping("/customer/{customerId}")
    public ResponseEntity<InputStreamResource> customerPurchaseReport(@PathVariable Long customerId) {
        LocalDateTime start = LocalDateTime.now().minusYears(5);
        LocalDateTime end = LocalDateTime.now();
        var invoices = salesInvoiceRepository.findByCustomerIdWithItems(customerId);
        ByteArrayInputStream bis = reportService.generateSalesPdfReport(start, end,
                "Customer Purchase Report - ID " + customerId + " (" + invoices.size() + " invoices)");
        return pdfResponse(bis, "customer_" + customerId + "_purchases.pdf");
    }

    @GetMapping("/gst/monthly")
    public ResponseEntity<String> monthlyGstCsv() {
        LocalDateTime start = LocalDateTime.now().with(TemporalAdjusters.firstDayOfMonth()).with(LocalTime.MIN);
        LocalDateTime end = LocalDateTime.now().with(TemporalAdjusters.lastDayOfMonth()).with(LocalTime.MAX);
        String csv = reportService.generateGstCsv(start, end);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=gst_monthly.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping("/gst/yearly")
    public ResponseEntity<String> yearlyGstCsv() {
        LocalDateTime start = LocalDateTime.now().with(TemporalAdjusters.firstDayOfYear()).with(LocalTime.MIN);
        LocalDateTime end = LocalDateTime.now().with(TemporalAdjusters.lastDayOfYear()).with(LocalTime.MAX);
        String csv = reportService.generateGstCsv(start, end);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=gst_yearly.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }
}
