
package com.retailpulse.pharmacy.dto;

import java.time.LocalDate;
import java.math.BigDecimal;

public class BatchItemDTO {

    private Long productId;
    private String batchNumber;
    private LocalDate mfgDate;
    private LocalDate expiryDate;
    private BigDecimal mrp; // Maximum Retail Price (per strip)
    private BigDecimal costPrice; // Actual Purchase Cost (per strip)
    private BigDecimal sellingPrice; // Default Selling Price (per strip)
    private Integer stripQuantity; // Stock quantity received

    // --- 1. Constructors ---

    // Default Constructor
    public BatchItemDTO() {
    }

    // --- 2. Getters and Setters ---

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
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

    public Integer getStripQuantity() {
        return stripQuantity;
    }

    public void setStripQuantity(Integer stripQuantity) {
        this.stripQuantity = stripQuantity;
    }
}
