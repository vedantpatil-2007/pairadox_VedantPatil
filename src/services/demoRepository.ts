import {
  Worker,
  Service,
  ServiceRequest,
  Quote,
  Booking,
  Review,
  ChangeOrder,
  RepairPassport,
  Trade,
} from '../types';
import {
  INITIAL_DEMO_WORKERS,
  INITIAL_DEMO_SERVICES,
  INITIAL_DEMO_REQUESTS,
  INITIAL_DEMO_QUOTES,
  INITIAL_DEMO_BOOKINGS,
  INITIAL_DEMO_REVIEWS,
} from '../data/mockSeedData';

const DEMO_STORAGE_KEY = 'skillnear_demo_repository_v2';

export interface DemoRepositoryData {
  version: number;
  lastUpdated: string;
  workers: Worker[];
  services: Service[];
  requests: ServiceRequest[];
  quotes: Quote[];
  bookings: Booking[];
  reviews: Review[];
  workerBaseRatings: Record<string, { baseRating: number; baseCount: number }>;
}

/**
 * Creates fresh demo seed data with historical rating baselines preserved
 */
function createInitialDemoData(): DemoRepositoryData {
  const workerBaseRatings: Record<string, { baseRating: number; baseCount: number }> = {};
  INITIAL_DEMO_WORKERS.forEach((w) => {
    workerBaseRatings[w.id] = {
      baseRating: w.rating,
      baseCount: w.review_count,
    };
  });

  const requests = JSON.parse(JSON.stringify(INITIAL_DEMO_REQUESTS)) as ServiceRequest[];
  requests.forEach((r) => {
    if (r.scope) {
      if (!r.scope.problem && r.scope.problem_description) {
        r.scope.problem = r.scope.problem_description;
      }
      if (!r.scope.deliverables && r.scope.expected_deliverables) {
        r.scope.deliverables = r.scope.expected_deliverables;
      }
      if (!r.scope.problem_description && r.scope.problem) {
        r.scope.problem_description = r.scope.problem;
      }
      if (!r.scope.expected_deliverables && r.scope.deliverables) {
        r.scope.expected_deliverables = r.scope.deliverables;
      }
    }
  });

  return {
    version: 2,
    lastUpdated: new Date().toISOString(),
    workers: JSON.parse(JSON.stringify(INITIAL_DEMO_WORKERS)),
    services: JSON.parse(JSON.stringify(INITIAL_DEMO_SERVICES)),
    requests,
    quotes: JSON.parse(JSON.stringify(INITIAL_DEMO_QUOTES)),
    bookings: JSON.parse(JSON.stringify(INITIAL_DEMO_BOOKINGS)),
    reviews: JSON.parse(JSON.stringify(INITIAL_DEMO_REVIEWS)),
    workerBaseRatings,
  };
}

/**
 * Sanitizes customer details before saving to browser localStorage.
 * Ensures real phone numbers or exact private residences are never retained in demo storage.
 */
function sanitizeCustomerData(req: ServiceRequest): ServiceRequest {
  const sanitized = { ...req };
  // If phone looks like a private number, mask it for demo repository safety
  if (sanitized.customer_phone && !sanitized.customer_phone.includes('0000')) {
    const raw = sanitized.customer_phone.trim();
    sanitized.customer_phone = raw.length > 5 ? `${raw.slice(0, 5)} XXXXX (Demo)` : '+91 98450 00000';
  }
  return sanitized;
}

class DemoRepository {
  private memoryCache: DemoRepositoryData | null = null;

  private isLocalStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  public getData(): DemoRepositoryData {
    if (this.memoryCache) {
      return this.memoryCache;
    }

    if (this.isLocalStorageAvailable()) {
      try {
        const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as DemoRepositoryData;
          if (parsed && parsed.version === 2 && Array.isArray(parsed.requests)) {
            this.memoryCache = parsed;
            return parsed;
          }
        }
      } catch (err) {
        console.warn('Failed to read demo repository from localStorage, re-initializing:', err);
      }
    }

