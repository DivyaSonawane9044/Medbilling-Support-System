package com.retailpulse.pharmacy.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.retailpulse.pharmacy.model.Customer;
import com.retailpulse.pharmacy.repositories.CustomerRepository;
import com.retailpulse.pharmacy.repositories.PaymentRepository;
import com.retailpulse.pharmacy.repositories.PrescriptionRepository;
import com.retailpulse.pharmacy.repositories.SalesInvoiceRepository;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerRepository customerRepository;
    private final SalesInvoiceRepository salesInvoiceRepository;
    private final PaymentRepository paymentRepository;
    private final PrescriptionRepository prescriptionRepository;

    @Autowired
    public CustomerController(
            CustomerRepository customerRepository,
            SalesInvoiceRepository salesInvoiceRepository,
            PaymentRepository paymentRepository,
            PrescriptionRepository prescriptionRepository) {
        this.customerRepository = customerRepository;
        this.salesInvoiceRepository = salesInvoiceRepository;
        this.paymentRepository = paymentRepository;
        this.prescriptionRepository = prescriptionRepository;
    }

    @GetMapping
    public ResponseEntity<List<Customer>> getAllCustomers(@RequestParam(name = "search", required = false) String search) {
        if (search == null || search.trim().isEmpty()) {
            return ResponseEntity.ok(customerRepository.findAll());
        }
        return ResponseEntity.ok(customerRepository.findByNameContainingIgnoreCase(search));
    }

    @GetMapping("/lookup")
    public ResponseEntity<List<Map<String, Object>>> lookupByFirstName(@RequestParam String firstName) {
        List<Customer> matches = customerRepository.findByNameStartingWithIgnoreCase(firstName.trim());
        List<Map<String, Object>> result = matches.stream().map(this::customerFullProfile).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Customer createCustomer(@RequestBody Customer customer) {
        return customerRepository.save(customer);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Customer> updateCustomer(@PathVariable Long id, @RequestBody Customer customer) {
        return customerRepository.findById(id).map(existing -> {
            customer.setCustomerId(id);
            return ResponseEntity.ok(customerRepository.save(customer));
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/search")
    public ResponseEntity<List<Customer>> searchCustomers(@RequestParam String name) {
        return ResponseEntity.ok(customerRepository.findByNameContainingIgnoreCase(name));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getCustomer(@PathVariable Long id) {
        return customerRepository.findById(id)
                .map(c -> ResponseEntity.ok(customerFullProfile(c)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<Map<String, Object>>> getCustomerHistory(@PathVariable Long id) {
        if (!customerRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        List<Map<String, Object>> history = salesInvoiceRepository.findByCustomerIdWithItems(id).stream()
                .map(invoice -> {
                    Map<String, Object> record = new HashMap<>();
                    record.put("invoiceId", invoice.getInvoiceId());
                    record.put("invoiceNumber", invoice.getInvoiceNumber());
                    record.put("saleDateTime", invoice.getSaleDateTime());
                    record.put("grandTotal", invoice.getGrandTotal());
                    record.put("itemCount", invoice.getItems() == null ? 0 : invoice.getItems().size());
                    return record;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(history);
    }

    @GetMapping("/{id}/payments")
    public ResponseEntity<List<Map<String, Object>>> getPaymentHistory(@PathVariable Long id) {
        if (!customerRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        List<Map<String, Object>> payments = paymentRepository.findByCustomerId(id).stream().map(p -> {
            Map<String, Object> m = new HashMap<>();
            m.put("paymentId", p.getPaymentId());
            m.put("amountPaid", p.getAmountPaid());
            m.put("paymentDate", p.getPaymentDate());
            m.put("paymentMethod", p.getPaymentMethod());
            m.put("paymentStatus", p.getPaymentStatus());
            m.put("invoiceNumber", p.getInvoice() != null ? p.getInvoice().getInvoiceNumber() : null);
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(payments);
    }

    @PostMapping("/{id}/pay")
    public ResponseEntity<String> processCustomerPayment(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        return customerRepository.findById(id).map(customer -> {
            java.math.BigDecimal amountPaid = new java.math.BigDecimal(payload.get("amount").toString());
            java.math.BigDecimal newBalance = customer.getRemainingBalance().subtract(amountPaid);
            customer.setRemainingBalance(newBalance);
            customerRepository.save(customer);
            return ResponseEntity.ok("Payment processed. Remaining balance: " + newBalance);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/prescription-image")
    public ResponseEntity<Customer> savePrescriptionImage(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return customerRepository.findById(id).map(customer -> {
            customer.setPrescriptionImageUrl(body.get("imageUrl"));
            return ResponseEntity.ok(customerRepository.save(customer));
        }).orElse(ResponseEntity.notFound().build());
    }

    private Map<String, Object> customerFullProfile(Customer c) {
        Map<String, Object> profile = new HashMap<>();
        profile.put("customer", c);
        profile.put("purchaseHistory", salesInvoiceRepository.findByCustomerIdWithItems(c.getCustomerId()).stream()
                .map(inv -> Map.of(
                        "invoiceNumber", inv.getInvoiceNumber(),
                        "date", inv.getSaleDateTime(),
                        "grandTotal", inv.getGrandTotal()))
                .collect(Collectors.toList()));
        profile.put("paymentHistory", paymentRepository.findByCustomerId(c.getCustomerId()));
        profile.put("remainingBalance", c.getRemainingBalance());
        profile.put("prescriptions", prescriptionRepository.findAll().stream()
                .filter(p -> p.getCustomer() != null && p.getCustomer().getCustomerId().equals(c.getCustomerId()))
                .collect(Collectors.toList()));
        return profile;
    }
}
