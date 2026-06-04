// retailpulse-backend/src/main/java/com/retailpulse/pharmacy/model/PurchaseInvoice.java
package com.retailpulse.pharmacy.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.ArrayList; // Recommended for initializing List fields

@Entity
@Table(name = "purchase_invoice")
public class PurchaseInvoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long invoiceId;

    @Column(nullable = false)
    private String invoiceNumber;

    @Column(nullable = false)
    private LocalDate purchaseDate;
    
    // Link to the supplier
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    // The total value of the invoice
    @Column(precision = 10, scale = 2)
    private BigDecimal totalAmount;

    // Feature 3: Track pending items (ordered but not received)
    @Column(nullable = false)
    private String status = "RECEIVED"; // Values: PENDING, RECEIVED, CANCELLED

    // Relationship to the batches created from this invoice
    // CascadeType.ALL ensures batches are saved when the invoice is saved
    @OneToMany(mappedBy = "purchaseInvoice", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<InventoryBatch> batches = new ArrayList<>(); // Initialize the list
    
    
    // --- 1. Constructors ---
    
    // Default Constructor (Required by JPA/Hibernate)
    public PurchaseInvoice() {
    }

    // --- 2. Getters and Setters ---

    public Long getInvoiceId() {
        return invoiceId;
    }

    public void setInvoiceId(Long invoiceId) {
        this.invoiceId = invoiceId;
    }

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public void setInvoiceNumber(String invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
    }

    public LocalDate getPurchaseDate() {
        return purchaseDate;
    }

    public void setPurchaseDate(LocalDate purchaseDate) {
        this.purchaseDate = purchaseDate;
    }

    public Supplier getSupplier() {
        return supplier;
    }

    public void setSupplier(Supplier supplier) {
        this.supplier = supplier;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public List<InventoryBatch> getBatches() {
        return batches;
    }

    public void setBatches(List<InventoryBatch> batches) {
        this.batches = batches;
    }
    
    // Helper method to manage the bidirectional relationship when adding a batch
    public void addBatch(InventoryBatch batch) {
        this.batches.add(batch);
        batch.setPurchaseInvoice(this); // Set the inverse side of the relationship
    }
}