    const fresh = createInitialDemoData();
    this.saveData(fresh);
    return fresh;
  }

  public saveData(data: DemoRepositoryData): void {
    data.lastUpdated = new Date().toISOString();
    this.memoryCache = data;

    if (this.isLocalStorageAvailable()) {
      try {
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        console.warn('Failed to save demo repository to localStorage:', err);
      }
    }
  }

  public reset(): DemoRepositoryData {
    if (this.isLocalStorageAvailable()) {
      try {
        window.localStorage.removeItem(DEMO_STORAGE_KEY);
      } catch (err) {
        console.warn('Failed to clear demo repository from localStorage:', err);
      }
    }
    this.memoryCache = null;
    const fresh = createInitialDemoData();
    this.saveData(fresh);
    return fresh;
  }

  // --- REPOSITORIES OPERATIONS ---

  public getWorkers(trade?: Trade | 'all'): Worker[] {
    const data = this.getData();
    if (!trade || trade === 'all') return [...data.workers];
    return data.workers.filter((w) => w.trade === trade);
  }

  public getWorkerById(id: string): Worker | null {
    const data = this.getData();
    return data.workers.find((w) => w.id === id) || null;
  }

  public getServices(workerId?: string): Service[] {
    const data = this.getData();
    if (!workerId) return [...data.services];
    return data.services.filter((s) => s.worker_id === workerId);
  }

  public getRequests(category?: Trade | 'all'): ServiceRequest[] {
    const data = this.getData();
    if (!category || category === 'all') return [...data.requests];
    return data.requests.filter((r) => r.category === category);
  }

  public addRequest(request: ServiceRequest): ServiceRequest {
    const data = this.getData();
    const safeRequest = sanitizeCustomerData(request);
    if (safeRequest.scope) {
      if (!safeRequest.scope.problem && safeRequest.scope.problem_description) {
        safeRequest.scope.problem = safeRequest.scope.problem_description;
      }
      if (!safeRequest.scope.deliverables && safeRequest.scope.expected_deliverables) {
        safeRequest.scope.deliverables = safeRequest.scope.expected_deliverables;
      }
      if (!safeRequest.scope.problem_description && safeRequest.scope.problem) {
        safeRequest.scope.problem_description = safeRequest.scope.problem;
      }
      if (!safeRequest.scope.expected_deliverables && safeRequest.scope.deliverables) {
        safeRequest.scope.expected_deliverables = safeRequest.scope.deliverables;
      }
    }
    data.requests.unshift(safeRequest);
    this.saveData(data);
    return safeRequest;
  }

  public getQuotes(filter?: { requestId?: string; workerId?: string }): Quote[] {
    const data = this.getData();
    let result = [...data.quotes];
    if (filter?.requestId) {
      result = result.filter((q) => q.request_id === filter.requestId);
    }
    if (filter?.workerId) {
      result = result.filter((q) => q.worker_id === filter.workerId);
    }
    return result;
  }

  public addQuote(quote: Quote): Quote {
    const data = this.getData();
    data.quotes.unshift(quote);
    // Update underlying request status to quoted if open
    const req = data.requests.find((r) => r.id === quote.request_id);
    if (req && req.status === 'open') {
      req.status = 'quoted';
      req.updated_at = new Date().toISOString();
    }
    this.saveData(data);
    return quote;
  }

  public updateQuote(quoteId: string, updates: Partial<Quote>): Quote | null {
    const data = this.getData();
    const quote = data.quotes.find((q) => q.id === quoteId);
    if (!quote) return null;
    Object.assign(quote, updates, { updated_at: new Date().toISOString() });
    this.saveData(data);
    return quote;
  }

  public getBookings(workerId?: string): Booking[] {
    const data = this.getData();
    if (!workerId) return [...data.bookings];
    return data.bookings.filter((b) => b.worker_id === workerId);
  }

  public addBooking(booking: Booking): Booking {
    const data = this.getData();
    data.bookings.unshift(booking);
    // Mark quote as accepted
    const q = data.quotes.find((quote) => quote.id === booking.quote_id);
    if (q) {
      q.status = 'accepted';
      q.updated_at = new Date().toISOString();
    }
    // Mark request as booked
    const r = data.requests.find((req) => req.id === booking.request_id);
    if (r) {
      r.status = 'booked';
      r.updated_at = new Date().toISOString();
    }
    this.saveData(data);
    return booking;
  }

  public updateBooking(bookingId: string, updates: Partial<Booking>): Booking | null {
    const data = this.getData();
    const bk = data.bookings.find((b) => b.id === bookingId);
    if (!bk) return null;
    Object.assign(bk, updates);
    if (updates.status === 'completed') {
      const req = data.requests.find((r) => r.id === bk.request_id);
      if (req) {
        req.status = 'completed';
        req.updated_at = new Date().toISOString();
      }
    }
    this.saveData(data);
    return bk;
  }

  public addChangeOrder(bookingId: string, changeOrder: ChangeOrder): Booking | null {
    const data = this.getData();
    const bk = data.bookings.find((b) => b.id === bookingId);
    if (!bk) return null;
    if (!bk.change_orders) bk.change_orders = [];
    bk.change_orders.push(changeOrder);
    if (!bk.original_agreed_price) {
      bk.original_agreed_price = bk.agreed_price;
    }
    this.saveData(data);
    return bk;
  }

  public respondChangeOrder(
    bookingId: string,
    changeOrderId: string,
    action: 'approved' | 'rejected',
    notes?: string
  ): Booking | null {
    const data = this.getData();
    const bk = data.bookings.find((b) => b.id === bookingId);
    if (!bk) return null;
    const co = (bk.change_orders || []).find((c) => c.id === changeOrderId);
    if (!co) return null;

    co.status = action;
    co.responded_at = new Date().toISOString();
    if (notes) co.customer_notes = notes;

    if (action === 'approved') {
      if (!bk.original_agreed_price) {
        bk.original_agreed_price = bk.agreed_price;
      }
      bk.agreed_price = co.revised_total;
      if (co.crew_adjustment?.added_workers) {
        bk.crew_size = (bk.crew_size || 1) + co.crew_adjustment.added_workers;
      }
    }
    this.saveData(data);
    return bk;
  }

  public getReviews(workerId?: string): Review[] {
    const data = this.getData();
    if (!workerId) return [...data.reviews];
    return data.reviews.filter((r) => r.worker_id === workerId);
  }

  /**
   * Adds review and mathematically computes updated worker rating
   * while preserving historical seed rating baselines.
   */
  public addReview(review: Review): { review: Review; worker: Worker | null } {
    const data = this.getData();
    data.reviews.unshift(review);

    const worker = data.workers.find((w) => w.id === review.worker_id);
    if (worker) {
      // Retrieve or initialize baseline ratings for this worker
      const baseline = data.workerBaseRatings[worker.id] || {
        baseRating: worker.rating,
        baseCount: worker.review_count,
      };
      data.workerBaseRatings[worker.id] = baseline;

      // Filter simulation reviews for this worker that are newly submitted (not in initial seed)
      const initialReviewIds = new Set(INITIAL_DEMO_REVIEWS.map((r) => r.id));
      const newReviews = data.reviews.filter(
        (r) => !initialReviewIds.has(r.id) && r.worker_id === worker.id
      );
      const newReviewsSum = newReviews.reduce((sum, r) => sum + r.rating, 0);

      // Total count = historical baseCount + new reviews
      const totalCount = baseline.baseCount + newReviews.length;
      // Total sum = historical rating * count + new reviews sum
      const totalSum = baseline.baseRating * baseline.baseCount + newReviewsSum;

      worker.rating = Math.round((totalSum / totalCount) * 10) / 10;
      worker.review_count = totalCount;
    }

    this.saveData(data);
    return { review, worker: worker || null };
  }
}

export const demoRepo = new DemoRepository();
