package com.retailpulse.pharmacy.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.razorpay.RazorpayException;
import com.retailpulse.pharmacy.dto.CreateOrderResponseDTO;
import com.retailpulse.pharmacy.exception.ApiException;
import com.retailpulse.pharmacy.model.Customer;
import com.retailpulse.pharmacy.model.Payment;
import com.retailpulse.pharmacy.model.SalesInvoice;
import com.retailpulse.pharmacy.repositories.CustomerRepository;
import com.retailpulse.pharmacy.repositories.PaymentRepository;
import com.retailpulse.pharmacy.repositories.SalesInvoiceRepository;

/**
 * All money-in goes through here so an invoice can never be paid more than its
 * grand total and customer balances stay consistent with recorded payments.
 */
@Service
public class PaymentService {

    public static final String SUCCESS = "SUCCESS";
    public static final String CREATED = "CREATED";
    public static final String FAILED = "FAILED";

    private final PaymentRepository paymentRepository;
    private final SalesInvoiceRepository invoiceRepository;
    private final CustomerRepository customerRepository;
    private final RazorpayService razorpayService;

    public PaymentService(PaymentRepository paymentRepository, SalesInvoiceRepository invoiceRepository,
            CustomerRepository customerRepository, RazorpayService razorpayService) {
        this.paymentRepository = paymentRepository;
        this.invoiceRepository = invoiceRepository;
        this.customerRepository = customerRepository;
        this.razorpayService = razorpayService;
    }

    public BigDecimal outstanding(SalesInvoice invoice) {
        BigDecimal paid = paymentRepository.sumSuccessfulForInvoice(invoice.getInvoiceId());
        return nz(invoice.getGrandTotal()).subtract(nz(paid)).max(BigDecimal.ZERO);
    }

    /** Used by billing at the counter; the caller has already validated the amount. */
    @Transactional
    public Payment recordSuccess(SalesInvoice invoice, Customer customer, BigDecimal amount, String method, String ref) {
        Payment p = new Payment();
        p.setInvoice(invoice);
        p.setCustomer(customer);
        p.setAmountPaid(amount);
        p.setPaymentMethod(method);
        p.setPaymentStatus(SUCCESS);
        p.setTransactionReference(ref);
        return paymentRepository.save(p);
    }

