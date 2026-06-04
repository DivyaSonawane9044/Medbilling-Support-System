package com.retailpulse.pharmacy.service;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.retailpulse.pharmacy.dto.CreateOrderResponseDTO;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class RazorpayService {

    public static final String MOCK_SIGNATURE = "mock_signature_dev";

    @Value("${razorpay.api.key}")
    private String apiKey;

    @Value("${razorpay.api.secret}")
    private String apiSecret;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank()
                && apiSecret != null && !apiSecret.isBlank()
                && !apiKey.contains("YOUR_RAZORPAY")
                && !apiSecret.contains("YOUR_RAZORPAY");
    }

    public String getPublicKey() {
        return apiKey != null ? apiKey : "";
    }

    public CreateOrderResponseDTO createOrderResponse(BigDecimal amount, String receiptId) throws RazorpayException {
        int amountInPaise = amount.multiply(new BigDecimal("100")).intValue();
        CreateOrderResponseDTO response = new CreateOrderResponseDTO();
        response.setAmount(amountInPaise);
        response.setCurrency("INR");

        if (!isConfigured()) {
            response.setOrderId("order_mock_" + System.currentTimeMillis());
            response.setKeyId("rzp_test_demo");
            response.setMock(true);
            return response;
        }

        RazorpayClient razorpay = new RazorpayClient(apiKey, apiSecret);
        JSONObject orderRequest = new JSONObject();
        orderRequest.put("amount", amountInPaise);
        orderRequest.put("currency", "INR");
        orderRequest.put("receipt", receiptId);

        Order order = razorpay.orders.create(orderRequest);
        response.setOrderId(order.get("id"));
        response.setKeyId(apiKey);
        response.setMock(false);
        return response;
    }

    public boolean verifyPaymentSignature(String orderId, String paymentId, String signature) {
        if (orderId != null && orderId.startsWith("order_mock_")) {
            return MOCK_SIGNATURE.equals(signature);
        }
        if (!isConfigured()) {
            return false;
        }
        try {
            String payload = orderId + "|" + paymentId;
            String generatedSignature = calculateRFC2104HMAC(payload, apiSecret);
            return generatedSignature.equals(signature);
        } catch (Exception e) {
            return false;
        }
    }

    private String calculateRFC2104HMAC(String data, String secret) throws java.security.SignatureException {
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            javax.crypto.spec.SecretKeySpec key = new javax.crypto.spec.SecretKeySpec(secret.getBytes(), "HmacSHA256");
            mac.init(key);
            byte[] authentication = mac.doFinal(data.getBytes());
            return java.util.HexFormat.of().formatHex(authentication);
        } catch (Exception e) {
            throw new java.security.SignatureException("Failed to generate HMAC : " + e.getMessage());
        }
    }
}
