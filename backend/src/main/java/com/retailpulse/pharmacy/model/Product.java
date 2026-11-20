// retailpulse-backend/src/main/java/com/retailpulse/pharmacy/model/Product.java
package com.retailpulse.pharmacy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "product")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long productId;

    @Column(nullable = false, unique = true)
    private String name;

    private String genericName; // e.g., Paracetamol, Amoxicillin

    @Column(nullable = false)
    private String hsnCode;

    @Column(nullable = false)
    private Integer stripSize; // e.g., 10 tablets

    private String scheduleDrugType;

    private String dosageForm; // Tablet, Syrup, Injection, Ointment, etc.
    private String unitType;   // Strip, Bottle, Tube, etc.
    private Double volumeMl;   // For Syrups
    private Double weightGm;   // For Ointments/Powders

    @Column(nullable = false)
    private Integer reorderLevel;

    private Integer targetStockLevel; // Ideal stock level for percentage calculations (e.g., 1000 tablets)

    private String company; // Added for quick company-based searches

    @Column(precision = 10, scale = 2)
    private BigDecimal price;

    private Integer quantity;

    private LocalDate expiryDate;

    private String composition; // e.g., Paracetamol 500mg, Caffeine 30mg

    @Column(precision = 5, scale = 2)
    private java.math.BigDecimal profitMargin;

    // GST % for this item (CGST and SGST are half each). Selling prices are GST-inclusive (MRP basis).
    @Column(precision = 5, scale = 2)
    private BigDecimal gstRate = new BigDecimal("12.00");

    // Feature 4: Fast billing with barcode/QR scanning
    @Column(unique = true)
    private String barcode;

    // --- 1. Constructors ---
    
    // Default Constructor (Required by JPA/Hibernate)
    public Product() {
    }

    // --- 2. Getters and Setters ---

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getHsnCode() {
        return hsnCode;
    }

    public void setHsnCode(String hsnCode) {
        this.hsnCode = hsnCode;
    }

    public Integer getStripSize() {
        return stripSize;
    }

    public void setStripSize(Integer stripSize) {
        this.stripSize = stripSize;
    }

    public String getScheduleDrugType() {
        return scheduleDrugType;
    }

    public void setScheduleDrugType(String scheduleDrugType) {
        this.scheduleDrugType = scheduleDrugType;
    }

    public Integer getReorderLevel() {
        return reorderLevel;
    }

    public void setReorderLevel(Integer reorderLevel) {
        this.reorderLevel = reorderLevel;
    }

    public String getCompany() {
        return company;
    }

    public void setCompany(String company) {
        this.company = company;
    }

    public java.math.BigDecimal getProfitMargin() {
        return profitMargin;
    }

    public void setProfitMargin(java.math.BigDecimal profitMargin) {
        this.profitMargin = profitMargin;
    }

    public String getBarcode() {
        return barcode;
    }

    public void setBarcode(String barcode) {
        this.barcode = barcode;
    }

    public String getComposition() {
        return composition;
    }

    public void setComposition(String composition) {
        this.composition = composition;
    }

    public Integer getTargetStockLevel() {
        return targetStockLevel;
    }

    public void setTargetStockLevel(Integer targetStockLevel) {
        this.targetStockLevel = targetStockLevel;
    }

    public String getDosageForm() {
        return dosageForm;
    }

    public void setDosageForm(String dosageForm) {
        this.dosageForm = dosageForm;
    }

    public String getUnitType() {
        return unitType;
    }

    public void setUnitType(String unitType) {
        this.unitType = unitType;
    }

    public Double getVolumeMl() {
        return volumeMl;
    }

    public void setVolumeMl(Double volumeMl) {
        this.volumeMl = volumeMl;
    }

    public Double getWeightGm() {
        return weightGm;
    }

    public void setWeightGm(Double weightGm) {
        this.weightGm = weightGm;
    }

    public String getGenericName() {
        return genericName;
    }

    public void setGenericName(String genericName) {
        this.genericName = genericName;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public BigDecimal getGstRate() {
        return gstRate;
    }

    public void setGstRate(BigDecimal gstRate) {
        this.gstRate = gstRate;
    }

    /** Total units on hand across all batches; maintained by StockService, not by API clients. */
    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(LocalDate expiryDate) {
        this.expiryDate = expiryDate;
    }
}