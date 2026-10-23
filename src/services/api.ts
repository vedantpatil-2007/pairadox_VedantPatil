import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Worker,
  Service,
  ServiceRequest,
  Quote,
  Booking,
  Review,
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

// Local reactive fallback state for simulation when Supabase is not configured
const localState = {
  workers: [...INITIAL_DEMO_WORKERS],
  services: [...INITIAL_DEMO_SERVICES],
  requests: [...INITIAL_DEMO_REQUESTS],
  quotes: [...INITIAL_DEMO_QUOTES],
  bookings: [...INITIAL_DEMO_BOOKINGS],
  reviews: [...INITIAL_DEMO_REVIEWS],
};

export interface ApiResponse<T> {
  data: T;
  isLiveDatabase: boolean;
  error?: string;
}

export const api = {
  /**
   * Fetch workers, optionally filtered by trade
   */
  async getWorkers(trade?: Trade | 'all'): Promise<ApiResponse<Worker[]>> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('workers').select('*').order('rating', { ascending: false });
        if (trade && trade !== 'all') {
          query = query.eq('trade', trade);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (data && data.length > 0) {
          return { data: data as Worker[], isLiveDatabase: true };
        }
      } catch (err: unknown) {
        console.warn('Supabase fetch workers failed, using local simulation state:', err);
      }
    }

    // Local fallback
    const filtered =
      !trade || trade === 'all'
        ? localState.workers
        : localState.workers.filter((w) => w.trade === trade);
    return { data: filtered, isLiveDatabase: false };
  },

  /**
   * Get worker by ID
   */
  async getWorkerById(workerId: string): Promise<ApiResponse<Worker | null>> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('workers')
          .select('*')
          .eq('id', workerId)
          .single();
        if (error) throw error;
        return { data: data as Worker, isLiveDatabase: true };
      } catch (err) {
        console.warn('Supabase getWorkerById failed, using local state:', err);
      }
    }
    const found = localState.workers.find((w) => w.id === workerId) || null;
    return { data: found, isLiveDatabase: false };
  },

  /**
   * Fetch services offered by a worker or category
   */
  async getServices(workerId?: string): Promise<ApiResponse<Service[]>> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('services').select('*');
        if (workerId) {
          query = query.eq('worker_id', workerId);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (data) {
          return { data: data as Service[], isLiveDatabase: true };
        }
      } catch (err) {
        console.warn('Supabase fetch services failed, using local fallback:', err);
      }
    }

    const filtered = workerId
      ? localState.services.filter((s) => s.worker_id === workerId)
      : localState.services;
    return { data: filtered, isLiveDatabase: false };
  },

  /**
   * Create a new Service Request
   */
  async createServiceRequest(
    payload: Omit<ServiceRequest, 'id' | 'created_at' | 'updated_at' | 'status'>
  ): Promise<ApiResponse<ServiceRequest>> {
    const newRequest: ServiceRequest = {
      ...payload,
      id: crypto.randomUUID ? crypto.randomUUID() : `sr-${Date.now()}`,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('service_requests')
          .insert({
            customer_name: newRequest.customer_name,
            customer_phone: newRequest.customer_phone,
            customer_address: newRequest.customer_address,
            customer_lat: newRequest.customer_lat,
            customer_lng: newRequest.customer_lng,
            category: newRequest.category,
            title: newRequest.title,
            description: newRequest.description,
            urgency: newRequest.urgency,
            budget: newRequest.budget,
            preferred_worker_id: newRequest.preferred_worker_id || null,
            status: 'open',
          })
          .select()
          .single();

        if (error) throw error;
        return { data: data as ServiceRequest, isLiveDatabase: true };
      } catch (err: unknown) {
        console.error('Supabase createServiceRequest error:', err);
        return {
          data: newRequest,
          isLiveDatabase: false,
          error: (err as Error).message || 'Failed to save to Supabase. Stored in local preview only.',
        };
      }
    }

    localState.requests.unshift(newRequest);
    return { data: newRequest, isLiveDatabase: false };
  },

  /**
   * Get all service requests
   */
  async getServiceRequests(category?: Trade | 'all'): Promise<ApiResponse<ServiceRequest[]>> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('service_requests').select('*').order('created_at', { ascending: false });
        if (category && category !== 'all') {
          query = query.eq('category', category);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (data) {
          return { data: data as ServiceRequest[], isLiveDatabase: true };
        }
      } catch (err) {
        console.warn('Supabase getServiceRequests failed, using local state:', err);
      }
    }

    const filtered =
      !category || category === 'all'
        ? localState.requests
        : localState.requests.filter((r) => r.category === category);
    return { data: [...filtered], isLiveDatabase: false };
  },

  /**
   * Get quotes for a specific request or worker
   */
  async getQuotes(filter?: { requestId?: string; workerId?: string }): Promise<ApiResponse<Quote[]>> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase
          .from('quotes')
          .select('*, worker:workers(*), request:service_requests(*)')
          .order('created_at', { ascending: false });

        if (filter?.requestId) {
          query = query.eq('request_id', filter.requestId);
        }
        if (filter?.workerId) {
          query = query.eq('worker_id', filter.workerId);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (data) {
          return { data: data as Quote[], isLiveDatabase: true };
        }
      } catch (err) {
        console.warn('Supabase getQuotes failed, using local state:', err);
      }
    }

    let result = [...localState.quotes];
    if (filter?.requestId) {
      result = result.filter((q) => q.request_id === filter.requestId);
    }
    if (filter?.workerId) {
      result = result.filter((q) => q.worker_id === filter.workerId);
    }

    // Populate joined relations in local fallback
    const enriched = result.map((q) => ({
      ...q,
      worker: localState.workers.find((w) => w.id === q.worker_id),
      request: localState.requests.find((r) => r.id === q.request_id),
    }));

    return { data: enriched, isLiveDatabase: false };
  },

  /**
   * Submit a quote from a worker
   */
  async submitQuote(payload: {
    request_id: string;
    worker_id: string;
    amount: number;
    estimated_duration: string;
    notes?: string;
  }): Promise<ApiResponse<Quote>> {
    const newQuote: Quote = {
      id: crypto.randomUUID ? crypto.randomUUID() : `qt-${Date.now()}`,
      request_id: payload.request_id,
      worker_id: payload.worker_id,
      amount: payload.amount,
      estimated_duration: payload.estimated_duration,
      notes: payload.notes || '',
      status: 'pending',
      counter_amount: null,
      counter_notes: null,
      last_updated_by: 'worker',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('quotes')
          .insert({
            request_id: payload.request_id,
            worker_id: payload.worker_id,
            amount: payload.amount,
            estimated_duration: payload.estimated_duration,
            notes: payload.notes,
            status: 'pending',
            last_updated_by: 'worker',
          })
          .select('*, worker:workers(*), request:service_requests(*)')
          .single();

        if (error) throw error;

        // Also update request status to 'quoted'
        await supabase
          .from('service_requests')
          .update({ status: 'quoted', updated_at: new Date().toISOString() })
          .eq('id', payload.request_id);

        return { data: data as Quote, isLiveDatabase: true };
      } catch (err: unknown) {
        console.error('Supabase submitQuote error:', err);
        return {
          data: newQuote,
          isLiveDatabase: false,
          error: (err as Error).message || 'Failed to submit quote to Supabase.',
        };
      }
    }

    localState.quotes.unshift(newQuote);
    // Update local request status
    const req = localState.requests.find((r) => r.id === payload.request_id);
    if (req && req.status === 'open') {
      req.status = 'quoted';
      req.updated_at = new Date().toISOString();
    }

    return {
      data: {
        ...newQuote,
        worker: localState.workers.find((w) => w.id === newQuote.worker_id),
        request: localState.requests.find((r) => r.id === newQuote.request_id),
      },
      isLiveDatabase: false,
    };
  },

  /**
   * Submit a counteroffer (Customer or Worker proposing a different price)
   */
  async submitCounteroffer(
    quoteId: string,
    counterAmount: number,
    counterNotes: string,
    by: 'customer' | 'worker'
  ): Promise<ApiResponse<Quote>> {
    const updatedAt = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('quotes')
          .update({
            counter_amount: counterAmount,
            counter_notes: counterNotes,
            status: 'countered',
            last_updated_by: by,
            updated_at: updatedAt,
          })
          .eq('id', quoteId)
          .select('*, worker:workers(*), request:service_requests(*)')
          .single();

        if (error) throw error;
        return { data: data as Quote, isLiveDatabase: true };
      } catch (err) {
        console.error('Supabase submitCounteroffer error:', err);
      }
    }

    // Local fallback
    const quote = localState.quotes.find((q) => q.id === quoteId);
    if (quote) {
      quote.counter_amount = counterAmount;
      quote.counter_notes = counterNotes;
      quote.status = 'countered';
      quote.last_updated_by = by;
      quote.updated_at = updatedAt;
      return {
        data: {
          ...quote,
          worker: localState.workers.find((w) => w.id === quote.worker_id),
          request: localState.requests.find((r) => r.id === quote.request_id),
        },
        isLiveDatabase: false,
      };
    }

    throw new Error('Quote not found');
  },

  /**
   * Agree on quote / counteroffer and confirm booking
   */
  async confirmBooking(payload: {
    quoteId: string;
    requestId: string;
    workerId: string;
    customerName: string;
    customerPhone: string;
    serviceAddress: string;
    agreedPrice: number;
    scheduledFor?: string;
  }): Promise<ApiResponse<Booking>> {
    const now = new Date().toISOString();
    const scheduledTime = payload.scheduledFor || new Date(Date.now() + 2 * 3600000).toISOString();

    const newBooking: Booking = {
      id: crypto.randomUUID ? crypto.randomUUID() : `bk-${Date.now()}`,
      request_id: payload.requestId,
      worker_id: payload.workerId,
      quote_id: payload.quoteId,
      customer_name: payload.customerName,
      customer_phone: payload.customerPhone,
      service_address: payload.serviceAddress,
      agreed_price: payload.agreedPrice,
      scheduled_for: scheduledTime,
      status: 'confirmed',
      created_at: now,
      completed_at: null,
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        // 1. Insert booking
        const { data: bookingData, error: bookingErr } = await supabase
          .from('bookings')
          .insert({
            request_id: payload.requestId,
            worker_id: payload.workerId,
            quote_id: payload.quoteId,
            customer_name: payload.customerName,
            customer_phone: payload.customerPhone,
            service_address: payload.serviceAddress,
            agreed_price: payload.agreedPrice,
            scheduled_for: scheduledTime,
            status: 'confirmed',
          })
          .select('*, worker:workers(*), request:service_requests(*)')
          .single();

        if (bookingErr) throw bookingErr;

        // 2. Mark quote as accepted
        await supabase
          .from('quotes')
          .update({ status: 'accepted', updated_at: now })
          .eq('id', payload.quoteId);

        // 3. Mark request as booked
        await supabase
          .from('service_requests')
          .update({ status: 'booked', updated_at: now })
          .eq('id', payload.requestId);

        return { data: bookingData as Booking, isLiveDatabase: true };
      } catch (err: unknown) {
        console.error('Supabase confirmBooking error:', err);
        return {
          data: newBooking,
          isLiveDatabase: false,
          error: (err as Error).message || 'Failed to persist booking in Supabase.',
        };
      }
    }

    // Local fallback
    localState.bookings.unshift(newBooking);

    // Update quote status
    const quote = localState.quotes.find((q) => q.id === payload.quoteId);
    if (quote) {
      quote.status = 'accepted';
      quote.updated_at = now;
    }

    // Update request status
    const req = localState.requests.find((r) => r.id === payload.requestId);
    if (req) {
      req.status = 'booked';
      req.updated_at = now;
    }

    return {
      data: {
        ...newBooking,
        worker: localState.workers.find((w) => w.id === newBooking.worker_id),
        request: localState.requests.find((r) => r.id === newBooking.request_id),
      },
      isLiveDatabase: false,
    };
  },

  /**
   * Get bookings
   */
  async getBookings(filter?: { workerId?: string; customerPhone?: string }): Promise<ApiResponse<Booking[]>> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase
          .from('bookings')
          .select('*, worker:workers(*), request:service_requests(*)')
          .order('created_at', { ascending: false });

        if (filter?.workerId) {
          query = query.eq('worker_id', filter.workerId);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (data) {
          return { data: data as Booking[], isLiveDatabase: true };
        }
      } catch (err) {
        console.warn('Supabase getBookings failed, using local state:', err);
      }
    }

    let list = [...localState.bookings];
    if (filter?.workerId) {
      list = list.filter((b) => b.worker_id === filter.workerId);
    }

    const enriched = list.map((b) => ({
      ...b,
      worker: localState.workers.find((w) => w.id === b.worker_id),
      request: localState.requests.find((r) => r.id === b.request_id),
    }));

    return { data: enriched, isLiveDatabase: false };
  },

  /**
   * Update booking status (e.g. 'in_progress', 'completed')
   */
  async updateBookingStatus(
    bookingId: string,
    status: Booking['status'],
    completionNotes?: string
  ): Promise<ApiResponse<Booking>> {
    const completedAt = status === 'completed' ? new Date().toISOString() : null;

    if (isSupabaseConfigured() && supabase) {
      try {
        const updateData: Record<string, unknown> = { status };
        if (completedAt) updateData.completed_at = completedAt;
        if (completionNotes) updateData.completion_notes = completionNotes;

        const { data, error } = await supabase
          .from('bookings')
          .update(updateData)
          .eq('id', bookingId)
          .select('*, worker:workers(*), request:service_requests(*)')
          .single();

        if (error) throw error;

        // If completed, update request status to completed
        if (status === 'completed' && data?.request_id) {
          await supabase
            .from('service_requests')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', data.request_id);
        }

        return { data: data as Booking, isLiveDatabase: true };
      } catch (err) {
        console.error('Supabase updateBookingStatus error:', err);
      }
    }

    // Local fallback
    const bk = localState.bookings.find((b) => b.id === bookingId);
    if (!bk) throw new Error('Booking not found');

    bk.status = status;
    if (completedAt) bk.completed_at = completedAt;
    if (completionNotes) bk.completion_notes = completionNotes;

    const req = localState.requests.find((r) => r.id === bk.request_id);
    if (req && status === 'completed') {
      req.status = 'completed';
      req.updated_at = new Date().toISOString();
    }

    return {
      data: {
        ...bk,
        worker: localState.workers.find((w) => w.id === bk.worker_id),
        request: localState.requests.find((r) => r.id === bk.request_id),
      },
      isLiveDatabase: false,
    };
  },

  /**
   * Submit customer review
   */
  async submitReview(payload: {
    bookingId: string;
    workerId: string;
    customerName: string;
    rating: number;
    comment: string;
  }): Promise<ApiResponse<Review>> {
    const newReview: Review = {
      id: crypto.randomUUID ? crypto.randomUUID() : `rev-${Date.now()}`,
      booking_id: payload.bookingId,
      worker_id: payload.workerId,
      customer_name: payload.customerName,
      rating: payload.rating,
      comment: payload.comment,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .insert({
            booking_id: payload.bookingId,
            worker_id: payload.workerId,
            customer_name: payload.customerName,
            rating: payload.rating,
            comment: payload.comment,
          })
          .select()
          .single();

        if (error) throw error;
        return { data: data as Review, isLiveDatabase: true };
      } catch (err) {
        console.error('Supabase submitReview error:', err);
      }
    }

    // Local fallback
    localState.reviews.unshift(newReview);

    // Update worker average rating and count in local state
    const worker = localState.workers.find((w) => w.id === payload.workerId);
    if (worker) {
      const allWorkerReviews = localState.reviews.filter((r) => r.worker_id === payload.workerId);
      const sum = allWorkerReviews.reduce((acc, curr) => acc + curr.rating, 0);
      worker.rating = Math.round((sum / allWorkerReviews.length) * 10) / 10;
      worker.review_count = allWorkerReviews.length;
    }

    return { data: newReview, isLiveDatabase: false };
  },

  /**
   * Get reviews for a worker
   */
  async getReviews(workerId?: string): Promise<ApiResponse<Review[]>> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('reviews').select('*').order('created_at', { ascending: false });
        if (workerId) {
          query = query.eq('worker_id', workerId);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (data) {
          return { data: data as Review[], isLiveDatabase: true };
        }
      } catch (err) {
        console.warn('Supabase getReviews failed, using local state:', err);
      }
    }

    const filtered = workerId
      ? localState.reviews.filter((r) => r.worker_id === workerId)
      : localState.reviews;
    return { data: [...filtered], isLiveDatabase: false };
  },
};
