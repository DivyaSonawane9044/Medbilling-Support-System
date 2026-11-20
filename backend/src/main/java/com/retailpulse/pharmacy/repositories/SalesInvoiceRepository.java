package com.retailpulse.pharmacy.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.retailpulse.pharmacy.model.SalesInvoice;

@Repository
public interface SalesInvoiceRepository extends JpaRepository<SalesInvoice, Long> {
    @Query("SELECT COUNT(i) > 0 FROM SalesInvoiceItem i WHERE i.batch.product.productId = :productId")
    boolean productHasSales(@Param("productId") Long productId);

    boolean existsByCustomer_CustomerId(Long customerId);

    boolean existsByInvoiceNumber(String invoiceNumber);

    java.util.List<SalesInvoice> findAllByOrderBySaleDateTimeDesc();

    // Feature 5 & 9: Reports & Accounting - Fetch sales within a date range
    @Query("SELECT s FROM SalesInvoice s WHERE s.saleDateTime >= :startDate AND s.saleDateTime <= :endDate")
    java.util.List<SalesInvoice> findSalesInDateRange(@Param("startDate") java.time.LocalDateTime startDate,
                                                      @Param("endDate") java.time.LocalDateTime endDate);

    // Feature 6: Dashboard Analytics - Calculate total revenue for a specific day
    @Query("SELECT SUM(s.grandTotal) FROM SalesInvoice s WHERE CAST(s.saleDateTime AS date) = :date")
    java.math.BigDecimal getTotalRevenueForDate(@Param("date") java.time.LocalDate date);

    // Feature 7: Customer history (what item they purchased earlier)
    java.util.List<SalesInvoice> findByCustomer_CustomerId(Long customerId);

    @Query("SELECT DISTINCT s FROM SalesInvoice s LEFT JOIN FETCH s.items WHERE s.customer.customerId = :customerId")
    java.util.List<SalesInvoice> findByCustomerIdWithItems(@Param("customerId") Long customerId);

    @Query("SELECT DISTINCT s FROM SalesInvoice s LEFT JOIN FETCH s.items i LEFT JOIN FETCH i.batch b LEFT JOIN FETCH b.product LEFT JOIN FETCH s.customer WHERE s.invoiceId = :id")
    java.util.Optional<SalesInvoice> findByIdWithDetails(@Param("id") Long id);
}
