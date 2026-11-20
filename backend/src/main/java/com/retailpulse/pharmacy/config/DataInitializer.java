package com.retailpulse.pharmacy.config;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.function.ToIntFunction;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import com.retailpulse.pharmacy.model.Customer;
import com.retailpulse.pharmacy.model.InventoryBatch;
import com.retailpulse.pharmacy.model.Payment;
import com.retailpulse.pharmacy.model.Prescription;
import com.retailpulse.pharmacy.model.Product;
import com.retailpulse.pharmacy.model.PurchaseInvoice;
import com.retailpulse.pharmacy.model.SalesInvoice;
import com.retailpulse.pharmacy.model.SalesInvoiceItem;
import com.retailpulse.pharmacy.model.Supplier;
import com.retailpulse.pharmacy.repositories.CustomerRepository;
import com.retailpulse.pharmacy.repositories.PaymentRepository;
import com.retailpulse.pharmacy.repositories.PrescriptionRepository;
import com.retailpulse.pharmacy.repositories.ProductRepository;
import com.retailpulse.pharmacy.repositories.PurchaseInvoiceRepository;
import com.retailpulse.pharmacy.repositories.SalesInvoiceRepository;
import com.retailpulse.pharmacy.repositories.SupplierRepository;
import com.retailpulse.pharmacy.service.GstCalculator;
import com.retailpulse.pharmacy.service.PaymentService;
import com.retailpulse.pharmacy.service.PurchaseService;
import com.retailpulse.pharmacy.service.StockService;

