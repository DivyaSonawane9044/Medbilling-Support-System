// retailpulse-backend/src/main/java/com/retailpulse/pharmacy/dto/SalesRequestDTO.java
package com.retailpulse.pharmacy.dto;


public class SalesRequestDTO {
    // Customer Details (Feature 7)
    private Long customerId; // Can be null for anonymous sales
    private String customerName; // Required for new customer creation/lookup
    private String contactNumber;
    private String doctorName;
    private String prescriptionImageUrl;

    // Transaction Details
    private java.math.BigDecimal amountPaid; // For Payment Module later
    private String paymentMethod; 

    // Line Items
    private java.util.List<SaleLineItemDTO> lineItems;

	public Long getCustomerId() {
		return customerId;
	}

	public void setCustomerId(Long customerId) {
		this.customerId = customerId;
	}

	public String getCustomerName() {
		return customerName;
	}

	public void setCustomerName(String customerName) {
		this.customerName = customerName;
	}

	public String getContactNumber() {
		return contactNumber;
	}

	public void setContactNumber(String contactNumber) {
		this.contactNumber = contactNumber;
	}

	public String getDoctorName() {
		return doctorName;
	}

	public void setDoctorName(String doctorName) {
		this.doctorName = doctorName;
	}

	public String getPrescriptionImageUrl() {
		return prescriptionImageUrl;
	}

	public void setPrescriptionImageUrl(String prescriptionImageUrl) {
		this.prescriptionImageUrl = prescriptionImageUrl;
	}

	public java.math.BigDecimal getAmountPaid() {
		return amountPaid;
	}

	public void setAmountPaid(java.math.BigDecimal amountPaid) {
		this.amountPaid = amountPaid;
	}

	public String getPaymentMethod() {
		return paymentMethod;
	}

	public void setPaymentMethod(String paymentMethod) {
		this.paymentMethod = paymentMethod;
	}

	public java.util.List<SaleLineItemDTO> getLineItems() {
		return lineItems;
	}

	public void setLineItems(java.util.List<SaleLineItemDTO> lineItems) {
		this.lineItems = lineItems;
	}

    
}