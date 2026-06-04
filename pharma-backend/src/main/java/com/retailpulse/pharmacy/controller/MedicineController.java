package com.retailpulse.pharmacy.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.service.ProductService;

@RestController
@RequestMapping("/api/medicines")
public class MedicineController {

    private final ProductService productService;

    public MedicineController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public ResponseEntity<List<Product>> getAllMedicines(@RequestParam(name = "search", required = false) String search) {
        if (search == null || search.trim().isEmpty()) {
            return ResponseEntity.ok(productService.getAllProducts());
        }
        return ResponseEntity.ok(productService.searchProductsByName(search));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Product createMedicine(@RequestBody Product medicine) {
        return productService.saveOrUpdateProduct(medicine);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Product> getMedicine(@PathVariable Long id) {
        return productService.getProductById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Product> updateMedicine(@PathVariable Long id, @RequestBody Product medicineDetails) {
        medicineDetails.setProductId(id);
        return ResponseEntity.ok(productService.saveOrUpdateProduct(medicineDetails));
    }
}
