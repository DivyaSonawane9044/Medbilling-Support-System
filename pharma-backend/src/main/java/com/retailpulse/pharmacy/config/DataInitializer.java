package com.retailpulse.pharmacy.config;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import com.retailpulse.pharmacy.model.Customer;
import com.retailpulse.pharmacy.model.InventoryBatch;
import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.model.PurchaseInvoice;
import com.retailpulse.pharmacy.model.SalesInvoice;
import com.retailpulse.pharmacy.model.SalesInvoiceItem;
import com.retailpulse.pharmacy.model.Supplier;
import com.retailpulse.pharmacy.repositories.CustomerRepository;
import com.retailpulse.pharmacy.repositories.ProductRepository;
import com.retailpulse.pharmacy.repositories.PurchaseInvoiceRepository;
import com.retailpulse.pharmacy.repositories.SalesInvoiceRepository;
import com.retailpulse.pharmacy.repositories.SupplierRepository;

@Component
public class DataInitializer implements CommandLineRunner {

    private final ProductRepository productRepository;
    private final SupplierRepository supplierRepository;
    private final CustomerRepository customerRepository;
    private final PurchaseInvoiceRepository purchaseInvoiceRepository;
    private final SalesInvoiceRepository salesInvoiceRepository;

    public DataInitializer(ProductRepository productRepository,
                           SupplierRepository supplierRepository,
                           CustomerRepository customerRepository,
                           PurchaseInvoiceRepository purchaseInvoiceRepository,
                           SalesInvoiceRepository salesInvoiceRepository) {
        this.productRepository = productRepository;
        this.supplierRepository = supplierRepository;
        this.customerRepository = customerRepository;
        this.purchaseInvoiceRepository = purchaseInvoiceRepository;
        this.salesInvoiceRepository = salesInvoiceRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        if (supplierRepository.count() == 0 && customerRepository.count() == 0 && productRepository.count() == 0) {
            initializeData();
        }
    }

