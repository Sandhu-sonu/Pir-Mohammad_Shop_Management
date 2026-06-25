# ਪੰਜਾਬ ਦੁਕਾਨ ਪ੍ਰਬੰਧਕ | Punjab Shopkeeper Management System

A simple, fast, bilingual (Punjabi + English), mobile-first shop management system tailored for Kirana shops, mobile stores, hardware shops, and general retailers in Punjab, India.

---

## 🛠️ Technology Stack
* **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
* **Backend**: Server Actions, Route Handlers
* **Database**: PostgreSQL (with Prisma ORM & pg driver adapter)
* **Validation**: Zod & React Hook Form
* **State Management**: Zustand (with localStorage persistence)
* **Reporting**: Recharts, xlsx (Excel exporter), jspdf (PDF exporter)

---

## ⚙️ Project Structure

```text
/prisma                # Database schema and seed scripts
/src/app               # Next.js App Router (dashboard, POS sales, customers, reports)
/src/components        # Theme providers, navigation bars, desktop sidebar
/src/hooks             # Bilingual useTranslation dictionary hook
/src/validation        # Form verification Zod schemas
/src/db                # Prisma client setup, Repository pattern, and Services
/src/lib/actions       # Encapsulated Next.js Server Actions
/src/lib/store         # Local Zustand preferences store
/src/lib/translations  # Bilingual translation keys (English + Punjabi)
```

---

## 🚀 Running Locally

Follow these quick commands to spin up the database and run the shop terminal:

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Rename `.env.example` to `.env` and fill in your PostgreSQL credentials:
```bash
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/punjab_shopkeeper?schema=public"
```

### 3. Spin up PostgreSQL Database (Docker)
If you prefer running a local PostgreSQL container:
```bash
docker compose up -d
```

### 4. Create Tables and Seed Data
Apply the Prisma schema migrations and seed default products (Flour, Sugar, Tea) and accounts:
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the application.

---

## 🔑 Login Credentials
Log in instantly using the default credentials:
* **Mobile / Username**: `admin`
* **Password**: `admin123`

---

## 🧪 Testing Checklist
Verify system business rules by executing the backend test suite:
```bash
npx tsx scratch/run-tests.ts
```
The test suite validates:
1. Prevents negative stock.
2. Log-timeline for stock history transaction ledgers.
3. Customer outstanding balance formulas (Opening + Sales - Payments).
4. Point of Sale checkout atomic flow.
5. Invoices reversal and cash reconciliation.
