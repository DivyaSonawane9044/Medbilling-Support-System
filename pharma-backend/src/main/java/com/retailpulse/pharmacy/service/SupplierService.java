package com.retailpulse.pharmacy.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.retailpulse.pharmacy.model.Supplier;
import com.retailpulse.pharmacy.repositories.SupplierRepository;

@Service
public class SupplierService {
        
	private final SupplierRepository supplierRepository;

    public SupplierService(SupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
    }

    public Supplier saveOrUpdateSupplier(Supplier supplier) {
        // Feature 3: Validation logic for GSTIN
        if (supplier.getGstIn() != null && !supplier.getGstIn().trim().isEmpty()) {
            String gstinRegex = "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$";
            if (!supplier.getGstIn().matches(gstinRegex)) {
                throw new IllegalArgumentException("Invalid GSTIN format");
            }
        }
        return supplierRepository.save(supplier);
    }

    public List<Supplier> getAllSuppliers() {
        return supplierRepository.findAll();
    }

    public List<Supplier> searchSuppliers(String query) {
        if (query == null || query.trim().isEmpty()) {
            return getAllSuppliers();
        }
        List<Supplier> byName = supplierRepository.findByNameContainingIgnoreCase(query);
        List<Supplier> byCompany = supplierRepository.findByCompanyContainingIgnoreCase(query);
        java.util.Set<Supplier> results = new java.util.LinkedHashSet<>();
        results.addAll(byName);
        results.addAll(byCompany);
        return new java.util.ArrayList<>(results);
    }

    public Optional<Supplier> getSupplierById(Long id) {
        return supplierRepository.findById(id);
    }
    
    // Feature 3: Used for payment tracking (to be implemented later in transaction logic)
    public void updateSupplierLedger(Long supplierId, java.math.BigDecimal amount) {
        supplierRepository.findById(supplierId).ifPresent(supplier -> {
            supplier.setLedgerBalance(supplier.getLedgerBalance().add(amount));
            supplierRepository.save(supplier);
        });
    }
}
