# SkillNear (PS03)

> **Hyperlocal On-Demand Blue-Collar Services Platform**  
> Hackathon MVP prototype built for Problem Statement 03 (PS03).

SkillNear connects urban households with verified local blue-collar professionals—**Electricians, Plumbers, Cleaners, and Painters**—using deterministic distance-based matching, transparent service rate cards, interactive price negotiation (quotes & counteroffers), confirmed appointment scheduling, and review feedback.

---

## 🔒 Defining USP: ScopeLock™ + FairDeal™
> *"Clear scope. Comparable quotes. No unapproved changes."*

SkillNear eliminates the #1 frustration in on-demand home services: uncommunicated scope creep, non-transparent quotes, and mid-job price surprises.

1. **Phase 1 — ScopeLock™ (Structured Specifications)**:
   - Customers define structured work specifications: Problem, Requested Tasks, Deliverables, Urgency, Budget, Assumptions, and explicit Exclusions.
   - Auto-populated trade presets for Plumbing, Electrical, Cleaning, and Painting accelerate request creation.
   - Rendered as unified **Scope Cards** across customer broadcasts, worker leads, and active bookings.
2. **Phase 2 — FairDeal™ (Itemized Comparable Quotes)**:
   - Technicians submit quotes with itemized breakdowns: **Labour**, **Materials (with item-by-item specs & brands)**, and **Travel Fee**.
   - Total quote amount is cryptographically and mathematically verified to equal `Labour + Materials + Travel`.
   - **Side-by-Side Quote Comparison**: Customers click *"Compare Quotes (FairDeal™)"* to inspect multiple bids on a unified ScopeLock baseline.
3. **Phase 3 — Change-Order Lock™ (Price Invariant Enforcement)**:
   - The agreed price is strictly locked upon initial booking confirmation (`original_agreed_price`).
   - If a technician discovers unforeseen issues, they submit a formal Scope Change Order with title, reason, and revised total.
   - **Customer Sign-Off Required**: The agreed price cannot change without customer approval. If rejected, the price remains locked at the baseline.
4. **Phase 4 — Repair Passport™ (Digital Service Record)**:
   - Completed bookings generate a structured digital service record with a unique passport ID.
   - Includes agreed scope sign-off, financial audit trail (`Original Quote` + `Approved Change Orders` = `Final Agreed Total`), verified change-order history with no unapproved changes recorded, and explicitly recorded parts/warranty notes.

---

## 🌟 Key Highlights & Architectural Features

1. **Persistent PostgreSQL Database via Supabase**:
   - Uses Supabase PostgreSQL as the source of truth via `@supabase/supabase-js`.
   - Tables: `workers`, `services`, `service_requests`, `quotes`, `bookings`, `reviews`.
   - Complete SQL migrations (`supabase/migrations/`) with deterministic repeatable seed scripts (`supabase/seed.sql`).
   - Row Level Security (RLS) enabled on all tables with explicit access policies.
   - **Zero Secret Exposure**: Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are used in client code. The `service_role` key is strictly forbidden and never exposed.
2. **Transparent Dual-Engine Operation**:
   - **Live Database Mode**: When valid Supabase credentials are configured in `.env`, all operations execute live PostgreSQL queries against Supabase.
   - **Local Simulation Mode**: If credentials are missing, the UI gracefully falls back to an in-memory simulation with an explicit, persistent banner explaining that data is held in memory and **never pretends that local mock data was saved to Supabase**.
   - Includes a 1-click **Setup & SQL Migration Modal** right in the top navigation bar.
3. **Deterministic Hyperlocal Matching & GPS Fallback**:
   - Calculates real-time distance in kilometers using the spherical **Haversine formula**.
   - Workers are ordered by proximity to the customer's current service location.
   - Integrated with HTML5 Geolocation API (`navigator.geolocation`) with a robust manual selector for Bangalore metro neighborhoods (Koramangala, Indiranagar, HSR Layout, BTM Layout, Jayanagar, Bellandur, Whitefield) if geolocation is denied or unavailable.
