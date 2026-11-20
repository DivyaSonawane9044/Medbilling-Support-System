package com.retailpulse.pharmacy;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void healthIsPublic() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void everyBusinessEndpointRequiresAToken() throws Exception {
        for (String url : List.of("/api/products", "/api/customers", "/api/payments", "/api/sales/invoices",
                "/api/reports/daily", "/api/analytics/dashboard", "/api/suppliers")) {
            mvc.perform(get(url)).andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/sales/bill").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/products").header("Authorization", "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void validTokenIsAccepted() throws Exception {
        mvc.perform(get("/api/products").with(jwt())).andExpect(status().isOk());
    }

    @Test
    void unknownRoutesAreDenied() throws Exception {
        mvc.perform(get("/h2-console").with(jwt())).andExpect(status().isForbidden());
    }

    @Test
    void corsOnlyAllowsConfiguredOrigins() throws Exception {
        mvc.perform(options("/api/products").header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
        mvc.perform(options("/api/products").header("Origin", "https://evil.example")
                .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }

    @Test
    void authorizedPartyMustBeAnAllowedOrigin() {
        var validator = com.retailpulse.pharmacy.config.SecurityConfigTestAccess.azp(List.of("http://localhost:5173"));
        assertFalse(validator.validate(token("http://localhost:5173")).hasErrors());
        assertTrue(validator.validate(token("https://evil.example")).hasErrors());
    }

    private static Jwt token(String azp) {
        return Jwt.withTokenValue("t").header("alg", "RS256").claim("azp", azp).subject("user_1")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
    }
}
