# SkillNear PS03 — Problem Statement Alignment, Professional Branding & Scope Freeze

**Platform:** SkillNear  
**Product Positioning:** SkillNear — Local services. Clear agreements. Fair pricing.  
**Core Product Promise:** *“Clear scope. Comparable quotes. No unapproved changes.”*  
**Problem Statement Identifier:** PS03 — Hyperlocal On-Demand Blue-Collar Services Platform  
**Document Version:** 2.0.0 (Master Improvement Baseline)  
**Audit Date:** October 24, 2026  

---

## 1. Problem Statement Alignment & Baseline Definition

### 1.1 Local Source Audit & Missing Source Disclosure
A comprehensive audit of the workspace and system download directories was conducted:
* **Discovered Local File:** `C:\Users\HP\Downloads\Hack_in_Hills_26_Problem_Statements.docx`. In this file, track **PS03** corresponds to *"Commodity Derivatives Intelligence (AUREX)"* (MCX gold futures relative value modeling), belonging to a separate fintech competition.
* **Missing Source Disclosure:** The official competition document for the hyperlocal blue-collar services track (`skillnear-ps03`) is not locally present.
* **Provisional Baseline Protocol:** Per explicit governance instructions (*"If the official problem statement is not available, explicitly identify that limitation and use the existing project description only as a provisional baseline. Do not invent competition requirements or claim that the product meets unknown judging criteria."*), the project specifications in `README.md` and repository code form the **provisional baseline**.

### 1.2 Core Product Focus & Scope Freeze Directives
SkillNear connects homeowners with nearby service providers, enables useful service requests and quotations, confirms bookings, and preserves transparent agreements:
1. **Four Core Trades Only:** The service catalogue is strictly frozen at **Electrician, Plumber, Cleaner, Painter**. Any expansion to 50+ service categories is excluded.
2. **Zero-Cost Constraint:** Only free, open-source tools and open-data services (OpenStreetMap Overpass API, Nominatim geocoding, Leaflet). Google Places and all billable APIs remain disabled; zero billing accounts or paid upgrades.
3. **Professional Presentation:** Remove all internal project labels (`PS03`, `PS03 Hyperlocal`, `Hackathon Prototype`, `Evaluation Only`, `Test Job`). Replace repetitive internal disclaimers with a single, restrained data-status indicator and consistent **Sample profile** labels for fictional records.
4. **Real Geographic Discovery:** Replace decorative SVG radars with genuine Leaflet geographic street maps with OpenStreetMap tiles, actual business coordinates, and separation of service professionals from retail supply shops.
5. **No Silent Fallbacks:** Failed live directory queries report explicit, retryable errors rather than silently substituting sample Bengaluru fixtures.
6. **No Remote Database Alteration:** Remote SQL execution against Supabase is prohibited. Migrations are prepared as declarative files for review only.
7. **Agreement Invariants Preserved:** 
   - Pending change orders do not alter the agreed price.
   - Rejected change orders leave the agreed baseline strictly intact.
   - Approved change orders preserve the original price baseline and approval history.
   - Repair Passports reflect recorded work, approved changes, and final agreed totals without fabricated payments or warranties.

### 1.3 OpenStreetMap Overpass Architecture & Spatial Performance Notes
* **Spatial Bounding-Box Constraint:** Bounding-box indexing `[bbox:south,west,north,east]` spatially bounds candidate elements before statement evaluation. We do not assert that tag regexes were necessarily evaluated globally without profiling evidence; rather, bounding boxes leverage spatial indices to prune candidates.
* **Haversine Circular Distance Validation:** Because bounding boxes are rectangular, records located in the corners exceed the circular radius. Every returned element (nodes using `el.lat`/`el.lon`, ways using `el.center.lat`/`el.center.lon`) is strictly filtered via Haversine distance (`calculateDistanceKm <= params.radiusKm`). For instance, a record at 5.67 km from the query center is strictly excluded from a 5 km search and included in a 10 km search.
* **Public Server Latency & Failover Protocol:** Public Overpass community servers (`overpass-api.de`, `overpass.kumi.systems`) experience fluctuating global loads, with query response latencies occasionally reaching 15–30 seconds, or returning HTTP 502/504 gateway errors. The client uses bounded 14s per-attempt timeouts and sequential mirror failover. Deliberate user cancellations (e.g. changing location, radius, or category) immediately abort in-flight requests without triggering retries or fallback queries.