4. **End-to-End Negotiation & Booking Workflow**:
   - **Customer Flow**: Browse technicians & rate cards &rarr; Post an on-demand job broadcast &rarr; Receive worker bids &rarr; Counteroffer proposed rates &rarr; Agree on price &rarr; Lock in a confirmed booking &rarr; Simulate technician arrival & completion &rarr; Rate & review with 1-5 stars.
   - **Worker Flow**: Switch to the **Worker Portal** &rarr; View open job leads in your trade within your area &rarr; Submit quotes &rarr; Respond to customer counteroffers &rarr; Manage assigned bookings.
5. **Ethical Evaluation Notice & Scope Discipline**:
   - All demo worker records are fictional and explicitly labelled with **"Demo Profile (Simulation)"**.
   - Clear disclaimers clarify that no genuine identity verification or commercial licensing is claimed.
   - In accordance with milestone 1 constraints, payment gateways, paid APIs, and unnecessary auth barriers are avoided so evaluators can test customer and worker personas immediately.
   - Zero dead buttons; loading, empty, success, and error states are implemented for all actions.

---

## 📱 Responsive Design Verification

Tested and verified across key viewport breakpoints:
- **Mobile**: `375 x 812` (iPhone X / iOS viewport standard)
- **Tablet**: `768 x 1024` (iPad portrait standard)
- **Desktop / Laptop**: `1440 x 900` (Modern desktop standard)

Automated tests in `src/test/responsive.test.tsx` verify layout integrity and component accessibility across all three resolutions.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v3
- **Database Client**: `@supabase/supabase-js` (PostgreSQL with RLS)
- **Icons**: Lucide React (`lucide-react`)
- **Testing**: Vitest, React Testing Library, `@testing-library/jest-dom`, `jsdom`

---

## 🚀 Quickstart & Setup Instructions

### 1. Prerequisites
- Node.js (v18+ or v20+ recommended)
- npm or pnpm

### 2. Installation
```bash
# Clone or navigate to the repository
cd skillnear-ps03

# Install dependencies
npm install
```

