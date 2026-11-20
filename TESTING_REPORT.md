# Testing Report

**Date:** 2026-10-31. **Environment:** Windows 11, Temurin JDK 21.0.13, Maven 3.9.11 (wrapper), Node 24.20, Chromium (Playwright 1.64).

Status key: **PASS** = tested and working · **FAIL** = tested and not working · **BLOCKED** = can't be tested without a missing credential or service · **NOT TESTED** = not verified.

## 1. Build results

| Build | Command | Result |
|---|---|---|
| Original frontend (before changes) | `npm install && npm run build && npm test` | PASS (8/8 tests; this was the only test file) |
| Original backend (before changes) | `mvn clean test` on JDK 21 | PASS (1 test, `contextLoads`) |
| **Final backend** | `./mvnw clean package` (tests **not** skipped) | **PASS: BUILD SUCCESS, 26/26 tests** |
| **Final frontend** | `npm run build` | **PASS** (no errors; chunk-size warning for the lazy charts/PDF chunks) |
| **Final frontend tests** | `npm test` | **PASS: 30/30** |
| **E2E** | `npx playwright test` | **19 passed, 0 failed, 13 skipped** (Clerk UI suite, BLOCKED; see §6) |

## 2. Backend automated tests (JUnit 5, Spring Boot test, MockMvc, H2 in-memory)

| Suite | Tests | Covers | Result |
|---|---|---|---|
| `GstCalculatorTest` | 6 | Inclusive GST split (₹112 → ₹100 + ₹6 + ₹6), loose units, paisa reconciliation (₹28.83 strip), discount before tax, 0% GST, invalid qty | PASS |
| `BusinessFlowIntegrationTest` | 10 | Supplier → product → receive (2 batches) → stock and ledger; FEFO bill split across batches; quote = bill; negative/empty/unknown/oversized/discount>100 rejected with stock untouched; credit sale → overpay rejected → pay → duplicate rejected; Razorpay disabled and mock signature rejected; customer/supplier balance protection; PO received once, selling > MRP and expired batches rejected; product delete blocked; opening stock sellable; supplier return credit and write-off; 2.8M-char prescription image saved | PASS |
| `SecurityIntegrationTest` | 6 | Health public; 7 business endpoints return 401 without a token and with a garbage token; valid token accepted; unknown routes 403; CORS allows only the configured origin; `azp` validator | PASS |
| `RazorpayVerificationIntegrationTest` | 3 | Valid HMAC → SUCCESS (idempotent); tampered and mock signatures → 400, persisted as FAILED; checkout failure recorded | PASS |
| `PharmacyBackendApplicationTests` | 1 | Context loads | PASS |

## 3. Frontend automated tests (Vitest)

| Suite | Tests | Covers | Result |
|---|---|---|---|
| `services/__tests__/api.test.js` | 7 | Clerk token **awaited** and sent as Bearer (the original code failed this); no header without a session; error messages from server, network and 401 | PASS |
| `pages/__tests__/pages.render.test.jsx` (jsdom + Testing Library) | 15 | Every page (Dashboard, Billing, Product Master, Inventory, Expiry, Medicine Schedule, Customers, Suppliers, Purchases, Reports, Payments, Accounting, Analytics, Settings) plus the main layout render with backend-shaped data, show that data, and log **no React errors** | PASS |
| `utils/__tests__/searchUtils.test.js` | 8 | Existing search helpers | PASS |

## 4. Live end-to-end: API (`frontend/e2e/api-flow.spec.js`)

Run against the **packaged jar** on port 8081 with a separate database file (`backend/data/e2e-test`) and demo data. Security was fully on: real RS256 signature, issuer, expiry and `azp` checks. The only difference from production is that tokens were signed by a local test issuer (`e2e/test-issuer.mjs`), plugged in through the documented `CLERK_JWKS_URI`/`CLERK_ISSUER` variables. No code bypass was used.

