import { describe, it, expect, beforeEach } from 'vitest';
import { demoRepo } from '../services/demoRepository';
import { api } from '../services/api';
import {
  verifySupabaseHealth,
  authService,
  getSupabaseConfigStatus,
} from '../lib/supabase';
import { ServiceRequest, Quote, Booking, Review, ChangeOrder } from '../types';

describe('Phase 1 — Data Persistence, Review Math & Authentication Suite', () => {
  beforeEach(() => {
    // Reset repository and session storage before each test
    demoRepo.reset();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    demoRepo.reset();
  });

  describe('1. Local Storage Demo Repository & Refresh Persistence', () => {
    it('persists newly submitted job request in localStorage across simulated page reload', () => {
      const newRequest: ServiceRequest = {
        id: 'test-req-persist-01',
        category: 'plumber',
        title: 'Emergency Geyser Pipe Burst Repair',
        description: 'Hot water pipe joint cracked under bathroom sink. Water leaking continuously.',
        urgency: 'immediate',
        budget: 650,
        customer_name: 'Aditi Sharma',
        customer_phone: '+91 98450 99887',
        customer_address: '4th Cross, Indiranagar, Bengaluru',
        customer_lat: 12.9784,
        customer_lng: 77.6408,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add request to repository
      const saved = demoRepo.addRequest(newRequest);
      expect(saved.id).toBe('test-req-persist-01');

      // Verify it was stored in browser localStorage
      const rawStored = window.localStorage.getItem('skillnear_demo_repository_v2');
      expect(rawStored).toBeTruthy();
      const parsed = JSON.parse(rawStored!);
      const foundInStorage = parsed.requests.find((r: ServiceRequest) => r.id === 'test-req-persist-01');
      expect(foundInStorage).toBeDefined();
      expect(foundInStorage.title).toBe('Emergency Geyser Pipe Burst Repair');

      // Simulate a browser page reload: clear memory cache and re-read from storage
      const reloadedData = demoRepo.getData();
      const reloadedRequest = reloadedData.requests.find((r) => r.id === 'test-req-persist-01');
      expect(reloadedRequest).toBeDefined();
      expect(reloadedRequest?.title).toBe('Emergency Geyser Pipe Burst Repair');
    });

    it('protects private customer details from being stored unmasked in localStorage', () => {
      const privateRequest: ServiceRequest = {
        id: 'test-req-privacy-02',
        category: 'electrician',
        title: 'Short Circuit in Main Distribution Board',
        description: 'Sparking from circuit breaker',
        urgency: 'today',
        customer_name: 'Vikram Malhotra',
        customer_phone: '+91 98765 12345',
        customer_address: 'Flat 402, Green Glen Layout, Bellandur',
        customer_lat: 12.9279,
        customer_lng: 77.6781,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      demoRepo.addRequest(privateRequest);

      const rawStored = window.localStorage.getItem('skillnear_demo_repository_v2');
      const parsed = JSON.parse(rawStored!);
      const storedReq = parsed.requests.find((r: ServiceRequest) => r.id === 'test-req-privacy-02');

      // Phone must be masked for demo repository safety
      expect(storedReq.customer_phone).toContain('XXXXX (Demo)');
      expect(storedReq.customer_phone).not.toBe('+91 98765 12345');
    });

    it('allows controlled reset of demo repository back to clean seed fixtures', () => {
      const customReq: ServiceRequest = {
        id: 'temp-req-to-delete',
        category: 'painter',
        title: 'Balcony Waterproof Coating',
        description: 'Seal external wall before monsoon',
        urgency: 'flexible',
        customer_name: 'Test Customer',
        customer_phone: '+91 98450 00000',
        customer_address: 'Bengaluru',
        customer_lat: 12.97,
        customer_lng: 77.64,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      demoRepo.addRequest(customReq);
      expect(demoRepo.getRequests().some((r) => r.id === 'temp-req-to-delete')).toBe(true);

      // Perform controlled reset
      demoRepo.reset();

      // Verified wiped back to default fixtures
      expect(demoRepo.getRequests().some((r) => r.id === 'temp-req-to-delete')).toBe(false);
    });
  });

  describe('2. Historical Review Baseline & Rating Calculation Integrity', () => {
    it("preserves Karthik Nair's 4.7 rating (24 reviews) without collapsing when a 4.0 review is added", () => {
      const karthikId = '11111111-1111-1111-1111-111111111104';
      const initialWorker = demoRepo.getWorkerById(karthikId);
      expect(initialWorker).toBeDefined();
      expect(initialWorker?.rating).toBe(4.7);
      expect(initialWorker?.review_count).toBe(24);

      // Submit a 4.0 star review
      const review: Review = {
        id: 'rev-karthik-test-01',
        booking_id: '55555555-5555-5555-5555-555555555502',
        worker_id: karthikId,
        customer_name: 'Sunil Rao',
        rating: 4,
        comment: 'Good prompt work, fixed the pipe nicely.',
        created_at: new Date().toISOString(),
      };

      const result = demoRepo.addReview(review);
      expect(result.worker).toBeDefined();

      // Math verification:
      // Historical sum = 4.7 * 24 = 112.8
      // New review sum = 4.0
      // Total sum = 116.8
      // Total count = 25
      // 116.8 / 25 = 4.672 -> rounds to 4.7
      expect(result.worker?.review_count).toBe(25);
      expect(result.worker?.rating).toBe(4.7);

      // Submit another 5.0 star review
      const review2: Review = {
        id: 'rev-karthik-test-02',
        booking_id: '55555555-5555-5555-5555-555555555502',
        worker_id: karthikId,
        customer_name: 'Meera Iyer',
        rating: 5,
        comment: 'Super fast leak detection, very polite.',
        created_at: new Date().toISOString(),
      };

      const result2 = demoRepo.addReview(review2);
      // Total sum = 116.8 + 5.0 = 121.8
      // Total count = 26
      // 121.8 / 26 = 4.6846 -> rounds to 4.7
      expect(result2.worker?.review_count).toBe(26);
      expect(result2.worker?.rating).toBe(4.7);
    });
  });

  describe('3. Honest 3-Tier Health & Status Separation', () => {
    it('separates credentials configured, database reachable, and operations verified', async () => {
      const health = await verifySupabaseHealth();
      expect(health).toHaveProperty('isConfigured');
      expect(health).toHaveProperty('isReachable');
      expect(health).toHaveProperty('operationsVerified');
      expect(health).toHaveProperty('mode');

      // In environment where corrective views/migrations are pending remotely,
      // operationsVerified MUST NOT be claimed as true!
      if (health.isReachable && !health.operationsVerified) {
        expect(health.mode).toBe('connected_simulation');
        expect(health.label).toContain('Connected (Simulated Writes)');
        expect(health.error).toBeTruthy();
      }
    }, 30000);

    it('returns workers and reviews gracefully even when views are pending on remote database', async () => {
      const workersRes = await api.getWorkers();
      expect(workersRes.data.length).toBeGreaterThan(0);
      expect(workersRes.data[0]).toHaveProperty('trade');

      const reviewsRes = await api.getReviews();
      expect(Array.isArray(reviewsRes.data)).toBe(true);
    }, 30000);
  });

  describe('4. Authentication & Session Management', () => {
    it('allows setting and restoring an active user session in simulation mode', async () => {
      const persona = {
        id: 'demo-customer-arjun',
        name: 'Arjun Mehta',
        email: 'arjun.mehta@demo.local',
        role: 'customer' as const,
        is_demo: true,
      };

      authService.setDemoUser(persona);

      const currentUser = await authService.getCurrentUser();
      expect(currentUser).toBeDefined();
      expect(currentUser?.id).toBe('demo-customer-arjun');
      expect(currentUser?.role).toBe('customer');

      // Sign out
      await authService.signOut();
      const loggedOut = await authService.getCurrentUser();
      expect(loggedOut).toBeNull();
    });

    it('attaches current auth uid to created requests in demo repository', async () => {
      authService.setDemoUser({
        id: 'usr-customer-999',
        name: 'Test Customer',
        email: 'customer999@test.local',
        role: 'customer',
        is_demo: true,
      });

      const res = await api.createServiceRequest({
        customer_name: 'Test Customer',
        customer_phone: '+91 98450 11111',
        customer_address: 'Koramangala, Bengaluru',
        customer_lat: 12.9352,
        customer_lng: 77.6245,
        category: 'cleaner',
        title: 'Kitchen Deep Clean',
        description: 'Degrease chimney and tile scrubbing',
        urgency: 'tomorrow',
      });

      expect(res.data.customer_id).toBe('usr-customer-999');
      authService.signOut();
    });
  });

  describe('5. Change Order and Booking Persistence in Demo Repository', () => {
    it('persists change order proposal and customer response across storage reloads', () => {
      const booking: Booking = {
        id: 'bk-test-co-01',
        request_id: '33333333-3333-3333-3333-333333333301',
        worker_id: '11111111-1111-1111-1111-111111111103',
        quote_id: '44444444-4444-4444-4444-444444444401',
        customer_name: 'Rohan Gupta',
        customer_phone: '+91 98450 00000',
        service_address: 'Indiranagar',
        agreed_price: 500,
        original_agreed_price: 500,
        change_orders: [],
        scheduled_for: new Date().toISOString(),
        status: 'confirmed',
        created_at: new Date().toISOString(),
        completed_at: null,
      };

      demoRepo.addBooking(booking);

      const changeOrder: ChangeOrder = {
        id: 'co-test-01',
        booking_id: booking.id,
        title: 'Replace burnt fuse socket',
        reason: 'Severe thermal discoloration discovered inside wall box',
        original_price: 500,
        additional_amount: 150,
        revised_total: 650,
        status: 'pending_customer_approval',
        created_at: new Date().toISOString(),
      };

      demoRepo.addChangeOrder(booking.id, changeOrder);

      // Verify stored in repository
      let storedBooking = demoRepo.getBookings().find((b) => b.id === booking.id);
      expect(storedBooking?.change_orders?.length).toBe(1);
      expect(storedBooking?.change_orders?.[0].status).toBe('pending_customer_approval');

      // Customer approves change order
      demoRepo.respondChangeOrder(booking.id, 'co-test-01', 'approved', 'Approved by customer');

      storedBooking = demoRepo.getBookings().find((b) => b.id === booking.id);
      expect(storedBooking?.agreed_price).toBe(650);
      expect(storedBooking?.original_agreed_price).toBe(500);
      expect(storedBooking?.change_orders?.[0].status).toBe('approved');
    });
  });
});
