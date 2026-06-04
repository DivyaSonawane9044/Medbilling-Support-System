package com.retailpulse.pharmacy.repositories;

import com.retailpulse.pharmacy.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByInvoice_InvoiceId(Long invoiceId);

    @org.springframework.data.jpa.repository.Query(
        "SELECT p FROM Payment p WHERE p.invoice.customer.customerId = :customerId ORDER BY p.paymentDate DESC")
    List<Payment> findByCustomerId(@org.springframework.data.repository.query.Param("customerId") Long customerId);
}
