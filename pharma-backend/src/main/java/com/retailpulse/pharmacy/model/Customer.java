// retailpulse-backend/src/main/java/com/retailpulse/pharmacy/model/Customer.java
package com.retailpulse.pharmacy.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "customer")
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long customerId;

    @Column(nullable = false)
    private String name;

    private String contactNumber;
    private String email;
    private String address;
    private String doctorName;

   
    private String prescriptionImageUrl;

    // Feature 7: Past Payment History (Tracking remaining payment for partial/unpaid bills)
    @Column(precision = 10, scale = 2)
    private java.math.BigDecimal remainingBalance = java.math.BigDecimal.ZERO;

	public Long getCustomerId() {
		return customerId;
	}

	public void setCustomerId(Long customerId) {
		this.customerId = customerId;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getContactNumber() {
		return contactNumber;
	}

	public void setContactNumber(String contactNumber) {
		this.contactNumber = contactNumber;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
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

	public java.math.BigDecimal getRemainingBalance() {
		return remainingBalance;
	}

	public void setRemainingBalance(java.math.BigDecimal remainingBalance) {
		this.remainingBalance = remainingBalance;
	}

    
}
