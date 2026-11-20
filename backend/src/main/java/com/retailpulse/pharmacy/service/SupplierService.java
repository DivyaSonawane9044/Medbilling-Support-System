package com.retailpulse.pharmacy.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.retailpulse.pharmacy.exception.ApiException;
import com.retailpulse.pharmacy.model.Supplier;
import com.retailpulse.pharmacy.repositories.SupplierRepository;

@Service
public class SupplierService {

    private static final String GSTIN_REGEX = "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$";

    private final SupplierRepository supplierRepository;

    public SupplierService(SupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
    }

    /** New supplier; the ledger always starts at zero regardless of the request. */
    @Transactional
    public Supplier create(Supplier request) {
        Supplier s = new Supplier();
        applyEditable(s, request);
        s.setLedgerBalance(BigDecimal.ZERO);
        return supplierRepository.save(s);
    }

    /** Updates contact/GST details only; the ledger changes only through purchases and payments. */
    @Transactional
    public Supplier update(Long id, Supplier request) {
        Supplier s = require(id);
        applyEditable(s, request);
        return supplierRepository.save(s);
    }

    public Supplier require(Long id) {
        return supplierRepository.findById(id).orElseThrow(() -> ApiException.notFound("Supplier not found: " + id));
    }

    public List<Supplier> searchSuppliers(String query) {
        if (query == null || query.trim().isEmpty()) {
            return supplierRepository.findAll();
        }
        String q = query.trim();
        Set<Supplier> results = new LinkedHashSet<>(supplierRepository.findByNameContainingIgnoreCase(q));
        results.addAll(supplierRepository.findByCompanyContainingIgnoreCase(q));
        return new ArrayList<>(results);
    }

    @Transactional
    public Supplier recordPayment(Long id, BigDecimal amount) {
        Supplier s = require(id);
        s.setLedgerBalance(s.getLedgerBalance().subtract(amount.setScale(2, RoundingMode.HALF_UP)));
        return supplierRepository.save(s);
    }

    /** Positive amount increases what we owe the supplier; negative (e.g. a return credit) decreases it. */
    @Transactional
    public void updateSupplierLedger(Long supplierId, BigDecimal amount) {
        Supplier s = require(supplierId);
        s.setLedgerBalance(s.getLedgerBalance().add(amount));
        supplierRepository.save(s);
    }

    private void applyEditable(Supplier target, Supplier src) {
        String name = src.getName() == null ? "" : src.getName().trim();
        if (name.isEmpty()) {
            throw ApiException.badRequest("Supplier name is required");
        }
        supplierRepository.findByNameContainingIgnoreCase(name).stream()
                .filter(o -> o.getName().equalsIgnoreCase(name) && !o.getSupplierId().equals(target.getSupplierId()))
                .findAny()
                .ifPresent(o -> {
                    throw ApiException.conflict("A supplier named '" + name + "' already exists");
                });
        String gstin = src.getGstIn() == null || src.getGstIn().isBlank() ? null : src.getGstIn().trim().toUpperCase();
        if (gstin != null && !gstin.matches(GSTIN_REGEX)) {
            throw ApiException.badRequest("Invalid GSTIN format (expected e.g. 27ABCDE1234F1Z5)");
        }
        target.setName(name);
        target.setGstIn(gstin);
        target.setCompany(src.getCompany() == null || src.getCompany().isBlank() ? null : src.getCompany().trim());
        target.setContactNumber(src.getContactNumber() == null || src.getContactNumber().isBlank()
                ? null : src.getContactNumber().trim());
    }
}
