package com.retailpulse.pharmacy.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Create/update payload for a medicine. Stock is never set directly: on create an
 * optional opening stock becomes a real inventory batch; afterwards stock changes only
 * through purchases, sales and returns.
 */
public class ProductRequestDTO {
    private String name;
    private String genericName;
    private String company;
    private String composition;
    private String hsnCode;
    private Integer stripSize;
    private String scheduleDrugType;
    private String dosageForm;
    private String unitType;
    private Double volumeMl;
    private Double weightGm;
    private Integer reorderLevel;
    private Integer targetStockLevel;
    private BigDecimal price;        // default selling price per pack (GST-inclusive)
    private BigDecimal profitMargin;
    private BigDecimal gstRate;
    private String barcode;

    // Opening stock (create only)
    private Integer openingQuantity; // units (tablets / bottles)
    private String batchNumber;
    private LocalDate mfgDate;
    private LocalDate expiryDate;
    private BigDecimal mrp;          // per pack
    private BigDecimal costPrice;    // per pack

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getGenericName() { return genericName; }
    public void setGenericName(String genericName) { this.genericName = genericName; }
    public String getCompany() { return company; }
    public void setCompany(String company) { this.company = company; }
    public String getComposition() { return composition; }
    public void setComposition(String composition) { this.composition = composition; }
    public String getHsnCode() { return hsnCode; }
    public void setHsnCode(String hsnCode) { this.hsnCode = hsnCode; }
    public Integer getStripSize() { return stripSize; }
    public void setStripSize(Integer stripSize) { this.stripSize = stripSize; }
    public String getScheduleDrugType() { return scheduleDrugType; }
    public void setScheduleDrugType(String scheduleDrugType) { this.scheduleDrugType = scheduleDrugType; }
    public String getDosageForm() { return dosageForm; }
    public void setDosageForm(String dosageForm) { this.dosageForm = dosageForm; }
    public String getUnitType() { return unitType; }
    public void setUnitType(String unitType) { this.unitType = unitType; }
    public Double getVolumeMl() { return volumeMl; }
    public void setVolumeMl(Double volumeMl) { this.volumeMl = volumeMl; }
    public Double getWeightGm() { return weightGm; }
    public void setWeightGm(Double weightGm) { this.weightGm = weightGm; }
    public Integer getReorderLevel() { return reorderLevel; }
    public void setReorderLevel(Integer reorderLevel) { this.reorderLevel = reorderLevel; }
    public Integer getTargetStockLevel() { return targetStockLevel; }
    public void setTargetStockLevel(Integer targetStockLevel) { this.targetStockLevel = targetStockLevel; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public BigDecimal getProfitMargin() { return profitMargin; }
    public void setProfitMargin(BigDecimal profitMargin) { this.profitMargin = profitMargin; }
    public BigDecimal getGstRate() { return gstRate; }
    public void setGstRate(BigDecimal gstRate) { this.gstRate = gstRate; }
    public String getBarcode() { return barcode; }
    public void setBarcode(String barcode) { this.barcode = barcode; }
    public Integer getOpeningQuantity() { return openingQuantity; }
    public void setOpeningQuantity(Integer openingQuantity) { this.openingQuantity = openingQuantity; }
    public String getBatchNumber() { return batchNumber; }
    public void setBatchNumber(String batchNumber) { this.batchNumber = batchNumber; }
    public LocalDate getMfgDate() { return mfgDate; }
    public void setMfgDate(LocalDate mfgDate) { this.mfgDate = mfgDate; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
    public BigDecimal getMrp() { return mrp; }
    public void setMrp(BigDecimal mrp) { this.mrp = mrp; }
    public BigDecimal getCostPrice() { return costPrice; }
    public void setCostPrice(BigDecimal costPrice) { this.costPrice = costPrice; }
}
