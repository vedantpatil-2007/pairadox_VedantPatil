# SkillNear (PS03)

> **Hyperlocal On-Demand Blue-Collar Services Platform**  
> Hackathon MVP prototype built for Problem Statement 03 (PS03).

SkillNear connects urban households with verified local blue-collar professionals—**Electricians, Plumbers, Cleaners, and Painters**—using deterministic distance-based matching, transparent service rate cards, interactive price negotiation (quotes & counteroffers), confirmed appointment scheduling, and review feedback.

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
3. Open and run the schema migration file:
   - [`supabase/migrations/20261024000001_create_skillnear_schema.sql`](file:///supabase/migrations/20261024000001_create_skillnear_schema.sql)
4. Open and run the repeatable seed data file:
   - [`supabase/seed.sql`](file:///supabase/seed.sql)
5. Alternatively, click the **"Preview Mode / Supabase Live"** pill in the top navigation bar inside the SkillNear web app to open the built-in SQL viewer and copy the entire migration with 1 click.

### Schema Overview
| Table | Description |
|---|---|
| `workers` | Fictional demo technician profiles (name, trade, hourly rate, rating, coordinates, bio, demo flag) |
| `services` | Upfront fixed offerings provided by workers with estimated duration and base prices |
| `service_requests` | Customer job postings with description, urgency (`immediate`, `today`, `flexible`), and budget |
| `quotes` | Technician price quotes and customer counteroffers (`pending`, `countered`, `accepted`, `rejected`) |
| `bookings` | Confirmed appointments with agreed rate, customer address, and status progression |
| `reviews` | Customer ratings (1-5 stars) and feedback comments on completed bookings |

### Row Level Security (RLS)
All six tables have Row Level Security enabled. For this milestone prototype, public policies grant the `anon` role select/insert/update capabilities using the publishable key. In a production build with authenticated accounts, policies would strictly enforce `auth.uid() = customer_id` or `auth.uid() = worker_id`.

---

## 🧪 Testing & Verification Results

### Running Automated Tests
```bash
npm test
```
All **18 automated tests** pass across 4 test suites:
- `src/test/geo.test.ts`: Haversine spherical distance calculation, meter/km formatting, and coordinate matching (5 tests).
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