/**
 * Seeds a realistic, internally consistent Indian retail-pharmacy dataset for demos.
 *
 * Runs only when app.demo-data.enabled=true AND the database has no suppliers, customers
 * or products, so demo rows can never mix into real shop data (use the "demo" profile,
 * which also points at its own H2 file).
 *
 * Everything is derived from one seeded Random, so the data is reproducible (dates are
 * relative to the day the seeder runs). The data is simulated the way the live app would
 * have produced it:
 *  - suppliers deliver batches on purchase invoices (stock in whole packs, ledger += total);
 *  - sales are billed FEFO from unexpired batches received on or before the sale date,
 *    priced with {@link GstCalculator} exactly like BillingService, invoice numbers in
 *    BillingService's INV-yyyyMMdd-HHmmss-NNN format;
 *  - payments at the counter / later collections exactly like PaymentService, and each
 *    customer's remaining balance equals the unpaid part of their invoices;
 *  - batch stock = received - sold, Product.quantity refreshed via StockService.
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private static final DateTimeFormatter INVOICE_TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final ProductRepository productRepository;
    private final SupplierRepository supplierRepository;
    private final CustomerRepository customerRepository;
    private final PurchaseInvoiceRepository purchaseInvoiceRepository;
    private final SalesInvoiceRepository salesInvoiceRepository;
    private final PaymentRepository paymentRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final StockService stockService;

    @Value("${app.demo-data.enabled:false}")
    private boolean demoDataEnabled;

    public DataInitializer(ProductRepository productRepository,
                           SupplierRepository supplierRepository,
                           CustomerRepository customerRepository,
                           PurchaseInvoiceRepository purchaseInvoiceRepository,
                           SalesInvoiceRepository salesInvoiceRepository,
                           PaymentRepository paymentRepository,
                           PrescriptionRepository prescriptionRepository,
                           StockService stockService) {
        this.productRepository = productRepository;
        this.supplierRepository = supplierRepository;
        this.customerRepository = customerRepository;
        this.purchaseInvoiceRepository = purchaseInvoiceRepository;
        this.salesInvoiceRepository = salesInvoiceRepository;
        this.paymentRepository = paymentRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.stockService = stockService;
    }

    @Override
    public void run(String... args) throws Exception {
        // Sample data only on an empty database, and only when explicitly enabled (never mixes into real data)
        if (demoDataEnabled && supplierRepository.count() == 0 && customerRepository.count() == 0 && productRepository.count() == 0) {
            initializeData();
        }
    }

    // =====================================================================================
    // Catalogue
    // =====================================================================================

    private enum Use { CHRONIC, ANTIBIOTIC, ACUTE, SUPPLEMENT, TOPICAL }

    /** Deliberate end state for the alerts UI. */
    private enum Plan { NORMAL, LOW_STOCK, OUT_OF_STOCK, NEAR_EXPIRY, EXPIRED_BATCH }

    /**
     * One medicine. mrp is per pack (strip/bottle/tube/vial/pen), GST-inclusive. reorder/target are in
     * units as the app counts them (tablets for strips, packs for bottles/tubes). dose is "M-A-N" with an
     * optional " BF" (before food); "SOS" = as needed; "" = external use. planDays: days to expiry
     * (NEAR_EXPIRY) or days since expiry (EXPIRED_BATCH).
     */
    private record Med(String name, String generic, String composition, String company, String form, String unit,
                       int packSize, Double volumeMl, Double weightGm, String mrp, int gst, String schedule,
                       String hsn, int popularity, int reorder, int target, Use use, String dose, Plan plan,
                       int planDays) {
    }

    private static final List<Med> MEDS = List.of(
        // --- Fever / pain / cold ---
        new Med("Dolo 650 Tablet", "Paracetamol", "Paracetamol 650mg", "Micro Labs Ltd", "Tablet", "Strip", 15, null, null, "33.60", 12, "OTC", "30049099", 10, 150, 900, Use.ACUTE, "1-0-1", Plan.NORMAL, 0),
        new Med("Crocin Advance Tablet", "Paracetamol", "Paracetamol 500mg", "Haleon India (GSK Consumer Healthcare)", "Tablet", "Strip", 15, null, null, "22.40", 12, "OTC", "30049099", 6, 120, 600, Use.ACUTE, "1-0-1", Plan.NORMAL, 0),
        new Med("Calpol 500 Tablet", "Paracetamol", "Paracetamol 500mg", "GlaxoSmithKline Pharmaceuticals Ltd", "Tablet", "Strip", 15, null, null, "16.20", 12, "OTC", "30049099", 4, 90, 450, Use.ACUTE, "1-0-1", Plan.NORMAL, 0),
        new Med("Combiflam Tablet", "Ibuprofen + Paracetamol", "Ibuprofen 400mg + Paracetamol 325mg", "Sanofi India Ltd", "Tablet", "Strip", 20, null, null, "48.00", 12, "OTC", "30049099", 5, 100, 500, Use.ACUTE, "1-0-1", Plan.NORMAL, 0),
        new Med("Sinarest Tablet", "Paracetamol + Phenylephrine + Chlorpheniramine + Caffeine", "Paracetamol 500mg + Phenylephrine 10mg + Chlorpheniramine Maleate 2mg + Caffeine 30mg", "Centaur Pharmaceuticals Pvt Ltd", "Tablet", "Strip", 10, null, null, "58.50", 12, "OTC", "30049099", 4, 60, 300, Use.ACUTE, "1-0-1", Plan.NORMAL, 0),
        new Med("Ultracet Tablet", "Tramadol + Paracetamol", "Tramadol Hydrochloride 37.5mg + Paracetamol 325mg", "Janssen (Johnson & Johnson Pvt Ltd)", "Tablet", "Strip", 10, null, null, "158.00", 12, "H1", "30049099", 1, 20, 100, Use.ACUTE, "1-0-1", Plan.NORMAL, 0),
        new Med("Meftal Spas Tablet", "Mefenamic Acid + Dicyclomine", "Mefenamic Acid 250mg + Dicyclomine Hydrochloride 10mg", "Blue Cross Laboratories Pvt Ltd", "Tablet", "Strip", 10, null, null, "47.60", 12, "H", "30049099", 3, 40, 200, Use.ACUTE, "SOS", Plan.NORMAL, 0),
        // --- Gastro ---
        new Med("Pan 40 Tablet", "Pantoprazole", "Pantoprazole 40mg", "Alkem Laboratories Ltd", "Tablet", "Strip", 15, null, null, "158.00", 12, "H", "30049099", 7, 90, 450, Use.CHRONIC, "1-0-0 BF", Plan.NORMAL, 0),
        new Med("Pantocid 40 Tablet", "Pantoprazole", "Pantoprazole 40mg", "Sun Pharmaceutical Industries Ltd", "Tablet", "Strip", 15, null, null, "171.30", 12, "H", "30049099", 4, 60, 300, Use.CHRONIC, "1-0-0 BF", Plan.NORMAL, 0),
        new Med("Pan-D Capsule", "Pantoprazole + Domperidone", "Pantoprazole 40mg + Domperidone 30mg (SR)", "Alkem Laboratories Ltd", "Capsule", "Strip", 15, null, null, "199.00", 12, "H", "30049099", 5, 60, 300, Use.ACUTE, "1-0-0 BF", Plan.NORMAL, 0),
        new Med("Omez 20 Capsule", "Omeprazole", "Omeprazole 20mg", "Dr. Reddy's Laboratories Ltd", "Capsule", "Strip", 20, null, null, "72.00", 12, "H", "30049099", 3, 60, 300, Use.ACUTE, "1-0-0 BF", Plan.NORMAL, 0),
        new Med("Ondem 4 Tablet", "Ondansetron", "Ondansetron 4mg", "Alkem Laboratories Ltd", "Tablet", "Strip", 10, null, null, "58.90", 12, "H", "30049099", 2, 30, 150, Use.ACUTE, "SOS", Plan.NORMAL, 0),
        new Med("Digene Acidity & Gas Relief Gel Mint 200ml", "Antacid (Aluminium Hydroxide + Magnesium Hydroxide + Simethicone)", "Dried Aluminium Hydroxide Gel 300mg + Magnesium Aluminium Silicate 50mg + Magnesium Hydroxide 25mg + Simethicone 10mg per 5ml", "Abbott India Ltd", "Suspension", "Bottle", 1, 200.0, null, "164.00", 12, "OTC", "30049099", 3, 8, 40, Use.ACUTE, "1-1-1", Plan.EXPIRED_BATCH, 22),
        new Med("Gelusil MPS Tablet", "Aluminium Hydroxide + Magnesium Hydroxide + Simethicone", "Dried Aluminium Hydroxide Gel 250mg + Magnesium Hydroxide 250mg + Activated Dimethicone 50mg", "Pfizer Ltd", "Tablet", "Strip", 15, null, null, "27.80", 12, "OTC", "30049099", 3, 60, 300, Use.ACUTE, "SOS", Plan.NEAR_EXPIRY, 58),
        new Med("Electral ORS Powder 21.8g", "Oral Rehydration Salts (WHO formula)", "Sodium Chloride 2.6g + Potassium Chloride 1.5g + Sodium Citrate 2.9g + Dextrose Anhydrous 13.5g per 21.8g", "FDC Ltd", "Powder", "Sachet", 1, null, 21.8, "22.00", 12, "OTC", "30049099", 5, 30, 150, Use.ACUTE, "SOS", Plan.NEAR_EXPIRY, 84),
        new Med("Liv 52 Tablet (Bottle of 100)", "Ayurvedic hepatoprotective", "Himsra (Capparis spinosa) + Kasani (Cichorium intybus) + Mandur Bhasma + Kakamachi (Solanum nigrum) + Arjuna + Kasamarda + Biranjasipha + Jhavuka", "Himalaya Wellness Company", "Tablet", "Bottle", 100, null, null, "175.00", 12, "OTC", "30049011", 2, 6, 30, Use.SUPPLEMENT, "1-0-1", Plan.NORMAL, 0),
        // --- Antibiotics ---
        new Med("Augmentin 625 Duo Tablet", "Amoxicillin + Clavulanic Acid", "Amoxycillin 500mg + Clavulanic Acid 125mg", "GlaxoSmithKline Pharmaceuticals Ltd", "Tablet", "Strip", 10, null, null, "223.50", 12, "H", "30041090", 4, 40, 200, Use.ANTIBIOTIC, "1-0-1", Plan.NORMAL, 0),
        new Med("Azithral 500 Tablet", "Azithromycin", "Azithromycin 500mg", "Alembic Pharmaceuticals Ltd", "Tablet", "Strip", 5, null, null, "119.50", 12, "H", "30042019", 4, 25, 150, Use.ANTIBIOTIC, "1-0-0", Plan.NORMAL, 0),
        new Med("Zifi 200 Tablet", "Cefixime", "Cefixime 200mg", "FDC Ltd", "Tablet", "Strip", 10, null, null, "118.00", 12, "H1", "30042019", 3, 30, 150, Use.ANTIBIOTIC, "1-0-1", Plan.NORMAL, 0),
        new Med("Taxim-O 200 Tablet", "Cefixime", "Cefixime 200mg", "Alkem Laboratories Ltd", "Tablet", "Strip", 10, null, null, "112.50", 12, "H1", "30042019", 2, 30, 150, Use.ANTIBIOTIC, "1-0-1", Plan.NORMAL, 0),
        new Med("Metrogyl 400 Tablet", "Metronidazole", "Metronidazole 400mg", "J.B. Chemicals & Pharmaceuticals Ltd", "Tablet", "Strip", 15, null, null, "28.70", 12, "H", "30049099", 2, 45, 225, Use.ANTIBIOTIC, "1-1-1", Plan.NEAR_EXPIRY, 71),
        // --- Diabetes ---
        new Med("Glycomet GP 1 Tablet", "Metformin + Glimepiride", "Metformin 500mg (SR) + Glimepiride 1mg", "USV Pvt Ltd", "Tablet", "Strip", 15, null, null, "124.00", 12, "H", "30049099", 6, 90, 600, Use.CHRONIC, "1-0-0 BF", Plan.NORMAL, 0),
        new Med("Glycomet 500 SR Tablet", "Metformin", "Metformin Hydrochloride 500mg (SR)", "USV Pvt Ltd", "Tablet", "Strip", 20, null, null, "34.80", 12, "H", "30049099", 4, 100, 600, Use.CHRONIC, "1-0-1", Plan.NORMAL, 0),
        new Med("Januvia 100mg Tablet", "Sitagliptin", "Sitagliptin 100mg", "MSD Pharmaceuticals Pvt Ltd", "Tablet", "Strip", 7, null, null, "293.00", 12, "H", "30049099", 2, 21, 140, Use.CHRONIC, "1-0-0", Plan.NORMAL, 0),
        new Med("Galvus Met 50/500 Tablet", "Vildagliptin + Metformin", "Vildagliptin 50mg + Metformin 500mg", "Novartis India Ltd", "Tablet", "Strip", 15, null, null, "312.00", 12, "H", "30049099", 2, 30, 180, Use.CHRONIC, "1-0-1", Plan.OUT_OF_STOCK, 0),
        new Med("Human Mixtard 30/70 40IU/ml Injection 10ml", "Insulin Human (Biphasic Isophane)", "Soluble Insulin 30% + Isophane Insulin 70%, 40 IU/ml", "Novo Nordisk India Pvt Ltd", "Injection", "Vial", 1, 10.0, null, "157.00", 5, "H", "30043110", 2, 5, 30, Use.CHRONIC, "1-0-1 BF", Plan.NORMAL, 0),
        new Med("Lantus SoloStar 100IU/ml Pen 3ml", "Insulin Glargine", "Insulin Glargine 100 IU/ml", "Sanofi India Ltd", "Injection", "Box", 1, 3.0, null, "712.00", 5, "H", "30043110", 2, 5, 25, Use.CHRONIC, "0-0-1", Plan.LOW_STOCK, 0),
        // --- Cardiac / BP / lipids / thyroid ---
        new Med("Telma 40 Tablet", "Telmisartan", "Telmisartan 40mg", "Glenmark Pharmaceuticals Ltd", "Tablet", "Strip", 15, null, null, "128.50", 12, "H", "30049099", 6, 90, 600, Use.CHRONIC, "1-0-0", Plan.NORMAL, 0),
        new Med("Telma H Tablet", "Telmisartan + Hydrochlorothiazide", "Telmisartan 40mg + Hydrochlorothiazide 12.5mg", "Glenmark Pharmaceuticals Ltd", "Tablet", "Strip", 15, null, null, "162.00", 12, "H", "30049099", 3, 60, 300, Use.CHRONIC, "1-0-0", Plan.NORMAL, 0),
        new Med("Amlong 5 Tablet", "Amlodipine", "Amlodipine 5mg", "Micro Labs Ltd", "Tablet", "Strip", 15, null, null, "48.20", 12, "H", "30049099", 5, 90, 450, Use.CHRONIC, "1-0-0", Plan.NORMAL, 0),
        new Med("Ecosprin 75 Tablet", "Aspirin", "Aspirin 75mg (Enteric coated)", "USV Pvt Ltd", "Tablet", "Strip", 14, null, null, "5.50", 12, "OTC", "30049099", 4, 84, 560, Use.CHRONIC, "0-1-0", Plan.NORMAL, 0),
        new Med("Ecosprin AV 75 Capsule", "Aspirin + Atorvastatin", "Aspirin 75mg + Atorvastatin 10mg", "USV Pvt Ltd", "Capsule", "Strip", 15, null, null, "52.40", 12, "H", "30049099", 3, 60, 300, Use.CHRONIC, "0-0-1", Plan.NORMAL, 0),
        new Med("Atorva 10 Tablet", "Atorvastatin", "Atorvastatin 10mg", "Zydus Lifesciences Ltd", "Tablet", "Strip", 15, null, null, "104.70", 12, "H", "30049099", 3, 60, 300, Use.CHRONIC, "0-0-1", Plan.NORMAL, 0),
        new Med("Rosuvas 10 Tablet", "Rosuvastatin", "Rosuvastatin 10mg", "Sun Pharmaceutical Industries Ltd", "Tablet", "Strip", 15, null, null, "298.00", 12, "H", "30049099", 3, 60, 300, Use.CHRONIC, "0-0-1", Plan.LOW_STOCK, 0),
        new Med("Thyronorm 50mcg Tablet (Bottle of 120)", "Thyroxine Sodium", "Thyroxine Sodium 50mcg", "Abbott India Ltd", "Tablet", "Bottle", 120, null, null, "179.00", 12, "H", "30043900", 4, 6, 40, Use.CHRONIC, "1-0-0 BF", Plan.LOW_STOCK, 0),
        // --- Allergy / respiratory ---
        new Med("Montair LC Tablet", "Montelukast + Levocetirizine", "Montelukast 10mg + Levocetirizine 5mg", "Cipla Ltd", "Tablet", "Strip", 15, null, null, "268.00", 12, "H", "30049099", 4, 45, 300, Use.CHRONIC, "0-0-1", Plan.NORMAL, 0),
        new Med("Allegra 120mg Tablet", "Fexofenadine", "Fexofenadine Hydrochloride 120mg", "Sanofi India Ltd", "Tablet", "Strip", 10, null, null, "222.00", 12, "H", "30049099", 3, 40, 200, Use.ACUTE, "1-0-0", Plan.LOW_STOCK, 0),
        new Med("Okacet 10 Tablet", "Cetirizine", "Cetirizine Hydrochloride 10mg", "Cipla Ltd", "Tablet", "Strip", 10, null, null, "19.20", 12, "OTC", "30049099", 4, 60, 300, Use.ACUTE, "0-0-1", Plan.NORMAL, 0),
        new Med("Benadryl Cough Formula Syrup 150ml", "Diphenhydramine + Ammonium Chloride + Sodium Citrate + Menthol", "Diphenhydramine 14.08mg + Ammonium Chloride 138mg + Sodium Citrate 57.03mg + Menthol 1.14mg per 5ml", "Kenvue (Johnson & Johnson Pvt Ltd)", "Syrup", "Bottle", 1, 150.0, null, "146.00", 12, "OTC", "30049099", 3, 8, 40, Use.ACUTE, "1-1-1", Plan.NEAR_EXPIRY, 18),
        new Med("Ascoril LS Syrup 100ml", "Ambroxol + Levosalbutamol + Guaifenesin", "Ambroxol 30mg + Levosalbutamol 1mg + Guaifenesin 50mg per 5ml", "Glenmark Pharmaceuticals Ltd", "Syrup", "Bottle", 1, 100.0, null, "132.00", 12, "H", "30049099", 4, 10, 50, Use.ACUTE, "1-1-1", Plan.LOW_STOCK, 0),
        new Med("Asthalin 100mcg Inhaler", "Salbutamol", "Salbutamol 100mcg per actuation (200 MDI)", "Cipla Ltd", "Inhaler", "Box", 1, null, null, "152.00", 12, "H", "30049099", 2, 6, 30, Use.CHRONIC, "SOS", Plan.NORMAL, 0),
        new Med("Otrivin Adult Nasal Drops 10ml", "Xylometazoline", "Xylometazoline Hydrochloride 0.1% w/v", "Haleon India (GSK Consumer Healthcare)", "Drop", "Bottle", 1, 10.0, null, "112.00", 12, "OTC", "30049099", 2, 6, 30, Use.ACUTE, "1-0-1", Plan.OUT_OF_STOCK, 0),
        // --- Vitamins / supplements ---
        new Med("Shelcal 500 Tablet", "Calcium Carbonate + Vitamin D3", "Calcium Carbonate 1250mg (eq. to elemental Calcium 500mg) + Vitamin D3 250 IU", "Torrent Pharmaceuticals Ltd", "Tablet", "Strip", 15, null, null, "131.00", 18, "OTC", "21069099", 4, 60, 300, Use.SUPPLEMENT, "0-1-0", Plan.NORMAL, 0),
        new Med("Becosules Capsule", "Vitamin B-Complex + Vitamin C", "Vitamin B-Complex with Vitamin C 150mg", "Pfizer Ltd", "Capsule", "Strip", 20, null, null, "52.00", 12, "OTC", "30045090", 4, 80, 400, Use.SUPPLEMENT, "0-1-0", Plan.EXPIRED_BATCH, 47),
        new Med("Limcee 500mg Chewable Tablet", "Ascorbic Acid", "Vitamin C (Ascorbic Acid) 500mg", "Abbott India Ltd", "Tablet", "Strip", 15, null, null, "25.50", 12, "OTC", "30045090", 3, 60, 300, Use.SUPPLEMENT, "1-0-0", Plan.NEAR_EXPIRY, 27),
        new Med("Neurobion Forte Tablet", "Vitamin B-Complex", "Thiamine 10mg + Riboflavin 10mg + Pyridoxine 3mg + Cyanocobalamin 15mcg + Niacinamide 45mg + Calcium Pantothenate 50mg", "Procter & Gamble Health Ltd", "Tablet", "Strip", 30, null, null, "41.00", 12, "OTC", "30045090", 3, 90, 450, Use.SUPPLEMENT, "0-1-0", Plan.NORMAL, 0),
        // --- Topicals ---
        new Med("Volini Gel 30g", "Diclofenac + Linseed Oil + Methyl Salicylate + Menthol", "Diclofenac Diethylamine 1.16% + Linseed Oil 3% + Methyl Salicylate 10% + Menthol 5%", "Sun Pharmaceutical Industries Ltd", "Gel", "Tube", 1, null, 30.0, "118.00", 12, "OTC", "30049099", 3, 10, 50, Use.TOPICAL, "", Plan.NORMAL, 0),
        new Med("Betadine 5% Ointment 20g", "Povidone-Iodine", "Povidone-Iodine 5% w/w", "Win-Medicare Pvt Ltd", "Ointment", "Tube", 1, null, 20.0, "128.00", 12, "OTC", "30049099", 2, 8, 40, Use.TOPICAL, "", Plan.LOW_STOCK, 0),
        new Med("Soframycin Skin Cream 30g", "Framycetin", "Framycetin Sulphate 1% w/w", "Sanofi India Ltd", "Cream", "Tube", 1, null, 30.0, "94.00", 12, "OTC", "30049099", 2, 8, 40, Use.TOPICAL, "", Plan.NEAR_EXPIRY, 44)
    );

    // =====================================================================================
    // People
    // =====================================================================================

    /** stateCode + PAN feed a valid GSTIN; code prefixes the supplier's invoice numbers. */
    private record SupplierSeed(String name, String company, String code, String stateCode, String pan, String phone) {
    }

    private static final List<SupplierSeed> SUPPLIERS = List.of(
        new SupplierSeed("Kamal Pharma Distributors, Pune", "Kamal Pharma Distributors", "KPD", "27", "AAJFK4821M", "9822014573"),
        new SupplierSeed("Shree Ganesh Medical Agencies, Mumbai", "Shree Ganesh Medical Agencies", "SGMA", "27", "ABDFS7315K", "9820347716"),
        new SupplierSeed("Sai Balaji Pharma Distributors, Hyderabad", "Sai Balaji Pharma Distributors", "SBPD", "36", "AAQFS2964H", "9848062391"),
        new SupplierSeed("Venkateswara Medical Distributors, Bengaluru", "Venkateswara Medical Distributors Pvt Ltd", "VMD", "29", "AADCV5807P", "9845127708"),
        new SupplierSeed("Lakshmi Pharma Agencies, Chennai", "Lakshmi Pharma Agencies", "LPA", "33", "AAHFL3390D", "9840521164"),
        new SupplierSeed("Arihant Medicos, Ahmedabad", "Arihant Medicos Pvt Ltd", "AMPL", "24", "AAKCA6142R", "9825093347"),
        new SupplierSeed("Bharat Drug House, New Delhi", "Bharat Drug House", "BDH", "07", "AABFB1876N", "9811462205"),
        new SupplierSeed("Mahalaxmi Healthcare LLP, Nagpur", "Mahalaxmi Healthcare LLP", "MHL", "27", "ABAFM9023G", "9823308154"),
        new SupplierSeed("Shah Pharma Distributors, Surat", "Shah Pharma Distributors", "SPD", "24", "AAPFS4471B", "9898215640"),
        new SupplierSeed("Nilkanth Medical Wholesale, Thane", "Nilkanth Medical Wholesale", "NMW", "27", "AAZFN6658Q", "9769402381"),
        new SupplierSeed("Krishna Pharma Distributors, Kolkata", "Krishna Pharma Distributors", "KRPD", "19", "AAEFK3125L", "9830175296"),
        new SupplierSeed("Rajputana Medical Agencies, Jaipur", "Rajputana Medical Agencies", "RMA", "08", "AAGFR7740T", "9829046613")
    );

    /** chronic = medicines the patient refills regularly; weight = how often they visit. */
    private record CustomerSeed(String name, String emailDomain, String address, String doctor, int weight,
                                List<String> chronic) {
    }

    private static final List<CustomerSeed> CUSTOMERS = List.of(
        new CustomerSeed("Ramesh Kulkarni", "gmail.com", "Flat 302, Shree Ganesh Apartments, Karve Road, Kothrud, Pune, Maharashtra 411038", "Dr. Anil Deshpande", 5, List.of("Glycomet GP 1 Tablet", "Telma 40 Tablet", "Ecosprin 75 Tablet")),
        new CustomerSeed("Sunita Deshmukh", "yahoo.co.in", "B-12, Sai Darshan Society, ITI Road, Aundh, Pune, Maharashtra 411007", "Dr. Meera Joshi", 4, List.of("Thyronorm 50mcg Tablet (Bottle of 120)", "Shelcal 500 Tablet")),
        new CustomerSeed("Prakash Iyer", "gmail.com", "14, 3rd Cross Street, Kasturba Nagar, Adyar, Chennai, Tamil Nadu 600020", "Dr. S. Venkataraman", 3, List.of("Januvia 100mg Tablet", "Rosuvas 10 Tablet")),
        new CustomerSeed("Anjali Mehta", "gmail.com", "A-501, Shivalik Residency, C.G. Road, Navrangpura, Ahmedabad, Gujarat 380009", "Dr. Kiran Shah", 3, List.of("Montair LC Tablet")),
        new CustomerSeed("Vikram Singh Rathore", "gmail.com", "C-47, Shivaji Marg, Malviya Nagar, Jaipur, Rajasthan 302017", "Dr. Rajesh Agarwal", 3, List.of("Telma H Tablet", "Atorva 10 Tablet")),
        new CustomerSeed("Meenakshi Sundaram", null, "22, Bazullah Road, T. Nagar, Chennai, Tamil Nadu 600017", "Dr. S. Venkataraman", 3, List.of("Human Mixtard 30/70 40IU/ml Injection 10ml", "Glycomet 500 SR Tablet")),
        new CustomerSeed("Rohan Joshi", "gmail.com", "Flat 7B, Pristine Greens, Baner Road, Baner, Pune, Maharashtra 411045", "Dr. Meera Joshi", 2, List.of()),
        new CustomerSeed("Fatima Shaikh", "outlook.com", "Room 12, Noor Manzil, S.V. Road, Andheri West, Mumbai, Maharashtra 400058", "Dr. Sameer Khan", 2, List.of("Asthalin 100mcg Inhaler")),
        new CustomerSeed("Arvind Nair", "gmail.com", "Villa 9, Skyline Palm Meadows, Kakkanad, Kochi, Kerala 682030", "Dr. Thomas Kurian", 3, List.of("Amlong 5 Tablet", "Ecosprin AV 75 Capsule")),
        new CustomerSeed("Kavita Reddy", "gmail.com", "Plot 41, Road No. 12, Banjara Hills, Hyderabad, Telangana 500034", "Dr. Padmaja Rao", 3, List.of("Galvus Met 50/500 Tablet", "Rosuvas 10 Tablet")),
        new CustomerSeed("Sanjay Gupta", "rediffmail.com", "H-23, Lajpat Nagar II, New Delhi, Delhi 110024", "Dr. Neeraj Malhotra", 3, List.of("Lantus SoloStar 100IU/ml Pen 3ml", "Glycomet GP 1 Tablet")),
        new CustomerSeed("Pooja Patel", "gmail.com", "12, Shyamal Row Houses, Satellite Road, Satellite, Ahmedabad, Gujarat 380015", "Dr. Kiran Shah", 2, List.of()),
        new CustomerSeed("Harish Chandra Pandey", null, "2/145, Vibhav Khand, Gomti Nagar, Lucknow, Uttar Pradesh 226010", "Dr. Alok Srivastava", 3, List.of("Telma 40 Tablet", "Amlong 5 Tablet")),
        new CustomerSeed("Lakshmi Narayanan", "yahoo.co.in", "AE-118, 6th Avenue, Anna Nagar, Chennai, Tamil Nadu 600040", "Dr. S. Venkataraman", 2, List.of("Thyronorm 50mcg Tablet (Bottle of 120)")),
        new CustomerSeed("Debashish Banerjee", "gmail.com", "17/2, Gariahat Road, Ballygunge, Kolkata, West Bengal 700019", "Dr. Sudipta Ghosh", 2, List.of("Pan 40 Tablet", "Liv 52 Tablet (Bottle of 100)")),
        new CustomerSeed("Neha Kapoor", "gmail.com", "Flat 304, Sector 6, Dwarka, New Delhi, Delhi 110075", "Dr. Neeraj Malhotra", 2, List.of()),
        new CustomerSeed("Suresh Patil", "gmail.com", "Sr. No. 45, Gadital, Hadapsar, Pune, Maharashtra 411028", "Dr. Anil Deshpande", 3, List.of("Glycomet 500 SR Tablet", "Atorva 10 Tablet")),
        new CustomerSeed("Divya Menon", "gmail.com", "#221, 12th Main, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038", "Dr. Ravi Shankar", 2, List.of("Allegra 120mg Tablet")),
        new CustomerSeed("Amit Verma", "outlook.com", "B-3/88, Sector 9, Rohini, Delhi 110085", "Dr. Neeraj Malhotra", 2, List.of()),
        new CustomerSeed("Shalini Rao", "gmail.com", "No. 36, 11th Main, 4th Block, Jayanagar, Bengaluru, Karnataka 560011", "Dr. Ravi Shankar", 2, List.of("Shelcal 500 Tablet", "Neurobion Forte Tablet")),
        new CustomerSeed("Mohammed Irfan Qureshi", "gmail.com", "Flat 506, Manjeera Heights, KPHB Colony, Kukatpally, Hyderabad, Telangana 500072", "Dr. Padmaja Rao", 2, List.of("Telma H Tablet")),
        new CustomerSeed("Gayatri Bhattacharya", "yahoo.co.in", "CD-114, Sector I, Salt Lake City, Kolkata, West Bengal 700064", "Dr. Sudipta Ghosh", 2, List.of("Thyronorm 50mcg Tablet (Bottle of 120)", "Ecosprin 75 Tablet")),
        new CustomerSeed("Nitin Chavan", "gmail.com", "402, Hiranandani Meadows, Pokhran Road 2, Thane West, Maharashtra 400610", "Dr. Sameer Khan", 2, List.of()),
        new CustomerSeed("Priya Krishnan", "gmail.com", "#58, 5th Cross, 6th Block, Koramangala, Bengaluru, Karnataka 560095", "Dr. Ravi Shankar", 2, List.of()),
        new CustomerSeed("Rajendra Prasad Sharma", null, "Bungalow 6, Lunkad Gardens, Viman Nagar, Pune, Maharashtra 411014", "Dr. Anil Deshpande", 3, List.of("Januvia 100mg Tablet", "Telma 40 Tablet", "Rosuvas 10 Tablet")),
        new CustomerSeed("Swati Kulkarni", "gmail.com", "3/14, Ranade Road, Dadar West, Mumbai, Maharashtra 400028", "Dr. Sameer Khan", 2, List.of("Montair LC Tablet")),
        new CustomerSeed("Karthik Subramanian", "gmail.com", "C-1104, Prestige Shantiniketan, ITPL Main Road, Whitefield, Bengaluru, Karnataka 560048", "Dr. Ravi Shankar", 2, List.of()),
        new CustomerSeed("Rekha Agarwal", "rediffmail.com", "1203, Lake Homes, Chandivali, Powai, Mumbai, Maharashtra 400076", "Dr. Sameer Khan", 2, List.of("Glycomet GP 1 Tablet", "Amlong 5 Tablet")),
        new CustomerSeed("Sneha Reddy", "gmail.com", "Flat 1102, My Home Avatar, Narsingi Road, Gachibowli, Hyderabad, Telangana 500032", "Dr. Padmaja Rao", 1, List.of()),
        new CustomerSeed("Manoj Saxena", null, "A-9, Kora Kendra Road No. 4, Borivali West, Mumbai, Maharashtra 400092", "Dr. Sameer Khan", 1, List.of("Pan-D Capsule"))
    );

    // =====================================================================================
    // Working state
    // =====================================================================================

    /** One inventory batch while it is being planned (stock is in units, as StockService counts). */
    private static final class Lot {
        final Med med;
        final Product product;
        final InventoryBatch batch;
        final LocalDate received;
        final LocalDate expiry;
        final int order;
        LocalDate retireOn;          // a regular batch is sold out by the time the next one arrives
        boolean holdUntilExpiry;     // keeps (unsold) stock until it expires: the "expired batch" alert
        boolean last;                // newest batch: carries the closing stock
        int demand;
        int remaining;

        Lot(Med med, Product product, InventoryBatch batch, LocalDate received, int order) {
            this.med = med;
            this.product = product;
            this.batch = batch;
            this.received = received;
            this.expiry = batch.getExpiryDate();
            this.order = order;
        }
    }

    private record Line(Med med, Product product, int units) {
    }

    private record PlannedSale(LocalDateTime at, CustomerSeed seed, List<Line> lines) {
    }

    // =====================================================================================
    // Seeder
    // =====================================================================================

    private void initializeData() {
        Random rnd = new Random(42);
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();

        // ---------- suppliers ----------
        List<Supplier> suppliers = new ArrayList<>();
        for (SupplierSeed s : SUPPLIERS) {
            Supplier sup = new Supplier();
            sup.setName(s.name());
            sup.setCompany(s.company());
            sup.setContactNumber(s.phone());
            sup.setGstIn(gstin(s.stateCode(), s.pan()));
            sup.setLedgerBalance(BigDecimal.ZERO);
            suppliers.add(sup);
        }

        // ---------- customers ----------
        Set<String> phones = new HashSet<>();
        Map<CustomerSeed, Customer> customerBySeed = new LinkedHashMap<>();
        for (CustomerSeed cs : CUSTOMERS) {
            Customer c = new Customer();
            c.setName(cs.name());
            c.setContactNumber(mobile(rnd, phones));
            if (cs.emailDomain() != null) {
                String[] parts = cs.name().toLowerCase().split(" ");
                String local = parts[0] + "." + parts[parts.length - 1] + (rnd.nextInt(3) == 0 ? String.valueOf(60 + rnd.nextInt(40)) : "");
                c.setEmail(local + "@" + cs.emailDomain());
            }
            c.setAddress(cs.address());
            c.setDoctorName(cs.doctor());
            c.setRemainingBalance(BigDecimal.ZERO);
            customerBySeed.put(cs, c);
        }

        // ---------- medicines ----------
        Map<String, Med> medByName = new HashMap<>();
        Map<Med, Product> productByMed = new LinkedHashMap<>();
        Set<String> barcodes = new HashSet<>();
        for (Med m : MEDS) {
            Product p = new Product();
            p.setName(m.name());
            p.setGenericName(m.generic());
            p.setComposition(m.composition());
            p.setCompany(m.company());
            p.setHsnCode(m.hsn());
            p.setStripSize(m.packSize());
            p.setScheduleDrugType(m.schedule());
            p.setDosageForm(m.form());
            p.setUnitType(m.unit());
            p.setVolumeMl(m.volumeMl());
            p.setWeightGm(m.weightGm());
            p.setReorderLevel(m.reorder());
            p.setTargetStockLevel(m.target());
            p.setGstRate(new BigDecimal(m.gst()).setScale(2));
            p.setBarcode(ean13(rnd, barcodes));
            productByMed.put(m, p);
            medByName.put(m.name(), m);
        }
        for (CustomerSeed cs : CUSTOMERS) {
            for (String n : cs.chronic()) {
                if (!medByName.containsKey(n)) {
                    throw new IllegalStateException("Demo data: unknown chronic medicine " + n);
                }
            }
        }

        // ---------- purchase schedule (received invoices, oldest first) ----------
        Map<Product, List<Lot>> lotsByProduct = new HashMap<>();
        List<PurchaseInvoice> purchases = new ArrayList<>();
        Map<Supplier, Integer> invoiceSeq = new HashMap<>();
        int[] lotOrder = {0};

        // Opening stock: one batch of every medicine, 4 lines per invoice, about a year ago
        int openingInvoices = (MEDS.size() + 3) / 4;
        for (int i = 0; i < openingInvoices; i++) {
            Supplier sup = suppliers.get(i % suppliers.size());
            LocalDate date = today.minusDays(365 - i * 2L);
            PurchaseInvoice pi = newPurchase(sup, date, invoiceSeq, rnd);
            for (int j = i * 4; j < Math.min(MEDS.size(), i * 4 + 4); j++) {
                Med m = MEDS.get(j);
                LocalDate expiryOverride = switch (m.plan()) {
                    case NEAR_EXPIRY -> today.plusDays(m.planDays());
                    case EXPIRED_BATCH -> today.minusDays(m.planDays());
                    default -> null;
                };
                addLot(pi, m, productByMed.get(m), sup, date, expiryOverride, 1.0, rnd, lotsByProduct, lotOrder);
            }
            purchases.add(pi);
        }

        // Restocks roughly every three weeks; the products that ran out of their expired batch get a fresh one
        Map<Med, LocalDate> forcedRestock = new HashMap<>();
        for (Med m : MEDS) {
            if (m.plan() == Plan.EXPIRED_BATCH) {
                forcedRestock.put(m, today.minusDays(m.planDays() + 55L));
            }
        }
        int restockInvoices = 36; // about one delivery a week
        for (int k = 0; k < restockInvoices; k++) {
            LocalDate date = today.minusDays(Math.round(300 - k * (296.0 / (restockInvoices - 1))));
            Supplier sup = suppliers.get(rnd.nextInt(suppliers.size()));
            PurchaseInvoice pi = newPurchase(sup, date, invoiceSeq, rnd);
            List<Med> lines = new ArrayList<>();
            LocalDate windowEnd = k + 1 < restockInvoices
                    ? today.minusDays(Math.round(300 - (k + 1) * (296.0 / (restockInvoices - 1)))) : today.plusDays(1);
            for (Map.Entry<Med, LocalDate> f : forcedRestock.entrySet()) {
                if (!f.getValue().isBefore(date) && f.getValue().isBefore(windowEnd)) {
                    lines.add(f.getKey());
                }
            }
            int wanted = Math.max(lines.size(), 2 + rnd.nextInt(3));
            List<Med> candidates = new ArrayList<>();
            for (Med m : MEDS) {
                boolean allowed = m.plan() == Plan.NORMAL
                        || (m.plan() == Plan.LOW_STOCK && date.isBefore(today.minusDays(75)));
                List<Lot> existing = lotsByProduct.get(productByMed.get(m));
                LocalDate lastIn = existing.get(existing.size() - 1).received;
                if (allowed && ChronoUnit.DAYS.between(lastIn, date) >= 21 && !lines.contains(m)) {
                    candidates.add(m);
                }
            }
            while (lines.size() < wanted && !candidates.isEmpty()) {
                Med m = pickWeighted(candidates, Med::popularity, rnd);
                candidates.remove(m);
                lines.add(m);
            }
            // Price revision on the newest stock (MRP revisions of a few percent are common)
            double mrpFactor = date.isAfter(today.minusDays(200)) ? 1.03 : 1.0;
            for (Med m : lines) {
                addLot(pi, m, productByMed.get(m), sup, date, null, mrpFactor, rnd, lotsByProduct, lotOrder);
            }
            purchases.add(pi);
        }

        for (List<Lot> lots : lotsByProduct.values()) {
            lots.sort(Comparator.comparing((Lot l) -> l.received).thenComparingInt(l -> l.order));
            for (int i = 0; i < lots.size(); i++) {
                Lot lot = lots.get(i);
                lot.last = i == lots.size() - 1;
                lot.holdUntilExpiry = lot.med.plan() == Plan.EXPIRED_BATCH && !lot.last;
                lot.retireOn = lot.last ? null : lots.get(i + 1).received;
            }
        }

        // ---------- sales demand (pass 1: who bought what, when; sized against the batch on the shelf) ----------
        List<CustomerSeed> seeds = new ArrayList<>(CUSTOMERS);
        List<LocalDateTime> saleTimes = new ArrayList<>();
        LocalDate firstSaleDay = today.minusDays(358);
        long spanDays = ChronoUnit.DAYS.between(firstSaleDay, today);
        for (LocalDate d = firstSaleDay; d.isBefore(today); d = d.plusDays(1)) {
            double progress = ChronoUnit.DAYS.between(firstSaleDay, d) / (double) spanDays;
            double lambda = (3.5 + 4.8 * progress) * weekdayFactor(d.getDayOfWeek()) * seasonFactor(d.getMonthValue());
            int n = (int) lambda + (rnd.nextDouble() < lambda - (int) lambda ? 1 : 0);
            if (d.equals(today.minusDays(1))) {
                n = Math.max(n, 6 + rnd.nextInt(3));
            }
            for (int i = 0; i < n; i++) {
                saleTimes.add(shopTime(d, rnd));
            }
        }
        // Today: a few bills earlier in the day, never in the future
        LocalDateTime end = now.minusMinutes(2);
        LocalDateTime start = today.atTime(9, 0);
        if (!end.isAfter(start.plusMinutes(10))) {
            start = today.atStartOfDay();
        }
        if (end.isBefore(start)) {
            end = now;
        }
        long seconds = Math.max(1, Duration.between(start, end).getSeconds());
        int todayCount = 5 + rnd.nextInt(6);
        for (int i = 0; i < todayCount; i++) {
            LocalDateTime t = start.plusSeconds((long) (rnd.nextDouble() * seconds));
            saleTimes.add(t.isAfter(now) ? now : t);
        }
        Collections.sort(saleTimes);

        List<PlannedSale> planned = new ArrayList<>();
        for (LocalDateTime at : saleTimes) {
            LocalDate d = at.toLocalDate();
            CustomerSeed cs = rnd.nextDouble() < 0.45 ? null : pickWeighted(seeds, CustomerSeed::weight, rnd);
            int lineCount = pickLineCount(rnd);
            List<Med> chosen = new ArrayList<>();
            if (cs != null && !cs.chronic().isEmpty() && rnd.nextDouble() < 0.7) {
                List<String> refill = new ArrayList<>(cs.chronic());
                Collections.shuffle(refill, rnd);
                int take = Math.min(refill.size(), 1 + rnd.nextInt(2));
                for (int i = 0; i < take; i++) {
                    Med m = medByName.get(refill.get(i));
                    if (activeLot(lotsByProduct.get(productByMed.get(m)), d) != null) {
                        chosen.add(m);
                    }
                }
            }
            for (int attempts = 0; chosen.size() < lineCount && attempts < 40; attempts++) {
                Med m = pickWeighted(MEDS, Med::popularity, rnd);
                if (!chosen.contains(m) && activeLot(lotsByProduct.get(productByMed.get(m)), d) != null) {
                    chosen.add(m);
                }
            }
            if (chosen.isEmpty()) {
                continue;
            }
            List<Line> lines = new ArrayList<>();
            for (Med m : chosen) {
                Product p = productByMed.get(m);
                int units = unitsFor(m, StockService.unitsPerPack(p), rnd);
                activeLot(lotsByProduct.get(p), d).demand += units;
                lines.add(new Line(m, p, units));
            }
            planned.add(new PlannedSale(at, cs, lines));
        }

        // ---------- size each batch: what it sold + the stock it should still hold ----------
        for (List<Lot> lots : lotsByProduct.values()) {
            for (Lot lot : lots) {
                int pp = StockService.unitsPerPack(lot.product);
                int reorder = lot.med.reorder();
                int keep;
                if (lot.holdUntilExpiry) {
                    keep = (pp == 1 ? 5 : 6) * pp;
                } else if (!lot.last) {
                    keep = 0;
                } else {
                    keep = switch (lot.med.plan()) {
                        case OUT_OF_STOCK -> 0;
                        case LOW_STOCK -> Math.max(pp, (reorder / 2) / pp * pp);
                        default -> {
                            // comfortably above the reorder level, below the target stock level
                            int packs = (int) Math.ceil(reorder * (1.5 + rnd.nextDouble() * 1.2) / pp);
                            int cap = Math.max(reorder / pp + 2, (int) Math.floor(lot.med.target() * 0.9 / pp));
                            yield Math.min(packs, cap) * pp;
                        }
                    };
                }
                int packs = (lot.demand + keep + pp - 1) / pp;
                if (lot.med.plan() == Plan.NORMAL) {
                    // Distributors ship sensible quantities; any surplus is simply sold from later (FEFO)
                    packs = Math.max(packs, Math.max(5, (reorder + pp - 1) / pp));
                }
                if (packs == 0) {
                    packs = 1;
                }
                lot.batch.setReceivedStrips(packs);
                lot.remaining = packs * pp;
            }
        }

        // ---------- pass 2: bill every sale FEFO against real batch stock, like BillingService ----------
        Set<String> invoiceNumbers = new HashSet<>();
        List<SalesInvoice> sales = new ArrayList<>();
        List<Payment> payments = new ArrayList<>();
        int shortages = 0;
        int unpaidCount = 0;
        int partialCount = 0;
        for (PlannedSale ps : planned) {
            LocalDate d = ps.at().toLocalDate();
            Customer customer = ps.seed() == null ? null : customerBySeed.get(ps.seed());
            BigDecimal discount = BigDecimal.ZERO.setScale(2);
            double r = rnd.nextDouble();
            if (customer != null && r < 0.30) {
                discount = new BigDecimal(r < 0.10 ? "10.00" : "5.00");
            } else if (customer == null && r < 0.08) {
                discount = new BigDecimal("5.00");
            }

            SalesInvoice inv = new SalesInvoice();
            inv.setSaleDateTime(ps.at());
            inv.setCustomer(customer);
            inv.setDiscountPercent(discount);
            BigDecimal tDisc = BigDecimal.ZERO, tTax = BigDecimal.ZERO, tCgst = BigDecimal.ZERO, tSgst = BigDecimal.ZERO, tGrand = BigDecimal.ZERO;

            for (Line line : ps.lines()) {
                List<Lot> sellable = new ArrayList<>();
                for (Lot lot : lotsByProduct.get(line.product())) {
                    if (!lot.received.isAfter(d) && lot.expiry.isAfter(d) && lot.remaining > 0) {
                        sellable.add(lot);
                    }
                }
                sellable.sort(Comparator.comparing((Lot l) -> l.expiry).thenComparingInt(l -> l.order));
                int need = line.units();
                for (Lot lot : sellable) {
                    if (need == 0) {
                        break;
                    }
                    int take = Math.min(need, lot.remaining);
                    lot.remaining -= take;
                    need -= take;
                    GstCalculator.Line price = priceFor(line.product(), lot.batch, take, discount);
                    SalesInvoiceItem item = new SalesInvoiceItem();
                    item.setBatch(lot.batch);
                    item.setQuantitySoldTablets(take);
                    item.setUnitSellingPrice(price.unitPrice());
                    item.setLineTaxableAmount(price.taxable());
                    item.setLineCgst(price.cgst());
                    item.setLineSgst(price.sgst());
                    item.setLineTotal(price.total());
                    applyDosage(item, line.med(), customer != null);
                    inv.addItem(item);
                    tDisc = tDisc.add(price.discount());
                    tTax = tTax.add(price.taxable());
                    tCgst = tCgst.add(price.cgst());
                    tSgst = tSgst.add(price.sgst());
                    tGrand = tGrand.add(price.total());
                }
                if (need > 0) {
                    shortages++;
                }
            }
            if (inv.getItems().isEmpty()) {
                continue;
            }
            inv.setTotalDiscount(tDisc);
            inv.setTotalTaxableAmount(tTax);
            inv.setTotalCgst(tCgst);
            inv.setTotalSgst(tSgst);
            inv.setGrandTotal(tGrand);
            String number;
            do {
                number = "INV-" + ps.at().format(INVOICE_TS) + "-" + String.format("%03d", rnd.nextInt(1000));
            } while (!invoiceNumbers.add(number));
            inv.setInvoiceNumber(number);
            sales.add(inv);

            // --- payment at the counter, and later collections (PaymentService semantics) ---
            long ageDays = ChronoUnit.DAYS.between(d, today);
            double pu, pp2, ps2;
            if (ageDays <= 30) {
                pu = 0.20; pp2 = 0.40; ps2 = 0.0;
            } else if (ageDays <= 120) {
                pu = 0.10; pp2 = 0.30; ps2 = 0.10;
            } else {
                pu = 0.06; pp2 = 0.20; ps2 = 0.20;
            }
            double o = rnd.nextDouble();
            BigDecimal paidNow = tGrand;
            boolean settleLater = false;
            if (customer != null) {
                if (o < pu) {
                    paidNow = BigDecimal.ZERO;
                } else if (o < pu + pp2 + ps2) {
                    paidNow = partialAmount(tGrand, rnd);
                    settleLater = o >= pu + pp2;
                    if (paidNow.signum() == 0 && !settleLater) {
                        paidNow = tGrand; // too small a bill to leave a balance on
                    }
                }
            }
            if (paidNow.signum() > 0) {
                payments.add(payment(inv, customer, paidNow, ps.at(), methodFor(paidNow, rnd), "SALE-" + number));
            }
            BigDecimal due = tGrand.subtract(paidNow);
            if (due.signum() > 0) {
                BigDecimal later = BigDecimal.ZERO;
                if (settleLater) {
                    later = due;
                } else if (paidNow.signum() > 0 && ageDays > 45 && rnd.nextDouble() < 0.4) {
                    later = due.multiply(BigDecimal.valueOf(0.3 + rnd.nextDouble() * 0.4)).setScale(0, RoundingMode.DOWN).setScale(2);
                }
                if (later.signum() > 0) {
                    LocalDateTime when = d.plusDays(2 + rnd.nextInt(Math.max(1, (int) Math.min(25, ageDays - 2))))
                            .atTime(10 + rnd.nextInt(10), rnd.nextInt(60), rnd.nextInt(60));
                    if (when.isAfter(now)) {
                        when = now.minusHours(1);
                    }
                    String method = methodFor(later, rnd);
                    long millis = when.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                    payments.add(payment(inv, customer, later, when, method, method.toUpperCase() + "-" + millis));
                    due = due.subtract(later);
                }
                if (due.signum() > 0) {
                    customer.setRemainingBalance(customer.getRemainingBalance().add(due));
                    if (due.compareTo(tGrand) == 0) {
                        unpaidCount++;
                    } else {
                        partialCount++;
                    }
                }
            }
        }

        // ---------- closing stock, product price/margin from the newest batch ----------
        for (Map.Entry<Med, Product> e : productByMed.entrySet()) {
            List<Lot> lots = lotsByProduct.get(e.getValue());
            for (Lot lot : lots) {
                StockService.setUnits(lot.batch, lot.remaining);
            }
            InventoryBatch newest = lots.get(lots.size() - 1).batch;
            Product p = e.getValue();
            p.setPrice(newest.getSellingPrice());
            BigDecimal exGst = newest.getSellingPrice().multiply(HUNDRED)
                    .divide(HUNDRED.add(p.getGstRate()), 4, RoundingMode.HALF_UP);
            p.setProfitMargin(exGst.subtract(newest.getCostPrice()).divide(newest.getCostPrice(), 2, RoundingMode.HALF_UP));
        }

        // ---------- purchase totals and supplier ledgers (bills within the ~75-day credit period are unpaid) ----------
        for (PurchaseInvoice pi : purchases) {
            BigDecimal total = BigDecimal.ZERO;
            for (InventoryBatch b : pi.getBatches()) {
                total = total.add(b.getCostPrice().multiply(BigDecimal.valueOf(b.getReceivedStrips())));
            }
            pi.setTotalAmount(total.setScale(2, RoundingMode.HALF_UP));
            if (pi.getPurchaseDate().isAfter(today.minusDays(75))) {
                Supplier s = pi.getSupplier();
                s.setLedgerBalance(s.getLedgerBalance().add(pi.getTotalAmount()));
            }
        }

        // ---------- open purchase orders for the items that are short (no stock/ledger effect until received) ----------
        List<PurchaseInvoice> pendingOrders = new ArrayList<>();
        String[][] orders = {
            {"Galvus Met 50/500 Tablet", "Rosuvas 10 Tablet"},
            {"Otrivin Adult Nasal Drops 10ml", "Ascoril LS Syrup 100ml", "Allegra 120mg Tablet"},
            {"Lantus SoloStar 100IU/ml Pen 3ml", "Betadine 5% Ointment 20g"},
        };
        int[] orderAge = {1, 3, 6};
        for (int i = 0; i < orders.length; i++) {
            Supplier sup = suppliers.get((3 + i * 4) % suppliers.size());
            LocalDate date = today.minusDays(orderAge[i]);
            BigDecimal total = BigDecimal.ZERO;
            for (String name : orders[i]) {
                Med m = medByName.get(name);
                List<Lot> lots = lotsByProduct.get(productByMed.get(m));
                InventoryBatch newest = lots.get(lots.size() - 1).batch;
                int packs = Math.max(5, (m.target() / StockService.unitsPerPack(productByMed.get(m))) / 2);
                total = total.add(newest.getCostPrice().multiply(BigDecimal.valueOf(packs)));
            }
            PurchaseInvoice po = new PurchaseInvoice();
            po.setSupplier(sup);
            po.setInvoiceNumber(String.format("PO-%s-%02d", date.format(DateTimeFormatter.ofPattern("yyMMdd")), i + 1));
            po.setPurchaseDate(date);
            po.setTotalAmount(total.setScale(2, RoundingMode.HALF_UP));
            po.setStatus(PurchaseService.PENDING);
            pendingOrders.add(po);
        }

        // ---------- prescriptions for regular patients ----------
        List<Prescription> prescriptions = new ArrayList<>();
        for (CustomerSeed cs : CUSTOMERS) {
            if (cs.chronic().isEmpty() || prescriptions.size() >= 10) {
                continue;
            }
            Med m = medByName.get(cs.chronic().get(0));
            Prescription rx = new Prescription();
            rx.setCustomer(customerBySeed.get(cs));
            rx.setMedicineName(m.name());
            boolean[] slots = doseSlots(m.dose());
            rx.setMorning(slots[0]);
            rx.setAfternoon(slots[1]);
            rx.setEvening(false);
            rx.setNight(slots[2]);
            rx.setInstructions(instructionsFor(m) + " Prescribed by " + cs.doctor() + ".");
            rx.setCreatedAt(today.minusDays(5 + rnd.nextInt(170)).atTime(10 + rnd.nextInt(9), rnd.nextInt(60)));
            prescriptions.add(rx);
        }

        // ---------- persist (parents first; batches cascade from their purchase invoice) ----------
        List<Customer> customers = new ArrayList<>(customerBySeed.values());
        List<Product> products = new ArrayList<>(productByMed.values());
        List<PurchaseInvoice> allPurchases = new ArrayList<>(purchases);
        allPurchases.addAll(pendingOrders);
        supplierRepository.saveAll(suppliers);
        customerRepository.saveAll(customers);
        productRepository.saveAll(products);
        purchaseInvoiceRepository.saveAll(allPurchases);
        salesInvoiceRepository.saveAll(sales);
        paymentRepository.saveAll(payments);
        prescriptionRepository.saveAll(prescriptions);
        products.forEach(stockService::refreshProductQuantity);

        // ---------- summary ----------
        int low = 0, out = 0, near = 0, expired = 0, batches = 0;
        for (Product p : products) {
            long saleable = 0;
            for (Lot lot : lotsByProduct.get(p)) {
                batches++;
                if (lot.expiry.isAfter(today)) {
                    saleable += lot.remaining;
                }
                if (lot.expiry.isBefore(today)) {
                    expired++;
                } else if (!lot.expiry.isAfter(today.plusMonths(3)) && lot.remaining > 0) {
                    near++;
                }
            }
            if (saleable == 0) {
                out++;
            } else if (saleable <= p.getReorderLevel()) {
                low++;
            }
        }
        BigDecimal todayRevenue = BigDecimal.ZERO, monthRevenue = BigDecimal.ZERO;
        for (SalesInvoice s : sales) {
            if (s.getSaleDateTime().toLocalDate().equals(today)) {
                todayRevenue = todayRevenue.add(s.getGrandTotal());
            }
            if (YearMonth.from(s.getSaleDateTime()).equals(YearMonth.from(today))) {
                monthRevenue = monthRevenue.add(s.getGrandTotal());
            }
        }
        BigDecimal receivable = customers.stream().map(Customer::getRemainingBalance).reduce(BigDecimal.ZERO, BigDecimal::add);
        log.info("Demo data seeded: {} patients, {} medicines, {} suppliers, {} purchase invoices ({} pending orders), "
                + "{} batches, {} sales invoices ({} unpaid, {} partly paid), {} payments, {} prescriptions. "
                + "Stock alerts: {} low, {} out of stock, {} near expiry, {} expired. Today's sales Rs {}, this month Rs {}, "
                + "customer dues Rs {}{}",
                customers.size(), products.size(), suppliers.size(), allPurchases.size(), pendingOrders.size(), batches,
                sales.size(), unpaidCount, partialCount, payments.size(), prescriptions.size(), low, out, near, expired,
                todayRevenue, monthRevenue, receivable, shortages > 0 ? " (" + shortages + " lines short of stock)" : "");
    }

    // =====================================================================================
    // Helpers
    // =====================================================================================

    private static PurchaseInvoice newPurchase(Supplier sup, LocalDate date, Map<Supplier, Integer> seq, Random rnd) {
        SupplierSeed seed = SUPPLIERS.stream().filter(s -> s.name().equals(sup.getName())).findFirst().orElseThrow();
        int n = seq.computeIfAbsent(sup, k -> 1000 + rnd.nextInt(3000)) + 7 + rnd.nextInt(60);
        seq.put(sup, n);
        int fyStart = date.getMonthValue() >= 4 ? date.getYear() : date.getYear() - 1;
        PurchaseInvoice pi = new PurchaseInvoice();
        pi.setSupplier(sup);
        pi.setPurchaseDate(date);
        pi.setInvoiceNumber(String.format("%s/%02d-%02d/%d", seed.code(), fyStart % 100, (fyStart + 1) % 100, n));
        pi.setStatus(PurchaseService.RECEIVED);
        return pi;
    }

    /** Adds a received batch to the invoice, priced like a real distributor bill (PTR ~20% below MRP ex-GST). */
    private static void addLot(PurchaseInvoice pi, Med m, Product p, Supplier sup, LocalDate received,
                               LocalDate expiryOverride, double mrpFactor, Random rnd,
                               Map<Product, List<Lot>> lotsByProduct, int[] order) {
        int shelf = shelfMonths(m);
        LocalDate mfg;
        LocalDate expiry;
        if (expiryOverride != null) {
            expiry = expiryOverride;
            mfg = YearMonth.from(expiry.minusMonths(shelf)).atDay(1);
        } else {
            mfg = YearMonth.from(received.minusDays(20 + rnd.nextInt(60))).atDay(1);
            expiry = YearMonth.from(mfg.plusMonths(shelf - 1L)).atEndOfMonth();
        }
        List<Lot> existing = lotsByProduct.computeIfAbsent(p, k -> new ArrayList<>());
        if (!existing.isEmpty()) {
            LocalDate prev = existing.get(existing.size() - 1).expiry;
            if (!expiry.isAfter(prev)) {
                expiry = YearMonth.from(prev).plusMonths(1).atEndOfMonth();
            }
        }
        BigDecimal mrp = new BigDecimal(m.mrp());
        if (mrpFactor != 1.0) {
            mrp = mrp.multiply(BigDecimal.valueOf(mrpFactor)).setScale(1, RoundingMode.HALF_UP).setScale(2);
        }
        boolean discounted = MEDS.indexOf(m) % 5 == 3;
        BigDecimal selling = discounted ? mrp.multiply(new BigDecimal("0.95")).setScale(2, RoundingMode.HALF_UP) : mrp;
        BigDecimal cost = mrp.multiply(HUNDRED).divide(HUNDRED.add(BigDecimal.valueOf(m.gst())), 6, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(0.78 + rnd.nextDouble() * 0.05)).setScale(2, RoundingMode.HALF_UP);

        InventoryBatch b = new InventoryBatch();
        b.setProduct(p);
        b.setSupplier(sup);
        b.setBatchNumber(batchNumber(m, mfg, rnd));
        b.setMfgDate(mfg);
        b.setExpiryDate(expiry);
        b.setMrp(mrp);
        b.setCostPrice(cost);
        b.setSellingPrice(selling);
        b.setStripStock(0);
        b.setTabletStock(0);
        pi.addBatch(b);
        existing.add(new Lot(m, p, b, received, order[0]++));
    }

    /** The batch the shelf is selling from on {@code d} under the sizing plan (FEFO among active batches). */
    private static Lot activeLot(List<Lot> lots, LocalDate d) {
        Lot best = null;
        for (Lot lot : lots) {
            boolean active = !lot.received.isAfter(d) && lot.expiry.isAfter(d)
                    && (lot.last || lot.holdUntilExpiry || d.isBefore(lot.retireOn));
            if (active && (best == null || lot.expiry.isBefore(best.expiry))) {
                best = lot;
            }
        }
        return best;
    }

    private static GstCalculator.Line priceFor(Product product, InventoryBatch batch, int units, BigDecimal discount) {
        BigDecimal packPrice = batch.getSellingPrice().min(batch.getMrp());
        return GstCalculator.price(packPrice, StockService.unitsPerPack(product), units, product.getGstRate(), discount);
    }

    private static Payment payment(SalesInvoice inv, Customer customer, BigDecimal amount, LocalDateTime when,
                                   String method, String ref) {
        Payment p = new Payment();
        p.setInvoice(inv);
        p.setCustomer(customer);
        p.setAmountPaid(amount);
        p.setPaymentDate(when);
        p.setPaymentMethod(method);
        p.setPaymentStatus(PaymentService.SUCCESS);
        p.setTransactionReference(ref);
        return p;
    }

    /** A round sum the patient pays now (e.g. Rs 300 of a Rs 512.40 bill); zero if the bill is too small. */
    private static BigDecimal partialAmount(BigDecimal grand, Random rnd) {
        BigDecimal step = grand.compareTo(new BigDecimal("300")) > 0 ? new BigDecimal("50") : new BigDecimal("10");
        BigDecimal raw = grand.multiply(BigDecimal.valueOf(0.4 + rnd.nextDouble() * 0.35));
        BigDecimal rounded = raw.divide(step, 0, RoundingMode.DOWN).multiply(step).setScale(2);
        return rounded.compareTo(grand) < 0 ? rounded : BigDecimal.ZERO.setScale(2);
    }

    private static String methodFor(BigDecimal amount, Random rnd) {
        double r = rnd.nextDouble();
        if (amount.compareTo(new BigDecimal("1000")) > 0) {
            return r < 0.25 ? "Cash" : r < 0.70 ? "UPI" : "Card";
        }
        return r < 0.45 ? "Cash" : r < 0.92 ? "UPI" : "Card";
    }

    private static int unitsFor(Med m, int pp, Random rnd) {
        int packs;
        switch (m.use()) {
            case CHRONIC -> packs = pp == 1 ? (rnd.nextDouble() < 0.3 ? 2 : 1) : (rnd.nextDouble() < 0.25 ? 1 : rnd.nextDouble() < 0.7 ? 2 : 3);
            case SUPPLEMENT -> packs = 1 + rnd.nextInt(3);
            case ANTIBIOTIC -> packs = pp >= 10 && rnd.nextDouble() < 0.35 ? 2 : 1;
            case ACUTE -> packs = pp == 1 ? (rnd.nextDouble() < 0.3 ? 2 : 1) : (rnd.nextDouble() < 0.45 ? 1 : rnd.nextDouble() < 0.7 ? 2 : 3);
            default -> packs = 1;
        }
        // Loose tablets for short courses, only where the closing stock is not deliberately exact
        if (pp >= 10 && m.plan() == Plan.NORMAL && (m.use() == Use.ACUTE || m.use() == Use.ANTIBIOTIC)
                && rnd.nextDouble() < 0.2) {
            return pp / 2;
        }
        return packs * pp;
    }

    private static void applyDosage(SalesInvoiceItem item, Med m, boolean withPatient) {
        if (!withPatient || m.dose().isEmpty()) {
            return; // walk-in counter sale / external use: no dosage chart
        }
        boolean[] s = doseSlots(m.dose());
        item.setMorning(s[0]);
        item.setAfternoon(s[1]);
        item.setEvening(false);
        item.setNight(s[2]);
        boolean beforeFood = m.dose().endsWith("BF");
        item.setBeforeFood(beforeFood);
        item.setAfterFood(!beforeFood && !"SOS".equals(m.dose()));
        item.setDurationDays(switch (m.use()) {
            case CHRONIC, SUPPLEMENT -> 30;
            case ANTIBIOTIC -> 5;
            default -> "SOS".equals(m.dose()) ? null : 3;
        });
    }

    private static boolean[] doseSlots(String dose) {
        if (dose.isEmpty() || dose.startsWith("SOS")) {
            return new boolean[] {false, false, false};
        }
        String[] p = dose.split(" ")[0].split("-");
        return new boolean[] {!"0".equals(p[0]), !"0".equals(p[1]), !"0".equals(p[2])};
    }

    private static String instructionsFor(Med m) {
        if (m.dose().endsWith("BF")) {
            return m.form().equals("Injection") ? "Inject subcutaneously 30 minutes before meals." : "Take on an empty stomach, 30 minutes before breakfast.";
        }
        if (m.form().equals("Injection")) {
            return "Inject subcutaneously at the same time every day; keep the pen in the refrigerator.";
        }
        if ("SOS".equals(m.dose())) {
            return "Use when required; do not exceed 8 puffs a day.";
        }
        return "Take after food. Continue for 30 days and review.";
    }

    private static int shelfMonths(Med m) {
        return switch (m.form()) {
            case "Tablet", "Capsule" -> 36;
            default -> 24;
        };
    }

    private static String batchNumber(Med m, LocalDate mfg, Random rnd) {
        String letters = (m.name().replaceAll("[^A-Za-z]", "").substring(0, 1)
                + m.company().replaceAll("[^A-Za-z]", "").substring(0, 1)).toUpperCase();
        String ym = mfg.format(DateTimeFormatter.ofPattern("yyMM"));
        return rnd.nextBoolean()
                ? letters + ym + (char) ('A' + rnd.nextInt(8))
                : letters + (char) ('A' + rnd.nextInt(26)) + ym.substring(0, 2) + String.format("%03d", rnd.nextInt(1000));
    }

    private static int pickLineCount(Random rnd) {
        double r = rnd.nextDouble();
        return r < 0.28 ? 1 : r < 0.62 ? 2 : r < 0.86 ? 3 : 4;
    }

    private static double weekdayFactor(DayOfWeek d) {
        return switch (d) {
            case MONDAY -> 1.15;
            case TUESDAY, THURSDAY -> 0.95;
            case WEDNESDAY -> 1.0;
            case FRIDAY -> 1.05;
            case SATURDAY -> 1.2;
            case SUNDAY -> 0.7;
        };
    }

    /** Monsoon infections and winter coughs/colds lift footfall. */
    private static double seasonFactor(int month) {
        return switch (month) {
            case 7, 8, 9 -> 1.12;
            case 12, 1 -> 1.10;
            default -> 1.0;
        };
    }

    private static LocalDateTime shopTime(LocalDate d, Random rnd) {
        int[] hours = {9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21};
        int[] weights = {2, 5, 6, 5, 3, 3, 3, 4, 6, 8, 9, 7, 3};
        int total = 0;
        for (int w : weights) {
            total += w;
        }
        int x = rnd.nextInt(total);
        int h = hours[hours.length - 1];
        for (int i = 0; i < hours.length; i++) {
            x -= weights[i];
            if (x < 0) {
                h = hours[i];
                break;
            }
        }
        return d.atTime(h, rnd.nextInt(60), rnd.nextInt(60));
    }

    private static <T> T pickWeighted(List<T> items, ToIntFunction<T> weight, Random rnd) {
        int total = 0;
        for (T t : items) {
            total += weight.applyAsInt(t);
        }
        int x = rnd.nextInt(total);
        for (T t : items) {
            x -= weight.applyAsInt(t);
            if (x < 0) {
                return t;
            }
        }
        return items.get(items.size() - 1);
    }

    /** 10-digit Indian mobile number starting with 6-9. */
    private static String mobile(Random rnd, Set<String> used) {
        char[] first = {'9', '9', '9', '8', '8', '7', '7', '6'};
        String n;
        do {
            StringBuilder sb = new StringBuilder().append(first[rnd.nextInt(first.length)]);
            for (int i = 0; i < 9; i++) {
                sb.append(rnd.nextInt(10));
            }
            n = sb.toString();
        } while (!used.add(n));
        return n;
    }

    /** EAN-13 with the GS1 India prefix 890 and a valid check digit. */
    private static String ean13(Random rnd, Set<String> used) {
        String code;
        do {
            StringBuilder sb = new StringBuilder("8901");
            for (int i = 0; i < 8; i++) {
                sb.append(rnd.nextInt(10));
            }
            int sum = 0;
            for (int i = 0; i < 12; i++) {
                sum += (sb.charAt(i) - '0') * (i % 2 == 0 ? 1 : 3);
            }
            code = sb.append((10 - sum % 10) % 10).toString();
        } while (!used.add(code));
        return code;
    }

    /** GSTIN = state code + PAN + entity number + 'Z' + mod-36 checksum (GSTN algorithm). */
    static String gstin(String stateCode, String pan) {
        String chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        String base = stateCode + pan + "1Z";
        int sum = 0;
        for (int i = 0; i < base.length(); i++) {
            int product = chars.indexOf(base.charAt(i)) * (i % 2 == 0 ? 1 : 2);
            sum += product / 36 + product % 36;
        }
        return base + chars.charAt((36 - sum % 36) % 36);
    }
}
