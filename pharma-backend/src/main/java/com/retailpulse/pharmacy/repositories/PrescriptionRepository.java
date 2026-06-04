package com.retailpulse.pharmacy.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.retailpulse.pharmacy.model.Prescription;

@Repository
public interface PrescriptionRepository extends JpaRepository<Prescription, Long> {
}
