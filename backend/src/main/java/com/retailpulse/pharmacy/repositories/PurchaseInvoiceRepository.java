package com.retailpulse.pharmacy.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.retailpulse.pharmacy.model.PurchaseInvoice;

@Repository
public interface PurchaseInvoiceRepository extends JpaRepository<PurchaseInvoice, Long> {
    
    // Feature 3: Show pending items (ordered but not received)
    java.util.List<PurchaseInvoice> findByStatusIgnoreCase(String status);

    boolean existsBySupplier_SupplierIdAndInvoiceNumberIgnoreCase(Long supplierId, String invoiceNumber);

    java.util.List<PurchaseInvoice> findAllByOrderByPurchaseDateDescInvoiceIdDesc();

    @Query("SELECT DISTINCT p FROM PurchaseInvoice p LEFT JOIN FETCH p.batches b LEFT JOIN FETCH b.product WHERE p.supplier.supplierId = :supplierId")
    java.util.List<PurchaseInvoice> findBySupplier_SupplierIdWithBatches(@Param("supplierId") Long supplierId);
}