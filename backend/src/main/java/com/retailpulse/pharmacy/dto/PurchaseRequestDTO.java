// retailpulse-backend/src/main/java/com/retailpulse/pharmacy/dto/PurchaseRequestDTO.java
package com.retailpulse.pharmacy.dto;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.ArrayList;

public class PurchaseRequestDTO {

    // Invoice Header Details
    private Long supplierId;
    private Long purchaseInvoiceId;
    private String invoiceNumber;
    private LocalDate purchaseDate;
    private BigDecimal totalAmount; 

    // List of Line Items
    private List<BatchItemDTO> batchItems = new ArrayList<>();

    // --- 1. Constructors ---
    
    // Default Constructor
    public PurchaseRequestDTO() {
    }

    // --- 2. Getters and Setters ---

    public Long getSupplierId() {
        return supplierId;
    }

    public void setSupplierId(Long supplierId) {
        this.supplierId = supplierId;
    }

    public Long getPurchaseInvoiceId() {
        return purchaseInvoiceId;
    }

    public void setPurchaseInvoiceId(Long purchaseInvoiceId) {
        this.purchaseInvoiceId = purchaseInvoiceId;
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

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public List<BatchItemDTO> getBatchItems() {
        return batchItems;
    }

    public void setBatchItems(List<BatchItemDTO> batchItems) {
        this.batchItems = batchItems;
    }
}