### 3. Environment Variables (Optional for Live Supabase)
SkillNear works out-of-the-box in **Local Preview Mode** without any configuration. To connect persistent Supabase PostgreSQL storage:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Populate `.env` with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-publishable-key-here
   ```
   > ⚠️ **Security Warning**: Only provide your project URL and publishable (anon) key. **NEVER expose your `service_role` key in frontend code.**

---

## 🗄️ Database Setup & SQL Migrations

### Running Migrations on Supabase
1. Log in to [supabase.com](https://supabase.com) and create or open your project.
2. In the Supabase Dashboard, navigate to **SQL Editor** &rarr; **New Query**.
3. **If setting up a fresh database**:
   - Open and run the initial schema migration: [`supabase/migrations/20261024000001_create_skillnear_schema.sql`](file:///supabase/migrations/20261024000001_create_skillnear_schema.sql)
4. **If updating an existing database with the corrective security fix**:
   - Open and run the corrective migration: [`supabase/migrations/20261024000002_secure_job_leads_view.sql`](file:///supabase/migrations/20261024000002_secure_job_leads_view.sql)
5. Open and run the repeatable seed data file:
   - [`supabase/seed.sql`](file:///supabase/seed.sql)
6. Alternatively, click the **"Preview Mode / Supabase Live"** pill in the top navigation bar inside the SkillNear web app to toggle between Migration 1 and Migration 2 and copy the SQL with 1 click.

### Schema Overview
| Table / View | Type | Description | Access & Privacy Guard |
|---|---|---|---|
| `workers` | Table | Fictional demo technician profiles (trade, hourly rate, rating, coordinates, bio) | Public read-only for browsing. No anonymous modifications. |
| `services` | Table | Upfront fixed offerings provided by workers with estimated duration and base prices | Public read-only for rate card discovery. |
| `service_requests` | Table | Customer job postings with description, urgency, budget, coordinates | Ownership-restricted (`customer_id = auth.uid()`). Direct SELECT shields phone & full street address. |
| `job_leads` | View | Hyperlocal job broadcast feed for technicians and discovery | **Security Barrier View**: Masks `customer_phone` to `NULL`, `customer_address` to general vicinity, `customer_name` to first name + initial, and coordinates to coarse ~1.1 km precision. |
| `quotes` | Table | Technician price quotes and customer counteroffers (`pending`, `countered`, `accepted`, `rejected`) | Restricted to request owner (`customer_id`) and quoting worker (`creator_id`). |
| `bookings` | Table | Confirmed appointments with agreed rate, customer contact, and status progression | Restricted to confirmed customer and assigned technician. Auto-populates verified contact details via database trigger upon confirmation. |
| `reviews` | Table | Customer ratings (1-5 stars) and feedback comments on completed bookings | Public read-only for ratings; write allowed for verified completed bookings. |

### Row Level Security (RLS) & Least-Privilege Architecture
SkillNear implements a least-privilege security design combining Row Level Security (RLS) with Supabase Anonymous Authentication:
1. **Public Job Feed Privacy Shield (`public.job_leads`)**:
   - Uses `WITH (security_barrier = true, security_invoker = false)`: Definer execution ensures the view can read `service_requests` while strictly projecting only sanitized columns, and `security_barrier` prevents side-channel filter-pushdown attacks.
   - **Phone Redaction**: `customer_phone` is strictly `NULL` for all non-owners (including demo rows where `customer_id IS NULL`).
   - **Address Masking**: `customer_address` is masked to `'Hyperlocal Vicinity (Exact address provided upon confirmed booking)'` for all non-owners.
   - **Name Anonymization**: `customer_name` is masked to first name + initial (e.g. `'Arjun M.'`).
   - **Coordinate Obfuscation**: `customer_lat` and `customer_lng` are rounded to 2 decimal places (`round(..., 2)` &rarr; ~1.1 km neighborhood resolution), preventing exact residence tracking while preserving distance calculations.
   - **Eligible Leads Only**: Filtered to `WHERE status IN ('open', 'quoted')` (or own requests).
2. **Direct Table Protection (`public.service_requests`)**:
   - Direct `SELECT` on `public.service_requests` is restricted by RLS strictly to the request owner (`auth.uid() = customer_id`) or an assigned technician of a confirmed booking.
   - A request does **not** become readable merely because a booking exists for it. Caller's `auth.uid()` is verified against trusted customer ownership or the technician who authored the accepted quote.
   - `OR customer_id IS NULL` is removed, so raw tables cannot be scraped.
   - Cross-table policy recursion is avoided using a `SECURITY DEFINER STABLE` helper function `app_private.fn_is_booking_technician_or_participant` with explicit `SET search_path = ''` placed in an unexposed private schema (`app_private`).
3. **Hardened Bookings Table Protection (`public.bookings`)**:
   - The `bookings` table contains private customer contact information (`customer_phone`, `service_address`).
   - Direct `SELECT`, `INSERT`, and `UPDATE` are strictly restricted to the customer owner (`auth.uid() = customer_id`) or the assigned technician whose accepted quote is tied to the booking.
   - `OR customer_id IS NULL` is completely eliminated. Unrelated authenticated users and anonymous callers receive 0 rows.
   - Technicians only receive customer phone and exact address **after booking confirmation**.
   - A `SECURITY DEFINER` trigger `app_private.fn_sync_booking_customer_details` with `SET search_path = ''` in schema `app_private` automatically synchronizes verified contact info into `public.bookings` upon confirmation.
4. **Private Schema Isolation & Least Privilege (`app_private`)**:
   - Internal helper functions and trigger functions are isolated in `app_private` and completely unexposed to the Supabase Data API (PostgREST).
   - `USAGE ON SCHEMA app_private` is granted strictly to `authenticated` (revoked from `PUBLIC` and `anon`).
   - `app_private.fn_is_booking_technician_or_participant` is executable strictly by `authenticated`.
   - `app_private.fn_sync_booking_customer_details` has direct execution revoked from `PUBLIC`, `anon`, and `authenticated` (fired solely by the Postgres trigger engine).
5. **Demo Worker Workflow Simulation**:
   - Fictional demo workers lack Supabase Auth accounts. Database RLS denies them access to raw private customer records.
   - Their demo technician workflows remain safely simulated in client state until production authentication is provisioned.
6. **Ownership-Based Access**:
   - `service_requests`, `bookings`, and `reviews` track `customer_id UUID DEFAULT auth.uid()`.
   - The frontend initializes a persistent Supabase Anonymous Session (`signInAnonymously()`), providing an unforgeable `auth.uid()`.
7. **Explicit PostgREST Data API Grants**:
   - For Supabase projects where automatic table exposure of new tables is disabled:
     - `GRANT USAGE ON SCHEMA public TO anon, authenticated;`
     - `SELECT` on `workers`, `services`, and `job_leads`
     - `SELECT, INSERT, UPDATE` on `service_requests`, `quotes`, and `bookings`
     - `SELECT, INSERT` on `reviews`
     - `NOTIFY pgrst, 'reload schema';` to immediately refresh PostgREST schema cache.

---

## 🧪 Testing & Verification Results

### Running Automated Tests
```bash
npm test
```
All **36 automated tests** pass across 6 test suites:
- `src/test/geo.test.ts`: Haversine spherical distance calculation, meter/km formatting, and coordinate matching (5 tests).
- `src/test/supabase_config.test.ts`: Shared configuration detection and connection verification (2 tests).
- `src/test/security_job_leads.test.ts`: Job lead privacy masking (NULL phone, masked address, anonymized name, coarse coordinates), distance calculation integrity, owner access, post-booking technician details access, unrelated authenticated user denial, booking contact shielding, demo worker simulation isolation, missing-column migration compatibility, legacy permissive policy purge, anonymous write blocking, cross-customer booking rejection, quote/request mismatch rejection, immutable field protection, and review authorization (16 tests).
- `src/test/api.test.ts`: Worker querying, category filtering, job creation, quote submission, counteroffer negotiation, booking confirmation, and review submission (7 tests).
- `src/test/components.test.tsx`: Component rendering, persona toggling, disclaimer banners, and button triggers (3 tests).
- `src/test/responsive.test.tsx`: Viewport testing at `375x812` (mobile), `768x1024` (tablet), and `1440x900` (desktop) (3 tests).

### Production Build
```bash
npm run build
```
Builds cleanly with TypeScript compiler (`tsc -b`) and Vite:
```
dist/index.html                   1.09 kB │ gzip:  0.60 kB
dist/assets/index-BSdwGy6g.css   29.76 kB │ gzip:  6.05 kB
dist/assets/index-DiCV2nYA.js   360.29 kB │ gzip: 98.74 kB
✓ built in 949ms
```

### Running Local Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🔄 Step-by-Step Workflow Walkthrough

1. **Browse Technicians**:
   - View electricians, plumbers, cleaners, and painters with calculated distances from your selected location.
   - Switch location in the top bar (e.g. from *Koramangala* to *Indiranagar* or *GPS Location*) and observe the distance calculations update instantly.
2. **Post an On-Demand Job**:
   - Click **"Post Job"** or **"Broadcast a Job Request"**.
   - Choose a trade category (e.g. Plumber), enter a title and description, choose urgency, and set a target budget.
   - Click **"Submit Service Request"**.
3. **Switch to Worker Portal**:
   - Click **"Worker Portal"** in the top navigation bar.
   - Choose a technician persona from the dropdown (e.g., *Ramesh Kumar - Plumber*).
   - Under the **"Hyperlocal Job Leads"** tab, see the newly broadcasted request with the exact distance from the technician's workshop.
   - Click **"Send Quote"** and submit an offer (e.g. ₹500, 1.5 hours).
4. **Negotiate as Customer (Counteroffer)**:
   - Switch back to **"Customer"** mode and click the **"My Requests & Quotes"** tab.
   - View the received quote from the technician.
   - Click **"Counteroffer"**, propose ₹450 with a note: *"Can do ₹450 if you arrive in 1 hour."*
   - Switch to **"Worker Portal"** and see the active counteroffer under **"My Quotes & Negotiations"**.
5. **Confirm Booking**:
   - As either customer or worker, click **"Agree & Confirm Booking"** to finalize the price and select a scheduled time window.
   - The booking is locked in PostgreSQL (or local memory) and moves to the **"Active Bookings & Reviews"** tab.
6. **Simulate Service Execution & Review**:
   - On the booking card, click **"Simulate Technician Arrived (Start Job)"** &rarr; status updates to `in_progress`.
   - Click **"Mark Job Completed"** &rarr; status updates to `completed`.
   - Click **"Leave Review & Rating"**, select 5 stars, enter feedback, and submit. The technician's profile rating updates!
