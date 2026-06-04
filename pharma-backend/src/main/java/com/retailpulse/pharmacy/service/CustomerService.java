// retailpulse-backend/src/main/java/com/retailpulse/pharmacy/service/CustomerService.java
package com.retailpulse.pharmacy.service;

import com.retailpulse.pharmacy.model.Customer;
import com.retailpulse.pharmacy.repositories.CustomerRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    public Customer saveCustomer(Customer customer) {
        return customerRepository.save(customer);
    }

    // Feature 7: Customer Lookup Logic
    public List<Customer> searchCustomersByName(String name) {
        // Returns a list to display options to the pharmacist
        return customerRepository.findByNameContainingIgnoreCase(name);
    }

    public Optional<Customer> getCustomerById(Long id) {
        return customerRepository.findById(id);
    }

    public List<Customer> searchCustomersByContactNumber(String contactNumber) {
        return customerRepository.findByContactNumberContaining(contactNumber);
    }
}
