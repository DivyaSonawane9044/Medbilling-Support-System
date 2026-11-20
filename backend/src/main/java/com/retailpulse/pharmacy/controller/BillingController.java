package com.retailpulse.pharmacy.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.dto.SalesRequestDTO;
import com.retailpulse.pharmacy.exception.ApiException;
import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.model.SalesInvoice;
import com.retailpulse.pharmacy.repositories.ProductRepository;
import com.retailpulse.pharmacy.repositories.SalesInvoiceRepository;
import com.retailpulse.pharmacy.service.BillingService;
import com.retailpulse.pharmacy.service.NotificationService;

@RestController
@RequestMapping("/api/sales")
public class BillingController {

    private final BillingService billingService;
    private final ProductRepository productRepository;
    private final SalesInvoiceRepository salesInvoiceRepository;
    private final NotificationService notificationService;

    public BillingController(BillingService billingService, ProductRepository productRepository,
            SalesInvoiceRepository salesInvoiceRepository, NotificationService notificationService) {
        this.billingService = billingService;
        this.productRepository = productRepository;
        this.salesInvoiceRepository = salesInvoiceRepository;
        this.notificationService = notificationService;
    }

    @GetMapping("/invoices")
    public List<Map<String, Object>> listInvoices() {
        return salesInvoiceRepository.findAllByOrderBySaleDateTimeDesc().stream().map(billingService::toSummary).toList();
    }

    @GetMapping("/invoices/{id}")
    public Map<String, Object> getInvoice(@PathVariable Long id) {
        return billingService.toDetail(billingService.getInvoiceForReprint(id));
    }

    @PostMapping("/invoices/{id}/notify")
    public Map<String, String> notifyCustomer(@PathVariable Long id, @RequestParam(defaultValue = "sms") String channel) {
        SalesInvoice inv = billingService.getInvoiceForReprint(id);
        if (inv.getCustomer() == null) {
            throw ApiException.badRequest("No customer on this invoice");
        }
        if (inv.getCustomer().getContactNumber() == null || inv.getCustomer().getContactNumber().isBlank()) {
            throw ApiException.badRequest("Customer has no contact number");
        }
        boolean whatsapp = "whatsapp".equalsIgnoreCase(channel);
        if (whatsapp) {
            notificationService.sendBillViaWhatsApp(inv.getCustomer(), inv);
        } else {
            notificationService.sendBillViaSms(inv.getCustomer(), inv);
        }
        // No SMS/WhatsApp provider is integrated yet; the message is only written to the server log.
        return Map.of("status", "logged", "channel", whatsapp ? "whatsapp" : "sms",
                "note", "No SMS/WhatsApp provider configured; message written to server log only");
    }

    /** Prices a cart with the same rules as /bill, without saving or changing stock. */
    @PostMapping("/quote")
    public Map<String, Object> quote(@RequestBody SalesRequestDTO dto) {
        return billingService.quote(dto);
    }

    @PostMapping("/bill")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> generateBill(@RequestBody SalesRequestDTO dto) {
        SalesInvoice saved = billingService.processNewSale(dto);
        return billingService.toDetail(saved);
    }

    @GetMapping("/barcode")
    public Product findByBarcode(@RequestParam String code) {
        return productRepository.findByBarcode(code.trim())
                .orElseThrow(() -> ApiException.notFound("No product with barcode " + code));
    }

    @GetMapping("/search")
    public List<Product> quickProductSearch(@RequestParam String query) {
        String q = query.trim();
        return productRepository
                .findByNameContainingIgnoreCaseOrCompanyContainingIgnoreCaseOrGenericNameContainingIgnoreCase(q, q, q);
    }

    @GetMapping("/searchByCompany")
    public List<Product> searchByCompany(@RequestParam String company) {
        return productRepository.findByCompanyContainingIgnoreCase(company.trim());
    }
}
