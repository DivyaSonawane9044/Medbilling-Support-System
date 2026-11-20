# Database Documentation

## 1. What is actually in use

| Item | Value |
|---|---|
| ORM | Hibernate 7.1 through Spring Data JPA (Spring Boot 4.0) |
| **Default (dev) database** | **H2 2.4, file mode**: `jdbc:h2:file:./data/medbilling` → `backend/data/medbilling.mv.db` |
| Persistence | **Yes.** Data survives restarts. This was verified by restarting the server and reading back the E2E data (see TESTING_REPORT §5). |
| Production option | **MySQL 8**, database `pharmacy_db`, via `--spring.profiles.active=mysql` (credentials from `DB_USERNAME` / `DB_PASSWORD`) |
| Tests | H2 **in-memory** `medbilling-test`, recreated per test context (`backend/src/test/resources/application.properties`). It never touches dev data. |
| E2E runs | A separate file database, `backend/data/e2e-test.mv.db` |
| Schema management | `spring.jpa.hibernate.ddl-auto=update` (test: `create-drop`) |
| Sample data | `DataInitializer` runs **only** when `DEMO_DATA_ENABLED=true` **and** the database has no products, customers or suppliers |

### Before vs after

The project as found used `jdbc:h2:mem:testdb` with `ddl-auto=create-drop`. **Every restart wiped all data**, and the seeder refilled about 300 random records each time.

The database engine is unchanged (H2 for development, MySQL as an option). Only the H2 mode changed, from in-memory to file, so data now persists. The MySQL profile previously hardcoded `root/root`; it now reads credentials from environment variables.

> **Upgrading an existing database:** `ddl-auto=update` adds new tables and columns but does **not** change existing column types or relax `NOT NULL`. On an existing MySQL database, apply the statements in §5 manually. A fresh database needs nothing.

## 2. Entity-relationship overview

```
supplier 1───* purchase_invoice 1───* inventory_batch *───1 product
    1                                     1   *                1
    └──────────────* inventory_batch ─────┘   │                │
                                              │                │
customer 1───* sales_invoice 1───* sales_invoice_item *───1 inventory_batch
    1              1
    │              └───* payment *───0..1 customer
    └───* prescription
```

| Relationship | Cardinality | Notes |
|---|---|---|
| product → inventory_batch | 1 : N | All stock lives in batches |
| supplier → inventory_batch | 1 : N (optional) | `supplier_id` is null for **opening stock** entered from Product Master |
| purchase_invoice → inventory_batch | 1 : N (cascade) | Batches are created when a purchase is received |
| supplier → purchase_invoice | 1 : N | Status `PENDING` (ordered) → `RECEIVED` |
| customer → sales_invoice | 1 : N (optional) | Null customer = walk-in |
| sales_invoice → sales_invoice_item | 1 : N (cascade) | One row per **batch** used (a line can be split by FEFO) |
| inventory_batch → sales_invoice_item | 1 : N | Gives batch and expiry traceability for every unit sold |
| sales_invoice → payment | 1 : N | `SUCCESS` payments are summed to work out the outstanding amount |
| customer → payment | 1 : N (optional) | Set for invoice payments, and for balance settlements that have no invoice |
| customer → prescription | 1 : N (optional) | Medicine schedules |

## 3. Tables

Taken from the live database (`INFORMATION_SCHEMA`) after the fixes. **Bold** = NOT NULL. Money columns are `DECIMAL` (`BigDecimal` in Java). No floating-point types are used for money.

### product
**product_id** (PK), **name** (unique), generic_name, company, composition, **hsn_code**, **strip_size** (units per pack), schedule_drug_type, dosage_form, unit_type, volume_ml, weight_gm, **reorder_level** (units), target_stock_level (units), price (default selling price per pack, GST-incl.), profit_margin, **gst_rate** *(new, default 12.00)*, barcode (unique), quantity (*derived*: total units across batches, kept in sync by `StockService`), expiry_date (*legacy, unused*).

### inventory_batch
**batch_id** (PK), **product_id** (FK), supplier_id (FK, *nullable since fix*), purchase_invoice_id (FK), **batch_number**, **mfg_date**, **expiry_date**, **mrp**, **cost_price**, **selling_price** (all per pack; selling ≤ MRP is enforced), **strip_stock** (whole packs), **tablet_stock** (loose units, always < pack size), received_strips *(new: quantity received)*.

### purchase_invoice
**invoice_id** (PK), **invoice_number** (unique per supplier, enforced in the service), **purchase_date**, **supplier_id** (FK), total_amount, **status** (`PENDING` / `RECEIVED`).

### supplier
**supplier_id** (PK), **name** (unique), contact_number, company, gst_in (GSTIN format validated), **ledger_balance** (positive = amount we owe; changes only through purchases, payments and returns).

### customer
**customer_id** (PK), **name**, contact_number, email, address, doctor_name, prescription_image_url (*CLOB since fix*; holds a data-URL image of up to 2 MB), remaining_balance (credit owed by the customer; changes only through sales and payments).

### sales_invoice
**invoice_id** (PK), **invoice_number** (unique, `INV-yyyyMMdd-HHmmss-NNN`), **sale_date_time**, customer_id (FK), dispensing_pharmacist, total_taxable_amount, total_cgst, total_sgst, grand_total, discount_percent *(new)*, total_discount *(new)*.

### sales_invoice_item
**item_id** (PK), **invoice_id** (FK), **batch_id** (FK), quantity_sold_tablets (units), unit_selling_price (per unit, incl. GST), line_taxable_amount, line_cgst, line_sgst, line_total, morning, afternoon, evening, night, before_food, after_food, duration_days.

### payment
**payment_id** (PK), invoice_id (FK, *nullable since fix*), customer_id (FK) *(new)*, **amount_paid**, **payment_date**, payment_method (Cash / UPI / Card / RAZORPAY …), payment_status (`SUCCESS` / `CREATED` / `FAILED`), transaction_reference, razorpay_order_id *(new)*.

### prescription
**prescription_id** (PK), customer_id (FK), medicine_name, morning, afternoon, evening, night, instructions, **created_at**.

## 4. Integrity rules enforced in code

- Stock can never go negative. Sales lock the batch rows (`PESSIMISTIC_WRITE`), so two counters can't sell the same last units.
- Sales quantities must be > 0. Discount is 0–100%. The selling price used is capped at MRP.
- An invoice can't receive more `SUCCESS` payments than its grand total. A pending purchase order can be received only once.
- Products that have batches or sales history, and customers that have invoices, payments or a balance, can't be deleted (HTTP 409).
- Balances (`remaining_balance`, `ledger_balance`) and `product.quantity` can't be set by API clients.

## 5. Manual migration for databases created before this fix

New columns are added automatically by `ddl-auto=update`. These changes are not:

```sql
-- MySQL
ALTER TABLE inventory_batch MODIFY supplier_id BIGINT NULL;
ALTER TABLE payment         MODIFY invoice_id  BIGINT NULL;
ALTER TABLE customer        MODIFY prescription_image_url LONGTEXT NULL;
UPDATE product SET gst_rate = 12.00 WHERE gst_rate IS NULL;   -- then set the correct rate per medicine
```

After that, sync each product's cached stock from its batches once. You can do this by saving each product, or with:

```sql
UPDATE product p SET quantity = (SELECT COALESCE(SUM(b.strip_stock * p.strip_size + b.tablet_stock), 0)
                                 FROM inventory_batch b WHERE b.product_id = p.product_id);
```

(For syrups and bottles the app treats a pack as 1 unit. Adjust that query for those rows if your data uses `strip_size > 1` for liquids.)
