package com.retailpulse.pharmacy.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import com.retailpulse.pharmacy.model.Supplier;


@Repository
public interface SupplierRepository extends JpaRepository<Supplier, Long> {
    List<Supplier> findByNameContainingIgnoreCase(String name);

    List<Supplier> findByCompanyContainingIgnoreCase(String company);
}