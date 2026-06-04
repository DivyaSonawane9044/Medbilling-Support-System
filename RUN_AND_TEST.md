# RetailPulse – Run in VS Code & Module Testing Guide

## Prerequisites

| Tool | Version | Check |
|------|---------|--------|
| **Java JDK** | 17+ | `java -version` |
| **Node.js** | 18+ | `node -version` |
| **npm** | 9+ | `npm -version` |

Optional: **MySQL** (default uses **H2 in-memory** — no install needed for testing).

---

## Part 1: Run in VS Code

### Step 1 – Open the project

1. Open **VS Code**
2. **File → Open Folder**
3. Select: `Medbilling Support System` (folder that contains `frontend` and `pharma-backend`)

### Step 2 – Start the backend (Terminal 1)

1. **Terminal → New Terminal** (`Ctrl + `` ` ``)
2. Run:

```powershell
cd pharma-backend
.\mvnw.cmd spring-boot:run -DskipTests
```

3. Wait until you see: **`Tomcat started on port(s): 8081`**
4. Test: open browser → `http://localhost:8081/api/analytics/dashboard` (should show JSON)

**H2 console (optional):** `http://localhost:8081/h2-console`  
- JDBC URL: `jdbc:h2:mem:testdb`  
- User: `sa` / Password: *(empty)*

### Step 3 – Start the frontend (Terminal 2)

1. **Terminal → New Terminal** (split terminal: click `+` or **Split Terminal**)
2. Run:

```powershell
cd frontend
npm install
npm run dev
```

3. Open: **`http://localhost:5173`**

### Step 4 – Sign in (Clerk)

1. You will be redirected to **Sign In**
2. Create an account or sign in (Clerk test key is already in `frontend/src/main.jsx`)
3. After login → **Dashboard**

### VS Code tips

- **Run both servers** every time you test (backend first, then frontend)
- If port **8081** is busy: stop other Java apps or change `server.port` in `pharma-backend/src/main/resources/application.properties`
- If port **5173** is busy: Vite will suggest another port in the terminal
- **Recommended extensions:** Extension Pack for Java, ESLint, REST Client (optional)

### Optional: VS Code `tasks.json` (two terminals at once)

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Backend",
      "type": "shell",
      "command": ".\\mvnw.cmd spring-boot:run -DskipTests",
      "options": { "cwd": "${workspaceFolder}/pharma-backend" },
      "isBackground": true
    },
    {
      "label": "Frontend",
      "type": "shell",
      "command": "npm run dev",
      "options": { "cwd": "${workspaceFolder}/frontend" },
      "isBackground": true
    },
    {
      "label": "Run Full Stack",
      "dependsOn": ["Backend", "Frontend"],
      "dependsOrder": "parallel"
    }
  ]
}
```

Run: **Terminal → Run Task → Run Full Stack**

---

## Part 2: Module-wise testing

**Before testing:** Backend on `8081`, frontend on `5173`, signed in.

Use **Pass / Fail** for each row. If API fails, check backend terminal for errors.

---

### Module 1 – Inventory & Stock Management

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 1.1 | Stock list | Sidebar → **Inventory** | Table of batches with product names, strip/tablet stock |
| 1.2 | Near expiry tab/section | Same page or **Expiry Tracking** | Items expiring within ~3 months |
| 1.3 | Aging report | Inventory → aging (if shown) or API | `GET http://localhost:8081/api/inventory/aging-report` → JSON list |
| 1.4 | Stock summary API | Browser/curl | `GET /api/inventory/stock-summary` → products with `in_stock` / `low_stock` |
| 1.5 | Stock after sale | Complete Module 4 bill first, recheck Inventory | Sold product quantity decreased |

---

### Module 2 – Expiry & Batch Tracking

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 2.1 | Near expiry | **Expiry Tracking** | List of batches with expiry dates |
| 2.2 | Expired | Same page or **Expiry Alerts** | Expired batches (if any in seed data) |
| 2.3 | Expiry PDF | **Reports** → download Expiry PDF | PDF file downloads |
| 2.4 | Supplier return | API/Postman: `POST /api/inventory/returns` body: `{ "batchId": 1, "strips": 1, "tablets": 0 }` | Success message; stock reduced |

---

### Module 3 – Purchase & Supplier

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 3.1 | Suppliers list | **Suppliers** | Suppliers from database |
| 3.2 | Add supplier | Fill form → Save | New row appears |
| 3.3 | Create pending PO | **Purchases** → Create Pending PO (supplier + PO number + amount) | New row with status **PENDING** |
| 3.4 | Receive stock | **Purchases** → Receive Stock (supplier, product, batch, qty, prices) | New purchase invoice; stock increases in Inventory |
| 3.5 | Supplier history | Suppliers → select supplier | Purchase history list |
| 3.6 | Pending API | `GET http://localhost:8081/api/purchases/pending` | JSON array |

---

### Module 4 – Sales & Billing

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 4.1 | Load products | **Billing** or **Sales** | Medicine dropdown populated |
| 4.2 | Company filter | Enter company name in filter | Dropdown/list filters by company |
| 4.3 | F1 / Ctrl+P | Press **F1** or **Ctrl+P** | Focus moves to medicine search |
| 4.4 | Strip billing | Select product → Strip → qty → Add → Save Bill | Bill saved; PDF/alert success |
| 4.5 | Tablet billing | Switch to Tablet mode → add line → Save | Line uses tablet qty |
| 4.6 | GST on bill | Check totals on bill preview | CGST + SGST shown |
| 4.7 | Dosage | Check Morning/Evening etc. → save | Saved (on invoice items) |
| 4.8 | Customer + doctor | Enter name, phone, doctor → save | Customer linked on invoice |
| 4.9 | Reprint API | `GET /api/sales/invoices/{id}` (use id from save) | Full invoice JSON with items |
| 4.10 | WhatsApp/SMS | After save → **WhatsApp/SMS** button | Success alert (logged on server) |

