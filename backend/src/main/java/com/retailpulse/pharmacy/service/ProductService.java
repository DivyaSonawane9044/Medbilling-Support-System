package com.retailpulse.pharmacy.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.retailpulse.pharmacy.dto.ProductRequestDTO;
import com.retailpulse.pharmacy.exception.ApiException;
import com.retailpulse.pharmacy.model.InventoryBatch;
import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.repositories.InventoryBatchRepository;
import com.retailpulse.pharmacy.repositories.ProductRepository;
import com.retailpulse.pharmacy.repositories.SalesInvoiceRepository;

@Service
public class ProductService {

    private static final BigDecimal MAX_GST = new BigDecimal("28");

    private final ProductRepository productRepository;
    private final InventoryBatchRepository batchRepository;
    private final SalesInvoiceRepository salesInvoiceRepository;
    private final StockService stockService;

    public ProductService(ProductRepository productRepository, InventoryBatchRepository batchRepository,
            SalesInvoiceRepository salesInvoiceRepository, StockService stockService) {
        this.productRepository = productRepository;
        this.batchRepository = batchRepository;
        this.salesInvoiceRepository = salesInvoiceRepository;
        this.stockService = stockService;
    }

    @Transactional
    public Product create(ProductRequestDTO req) {
        Product p = new Product();
        apply(p, req);
        validate(p, null);
        p.setQuantity(0);
        Product saved = productRepository.save(p);

        int opening = req.getOpeningQuantity() == null ? 0 : req.getOpeningQuantity();
        if (opening < 0) {
            throw ApiException.badRequest("Opening stock cannot be negative");
        }
        if (opening > 0) {
            createOpeningBatch(saved, req, opening);
            stockService.refreshProductQuantity(saved);
        }
        return saved;
    }

    /** Updates master data only. Stock (quantity) is ignored here by design. */
    @Transactional
    public Product update(Long id, ProductRequestDTO req) {
        Product p = productRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Product not found: " + id));
        apply(p, req);
        validate(p, id);
        return productRepository.save(p);
    }

    public List<Product> getAllProducts() {
        return productRepository.findAllByOrderByNameAsc();
    }

    public List<Product> searchProductsByName(String name) {
        if (name == null || name.trim().isEmpty()) {
            return getAllProducts();
        }
        String q = name.trim();
        return productRepository
                .findByNameContainingIgnoreCaseOrCompanyContainingIgnoreCaseOrGenericNameContainingIgnoreCase(q, q, q);
    }

    public Optional<Product> getProductById(Long id) {
        return productRepository.findById(id);
    }

    /** Products with stock or sales history are kept for traceability (GST, batch recalls). */
    @Transactional
    public void deleteProduct(Long id) {
        Product p = productRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Product not found: " + id));
        if (salesInvoiceRepository.productHasSales(id)) {
            throw ApiException.conflict("Cannot delete " + p.getName() + ": it appears on sales invoices");
        }
        if (batchRepository.existsByProduct_ProductId(id)) {
            throw ApiException.conflict("Cannot delete " + p.getName()
                    + ": it has inventory batches. Return or write off the stock first.");
        }
        productRepository.delete(p);
    }

    /** Products with the same generic name or composition that have sellable stock. */
    public List<Product> getAlternatives(Long productId) {
        Product current = productRepository.findById(productId)
                .orElseThrow(() -> ApiException.notFound("Product not found: " + productId));
        java.util.Set<Product> found = new java.util.LinkedHashSet<>();
        if (current.getGenericName() != null && !current.getGenericName().isBlank()) {
            found.addAll(productRepository.findByGenericNameContainingIgnoreCase(current.getGenericName()));
        }
        if (current.getComposition() != null && !current.getComposition().isBlank()) {
            found.addAll(productRepository.findByCompositionContainingIgnoreCase(current.getComposition()));
        }
        return found.stream()
                .filter(p -> !p.getProductId().equals(productId))
                .filter(p -> !batchRepository.findAllBatchesForProductForSale(p.getProductId()).isEmpty())
                .toList();
    }

