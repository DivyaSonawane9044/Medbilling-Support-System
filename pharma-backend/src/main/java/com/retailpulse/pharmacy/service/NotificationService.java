package com.retailpulse.pharmacy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.retailpulse.pharmacy.model.Customer;
import com.retailpulse.pharmacy.model.SalesInvoice;

@Service
public class NotificationService {

    private static final Logger logger = LoggerFactory.getLogger(NotificationService.class);

    /**
     * Feature 4 & 8: Mock sending SMS bill/alert
     */
    public void sendBillViaSms(Customer customer, SalesInvoice invoice) {
        if (customer.getContactNumber() == null || customer.getContactNumber().isEmpty()) {
            logger.warn("Cannot send SMS: No contact number for customer {}", customer.getName());
            return;
        }
        
        String message = String.format("Dear %s, your bill %s for Rs. %.2f has been generated at RetailPulse Pharmacy.", 
            customer.getName(), invoice.getInvoiceNumber(), invoice.getGrandTotal());
            
        // TODO: Integrate Twilio or similar SMS API here
        logger.info("Mock SMS sent to {}: {}", customer.getContactNumber(), message);
    }

    /**
     * Feature 4: Mock sending WhatsApp bill with PDF link or details
     */
    public void sendBillViaWhatsApp(Customer customer, SalesInvoice invoice) {
        if (customer.getContactNumber() == null || customer.getContactNumber().isEmpty()) {
            logger.warn("Cannot send WhatsApp: No contact number for customer {}", customer.getName());
            return;
        }
        
        String message = String.format("Hello %s! Thank you for visiting RetailPulse Pharmacy. Your invoice %s of Rs. %.2f is attached.", 
            customer.getName(), invoice.getInvoiceNumber(), invoice.getGrandTotal());
            
        // TODO: Integrate WhatsApp Business API (e.g., Twilio/Meta) here
        logger.info("Mock WhatsApp message sent to {}: {}", customer.getContactNumber(), message);
    }

    /**
     * Feature 8: Low stock or near expiry notifications
     */
    public void sendAdminAlert(String subject, String message) {
        // TODO: Send email/SMS to admin/pharmacist
        logger.info("ADMIN ALERT [{}]: {}", subject, message);
    }
}
