package com.retailpulse.pharmacy;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.retailpulse.pharmacy.model.Payment;
import com.retailpulse.pharmacy.model.SalesInvoice;
import com.retailpulse.pharmacy.repositories.PaymentRepository;
import com.retailpulse.pharmacy.repositories.SalesInvoiceRepository;

/**
 * Server-side Razorpay signature verification with test credentials. The order row that
 * create-order would store is inserted directly, so no call to Razorpay's servers is made.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext
@TestPropertySource(properties = { "razorpay.api.key=rzp_test_unit", "razorpay.api.secret=unit_test_secret" })
class RazorpayVerificationIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private SalesInvoiceRepository invoiceRepository;
    @Autowired
    private PaymentRepository paymentRepository;

    private static String sign(String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("unit_test_secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return java.util.HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }

    private long pendingOrder(String orderId, String amount) {
        SalesInvoice inv = new SalesInvoice();
        inv.setInvoiceNumber("INV-RZP-" + orderId);
        inv.setSaleDateTime(LocalDateTime.now());
        inv.setGrandTotal(new BigDecimal(amount));
        inv = invoiceRepository.save(inv);
        Payment p = new Payment();
        p.setInvoice(inv);
        p.setAmountPaid(new BigDecimal(amount));
        p.setPaymentMethod("RAZORPAY");
        p.setPaymentStatus("CREATED");
        p.setRazorpayOrderId(orderId);
        paymentRepository.save(p);
        return inv.getInvoiceId();
    }

    private org.springframework.test.web.servlet.ResultActions verify(String order, String pay, String sig) throws Exception {
        return mvc.perform(post("/api/payments/verify-payment").with(jwt()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"razorpay_order_id\":\"" + order + "\",\"razorpay_payment_id\":\"" + pay
                        + "\",\"razorpay_signature\":\"" + sig + "\"}"));
    }

    @Test
    void validSignatureMarksPaymentSuccessfulExactlyOnce() throws Exception {
        long invoiceId = pendingOrder("order_ok", "150.00");
        mvc.perform(get("/api/payments/config").with(jwt())).andExpect(jsonPath("$.configured").value(true))
                .andExpect(jsonPath("$.keyId").value("rzp_test_unit"));

        String sig = sign("order_ok|pay_ok");
        verify("order_ok", "pay_ok", sig).andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentStatus").value("SUCCESS"))
                .andExpect(jsonPath("$.transactionReference").value("pay_ok"));
        verify("order_ok", "pay_ok", sig).andExpect(status().isOk()); // idempotent retry
        mvc.perform(get("/api/sales/invoices/" + invoiceId).with(jwt()))
                .andExpect(jsonPath("$.amountPaid").value(150.0))
                .andExpect(jsonPath("$.paymentStatus").value("PAID"));
    }

    @Test
    void tamperedSignatureIsRejectedAndRecordedAsFailed() throws Exception {
        long invoiceId = pendingOrder("order_bad", "99.00");
        verify("order_bad", "pay_bad", sign("order_bad|pay_other")).andExpect(status().isBadRequest());
        verify("order_bad", "pay_bad", "mock_signature_dev").andExpect(status().isBadRequest());
        mvc.perform(get("/api/sales/invoices/" + invoiceId).with(jwt()))
                .andExpect(jsonPath("$.paymentStatus").value("UNPAID"));
        mvc.perform(get("/api/payments").with(jwt()))
                .andExpect(jsonPath("$[0].paymentStatus").value("FAILED"));
    }

    @Test
    void checkoutFailureIsRecorded() throws Exception {
        pendingOrder("order_cancel", "10.00");
        mvc.perform(post("/api/payments/failed").with(jwt()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"razorpay_order_id\":\"order_cancel\",\"reason\":\"user closed checkout\"}"))
                .andExpect(status().isOk());
        verify("order_cancel", "pay_late", sign("order_cancel|pay_late")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentStatus").value("SUCCESS")); // a late genuine success still counts
    }
}
