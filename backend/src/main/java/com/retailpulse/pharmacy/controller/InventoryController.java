package com.retailpulse.pharmacy.controller;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.dto.InventoryBatchDTO;
import com.retailpulse.pharmacy.exception.ApiException;
import com.retailpulse.pharmacy.service.InventoryService;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    /** Body: {batchId, strips, tablets}. Supplier-wise return of (usually near-expiry) stock. */
    @PostMapping("/returns")
    public Map<String, Object> processSupplierReturn(@RequestBody Map<String, Object> payload) {
        Long batchId = PaymentController.requiredLong(payload, "batchId");
        return inventoryService.processSupplierReturn(batchId, intOf(payload, "strips"), intOf(payload, "tablets"));
    }

    /** Body: {units?, reason}. Removes expired or damaged stock; omit units to clear the batch. */
    @PostMapping("/batches/{batchId}/write-off")
    public Map<String, Object> writeOff(@PathVariable Long batchId, @RequestBody(required = false) Map<String, Object> payload) {
        Map<String, Object> body = payload == null ? Map.of() : payload;
        Integer units = body.get("units") == null || body.get("units").toString().isBlank() ? null : intOf(body, "units");
        Object reason = body.get("reason");
        return inventoryService.writeOff(batchId, units, reason == null ? "unspecified" : reason.toString());
    }

    @GetMapping("/near-expiry")
    public List<InventoryBatchDTO> getNearExpiryItems() {
        return inventoryService.getNearExpiryItems();
    }

    @GetMapping("/expired")
    public List<InventoryBatchDTO> getExpiredItems() {
        return inventoryService.getExpiredItems();
    }

    @GetMapping("/aging-report")
    public List<InventoryBatchDTO> getStockAgingReport() {
        return inventoryService.getStockAgingReport();
    }

    @GetMapping("/stock-list")
    public List<InventoryBatchDTO> getAllStockAlphabetical() {
        return inventoryService.getAllStockAlphabetical();
    }

    @GetMapping("/stock-summary")
    public List<Map<String, Object>> getStockSummary() {
        return inventoryService.getProductStockSummary();
    }

    private static int intOf(Map<String, Object> m, String key) {
        Object v = m.get(key);
        if (v == null || v.toString().isBlank()) {
            return 0;
        }
        try {
            return Integer.parseInt(v.toString());
        } catch (NumberFormatException e) {
            throw ApiException.badRequest(key + " must be a whole number");
        }
    }
}