---

## 2. Requirement-to-Feature Traceability Matrix

| Req ID | Requirement Description | Implementing Component(s) | Architectural Status | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | **Hyperlocal Location & Proximity Engine**<br>Haversine distance math, 1–20 km radius filters, manual search (city/neighbourhood/address/PIN), map click selection, optional on-demand GPS. | `src/lib/geo.ts`<br>`src/components/LocationModal.tsx`<br>`src/services/places/geocodingService.ts` | **Implemented** | `src/test/geo.test.ts`<br>`src/test/places_discovery.test.tsx`<br>`src/test/e2e_workflow.test.ts` |
| **REQ-02** | **Four Frozen Trade Categories**<br>Electrician, Plumber, Cleaner, and Painter only. Zero catalogue bloat. | `src/types/index.ts`<br>`src/components/WorkerList.tsx`<br>`src/services/demoRepository.ts` | **Implemented** | `src/test/api.test.ts`<br>`src/test/components.test.tsx` |
| **REQ-03** | **Professional Brand & Customer Messaging**<br>Clean homepage ("Find trusted local help for your home"), no internal PS03 badges, no hackathon judging jargon, restrained "Sample profile" badges. | `index.html`<br>`src/components/Navbar.tsx`<br>`src/components/WorkerList.tsx`<br>`src/components/BannerDisclaimer.tsx` | **Implemented** | `src/test/components.test.tsx` |
| **REQ-04** | **ScopeLock™ Structured Job Specifications**<br>Structured capture of problem description, requested tasks, deliverables, budget, urgency, assumptions, and exclusions. Public feeds sanitized. | `src/components/PostRequestModal.tsx`<br>`src/services/api.ts` | **Implemented** | `src/test/scopelock_fairdeal.test.ts`<br>`src/test/security_job_leads.test.ts` |
| **REQ-05** | **FairDeal™ Itemized Comparable Quotes**<br>Itemized labour, materials, travel breakdown. Validates Total = Labour + Materials + Travel. Side-by-side quote comparison on identical scope. | `src/components/SubmitQuoteModal.tsx`<br>`src/components/QuoteComparisonModal.tsx`<br>`src/services/api.ts` | **Implemented** | `src/test/scopelock_fairdeal.test.ts`<br>`src/test/e2e_workflow.test.ts` |
| **REQ-06** | **Interactive Negotiation Desk**<br>Customer and worker counteroffers with role attribution, counter notes, and price locking upon agreement. | `src/components/CounterofferModal.tsx`<br>`src/components/CustomerQuotesView.tsx` | **Implemented** | `src/test/e2e_workflow.test.ts` |
| **REQ-07** | **Change-Order Lock™ & Agreement Invariants**<br>In-flight scope changes require explicit customer approval. Invariants: pending change preserves current price; rejection preserves original agreed price; approval updates to revised total. | `src/components/ProposeChangeOrderModal.tsx`<br>`src/components/WorkerDashboard.tsx`<br>`src/services/demoRepository.ts` | **Implemented** | `src/test/scopelock_fairdeal.test.ts`<br>`src/test/e2e_workflow.test.ts` |
| **REQ-08** | **Repair Passport™ Post-Job Audit Record**<br>Digital service record generated upon completion. Audits original scope, approved change orders, parts installed, warranty terms, and verifies 0 unapproved changes. | `src/components/RepairPassportModal.tsx`<br>`src/services/api.ts` | **Implemented** | `src/test/scopelock_fairdeal.test.ts`<br>`src/test/e2e_workflow.test.ts` |
| **REQ-09** | **Real Geographic Street Map (Leaflet + OSM)**<br>Replaces decorative SVG radar with genuine Leaflet map, OpenStreetMap tiles, actual business pins, search radius circle, and bidirectional marker/list sync. | `src/components/GeographicPlacesMap.tsx`<br>`src/components/NearbyBusinessesView.tsx` | **Implemented** | `src/test/places_discovery.test.tsx` |
| **REQ-10** | **Live Open-Data Discovery & Shop/Service Separation**<br>Default OpenStreetMap Overpass provider. Separates service professionals (`craft=*`) from retail supply shops (`shop=*`). Clear error and empty states; no silent substitution. | `src/services/places/openStreetMapAdapter.ts`<br>`src/services/places/placesService.ts` | **Implemented** | `src/test/places_discovery.test.tsx` |
| **REQ-11** | **Customer Privacy & Data Guard**<br>Masks phone numbers (`+91 98450 XXXXX (Demo)`), suppresses addresses in public lead views, coarsens coordinates to ~1.1 km. | `supabase/migrations/20261024000002_secure_job_leads_view.sql`<br>`src/services/demoRepository.ts` | **Implemented** | `src/test/security_job_leads.test.ts` (21 tests) |
| **REQ-12** | **Dual-Engine Persistence & 3-Tier Health**<br>Separates verified live Supabase from persistent browser localStorage demo repository (`skillnear_demo_repository_v2`). Rating baseline math preserved. | `src/services/demoRepository.ts`<br>`src/lib/supabase.ts` | **Implemented** | `src/test/persistence_and_auth.test.ts` |
| **REQ-13** | **Crew Mode (Multi-Technician Bookings)** *(Supporting)*<br>Multi-worker commercial jobs with headcount, duration, and crew change order adjustments. | `src/components/PostRequestModal.tsx`<br>`src/components/ProposeChangeOrderModal.tsx` | **Implemented** (Frozen) | `src/test/crew_mode.test.tsx` |

