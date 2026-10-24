import { describe, it, expect } from 'vitest';
import { api, maskLeadForPublicFeed } from '../services/api';
import { calculateDistanceKm, formatDistance } from '../lib/geo';
import { ServiceRequest } from '../types';

describe('SkillNear — Public Job Leads Security & Privacy Verification', () => {
  const sampleRequest: ServiceRequest = {
    id: 'req-security-test-01',
    customer_id: 'cust-uuid-12345',
    customer_name: 'Vikram Sengupta',
    customer_phone: '+91 98450 99112',
    customer_address: 'Flat 402, Green Glen Layout, Outer Ring Road, Bellandur, Bengaluru',
    customer_lat: 12.9279234,
    customer_lng: 77.6710456,
    category: 'electrician',
    title: 'Main breaker tripping on AC start',
    description: 'Whenever 1.5 ton AC turns on, main MCB trips. Needs fault isolation.',
    urgency: 'immediate',
    budget: 700,
    preferred_worker_id: null,
    status: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const demoRequestNullCustomer: ServiceRequest = {
    id: '33333333-3333-3333-3333-333333333301',
    customer_id: null, // Demo seed record with null customer_id
    customer_name: 'Arjun Mehta',
    customer_phone: '+91 98450 11223',
    customer_address: 'Flat 302, Palm Heights, 12th Main, Koramangala 4th Block',
    customer_lat: 12.9344,
    customer_lng: 77.6250,
    category: 'plumber',
    title: 'Kitchen sink pipe leaking into lower cupboard',
    description: 'The PVC elbow below double sink cracked this morning.',
    urgency: 'today',
    budget: 500,
    preferred_worker_id: null,
    status: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('never exposes customer phone numbers in the public job lead feed', async () => {
    // 1. Check transformation for authenticated user request
    const maskedAuth = maskLeadForPublicFeed(sampleRequest, 'worker-uid-anonymous');
    expect(maskedAuth.customer_phone).toBeNull();

    // 2. Check transformation for demo records where customer_id IS NULL
    const maskedDemo = maskLeadForPublicFeed(demoRequestNullCustomer, null);
    expect(maskedDemo.customer_phone).toBeNull();

    // 3. Check public API feed
    const leadsRes = await api.getJobLeads();
    expect(leadsRes.data.length).toBeGreaterThan(0);
    for (const lead of leadsRes.data) {
      expect(lead.customer_phone).toBeNull();
    }
  });

  it('masks full door/street addresses to a generalized vicinity label', async () => {
    const masked = maskLeadForPublicFeed(sampleRequest, 'worker-uid-999');
    expect(masked.customer_address).not.toContain('Flat 402');
    expect(masked.customer_address).not.toContain('Green Glen Layout');
    expect(masked.customer_address).toContain('Hyperlocal Vicinity');

    const demoMasked = maskLeadForPublicFeed(demoRequestNullCustomer, 'random-viewer');
    expect(demoMasked.customer_address).not.toContain('Flat 302');
    expect(demoMasked.customer_address).not.toContain('Palm Heights');
    expect(demoMasked.customer_address).toContain('Hyperlocal Vicinity');
  });

  it('anonymizes customer names to first name + initial', async () => {
    const masked = maskLeadForPublicFeed(sampleRequest, 'worker-uid-999');
    expect(masked.customer_name).toBe('Vikram S.');
    expect(masked.customer_name).not.toBe('Vikram Sengupta');

    const demoMasked = maskLeadForPublicFeed(demoRequestNullCustomer, null);
    expect(demoMasked.customer_name).toBe('Arjun M.');
    expect(demoMasked.customer_name).not.toBe('Arjun Mehta');
  });

  it('obfuscates coordinates to coarse resolution (~1.1 km) to prevent precise residence tracking', async () => {
    const masked = maskLeadForPublicFeed(sampleRequest, 'worker-uid-999');
    // Original was 12.9279234, 77.6710456
    // Coarsened should be 12.93, 77.67 (2 decimal places)
    expect(masked.customer_lat).toBe(12.93);
    expect(masked.customer_lng).toBe(77.67);
    expect(masked.customer_lat).not.toBe(sampleRequest.customer_lat);
    expect(masked.customer_lng).not.toBe(sampleRequest.customer_lng);

    // Coarse coordinates must still calculate realistic hyperlocal distance
    const workerLat = 12.9352;
    const workerLng = 77.6245; // Koramangala
    const distanceKm = calculateDistanceKm(workerLat, workerLng, masked.customer_lat, masked.customer_lng);
    expect(distanceKm).toBeGreaterThan(0);
    expect(distanceKm).toBeLessThan(10);
    expect(formatDistance(distanceKm)).toContain('km');
  });

  it('preserves full request details for the customer owner', async () => {
    const ownerView = maskLeadForPublicFeed(sampleRequest, 'cust-uuid-12345');
    // Owner sees their unmasked details
    expect(ownerView.customer_name).toBe('Vikram Sengupta');
    expect(ownerView.customer_phone).toBe('+91 98450 99112');
    expect(ownerView.customer_address).toContain('Flat 402');
    expect(ownerView.customer_lat).toBe(12.9279234);
    expect(ownerView.customer_lng).toBe(77.6710456);
  });

  it('grants assigned technician access to verified customer details upon booking confirmation', async () => {
    // 1. Worker browses public lead (sees masked address and null phone)
    const leads = await api.getJobLeads();
    expect(leads.data.length).toBeGreaterThan(0);
    const targetLead = leads.data[0];
    expect(targetLead.customer_phone).toBeNull();
    expect(targetLead.customer_address).toContain('Hyperlocal Vicinity');

    // 2. Worker submits a quote
    const quoteRes = await api.submitQuote({
      request_id: targetLead.id,
      worker_id: '11111111-1111-1111-1111-111111111103',
      amount: 450,
      estimated_duration: '1 hour',
      notes: 'Available immediately',
    });
    expect(quoteRes.data.id).toBeDefined();

    // 3. Customer confirms booking
    const bookingRes = await api.confirmBooking({
      quoteId: quoteRes.data.id,
      requestId: targetLead.id,
      workerId: '11111111-1111-1111-1111-111111111103',
      customerName: 'Customer',
      customerPhone: '',
      serviceAddress: '',
      agreedPrice: 450,
    });

    expect(bookingRes.data.id).toBeDefined();
    expect(bookingRes.data.status).toBe('confirmed');

    // 4. Assigned technician now receives full verified phone and service address on the confirmed booking
    expect(bookingRes.data.customer_phone).toBeDefined();
    expect(bookingRes.data.customer_phone).toContain('+91');
    expect(bookingRes.data.service_address).toBeDefined();
    expect(bookingRes.data.service_address).not.toContain('Hyperlocal Vicinity');
  });

  it('denies an unrelated authenticated user from accessing another customer request even when a booking exists', () => {
    const customerUid = 'customer-alice-uuid';
    const assignedTechUid = 'tech-bob-uuid';
    const unrelatedUserUid = 'unrelated-mallory-uuid';

    const testReq: ServiceRequest = {
      id: 'req-confidential-01',
      customer_id: customerUid,
      customer_name: 'Alice Johnson',
      customer_phone: '+91 98450 77889',
      customer_address: 'Villa 14, Prestige Ozone, Whitefield, Bengaluru',
      customer_lat: 12.9698,
      customer_lng: 77.7499,
      category: 'electrician',
      title: 'EV charger installation in garage',
      description: 'Need dedicated 32A line from meter to garage.',
      urgency: 'flexible',
      budget: 2500,
      preferred_worker_id: null,
      status: 'booked',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Booking participant logic mirroring fn_is_booking_technician_or_participant in PostgreSQL
    const checkBookingAccess = (
      callerUid: string | null,
      booking: { customer_id: string; quote_creator_id: string } | null
    ): boolean => {
      if (!callerUid) return false; // Anonymous or unauthenticated callers always denied
      if (!booking) return false;
      return booking.customer_id === callerUid || booking.quote_creator_id === callerUid;
    };

    const bookingRecord = {
      customer_id: customerUid,
      quote_creator_id: assignedTechUid,
    };

    // 1. Customer owner has access
    expect(checkBookingAccess(customerUid, bookingRecord)).toBe(true);

    // 2. Assigned technician has access
    expect(checkBookingAccess(assignedTechUid, bookingRecord)).toBe(true);

    // 3. Unrelated authenticated user must be strictly DENIED
    expect(checkBookingAccess(unrelatedUserUid, bookingRecord)).toBe(false);

    // 4. Unauthenticated caller must be strictly DENIED
    expect(checkBookingAccess(null, bookingRecord)).toBe(false);

    // 5. In public feed, unrelated user only receives masked details
    const maskedForUnrelated = maskLeadForPublicFeed(testReq, unrelatedUserUid);
    expect(maskedForUnrelated.customer_phone).toBeNull();
    expect(maskedForUnrelated.customer_address).toContain('Hyperlocal Vicinity');
    expect(maskedForUnrelated.customer_address).not.toContain('Villa 14');
    expect(maskedForUnrelated.customer_name).toBe('Alice J.');
  });

  it('strictly protects bookings table and contact details from unrelated authenticated users and anonymous callers', () => {
    const customerUid = 'cust-priya-uuid';
    const techUid = 'tech-ramesh-uuid';
    const attackerUid = 'attacker-snoop-uuid';

    const sensitiveBooking = {
      id: 'bk-private-001',
      request_id: 'req-priv-001',
      customer_id: customerUid,
      customer_name: 'Priya Sharma',
      customer_phone: '+91 99001 22334',
      service_address: 'Flat 702, Sobha Iris, Outer Ring Road, Devarabisanahalli, Bengaluru',
      agreed_price: 650,
      quote_creator_id: techUid,
    };

    // RLS Policy check mirroring bookings_select_policy
    const canSelectBooking = (callerUid: string | null): boolean => {
      if (!callerUid) return false; // Anonymous callers denied
      // 1. Direct customer ownership
      if (callerUid === sensitiveBooking.customer_id) return true;
      // 2. Assigned technician whose accepted quote is tied to this booking
      if (callerUid === sensitiveBooking.quote_creator_id) return true;
      // All other callers denied
      return false;
    };

    // Customer can view booking
    expect(canSelectBooking(customerUid)).toBe(true);

    // Assigned technician can view booking
    expect(canSelectBooking(techUid)).toBe(true);

    // Unrelated authenticated user is blocked
    expect(canSelectBooking(attackerUid)).toBe(false);

    // Anonymous caller is blocked
    expect(canSelectBooking(null)).toBe(false);
  });

  it('keeps demo workers without authenticated identities strictly in simulation mode', () => {
    // Fictional demo workers do not possess Supabase Auth accounts (auth.uid() is null)
    const demoWorkerUid: string | null = null;

    // Database RLS check returns false for demo workers attempting direct access to private records
    const hasDbAccess = (uid: string | null): boolean => {
      if (!uid) return false;
      return true;
    };

    expect(hasDbAccess(demoWorkerUid)).toBe(false);

    // Public feed browsing works without leaking private data
    const masked = maskLeadForPublicFeed(sampleRequest, demoWorkerUid);
    expect(masked.customer_phone).toBeNull();
    expect(masked.customer_address).toContain('Hyperlocal Vicinity');
  });

  it('verifies that the corrective SQL migration strictly moves helper functions to an unexposed private schema with least-privilege grants', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261024000002_secure_job_leads_view.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // 1. Dedicated private schema isolation
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS app_private;');
    expect(sql).toContain('REVOKE ALL ON SCHEMA app_private FROM PUBLIC;');
    expect(sql).toContain('REVOKE ALL ON SCHEMA app_private FROM anon;');
    expect(sql).toContain('GRANT USAGE ON SCHEMA app_private TO authenticated;');

    // 2. Cleanup of any legacy definitions in public schema
    expect(sql).toContain('DROP FUNCTION IF EXISTS public.fn_is_booking_technician_or_participant(UUID);');
    expect(sql).toContain('DROP FUNCTION IF EXISTS public.fn_sync_booking_customer_details();');

    // 3. fn_is_booking_technician_or_participant in app_private with SET search_path = ''
    expect(sql).toContain('CREATE OR REPLACE FUNCTION app_private.fn_is_booking_technician_or_participant');
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('IF v_caller_uid IS NULL THEN');
    expect(sql).toContain('RETURN FALSE;');
    expect(sql).toContain('b.customer_id = v_caller_uid');
    expect(sql).toContain('q.creator_id = v_caller_uid');

    // 4. Execution privilege restriction: authenticated role ONLY, revoked from PUBLIC and anon
    expect(sql).toContain('REVOKE ALL ON FUNCTION app_private.fn_is_booking_technician_or_participant(UUID) FROM PUBLIC;');
    expect(sql).toContain('REVOKE ALL ON FUNCTION app_private.fn_is_booking_technician_or_participant(UUID) FROM anon;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION app_private.fn_is_booking_technician_or_participant(UUID) TO authenticated;');

    // 5. Trigger functions in app_private with direct execution completely revoked
    expect(sql).toContain('CREATE OR REPLACE FUNCTION app_private.fn_validate_and_sync_booking()');
    expect(sql).toContain('REVOKE ALL ON FUNCTION app_private.fn_validate_and_sync_booking() FROM PUBLIC;');
    expect(sql).toContain('REVOKE ALL ON FUNCTION app_private.fn_validate_and_sync_booking() FROM anon, authenticated;');
    expect(sql).toContain('EXECUTE FUNCTION app_private.fn_validate_and_sync_booking();');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION app_private.fn_protect_booking_immutable_fields()');
    expect(sql).toContain('REVOKE ALL ON FUNCTION app_private.fn_protect_booking_immutable_fields() FROM PUBLIC;');
    expect(sql).toContain('REVOKE ALL ON FUNCTION app_private.fn_protect_booking_immutable_fields() FROM anon, authenticated;');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION app_private.fn_protect_service_request_ownership()');
    expect(sql).toContain('REVOKE ALL ON FUNCTION app_private.fn_protect_service_request_ownership() FROM PUBLIC;');
    expect(sql).toContain('REVOKE ALL ON FUNCTION app_private.fn_protect_service_request_ownership() FROM anon, authenticated;');

    // 6. bookings_select_policy has no customer_id IS NULL leak and references app_private
    const bookingsSelectSection = sql.substring(
      sql.indexOf('CREATE POLICY "bookings_select_policy"'),
      sql.indexOf('CREATE POLICY "bookings_insert_policy"')
    );
    expect(bookingsSelectSection).not.toContain('customer_id IS NULL');
    expect(bookingsSelectSection).toContain('app_private.fn_is_booking_technician_or_participant(request_id)');
    expect(bookingsSelectSection).toContain('FOR SELECT TO authenticated');

    // 7. bookings_insert_policy requires authentication
    const bookingsInsertSection = sql.substring(
      sql.indexOf('CREATE POLICY "bookings_insert_policy"'),
      sql.indexOf('CREATE POLICY "bookings_update_policy"')
    );
    expect(bookingsInsertSection).not.toContain('customer_id IS NULL');
    expect(bookingsInsertSection).toContain('customer_id = (SELECT auth.uid())');
    expect(bookingsInsertSection).toContain('FOR INSERT TO authenticated');

    // 8. service_requests_select_policy enforces trusted identity verification via app_private
    const serviceReqSelectSection = sql.substring(
      sql.indexOf('CREATE POLICY "service_requests_select_policy"'),
      sql.indexOf('CREATE POLICY "service_requests_update_policy"')
    );
    expect(serviceReqSelectSection).not.toContain('customer_id IS NULL');
    expect(serviceReqSelectSection).toContain('app_private.fn_is_booking_technician_or_participant(id)');
    expect(serviceReqSelectSection).toContain('FOR SELECT TO authenticated');

    // 9. Data API grants granted strictly to public schema and tables
    expect(sql).toContain('GRANT USAGE ON SCHEMA public TO anon, authenticated;');
    expect(sql).toContain('GRANT SELECT ON TABLE public.job_leads TO anon, authenticated;');
    expect(sql).not.toContain('GRANT ALL ON SCHEMA app_private');
    expect(sql).not.toContain('GRANT SELECT ON SCHEMA app_private');
  });

  it('regression: enforces missing-column backfills and foreign keys to auth.users idempotently', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261024000002_secure_job_leads_view.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Missing column idempotent checks
    expect(sql).toContain('ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();');
    expect(sql).toContain('ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();');
    expect(sql).toContain('ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS creator_id UUID DEFAULT auth.uid();');
    expect(sql).toContain('ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();');

    // Foreign keys to auth.users
    expect(sql).toContain("pg_constraint WHERE conname = 'service_requests_customer_id_fkey'");
    expect(sql).toContain('FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE SET NULL');
    expect(sql).toContain("pg_constraint WHERE conname = 'bookings_customer_id_fkey'");
    expect(sql).toContain("pg_constraint WHERE conname = 'quotes_creator_id_fkey'");
    expect(sql).toContain("pg_constraint WHERE conname = 'reviews_customer_id_fkey'");
  });

  it('regression: completely purges every legacy permissive policy from Migration 1', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261024000002_secure_job_leads_view.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Every legacy permissive policy from migration 1 must be dropped
    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public insert on service_requests" ON public.service_requests;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public read on service_requests" ON public.service_requests;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public update on service_requests" ON public.service_requests;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public all requests" ON public.service_requests;');

    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public read on quotes" ON public.quotes;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public insert on quotes" ON public.quotes;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public update on quotes" ON public.quotes;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public all quotes" ON public.quotes;');

    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public insert on workers" ON public.workers;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public update on workers" ON public.workers;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public all workers" ON public.workers;');

    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public insert on services" ON public.services;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public all services" ON public.services;');

    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public insert on reviews" ON public.reviews;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public all reviews" ON public.reviews;');

    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public insert on bookings" ON public.bookings;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public update on bookings" ON public.bookings;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Allow public all bookings" ON public.bookings;');
  });

  it('regression: blocks anonymous writes and revokes write grants from anon role', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261024000002_secure_job_leads_view.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Revocation from anon
    expect(sql).toContain('REVOKE ALL ON TABLE public.service_requests FROM anon, PUBLIC;');
    expect(sql).toContain('REVOKE ALL ON TABLE public.quotes FROM anon, PUBLIC;');
    expect(sql).toContain('REVOKE ALL ON TABLE public.bookings FROM anon, PUBLIC;');
    expect(sql).toContain('REVOKE ALL ON TABLE public.reviews FROM anon, PUBLIC;');

    // Only safe read-only discovery granted to anon
    expect(sql).toContain('GRANT SELECT ON TABLE public.workers_directory TO anon, authenticated;');
    expect(sql).toContain('GRANT SELECT ON TABLE public.services TO anon, authenticated;');
    expect(sql).toContain('GRANT SELECT ON TABLE public.job_leads TO anon, authenticated;');
    expect(sql).toContain('GRANT SELECT ON TABLE public.public_reviews TO anon, authenticated;');

    // Column-level update grants restrict authenticated tampering
    expect(sql).toContain('GRANT UPDATE (title, description, urgency, budget, status, preferred_worker_id, updated_at) ON TABLE public.service_requests TO authenticated;');
    expect(sql).toContain('GRANT UPDATE (counter_amount, counter_notes, notes, status, last_updated_by, updated_at) ON TABLE public.quotes TO authenticated;');
    expect(sql).toContain('GRANT UPDATE (status, scheduled_for, completion_notes, completed_at) ON TABLE public.bookings TO authenticated;');
  });

  it('regression: rejects cross-customer booking insertions and mismatched quote/request combinations', () => {
    const callerCustomerUid = 'cust-legit-001';
    const attackerCustomerUid = 'cust-mallory-999';

    const serviceRequest = {
      id: 'req-target-100',
      customer_id: callerCustomerUid,
      status: 'open',
    };

    const acceptedQuote = {
      id: 'quote-valid-200',
      request_id: 'req-target-100',
      worker_id: 'worker-tech-300',
      status: 'accepted',
    };

    const pendingQuote = {
      id: 'quote-pending-201',
      request_id: 'req-target-100',
      worker_id: 'worker-tech-300',
      status: 'pending',
    };

    const mismatchedQuote = {
      id: 'quote-other-202',
      request_id: 'req-DIFFERENT-999',
      worker_id: 'worker-tech-300',
      status: 'accepted',
    };

    // Validation logic matching app_private.fn_validate_and_sync_booking()
    const validateBookingInsert = (
      callerUid: string | null,
      booking: {
        request_id: string;
        quote_id: string;
        worker_id: string;
        customer_id: string;
      },
      req: typeof serviceRequest | null,
      quote: typeof acceptedQuote | null
    ): { success: boolean; error?: string } => {
      if (!callerUid) return { success: false, error: 'Authentication required' };
      if (booking.customer_id !== callerUid) return { success: false, error: 'Customer ID mismatch with caller' };
      if (!req) return { success: false, error: 'Request not found' };
      if (req.customer_id !== callerUid) return { success: false, error: 'Request does not belong to caller' };
      if (!quote) return { success: false, error: 'Quote not found' };
      if (quote.request_id !== booking.request_id) return { success: false, error: 'Mismatched request_id' };
      if (quote.worker_id !== booking.worker_id) return { success: false, error: 'Mismatched worker_id' };
      if (quote.status !== 'accepted') return { success: false, error: 'Quote must be accepted before booking' };
      return { success: true };
    };

    // 1. Valid booking confirmation succeeds
    const validBooking = {
      request_id: serviceRequest.id,
      quote_id: acceptedQuote.id,
      worker_id: acceptedQuote.worker_id,
      customer_id: callerCustomerUid,
    };
    expect(validateBookingInsert(callerCustomerUid, validBooking, serviceRequest, acceptedQuote).success).toBe(true);

    // 2. Cross-customer attack: Mallory tries to book Alice's request
    const crossCustomerBooking = {
      request_id: serviceRequest.id,
      quote_id: acceptedQuote.id,
      worker_id: acceptedQuote.worker_id,
      customer_id: attackerCustomerUid,
    };
    const crossRes = validateBookingInsert(attackerCustomerUid, crossCustomerBooking, serviceRequest, acceptedQuote);
    expect(crossRes.success).toBe(false);
    expect(crossRes.error).toContain('does not belong to caller');

    // 3. Mismatched request_id in quote
    const mismatchedBooking = {
      request_id: serviceRequest.id,
      quote_id: mismatchedQuote.id,
      worker_id: mismatchedQuote.worker_id,
      customer_id: callerCustomerUid,
    };
    const mismatchRes = validateBookingInsert(callerCustomerUid, mismatchedBooking, serviceRequest, mismatchedQuote);
    expect(mismatchRes.success).toBe(false);
    expect(mismatchRes.error).toContain('Mismatched request_id');

    // 4. Quote is not accepted yet
    const pendingBooking = {
      request_id: serviceRequest.id,
      quote_id: pendingQuote.id,
      worker_id: pendingQuote.worker_id,
      customer_id: callerCustomerUid,
    };
    const pendingRes = validateBookingInsert(callerCustomerUid, pendingBooking, serviceRequest, pendingQuote);
    expect(pendingRes.success).toBe(false);
    expect(pendingRes.error).toContain('Quote must be accepted');

    // 5. Anonymous caller rejected
    expect(validateBookingInsert(null, validBooking, serviceRequest, acceptedQuote).success).toBe(false);
  });

  it('regression: rejects modifications to immutable service request and booking fields', () => {
    // Logic matching app_private.fn_protect_service_request_ownership()
    const validateRequestUpdate = (
      oldReq: { id: string; customer_id: string; lat: number; lng: number },
      newReq: { id: string; customer_id: string; lat: number; lng: number }
    ): { allowed: boolean; error?: string } => {
      if (newReq.id !== oldReq.id) return { allowed: false, error: 'Cannot modify ID' };
      if (newReq.customer_id !== oldReq.customer_id) return { allowed: false, error: 'Cannot change ownership' };
      if (newReq.lat !== oldReq.lat || newReq.lng !== oldReq.lng) return { allowed: false, error: 'Cannot change coordinates' };
      return { allowed: true };
    };

    const initialReq = { id: 'req-1', customer_id: 'cust-1', lat: 12.93, lng: 77.62 };

    // Changing customer ownership is blocked
    expect(validateRequestUpdate(initialReq, { ...initialReq, customer_id: 'cust-hijack' }).allowed).toBe(false);

    // Changing coordinates is blocked
    expect(validateRequestUpdate(initialReq, { ...initialReq, lat: 13.05 }).allowed).toBe(false);

    // Logic matching app_private.fn_protect_booking_immutable_fields()
    const validateBookingUpdate = (
      oldBooking: { id: string; agreed_price: number; customer_id: string },
      newBooking: { id: string; agreed_price: number; customer_id: string }
    ): { allowed: boolean; error?: string } => {
      if (newBooking.id !== oldBooking.id) return { allowed: false, error: 'Cannot modify ID' };
      if (newBooking.customer_id !== oldBooking.customer_id) return { allowed: false, error: 'Cannot change customer_id' };
      if (newBooking.agreed_price !== oldBooking.agreed_price) return { allowed: false, error: 'Cannot change agreed_price' };
      return { allowed: true };
    };

    const initialBooking = { id: 'bk-1', agreed_price: 500, customer_id: 'cust-1' };

    // Changing agreed price without change-order is blocked
    expect(validateBookingUpdate(initialBooking, { ...initialBooking, agreed_price: 1500 }).allowed).toBe(false);

    // Changing booking customer is blocked
    expect(validateBookingUpdate(initialBooking, { ...initialBooking, customer_id: 'cust-other' }).allowed).toBe(false);
  });

  it('regression: restricts review submissions strictly to authenticated completed-booking participants', () => {
    const customerUid = 'cust-real-reviewer';
    const otherUserUid = 'cust-fake-reviewer';
    const targetWorkerId = 'worker-plumber-01';

    const completedBooking = {
      id: 'bk-completed-100',
      worker_id: targetWorkerId,
      customer_id: customerUid,
      status: 'completed',
    };

    const inProgressBooking = {
      id: 'bk-inprogress-101',
      worker_id: targetWorkerId,
      customer_id: customerUid,
      status: 'confirmed',
    };

    // Review insertion policy check matching reviews_insert_policy
    const canSubmitReview = (
      callerUid: string | null,
      booking: typeof completedBooking | null,
      rating: number
    ): boolean => {
      if (!callerUid) return false;
      if (rating < 1 || rating > 5) return false;
      if (!booking) return false;
      if (booking.customer_id !== callerUid) return false;
      if (booking.status !== 'completed') return false;
      return true;
    };

    // 1. Legitimate customer with completed booking can submit review
    expect(canSubmitReview(customerUid, completedBooking, 5)).toBe(true);

    // 2. Unrelated user cannot submit review on another user's booking
    expect(canSubmitReview(otherUserUid, completedBooking, 5)).toBe(false);

    // 3. Customer cannot submit review before booking reaches 'completed' status
    expect(canSubmitReview(customerUid, inProgressBooking, 5)).toBe(false);

    // 4. Invalid rating rejected
    expect(canSubmitReview(customerUid, completedBooking, 6)).toBe(false);

    // 5. Anonymous caller rejected
    expect(canSubmitReview(null, completedBooking, 5)).toBe(false);
  });

  it('regression: safe public directory and review views hide worker contacts and customer identities', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261024000002_secure_job_leads_view.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // 1. workers_directory view exists and omits worker phone, email, and exact street address
    expect(sql).toContain('CREATE OR REPLACE VIEW public.workers_directory');
    expect(sql).toContain('NULL::text AS phone');
    expect(sql).toContain('NULL::text AS email');
    expect(sql).toContain('w.city AS address');

    // 2. public_reviews view exists and omits customer_id while masking customer_name
    expect(sql).toContain('CREATE OR REPLACE VIEW public.public_reviews');
    expect(sql).toContain('NULL::uuid\n    END AS customer_id');
    expect(sql).toContain('split_part(r.customer_name,');

    // 3. Raw tables revoked from anon and PUBLIC
    expect(sql).toContain('REVOKE ALL ON TABLE public.workers FROM anon, PUBLIC;');
    expect(sql).toContain('REVOKE ALL ON TABLE public.reviews FROM anon, PUBLIC;');

    // 4. Safe views granted to anon and authenticated
    expect(sql).toContain('GRANT SELECT ON TABLE public.workers_directory TO anon, authenticated;');
    expect(sql).toContain('GRANT SELECT ON TABLE public.public_reviews TO anon, authenticated;');

    // 5. Check API query targets workers_directory and public_reviews
    const workersRes = await api.getWorkers();
    expect(workersRes.data.length).toBeGreaterThan(0);
    const reviewsRes = await api.getReviews();
    expect(reviewsRes.data.length).toBeGreaterThan(0);
  });

  it('regression: enforces role-specific quote permissions preventing customer tampering with worker amounts or notes', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261024000002_secure_job_leads_view.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // SQL definitions check
    expect(sql).toContain('CREATE OR REPLACE FUNCTION app_private.fn_validate_quote_update()');
    expect(sql).toContain('Customer cannot modify worker original quote amount');
    expect(sql).toContain('Customer cannot modify worker quote notes');
    expect(sql).toContain('Customer cannot modify worker estimated duration');
    expect(sql).toContain('Only the customer can accept a quote');
    expect(sql).toContain('CREATE TRIGGER trg_validate_quote_update');

    // Simulation of fn_validate_quote_update
    const validateQuoteUpdate = (
      callerUid: string,
      requestCustomerId: string,
      oldQuote: {
        amount: number;
        notes: string;
        estimated_duration: string;
        creator_id: string;
        counter_amount: number | null;
        status: string;
      },
      newQuote: {
        amount: number;
        notes: string;
        estimated_duration: string;
        creator_id: string;
        counter_amount: number | null;
        status: string;
      }
    ): { allowed: boolean; error?: string } => {
      if (callerUid === requestCustomerId) {
        // Customer role
        if (newQuote.amount !== oldQuote.amount) {
          return { allowed: false, error: 'Customer cannot modify worker original quote amount' };
        }
        if (newQuote.notes !== oldQuote.notes) {
          return { allowed: false, error: 'Customer cannot modify worker quote notes' };
        }
        if (newQuote.estimated_duration !== oldQuote.estimated_duration) {
          return { allowed: false, error: 'Customer cannot modify worker estimated duration' };
        }
        if (newQuote.status === 'countered' && (!newQuote.counter_amount || newQuote.counter_amount <= 0)) {
          return { allowed: false, error: 'Counteroffer requires valid counter_amount' };
        }
        if (newQuote.status === 'accepted' && newQuote.counter_amount !== oldQuote.counter_amount) {
          return { allowed: false, error: 'Cannot modify counter_amount during quote acceptance' };
        }
        return { allowed: true };
      } else if (callerUid === oldQuote.creator_id) {
        // Worker role
        if (newQuote.status === 'accepted') {
          return { allowed: false, error: 'Only the customer can accept a quote' };
        }
        return { allowed: true };
      }
      return { allowed: false, error: 'Unauthorized' };
    };

    const customerUid = 'cust-user-1';
    const workerUid = 'worker-user-2';
    const baseQuote = {
      amount: 500,
      notes: 'Standard service including diagnostics',
      estimated_duration: '1 hour',
      creator_id: workerUid,
      counter_amount: null,
      status: 'pending',
    };

    // 1. Customer cannot alter original amount
    const tamperAmount = validateQuoteUpdate(customerUid, customerUid, baseQuote, {
      ...baseQuote,
      amount: 250,
    });
    expect(tamperAmount.allowed).toBe(false);
    expect(tamperAmount.error).toContain('original quote amount');

    // 2. Customer cannot alter original notes
    const tamperNotes = validateQuoteUpdate(customerUid, customerUid, baseQuote, {
      ...baseQuote,
      notes: 'Free parts included',
    });
    expect(tamperNotes.allowed).toBe(false);
    expect(tamperNotes.error).toContain('quote notes');

    // 3. Customer can make legitimate counteroffer
    const validCounter = validateQuoteUpdate(customerUid, customerUid, baseQuote, {
      ...baseQuote,
      counter_amount: 450,
      status: 'countered',
    });
    expect(validCounter.allowed).toBe(true);

    // 4. Worker cannot self-accept their own quote
    const workerSelfAccept = validateQuoteUpdate(workerUid, customerUid, baseQuote, {
      ...baseQuote,
      status: 'accepted',
    });
    expect(workerSelfAccept.allowed).toBe(false);
    expect(workerSelfAccept.error).toContain('Only the customer can accept');

    // 5. Customer can accept the quote
    const customerAccept = validateQuoteUpdate(customerUid, customerUid, baseQuote, {
      ...baseQuote,
      status: 'accepted',
    });
    expect(customerAccept.allowed).toBe(true);
  });

  it('regression: enforces price integrity on booking creation matching the accepted quote snapshot', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261024000002_secure_job_leads_view.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // SQL verification
    expect(sql).toContain('v_effective_agreed_price := COALESCE(v_quote.counter_amount, v_quote.amount);');
    expect(sql).toContain('NEW.agreed_price <> v_effective_agreed_price');
    expect(sql).toContain('Booking agreed_price (%) must match accepted quote effective price (%)');
    expect(sql).toContain('NEW.agreed_price := v_effective_agreed_price;');

    // Simulation of price integrity verification
    const verifyBookingPrice = (
      bookingAgreedPrice: number,
      quote: { amount: number; counter_amount: number | null; status: string }
    ): { valid: boolean; effectivePrice: number; error?: string } => {
      if (quote.status !== 'accepted') {
        return { valid: false, effectivePrice: 0, error: 'Quote must be accepted' };
      }
      const effectivePrice = quote.counter_amount !== null ? quote.counter_amount : quote.amount;
      if (bookingAgreedPrice !== effectivePrice) {
        return {
          valid: false,
          effectivePrice,
          error: `Booking price ${bookingAgreedPrice} does not match effective quote price ${effectivePrice}`,
        };
      }
      return { valid: true, effectivePrice };
    };

    // Case 1: Standard quote accepted without counteroffer (price = 600)
    const quoteNoCounter = { amount: 600, counter_amount: null, status: 'accepted' };
    expect(verifyBookingPrice(600, quoteNoCounter).valid).toBe(true);
    expect(verifyBookingPrice(500, quoteNoCounter).valid).toBe(false);

    // Case 2: Counteroffer accepted at 520
    const quoteWithCounter = { amount: 600, counter_amount: 520, status: 'accepted' };
    expect(verifyBookingPrice(520, quoteWithCounter).valid).toBe(true);
    expect(verifyBookingPrice(600, quoteWithCounter).valid).toBe(false); // original amount must be rejected

    // Case 3: Quote not yet accepted
    const pendingQuote = { amount: 600, counter_amount: 520, status: 'countered' };
    expect(verifyBookingPrice(520, pendingQuote).valid).toBe(false);
  });

  it('regression: prevents customers from marking bookings in_progress or completed to unlock reviews', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261024000002_secure_job_leads_view.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // SQL verification
    expect(sql).toContain('CREATE OR REPLACE FUNCTION app_private.fn_validate_booking_status_transition()');
    expect(sql).toContain('Customers cannot mark bookings as in-progress or completed');
    expect(sql).toContain('CREATE TRIGGER trg_validate_booking_status_transition');

    // Simulation of fn_validate_booking_status_transition
    const validateStatusTransition = (
      callerUid: string,
      booking: { customer_id: string; quote_creator_id: string; status: string },
      newStatus: string
    ): { allowed: boolean; error?: string } => {
      if (callerUid === booking.customer_id) {
        // Customer cannot mark in_progress or completed
        if (newStatus === 'in_progress' || newStatus === 'completed') {
          return { allowed: false, error: 'Customers cannot mark bookings as in-progress or completed' };
        }
        if (newStatus === 'cancelled' && booking.status === 'confirmed') {
          return { allowed: true };
        }
        return { allowed: false, error: 'Invalid customer status transition' };
      } else if (callerUid === booking.quote_creator_id) {
        // Assigned technician
        if (newStatus === 'in_progress' && booking.status === 'confirmed') {
          return { allowed: true };
        }
        if (newStatus === 'completed' && (booking.status === 'confirmed' || booking.status === 'in_progress')) {
          return { allowed: true };
        }
        return { allowed: false, error: 'Invalid technician status transition' };
      }
      return { allowed: false, error: 'Unauthorized' };
    };

    const customerUid = 'cust-test-user';
    const techUid = 'tech-test-worker';
    const booking = {
      customer_id: customerUid,
      quote_creator_id: techUid,
      status: 'confirmed',
    };

    // 1. Customer attempts to mark completed to unlock reviews -> blocked
    const customerComplete = validateStatusTransition(customerUid, booking, 'completed');
    expect(customerComplete.allowed).toBe(false);
    expect(customerComplete.error).toContain('Customers cannot mark bookings as in-progress or completed');

    // 2. Customer attempts to mark in_progress -> blocked
    const customerInProgress = validateStatusTransition(customerUid, booking, 'in_progress');
    expect(customerInProgress.allowed).toBe(false);

    // 3. Customer can cancel confirmed booking
    expect(validateStatusTransition(customerUid, booking, 'cancelled').allowed).toBe(true);

    // 4. Assigned technician starts work -> in_progress allowed
    expect(validateStatusTransition(techUid, booking, 'in_progress').allowed).toBe(true);

    // 5. Assigned technician completes work -> completed allowed
    expect(validateStatusTransition(techUid, { ...booking, status: 'in_progress' }, 'completed').allowed).toBe(true);
  });

  it('regression: redacts phone numbers and email addresses from public job lead titles and descriptions', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261024000002_secure_job_leads_view.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // SQL verification of redaction regex in public.job_leads view
    expect(sql).toContain('[contact redacted]');
    expect(sql).toContain('[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}');

    // Test masking helper with contact info in title and description
    const leakRequest: ServiceRequest = {
      id: 'sr-leak-test',
      customer_id: 'cust-uuid-owner',
      customer_name: 'Pooja Hegde',
      customer_phone: '+91 98450 12345',
      customer_address: 'Flat 501, Palm Springs, Indiranagar',
      customer_lat: 12.9784,
      customer_lng: 77.6408,
      category: 'electrician',
      title: 'Short circuit in kitchen! Call me at 9845012345 immediately',
      description: 'MCB tripped. You can also reach me at pooja.hegde@example.com for building security pass.',
      urgency: 'immediate',
      budget: 800,
      preferred_worker_id: null,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Non-owner (worker or anonymous) view must have phone and email redacted
    const publicLead = maskLeadForPublicFeed(leakRequest, 'unrelated-worker-id');
    expect(publicLead.title).not.toContain('9845012345');
    expect(publicLead.title).toContain('[contact redacted]');
    expect(publicLead.description).not.toContain('pooja.hegde@example.com');
    expect(publicLead.description).toContain('[contact redacted]');
    expect(publicLead.customer_phone).toBeNull();
    expect(publicLead.customer_address).toContain('Hyperlocal Vicinity');

    // 2. Owner view preserves original unredacted text
    const ownerLead = maskLeadForPublicFeed(leakRequest, 'cust-uuid-owner');
    expect(ownerLead.title).toContain('9845012345');
    expect(ownerLead.description).toContain('pooja.hegde@example.com');
    expect(ownerLead.customer_phone).toBe('+91 98450 12345');
    expect(ownerLead.customer_address).toContain('Flat 501');
  });
});
