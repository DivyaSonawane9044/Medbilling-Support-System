# Bug Fix Report

IDs match `PROJECT_AUDIT_REPORT.md`. Status: **FIXED** (changed and covered by a test listed in TESTING_REPORT), **FIXED*** (changed and build-verified, but only render-tested, not browser-tested with a signed-in user), **OPEN** (not fixed; see "Remaining issues").

## Repository and build

| # | Problem | Fix | Status |
|---|---|---|---|
| R1 | 6,516 source files deleted from the working tree | Restored from HEAD (`frontend/src`, `public`, backend). The uncommitted `index.html` edit was backed up and HEAD's version restored. | FIXED |
| R2 | `node_modules` (6,763 files) and `dist` committed to Git | Untracked with `git rm --cached` and ignored. History is untouched. | FIXED |
| R3 | No Maven wrapper; `.gitignore` excluded `mvnw` | Added `backend/mvnw`, `mvnw.cmd`, `.mvn/` (Maven 3.9.11); rewrote `.gitignore` | FIXED |
| R4 | Folder `pharma-backend` | `git mv` to `backend/`; references updated | FIXED |
| R5 | Stray files: root `package-lock.json`, `pharma-backend/package-lock.json`, `patch_billing*.py`, JVM crash logs, `medicines.json` | Removed from the repo. The untracked crash logs and `medicines.json` were moved out of the project, not deleted. | FIXED |
| R6 | Outdated docs claiming "92% complete" and PostgreSQL | Replaced by README and the reports | FIXED |
| R7 | Unused dependencies `quagga`, `react-icons` (pulled in deprecated `request`) and the unused PostgreSQL driver | Removed | FIXED |
| R8 | 11 production npm vulnerabilities (2 critical: `@clerk/shared`, `jspdf`) | `npm audit fix`, jsPDF 2 → 4.2.1. 2 moderate remain (react-router 6, fix needs v7). | FIXED (partly) |
| R9 | Vite dev server crashed (EBUSY) while tests wrote reports | Ignore test output folders in the Vite watcher | FIXED |

## Security

| # | Problem | Fix | Status |
|---|---|---|---|
| C1 | Backend had no authentication; every `/api/**` endpoint was open | Spring Security OAuth2 resource server. Clerk session JWTs (RS256) are verified against Clerk's JWKS, with issuer, expiry and `azp` (authorised origin) checks. Only `/api/health` is public. Unknown routes are denied. | FIXED |
| C2 | Frontend sent `Bearer [object Promise]` | Interceptor awaits `Clerk.session.getToken()` | FIXED |
| C5 | Fake Razorpay success: hardcoded `mock_signature_dev` was accepted | Mock path removed in both backend and frontend. Signature verified with a constant-time HMAC compare. Unconfigured = disabled (503). | FIXED |
| H9 | Public debug routes `/auth-test`, `/debug-auth`, `/login-test` | Routes and pages removed | FIXED |
| H18 | CORS allowed any origin with credentials; MySQL `root/root` hardcoded | CORS limited to `CORS_ALLOWED_ORIGINS`; DB credentials from env | FIXED |
| S1 | Clerk publishable key and API URL hardcoded in source | Moved to `VITE_*` env (`.env` is gitignored, `.env.example` added) | FIXED |
| S2 | Payment amount for Razorpay came from the client | Server computes it from the invoice's outstanding balance and stores the order | FIXED |
| S3 | Client could set customer balance, supplier ledger and product stock through PUT/POST | Updates copy only editable fields; balances and stock change only through business operations | FIXED |
| S4 | Error responses could not be read; failures came back as 500 with no message | `GlobalExceptionHandler`: consistent JSON with correct 400/404/409/503 codes and no stack traces | FIXED |

## Billing and money

