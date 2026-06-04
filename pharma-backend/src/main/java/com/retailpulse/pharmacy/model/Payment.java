// retailpulse-backend/src/main/java/com/retailpulse/pharmacy/model/Payment.java
package com.retailpulse.pharmacy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.math.BigDecimal;

@Entity
@Table(name = "payment")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long paymentId;

    // Link to the invoice this payment settles
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private SalesInvoice invoice;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amountPaid;

    @Column(nullable = false)
    private LocalDateTime paymentDate = LocalDateTime.now();

    // Feature 11: Payment Method (Cash, UPI, Card, Razorpay Ref)
    private String paymentMethod; 

    // Feature 11: Tracking payment status for Razorpay
    private String transactionReference;
    private String paymentStatus; // e.g., SUCCESS, PENDING, FAILED
	public Long getPaymentId() {
		return paymentId;
	}
	public void setPaymentId(Long paymentId) {
		this.paymentId = paymentId;
	}
	public SalesInvoice getInvoice() {
		return invoice;
	}
	public void setInvoice(SalesInvoice invoice) {
		this.invoice = invoice;
	}
	public BigDecimal getAmountPaid() {
		return amountPaid;
	}
	public void setAmountPaid(BigDecimal amountPaid) {
		this.amountPaid = amountPaid;
	}
	public LocalDateTime getPaymentDate() {
		return paymentDate;
	}
	public void setPaymentDate(LocalDateTime paymentDate) {
		this.paymentDate = paymentDate;
	}
	public String getPaymentMethod() {
		return paymentMethod;
	}
	public void setPaymentMethod(String paymentMethod) {
		this.paymentMethod = paymentMethod;
	}
	public String getTransactionReference() {
		return transactionReference;
	}
	public void setTransactionReference(String transactionReference) {
		this.transactionReference = transactionReference;
	}
	public String getPaymentStatus() {
		return paymentStatus;
	}
	public void setPaymentStatus(String paymentStatus) {
		this.paymentStatus = paymentStatus;
	}

    
}