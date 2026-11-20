package com.retailpulse.pharmacy.repositories;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.retailpulse.pharmacy.model.Payment;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByInvoice_InvoiceId(Long invoiceId);

    // Payments made by the customer directly or against any of their invoices
    @Query("SELECT p FROM Payment p LEFT JOIN p.invoice i LEFT JOIN i.customer ic "
            + "WHERE p.customer.customerId = :customerId OR ic.customerId = :customerId ORDER BY p.paymentDate DESC")
    List<Payment> findByCustomerId(@Param("customerId") Long customerId);

    @Query("SELECT COALESCE(SUM(p.amountPaid), 0) FROM Payment p WHERE p.invoice.invoiceId = :invoiceId AND p.paymentStatus = 'SUCCESS'")
    BigDecimal sumSuccessfulForInvoice(@Param("invoiceId") Long invoiceId);

    Optional<Payment> findByRazorpayOrderId(String razorpayOrderId);

    List<Payment> findAllByOrderByPaymentDateDesc();
}
