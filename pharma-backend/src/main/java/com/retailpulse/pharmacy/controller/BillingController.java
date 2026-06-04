package com.retailpulse.pharmacy.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.dto.SalesRequestDTO;
import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.model.SalesInvoice;
import com.retailpulse.pharmacy.model.SalesInvoiceItem;
import com.retailpulse.pharmacy.repositories.SalesInvoiceRepository;
import com.retailpulse.pharmacy.service.BillingService;
import com.retailpulse.pharmacy.service.NotificationService;

@RestController
@RequestMapping("/api/sales")
public class BillingController {

    private final BillingService billingService;
    private final com.retailpulse.pharmacy.repositories.ProductRepository productRepository;
    private final SalesInvoiceRepository salesInvoiceRepository;
    private final NotificationService notificationService;

    @Autowired
    public BillingController(
            BillingService billingService,
            com.retailpulse.pharmacy.repositories.ProductRepository productRepository,
            SalesInvoiceRepository salesInvoiceRepository,
            NotificationService notificationService) {
        this.billingService = billingService;
        this.productRepository = productRepository;
        this.salesInvoiceRepository = salesInvoiceRepository;
        this.notificationService = notificationService;
    }

    @GetMapping("/invoices")
    public List<Map<String, Object>> listInvoices() {
        return salesInvoiceRepository.findAll().stream().map(this::invoiceSummary).toList();
    }

    @GetMapping("/invoices/{id}")
    public ResponseEntity<Map<String, Object>> getInvoice(@PathVariable Long id) {
        SalesInvoice inv = billingService.getInvoiceForReprint(id);
        return ResponseEntity.ok(invoiceDetail(inv));
    }

    @PostMapping("/invoices/{id}/notify")
    public ResponseEntity<Map<String, String>> notifyCustomer(
            @PathVariable Long id,
            @RequestParam(defaultValue = "sms") String channel) {
        SalesInvoice inv = billingService.getInvoiceForReprint(id);
        if (inv.getCustomer() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "No customer on invoice"));
        }
        if ("whatsapp".equalsIgnoreCase(channel)) {
            notificationService.sendBillViaWhatsApp(inv.getCustomer(), inv);
        } else {
            notificationService.sendBillViaSms(inv.getCustomer(), inv);
        }
        return ResponseEntity.ok(Map.of("status", "sent", "channel", channel));
    }

    @PostMapping("/bill")
    @ResponseStatus(HttpStatus.CREATED)
    public SalesInvoice generateBill(@RequestBody SalesRequestDTO dto) {
        return billingService.processNewSale(dto);
    }

    @GetMapping("/barcode")
    public ResponseEntity<Product> findByBarcode(@RequestParam String code) {
        return productRepository.findByBarcode(code)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/search")
    public List<Product> quickProductSearch(@RequestParam String query) {
        return productRepository
                .findByNameContainingIgnoreCaseOrCompanyContainingIgnoreCaseOrGenericNameContainingIgnoreCase(
                        query, query, query);
    }

    @GetMapping("/searchByCompany")
    public List<Product> searchByCompany(@RequestParam String company) {
        return productRepository.findByCompanyContainingIgnoreCase(company);
    }

    private Map<String, Object> invoiceSummary(SalesInvoice inv) {
        Map<String, Object> m = new HashMap<>();
        m.put("invoiceId", inv.getInvoiceId());
        m.put("invoiceNumber", inv.getInvoiceNumber());
        m.put("saleDateTime", inv.getSaleDateTime());
        m.put("grandTotal", inv.getGrandTotal());
        m.put("totalTaxableAmount", inv.getTotalTaxableAmount());
        m.put("totalCgst", inv.getTotalCgst());
        m.put("totalSgst", inv.getTotalSgst());
        m.put("customerName", inv.getCustomer() != null ? inv.getCustomer().getName() : "Walk-in");
        m.put("itemCount", inv.getItems() != null ? inv.getItems().size() : 0);
        return m;
    }

    private Map<String, Object> invoiceDetail(SalesInvoice inv) {
        Map<String, Object> m = invoiceSummary(inv);
        m.put("doctorName", inv.getCustomer() != null ? inv.getCustomer().getDoctorName() : null);
        m.put("contactNumber", inv.getCustomer() != null ? inv.getCustomer().getContactNumber() : null);
        m.put("items", inv.getItems().stream().map(item -> {
            Map<String, Object> line = new HashMap<>();
            line.put("productName", item.getBatch().getProduct().getName());
            line.put("quantityTablets", item.getQuantitySoldTablets());
            line.put("unitPrice", item.getUnitSellingPrice());
            line.put("taxable", item.getLineTaxableAmount());
            line.put("cgst", item.getLineCgst());
            line.put("sgst", item.getLineSgst());
            line.put("total", item.getLineTotal());
            line.put("morning", item.getMorning());
            line.put("afternoon", item.getAfternoon());
            line.put("evening", item.getEvening());
            line.put("night", item.getNight());
            line.put("beforeFood", item.getBeforeFood());
            line.put("afterFood", item.getAfterFood());
            line.put("durationDays", item.getDurationDays());
            return line;
        }).toList());
        return m;
    }
}
