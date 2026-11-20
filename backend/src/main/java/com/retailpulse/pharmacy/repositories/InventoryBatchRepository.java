package com.retailpulse.pharmacy.repositories;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.retailpulse.pharmacy.model.InventoryBatch;

@Repository
public interface InventoryBatchRepository extends JpaRepository<InventoryBatch, Long> {

    
    List<InventoryBatch> findByExpiryDateBefore(LocalDate date);

   
    @Query("SELECT ib FROM InventoryBatch ib WHERE ib.expiryDate BETWEEN :startDate AND :endDate AND (ib.stripStock > 0 OR ib.tabletStock > 0) ORDER BY ib.expiryDate ASC")
    List<InventoryBatch> findNearExpiryBatches(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    
    List<InventoryBatch> findByStripStockGreaterThanOrTabletStockGreaterThan(Integer minStripStock, Integer minTabletStock);

    // FEFO order; ties broken by batch id so allocation is deterministic
    @Query("SELECT ib FROM InventoryBatch ib WHERE ib.product.productId = :productId AND (ib.stripStock > 0 OR ib.tabletStock > 0) AND ib.expiryDate > CURRENT_DATE() ORDER BY ib.expiryDate ASC, ib.batchId ASC")
    List<InventoryBatch> findAllBatchesForProductForSale(@Param("productId") Long productId);

    // Same as above but row-locked, so concurrent sales cannot both take the last units
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT ib FROM InventoryBatch ib WHERE ib.product.productId = :productId AND (ib.stripStock > 0 OR ib.tabletStock > 0) AND ib.expiryDate > CURRENT_DATE() ORDER BY ib.expiryDate ASC, ib.batchId ASC")
    List<InventoryBatch> lockBatchesForSale(@Param("productId") Long productId);

    List<InventoryBatch> findByProduct_ProductId(Long productId);

    boolean existsByProduct_ProductId(Long productId);

    boolean existsBySupplier_SupplierId(Long supplierId);
}
