package com.retailpulse.pharmacy;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.jayway.jsonpath.JsonPath;

/**
 * Drives the real HTTP API (security filter -> controllers -> services -> H2) through the
 * main pharmacy workflow: supplier -> medicine -> purchase/receive -> bill -> payments.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class BusinessFlowIntegrationTest {

    @Autowired
    private MockMvc mvc;

    private long supplierId;
    private long productId;
    private final LocalDate soon = LocalDate.now().plusMonths(6);
    private final LocalDate later = LocalDate.now().plusYears(2);

    private ResultActions call(MockHttpServletRequestBuilder req) throws Exception {
        return mvc.perform(req.with(jwt()).contentType(MediaType.APPLICATION_JSON));
    }

    private ResultActions postJson(String url, String body) throws Exception {
        return call(post(url).content(body));
    }

    private long idOf(ResultActions r, String path) throws Exception {
        return ((Number) JsonPath.read(r.andReturn().getResponse().getContentAsString(), path)).longValue();
    }

    private String receiveBody(String invoiceNo, String extra) {
        // Two batches of a 10-tablet strip at Rs 112 (MRP 120): the one expiring sooner must be sold first
        return """
            {"supplierId": %d, "invoiceNumber": "%s", %s "batchItems": [
              {"productId": %d, "batchNumber": "LATE", "mfgDate": "%s", "expiryDate": "%s",
               "mrp": 120, "costPrice": 80, "sellingPrice": 112, "stripQuantity": 5},
              {"productId": %d, "batchNumber": "SOON", "mfgDate": "%s", "expiryDate": "%s",
               "mrp": 120, "costPrice": 80, "sellingPrice": 112, "stripQuantity": 2}]}
            """.formatted(supplierId, invoiceNo, extra, productId, LocalDate.now().minusMonths(1), later,
                productId, LocalDate.now().minusMonths(1), soon);
    }

    @BeforeEach
    void setUp() throws Exception {
        supplierId = idOf(postJson("/api/suppliers",
                "{\"name\":\"Acme Pharma Distributors\",\"gstIn\":\"27ABCDE1234F1Z5\",\"ledgerBalance\":999999}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ledgerBalance").value(0)), "$.supplierId");

        productId = idOf(postJson("/api/products", """
                {"name":"Paracip 500","genericName":"Paracetamol","hsnCode":"30049099","stripSize":10,
                 "dosageForm":"Tablet","unitType":"Strip","reorderLevel":30,"price":112,"gstRate":12,"quantity":5000}
                """).andExpect(status().isCreated())
                .andExpect(jsonPath("$.quantity").value(0)), "$.productId"); // client cannot invent stock

        postJson("/api/purchases/receive", receiveBody("SUP-INV-1", ""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("RECEIVED"))
                .andExpect(jsonPath("$.totalAmount").value(560.0)); // 7 strips x Rs 80, computed when omitted
    }

    @Test
    void receivingStockIncreasesInventoryAndSupplierLedger() throws Exception {
        call(get("/api/products/" + productId)).andExpect(jsonPath("$.quantity").value(70));
        call(get("/api/suppliers/" + supplierId)).andExpect(jsonPath("$.ledgerBalance").value(560.0));
        call(get("/api/inventory/stock-summary"))
                .andExpect(jsonPath("$[0].saleableUnits").value(70))
                .andExpect(jsonPath("$[0].status").value("in_stock"));
        call(get("/api/suppliers/" + supplierId + "/history"))
                .andExpect(jsonPath("$[0].items", hasSize(2)));
    }

    @Test
    void billUsesFefoAcrossBatchesWithGstInclusivePricingAndDeductsStock() throws Exception {
        String cart = "{\"customerName\":\"Ravi Kumar\",\"contactNumber\":\"9876500001\",\"paymentMethod\":\"UPI\","
                + "\"lineItems\":[{\"productId\":" + productId + ",\"quantitySoldTablets\":25,\"morning\":true}]}";

        // Quote must equal the saved bill
        postJson("/api/sales/quote", cart).andExpect(status().isOk())
                .andExpect(jsonPath("$.grandTotal").value(280.0));

        long invoiceId = idOf(postJson("/api/sales/bill", cart)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.invoiceNumber").exists())
                // 25 tablets = 20 from batch SOON (all of it) + 5 from LATE, Rs 11.20 each incl. 12% GST
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].batchNumber").value("SOON"))
                .andExpect(jsonPath("$.items[0].quantityTablets").value(20))
                .andExpect(jsonPath("$.items[1].batchNumber").value("LATE"))
                .andExpect(jsonPath("$.items[1].quantityTablets").value(5))
                .andExpect(jsonPath("$.grandTotal").value(280.0))
                .andExpect(jsonPath("$.totalTaxableAmount").value(250.0))
                .andExpect(jsonPath("$.totalCgst").value(15.0))
                .andExpect(jsonPath("$.totalSgst").value(15.0))
                .andExpect(jsonPath("$.paymentStatus").value("PAID"))
                .andExpect(jsonPath("$.items[0].morning").value(true)), "$.invoiceId");

        call(get("/api/products/" + productId)).andExpect(jsonPath("$.quantity").value(45));
        call(get("/api/sales/invoices/" + invoiceId)).andExpect(jsonPath("$.customerName").value("Ravi Kumar"));
        call(get("/api/payments")).andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].amountPaid").value(280.0));
    }

    @Test
    void invalidBillsAreRejectedAndLeaveStockUntouched() throws Exception {
        String negative = "{\"lineItems\":[{\"productId\":" + productId + ",\"quantitySoldTablets\":-500}]}";
        postJson("/api/sales/bill", negative).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());
        postJson("/api/sales/bill", "{\"lineItems\":[]}").andExpect(status().isBadRequest());
        postJson("/api/sales/bill", "{\"lineItems\":[{\"productId\":999999,\"quantitySoldTablets\":1}]}")
                .andExpect(status().isNotFound());
        postJson("/api/sales/bill", "{\"lineItems\":[{\"productId\":" + productId + ",\"quantitySoldTablets\":71}]}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("available 70")));
        postJson("/api/sales/bill", "{\"discountPercent\":150,\"lineItems\":[{\"productId\":" + productId
                + ",\"quantitySoldTablets\":1}]}").andExpect(status().isBadRequest());

        call(get("/api/products/" + productId)).andExpect(jsonPath("$.quantity").value(70));
        call(get("/api/sales/invoices")).andExpect(jsonPath("$", hasSize(0)));
        call(get("/api/payments")).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void creditSaleTracksOutstandingAndPaymentsCannotExceedIt() throws Exception {
        postJson("/api/sales/bill", "{\"amountPaid\":50,\"lineItems\":[{\"productId\":" + productId
                + ",\"quantitySoldTablets\":10}]}")
                .andExpect(status().isBadRequest()); // walk-in cannot buy on credit

        long invoiceId = idOf(postJson("/api/sales/bill", "{\"customerName\":\"Meena\",\"amountPaid\":50,"
                + "\"lineItems\":[{\"productId\":" + productId + ",\"quantitySoldTablets\":10}]}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.grandTotal").value(112.0))
                .andExpect(jsonPath("$.balanceDue").value(62.0))
                .andExpect(jsonPath("$.paymentStatus").value("PARTIAL")), "$.invoiceId");
        long customerId = idOf(call(get("/api/sales/invoices/" + invoiceId)), "$.customerId");
        call(get("/api/customers/" + customerId)).andExpect(jsonPath("$.remainingBalance").value(62.0));

        postJson("/api/payments/record", "{\"invoiceId\":" + invoiceId + ",\"amount\":100}")
                .andExpect(status().isBadRequest());
        postJson("/api/payments/record", "{\"invoiceId\":" + invoiceId + ",\"amount\":-5}")
                .andExpect(status().isBadRequest());
        postJson("/api/payments/record", "{\"invoiceId\":" + invoiceId + ",\"paymentMethod\":\"Cash\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.amountPaid").value(62.0));
        postJson("/api/payments/record", "{\"invoiceId\":" + invoiceId + "}")
                .andExpect(status().isConflict()); // already fully paid: no duplicate payments

        call(get("/api/sales/invoices/" + invoiceId)).andExpect(jsonPath("$.paymentStatus").value("PAID"));
        call(get("/api/customers/" + customerId)).andExpect(jsonPath("$.remainingBalance").value(0.0));
        call(get("/api/customers/" + customerId + "/payments")).andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void razorpayIsDisabledWithoutKeysAndFakeSignaturesAreRejected() throws Exception {
        long invoiceId = idOf(postJson("/api/sales/bill", "{\"customerName\":\"Asha\",\"amountPaid\":0,"
                + "\"lineItems\":[{\"productId\":" + productId + ",\"quantitySoldTablets\":1}]}"), "$.invoiceId");

        call(get("/api/payments/config")).andExpect(jsonPath("$.configured").value(false));
        postJson("/api/payments/create-order", "{\"invoiceId\":" + invoiceId + "}")
                .andExpect(status().isServiceUnavailable());
        postJson("/api/payments/verify-payment", """
                {"razorpay_order_id":"order_mock_1","razorpay_payment_id":"pay_x",
                 "razorpay_signature":"mock_signature_dev"}""").andExpect(status().isNotFound());
        postJson("/api/payments/record", "{\"invoiceId\":" + invoiceId + ",\"paymentMethod\":\"RAZORPAY\"}")
                .andExpect(status().isBadRequest());
        call(get("/api/sales/invoices/" + invoiceId)).andExpect(jsonPath("$.paymentStatus").value("UNPAID"));
    }

    @Test
    void customerAndSupplierUpdatesCannotTouchBalances() throws Exception {
        long customerId = idOf(postJson("/api/customers",
                "{\"name\":\"Kiran\",\"contactNumber\":\"9800000000\",\"address\":\"Pune\",\"remainingBalance\":5000}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.remainingBalance").value(0)), "$.customerId");
        call(put("/api/customers/" + customerId).content("{\"name\":\"Kiran Rao\",\"contactNumber\":\"9800000000\","
                + "\"address\":\"Pune\",\"remainingBalance\":-1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Kiran Rao"))
                .andExpect(jsonPath("$.remainingBalance").value(0));
        postJson("/api/customers/" + customerId + "/pay", "{\"amount\":-10000}").andExpect(status().isBadRequest());
        postJson("/api/customers/" + customerId + "/pay", "{\"amount\":10}").andExpect(status().isBadRequest());
        call(delete("/api/customers/" + customerId)).andExpect(status().isNoContent());

        call(put("/api/suppliers/999999").content("{\"name\":\"Ghost\"}")).andExpect(status().isNotFound());
        call(put("/api/suppliers/" + supplierId).content("{\"name\":\"Acme Pharma\",\"ledgerBalance\":0}"))
                .andExpect(jsonPath("$.ledgerBalance").value(560.0));
        postJson("/api/suppliers/" + supplierId + "/pay", "{\"amount\":0}").andExpect(status().isBadRequest());
        postJson("/api/suppliers/" + supplierId + "/pay", "{\"amount\":160}")
                .andExpect(jsonPath("$.ledgerBalance").value(400.0));
        postJson("/api/suppliers", "{\"name\":\"Bad GST\",\"gstIn\":\"123\"}").andExpect(status().isBadRequest());
    }

    @Test
    void purchaseOrdersCanBeReceivedOnceAndBadLinesAreRejected() throws Exception {
        long poId = idOf(postJson("/api/purchases/order",
                "{\"supplierId\":" + supplierId + ",\"invoiceNumber\":\"PO-77\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING")), "$.invoiceId");
        call(get("/api/purchases/pending")).andExpect(jsonPath("$", hasSize(1)));

        postJson("/api/purchases/receive", receiveBody("ignored", "\"purchaseInvoiceId\": " + poId + ","))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("RECEIVED"));
        postJson("/api/purchases/receive", receiveBody("ignored", "\"purchaseInvoiceId\": " + poId + ","))
                .andExpect(status().isConflict());
        call(get("/api/purchases/pending")).andExpect(jsonPath("$", hasSize(0)));
        call(get("/api/products/" + productId)).andExpect(jsonPath("$.quantity").value(140));

        postJson("/api/purchases/receive", receiveBody("SUP-INV-1", "")).andExpect(status().isConflict()); // duplicate no.
        postJson("/api/purchases/receive", """
                {"supplierId": %d, "invoiceNumber": "X-1", "batchItems": [{"productId": %d, "batchNumber": "B",
                 "mfgDate": "%s", "expiryDate": "%s", "mrp": 100, "costPrice": 80, "sellingPrice": 130, "stripQuantity": 1}]}
                """.formatted(supplierId, productId, LocalDate.now().minusDays(5), later))
                .andExpect(status().isBadRequest()); // selling above MRP
        postJson("/api/purchases/receive", """
                {"supplierId": %d, "invoiceNumber": "X-2", "batchItems": [{"productId": %d, "batchNumber": "B",
                 "mfgDate": "%s", "expiryDate": "%s", "mrp": 100, "costPrice": 80, "sellingPrice": 90, "stripQuantity": 1}]}
                """.formatted(supplierId, productId, LocalDate.now().minusDays(5), LocalDate.now().minusDays(1)))
                .andExpect(status().isBadRequest()); // already expired
    }

    @Test
    void productsWithStockCannotBeDeletedAndEditsKeepStock() throws Exception {
        call(delete("/api/products/" + productId)).andExpect(status().isConflict());
        call(put("/api/products/" + productId).content("""
                {"name":"Paracip 500mg","hsnCode":"30049099","stripSize":10,"price":110,"gstRate":5,"quantity":1}
                """)).andExpect(status().isOk())
                .andExpect(jsonPath("$.quantity").value(70))
                .andExpect(jsonPath("$.gstRate").value(5));
        postJson("/api/products", "{\"name\":\"paracip 500MG\",\"hsnCode\":\"1\",\"stripSize\":10,\"price\":5}")
                .andExpect(status().isConflict());
        postJson("/api/products", "{\"name\":\"No Price\",\"hsnCode\":\"1\",\"stripSize\":10}")
                .andExpect(status().isBadRequest());

        long fresh = idOf(postJson("/api/products",
                "{\"name\":\"Cough Syrup\",\"hsnCode\":\"3004\",\"stripSize\":1,\"dosageForm\":\"Syrup\",\"price\":95,"
                        + "\"openingQuantity\":12,\"expiryDate\":\"" + later + "\",\"mrp\":100,\"costPrice\":60}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.quantity").value(12)), "$.productId");
        // opening stock is real, sellable stock
        postJson("/api/sales/bill", "{\"lineItems\":[{\"productId\":" + fresh + ",\"quantitySoldTablets\":2}]}")
                .andExpect(status().isCreated()).andExpect(jsonPath("$.grandTotal").value(190.0));
    }

    @Test
    void billWithLargePrescriptionImageIsSaved() throws Exception {
        // ~2 MB photo as a base64 data URL (~2.7M chars): previously overflowed a VARCHAR(255) and rolled back the sale
        String image = "data:image/jpeg;base64," + "A".repeat(2_800_000);
        postJson("/api/sales/bill", "{\"customerName\":\"Rx Patient\",\"prescriptionImageUrl\":\"" + image
                + "\",\"lineItems\":[{\"productId\":" + productId + ",\"quantitySoldTablets\":1}]}")
                .andExpect(status().isCreated());
        call(get("/api/products/" + productId)).andExpect(jsonPath("$.quantity").value(69));
    }

    @Test
    void expiredStockCanBeWrittenOffAndReturnsCreditTheSupplier() throws Exception {
        String list = call(get("/api/inventory/stock-list")).andReturn().getResponse().getContentAsString();
        java.util.List<Number> ids = JsonPath.read(list, "$[?(@.batchNumber=='SOON')].batchId");
        long batchId = ids.get(0).longValue();

        postJson("/api/inventory/returns", "{\"batchId\":" + batchId + ",\"strips\":1,\"tablets\":0}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.creditValue").value(80.0));
        call(get("/api/suppliers/" + supplierId)).andExpect(jsonPath("$.ledgerBalance").value(480.0));
        postJson("/api/inventory/returns", "{\"batchId\":" + batchId + ",\"strips\":5}").andExpect(status().isConflict());
        postJson("/api/inventory/batches/" + batchId + "/write-off", "{\"reason\":\"damaged\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.unitsWrittenOff").value(10));
        call(get("/api/products/" + productId)).andExpect(jsonPath("$.quantity").value(50));
    }
}
