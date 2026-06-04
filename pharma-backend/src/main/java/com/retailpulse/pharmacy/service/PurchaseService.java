// retailpulse-backend/src/main/java/com/retailpulse/pharmacy/service/PurchaseService.java
package com.retailpulse.pharmacy.service;

import com.retailpulse.pharmacy.dto.PurchaseRequestDTO;
import com.retailpulse.pharmacy.dto.BatchItemDTO;
import com.retailpulse.pharmacy.model.*;
import com.retailpulse.pharmacy.repositories.InventoryBatchRepository;
import com.retailpulse.pharmacy.repositories.ProductRepository;
import com.retailpulse.pharmacy.repositories.PurchaseInvoiceRepository;
import com.retailpulse.pharmacy.repositories.SupplierRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.math.BigDecimal; // Used for financial data

@Service
public class PurchaseService {

    private final PurchaseInvoiceRepository invoiceRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final InventoryBatchRepository batchRepository;

    // Constructor Injection for Dependencies
    @Autowired
    public PurchaseService(
        PurchaseInvoiceRepository invoiceRepository,
        SupplierRepository supplierRepository,
        ProductRepository productRepository,
        InventoryBatchRepository batchRepository) {
        
        this.invoiceRepository = invoiceRepository;
        this.supplierRepository = supplierRepository;
        this.productRepository = productRepository;
        this.batchRepository = batchRepository;
    }

    
    @Transactional
    public PurchaseInvoice createPendingOrder(PurchaseRequestDTO dto) {
        Supplier supplier = supplierRepository.findById(dto.getSupplierId())
                .orElseThrow(() -> new RuntimeException("Supplier not found: " + dto.getSupplierId()));
        PurchaseInvoice invoice = new PurchaseInvoice();
        invoice.setSupplier(supplier);
        invoice.setInvoiceNumber(dto.getInvoiceNumber());
        invoice.setPurchaseDate(dto.getPurchaseDate() != null ? dto.getPurchaseDate() : java.time.LocalDate.now());
        invoice.setTotalAmount(dto.getTotalAmount() != null ? dto.getTotalAmount() : java.math.BigDecimal.ZERO);
        invoice.setStatus("PENDING");
        return invoiceRepository.save(invoice);
    }

    @Transactional
    public PurchaseInvoice processSupplierInvoice(PurchaseRequestDTO dto) {
        
        // 1. Fetch and Validate Supplier
        Optional<Supplier> supplierOpt = supplierRepository.findById(dto.getSupplierId());
        if (supplierOpt.isEmpty()) {
            throw new RuntimeException("Error: Supplier not found with ID: " + dto.getSupplierId());
        }
        Supplier supplier = supplierOpt.get();

        // 2. Create or load Purchase Invoice Header
        PurchaseInvoice invoice;
        if (dto.getPurchaseInvoiceId() != null) {
            invoice = invoiceRepository.findById(dto.getPurchaseInvoiceId())
                    .orElseThrow(() -> new RuntimeException("Purchase invoice not found"));
            invoice.setStatus("RECEIVED");
            if (dto.getTotalAmount() != null) invoice.setTotalAmount(dto.getTotalAmount());
        } else {
            invoice = new PurchaseInvoice();
            invoice.setInvoiceNumber(dto.getInvoiceNumber());
            invoice.setPurchaseDate(dto.getPurchaseDate());
            invoice.setSupplier(supplier);
            invoice.setTotalAmount(dto.getTotalAmount());
            invoice.setStatus("RECEIVED");
        }
        
        // 3. Process Batch Items, Create Inventory Batches, and establish relationships
        for (BatchItemDTO itemDto : dto.getBatchItems()) {
            Optional<Product> productOpt = productRepository.findById(itemDto.getProductId());
            if (productOpt.isEmpty()) {
                throw new RuntimeException("Error: Product not found with ID: " + itemDto.getProductId());
            }
            Product product = productOpt.get();
            
            // Create the new Inventory Batch record
            InventoryBatch batch = createInventoryBatch(itemDto, product, supplier, invoice);
            
            // Link the batch to the invoice (manages the bidirectional relationship)
            invoice.addBatch(batch); 
        }

        // 4. Save the Invoice (CascadeType.ALL ensures all linked InventoryBatches are saved automatically)
        PurchaseInvoice savedInvoice = invoiceRepository.save(invoice);

        // 5. Update Supplier Ledger (Feature 3: Supplier ledger & payment tracking)
        // Add the invoice total to the supplier's outstanding balance.
        BigDecimal newLedgerBalance = supplier.getLedgerBalance().add(dto.getTotalAmount());
        supplier.setLedgerBalance(newLedgerBalance);
        supplierRepository.save(supplier);

        return savedInvoice;
    }
    
    /**
     * Helper method to map DTO fields to the InventoryBatch entity.
     */
    private InventoryBatch createInventoryBatch(
        BatchItemDTO itemDto, Product product, Supplier supplier, PurchaseInvoice invoice) {
        
        InventoryBatch batch = new InventoryBatch();
        batch.setProduct(product);
        batch.setSupplier(supplier);
        batch.setPurchaseInvoice(invoice);
        
        // Batch details
        batch.setBatchNumber(itemDto.getBatchNumber());
        batch.setMfgDate(itemDto.getMfgDate());
        batch.setExpiryDate(itemDto.getExpiryDate());
        
        // Pricing details (Feature 10: Product Master & Pricing)
        batch.setMrp(itemDto.getMrp());
        batch.setCostPrice(itemDto.getCostPrice());
        batch.setSellingPrice(itemDto.getSellingPrice());
        
        // Stock Update (Feature 1: Strip quantity tracked)
        batch.setStripStock(itemDto.getStripQuantity());
        batch.setTabletStock(0); // Assume tablets are tracked separately on sales, but initial receipt is in strips
        
        return batch;
    }
}