    private void apply(Product p, ProductRequestDTO r) {
        p.setName(trim(r.getName()));
        p.setGenericName(trim(r.getGenericName()));
        p.setCompany(trim(r.getCompany()));
        p.setComposition(trim(r.getComposition()));
        p.setHsnCode(trim(r.getHsnCode()));
        p.setStripSize(r.getStripSize());
        p.setScheduleDrugType(trim(r.getScheduleDrugType()));
        p.setDosageForm(trim(r.getDosageForm()));
        p.setUnitType(trim(r.getUnitType()));
        p.setVolumeMl(r.getVolumeMl());
        p.setWeightGm(r.getWeightGm());
        p.setReorderLevel(r.getReorderLevel() == null ? 0 : r.getReorderLevel());
        p.setTargetStockLevel(r.getTargetStockLevel());
        p.setPrice(r.getPrice());
        p.setProfitMargin(r.getProfitMargin());
        p.setGstRate(r.getGstRate() == null ? new BigDecimal("12.00") : r.getGstRate());
        String barcode = trim(r.getBarcode());
        p.setBarcode(barcode == null || barcode.isEmpty() ? null : barcode);
    }

    private void validate(Product p, Long selfId) {
        if (p.getName() == null || p.getName().isEmpty()) {
            throw ApiException.badRequest("Medicine name is required");
        }
        if (p.getHsnCode() == null || p.getHsnCode().isEmpty()) {
            throw ApiException.badRequest("HSN code is required");
        }
        if (p.getStripSize() == null || p.getStripSize() <= 0) {
            throw ApiException.badRequest("Strip size must be greater than 0");
        }
        if (p.getPrice() == null || p.getPrice().signum() <= 0) {
            throw ApiException.badRequest("Selling price must be greater than zero");
        }
        if (p.getReorderLevel() < 0 || (p.getTargetStockLevel() != null && p.getTargetStockLevel() < 0)) {
            throw ApiException.badRequest("Stock levels cannot be negative");
        }
        if (p.getGstRate().signum() < 0 || p.getGstRate().compareTo(MAX_GST) > 0) {
            throw ApiException.badRequest("GST rate must be between 0 and 28 percent");
        }
        boolean nameTaken = productRepository.findAllByNameIgnoreCase(p.getName()).stream()
                .anyMatch(o -> !o.getProductId().equals(selfId));
        if (nameTaken) {
            throw ApiException.conflict("A medicine named '" + p.getName() + "' already exists");
        }
        if (p.getBarcode() != null) {
            productRepository.findByBarcode(p.getBarcode())
                    .filter(o -> !o.getProductId().equals(selfId))
                    .ifPresent(o -> {
                        throw ApiException.conflict("Barcode " + p.getBarcode() + " is already used by " + o.getName());
                    });
        }
    }

    private void createOpeningBatch(Product product, ProductRequestDTO r, int units) {
        if (r.getExpiryDate() == null || !r.getExpiryDate().isAfter(LocalDate.now())) {
            throw ApiException.badRequest("Opening stock needs a future expiry date");
        }
        BigDecimal mrp = r.getMrp() != null ? r.getMrp() : product.getPrice();
        if (product.getPrice().compareTo(mrp) > 0) {
            throw ApiException.badRequest("Selling price cannot be more than MRP");
        }
        if (r.getCostPrice() == null || r.getCostPrice().signum() <= 0) {
            throw ApiException.badRequest("Cost price is required for opening stock");
        }
        InventoryBatch b = new InventoryBatch();
        b.setProduct(product);
        b.setBatchNumber(r.getBatchNumber() == null || r.getBatchNumber().isBlank()
                ? "OPENING-" + product.getProductId() : r.getBatchNumber().trim());
        b.setMfgDate(r.getMfgDate() != null ? r.getMfgDate() : LocalDate.now());
        b.setExpiryDate(r.getExpiryDate());
        b.setMrp(mrp);
        b.setCostPrice(r.getCostPrice());
        b.setSellingPrice(product.getPrice());
        StockService.setUnits(b, units);
        batchRepository.save(b);
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }
}
