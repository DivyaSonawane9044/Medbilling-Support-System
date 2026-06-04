package com.retailpulse.pharmacy.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.model.Prescription;
import com.retailpulse.pharmacy.repositories.CustomerRepository;
import com.retailpulse.pharmacy.repositories.PrescriptionRepository;

@RestController
@RequestMapping("/api/prescriptions")
public class PrescriptionController {

    private final PrescriptionRepository prescriptionRepository;
    private final CustomerRepository customerRepository;

    public PrescriptionController(PrescriptionRepository prescriptionRepository, CustomerRepository customerRepository) {
        this.prescriptionRepository = prescriptionRepository;
        this.customerRepository = customerRepository;
    }

    @GetMapping
    public List<Prescription> getAll() {
        return prescriptionRepository.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Prescription save(@RequestBody Map<String, Object> body) {
        Prescription p = new Prescription();
        p.setMedicineName(body.get("medicineName") != null ? body.get("medicineName").toString() : "");
        p.setMorning(toBool(body.get("morning")));
        p.setAfternoon(toBool(body.get("afternoon")));
        p.setEvening(toBool(body.get("evening")));
        p.setNight(toBool(body.get("night")));
        if (body.get("instructions") != null) {
            p.setInstructions(body.get("instructions").toString());
        }
        if (body.get("customerId") != null) {
            Long cid = Long.parseLong(body.get("customerId").toString());
            customerRepository.findById(cid).ifPresent(p::setCustomer);
        }
        return prescriptionRepository.save(p);
    }

    private static boolean toBool(Object value) {
        if (value instanceof Boolean b) {
            return b;
        }
        return value != null && Boolean.parseBoolean(value.toString());
    }
}