    private void initializeData() {
        String[] customerFirstNames = {
            "Priya", "Rahul", "Anita", "Vikram", "Meera", "Arjun", "Kavita", "Suresh", "Deepa", "Rohan",
            "Neha", "Amit", "Pooja", "Sanjay", "Lakshmi", "Karan", "Divya", "Manish", "Sunita", "Aditya",
            "Rekha", "Nitin", "Shreya", "Gaurav", "Anjali", "Harish", "Swati", "Varun", "Nisha", "Rakesh"
        };
        String[] customerLastNames = {
            "Sharma", "Patel", "Singh", "Kumar", "Reddy", "Nair", "Iyer", "Gupta", "Mehta", "Joshi",
            "Desai", "Rao", "Pillai", "Menon", "Verma", "Agarwal", "Chopra", "Malhotra", "Bhat", "Kulkarni"
        };
        String[] cities = {
            "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Ahmedabad", "Kolkata", "Jaipur", "Lucknow"
        };
        String[] supplierNames = {
            "Sun Pharmaceutical Distributors Pvt Ltd",
            "Cipla Healthcare Wholesale Mumbai",
            "Dr. Reddy's Medical Supplies",
            "Lupin Pharma Distribution Hub",
            "Torrent Pharmaceuticals Wholesale",
            "Abbott India Medical Distributors",
            "Mankind Pharma Supply Chain",
            "Alkem Laboratories Distributors",
            "Glenmark Pharmaceuticals Wholesale",
            "Zydus Lifesciences Distribution",
            "Biocon Pharma Supplies Bengaluru",
            "Cadila Healthcare Distributors",
            "Intas Pharmaceuticals Wholesale",
            "Emcure Pharmaceuticals Supply",
            "Aurobindo Pharma Distributors Delhi",
            "Ipca Laboratories Wholesale",
            "Ajanta Pharma Distribution",
            "Wockhardt Medical Supplies",
            "Pfizer India Pharma Distributors",
            "Novartis Healthcare Wholesale"
        };

        List<Supplier> suppliers = new ArrayList<>();
        for (int i = 1; i <= 100; i++) {
            Supplier s = new Supplier();
            String baseName = supplierNames[(i - 1) % supplierNames.length];
            s.setName(i <= supplierNames.length ? baseName : baseName + " - Branch " + cities[i % cities.length] + " (" + i + ")");
            s.setContactNumber("9" + String.format("%09d", 100000000L + i));
            s.setCompany(s.getName());
            s.setGstIn("27AABCU" + String.format("%04d", i) + "F1Z" + (i % 10));
            s.setLedgerBalance(BigDecimal.ZERO);
            suppliers.add(s);
        }
        supplierRepository.saveAll(suppliers);

        List<Customer> customers = new ArrayList<>();
        for (int i = 1; i <= 100; i++) {
            Customer c = new Customer();
            String fullName = customerFirstNames[(i - 1) % customerFirstNames.length] + " "
                    + customerLastNames[((i * 3) - 1) % customerLastNames.length];
            c.setName(fullName);
            c.setContactNumber("8" + String.format("%09d", 200000000L + i));
            c.setEmail(fullName.toLowerCase().replace(" ", ".") + "@email.com");
            c.setAddress((i % 120) + 1 + ", " + cities[i % cities.length] + ", India");
            c.setDoctorName("Dr. " + customerLastNames[i % customerLastNames.length]);
            customers.add(c);
        }
        customerRepository.saveAll(customers);

        List<Product> products = new ArrayList<>();

        Product aspirin = new Product();
        aspirin.setName("Aspirin");
        aspirin.setGenericName("Acetylsalicylic acid");
        aspirin.setHsnCode("30049090");
        aspirin.setStripSize(10);
        aspirin.setScheduleDrugType("OTC");
        aspirin.setDosageForm("Tablet");
        aspirin.setUnitType("Strip");
        aspirin.setReorderLevel(100);
        aspirin.setTargetStockLevel(500);
        aspirin.setCompany("Pharma Ltd");
        aspirin.setPrice(BigDecimal.valueOf(50.00).setScale(2, RoundingMode.HALF_UP));
        aspirin.setQuantity(1500);
        aspirin.setExpiryDate(LocalDate.now().plusYears(2));
        aspirin.setComposition("Aspirin 500mg");
        aspirin.setProfitMargin(BigDecimal.valueOf(0.20));
        aspirin.setBarcode("ASP001");
        products.add(aspirin);

        Product paracetamol = new Product();
        paracetamol.setName("Paracetamol");
        paracetamol.setGenericName("Paracetamol");
        paracetamol.setHsnCode("29339990");
        paracetamol.setStripSize(15);
        paracetamol.setScheduleDrugType("OTC");
        paracetamol.setDosageForm("Tablet");
        paracetamol.setUnitType("Strip");
        paracetamol.setReorderLevel(150);
        paracetamol.setTargetStockLevel(600);
        paracetamol.setCompany("Healthcare Inc");
        paracetamol.setPrice(BigDecimal.valueOf(45.00).setScale(2, RoundingMode.HALF_UP));
        paracetamol.setQuantity(2000);
        paracetamol.setExpiryDate(LocalDate.now().plusYears(2));
        paracetamol.setComposition("Paracetamol 650mg");
        paracetamol.setProfitMargin(BigDecimal.valueOf(0.25));
        paracetamol.setBarcode("PAR001");
        products.add(paracetamol);

        Random rnd = new Random(42);
        String[] companies = {"PharmaCare", "MediHeal", "CureLife", "NovaPharma", "HealthyPlus", "ZenHealth", "PrimeMeds", "RemedyCorp", "VitalCare", "LifeSpring"};
        String[] generics = {"Paracetamol", "Ibuprofen", "Amoxicillin", "Metformin", "Ciprofloxacin", "Azithromycin", "Cetirizine", "Pantoprazole", "Montelukast", "Levocetirizine", "Ranitidine", "Diclofenac", "Omeprazole", "Amlodipine", "Losartan", "Salbutamol", "Ondansetron", "Loratadine", "Clarithromycin", "Fluconazole", "Telmisartan", "Terbutaline", "Tramadol", "Trimethoprim", "Ursodeoxycholic acid", "Urokinase", "Valsartan", "Vitamin B12", "Vitamin D3", "Vancomycin", "Warfarin", "Xanax", "Yohimbine", "Zinc", "Zidovudine", "Zolpidem"};
        String[] dosageForms = {"Tablet", "Capsule", "Syrup", "Ointment", "Injection", "Drop"};
        String[] strengths = {"100mg", "150mg", "200mg", "250mg", "300mg", "400mg", "500mg", "650mg", "750mg", "1000mg"};

        for (int i = 3; i <= 300; i++) {
            String generic = generics[rnd.nextInt(generics.length)];
            String strength = strengths[rnd.nextInt(strengths.length)];
            String dosageForm = dosageForms[rnd.nextInt(dosageForms.length)];
            String company = companies[rnd.nextInt(companies.length)];
            String name = generic + " " + strength + " " + (dosageForm.equals("Syrup") || dosageForm.equals("Drop") ? "Bottle" : dosageForm.equals("Ointment") ? "Tube" : "Strip") + " " + i;

            Product p = new Product();
            p.setName(name);
            p.setGenericName(generic);
            p.setHsnCode("HSN" + String.format("%05d", i));
            p.setStripSize(dosageForm.equals("Tablet") || dosageForm.equals("Capsule") ? 10 + rnd.nextInt(11) : 1);
            p.setScheduleDrugType(rnd.nextBoolean() ? "OTC" : "Rx");
            p.setDosageForm(dosageForm);
            p.setUnitType(dosageForm.equals("Tablet") || dosageForm.equals("Capsule") ? "Strip" : dosageForm.equals("Syrup") || dosageForm.equals("Drop") ? "Bottle" : dosageForm.equals("Ointment") ? "Tube" : "Vial");
            p.setReorderLevel(20 + rnd.nextInt(80));
            p.setTargetStockLevel(100 + rnd.nextInt(900));
            p.setCompany(company);
            p.setPrice(BigDecimal.valueOf(20 + rnd.nextInt(480) + rnd.nextDouble()).setScale(2, RoundingMode.HALF_UP));
            p.setQuantity(20 + rnd.nextInt(980));
            p.setExpiryDate(LocalDate.now().plusDays(60 + rnd.nextInt(365 * 2)));
            p.setComposition(generic + " " + strength);
            p.setProfitMargin(BigDecimal.valueOf(0.10 + rnd.nextDouble() * 0.35));
            p.setBarcode("SKU" + String.format("%05d", i));
            products.add(p);
        }

        productRepository.saveAll(products);

        List<InventoryBatch> allBatches = new ArrayList<>();
        List<PurchaseInvoice> purchaseInvoices = new ArrayList<>();
        for (int i = 1; i <= 60; i++) {
            Supplier supplier = suppliers.get(rnd.nextInt(suppliers.size()));
            PurchaseInvoice purchaseInvoice = new PurchaseInvoice();
            purchaseInvoice.setInvoiceNumber("PINV-" + String.format("%04d", i));
            purchaseInvoice.setPurchaseDate(LocalDate.now().minusDays(rnd.nextInt(180)));
            purchaseInvoice.setSupplier(supplier);

            BigDecimal invoiceTotal = BigDecimal.ZERO;
            int batchCount = 1 + rnd.nextInt(3);
            for (int batchIndex = 0; batchIndex < batchCount; batchIndex++) {
                Product product = products.get(rnd.nextInt(products.size()));
                int stripStock = 10 + rnd.nextInt(40);
                BigDecimal costPrice = product.getPrice().multiply(BigDecimal.valueOf(0.70 + rnd.nextDouble() * 0.20)).setScale(2, RoundingMode.HALF_UP);
                BigDecimal mrp = costPrice.multiply(BigDecimal.valueOf(1.30 + rnd.nextDouble() * 0.25)).setScale(2, RoundingMode.HALF_UP);
                BigDecimal sellingPrice = costPrice.multiply(BigDecimal.valueOf(1.15 + rnd.nextDouble() * 0.25)).setScale(2, RoundingMode.HALF_UP);

                InventoryBatch batch = new InventoryBatch();
                batch.setProduct(product);
                batch.setSupplier(supplier);
                batch.setBatchNumber("BATCH-" + i + "-" + (batchIndex + 1));
                batch.setMfgDate(LocalDate.now().minusDays(15 + rnd.nextInt(200)));
                batch.setExpiryDate(LocalDate.now().plusDays(90 + rnd.nextInt(720)));
                batch.setMrp(mrp);
                batch.setCostPrice(costPrice);
                batch.setSellingPrice(sellingPrice);
                batch.setStripStock(stripStock);
                batch.setTabletStock(stripStock * 10);

                purchaseInvoice.addBatch(batch);
                invoiceTotal = invoiceTotal.add(costPrice.multiply(BigDecimal.valueOf(stripStock)));
                product.setQuantity(product.getQuantity() + stripStock);
                allBatches.add(batch);
            }
            purchaseInvoice.setTotalAmount(invoiceTotal.setScale(2, RoundingMode.HALF_UP));
            purchaseInvoices.add(purchaseInvoice);
        }

        // === Custom Demo Data for Verification (Out of stock, Low stock, Expired, Near expiry) ===
        Supplier demoSupplier = suppliers.get(0);
        PurchaseInvoice demoInvoice = new PurchaseInvoice();
        demoInvoice.setInvoiceNumber("PINV-DEMO-999");
        demoInvoice.setPurchaseDate(LocalDate.now().minusDays(5));
        demoInvoice.setSupplier(demoSupplier);
        demoInvoice.setTotalAmount(BigDecimal.valueOf(3000.00));

        // 1. Out of stock product & batch
        Product pOut = new Product();
        pOut.setName("Amlodipine 5mg Out-of-Stock Strip");
        pOut.setGenericName("Amlodipine");
        pOut.setHsnCode("30049039");
        pOut.setStripSize(10);
        pOut.setScheduleDrugType("Rx");
        pOut.setDosageForm("Tablet");
        pOut.setUnitType("Strip");
        pOut.setReorderLevel(50);
        pOut.setTargetStockLevel(300);
        pOut.setCompany("PharmaCare");
        pOut.setPrice(BigDecimal.valueOf(120.00));
        pOut.setQuantity(0);
        pOut.setExpiryDate(LocalDate.now().plusYears(1));
        pOut.setComposition("Amlodipine 5mg");
        pOut.setProfitMargin(BigDecimal.valueOf(0.15));
        pOut.setBarcode("BAROUT01");
        productRepository.save(pOut);
        products.add(pOut);

        InventoryBatch bOut = new InventoryBatch();
        bOut.setProduct(pOut);
        bOut.setSupplier(demoSupplier);
        bOut.setBatchNumber("BATCH-OUT");
        bOut.setMfgDate(LocalDate.now().minusMonths(6));
        bOut.setExpiryDate(LocalDate.now().plusYears(1));
        bOut.setMrp(BigDecimal.valueOf(150.00));
        bOut.setCostPrice(BigDecimal.valueOf(100.00));
        bOut.setSellingPrice(BigDecimal.valueOf(120.00));
        bOut.setStripStock(0);
        bOut.setTabletStock(0);
        demoInvoice.addBatch(bOut);

        // 2. Low stock product & batch
        Product pLow = new Product();
        pLow.setName("Montelukast 10mg Low-Stock Strip");
        pLow.setGenericName("Montelukast");
        pLow.setHsnCode("30049099");
        pLow.setStripSize(10);
        pLow.setScheduleDrugType("Rx");
        pLow.setDosageForm("Tablet");
        pLow.setUnitType("Strip");
        pLow.setReorderLevel(100);
        pLow.setTargetStockLevel(500);
        pLow.setCompany("NovaPharma");
        pLow.setPrice(BigDecimal.valueOf(85.00));
        pLow.setQuantity(10);
        pLow.setExpiryDate(LocalDate.now().plusYears(1));
        pLow.setComposition("Montelukast 10mg");
        pLow.setProfitMargin(BigDecimal.valueOf(0.20));
        pLow.setBarcode("BARLOW01");
        productRepository.save(pLow);
        products.add(pLow);

        InventoryBatch bLow = new InventoryBatch();
        bLow.setProduct(pLow);
        bLow.setSupplier(demoSupplier);
        bLow.setBatchNumber("BATCH-LOW");
        bLow.setMfgDate(LocalDate.now().minusMonths(3));
        bLow.setExpiryDate(LocalDate.now().plusYears(1));
        bLow.setMrp(BigDecimal.valueOf(110.00));
        bLow.setCostPrice(BigDecimal.valueOf(70.00));
        bLow.setSellingPrice(BigDecimal.valueOf(85.00));
        bLow.setStripStock(1);
        bLow.setTabletStock(0);
        demoInvoice.addBatch(bLow);
        allBatches.add(bLow); // low stock batch has 1 strip = 10 tablets, which can be selected

        // 3. Expired product & batch
        Product pExp = new Product();
        pExp.setName("Paracetamol 500mg Expired Strip");
        pExp.setGenericName("Paracetamol");
        pExp.setHsnCode("29339990");
        pExp.setStripSize(15);
        pExp.setScheduleDrugType("OTC");
        pExp.setDosageForm("Tablet");
        pExp.setUnitType("Strip");
        pExp.setReorderLevel(50);
        pExp.setTargetStockLevel(400);
        pExp.setCompany("CureLife");
        pExp.setPrice(BigDecimal.valueOf(30.00));
        pExp.setQuantity(150);
        pExp.setExpiryDate(LocalDate.now().minusDays(15));
        pExp.setComposition("Paracetamol 500mg");
        pExp.setProfitMargin(BigDecimal.valueOf(0.12));
        pExp.setBarcode("BAREXP01");
        productRepository.save(pExp);
        products.add(pExp);

        InventoryBatch bExp = new InventoryBatch();
        bExp.setProduct(pExp);
        bExp.setSupplier(demoSupplier);
        bExp.setBatchNumber("BATCH-EXP");
        bExp.setMfgDate(LocalDate.now().minusMonths(12));
        bExp.setExpiryDate(LocalDate.now().minusDays(15));
        bExp.setMrp(BigDecimal.valueOf(40.00));
        bExp.setCostPrice(BigDecimal.valueOf(25.00));
        bExp.setSellingPrice(BigDecimal.valueOf(30.00));
        bExp.setStripStock(10);
        bExp.setTabletStock(0);
        demoInvoice.addBatch(bExp);
        // Expired batch should not be used in sales invoices (since sales invoices check expiry or filter for sale)

        // 4. Near expiry product & batch
        Product pNear = new Product();
        pNear.setName("Azithromycin 500mg Near-Expiry Strip");
        pNear.setGenericName("Azithromycin");
        pNear.setHsnCode("30049090");
        pNear.setStripSize(5);
        pNear.setScheduleDrugType("Rx");
        pNear.setDosageForm("Tablet");
        pNear.setUnitType("Strip");
        pNear.setReorderLevel(40);
        pNear.setTargetStockLevel(250);
        pNear.setCompany("MediHeal");
        pNear.setPrice(BigDecimal.valueOf(110.00));
        pNear.setQuantity(50);
        pNear.setExpiryDate(LocalDate.now().plusDays(45));
        pNear.setComposition("Azithromycin 500mg");
        pNear.setProfitMargin(BigDecimal.valueOf(0.18));
        pNear.setBarcode("BARNEAR01");
        productRepository.save(pNear);
        products.add(pNear);

        InventoryBatch bNear = new InventoryBatch();
        bNear.setProduct(pNear);
        bNear.setSupplier(demoSupplier);
        bNear.setBatchNumber("BATCH-NEAR");
        bNear.setMfgDate(LocalDate.now().minusMonths(4));
        bNear.setExpiryDate(LocalDate.now().plusDays(45));
        bNear.setMrp(BigDecimal.valueOf(140.00));
        bNear.setCostPrice(BigDecimal.valueOf(90.00));
        bNear.setSellingPrice(BigDecimal.valueOf(110.00));
        bNear.setStripStock(10);
        bNear.setTabletStock(0);
        demoInvoice.addBatch(bNear);
        allBatches.add(bNear); // Near expiry has stock, can be selected

        purchaseInvoices.add(demoInvoice);

        purchaseInvoiceRepository.saveAll(purchaseInvoices);

        for (PurchaseInvoice purchaseInvoice : purchaseInvoices) {
            BigDecimal owing = purchaseInvoice.getTotalAmount().multiply(BigDecimal.valueOf(0.20 + rnd.nextDouble() * 0.25)).setScale(2, RoundingMode.HALF_UP);
            purchaseInvoice.getSupplier().setLedgerBalance(purchaseInvoice.getSupplier().getLedgerBalance().add(owing));
        }
        supplierRepository.saveAll(suppliers);
        productRepository.saveAll(products);

        int salesCount = 0;
        List<SalesInvoice> salesInvoices = new ArrayList<>();
        for (Customer customer : customers) {
            int invoiceCount = 1 + rnd.nextInt(3);
            BigDecimal customerOwed = BigDecimal.ZERO;
            for (int invoiceIndex = 1; invoiceIndex <= invoiceCount; invoiceIndex++) {
                salesCount++;
                SalesInvoice salesInvoice = new SalesInvoice();
                salesInvoice.setInvoiceNumber("SINV-" + customer.getName().replaceAll("\\s+", "") + "-" + invoiceIndex + "-" + salesCount + "-" + rnd.nextInt(999));
                salesInvoice.setSaleDateTime(LocalDateTime.now().minusDays(rnd.nextInt(120)).minusHours(rnd.nextInt(24)));
                salesInvoice.setCustomer(customer);

                BigDecimal invoiceTotal = BigDecimal.ZERO;
                int itemCount = 1 + rnd.nextInt(3);
                for (int itemIndex = 0; itemIndex < itemCount; itemIndex++) {
                    InventoryBatch batch = allBatches.get(rnd.nextInt(allBatches.size()));
                    int quantity = 1 + rnd.nextInt(8);
                    SalesInvoiceItem item = new SalesInvoiceItem();
                    item.setBatch(batch);
                    item.setQuantitySoldTablets(quantity);
                    item.setUnitSellingPrice(batch.getSellingPrice());
                    BigDecimal lineTotal = batch.getSellingPrice().multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);
                    item.setLineTaxableAmount(lineTotal);
                    item.setLineCgst(BigDecimal.ZERO);
                    item.setLineSgst(BigDecimal.ZERO);
                    item.setLineTotal(lineTotal);
                    salesInvoice.addItem(item);
                    invoiceTotal = invoiceTotal.add(lineTotal);
                }
                salesInvoice.setGrandTotal(invoiceTotal.setScale(2, RoundingMode.HALF_UP));
                salesInvoices.add(salesInvoice);

                if (rnd.nextBoolean()) {
                    BigDecimal due = invoiceTotal.multiply(BigDecimal.valueOf(0.15 + rnd.nextDouble() * 0.35)).setScale(2, RoundingMode.HALF_UP);
                    customerOwed = customerOwed.add(due);
                }
            }
            customer.setRemainingBalance(customer.getRemainingBalance().add(customerOwed));
        }

        customerRepository.saveAll(customers);
        salesInvoiceRepository.saveAll(salesInvoices);

        System.out.println("✅ Seeded " + suppliers.size() + " suppliers, " + customers.size() + " customers, " + products.size() + " medicines, " + purchaseInvoices.size() + " supplier invoices, and " + salesInvoices.size() + " customer invoices.");
    }
}
