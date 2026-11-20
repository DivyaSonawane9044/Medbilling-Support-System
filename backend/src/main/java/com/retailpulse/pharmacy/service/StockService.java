package com.retailpulse.pharmacy.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.retailpulse.pharmacy.exception.ApiException;
import com.retailpulse.pharmacy.model.InventoryBatch;
import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.repositories.InventoryBatchRepository;
import com.retailpulse.pharmacy.repositories.ProductRepository;

/**
 * Single place for stock arithmetic. Batches hold the real stock as whole packs
 * (strips/bottles) plus loose units; Product.quantity is a cached total kept in sync here.
 */
@Service
public class StockService {

    private final InventoryBatchRepository batchRepository;
    private final ProductRepository productRepository;

    public StockService(InventoryBatchRepository batchRepository, ProductRepository productRepository) {
        this.batchRepository = batchRepository;
        this.productRepository = productRepository;
    }

    /** Units (tablets/capsules) in one pack. Liquids and bottles are sold whole, so 1. */
    public static int unitsPerPack(Product product) {
        if ("Syrup".equalsIgnoreCase(product.getDosageForm()) || "Bottle".equalsIgnoreCase(product.getUnitType())) {
            return 1;
        }
        Integer size = product.getStripSize();
        return size != null && size > 0 ? size : 1;
    }

    public static int unitsIn(InventoryBatch batch) {
        int perPack = unitsPerPack(batch.getProduct());
        return safe(batch.getStripStock()) * perPack + safe(batch.getTabletStock());
    }

    /** Stores {@code units} as whole packs + loose units (loose always < pack size). */
    public static void setUnits(InventoryBatch batch, int units) {
        if (units < 0) {
            throw ApiException.conflict("Stock for batch " + batch.getBatchNumber() + " cannot go below zero");
        }
        int perPack = unitsPerPack(batch.getProduct());
        batch.setStripStock(units / perPack);
        batch.setTabletStock(units % perPack);
    }

    @Transactional
    public void removeUnits(InventoryBatch batch, int units) {
        if (units <= 0) {
            throw ApiException.badRequest("Quantity to remove must be greater than zero");
        }
        int available = unitsIn(batch);
        if (units > available) {
            throw ApiException.conflict("Only " + available + " units left in batch " + batch.getBatchNumber());
        }
        setUnits(batch, available - units);
        batchRepository.save(batch);
    }

    /** Recomputes Product.quantity from its batches. Call after any batch stock change. */
    @Transactional
    public void refreshProductQuantity(Product product) {
        long total = batchRepository.findByProduct_ProductId(product.getProductId()).stream()
                .mapToLong(StockService::unitsIn)
                .sum();
        product.setQuantity((int) Math.min(total, Integer.MAX_VALUE));
        productRepository.save(product);
    }

    private static int safe(Integer v) {
        return v == null ? 0 : v;
    }
}
