# MedBilling Support System

Pharmacy billing and inventory system with a React (Vite) frontend and a Spring Boot backend. Covers GST billing on the MRP basis, batch-wise stock with FEFO, purchases, customers, suppliers, payments (cash/UPI/card, plus optional Razorpay), expiry tracking, reports and analytics.

```
MEDBILLING-SUPPORT-SYSTEM/
├── frontend/   React 18 + Vite 5, Clerk auth, Axios, Recharts, jsPDF   → http://localhost:5173
├── backend/    Spring Boot 4 (Java 17+), Spring Data JPA, Spring Security → http://localhost:8081
├── README.md
├── PROJECT_AUDIT_REPORT.md   what was found
├── BUG_FIX_REPORT.md         what was fixed
├── TESTING_REPORT.md         what was tested, with results
└── DATABASE_DOCUMENTATION.md schema, relationships, profiles
```

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Java JDK | **17 or newer** (tested with Temurin 21) | Java 8 will not work. Set `JAVA_HOME`. |
| Node.js | 18+ (tested with 24) | |
| Maven | not needed | Use the wrapper `backend/mvnw` (`mvnw.cmd` on Windows) |
| MySQL | optional, 8.x | Only for the `mysql` profile |

## Quick start (development)

**1. Backend**

```bash
cd backend
# optional: sample data on first run (empty database only)
export DEMO_DATA_ENABLED=true          # PowerShell: $env:DEMO_DATA_ENABLED="true"
./mvnw spring-boot:run                 # Windows: .\mvnw.cmd spring-boot:run
```

Check that it is up: `curl http://localhost:8081/api/health` should return `{"status":"UP","database":"H2"}`.

**2. Frontend**

```bash
cd frontend
cp .env.example .env                   # then set VITE_CLERK_PUBLISHABLE_KEY
npm install
npm run dev                            # http://localhost:5173
```

Sign up or sign in with Clerk. Every page except sign-in and sign-up needs a signed-in user, and every backend `/api/**` call needs a valid Clerk session token.

## Configuration

### Backend (environment variables; see `backend/.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `SERVER_PORT` | `8081` | HTTP port |
| `DB_URL` | `jdbc:h2:file:./data/medbilling` | Database URL. The default is a **persistent** H2 file in `backend/data/`. |
| `DB_USERNAME` / `DB_PASSWORD` | `sa` / empty | Database credentials (required for MySQL) |
| `DEMO_DATA_ENABLED` | `false` | Seeds about 300 sample medicines, customers and invoices **only into an empty database** |
| `CLERK_ISSUER` | dev instance | Clerk Frontend API URL (Clerk Dashboard → API Keys) |
| `CLERK_JWKS_URI` | dev instance | `<issuer>/.well-known/jwks.json` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Browser origins allowed to call the API. Also checked against the token's `azp` claim. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | empty | Leave empty to disable online payments. Use `rzp_test_…` keys for testing. |

**MySQL:** create a database user, then:

```bash
export DB_USERNAME=medbilling DB_PASSWORD='…'
./mvnw spring-boot:run -Dspring-boot.run.profiles=mysql
```

The database `pharmacy_db` is created automatically if it doesn't exist.

### Frontend (`frontend/.env`; see `frontend/.env.example`)

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend URL, default `http://localhost:8081` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk **publishable** key (`pk_…`). Never put the Clerk secret key (`sk_…`) in the frontend. |

## Build for production

```bash
cd backend  && ./mvnw clean package        # runs all tests; output: target/pharmacy-backend-0.0.1-SNAPSHOT.jar
java -jar target/pharmacy-backend-0.0.1-SNAPSHOT.jar

cd frontend && npm ci && npm run build     # output: dist/ (serve with any static host; SPA fallback to index.html)
```

For production:
- Use the `mysql` profile, or another persistent `DB_URL`.
- Point the Clerk variables at your production instance.
- Set `CORS_ALLOWED_ORIGINS` to the real site URL.
- Serve over HTTPS.

## Tests

| Command | What it runs |
|---|---|
| `cd backend && ./mvnw test` | 26 JUnit tests: GST maths, full business flows over HTTP with MockMvc, security, Razorpay signature verification |
| `cd frontend && npm test` | 30 Vitest tests: API client, a render test for every page, search utilities |
| `cd frontend && npm run test:e2e` | Playwright tests against the running servers (see `TESTING_REPORT.md` for setup) |

## Business rules worth knowing

- **Prices are GST-inclusive (MRP basis).** The batch selling price is what the customer pays per pack, and it is capped at MRP. Taxable value, CGST and SGST are worked back from it. The GST rate is set per medicine in Product Master (default 12%).
- **Stock lives in batches.** Purchases create batches. Sales take from the earliest-expiring unexpired batch first (FEFO), split across batches when needed. A medicine's "quantity" is the total of its batches and cannot be typed in. A new medicine can be created with opening stock, which becomes a real batch.
- **Payments can't exceed what is owed.** A bill can be part-paid only when a customer is named, and the balance goes on the customer's account. Later payments are checked against the outstanding amount.
- **Razorpay** payments count only after the server verifies Razorpay's signature. Without keys, online payment is switched off; there is no demo or mock mode.
- **SMS/WhatsApp** messages are written to the server log only; no provider is integrated.
