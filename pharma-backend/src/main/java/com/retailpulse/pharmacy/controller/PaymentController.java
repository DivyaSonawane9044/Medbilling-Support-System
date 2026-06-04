package com.retailpulse.pharmacy.controller;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.razorpay.RazorpayException;
import com.retailpulse.pharmacy.dto.CreateOrderResponseDTO;
import com.retailpulse.pharmacy.model.SalesInvoice;
import com.retailpulse.pharmacy.service.RazorpayService;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    @Autowired
    private RazorpayService razorpayService;

    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getPaymentConfig() {
        Map<String, Object> config = new HashMap<>();
        config.put("configured", razorpayService.isConfigured());
        config.put("keyId", razorpayService.getPublicKey());
        config.put("mock", !razorpayService.isConfigured());
        return ResponseEntity.ok(config);
    }

    @PostMapping("/create-order")
    public ResponseEntity<?> createRazorpayOrder(@RequestBody Map<String, Object> data) {
        try {
            String amountStr = data.get("amount").toString();
            String receiptId = data.get("invoiceId").toString();
            BigDecimal amount = new BigDecimal(amountStr);

            CreateOrderResponseDTO response = razorpayService.createOrderResponse(amount, receiptId);
            return ResponseEntity.ok(response);
        } catch (RazorpayException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error creating Razorpay Order: " + e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Invalid parameters");
        }
    }
    @Autowired
    private com.retailpulse.pharmacy.repositories.PaymentRepository paymentRepository;

    @Autowired
    private com.retailpulse.pharmacy.repositories.SalesInvoiceRepository invoiceRepository;

    @GetMapping
    public ResponseEntity<?> listPayments() {
        return ResponseEntity.ok(paymentRepository.findAll().stream().map(p -> {
            Map<String, Object> row = new HashMap<>();
            row.put("paymentId", p.getPaymentId());
            row.put("amountPaid", p.getAmountPaid());
            row.put("paymentDate", p.getPaymentDate());
            row.put("paymentMethod", p.getPaymentMethod());
            row.put("paymentStatus", p.getPaymentStatus());
            row.put("transactionReference", p.getTransactionReference());
            if (p.getInvoice() != null) {
                row.put("invoiceId", p.getInvoice().getInvoiceId());
                row.put("invoiceNumber", p.getInvoice().getInvoiceNumber());
                row.put("customerName", p.getInvoice().getCustomer() != null
                        ? p.getInvoice().getCustomer().getName() : "Walk-in");
            }
            return row;
        }).collect(java.util.stream.Collectors.toList()));
    }

    @GetMapping("/receipt/{paymentId}")
    public ResponseEntity<Map<String, Object>> getReceipt(@PathVariable Long paymentId) {
        return paymentRepository.findById(paymentId).map(p -> {
            Map<String, Object> receipt = new HashMap<>();
            receipt.put("paymentId", p.getPaymentId());
            receipt.put("amountPaid", p.getAmountPaid());
            receipt.put("paymentDate", p.getPaymentDate());
            receipt.put("paymentMethod", p.getPaymentMethod());
            receipt.put("paymentStatus", p.getPaymentStatus());
            receipt.put("transactionReference", p.getTransactionReference());
            if (p.getInvoice() != null) {
                receipt.put("invoiceNumber", p.getInvoice().getInvoiceNumber());
                receipt.put("customerName", p.getInvoice().getCustomer() != null
                        ? p.getInvoice().getCustomer().getName() : "Walk-in");
                receipt.put("grandTotal", p.getInvoice().getGrandTotal());
            }
            return ResponseEntity.ok(receipt);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/record")
    public ResponseEntity<?> recordCashPayment(@RequestBody Map<String, Object> data) {
        Long invoiceId = Long.parseLong(data.get("invoiceId").toString());
        String method = data.getOrDefault("paymentMethod", "Cash").toString();
        SalesInvoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new RuntimeException("Invoice not found"));

        com.retailpulse.pharmacy.model.Payment payment = new com.retailpulse.pharmacy.model.Payment();
        payment.setInvoice(invoice);
        payment.setAmountPaid(invoice.getGrandTotal());
        payment.setPaymentMethod(method);
        payment.setPaymentStatus("SUCCESS");
        payment.setTransactionReference("CASH-" + System.currentTimeMillis());
        paymentRepository.save(payment);

        Map<String, String> response = new HashMap<>();
        response.put("status", "SUCCESS");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify-payment")
    public ResponseEntity<?> verifyPayment(@RequestBody Map<String, String> data) {
        String orderId = data.get("razorpay_order_id");
        String paymentId = data.get("razorpay_payment_id");
        String signature = data.get("razorpay_signature");
        Long invoiceId = Long.parseLong(data.get("invoice_id"));

        boolean isValid = razorpayService.verifyPaymentSignature(orderId, paymentId, signature);

        if (isValid) {
            // Find Invoice
            com.retailpulse.pharmacy.model.SalesInvoice invoice = invoiceRepository.findById(invoiceId)
                    .orElseThrow(() -> new RuntimeException("Invoice not found"));

            // Save Payment Record
            com.retailpulse.pharmacy.model.Payment payment = new com.retailpulse.pharmacy.model.Payment();
            payment.setInvoice(invoice);
            payment.setAmountPaid(invoice.getGrandTotal());
            payment.setPaymentMethod("RAZORPAY");
            payment.setTransactionReference(paymentId);
            payment.setPaymentStatus("SUCCESS");
            
            paymentRepository.save(payment);

            return ResponseEntity.ok("Payment successful and verified");
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid payment signature");
        }
    }
}