| # | Problem | Fix | Status |
|---|---|---|---|
| C3 | Negative quantity accepted: negative invoice, stock **increased**, negative payment | Every line must have qty > 0 and an existing product; the whole sale rolls back otherwise | FIXED |
| C4 | Empty bills created ₹0 invoices | Rejected (400) | FIXED |
| C6 | Duplicate payments: each "record" paid the full total again | `PaymentService`: amount ≤ outstanding; a fully paid invoice returns 409 | FIXED |
| C7 | Billing UI showed made-up prices (`10 × (1+margin)`, 12% or 5% GST) | UI prices every cart change with `POST /api/sales/quote`, which runs the same code as `/bill`; the invoice is printed from saved server data | FIXED |
| C8 | Customers charged **above MRP** (GST added on top) | MRP-basis pricing: batch selling price is GST-inclusive and capped at MRP; taxable, CGST and SGST are back-calculated in `BigDecimal` (`GstCalculator`) | FIXED |
| B1 | GST fixed at 12% for every product | New per-product `gstRate` (0–28%, default 12) | FIXED |
| B2 | Sale failed if no single batch had enough stock | FEFO allocation across several batches, with row locking | FIXED |
| B3 | Same medicine added twice billed as two independent lines | Merged per product | FIXED |
| B4 | Walk-in part-payment silently lost the due amount | Credit sale requires a customer; change is never recorded as payment | FIXED |
| B5 | No discount despite the requirement | Optional bill discount %, applied before the tax split | FIXED |
| C10 | Prescription image (base64) overflowed VARCHAR(255) and rolled back the sale | Column is now a LOB; 2 MB client-side limit | FIXED |
| H10 | Billing form prefilled with a fake customer ("Jane Doe", "Dr. A. Sharma", phone); previous customer ID reused; dosage of the last item applied to all | Empty form; ID cleared on edit or save; dosage stored per item | FIXED |
| B6 | Customer matched by name only (two patients with the same name merged) | Matched by name + phone, or by a unique name | FIXED |
| B7 | Invoice number `INV-<millis>` could collide | `INV-yyyyMMdd-HHmmss-NNN` with a uniqueness check | FIXED |
| B8 | Print: Ctrl+P hijacked, PDF said "PROVISIONAL", long bills squashed onto one page, no batch/expiry/HSN | `window.print()`, shortcut moved to F1/Ctrl+K, PDF from the saved invoice split across pages, full tax-invoice fields | FIXED* |
| B9 | "Auto print on add" never worked | Removed (it called the print code with stale state) | FIXED |

## Inventory, purchases, catalogue

| # | Problem | Fix | Status |
|---|---|---|---|
| C9 | Two sources of stock: hand-typed `Product.quantity` vs batches | Batches are the only source; `Product.quantity` is derived (`StockService`). New products can include opening stock that becomes a real batch. | FIXED |
| I1 | Three different "units per pack" rules (Syrup/Bottle handling inconsistent) | One rule in `StockService.unitsPerPack` | FIXED |
| H4 | Receive without `totalAmount` → 500; PO could never be received from the UI; PO receivable twice; no validation | Total computed when missing; receive against PO (must be `PENDING`, same supplier); line validation (dates, prices > 0, selling ≤ MRP, qty > 0); duplicate invoice numbers rejected; UI with PO picker and multi-line receipts | FIXED |
| H6 | Deleting a product with batches returned a 500 foreign-key error | 409 with an explanation | FIXED |
| H16 | Product Master MRP, cost and GST fields not saved; edits wiped `unitType`/`volumeMl`/`weightGm` | DTO-based create/update; edit starts from the full product; GST select; opening-stock section | FIXED* |
| I2 | `POST /api/inventory/batch` could never succeed (`@JsonIgnore` supplier) | Removed (unused); replaced by opening stock and purchases | FIXED |
| I3 | Seeder made invalid stock (100 loose tablets on an 11-tablet strip), selling > MRP, zero GST, no payments | Seeder uses the real pricing and stock code; opt-in only | FIXED |
| I4 | No way to remove expired stock | `POST /api/inventory/batches/{id}/write-off` plus a UI button | FIXED |
| I5 | Expiry page: supplier "N/A", stock value ₹0, pending-PO page crashed on entity JSON | DTO has supplier, cost and selling price; pending POs returned as flat rows | FIXED |
| I6 | Stock summary left out products with zero stock and counted expired stock as sellable | All products included; `saleableUnits` excludes expired batches | FIXED |
| I7 | Supplier history showed remaining stock as "quantity supplied" | `received_strips` stored on each batch | FIXED |

## Customers, suppliers, payments

