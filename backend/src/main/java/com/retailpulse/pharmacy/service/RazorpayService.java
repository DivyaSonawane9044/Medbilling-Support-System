package com.retailpulse.pharmacy.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.retailpulse.pharmacy.dto.CreateOrderResponseDTO;

/** Thin wrapper over the Razorpay SDK. There is no mock mode: unconfigured means disabled. */
@Service
public class RazorpayService {

    @Value("${razorpay.api.key:}")
    private String apiKey;

    @Value("${razorpay.api.secret:}")
    private String apiSecret;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank() && apiSecret != null && !apiSecret.isBlank();
    }

    /** Key id is public (it is given to the browser checkout); the secret never leaves the server. */
    public String getPublicKey() {
        return isConfigured() ? apiKey : "";
    }

    public CreateOrderResponseDTO createOrder(BigDecimal amount, String receipt) throws RazorpayException {
        long paise = amount.multiply(new BigDecimal("100")).setScale(0, RoundingMode.HALF_UP).longValueExact();
        RazorpayClient razorpay = new RazorpayClient(apiKey, apiSecret);
        JSONObject req = new JSONObject();
        req.put("amount", paise);
        req.put("currency", "INR");
        req.put("receipt", receipt);
        Order order = razorpay.orders.create(req);

        CreateOrderResponseDTO response = new CreateOrderResponseDTO();
        response.setOrderId(order.get("id"));
        response.setAmount(paise);
        response.setCurrency("INR");
        response.setKeyId(apiKey);
        return response;
    }

    /** Razorpay checkout signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret), hex. */
    public boolean verifyPaymentSignature(String orderId, String paymentId, String signature) {
        if (!isConfigured() || orderId == null || paymentId == null || signature == null) {
            return false;
        }
        try {
            String expected = hmacHex(orderId + "|" + paymentId, apiSecret);
            return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                    signature.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return false;
        }
    }

    static String hmacHex(String data, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return java.util.HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }
}
