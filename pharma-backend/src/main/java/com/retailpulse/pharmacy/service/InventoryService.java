package com.retailpulse.pharmacy.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

import com.retailpulse.pharmacy.dto.InventoryBatchDTO;
import com.retailpulse.pharmacy.model.InventoryBatch;
import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.repositories.InventoryBatchRepository;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class InventoryService {
private final InventoryBatchRepository batchRepository;
    
    // Feature 1/8: Configurable near-expiry period (3 months before expiry)
    private static final int NEAR_EXPIRY_MONTHS = 3; 

    @Autowired
    private SupplierService supplierService;

    @Autowired
    public InventoryService(InventoryBatchRepository batchRepository) {
        this.batchRepository = batchRepository;
    }

    public void processSupplierReturn(Long batchId, int stripsToReturn, int tabletsToReturn) {
        InventoryBatch batch = batchRepository.findById(batchId)
            .orElseThrow(() -> new RuntimeException("Batch not found"));

        // Deduct from stock
        deductStock(batch, stripsToReturn, tabletsToReturn);

        // Calculate return value based on cost price
        java.math.BigDecimal valuePerStrip = batch.getCostPrice();
        int stripSize = batch.getProduct().getStripSize();
        java.math.BigDecimal valuePerTablet = valuePerStrip.divide(new java.math.BigDecimal(stripSize), 4, java.math.RoundingMode.HALF_UP);

        java.math.BigDecimal totalReturnValue = valuePerStrip.multiply(new java.math.BigDecimal(stripsToReturn))
            .add(valuePerTablet.multiply(new java.math.BigDecimal(tabletsToReturn)));

        // Reduce supplier ledger balance (supplier owes us, so balance decreases if balance is what we owe them)
        // Feature 3: Supplier wise expiry returns
        supplierService.updateSupplierLedger(batch.getSupplier().getSupplierId(), totalReturnValue.negate());
    }

    /**
     * Deducts stock for a sale. 
     * Converts strips to tablets if needed based on the product's strip size.
     */
    public void deductStock(InventoryBatch batch, int stripsToDeduct, int tabletsToDeduct) {
        int stripSize = batch.getProduct().getStripSize();
        
        int totalTabletsInBatch = (batch.getStripStock() * stripSize) + batch.getTabletStock();
        int totalTabletsToDeduct = (stripsToDeduct * stripSize) + tabletsToDeduct;
        
        if (totalTabletsInBatch < totalTabletsToDeduct) {
            throw new RuntimeException("Insufficient stock for batch: " + batch.getBatchNumber());
        }
        
        int remainingTablets = totalTabletsInBatch - totalTabletsToDeduct;
        batch.setStripStock(remainingTablets / stripSize);
        batch.setTabletStock(remainingTablets % stripSize);
        
        batchRepository.save(batch);
    }

    /**
     * Saves a new Inventory Batch (used during Purchase order receiving).
     */
    public InventoryBatch saveNewBatch(InventoryBatch batch) {
        // Business Logic Placeholder:
        // Future logic: Trigger low stock alert calculation for this product.
        return batchRepository.save(batch);
    }
    
    /**
     * Feature 2/8: Retrieves items that are nearing expiry (e.g., within the next 3 months).
     * Used for the Near-expiry alert.
     */
    public List<InventoryBatchDTO> getNearExpiryItems() {
        LocalDate today = LocalDate.now();
        LocalDate nearExpiryDate = today.plusMonths(NEAR_EXPIRY_MONTHS);
        List<InventoryBatch> nearExpiryList = batchRepository.findNearExpiryBatches(today, nearExpiryDate);
        nearExpiryList.forEach(batch -> batch.setIsNearExpiry(true));
        return toDtoList(nearExpiryList);
    }

    /**
     * Feature 2: Retrieves items that have already expired.
     * Used for the Expired Items List.
     */
    public List<InventoryBatchDTO> getExpiredItems() {
        return toDtoList(batchRepository.findByExpiryDateBefore(LocalDate.now()));
    }

    /**
     * Feature 1: Generates the Stock Aging Report (Oldest stock first).
     */
    public List<InventoryBatchDTO> getStockAgingReport() {
        List<InventoryBatch> currentStock = batchRepository.findByStripStockGreaterThanOrTabletStockGreaterThan(0, 0);
        return currentStock.stream()
                .sorted(Comparator.comparing(InventoryBatch::getMfgDate))
                .map(InventoryBatchDTO::from)
                .collect(Collectors.toList());
    }
    
    /**
     * Feature 1: Retrieves all stock arranged alphabetically by medicine name.
     */
    public List<InventoryBatchDTO> getAllStockAlphabetical() {
        List<InventoryBatch> allStock = batchRepository.findAll();
        return allStock.stream()
                .sorted(Comparator.comparing(batch -> batch.getProduct().getName()))
                .map(InventoryBatchDTO::from)
                .collect(Collectors.toList());
    }

    private List<InventoryBatchDTO> toDtoList(List<InventoryBatch> batches) {
        return batches.stream().map(InventoryBatchDTO::from).collect(Collectors.toList());
    }

    public java.util.List<java.util.Map<String, Object>> getProductStockSummary() {
        return batchRepository.findByStripStockGreaterThanOrTabletStockGreaterThan(0, 0).stream()
                .collect(Collectors.groupingBy(b -> b.getProduct().getProductId()))
                .entrySet().stream()
                .map(e -> {
                    InventoryBatch sample = e.getValue().get(0);
                    Product p = sample.getProduct();
                    int stripSize = Math.max(1, p.getStripSize());
                    long tablets = e.getValue().stream()
                            .mapToLong(b -> (long) b.getStripStock() * stripSize + b.getTabletStock())
                            .sum();
                    String status = tablets == 0 ? "out_of_stock"
                            : (p.getReorderLevel() != null && tablets <= p.getReorderLevel() ? "low_stock" : "in_stock");
                    java.util.Map<String, Object> m = new java.util.HashMap<>();
                    m.put("productId", p.getProductId());
                    m.put("name", p.getName());
                    m.put("company", p.getCompany());
                    m.put("totalTablets", tablets);
                    m.put("reorderLevel", p.getReorderLevel());
                    m.put("status", status);
                    return m;
                })
                .sorted(Comparator.comparing(m -> (String) m.get("name")))
                .collect(Collectors.toList());
    }

}