---

## 3. Capability Classification

### 3.1 Live & Verified Capabilities
- **Leaflet Geographic Map & OSM Tiles:** Genuine street map rendering with zoom, pan, marker selection, search radius boundary, and map-click coordinate selection.
- **OpenStreetMap Overpass API Live Querying:** Free open-data queries retrieving nearby registered electrical, plumbing, cleaning, and painting businesses.
- **Nominatim Geocoding:** Explicit manual location lookups (city, neighbourhood, PIN code) without requiring GPS.
- **Browser LocalStorage Persistence:** Job requests, itemized quotes, counteroffers, bookings, change orders, and customer reviews survive page refresh.
- **ScopeLock + FairDeal + Change-Order Lock Core Engine:** Complete quotation, negotiation, agreement locking, and Repair Passport generation.

### 3.2 Simulated & Protected Capabilities
- **Sample Worker Profiles:** Demo workers (e.g., Rajesh Sharma, Sunita Devi, Ramesh Kumar) are clearly and consistently labelled as **Sample profile**.
- **External Business Separation:** Third-party businesses discovered via OpenStreetMap are explicitly segregated from SkillNear demo providers; launching a workflow from an external listing creates a SkillNear request and does not dispatch to the third-party business.
- **Google Places API Guard:** Held behind an informative prerequisite and billing advisory modal; no billable calls are executed.

---

## 4. Deferred / Out-of-Scope Items

To prevent scope creep and maintain alignment with the PS03 mission, the following items are deferred:
1. **57-Category Service Catalogue:** Deferred. Strictly frozen at Electrician, Plumber, Cleaner, and Painter.
2. **Paid Mapping Providers:** Google Maps JavaScript API, Google Places, Mapbox, and other billable APIs remain disabled.
3. **Live Payment Gateways:** Razorpay, Stripe, or UPI integrations requiring real financial credentials remain deferred; transaction settlements are audited in the Repair Passport.
4. **Further Crew Mode Enhancements:** Frozen as a completed supporting capability.
5. **Remote Supabase DDL:** Migrations are reviewed offline and not executed against remote databases.
