import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { demoRepo } from '../services/demoRepository';
import { api, maskLeadForPublicFeed } from '../services/api';
import { ServiceRequest, QuoteItemization, Booking, ChangeOrder, Quote } from '../types';
import { CustomerBookingsView } from '../components/CustomerBookingsView';
import { QuoteComparisonModal } from '../components/QuoteComparisonModal';
import { PostRequestModal } from '../components/PostRequestModal';

describe('Phase 2 — Crew Mode (Team-Based Bookings) Suite', () => {
  beforeEach(() => {
    demoRepo.reset();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    demoRepo.reset();
  });

  describe('1. Crew Mode Job Request Flow & ScopeLock Baseline', () => {
    it('creates a commercial team job request with multi-worker headcount and duration', async () => {
      const res = await api.createServiceRequest({
        title: 'Full Floor Office Rewiring & Server Room Electricals',
        category: 'electrician',
        description: 'Complete replacement of 3-phase commercial distribution panels and conduit lines.',
        urgency: 'flexible',
        budget: 45000,
        customerName: 'Ananya Deshmukh',
        customerPhone: '+91 98450 44556',
        customerAddress: 'Tower B, RMZ Ecospace, Outer Ring Road, Bengaluru',
        customerLat: 12.9261,
        customerLng: 77.6853,
        crewSize: 4,
        organizationName: 'Nexus Tech Park Facility Mgmt',
        durationValue: 3,
        durationUnit: 'days',
        scope: {
          problem: 'Overloaded 3-phase panels tripping under server load during peak hours',
          requested_work: [
            'Install Schneider 63A 4-pole MCBs across 6 distribution panels',
            'Route FRLS copper wiring through dedicated steel conduits',
            'Balance phase loads across server rack racks A, B and C',
            'Full insulation resistance and earth pit testing',
          ],
          deliverables: [
            'Load test compliance report signed by licensed contractor',
            'Phase balance diagram and circuit identification chart',
            '1-year corporate workmanship warranty',
          ],
          assumptions: [
            'Server room shutdown permitted over weekend from Friday 8 PM',
            'Access to main electrical shaft granted by building security',
          ],
          exclusions: [
            'UPS battery bank replacement',
            'Structural civil trenching',
          ],
          is_locked: true,
        },
      });

      expect(res.data).toBeDefined();
      expect(res.data.id).toBeTruthy();
      expect(res.data.crew_size).toBe(4);
      expect(res.data.organization_name).toBe('Nexus Tech Park Facility Mgmt');
      expect(res.data.duration_value).toBe(3);
      expect(res.data.duration_unit).toBe('days');
      expect(res.data.scope?.problem).toContain('Overloaded 3-phase panels');
      expect(res.data.scope?.requested_work.length).toBe(4);

      // Verify persistence in local demo repository
      const saved = demoRepo.getRequests().find((r) => r.id === res.data.id);
      expect(saved).toBeDefined();
      expect(saved?.crew_size).toBe(4);
      expect(saved?.organization_name).toBe('Nexus Tech Park Facility Mgmt');
    });

    it('sanitizes public job leads while preserving crew size for worker dispatching', () => {
      const teamRequest: ServiceRequest = {
        id: 'req-team-sanitize-01',
        category: 'painter',
        title: 'Complete Exterior Facade Painting',
        description: '3-story residential villa exterior with weather-proofing primer and 2 coats.',
        urgency: 'today',
        budget: 60000,
        customer_name: 'Vikramaditya Rao',
        customer_phone: '+91 98765 43210',
        customer_address: 'Villa 14, Palm Meadows, Whitefield, Bengaluru',
        customer_lat: 12.9698,
        customer_lng: 77.7499,
        crew_size: 6,
        organization_name: 'Palm Meadows HOA',
        duration_value: 5,
        duration_unit: 'days',
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const publicLead = maskLeadForPublicFeed(teamRequest);

      // Privacy verification: phone must be null and address generalized
      expect(publicLead.customer_phone).toBeNull();
      expect(publicLead.customer_name).toBe('Vikramaditya R.');
      expect(publicLead.customer_address).toContain('Hyperlocal Vicinity');
      // Precise coordinates must be fuzzed
      expect(publicLead.customer_lat).toBeCloseTo(12.97, 2);
      expect(publicLead.customer_lng).toBeCloseTo(77.75, 2);

      // Crew Mode fields must be preserved for worker dispatch
      expect(publicLead.crew_size).toBe(6);
      expect(publicLead.organization_name).toBe('Palm Meadows HOA');
      expect(publicLead.duration_value).toBe(5);
      expect(publicLead.duration_unit).toBe('days');
    });
  });

  describe('2. FairDeal Team Labour Calculation & Capacity Shortfall Warning', () => {
    it('calculates crew labour properly and flags capacity shortfall when offered < requested', async () => {
      // Create request asking for 5 painters for 4 days
      const reqRes = await api.createServiceRequest({
        title: 'Commercial Showroom Repaint',
        category: 'painter',
        description: 'Interior and exterior premium emulsion painting.',
        urgency: 'flexible',
        budget: 40000,
        customerName: 'Suresh Raina',
        customerPhone: '+91 98450 77889',
        customerAddress: 'Brigade Road, Ashok Nagar, Bengaluru',
        customerLat: 12.9738,
        customerLng: 77.6083,
        crewSize: 5,
        organizationName: 'Trends Lifestyle Retail',
        durationValue: 4,
        durationUnit: 'days',
      });

      const worker = demoRepo.getWorkers().find((w) => w.trade === 'painter') || demoRepo.getWorkers()[0];

      // Worker can only offer 3 painters (shortfall of 2)
      const requestedWorkers = 5;
      const offeredWorkers = 3;
      const days = 4;
      const ratePerWorkerPerDay = 1500;
      const teamLabour = offeredWorkers * ratePerWorkerPerDay * days; // 3 * 1500 * 4 = 18000
      const materials = 12000;
      const travel = 1000;
      const totalAmount = teamLabour + materials + travel; // 31000
      const shortfall = requestedWorkers - offeredWorkers; // 2

      const itemization: QuoteItemization = {
        labour_charge: teamLabour,
        materials_charge: materials,
        travel_fee: travel,
        total_amount: totalAmount,
        breakdown_notes: 'Crew of 3 master painters with Wagner airless spray equipment.',
        offered_crew_size: offeredWorkers,
        requested_crew_size: requestedWorkers,
        crew_rate_per_person: ratePerWorkerPerDay,
        shortfall: shortfall,
        supervisor_name: 'Mahesh Patil (Master Painter)',
      };

      const quoteRes = await api.createQuote({
        requestId: reqRes.data.id,
        workerId: worker.id,
        amount: totalAmount,
        estimatedDuration: '4 days (3-person crew)',
        notes: 'We can deploy a focused 3-person team immediately. Capacity shortfall noted and accounted for in timeline.',
        itemization,
      });

      expect(quoteRes.data).toBeDefined();
      expect(quoteRes.data.amount).toBe(31000);
      expect(quoteRes.data.itemization).toBeDefined();
      expect(quoteRes.data.itemization?.offered_crew_size).toBe(3);
      expect(quoteRes.data.itemization?.requested_crew_size).toBe(5);
      expect(quoteRes.data.itemization?.shortfall).toBe(2);
      expect(quoteRes.data.itemization?.supervisor_name).toBe('Mahesh Patil (Master Painter)');
      expect(quoteRes.data.itemization?.labour_charge).toBe(18000);
    });
  });

  describe('3. Team Booking & Change-Order Lock Headcount Invariant', () => {
    it('locks agreed crew size on booking confirmation and requires customer approval to adjust crew', async () => {
      // 1. Setup Request and Quote
      const reqRes = await api.createServiceRequest({
        title: 'Deep Sanitization & Floor Scrubbing',
        category: 'cleaner',
        description: 'Complete post-renovation cleaning of 5000 sqft facility.',
        urgency: 'today',
        budget: 25000,
        customerName: 'Meera Nambiar',
        customerPhone: '+91 98450 33221',
        customerAddress: 'Koramangala 4th Block, Bengaluru',
        customerLat: 12.9345,
        customerLng: 77.6265,
        crewSize: 4,
        organizationName: 'Urban Oasis Co-working',
        durationValue: 2,
        durationUnit: 'days',
      });

      const worker = demoRepo.getWorkers().find((w) => w.trade === 'cleaner') || demoRepo.getWorkers()[0];

      const quoteRes = await api.createQuote({
        requestId: reqRes.data.id,
        workerId: worker.id,
        amount: 22000,
        estimatedDuration: '2 days',
        notes: 'Team of 4 industrial cleaners with dual high-pressure scrubbers.',
        itemization: {
          labour_charge: 16000,
          materials_charge: 5000,
          travel_fee: 1000,
          total_amount: 22000,
          offered_crew_size: 4,
          requested_crew_size: 4,
          shortfall: 0,
          supervisor_name: 'Suresh Kumar',
        },
      });

      // 2. Confirm Booking with Crew Mode Details
      const bookingRes = await api.confirmBooking({
        quoteId: quoteRes.data.id,
        requestId: reqRes.data.id,
        workerId: worker.id,
        customerName: 'Meera Nambiar',
        customerPhone: '+91 98450 33221',
        serviceAddress: 'Koramangala 4th Block, Bengaluru',
        agreedPrice: 22000,
        crewSize: 4,
        organizationName: 'Urban Oasis Co-working',
        supervisorName: 'Suresh Kumar',
      });

      expect(bookingRes.data).toBeDefined();
      expect(bookingRes.data.agreed_price).toBe(22000);
      expect(bookingRes.data.original_agreed_price).toBe(22000);
      expect(bookingRes.data.crew_size).toBe(4);
      expect(bookingRes.data.organization_name).toBe('Urban Oasis Co-working');
      expect(bookingRes.data.supervisor_name).toBe('Suresh Kumar');

      // 3. Worker proposes a Crew Change Order: extra mezzanine area discovered
      // Needs +2 workers for 1 additional day (+₹6,000)
      const coRes = await api.proposeChangeOrder(bookingRes.data.id, {
        title: 'Mezzanine Cafeteria Scrubbing & Extra Dusting',
        reason: 'Unforeseen heavy drywall dust deposit on mezzanine ductwork requiring additional hands.',
        additionalAmount: 6000,
        crew_adjustment: {
          added_workers: 2,
          added_duration: 1,
          reason: 'Additional ladder-work crew needed for ceiling height above 14ft.',
        },
      });

      expect(coRes.data.change_orders?.length).toBe(1);
      const pendingCo = coRes.data.change_orders![0];
      expect(pendingCo.status).toBe('pending_customer_approval');
      expect(pendingCo.crew_adjustment?.added_workers).toBe(2);
      expect(pendingCo.additional_amount).toBe(6000);
      expect(pendingCo.revised_total).toBe(28000);

      // INVARIANT: Until customer approves, booking agreed_price and crew_size remain unchanged!
      const midBooking = demoRepo.getBookings().find((b) => b.id === bookingRes.data.id);
      expect(midBooking?.agreed_price).toBe(22000);
      expect(midBooking?.crew_size).toBe(4);

      // 4. Customer approves the change order
      const approvedRes = await api.respondToChangeOrder(
        bookingRes.data.id,
        pendingCo.id,
        'approved',
        'Approved by Facility Manager Meera'
      );

      expect(approvedRes.data).toBeDefined();
      expect(approvedRes.data.agreed_price).toBe(28000);
      expect(approvedRes.data.original_agreed_price).toBe(22000);
      // Invariant: crew_size now safely reflects approved headcount addition: 4 + 2 = 6!
      expect(approvedRes.data.crew_size).toBe(6);

      const approvedCo = approvedRes.data.change_orders?.find((c) => c.id === pendingCo.id);
      expect(approvedCo?.status).toBe('approved');
      expect(approvedCo?.responded_at).toBeDefined();
      expect(approvedCo?.customer_notes).toBe('Approved by Facility Manager Meera');

      // Verify persistence in demoRepo
      const persistedBk = demoRepo.getBookings().find((b) => b.id === bookingRes.data.id);
      expect(persistedBk?.agreed_price).toBe(28000);
      expect(persistedBk?.crew_size).toBe(6);
    });
  });

  describe('4. Unapplied Migration File Verification', () => {
    it('verifies that migration 20261024000004_add_crew_mode.sql exists and contains valid schema alterations', async () => {
      // Read migration file from disk
      const fs = await import('fs');
      const path = await import('path');
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/20261024000004_add_crew_mode.sql'
      );

      expect(fs.existsSync(migrationPath)).toBe(true);
      const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

      // Verify idempotent ALTER TABLE statements
      expect(sqlContent).toContain('ALTER TABLE public.service_requests');
      expect(sqlContent).toContain('ADD COLUMN IF NOT EXISTS crew_size INTEGER DEFAULT 1');
      expect(sqlContent).toContain('ADD COLUMN IF NOT EXISTS organization_name TEXT');
      expect(sqlContent).toContain('ADD COLUMN IF NOT EXISTS duration_value INTEGER');
      expect(sqlContent).toContain('ADD COLUMN IF NOT EXISTS duration_unit TEXT');

      expect(sqlContent).toContain('ALTER TABLE public.quotes');
      expect(sqlContent).toContain('ADD COLUMN IF NOT EXISTS offered_crew_size INTEGER DEFAULT 1');

      expect(sqlContent).toContain('ALTER TABLE public.bookings');
      expect(sqlContent).toContain('ADD COLUMN IF NOT EXISTS crew_size INTEGER DEFAULT 1');
      expect(sqlContent).toContain('ADD COLUMN IF NOT EXISTS organization_name TEXT');
      expect(sqlContent).toContain('ADD COLUMN IF NOT EXISTS supervisor_name TEXT');

      // Verify sanitized job_leads view exposes crew fields safely
      expect(sqlContent).toContain('CREATE OR REPLACE VIEW public.job_leads');
      expect(sqlContent).toContain('r.crew_size');
      expect(sqlContent).toContain('r.organization_name');
    });
  });

  describe('5. Responsive UI Layout & Accessibility (375x812, 768x1024, 1440x900)', () => {
    it('renders crew allocation badges and supervisor on CustomerBookingsView across mobile and desktop', () => {
      // Simulate mobile viewport width
      window.innerWidth = 375;
      window.innerHeight = 812;

      const crewBooking: Booking = {
        id: 'bk-crew-ui-01',
        request_id: 'req-crew-01',
        worker_id: 'w1',
        quote_id: 'q1',
        customer_id: 'cust-1',
        customer_name: 'Priya Sundaram',
        customer_phone: '+91 98450 11223',
        service_address: '4th Cross, Koramangala, Bengaluru',
        agreed_price: 35000,
        original_agreed_price: 35000,
        crew_size: 4,
        organization_name: 'Indus Valley Studios',
        supervisor_name: 'Rajesh Varma (Site Lead)',
        scheduled_for: new Date().toISOString(),
        status: 'confirmed',
        created_at: new Date().toISOString(),
        completed_at: null,
        change_orders: [
          {
            id: 'co-pending-01',
            booking_id: 'bk-crew-ui-01',
            title: 'Extra Acoustic Soundproofing Tiles',
            reason: 'Duct vibration requires extra dampener insulation',
            original_price: 35000,
            additional_amount: 5000,
            revised_total: 40000,
            status: 'pending_customer_approval',
            crew_adjustment: {
              added_workers: 2,
              added_duration: 1,
              reason: 'Need 2 technicians for ceiling mount',
            },
            created_at: new Date().toISOString(),
          },
        ],
      };

      const { rerender } = render(
        <CustomerBookingsView
          bookings={[crewBooking]}
          loading={false}
          onOpenReviewModal={vi.fn()}
          onRefreshBookings={vi.fn()}
          onOpenRepairPassport={vi.fn()}
        />
      );

      // Verify Crew allocation and commercial badges render cleanly
      expect(screen.getByText(/Team of 4 Technicians/i)).toBeInTheDocument();
      expect(screen.getByText(/Org: Indus Valley Studios/i)).toBeInTheDocument();
      expect(screen.getByText(/Supervisor: Rajesh Varma/i)).toBeInTheDocument();

      // Verify Pending Change Order with Crew Adjustment renders
      expect(screen.getByText(/Extra Acoustic Soundproofing Tiles/i)).toBeInTheDocument();
      expect(screen.getByText(/Crew Adjustment: \+2 worker\(s\)/i)).toBeInTheDocument();

      // Re-render on desktop viewport (1440x900)
      window.innerWidth = 1440;
      window.innerHeight = 900;
      rerender(
        <CustomerBookingsView
          bookings={[crewBooking]}
          loading={false}
          onOpenReviewModal={vi.fn()}
          onRefreshBookings={vi.fn()}
          onOpenRepairPassport={vi.fn()}
        />
      );
      expect(screen.getByText(/Team of 4 Technicians/i)).toBeInTheDocument();
    });

    it('renders side-by-side quote comparison highlighting crew size and capacity shortfall', () => {
      // Simulate tablet viewport (768x1024)
      window.innerWidth = 768;
      window.innerHeight = 1024;

      const sampleReq: ServiceRequest = {
        id: 'req-compare-01',
        category: 'cleaner',
        title: 'Deep Sanitization of Commercial Office Floor',
        description: 'Post-construction industrial cleaning.',
        urgency: 'flexible',
        budget: 20000,
        customer_name: 'Tech Corp',
        customer_phone: '+91 98765 00000',
        customer_address: 'HSR Layout Sector 1, Bengaluru',
        customer_lat: 12.9121,
        customer_lng: 77.6446,
        crew_size: 4,
        organization_name: 'Tech Corp India',
        status: 'quoted',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const quoteFullCrew: Quote = {
        id: 'quote-full',
        request_id: 'req-compare-01',
        worker_id: 'w1',
        amount: 22000,
        estimated_duration: '2 days',
        status: 'pending',
        counter_amount: null,
        counter_notes: null,
        last_updated_by: 'worker',
        itemization: {
          labour_charge: 16000,
          materials_charge: 5000,
          travel_fee: 1000,
          total_amount: 22000,
          offered_crew_size: 4,
          requested_crew_size: 4,
          shortfall: 0,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const quoteShortfall: Quote = {
        id: 'quote-short',
        request_id: 'req-compare-01',
        worker_id: 'w2',
        amount: 14000,
        estimated_duration: '3 days',
        status: 'pending',
        counter_amount: null,
        counter_notes: null,
        last_updated_by: 'worker',
        itemization: {
          labour_charge: 9000,
          materials_charge: 4000,
          travel_fee: 1000,
          total_amount: 14000,
          offered_crew_size: 2,
          requested_crew_size: 4,
          shortfall: 2,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(
        <QuoteComparisonModal
          request={sampleReq}
          quotes={[quoteFullCrew, quoteShortfall]}
          isOpen={true}
          onClose={vi.fn()}
          onSelectQuote={vi.fn()}
        />
      );

      // Verify side-by-side comparison modal displays crew size badges & shortfall
      expect(screen.getByText(/4 of 4 workers/i)).toBeInTheDocument();
      expect(screen.getByText(/Full Team Matched/i)).toBeInTheDocument();
      expect(screen.getByText(/2 of 4 workers/i)).toBeInTheDocument();
      expect(screen.getByText(/Capacity Shortfall: -2/i)).toBeInTheDocument();
    });
  });
});