| # | Scenario (from the requested E2E list) | Result |
|---|---|---|
| 1 | Missing / tampered / expired / wrong-issuer / wrong-origin tokens → 401; valid → 200 | PASS |
| 3–5 | Add medicine, edit, search | PASS |
| 6–7 | Add customer, add supplier (GSTIN validated) | PASS |
| 8–10 | Create PO → receive 2 batches against it → inventory 0 → 100 units, ledger ₹800; second receive → 409 | PASS |
| 11–14 | Generate bill: quote = saved bill = ₹280.00 (taxable ₹250.00, CGST ₹15.00, SGST ₹15.00); FEFO 20 + 5 units across batches; stock 100 → 75; invoice detail with dosage | PASS |
| — | Negative / empty / insufficient-stock bills rejected, stock unchanged | PASS |
| 16–17 | Credit sale (paid ₹50 of ₹112) → overpay rejected → pay ₹62 → duplicate rejected → customer balance ₹0, 3 payments in history, total spend ₹392 | PASS |
| — | Razorpay without keys → 503; mock signature → 404 (unknown order) | PASS |
| 18 | Expiry alerts endpoint; supplier return credit ₹80; write-off 5 units; stock 50 | PASS |
| 19 | Reports: 9 PDFs (`%PDF` header checked) and GST CSV; dashboard and accounting figures consistent (profit = taxable − cost) | PASS |
| — | Delete product/customer with history → 409; clean customer → 204 | PASS |

## 5. Persistence

| Check | Result |
|---|---|
| Backend restarted on the same database file; the E2E medicine (stock 50) and all 203 invoices were still there; seeder did not run again | PASS |
| Default dev profile uses a file database (`backend/data/medbilling.mv.db`) | PASS (configuration plus the restart test above) |
| MySQL profile | NOT TESTED (MySQL is not installed on this machine; the configuration was reviewed) |

## 6. Browser checks (Playwright, Chromium)

| Check | Result |
|---|---|
| `/dashboard`, `/billing`, `/payments`, `/settings` redirect to `/sign-in` when signed out | PASS |
| Sign-in page at 375 / 768 / 1366 px: renders, no page errors, no horizontal scroll | PASS (after fixing the overlap and overflow found by this test) |
| Clerk sub-route `/sign-up/verify-email-address` stays on the Clerk page | PASS |
| **Sign up / sign in through Clerk** | **BLOCKED.** The dev instance shows a Cloudflare Turnstile CAPTCHA. Automating it needs Clerk Testing Tokens (secret key). |
| Signed-in UI: billing through the UI, invoice print/PDF, every page at desktop and phone width, refresh, sign-out | **BLOCKED** (same reason). Suite ready: `E2E_CLERK_UI=1 npm run test:e2e`. |

Screenshots: `frontend/e2e-artifacts/sign-in-375.png`, `sign-in-768.png`, `sign-in-1366.png`.

## 7. Module checklist

"API" = verified through the live API and JUnit. "UI" = render test with backend-shaped data. Interactive signed-in browser use is BLOCKED for every module (§6).

| Module | API | UI render | Notes |
|---|---|---|---|
| Sign in / Sign up / Sign out | PASS (token verification) | PASS | Interactive Clerk flow BLOCKED |
| Dashboard | PASS | PASS | |
| Billing / Sales | PASS | PASS | Print and PDF code paths not exercised in a real browser |
| Product Master (Medicines, Add Medicine) | PASS | PASS | |
| Inventory | PASS | PASS | |
| Expiry Tracking / Alerts / Stock Alerts | PASS | PASS | |
| Medicine Schedule | NOT TESTED (no automated test posts a prescription) | PASS | |
| Customers | PASS | PASS | |
| Suppliers | PASS | PASS | |
| Purchases | PASS | PASS | |
| Reports | PASS | PASS | |
| Payments (cash/UPI/card) | PASS | PASS | |
| Payments (Razorpay live checkout) | PASS (server-side signature verification with test secret) | PASS | Real checkout BLOCKED: no Razorpay test keys provided |
| Accounting | PASS | PASS | |
| Analytics | PASS | PASS | |
| Settings | n/a (browser storage) | PASS | |
| Responsive layout (signed-in pages) | — | — | NOT TESTED in a real browser (BLOCKED by sign-in) |

## 8. How to reproduce

```bash
# backend unit + integration
cd backend && ./mvnw clean package

# frontend unit + render
cd frontend && npm test

# live E2E (three terminals)
cd frontend && node e2e/test-issuer.mjs
cd backend  && DB_URL="jdbc:h2:file:./data/e2e-test" DEMO_DATA_ENABLED=true \
               CLERK_JWKS_URI=http://localhost:9999/.well-known/jwks.json CLERK_ISSUER=http://localhost:9999 \
               java -jar target/pharmacy-backend-0.0.1-SNAPSHOT.jar
cd frontend && npm run dev   # then, in another terminal: npx playwright install chromium && npm run test:e2e
```

Use a separate `DB_URL` for E2E runs, as shown. The suites create records with unique names and never delete existing data.
