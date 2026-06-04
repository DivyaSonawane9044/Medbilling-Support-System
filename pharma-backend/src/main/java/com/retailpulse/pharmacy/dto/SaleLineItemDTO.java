package com.retailpulse.pharmacy.dto;

public class SaleLineItemDTO {
    private Long productId; 
    private Integer quantitySoldTablets; 
    private Boolean morning;
    private Boolean afternoon;
    private Boolean evening;
    private Boolean night;
    private Boolean beforeFood;
    private Boolean afterFood;
    private Integer durationDays;
	public Long getProductId() {
		return productId;
	}
	public void setProductId(Long productId) {
		this.productId = productId;
	}
	public Integer getQuantitySoldTablets() {
		return quantitySoldTablets;
	}
	public void setQuantitySoldTablets(Integer quantitySoldTablets) {
		this.quantitySoldTablets = quantitySoldTablets;
	}
	public Boolean getMorning() { return morning; }
	public void setMorning(Boolean morning) { this.morning = morning; }

	public Boolean getAfternoon() { return afternoon; }
	public void setAfternoon(Boolean afternoon) { this.afternoon = afternoon; }

	public Boolean getEvening() { return evening; }
	public void setEvening(Boolean evening) { this.evening = evening; }

	public Boolean getNight() { return night; }
	public void setNight(Boolean night) { this.night = night; }

	public Boolean getBeforeFood() { return beforeFood; }
	public void setBeforeFood(Boolean beforeFood) { this.beforeFood = beforeFood; }

	public Boolean getAfterFood() { return afterFood; }
	public void setAfterFood(Boolean afterFood) { this.afterFood = afterFood; }

	public Integer getDurationDays() { return durationDays; }
	public void setDurationDays(Integer durationDays) { this.durationDays = durationDays; }
}
    