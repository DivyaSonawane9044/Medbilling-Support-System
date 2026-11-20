package com.retailpulse.pharmacy.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.exception.ApiException;
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
    public List<Map<String, Object>> getAll(@RequestParam(required = false) Long customerId) {
        List<Prescription> list = customerId == null
                ? prescriptionRepository.findAllByOrderByCreatedAtDesc()
                : prescriptionRepository.findByCustomer_CustomerIdOrderByCreatedAtDesc(customerId);
        return list.stream().map(PrescriptionController::toRow).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> save(@RequestBody Map<String, Object> body) {
        Object name = body.get("medicineName");
        if (name == null || name.toString().isBlank()) {
            throw ApiException.badRequest("Medicine name is required");
        }
        Prescription p = new Prescription();
        p.setMedicineName(name.toString().trim());
        p.setMorning(toBool(body.get("morning")));
        p.setAfternoon(toBool(body.get("afternoon")));
        p.setEvening(toBool(body.get("evening")));
        p.setNight(toBool(body.get("night")));
        if (body.get("instructions") != null) {
            p.setInstructions(body.get("instructions").toString());
        }
        if (body.get("customerId") != null && !body.get("customerId").toString().isBlank()) {
            Long cid = PaymentController.requiredLong(body, "customerId");
            p.setCustomer(customerRepository.findById(cid)
                    .orElseThrow(() -> ApiException.notFound("Customer not found: " + cid)));
        }
        return toRow(prescriptionRepository.save(p));
    }

    static Map<String, Object> toRow(Prescription p) {
        Map<String, Object> m = new HashMap<>();
        m.put("prescriptionId", p.getPrescriptionId());
        m.put("customerId", p.getCustomer() != null ? p.getCustomer().getCustomerId() : null);
        m.put("customerName", p.getCustomer() != null ? p.getCustomer().getName() : null);
        m.put("medicineName", p.getMedicineName());
        m.put("morning", p.getMorning());
        m.put("afternoon", p.getAfternoon());
        m.put("evening", p.getEvening());
        m.put("night", p.getNight());
        m.put("instructions", p.getInstructions());
        m.put("createdAt", p.getCreatedAt());
        return m;
    }

    private static boolean toBool(Object value) {
        if (value instanceof Boolean b) {
            return b;
        }
        return value != null && Boolean.parseBoolean(value.toString());
    }
}