| # | Problem | Fix | Status |
|---|---|---|---|
| H1 | Customer PUT replaced the whole record (wiped fields, set balance) | Merge of editable fields only; validation | FIXED |
| H2 | Customer payment accepted negative or excess amounts and kept no record | Validated; `Payment` row created | FIXED |
| H3 | Supplier PUT on an unknown ID → 500; ledger overwritable; payment unvalidated | 404; ledger protected; amount > 0 | FIXED |
| H14 | Customer prescriptions stored in localStorage under key "undefined"; spend always ₹0; search box lost focus | Prescriptions saved to the backend; real totals; search no longer unmounts the input | FIXED* |
| P1 | Customer had no edit, delete or collect-payment UI | Added (delete blocked when history exists) | FIXED* |
| P2 | Razorpay failures/cancels not recorded; payments list showed no status/reference | `POST /api/payments/failed`; statuses CREATED/SUCCESS/FAILED; reference column | FIXED |
| P3 | `/reports/customer/{id}` reported every customer's sales | Uses only that customer's invoices | FIXED |
| P4 | PDF generation errors returned 200 with a broken file | Errors now propagate (500 with message) | FIXED |

## Dashboard, analytics, accounting, settings, layout

| # | Problem | Fix | Status |
|---|---|---|---|
| H11 | Dashboard "Recent Sales" fake, trends hardcoded, "Monthly Profit" showed today, fake chart fallback | Real invoices; trend from today vs yesterday; `monthlyProfit`; honest empty states | FIXED* |
| H12 | Analytics read localStorage that nothing wrote (always ₹0); mock profit split | Built on `/api/analytics/dashboard` | FIXED* |
| H13 | Accounting profit hardcoded at 25% | Uses `/api/accounting/summary` | FIXED* |
| A1 | Profit counted GST collected as income | Profit = taxable value − cost, everywhere | FIXED |
| H15 | Settings saved to localStorage but never loaded; fake users table and fake GSTIN; empty tabs | Loads saved settings; blank defaults; shows the real Clerk user; empty tabs removed. Shop details feed the invoice header. | FIXED* |
| H7 | Clerk sign-in/sign-up sub-steps bounced back to `/sign-in` (email verification and MFA impossible) | Routes `/sign-in/*`, `/sign-up/*` | FIXED |
| H8 | Duplicate/dead pages (`Medicines`, `AddMedicine`, `ExpiryAlerts`, `StockAlerts`, `DashboardSimple`, `ProductMasterTest`, …) | Deleted (still in Git history); routes kept, pointing at the working pages; `App.jsx` cut from 454 to ~110 lines | FIXED |
| H17 | Fixed 260px sidebar with no mobile behaviour | Off-canvas sidebar with a hamburger below 900px | FIXED* |
| L1 | Navbar bell hardcoded "3", search box did nothing, role hardcoded | Real alert count; search opens Product Master; role removed | FIXED* |
| L2 | Sign-in page on phones: form header overlapped the badges; false claims ("HIPAA-style", "24/7 uptime", "role-based access"); dead "Forgot password"/"Contact support" links | Layout grows on small screens with the form first; claims corrected; dead links replaced by an accurate hint | FIXED |
| L3 | `Settings.css` global `.btn` rules restyled every button after visiting Settings | Scoped to `.settings-container` | FIXED |
| L4 | Report downloads ignored the server filename and content type; Blob error bodies unreadable | `downloadBlob` reads `Content-Disposition`; error interceptor parses Blob JSON | FIXED |

## Remaining issues (not fixed)

1. **Browser sign-in E2E is BLOCKED.** The Clerk dev instance shows a Cloudflare Turnstile CAPTCHA on sign-up, so automated sign-in needs Clerk Testing Tokens (requires the Clerk secret key). The opt-in suite is `frontend/e2e/clerk-ui.spec.js` (`E2E_CLERK_UI=1`).
2. **Role-based access is not implemented.** Every signed-in Clerk user has full access. Add roles through Clerk session claims and `@PreAuthorize` before you have staff with different privileges.
3. **SMS/WhatsApp** only log to the server; no provider is integrated.
4. **No stock-adjustment history table.** Write-offs and returns are logged to the application log only, and supplier payments update the ledger without a payment-history row.
5. **GST rates.** Existing and seeded products default to 12%. Since the September 2025 GST rationalisation many medicines are taxed at 5%. **Set the correct rate per medicine and confirm with your tax adviser.**
6. **react-router 6** has 2 moderate advisories; the fix requires the v7 upgrade. Dev-only tooling (vite 5, vitest 1) has advisories fixed in later major versions.
7. Existing MySQL databases need the manual column changes in `DATABASE_DOCUMENTATION.md` §5.
8. The Clerk token's `azp` claim is checked only when present (Clerk always sends it for browser sessions).
