package com.retailpulse.pharmacy.repositories;

import com.retailpulse.pharmacy.model.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    // Feature 7: Customer Lookup - Find customers whose name starts with the given string.
    // This supports the "full patient details when the first name is entered" requirement.
    List<Customer> findByNameContainingIgnoreCase(String name);

    // Find by exact name match for quick identification
    Optional<Customer> findByNameIgnoreCase(String name);

    // Feature 7: Customer lookup by contact number
    List<Customer> findByContactNumberContaining(String contactNumber);

    List<Customer> findByNameStartingWithIgnoreCase(String prefix);

    List<Customer> findAllByNameIgnoreCase(String name);

    List<Customer> findAllByNameIgnoreCaseAndContactNumber(String name, String contactNumber);
}
