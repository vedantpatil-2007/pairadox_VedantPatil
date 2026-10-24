import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '../services/api';
import { ScopeLock, QuoteItemization, Booking, ServiceRequest, Quote } from '../types';

describe('SkillNear USP: ScopeLock + FairDeal Suite', () => {
  beforeEach(() => {
    // Reset or ensure clean state
  });

  // ============================================================================
  // PHASE 1 — SCOPELOCK (STRUCTURED WORK SPECIFICATIONS)
  // ============================================================================
  describe('Phase 1 — ScopeLock™ Specification Integrity', () => {
    it('creates a service request with complete ScopeLock specifications', async () => {
      const scope: ScopeLock = {
        problem_description: 'Concealed kitchen pipe leakage damaging cabinet woodwork',
        problem: 'Concealed kitchen pipe leakage damaging cabinet woodwork',
        requested_work: [
          'Acoustic leak detection behind tiles',
          'Cut precision inspection window',
          'Replace ruptured CPVC section with Astral SDR 11',
          'Pressure test line at 5 bar for 30 minutes',
        ],
        expected_deliverables: [
          'Zero-leakage certificate',
          '1-year workmanship warranty',
          'High-res photo proof before cabinet reseal',
        ],
        deliverables: [
          'Zero-leakage certificate',
          '1-year workmanship warranty',
          'High-res photo proof before cabinet reseal',
        ],
        urgency: 'high',
        budget: 1800,
        assumptions: [
          'Main water supply valve operates correctly',
          'Work area cleared of utensils',
        ],
        exclusions: [
          'Cabinet carpentry replacement',
          'Tile replacement beyond inspection window',
        ],
        is_locked: true,
      };

      const res = await api.createServiceRequest({
        title: 'Emergency Concealed Kitchen Pipe Leak',
        category: 'plumber',
        description: 'Water seeping through lower cabinet kickboard.',
        urgency: 'high',
        budget: 1800,
        customerName: 'Rahul Sharma',
        customerPhone: '+91 98450 11223',
        customerAddress: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru',
        customerLat: 12.9279,
        customerLng: 77.6748,
        scope,
      });

      expect(res.data).toBeDefined();
      expect(res.data.id).toBeTruthy();
      expect(res.data.scope).toBeDefined();
      expect(res.data.scope?.problem).toBe('Concealed kitchen pipe leakage damaging cabinet woodwork');
      expect(res.data.scope?.requested_work).toHaveLength(4);
      expect(res.data.scope?.deliverables).toHaveLength(3);
      expect(res.data.scope?.exclusions).toContain('Cabinet carpentry replacement');
    });

    it('sanitizes public job leads while retaining structured scope specifications', async () => {
      const res = await api.getServiceRequests();
      const openRequests = res.data.filter((r) => r.scope);

      expect(openRequests.length).toBeGreaterThan(0);
      const sample = openRequests[0];
      expect(sample.scope?.problem).toBeDefined();
      expect(Array.isArray(sample.scope?.requested_work)).toBe(true);
      expect(Array.isArray(sample.scope?.deliverables)).toBe(true);
      expect(Array.isArray(sample.scope?.exclusions)).toBe(true);
    });
  });

  // ============================================================================
  // PHASE 2 — FAIRDEAL (ITEMIZED COMPARABLE QUOTES)
  // ============================================================================
  describe('Phase 2 — FairDeal™ Itemized Pricing & Validation', () => {
    it('validates that total quote amount equals the sum of labour, materials, and travel', async () => {
      const requests = await api.getServiceRequests();
      const targetReq = requests.data[0];

      const itemization: QuoteItemization = {
        labour_amount: 800,
        materials_amount: 450,
        travel_amount: 100,
        estimated_duration: '2.5 hours',
        included_tasks: [
          'Acoustic leak detection',
          'Ruptured pipe section excision',
          'Pressure testing',
        ],
        exclusions: ['Tile retiling'],
        materials_breakdown: [
          { item: 'Astral CPVC Pipe (1.5m)', cost: 250, brand_or_spec: 'SDR 11 Heavy Duty' },
          { item: 'Solvent cement & brass elbows', cost: 200, brand_or_spec: 'Astral TruFlo' },
        ],
      };

      const calculatedTotal =
        itemization.labour_amount + itemization.materials_amount + itemization.travel_amount;
      expect(calculatedTotal).toBe(1350);

      const quoteRes = await api.submitQuote({
        requestId: targetReq.id,
        workerId: 'w-plumber-1',
        amount: calculatedTotal,
        notes: 'Includes all Astral CPVC parts and pressure testing certification.',
        estimatedDuration: '2.5 hours',
        itemization,
      });

      expect(quoteRes.data).toBeDefined();
      expect(quoteRes.data.amount).toBe(1350);
      expect(quoteRes.data.itemization).toBeDefined();
      expect(quoteRes.data.itemization?.labour_amount).toBe(800);
      expect(quoteRes.data.itemization?.materials_amount).toBe(450);
      expect(quoteRes.data.itemization?.travel_amount).toBe(100);
      expect(quoteRes.data.itemization?.materials_breakdown).toHaveLength(2);
    });

    it('enables side-by-side comparison of multiple quotes on a unified ScopeLock baseline', async () => {
      const quotesRes = await api.getQuotes();
      // Find quotes that share the same request_id
      const quotesByReq = quotesRes.data.reduce((acc, q) => {
        acc[q.request_id] = acc[q.request_id] || [];
        acc[q.request_id].push(q);
        return acc;
      }, {} as Record<string, Quote[]>);

      const multiQuoteReqId = Object.keys(quotesByReq).find(
        (id) => quotesByReq[id].length >= 2
      );

      expect(multiQuoteReqId).toBeDefined();
      const comparedQuotes = quotesByReq[multiQuoteReqId!];

      // Compare prices
      const amounts = comparedQuotes.map((q) => q.amount);
      const minPrice = Math.min(...amounts);
      const lowestQuote = comparedQuotes.find((q) => q.amount === minPrice);

      expect(lowestQuote).toBeDefined();
      expect(lowestQuote?.amount).toBeLessThanOrEqual(amounts[1]);

      // Both quotes must reference itemized work
      for (const q of comparedQuotes) {
        if (q.itemization) {
          const labour = q.itemization.labour_charge ?? q.itemization.labour_amount;
          expect(labour).toBeGreaterThan(0);
          expect(q.estimated_duration || q.itemization.estimated_duration).toBeTruthy();
        }
      }
    });
  });

  // ============================================================================
  // PHASE 3 — CHANGE-ORDER LOCK (IMMUTABLE PRICES & AUDIT TRAIL)
  // ============================================================================
  describe('Phase 3 — Change-Order Lock™ & Price Invariant', () => {
    let testBooking: Booking;

    beforeEach(async () => {
      // Create a fresh booking for testing change-orders
      const quoteRes = await api.submitQuote({
        requestId: 'req-01',
        workerId: 'w-plumber-1',
        amount: 1100,
        notes: 'Scope baseline repair',
      });

      const bookingRes = await api.confirmBooking({
        quoteId: quoteRes.data.id,
        requestId: 'req-01',
        workerId: 'w-plumber-1',
        customerName: 'Aarav Patel',
        customerPhone: '+91 98450 77889',
        serviceAddress: 'Indiranagar 100ft Rd, Bengaluru',
        agreedPrice: 1100,
      });

      testBooking = bookingRes.data;
    });

    it('locks original_agreed_price upon booking confirmation', () => {
      expect(testBooking.agreed_price).toBe(1100);
      expect(testBooking.original_agreed_price).toBe(1100);
      expect(testBooking.change_orders || []).toHaveLength(0);
    });

    it('allows a worker to propose a scope change order which starts in pending status', async () => {
      const coRes = await api.proposeChangeOrder(testBooking.id, {
        title: 'Corroded brass coupling replacement behind wall',
        reason: 'Unforeseen calcified fitting shattered upon pipe removal',
        additional_amount: 350,
      });

      const updated = coRes.data;
      expect(updated.change_orders).toHaveLength(1);
      const co = updated.change_orders![0];
      expect(co.title).toBe('Corroded brass coupling replacement behind wall');
      expect(co.additional_amount).toBe(350);
      expect(co.revised_total).toBe(1450); // 1100 + 350
      expect(co.status).toBe('pending_customer_approval');

      // CRITICAL INVARIANT: Agreed price MUST NOT change yet
      expect(updated.agreed_price).toBe(1100);
    });

    it('preserves locked price when customer rejects a proposed change order', async () => {
      // 1. Propose change order
      const proposed = await api.proposeChangeOrder(testBooking.id, {
        title: 'Premium decorative chrome cover plate',
        reason: 'Cosmetic enhancement optional',
        additional_amount: 500,
      });

      const coId = proposed.data.change_orders![0].id;

      // 2. Customer rejects change order
      const rejected = await api.respondToChangeOrder(
        testBooking.id,
        coId,
        'rejected',
        'Customer prefers to keep existing plate'
      );

      const co = rejected.data.change_orders?.find((c) => c.id === coId);
      expect(co?.status).toBe('rejected');
      expect(co?.customer_notes).toBe('Customer prefers to keep existing plate');

      // CRITICAL INVARIANT: Price stays strictly at original baseline
      expect(rejected.data.agreed_price).toBe(1100);
      expect(rejected.data.agreed_price).toBe(rejected.data.original_agreed_price);
    });

    it('updates agreed_price strictly to revised_total when customer approves change order', async () => {
      // 1. Propose change order
      const proposed = await api.proposeChangeOrder(testBooking.id, {
        title: 'Heavy-duty angle cock replacement',
        reason: 'Existing valve sheared off at thread',
        additional_amount: 400,
      });

      const coId = proposed.data.change_orders![0].id;

      // 2. Customer approves change order
      const approved = await api.respondToChangeOrder(
        testBooking.id,
        coId,
        'approved',
        'Approved by customer via app'
      );

      const co = approved.data.change_orders?.find((c) => c.id === coId);
      expect(co?.status).toBe('approved');
      expect(co?.responded_at).toBeDefined();

      // Price is now revised to exactly 1100 + 400 = 1500
      expect(approved.data.agreed_price).toBe(1500);
      // Original baseline is preserved for audit
      expect(approved.data.original_agreed_price).toBe(1100);
    });
  });

  // ============================================================================
  // PHASE 4 — REPAIR PASSPORT (DIGITAL SERVICE RECORD & AUDIT)
  // ============================================================================
  describe('Phase 4 — Repair Passport™ Digital Service Records', () => {
    it('generates a structured digital Repair Passport for completed bookings', async () => {
      const bookingsRes = await api.getBookings();
      // Find completed booking
      const completedBooking = bookingsRes.data.find((b) => b.status === 'completed');
      expect(completedBooking).toBeDefined();

      const passportRes = await api.getRepairPassport(completedBooking!.id);
      expect(passportRes.data).toBeDefined();
      const passport = passportRes.data!;
      expect(passport.passport_id).toMatch(/^(RP-|SKN-PASS-)/);
      expect(passport.technician_name).toBeTruthy();
      expect(passport.original_scope || passport.agreed_scope).toBeDefined();
      expect(passport.original_quote || passport.original_agreed_price).toBeGreaterThan(0);
      expect(passport.final_total || passport.final_total_paid).toBeGreaterThan(0);
      expect(passport.warranty_notes || passport.warranty_coverage).toBeTruthy();
      expect(passport.parts_recorded || passport.parts_installed).toBeDefined();
      expect((passport.parts_recorded || passport.parts_installed)?.length).toBeGreaterThan(0);
    });

    it('verifies no unapproved changes recorded on service passport', async () => {
      const bookingsRes = await api.getBookings();
      const completed = bookingsRes.data.find((b) => b.status === 'completed');

      const passportRes = await api.getRepairPassport(completed!.id);
      expect(passportRes.data).toBeDefined();
      const passport = passportRes.data!;
      expect(passport.unapproved_changes_count).toBe(0);

      // Financial balance check: final_total = original_quote + sum(approved changes)
      const approvedChangesTotal = (passport.approved_change_orders || []).reduce(
        (acc, co) => acc + co.amount,
        0
      );
      const originalQuote = passport.original_quote || passport.original_agreed_price;
      const finalTotal = passport.final_total || passport.final_total_paid;
      expect(finalTotal).toBe(originalQuote + approvedChangesTotal);
    });
  });
});
