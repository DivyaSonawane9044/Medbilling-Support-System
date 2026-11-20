package com.retailpulse.pharmacy.controller;

import java.util.Map;

import javax.sql.DataSource;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Unauthenticated liveness check that also confirms the database answers. */
@RestController
public class HealthController {

    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, Object>> health() {
        try (var conn = dataSource.getConnection()) {
            boolean dbUp = conn.isValid(2);
            return ResponseEntity.status(dbUp ? 200 : 503)
                    .body(Map.of("status", dbUp ? "UP" : "DOWN", "database", conn.getMetaData().getDatabaseProductName()));
        } catch (Exception e) {
            return ResponseEntity.status(503).body(Map.of("status", "DOWN", "database", "unreachable"));
        }
    }
}
