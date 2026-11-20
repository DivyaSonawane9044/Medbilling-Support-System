package com.retailpulse.pharmacy.controller;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.exception.ApiException;
import com.retailpulse.pharmacy.model.Customer;
import com.retailpulse.pharmacy.model.Payment;
import com.retailpulse.pharmacy.model.SalesInvoice;
import com.retailpulse.pharmacy.repositories.CustomerRepository;
import com.retailpulse.pharmacy.repositories.PaymentRepository;
import com.retailpulse.pharmacy.repositories.PrescriptionRepository;
import com.retailpulse.pharmacy.repositories.SalesInvoiceRepository;
import com.retailpulse.pharmacy.service.BillingService;
import com.retailpulse.pharmacy.service.PaymentService;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerRepository customerRepository;
    private final SalesInvoiceRepository salesInvoiceRepository;
    private final PaymentRepository paymentRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PaymentService paymentService;
    private final BillingService billingService;

    public CustomerController(CustomerRepository customerRepository, SalesInvoiceRepository salesInvoiceRepository,
            PaymentRepository paymentRepository, PrescriptionRepository prescriptionRepository,
            PaymentService paymentService, BillingService billingService) {
        this.customerRepository = customerRepository;
        this.salesInvoiceRepository = salesInvoiceRepository;
        this.paymentRepository = paymentRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.paymentService = paymentService;
        this.billingService = billingService;
    }

    @GetMapping
    public List<Customer> getAllCustomers(@RequestParam(name = "search", required = false) String search) {
        if (search == null || search.trim().isEmpty()) {
            return customerRepository.findAll();
        }
        String q = search.trim();
        java.util.LinkedHashSet<Customer> result = new java.util.LinkedHashSet<>(customerRepository.findByNameContainingIgnoreCase(q));
        result.addAll(customerRepository.findByContactNumberContaining(q));
        return List.copyOf(result);
    }

    @GetMapping("/lookup")
    public List<Map<String, Object>> lookupByFirstName(@RequestParam String firstName) {
        return customerRepository.findByNameStartingWithIgnoreCase(firstName.trim()).stream()
                .map(this::customerFullProfile).toList();
    }

    /** Creates a customer. Any balance in the request is ignored; balances only change through sales/payments. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Customer createCustomer(@RequestBody Customer request) {
        Customer c = new Customer();
        applyEditable(c, request);
        c.setRemainingBalance(BigDecimal.ZERO);
        return customerRepository.save(c);
    }

    /** Updates contact details only. */
    @PutMapping("/{id}")
    public Customer updateCustomer(@PathVariable Long id, @RequestBody Customer request) {
        Customer c = customerRepository.findById(id).orElseThrow(() -> ApiException.notFound("Customer not found: " + id));
        applyEditable(c, request);
        return customerRepository.save(c);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteCustomer(@PathVariable Long id) {
        Customer c = customerRepository.findById(id).orElseThrow(() -> ApiException.notFound("Customer not found: " + id));
        if (salesInvoiceRepository.existsByCustomer_CustomerId(id) || !paymentRepository.findByCustomerId(id).isEmpty()) {
            throw ApiException.conflict(c.getName() + " has invoices or payments and cannot be deleted");
        }
        if (c.getRemainingBalance() != null && c.getRemainingBalance().signum() != 0) {
            throw ApiException.conflict(c.getName() + " has an outstanding balance and cannot be deleted");
        }
        prescriptionRepository.deleteByCustomer_CustomerId(id);
        customerRepository.delete(c);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/search")
    public List<Customer> searchCustomers(@RequestParam String name) {
        return customerRepository.findByNameContainingIgnoreCase(name.trim());
    }

    @GetMapping("/{id}")
    public Map<String, Object> getCustomer(@PathVariable Long id) {
        return customerRepository.findById(id).map(this::customerFullProfile)
                .orElseThrow(() -> ApiException.notFound("Customer not found: " + id));
    }

    @GetMapping("/{id}/history")
    public List<Map<String, Object>> getCustomerHistory(@PathVariable Long id) {
        requireCustomer(id);
        return salesInvoiceRepository.findByCustomerIdWithItems(id).stream()
                .sorted(java.util.Comparator.comparing(SalesInvoice::getSaleDateTime).reversed())
                .map(billingService::toSummary).toList();
    }

    @GetMapping("/{id}/payments")
    public List<Map<String, Object>> getPaymentHistory(@PathVariable Long id) {
        requireCustomer(id);
        return paymentRepository.findByCustomerId(id).stream().map(CustomerController::paymentRow).toList();
    }

    /** Body: {amount, paymentMethod?}. Settles part of the customer's outstanding credit. */
    @PostMapping("/{id}/pay")
    public Map<String, Object> processCustomerPayment(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        BigDecimal amount = PaymentController.optionalAmount(payload);
        if (amount == null) {
            throw ApiException.badRequest("amount is required");
        }
        Object method = payload.get("paymentMethod");
        Payment p = paymentService.recordCustomerBalancePayment(id, amount, method == null ? null : method.toString());
        Map<String, Object> result = paymentRow(p);
        result.put("remainingBalance", p.getCustomer().getRemainingBalance());
        return result;
    }

    @PostMapping("/{id}/prescription-image")
    public Customer savePrescriptionImage(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Customer customer = requireCustomer(id);
        customer.setPrescriptionImageUrl(body.get("imageUrl"));
        return customerRepository.save(customer);
    }

    private Customer requireCustomer(Long id) {
        return customerRepository.findById(id).orElseThrow(() -> ApiException.notFound("Customer not found: " + id));
    }

    private static void applyEditable(Customer target, Customer src) {
        String name = src.getName() == null ? "" : src.getName().trim();
        if (name.isEmpty()) {
            throw ApiException.badRequest("Customer name is required");
        }
        String phone = blankToNull(src.getContactNumber());
        if (phone != null && !phone.matches("^\\+?[0-9][0-9 -]{6,14}[0-9]$")) {
            throw ApiException.badRequest("Contact number must be 8-16 digits");
        }
        String email = blankToNull(src.getEmail());
        if (email != null && !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw ApiException.badRequest("Email address is not valid");
        }
        target.setName(name);
        target.setContactNumber(phone);
        target.setEmail(email);
        target.setAddress(blankToNull(src.getAddress()));
        target.setDoctorName(blankToNull(src.getDoctorName()));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static Map<String, Object> paymentRow(Payment p) {
        Map<String, Object> m = new HashMap<>();
        m.put("paymentId", p.getPaymentId());
        m.put("amountPaid", p.getAmountPaid());
        m.put("paymentDate", p.getPaymentDate());
        m.put("paymentMethod", p.getPaymentMethod());
        m.put("paymentStatus", p.getPaymentStatus());
        m.put("transactionReference", p.getTransactionReference());
        m.put("invoiceNumber", p.getInvoice() != null ? p.getInvoice().getInvoiceNumber() : null);
        return m;
    }

    private Map<String, Object> customerFullProfile(Customer c) {
        List<Map<String, Object>> history = salesInvoiceRepository.findByCustomerIdWithItems(c.getCustomerId()).stream()
                .sorted(java.util.Comparator.comparing(SalesInvoice::getSaleDateTime).reversed())
                .map(billingService::toSummary).toList();
        BigDecimal totalSpend = history.stream().map(h -> (BigDecimal) h.get("grandTotal"))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, Object> profile = new HashMap<>();
        profile.put("customer", c);
        profile.put("purchaseHistory", history);
        profile.put("totalSpend", totalSpend);
        profile.put("paymentHistory", paymentRepository.findByCustomerId(c.getCustomerId()).stream()
                .map(CustomerController::paymentRow).toList());
        profile.put("remainingBalance", c.getRemainingBalance());
        profile.put("prescriptions", prescriptionRepository.findByCustomer_CustomerIdOrderByCreatedAtDesc(c.getCustomerId())
                .stream().map(PrescriptionController::toRow).toList());
        return profile;
    }
}
