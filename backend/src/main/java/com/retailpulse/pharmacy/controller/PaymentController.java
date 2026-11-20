package com.retailpulse.pharmacy.controller;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.dto.CreateOrderResponseDTO;
import com.retailpulse.pharmacy.exception.ApiException;
import com.retailpulse.pharmacy.model.Payment;
import com.retailpulse.pharmacy.repositories.PaymentRepository;
import com.retailpulse.pharmacy.service.PaymentService;
import com.retailpulse.pharmacy.service.RazorpayService;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final RazorpayService razorpayService;
    private final PaymentService paymentService;
    private final PaymentRepository paymentRepository;

    public PaymentController(RazorpayService razorpayService, PaymentService paymentService,
            PaymentRepository paymentRepository) {
        this.razorpayService = razorpayService;
        this.paymentService = paymentService;
        this.paymentRepository = paymentRepository;
    }

    @GetMapping("/config")
    public Map<String, Object> getPaymentConfig() {
        Map<String, Object> config = new HashMap<>();
        config.put("configured", razorpayService.isConfigured());
        config.put("keyId", razorpayService.getPublicKey());
        return config;
    }

    /** Body: {invoiceId}. The amount is the invoice's outstanding balance, computed on the server. */
    @PostMapping("/create-order")
    public CreateOrderResponseDTO createRazorpayOrder(@RequestBody Map<String, Object> data) {
        return paymentService.createRazorpayOrder(requiredLong(data, "invoiceId"));
    }

    @PostMapping("/verify-payment")
    public Map<String, Object> verifyPayment(@RequestBody Map<String, String> data) {
        Payment p = paymentService.verifyRazorpayPayment(
                data.get("razorpay_order_id"), data.get("razorpay_payment_id"), data.get("razorpay_signature"));
        return toRow(p);
    }

    /** Body: {razorpay_order_id, reason}. Called when checkout fails or is dismissed. */
    @PostMapping("/failed")
    public Map<String, String> paymentFailed(@RequestBody Map<String, String> data) {
        String orderId = data.get("razorpay_order_id");
        if (orderId == null || orderId.isBlank()) {
            throw ApiException.badRequest("razorpay_order_id is required");
        }
        paymentService.markRazorpayFailed(orderId, data.get("reason"));
        return Map.of("status", PaymentService.FAILED);
    }

    /** Body: {invoiceId, paymentMethod?, amount?}. Omitting amount pays the full outstanding balance. */
    @PostMapping("/record")
    public Map<String, Object> recordPayment(@RequestBody Map<String, Object> data) {
        Object method = data.get("paymentMethod");
        Payment p = paymentService.recordInvoicePayment(requiredLong(data, "invoiceId"), optionalAmount(data),
                method == null ? null : method.toString());
        return toRow(p);
    }

    @GetMapping
    public List<Map<String, Object>> listPayments() {
        return paymentRepository.findAllByOrderByPaymentDateDesc().stream().map(this::toRow).toList();
    }

    @GetMapping("/receipt/{paymentId}")
    public Map<String, Object> getReceipt(@PathVariable Long paymentId) {
        Payment p = paymentRepository.findById(paymentId)
                .orElseThrow(() -> ApiException.notFound("Payment not found: " + paymentId));
        Map<String, Object> receipt = toRow(p);
        if (p.getInvoice() != null) {
            receipt.put("grandTotal", p.getInvoice().getGrandTotal());
            receipt.put("balanceDue", paymentService.outstanding(p.getInvoice()));
        }
        return receipt;
    }

    private Map<String, Object> toRow(Payment p) {
        Map<String, Object> row = new HashMap<>();
        row.put("paymentId", p.getPaymentId());
        row.put("amountPaid", p.getAmountPaid());
        row.put("paymentDate", p.getPaymentDate());
        row.put("paymentMethod", p.getPaymentMethod());
        row.put("paymentStatus", p.getPaymentStatus());
        row.put("transactionReference", p.getTransactionReference());
        row.put("razorpayOrderId", p.getRazorpayOrderId());
        if (p.getInvoice() != null) {
            row.put("invoiceId", p.getInvoice().getInvoiceId());
            row.put("invoiceNumber", p.getInvoice().getInvoiceNumber());
        }
        var customer = p.getCustomer() != null ? p.getCustomer()
                : p.getInvoice() != null ? p.getInvoice().getCustomer() : null;
        row.put("customerName", customer != null ? customer.getName() : "Walk-in");
        return row;
    }

    static Long requiredLong(Map<String, Object> data, String key) {
        Object v = data.get(key);
        if (v == null || v.toString().isBlank()) {
            throw ApiException.badRequest(key + " is required");
        }
        try {
            return Long.valueOf(v.toString());
        } catch (NumberFormatException e) {
            throw ApiException.badRequest(key + " must be a number");
        }
    }

    static BigDecimal optionalAmount(Map<String, Object> data) {
        Object v = data.get("amount");
        if (v == null || v.toString().isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(v.toString());
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("amount must be a number");
        }
    }
}
