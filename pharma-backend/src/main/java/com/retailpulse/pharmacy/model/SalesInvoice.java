// retailpulse-backend/src/main/java/com/retailpulse/pharmacy/model/SalesInvoice.java
package com.retailpulse.pharmacy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "sales_invoice")
public class SalesInvoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long invoiceId;

    @Column(nullable = false, unique = true)
    private String invoiceNumber;

    @Column(nullable = false)
    private LocalDateTime saleDateTime = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    private String dispensingPharmacist;

    // Financials (Feature 5: Tax & Financial Accounting)
    private BigDecimal totalTaxableAmount;
    private BigDecimal totalCgst;
    private BigDecimal totalSgst;
    private BigDecimal grandTotal;

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SalesInvoiceItem> items = new ArrayList<>();

    

    public Long getInvoiceId() {
		return invoiceId;
	}



	public void setInvoiceId(Long invoiceId) {
		this.invoiceId = invoiceId;
	}



	public String getInvoiceNumber() {
		return invoiceNumber;
	}



	public void setInvoiceNumber(String invoiceNumber) {
		this.invoiceNumber = invoiceNumber;
	}



	public LocalDateTime getSaleDateTime() {
		return saleDateTime;
	}



	public void setSaleDateTime(LocalDateTime saleDateTime) {
		this.saleDateTime = saleDateTime;
	}



	public Customer getCustomer() {
		return customer;
	}



	public void setCustomer(Customer customer) {
		this.customer = customer;
	}



	public String getDispensingPharmacist() {
		return dispensingPharmacist;
	}



	public void setDispensingPharmacist(String dispensingPharmacist) {
		this.dispensingPharmacist = dispensingPharmacist;
	}



	public BigDecimal getTotalTaxableAmount() {
		return totalTaxableAmount;
	}



	public void setTotalTaxableAmount(BigDecimal totalTaxableAmount) {
		this.totalTaxableAmount = totalTaxableAmount;
	}



	public BigDecimal getTotalCgst() {
		return totalCgst;
	}



	public void setTotalCgst(BigDecimal totalCgst) {
		this.totalCgst = totalCgst;
	}



	public BigDecimal getTotalSgst() {
		return totalSgst;
	}

	public void setTotalSgst(BigDecimal totalSgst) {
		this.totalSgst = totalSgst;
	}

	public BigDecimal getGrandTotal() {
		return grandTotal;
	}

	public void setGrandTotal(BigDecimal grandTotal) {
		this.grandTotal = grandTotal;
	}

	public List<SalesInvoiceItem> getItems() {
		return items;
	}

	public void setItems(List<SalesInvoiceItem> items) {
		this.items = items;
	}

    public void addItem(SalesInvoiceItem item) {
        this.items.add(item);
        item.setInvoice(this);
    }



}