    /** Cash/UPI/card collected later against an invoice. {@code amount} null means the full outstanding. */
    @Transactional
    public Payment recordInvoicePayment(Long invoiceId, BigDecimal amount, String method) {
        SalesInvoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> ApiException.notFound("Invoice not found: " + invoiceId));
        BigDecimal due = outstanding(invoice);
        if (due.signum() == 0) {
            throw ApiException.conflict("Invoice " + invoice.getInvoiceNumber() + " is already fully paid");
        }
        BigDecimal pay = amount == null ? due : amount.setScale(2, RoundingMode.HALF_UP);
        if (pay.signum() <= 0) {
            throw ApiException.badRequest("Payment amount must be greater than zero");
        }
        if (pay.compareTo(due) > 0) {
            throw ApiException.badRequest("Payment of " + pay + " exceeds the outstanding amount " + due);
        }
        String m = method == null || method.isBlank() ? "Cash" : method.trim();
        if ("RAZORPAY".equalsIgnoreCase(m)) {
            throw ApiException.badRequest("Razorpay payments must go through checkout and signature verification");
        }
        Payment p = recordSuccess(invoice, invoice.getCustomer(), pay, m, m.toUpperCase() + "-" + System.currentTimeMillis());
        reduceCustomerBalance(invoice.getCustomer(), pay);
        return p;
    }

    /** Settles part of a customer's running credit balance (not tied to one invoice). */
    @Transactional
    public Payment recordCustomerBalancePayment(Long customerId, BigDecimal amount, String method) {
        Customer c = customerRepository.findById(customerId)
                .orElseThrow(() -> ApiException.notFound("Customer not found: " + customerId));
        if (amount == null || amount.signum() <= 0) {
            throw ApiException.badRequest("Payment amount must be greater than zero");
        }
        BigDecimal pay = amount.setScale(2, RoundingMode.HALF_UP);
        BigDecimal balance = nz(c.getRemainingBalance());
        if (pay.compareTo(balance) > 0) {
            throw ApiException.badRequest("Payment of " + pay + " exceeds the outstanding balance " + balance);
        }
        Payment p = new Payment();
        p.setCustomer(c);
        p.setAmountPaid(pay);
        p.setPaymentMethod(method == null || method.isBlank() ? "Cash" : method.trim());
        p.setPaymentStatus(SUCCESS);
        p.setTransactionReference("BAL-" + System.currentTimeMillis());
        paymentRepository.save(p);
        c.setRemainingBalance(balance.subtract(pay));
        customerRepository.save(c);
        return p;
    }

    /** Creates a Razorpay order for the invoice's outstanding amount; the client never sets the amount. */
    @Transactional
    public CreateOrderResponseDTO createRazorpayOrder(Long invoiceId) {
        if (!razorpayService.isConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Online payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
        }
        SalesInvoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> ApiException.notFound("Invoice not found: " + invoiceId));
        BigDecimal due = outstanding(invoice);
        if (due.signum() == 0) {
            throw ApiException.conflict("Invoice " + invoice.getInvoiceNumber() + " is already fully paid");
        }
        CreateOrderResponseDTO order;
        try {
            order = razorpayService.createOrder(due, invoice.getInvoiceNumber());
        } catch (RazorpayException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Razorpay rejected the order: " + e.getMessage());
        }
        Payment pending = new Payment();
        pending.setInvoice(invoice);
        pending.setCustomer(invoice.getCustomer());
        pending.setAmountPaid(due);
        pending.setPaymentMethod("RAZORPAY");
        pending.setPaymentStatus(CREATED);
        pending.setRazorpayOrderId(order.getOrderId());
        paymentRepository.save(pending);
        order.setInvoiceId(invoice.getInvoiceId());
        return order;
    }

    /**
     * Verifies the checkout signature server-side; only then is the payment marked SUCCESS.
     * A rejected verification still commits the FAILED status (noRollbackFor) as an audit trail.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public Payment verifyRazorpayPayment(String orderId, String paymentId, String signature) {
        if (orderId == null || paymentId == null || signature == null) {
            throw ApiException.badRequest("razorpay_order_id, razorpay_payment_id and razorpay_signature are required");
        }
        Payment p = paymentRepository.findByRazorpayOrderId(orderId)
                .orElseThrow(() -> ApiException.notFound("Unknown Razorpay order: " + orderId));
        if (SUCCESS.equals(p.getPaymentStatus())) {
            return p; // already verified (e.g. client retried)
        }
        if (!razorpayService.verifyPaymentSignature(orderId, paymentId, signature)) {
            p.setPaymentStatus(FAILED);
            p.setTransactionReference(paymentId);
            paymentRepository.save(p);
            throw ApiException.badRequest("Payment signature verification failed");
        }
        BigDecimal due = outstanding(p.getInvoice());
        if (p.getAmountPaid().compareTo(due) > 0) {
            // Invoice was settled another way while checkout was open; keep a trace for refund.
            p.setPaymentStatus(FAILED);
            p.setTransactionReference(paymentId + " (duplicate - refund required)");
            paymentRepository.save(p);
            throw ApiException.conflict("Invoice was already paid; this Razorpay payment needs a refund");
        }
        p.setPaymentStatus(SUCCESS);
        p.setTransactionReference(paymentId);
        paymentRepository.save(p);
        reduceCustomerBalance(p.getInvoice().getCustomer(), p.getAmountPaid());
        return p;
    }

    /** Records a checkout failure/cancellation reported by the Razorpay widget. */
    @Transactional
    public void markRazorpayFailed(String orderId, String reason) {
        Payment p = paymentRepository.findByRazorpayOrderId(orderId)
                .orElseThrow(() -> ApiException.notFound("Unknown Razorpay order: " + orderId));
        if (CREATED.equals(p.getPaymentStatus())) {
            p.setPaymentStatus(FAILED);
            p.setTransactionReference(reason == null ? "failed" : reason.substring(0, Math.min(reason.length(), 200)));
            paymentRepository.save(p);
        }
    }

    private void reduceCustomerBalance(Customer c, BigDecimal amount) {
        if (c == null) {
            return;
        }
        c.setRemainingBalance(nz(c.getRemainingBalance()).subtract(amount).max(BigDecimal.ZERO));
        customerRepository.save(c);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
