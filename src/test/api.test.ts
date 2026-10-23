import { describe, it, expect } from 'vitest';
import { api } from '../services/api';

describe('SkillNear API Service & Workflow Engine', () => {
  it('retrieves demo workers covering all required trades', async () => {
    const res = await api.getWorkers();
    expect(res.data).toBeDefined();
    expect(res.data.length).toBeGreaterThanOrEqual(8);

    const trades = res.data.map((w) => w.trade);
    expect(trades).toContain('electrician');
    expect(trades).toContain('plumber');
    expect(trades).toContain('cleaner');
    expect(trades).toContain('painter');

    // All demo workers have clearly labelled demo flags
    expect(res.data.every((w) => w.is_demo === true)).toBe(true);
  });

  it('filters workers by specific trade category', async () => {
    const electriciansRes = await api.getWorkers('electrician');
    expect(electriciansRes.data.length).toBeGreaterThanOrEqual(2);
    expect(electriciansRes.data.every((w) => w.trade === 'electrician')).toBe(true);

    const plumbersRes = await api.getWorkers('plumber');
    expect(plumbersRes.data.length).toBeGreaterThanOrEqual(2);
    expect(plumbersRes.data.every((w) => w.trade === 'plumber')).toBe(true);
  });

  it('creates a service request and appends to feed', async () => {
    const newReq = await api.createServiceRequest({
      customer_name: 'Test Customer',
      customer_phone: '+91 99999 88888',
      customer_address: '123 Test St, Koramangala',
      customer_lat: 12.9352,
      customer_lng: 77.6245,
      category: 'electrician',
      title: 'Fix shorted power socket',
      description: 'Sparks when plugging in microwave',
      urgency: 'immediate',
      budget: 400,
    });

    expect(newReq.data.id).toBeDefined();
    expect(newReq.data.status).toBe('open');
    expect(newReq.data.title).toBe('Fix shorted power socket');

    const allRequests = await api.getServiceRequests();
    expect(allRequests.data.some((r) => r.id === newReq.data.id)).toBe(true);
  });

  it('submits a quote from a worker for a request', async () => {
    const requests = await api.getServiceRequests();
    const targetReq = requests.data[0];
    const workers = await api.getWorkers();
    const worker = workers.data[0];

    const quoteRes = await api.submitQuote({
      request_id: targetReq.id,
      worker_id: worker.id,
      amount: 450,
      estimated_duration: '1.5 hours',
      notes: 'Includes replacement socket',
    });

    expect(quoteRes.data.id).toBeDefined();
    expect(quoteRes.data.amount).toBe(450);
    expect(quoteRes.data.status).toBe('pending');
  });

  it('handles counteroffer price negotiation between customer and worker', async () => {
    const quotes = await api.getQuotes();
    expect(quotes.data.length).toBeGreaterThan(0);
    const targetQuote = quotes.data[0];

    const counterRes = await api.submitCounteroffer(
      targetQuote.id,
      420,
      'Can you do 420 for an immediate visit?',
      'customer'
    );

    expect(counterRes.data.status).toBe('countered');
    expect(counterRes.data.counter_amount).toBe(420);
    expect(counterRes.data.counter_notes).toContain('420');
    expect(counterRes.data.last_updated_by).toBe('customer');
  });

  it('confirms an agreed booking and creates booking record', async () => {
    const quotes = await api.getQuotes();
    const targetQuote = quotes.data[0];
    const workers = await api.getWorkers();

    const bookingRes = await api.confirmBooking({
      quoteId: targetQuote.id,
      requestId: targetQuote.request_id,
      workerId: targetQuote.worker_id,
      customerName: 'Test Booking Customer',
      customerPhone: '+91 99999 11111',
      serviceAddress: 'Flat 4B, Koramangala',
      agreedPrice: targetQuote.counter_amount || targetQuote.amount,
    });

    expect(bookingRes.data.id).toBeDefined();
    expect(bookingRes.data.status).toBe('confirmed');
    expect(bookingRes.data.agreed_price).toBeGreaterThan(0);

    // Verify booking appears in bookings list
    const allBookings = await api.getBookings();
    expect(allBookings.data.some((b) => b.id === bookingRes.data.id)).toBe(true);
  });

  it('progresses booking status and submits customer review', async () => {
    const bookings = await api.getBookings();
    const targetBooking = bookings.data[0];

    // Transition to completed
    const updated = await api.updateBookingStatus(targetBooking.id, 'completed');
    expect(updated.data.status).toBe('completed');
    expect(updated.data.completed_at).toBeDefined();

    // Submit review
    const reviewRes = await api.submitReview({
      bookingId: targetBooking.id,
      workerId: targetBooking.worker_id,
      customerName: 'Pleased Customer',
      rating: 5,
      comment: 'Arrived promptly and solved the problem quickly!',
    });

    expect(reviewRes.data.id).toBeDefined();
    expect(reviewRes.data.rating).toBe(5);
    expect(reviewRes.data.comment).toContain('promptly');

    // Verify review is retrievable
    const reviews = await api.getReviews(targetBooking.worker_id);
    expect(reviews.data.some((r) => r.id === reviewRes.data.id)).toBe(true);
  });
});
