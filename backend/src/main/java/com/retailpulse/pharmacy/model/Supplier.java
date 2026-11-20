package com.retailpulse.pharmacy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "supplier")
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long supplierId;

    @Column(nullable = false, unique = true)
    private String name;

    private String contactNumber;

    private String company;

    private String gstIn;

    // Feature 3: Supplier ledger & payment tracking
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal ledgerBalance = BigDecimal.ZERO; 

    // --- 1. Constructors ---
    
    // Default Constructor (Required by JPA/Hibernate)
    public Supplier() {
    }

    // --- 2. Getters and Setters ---

    public Long getSupplierId() {
        return supplierId;
    }

    public void setSupplierId(Long supplierId) {
        this.supplierId = supplierId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getContactNumber() {
        return contactNumber;
    }

    public void setContactNumber(String contactNumber) {
        this.contactNumber = contactNumber;
    }

    public String getCompany() {
        return company;
    }

    public void setCompany(String company) {
        this.company = company;
    }

    public String getGstIn() {
        return gstIn;
    }

    public void setGstIn(String gstIn) {
        this.gstIn = gstIn;
    }

    public BigDecimal getLedgerBalance() {
        return ledgerBalance;
    }

    public void setLedgerBalance(BigDecimal ledgerBalance) {
        this.ledgerBalance = ledgerBalance;
    }
    
    // --- (Optional) Utility Methods like equals(), hashCode(), and toString() would be here ---
}