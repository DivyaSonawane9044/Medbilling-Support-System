package com.retailpulse.pharmacy.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;

import com.retailpulse.pharmacy.dto.InventoryBatchDTO;
import com.retailpulse.pharmacy.model.InventoryBatch;
import com.retailpulse.pharmacy.service.InventoryService;

import org.springframework.web.bind.annotation.CrossOrigin;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/api/inventory")
public class InventoryController {
	private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    // Feature 2 & 3: Supplier wise expiry returns
    @PostMapping("/returns")
    public org.springframework.http.ResponseEntity<String> processSupplierReturn(@RequestBody java.util.Map<String, Object> payload) {
        Long batchId = Long.valueOf(payload.get("batchId").toString());
        int strips = Integer.parseInt(payload.getOrDefault("strips", "0").toString());
        int tablets = Integer.parseInt(payload.getOrDefault("tablets", "0").toString());

        inventoryService.processSupplierReturn(batchId, strips, tablets);
        return org.springframework.http.ResponseEntity.ok("Return processed successfully");
    }

    
    @PostMapping("/batch")
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryBatch addNewBatch(@RequestBody InventoryBatch batch) {
        return inventoryService.saveNewBatch(batch);
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
    public java.util.List<java.util.Map<String, Object>> getStockSummary() {
        return inventoryService.getProductStockSummary();
    }

}
