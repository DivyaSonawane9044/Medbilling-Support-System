package com.retailpulse.pharmacy.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.service.ProductService;

@RestController
@RequestMapping("/api/products")
public class ProductController {

	private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Product createProduct(@RequestBody Product product) {
        return productService.saveOrUpdateProduct(product);
    }

   
    @GetMapping
    public List<Product> getAllProducts(@RequestParam(name = "search", required = false) String search) {
        if (search == null || search.trim().isEmpty()) {
            return productService.getAllProducts();
        }
        return productService.searchProductsByName(search.trim());
    }

  
    @GetMapping("/{id}")
    public ResponseEntity<Product> getProductById(@PathVariable Long id) {
        return productService.getProductById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

  
    @PutMapping("/{id}")
    public ResponseEntity<Product> updateProduct(@PathVariable Long id, @RequestBody Product productDetails) {
       
        productDetails.setProductId(id); 
        
       
        Product updatedProduct = productService.saveOrUpdateProduct(productDetails);
        return ResponseEntity.ok(updatedProduct);
    }

    
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        productService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }

    // New: Suggest alternatives based on composition
    @GetMapping("/{id}/alternatives")
    public ResponseEntity<java.util.List<Product>> getAlternatives(@PathVariable Long id) {
        return ResponseEntity.ok(productService.getAlternatives(id));
    }
}
