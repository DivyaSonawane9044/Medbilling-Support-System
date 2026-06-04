package com.retailpulse.pharmacy.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.retailpulse.pharmacy.model.Product;


@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    
    // Feature 1: Alphabetical arrangement of medicines
    java.util.List<Product> findAllByOrderByNameAsc();

    // Feature 4: Quick Product Search capability for billing shortcuts
    java.util.List<Product> findByNameContainingIgnoreCase(String query);
    
    // Feature 4: Quick Product Search by company
    java.util.List<Product> findByCompanyContainingIgnoreCase(String company);

    // Combined quick search across medicine name, generic name, and company
    java.util.List<Product> findByNameContainingIgnoreCaseOrCompanyContainingIgnoreCaseOrGenericNameContainingIgnoreCase(
        String name, String company, String genericName);

    // New: Find alternatives by composition
    java.util.List<Product> findByCompositionContainingIgnoreCase(String composition);

    // New: Find alternatives by generic name (the "drug")
    java.util.List<Product> findByGenericNameContainingIgnoreCase(String genericName);

    // Feature 4: Fast billing via barcode
    java.util.Optional<Product> findByBarcode(String barcode);
}