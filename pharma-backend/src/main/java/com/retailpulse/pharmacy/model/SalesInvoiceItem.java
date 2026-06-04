// retailpulse-backend/src/main/java/com/retailpulse/pharmacy/model/SalesInvoiceItem.java
package com.retailpulse.pharmacy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "sales_invoice_item")
public class SalesInvoiceItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long itemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private SalesInvoice invoice;

    // CRITICAL: Links the sale directly to the specific batch (for cost, expiry, and profit calculation)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private InventoryBatch batch; 

    // Quantity sold (in tablets, since strips might be partial)
    private Integer quantitySoldTablets; 

    // Pricing
    private BigDecimal unitSellingPrice; // Per tablet price
    private BigDecimal lineTaxableAmount;
    private BigDecimal lineCgst;
    private BigDecimal lineSgst;
    private BigDecimal lineTotal;

    // Feature 4: Dosage & Instructions (Saved per item/sale)
    private Boolean morning;
    private Boolean afternoon;
    private Boolean evening;
    private Boolean night;
    
    private Boolean beforeFood;
    private Boolean afterFood;
    
    private Integer durationDays;

	public Long getItemId() {
		return itemId;
	}

	public void setItemId(Long itemId) {
		this.itemId = itemId;
	}

	public SalesInvoice getInvoice() {
		return invoice;
	}

	public void setInvoice(SalesInvoice invoice) {
		this.invoice = invoice;
	}

	public InventoryBatch getBatch() {
		return batch;
	}

	public void setBatch(InventoryBatch batch) {
		this.batch = batch;
	}

	public Integer getQuantitySoldTablets() {
		return quantitySoldTablets;
	}

	public void setQuantitySoldTablets(Integer quantitySoldTablets) {
		this.quantitySoldTablets = quantitySoldTablets;
	}

	public BigDecimal getUnitSellingPrice() {
		return unitSellingPrice;
	}

	public void setUnitSellingPrice(BigDecimal unitSellingPrice) {
		this.unitSellingPrice = unitSellingPrice;
	}

	public BigDecimal getLineTaxableAmount() {
		return lineTaxableAmount;
	}

	public void setLineTaxableAmount(BigDecimal lineTaxableAmount) {
		this.lineTaxableAmount = lineTaxableAmount;
	}

	public BigDecimal getLineCgst() {
		return lineCgst;
	}

	public void setLineCgst(BigDecimal lineCgst) {
		this.lineCgst = lineCgst;
	}

	public BigDecimal getLineSgst() {
		return lineSgst;
	}

	public void setLineSgst(BigDecimal lineSgst) {
		this.lineSgst = lineSgst;
	}

	public BigDecimal getLineTotal() {
		return lineTotal;
	}

	public void setLineTotal(BigDecimal lineTotal) {
		this.lineTotal = lineTotal;
	}

	public Boolean getMorning() {
		return morning;
	}

	public void setMorning(Boolean morning) {
		this.morning = morning;
	}

	public Boolean getAfternoon() {
		return afternoon;
	}

	public void setAfternoon(Boolean afternoon) {
		this.afternoon = afternoon;
	}

	public Boolean getEvening() {
		return evening;
	}

	public void setEvening(Boolean evening) {
		this.evening = evening;
	}

	public Boolean getNight() {
		return night;
	}

	public void setNight(Boolean night) {
		this.night = night;
	}

	public Boolean getBeforeFood() {
		return beforeFood;
	}

	public void setBeforeFood(Boolean beforeFood) {
		this.beforeFood = beforeFood;
	}

	public Boolean getAfterFood() {
		return afterFood;
	}

	public void setAfterFood(Boolean afterFood) {
		this.afterFood = afterFood;
	}

	public Integer getDurationDays() {
		return durationDays;
	}

	public void setDurationDays(Integer durationDays) {
		this.durationDays = durationDays;
	}

    
}
