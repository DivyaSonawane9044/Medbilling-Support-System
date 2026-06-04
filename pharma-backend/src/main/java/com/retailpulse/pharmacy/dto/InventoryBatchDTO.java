package com.retailpulse.pharmacy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.retailpulse.pharmacy.model.InventoryBatch;
import com.retailpulse.pharmacy.model.Product;

/**
 * Flat inventory row for API responses — avoids Hibernate circular JSON
 * (batch → purchaseInvoice → batches → …).
 */
public class InventoryBatchDTO {

    private Long batchId;
    private String batchNumber;
    private LocalDate mfgDate;
    private LocalDate expiryDate;
    private BigDecimal mrp;
    private Integer stripStock;
    private Integer tabletStock;
    private Boolean isNearExpiry;
    private ProductSummary product;

    public static class ProductSummary {
        private Long productId;
        private String name;
        private String company;
        private Integer stripSize;
        private Integer reorderLevel;

        public static ProductSummary from(Product p) {
            ProductSummary s = new ProductSummary();
            s.productId = p.getProductId();
            s.name = p.getName();
            s.company = p.getCompany();
            s.stripSize = p.getStripSize() != null ? p.getStripSize() : 1;
            s.reorderLevel = p.getReorderLevel();
            return s;
        }

        public Long getProductId() { return productId; }
        public void setProductId(Long productId) { this.productId = productId; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getCompany() { return company; }
        public void setCompany(String company) { this.company = company; }
        public Integer getStripSize() { return stripSize; }
        public void setStripSize(Integer stripSize) { this.stripSize = stripSize; }
        public Integer getReorderLevel() { return reorderLevel; }
        public void setReorderLevel(Integer reorderLevel) { this.reorderLevel = reorderLevel; }
    }

    public static InventoryBatchDTO from(InventoryBatch batch) {
        InventoryBatchDTO dto = new InventoryBatchDTO();
        dto.batchId = batch.getBatchId();
        dto.batchNumber = batch.getBatchNumber();
        dto.mfgDate = batch.getMfgDate();
        dto.expiryDate = batch.getExpiryDate();
        dto.mrp = batch.getMrp();
        dto.stripStock = batch.getStripStock();
        dto.tabletStock = batch.getTabletStock();
        dto.isNearExpiry = batch.getIsNearExpiry();
        if (batch.getProduct() != null) {
            dto.product = ProductSummary.from(batch.getProduct());
        }
        return dto;
    }

    public Long getBatchId() { return batchId; }
    public void setBatchId(Long batchId) { this.batchId = batchId; }
    public String getBatchNumber() { return batchNumber; }
    public void setBatchNumber(String batchNumber) { this.batchNumber = batchNumber; }
    public LocalDate getMfgDate() { return mfgDate; }
    public void setMfgDate(LocalDate mfgDate) { this.mfgDate = mfgDate; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
    public BigDecimal getMrp() { return mrp; }
    public void setMrp(BigDecimal mrp) { this.mrp = mrp; }
    public Integer getStripStock() { return stripStock; }
    public void setStripStock(Integer stripStock) { this.stripStock = stripStock; }
    public Integer getTabletStock() { return tabletStock; }
    public void setTabletStock(Integer tabletStock) { this.tabletStock = tabletStock; }
    public Boolean getIsNearExpiry() { return isNearExpiry; }
    public void setIsNearExpiry(Boolean isNearExpiry) { this.isNearExpiry = isNearExpiry; }
    public ProductSummary getProduct() { return product; }
    public void setProduct(ProductSummary product) { this.product = product; }
}
