package com.retailpulse.pharmacy.model;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "inventory_batch")
public class InventoryBatch {
	@Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long batchId;

    // Foreign Key to Product Master (Many batches belong to One Product)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    // Foreign Key to Supplier (Many batches are supplied by One Supplier)
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id") // null for opening stock entered without a supplier
    private Supplier supplier; 
    
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_invoice_id")
    private PurchaseInvoice purchaseInvoice;

    @Column(nullable = false)
    private String batchNumber;

    @Column(nullable = false)
    private LocalDate mfgDate;

    @Column(nullable = false)
    private LocalDate expiryDate;

    // Financial Tracking (Using BigDecimal for precision)
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal mrp; // Per strip
    
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal costPrice; // Purchase cost (Per strip)
    
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal sellingPrice; // Selling Price (Per strip)

    // Stock Tracking
    @Column(nullable = false)
    private Integer stripStock = 0; // Current stock in whole strips
    
    @Column(nullable = false)
    private Integer tabletStock = 0; // Current stock in loose tablets

    // Strips received on the purchase that created this batch (stripStock changes as stock is sold)
    private Integer receivedStrips;

    // Status Field - calculated by business logic, not persisted
    @Transient
    private Boolean isNearExpiry; 

    // --- Constructors (Required by JPA/Hibernate) ---
    public InventoryBatch() {
    }

    // --- Getters and Setters (Manual, since we are not using Lombok) ---

    public Long getBatchId() {
        return batchId;
    }

    public void setBatchId(Long batchId) {
        this.batchId = batchId;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
    }

    public Supplier getSupplier() {
        return supplier;
    }

    public void setSupplier(Supplier supplier) {
        this.supplier = supplier;
    }

    public PurchaseInvoice getPurchaseInvoice() {
        return purchaseInvoice;
    }
    public void setPurchaseInvoice(PurchaseInvoice purchaseInvoice) {
        this.purchaseInvoice = purchaseInvoice;
    }
    
    public String getBatchNumber() {
        return batchNumber;
    }

    public void setBatchNumber(String batchNumber) {
        this.batchNumber = batchNumber;
    }

    public LocalDate getMfgDate() {
        return mfgDate;
    }

    public void setMfgDate(LocalDate mfgDate) {
        this.mfgDate = mfgDate;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(LocalDate expiryDate) {
        this.expiryDate = expiryDate;
    }

    public BigDecimal getMrp() {
        return mrp;
    }

    public void setMrp(BigDecimal mrp) {
        this.mrp = mrp;
    }

    public BigDecimal getCostPrice() {
        return costPrice;
    }

    public void setCostPrice(BigDecimal costPrice) {
        this.costPrice = costPrice;
    }

    public BigDecimal getSellingPrice() {
        return sellingPrice;
    }

    public void setSellingPrice(BigDecimal sellingPrice) {
        this.sellingPrice = sellingPrice;
    }

    public Integer getStripStock() {
        return stripStock;
    }

    public void setStripStock(Integer stripStock) {
        this.stripStock = stripStock;
    }

    public Integer getTabletStock() {
        return tabletStock;
    }

    public void setTabletStock(Integer tabletStock) {
        this.tabletStock = tabletStock;
    }

    public Integer getReceivedStrips() {
        return receivedStrips;
    }

    public void setReceivedStrips(Integer receivedStrips) {
        this.receivedStrips = receivedStrips;
    }

    public Boolean getIsNearExpiry() {
        return isNearExpiry;
    }

    public void setIsNearExpiry(Boolean isNearExpiry) {
        this.isNearExpiry = isNearExpiry;
    }
}