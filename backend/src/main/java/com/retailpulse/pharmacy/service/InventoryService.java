package com.retailpulse.pharmacy.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.retailpulse.pharmacy.dto.InventoryBatchDTO;
import com.retailpulse.pharmacy.exception.ApiException;
import com.retailpulse.pharmacy.model.InventoryBatch;
import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.repositories.InventoryBatchRepository;
import com.retailpulse.pharmacy.repositories.ProductRepository;

@Service
public class InventoryService {

    private static final Logger log = LoggerFactory.getLogger(InventoryService.class);

    // Batches expiring within this many months are "near expiry"
    public static final int NEAR_EXPIRY_MONTHS = 3;

    private final InventoryBatchRepository batchRepository;
    private final ProductRepository productRepository;
    private final SupplierService supplierService;
    private final StockService stockService;

    public InventoryService(InventoryBatchRepository batchRepository, ProductRepository productRepository,
            SupplierService supplierService, StockService stockService) {
        this.batchRepository = batchRepository;
        this.productRepository = productRepository;
        this.supplierService = supplierService;
        this.stockService = stockService;
    }

    /** Returns stock to the supplier; the cost value is credited against the supplier ledger. */
    @Transactional
    public Map<String, Object> processSupplierReturn(Long batchId, int stripsToReturn, int tabletsToReturn) {
        if (stripsToReturn < 0 || tabletsToReturn < 0 || stripsToReturn + tabletsToReturn == 0) {
            throw ApiException.badRequest("Enter a positive number of strips and/or tablets to return");
        }
        InventoryBatch batch = requireBatch(batchId);
        if (batch.getSupplier() == null) {
            throw ApiException.badRequest("Batch " + batch.getBatchNumber()
                    + " has no supplier (opening stock); use write-off instead");
        }
        int perPack = StockService.unitsPerPack(batch.getProduct());
        int units = stripsToReturn * perPack + tabletsToReturn;
        stockService.removeUnits(batch, units);

        BigDecimal value = batch.getCostPrice().multiply(BigDecimal.valueOf(units))
                .divide(BigDecimal.valueOf(perPack), 2, RoundingMode.HALF_UP);
        supplierService.updateSupplierLedger(batch.getSupplier().getSupplierId(), value.negate());
        stockService.refreshProductQuantity(batch.getProduct());

        Map<String, Object> result = new HashMap<>();
        result.put("batchId", batchId);
        result.put("unitsReturned", units);
        result.put("creditValue", value);
        result.put("remainingUnits", StockService.unitsIn(batch));
        return result;
    }

    /** Removes unsellable (expired/damaged) stock from a batch. All remaining units when {@code units} is null. */
    @Transactional
    public Map<String, Object> writeOff(Long batchId, Integer units, String reason) {
        InventoryBatch batch = requireBatch(batchId);
        int available = StockService.unitsIn(batch);
        int remove = units == null ? available : units;
        if (remove <= 0) {
            throw ApiException.badRequest("Nothing to write off in batch " + batch.getBatchNumber());
        }
        stockService.removeUnits(batch, remove);
        stockService.refreshProductQuantity(batch.getProduct());
        log.info("Stock write-off: batch={} product={} units={} reason={}", batch.getBatchNumber(),
                batch.getProduct().getName(), remove, reason);

        Map<String, Object> result = new HashMap<>();
        result.put("batchId", batchId);
        result.put("unitsWrittenOff", remove);
        result.put("remainingUnits", StockService.unitsIn(batch));
        return result;
    }

    public List<InventoryBatchDTO> getNearExpiryItems() {
        LocalDate today = LocalDate.now();
        List<InventoryBatch> list = batchRepository.findNearExpiryBatches(today, today.plusMonths(NEAR_EXPIRY_MONTHS));
        list.forEach(b -> b.setIsNearExpiry(true));
        return toDtoList(list);
    }

    public List<InventoryBatchDTO> getExpiredItems() {
        return toDtoList(batchRepository.findByExpiryDateBefore(LocalDate.now()));
    }

    /** Oldest stock (by manufacturing date) first. */
    public List<InventoryBatchDTO> getStockAgingReport() {
        return batchRepository.findByStripStockGreaterThanOrTabletStockGreaterThan(0, 0).stream()
                .sorted(Comparator.comparing(InventoryBatch::getMfgDate))
                .map(InventoryBatchDTO::from)
                .collect(Collectors.toList());
    }

    public List<InventoryBatchDTO> getAllStockAlphabetical() {
        return batchRepository.findAll().stream()
                .sorted(Comparator.comparing((InventoryBatch b) -> b.getProduct().getName())
                        .thenComparing(InventoryBatch::getExpiryDate))
                .map(InventoryBatchDTO::from)
                .collect(Collectors.toList());
    }

    /**
     * One row per product: total units on hand, units that can still be sold (not expired)
     * and a status against the reorder level. Products with no stock are included as out_of_stock.
     */
    public List<Map<String, Object>> getProductStockSummary() {
        Map<Long, List<InventoryBatch>> byProduct = batchRepository.findAll().stream()
                .collect(Collectors.groupingBy(b -> b.getProduct().getProductId()));
        LocalDate today = LocalDate.now();
        return productRepository.findAllByOrderByNameAsc().stream().map(p -> {
            List<InventoryBatch> batches = byProduct.getOrDefault(p.getProductId(), List.of());
            long total = batches.stream().mapToLong(StockService::unitsIn).sum();
            long saleable = batches.stream().filter(b -> b.getExpiryDate().isAfter(today))
                    .mapToLong(StockService::unitsIn).sum();
            String status = saleable == 0 ? "out_of_stock"
                    : (p.getReorderLevel() != null && saleable <= p.getReorderLevel() ? "low_stock" : "in_stock");
            Map<String, Object> m = new HashMap<>();
            m.put("productId", p.getProductId());
            m.put("name", p.getName());
            m.put("company", p.getCompany());
            m.put("unitsPerPack", StockService.unitsPerPack(p));
            m.put("totalTablets", total);
            m.put("saleableUnits", saleable);
            m.put("reorderLevel", p.getReorderLevel());
            m.put("status", status);
            return m;
        }).collect(Collectors.toList());
    }

    private InventoryBatch requireBatch(Long id) {
        return batchRepository.findById(id).orElseThrow(() -> ApiException.notFound("Batch not found: " + id));
    }

    private List<InventoryBatchDTO> toDtoList(List<InventoryBatch> batches) {
        return batches.stream().map(InventoryBatchDTO::from).collect(Collectors.toList());
    }

    /** Used by analytics/alerts: saleable units for one product. */
    public long saleableUnits(Product p) {
        return batchRepository.findAllBatchesForProductForSale(p.getProductId()).stream()
                .mapToLong(StockService::unitsIn).sum();
    }
}
