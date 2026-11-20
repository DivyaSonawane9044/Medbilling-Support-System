package com.retailpulse.pharmacy.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.retailpulse.pharmacy.model.Prescription;

@Repository
public interface PrescriptionRepository extends JpaRepository<Prescription, Long> {
    List<Prescription> findByCustomer_CustomerIdOrderByCreatedAtDesc(Long customerId);

    List<Prescription> findAllByOrderByCreatedAtDesc();

    void deleteByCustomer_CustomerId(Long customerId);
}
