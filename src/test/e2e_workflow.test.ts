import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '../services/api';
import { demoRepo } from '../services/demoRepository';
import { calculateDistanceKm } from '../lib/geo';
import { ScopeLock, QuoteItemization, Booking, ServiceRequest, Quote } from '../types';

describe('SkillNear PS03 — End-to-End Acceptance Journey Suite', () => {
  beforeEach(() => {
    // Reset repository and clean local storage before each test
    demoRepo.reset();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    demoRepo.reset();
  });

  it('executes full customer-to-worker journey with ScopeLock, FairDeal, Change-Order Lock, Repair Passport & Refresh Persistence', async () => {
    // ========================================================================
    // STEP 1: HYPERLOCAL LOCATION & DISTANCE FILTERING (Koramangala, 5km)
    // ========================================================================
    const userLocation = {
      lat: 12.9352,
      lng: 77.6245,
      address: 'Koramangala 4th Block, Bengaluru',
      radius: 5,
    };

    // Fetch workers and verify distance matching using Haversine formula
    const workersRes = await api.getWorkers('electrician');
    expect(workersRes.data.length).toBeGreaterThan(0);

    const nearbyElectricians = workersRes.data.map((w) => {
      const lat = w.latitude ?? (w as any).lat;
      const lng = w.longitude ?? (w as any).lng;
      const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, lat, lng);
      return { ...w, distanceKm: dist };
    });

    const withinRadius = nearbyElectricians.filter((w) => w.distanceKm <= userLocation.radius);
    expect(withinRadius.length).toBeGreaterThan(0);
    const chosenWorker = withinRadius[0];
    expect(chosenWorker.trade).toBe('electrician');

    // ========================================================================
    // STEP 2: STRUCTURED CUSTOMER JOB REQUEST WITH SCOPELOCK™ BASELINE
    // ========================================================================
    const customerScope: ScopeLock = {
      problem_description: 'Frequent tripping of 32A MCB switch in kitchen appliance circuit',
      problem: 'Frequent tripping of 32A MCB switch in kitchen appliance circuit',
      requested_work: [
        'Megger insulation resistance test of appliance loop',
        'Load balancing across phase isolators',
        'Replace compromised MCB if internal bimetallic strip degraded',
      ],
      expected_deliverables: [
        'Insulation test report with >50 Megaohm reading',
        'Certified load distribution check',
        'Demonstration of microwave and induction operating simultaneously without trip',
      ],
      deliverables: [
        'Insulation test report with >50 Megaohm reading',
        'Certified load distribution check',
        'Demonstration of microwave and induction operating simultaneously without trip',
      ],
      urgency: 'today',
      budget: 1800,
      assumptions: [
        'Apartment main distribution box accessible',
        'No active internal wiring fire',
      ],
      exclusions: [
        'Complete apartment rewiring',
        'Appliance internal motor repairs',
      ],
      is_locked: true,
    };

    const requestRes = await api.createServiceRequest({
      category: 'electrician',
      title: 'Kitchen MCB Tripping & Circuit Diagnostics',
      description: 'Heavy appliance circuit trips after 3 minutes of load. Need comprehensive load check.',
      urgency: 'today',
      budget: 1800,
      customer_name: 'Pooja Hegde',
      customer_phone: '+91 98450 44556',
      customer_address: 'Flat 301, Koramangala 4th Block, Bengaluru',
      customer_lat: userLocation.lat,
      customer_lng: userLocation.lng,
      preferred_worker_id: chosenWorker.id,
      scope: customerScope,
    });

    expect(requestRes.data).toBeDefined();
    const createdReq = requestRes.data;
    expect(createdReq.id).toBeTruthy();
    expect(createdReq.scope?.problem).toContain('MCB switch');
    expect(createdReq.scope?.requested_work).toHaveLength(3);
    expect(createdReq.scope?.exclusions).toContain('Complete apartment rewiring');

    // ========================================================================
    // STEP 3: WORKER SUBMITS FAIRDEAL™ ITEMIZED QUOTE
    // ========================================================================
    const itemization: QuoteItemization = {
      labour_amount: 1100,
      materials_amount: 600,
      travel_amount: 100,
      total_price: 1800,
      estimated_duration: '2 hours',
      included_tasks: [
        'Insulation resistance diagnostic test',
        'DB load balance re-termination',
        'Schneider 32A Type-C MCB installation',
      ],
      exclusions: ['Apartment internal conduit chase cutting'],
      materials_breakdown: [
        { item: 'Schneider Acti9 32A MCB C-Curve', cost: 480, brand_or_spec: 'OEM Heavy Duty' },
        { item: 'Copper terminal lugs & heat shrink', cost: 120, brand_or_spec: 'Finolex' },
      ],
    };

    const quoteRes = await api.submitQuote({
      requestId: createdReq.id,
      workerId: chosenWorker.id,
      amount: itemization.total_price!,
      notes: 'Includes all Schneider OEM parts and calibrated insulation testing.',
      estimatedDuration: '2 hours',
      itemization,
    });

    expect(quoteRes.data).toBeDefined();
    const initialQuote = quoteRes.data;
    expect(initialQuote.amount).toBe(1800);
    expect(initialQuote.itemization?.labour_amount).toBe(1100);
    expect(initialQuote.itemization?.materials_amount).toBe(600);
    expect(initialQuote.itemization?.travel_amount).toBe(100);

    // ========================================================================
    // STEP 4: INTERACTIVE NEGOTIATION DESK (COUNTEROFFER & ACCEPTANCE)
    // ========================================================================
    // Customer proposes a ₹1650 counteroffer
    const counterRes = await api.submitCounteroffer(
      initialQuote.id,
      1650,
      'Customer provided copper terminal lugs; requested ₹150 discount on materials/labour',
      'customer'
    );

    expect(counterRes.data.status).toBe('countered');
    expect(counterRes.data.counter_amount).toBe(1650);
    expect(counterRes.data.last_updated_by).toBe('customer');

    // Worker accepts customer counteroffer
    const workerAcceptCounter = await api.submitCounteroffer(
      initialQuote.id,
      1650,
      'Worker accepts customer counteroffer at ₹1650 with customer-supplied lugs.',
      'worker'
    );
    expect(workerAcceptCounter.data.counter_amount).toBe(1650);

    // ========================================================================
    // STEP 5: BOOKING CONFIRMATION & PRICE LOCKING AT AGREED RATE
    // ========================================================================
    const bookingRes = await api.confirmBooking({
      quoteId: initialQuote.id,
      requestId: createdReq.id,
      workerId: chosenWorker.id,
      customerName: 'Pooja Hegde',
      customerPhone: '+91 98450 44556',
      serviceAddress: 'Flat 301, Koramangala 4th Block, Bengaluru',
      agreedPrice: 1650, // Effective agreed rate from accepted counteroffer
    });

    expect(bookingRes.data).toBeDefined();
    const confirmedBooking = bookingRes.data;
    expect(confirmedBooking.agreed_price).toBe(1650);
    expect(confirmedBooking.original_agreed_price).toBe(1650);
    expect(confirmedBooking.status).toBe('confirmed');
    expect(confirmedBooking.change_orders || []).toHaveLength(0);

    // ========================================================================
    // STEP 6: CHANGE-ORDER LOCK — PROPOSE & REJECT (PRICE INVARIANT VERIFIED)
    // ========================================================================
    // Worker proposes Change Order 1: Extra conduit pipe (+₹400)
    const co1Res = await api.proposeChangeOrder(confirmedBooking.id, {
      title: 'Extra heavy-duty PVC conduit casing in utility balcony',
      reason: 'Exposed wiring susceptible to balcony rain exposure',
      additional_amount: 400,
    });

    const co1Booking = co1Res.data;
    expect(co1Booking.change_orders).toHaveLength(1);
    const co1 = co1Booking.change_orders![0];
    expect(co1.title).toContain('PVC conduit casing');
    expect(co1.additional_amount).toBe(400);
    expect(co1.revised_total).toBe(2050); // 1650 + 400
    expect(co1.status).toBe('pending_customer_approval');

    // CRITICAL INVARIANT 1: Price MUST NOT change while change order is pending
    expect(co1Booking.agreed_price).toBe(1650);

    // Customer REJECTS Change Order 1
    const rejectedBookingRes = await api.respondToChangeOrder(
      confirmedBooking.id,
      co1.id,
      'rejected',
      'Balcony is enclosed with glass; external conduit casing not required at this time.'
    );

    const rejectedBooking = rejectedBookingRes.data;
    const rejectedCo1 = rejectedBooking.change_orders?.find((c) => c.id === co1.id);
    expect(rejectedCo1?.status).toBe('rejected');
    expect(rejectedCo1?.customer_notes).toContain('external conduit casing not required');

    // CRITICAL INVARIANT 2: Price stays strictly locked at baseline (₹1650) after rejection
    expect(rejectedBooking.agreed_price).toBe(1650);
    expect(rejectedBooking.agreed_price).toBe(rejectedBooking.original_agreed_price);

    // ========================================================================
    // STEP 7: CHANGE-ORDER LOCK — PROPOSE & APPROVE (PRICE REVISION VERIFIED)
    // ========================================================================
    // Worker proposes Change Order 2: Replacement MCB Isolator (+₹350)
    const co2Res = await api.proposeChangeOrder(confirmedBooking.id, {
      title: 'Replacement DP Isolator switch 40A',
      reason: 'Existing isolator contacts scorched from sustained high contact resistance',
      additional_amount: 350,
    });

    const co2Booking = co2Res.data;
    expect(co2Booking.change_orders).toHaveLength(2);
    const co2 = co2Booking.change_orders!.find((c) => c.title.includes('DP Isolator'));
    expect(co2).toBeDefined();
    expect(co2?.additional_amount).toBe(350);
    expect(co2?.revised_total).toBe(2000); // 1650 + 350
    expect(co2?.status).toBe('pending_customer_approval');

    // Price is still 1650 while pending
    expect(co2Booking.agreed_price).toBe(1650);

    // Customer APPROVES Change Order 2
    const approvedBookingRes = await api.respondToChangeOrder(
      confirmedBooking.id,
      co2!.id,
      'approved',
      'Approved: replace scorched isolator switch for safety.'
    );

    const approvedBooking = approvedBookingRes.data;
    const approvedCo2 = approvedBooking.change_orders?.find((c) => c.id === co2!.id);
    expect(approvedCo2?.status).toBe('approved');
    expect(approvedCo2?.responded_at).toBeDefined();

    // CRITICAL INVARIANT 3: Agreed price is updated strictly to revised_total (₹2000)
    expect(approvedBooking.agreed_price).toBe(2000);
    // Baseline is preserved for audit trail
    expect(approvedBooking.original_agreed_price).toBe(1650);

    // ========================================================================
    // STEP 8: COMPLETION & REPAIR PASSPORT™ GENERATION
    // ========================================================================
    const completedBookingRes = await api.updateBookingStatus(
      confirmedBooking.id,
      'completed',
      'Diagnostic test passed with 62 Megaohm insulation resistance. Schneider 32A MCB & 40A Isolator operational.'
    );

    expect(completedBookingRes.data.status).toBe('completed');
    expect(completedBookingRes.data.completed_at).toBeTruthy();

    // Generate Repair Passport
    const passportRes = await api.getRepairPassport(confirmedBooking.id);
    expect(passportRes.data).toBeDefined();
    const passport = passportRes.data!;

    expect(passport.passport_id).toMatch(/^(RP-|SKN-PASS-)/);
    expect(passport.unapproved_changes_count).toBe(0);
    expect(passport.original_agreed_price).toBe(1650);
    expect(passport.final_total_paid).toBe(2000); // 1650 + approved 350 (rejected 400 excluded)
    expect(passport.approved_changes).toHaveLength(1);
    expect(passport.approved_changes[0].additional_amount).toBe(350);
    expect(passport.warranty_notes).toBeTruthy();
    expect(passport.is_demo_simulation).toBe(true);

    // ========================================================================
    // STEP 9: REFRESH PERSISTENCE (LOCALSTORAGE AUDIT ACROSS RELOAD)
    // ========================================================================
    // Verify raw data exists in localStorage
    const rawStorage = window.localStorage.getItem('skillnear_demo_repository_v2');
    expect(rawStorage).toBeTruthy();

    const parsedStorage = JSON.parse(rawStorage!);
    const storedBooking = parsedStorage.bookings.find((b: Booking) => b.id === confirmedBooking.id);
    expect(storedBooking).toBeDefined();
    expect(storedBooking.agreed_price).toBe(2000);
    expect(storedBooking.original_agreed_price).toBe(1650);
    expect(storedBooking.change_orders).toHaveLength(2);

    const storedCo1 = storedBooking.change_orders.find((c: any) => c.id === co1.id);
    const storedCo2 = storedBooking.change_orders.find((c: any) => c.id === co2!.id);
    expect(storedCo1.status).toBe('rejected');
    expect(storedCo2.status).toBe('approved');

    // Simulate page reload by forcing fresh repository instance reading directly from storage
    const reloadedBookings = demoRepo.getBookings();
    const reloadedBooking = reloadedBookings.find((b) => b.id === confirmedBooking.id);
    expect(reloadedBooking).toBeDefined();
    expect(reloadedBooking?.agreed_price).toBe(2000);
    expect(reloadedBooking?.original_agreed_price).toBe(1650);
    expect(reloadedBooking?.status).toBe('completed');

    const reloadedPassportRes = await api.getRepairPassport(confirmedBooking.id);
    expect(reloadedPassportRes.data?.passport_id).toBe(passport.passport_id);
    expect(reloadedPassportRes.data?.final_total_paid).toBe(2000);
    expect(reloadedPassportRes.data?.unapproved_changes_count).toBe(0);
  });
});
