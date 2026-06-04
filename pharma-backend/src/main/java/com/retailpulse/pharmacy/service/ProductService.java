package com.retailpulse.pharmacy.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.repositories.ProductRepository;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    
    @Autowired
    private com.retailpulse.pharmacy.repositories.InventoryBatchRepository batchRepository;
    
    // Dependency Injection via Constructor (Preferred method in Spring)
    @Autowired
    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    // CRUD: Create/Update
    public Product saveOrUpdateProduct(Product product) {
        if (product.getHsnCode() == null || product.getHsnCode().trim().isEmpty()) {
            throw new IllegalArgumentException("HSN code cannot be empty");
        }
        if (product.getStripSize() == null || product.getStripSize() <= 0) {
            throw new IllegalArgumentException("Strip size must be greater than 0");
        }
        if (product.getPrice() == null || product.getPrice().compareTo(java.math.BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Price must be greater than zero");
        }
        if (product.getQuantity() == null || product.getQuantity() < 0) {
            product.setQuantity(0);
        }
        if (product.getPrice() != null && product.getProfitMargin() == null) {
            product.setProfitMargin(new java.math.BigDecimal("15.00"));
        }
        return productRepository.save(product);
    }

    // CRUD: Read all (for Product Master list)
    public List<Product> getAllProducts() {
        // Feature 1: Alphabetical arrangement of medicines 
        return productRepository.findAllByOrderByNameAsc(); 
    }

    public List<Product> searchProductsByCompany(String companyName) {
        return productRepository.findByCompanyContainingIgnoreCase(companyName);
    }
    
    public List<Product> searchProductsByName(String name) {
        if (name == null || name.trim().isEmpty()) {
            return getAllProducts();
        }
        return productRepository.findByNameContainingIgnoreCaseOrCompanyContainingIgnoreCaseOrGenericNameContainingIgnoreCase(
            name,
            name,
            name
        );
    }

    // CRUD: Read by ID
    public Optional<Product> getProductById(Long id) {
        return productRepository.findById(id);
    }

    // CRUD: Delete
    public void deleteProduct(Long id) {
        productRepository.deleteById(id);
    }

    /**
     * Finds alternative products with the same drug (generic name) or composition 
     * that are currently in stock.
     */
    public List<Product> getAlternatives(Long productId) {
        Product currentProduct = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found"));

        String genericName = currentProduct.getGenericName();
        String composition = currentProduct.getComposition();
        
        java.util.Set<Product> alternativesSet = new java.util.HashSet<>();

        // 1. Search by Generic Name (Exact Drug Match)
        if (genericName != null && !genericName.trim().isEmpty()) {
            alternativesSet.addAll(productRepository.findByGenericNameContainingIgnoreCase(genericName));
        }

        // 2. Search by Composition (Contains same ingredients)
        if (composition != null && !composition.trim().isEmpty()) {
            alternativesSet.addAll(productRepository.findByCompositionContainingIgnoreCase(composition));
        }

        // Filter: 
        // 1. Exclude the current product
        // 2. Only include products that have at least some stock available
        return alternativesSet.stream()
                .filter(p -> !p.getProductId().equals(productId))
                .filter(this::isProductInStock)
                .collect(java.util.stream.Collectors.toList());
    }

    private boolean isProductInStock(Product product) {
        // Check if any non-expired batch has stock
        List<com.retailpulse.pharmacy.model.InventoryBatch> batches = batchRepository.findAllBatchesForProductForSale(product.getProductId());
        return !batches.isEmpty();
    }
}