---

### Module 5 – Tax & Financial Accounting

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 5.1 | Accounting page | **Accounting** | Summary from real invoices (not random mock) |
| 5.2 | Period filter | Switch Today / Month / Year | Table updates |
| 5.3 | Accounting API | `GET /api/accounting/summary?period=month` | taxable, cgst, sgst, profit fields |
| 5.4 | GST CSV | **Reports** → GST CSV or `GET /api/reports/gst/monthly` | CSV downloads |

---

### Module 6 – Profit & Analytics Dashboard

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 6.1 | Dashboard KPIs | **Dashboard** | Today revenue, low stock, expiry counts |
| 6.2 | Today vs yesterday | Compare KPI cards | Values from API |
| 6.3 | P&L pie chart | Dashboard chart section | Cost vs Profit slices |
| 6.4 | Best sellers | Dashboard list/chart | Top medicines by quantity |
| 6.5 | Sales trend | 7-day chart | Last 7 days revenue |
| 6.6 | Analytics page | **Analytics** | Charts/metrics load without errors |

---

### Module 7 – Customer & Prescription

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 7.1 | Customer list | **Customers** | List loads |
| 7.2 | First-name lookup | Search type first name only (e.g. first word of seed customer) | “First-name matches” panel may appear |
| 7.3 | Select customer | Click a customer | Purchase history + **remaining balance** |
| 7.4 | Payment history | Customer detail panel | Payment rows from API |
| 7.5 | Add customer | Add New Customer form | Appears in list |
| 7.6 | Prescription schedule | **Medicine Schedule** (route if in app) or save form | “Prescription saved” |
| 7.7 | Lookup API | `GET /api/customers/lookup?firstName=Jane` | JSON with customer + history |

---

### Module 8 – Stock Alerts & Notifications

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 8.1 | Stock alerts page | **Stock Alerts** | Low stock, near expiry, expired tabs |
| 8.2 | Expiry alerts | **Expiry Alerts** (if routed) | Lists from API |
| 8.3 | Dashboard bell | **Dashboard** → notifications | Low stock / expiry items |
| 8.4 | Alerts API | `GET /api/notifications/alerts` | JSON: lowStock, nearExpiry, pendingPurchases |

---

### Module 9 – Report Generation

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 9.1 | Daily sales PDF | **Reports** → Daily PDF | `daily_sales.pdf` downloads |
| 9.2 | P&L PDF | P&L PDF button | `profit_loss.pdf` downloads |
| 9.3 | Stock / Expiry / Purchase / Medicines | Other report buttons | Each PDF downloads |
| 9.4 | Daily sales data | Reports → Daily Sales tab | Rows from backend invoices (after billing tests) |
| 9.5 | Medicines A–Z | Alphabetical tab | Products sorted A–Z |

---

### Module 10 – Product Master & Pricing

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 10.1 | List products | **Product Master** | Products from API (not hardcoded demo only) |
| 10.2 | Add product | Add form → Save | Appears in list; `POST /api/products` |
| 10.3 | Edit product | Edit → Save | Updates in list |
| 10.4 | Delete product | Delete → confirm | Removed from list |
| 10.5 | Medicines page | **Medicines** | Same catalog, search works |
| 10.6 | Add medicine | **Add Medicine** | Creates via API |

---

### Module 11 – Payment Processing

| # | Test | Steps | Expected |
|---|------|--------|----------|
| 11.1 | Payments list | **Payments** | Payments after bills recorded |
| 11.2 | Record payment | Select unpaid invoice → Cash/UPI → Record | New payment row |
| 11.3 | Filter by method | Filter Cash / UPI | Table filters |
| 11.4 | Payment on bill | Billing → Payment method Cash → Save Bill | Payment auto-created with sale |
| 11.5 | Receipt API | `GET /api/payments/receipt/1` | JSON receipt |
| 11.6 | Razorpay | Only if keys configured | `POST /api/payments/create-order` |

---

## Recommended test order

1. **Module 10** – Add products  
2. **Module 3** – Receive stock (creates batches)  
3. **Module 1 & 2** – Verify inventory & expiry  
4. **Module 4** – Create bills  
5. **Module 11 & 5** – Payments & accounting  
6. **Module 7** – Customers  
7. **Module 6, 8, 9** – Dashboard, alerts, reports  

---

## Quick API smoke test (PowerShell)

```powershell
Invoke-WebRequest -Uri "http://localhost:8081/api/analytics/dashboard" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:8081/api/products" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:8081/api/inventory/stock-list" -UseBasicParsing
```

All should return **StatusCode 200**.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Network error` in UI | Start backend; confirm `http://localhost:8081/api/analytics/dashboard` works |
| Blank after login | Check browser console; verify Clerk key in `main.jsx` |
| `mvn` not found | Use `.\mvnw.cmd` inside `pharma-backend` |
| Backend compile error | Run `.\mvnw.cmd compile` and fix errors shown |
| No data | H2 resets on restart — run **Receive Stock** and **Save Bill** again |
| CORS errors | Backend `WebConfig` allows `/api/**`; restart backend |

---

**Current run status:** Frontend `http://localhost:5173` | Backend `http://localhost:8081`
