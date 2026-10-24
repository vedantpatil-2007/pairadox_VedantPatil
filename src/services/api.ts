import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Worker,
  Service,
  ServiceRequest,
  Quote,
  Booking,
  Review,
  Trade,
  ScopeLock,
  QuoteItemization,
  ChangeOrder,
  RepairPassport,
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

async function getActiveAuthUid(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Sanitizes a service request for the public worker feed.
 * Mirrors the public.job_leads SQL view contract:
 *  - customer_phone: strictly null
 *  - customer_address: masked to generalized vicinity
 *  - customer_name: first name + initial
 *  - customer_lat / lng: rounded to 2 decimal places (~1.1 km neighborhood resolution)
 *  - title / description: contact details (phone numbers and email addresses) redacted
 */
export function maskLeadForPublicFeed(
  req: ServiceRequest,
  viewerUid?: string | null
): ServiceRequest {
  const isOwner = Boolean(viewerUid && req.customer_id === viewerUid);
  if (isOwner) return req;

  const rawName = (req.customer_name || 'Verified Customer').trim();
  const parts = rawName.split(/\s+/);
  const maskedName =
    parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];

  // Redact phone numbers and email addresses from title and description
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]*)?(?:\b[6-9]\d{9}\b|\b\d{5}[-.\s]\d{5}\b|\b\d{3,4}[-.\s]\d{3,4}[-.\s]\d{3,4}\b)/g;

  const cleanTitle = (req.title || '')
    .replace(emailRegex, '[contact redacted]')
    .replace(phoneRegex, '[contact redacted]');

  const cleanDescription = (req.description || '')
    .replace(emailRegex, '[contact redacted]')
    .replace(phoneRegex, '[contact redacted]');

  return {
    ...req,
    title: cleanTitle,
    description: cleanDescription,
    customer_name: maskedName,
    customer_phone: null,
    customer_address:
      'Hyperlocal Vicinity (Exact address provided upon confirmed booking)',
    customer_lat: Math.round(req.customer_lat * 100) / 100,
    customer_lng: Math.round(req.customer_lng * 100) / 100,
  };
}

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
        // Query privacy-preserving workers_directory view (omits worker phone, email, and exact street)
        let query = supabase.from('workers_directory').select('*').order('rating', { ascending: false });
        if (trade && trade !== 'all') {
          query = query.eq('trade', trade);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (data && data.length > 0) {
          return { data: data as Worker[], isLiveDatabase: true };
        }
        // If table exists in Supabase but has not been populated with demo seed records yet,
        // provide the demo seed workers so the application and test suites function properly.
        const filtered =
          !trade || trade === 'all'
            ? localState.workers
            : localState.workers.filter((w) => w.trade === trade);
        return { data: filtered, isLiveDatabase: false };
      } catch (err: unknown) {
        console.warn('Supabase fetch workers failed, using local simulation state:', err);
        const filtered =
          !trade || trade === 'all'
            ? localState.workers
            : localState.workers.filter((w) => w.trade === trade);
        return {
          data: filtered,
          isLiveDatabase: false,
          error: (err as Error)?.message || 'Database query failed',
        };
      }
    }

    // Local fallback when not configured
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
          .from('workers_directory')
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
    const uid = await getActiveAuthUid();
    const newRequest: ServiceRequest = {
      ...payload,
      id: crypto.randomUUID ? crypto.randomUUID() : `sr-${Date.now()}`,
      customer_id: uid,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const insertPayload: Record<string, unknown> = {
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
        };
        if (uid) insertPayload.customer_id = uid;

        const { data, error } = await supabase
          .from('service_requests')
          .insert(insertPayload)
          .select()
          .single();

        if (error) throw error;
        return { data: data as ServiceRequest, isLiveDatabase: true };
      } catch (err: unknown) {
        console.error('Supabase createServiceRequest error:', err);
        localState.requests.unshift(newRequest);
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
   * Get public job leads specifically for the worker portal and open broadcast discovery.
   * Strictly queries the public.job_leads view in Supabase, guaranteeing that customer
   * phone is null, address is masked, name is anonymized, and coordinates are coarsened.
   */
  async getJobLeads(category?: Trade | 'all'): Promise<ApiResponse<ServiceRequest[]>> {
    const uid = await getActiveAuthUid();
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('job_leads').select('*').order('created_at', { ascending: false });
        if (category && category !== 'all') {
          query = query.eq('category', category);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return { data: data as ServiceRequest[], isLiveDatabase: true };
        }
      } catch (err) {
        console.warn('Supabase getJobLeads view query failed, using fallback:', err);
      }
    }

    // Local fallback: apply strict privacy masking to all eligible open/quoted leads
    const eligible = localState.requests.filter(
      (r) => r.status === 'open' || r.status === 'quoted' || (uid && r.customer_id === uid)
    );
    const filtered =
      !category || category === 'all'
        ? eligible
        : eligible.filter((r) => r.category === category);

    const masked = filtered.map((r) => maskLeadForPublicFeed(r, uid));
    return { data: masked, isLiveDatabase: false };
  },

  /**
   * Get all service requests
   */
  async getServiceRequests(category?: Trade | 'all'): Promise<ApiResponse<ServiceRequest[]>> {
    const uid = await getActiveAuthUid();
    if (isSupabaseConfigured() && supabase) {
      try {
        // 1. Try querying the privacy-preserving job_leads view first
        let query = supabase.from('job_leads').select('*').order('created_at', { ascending: false });
        if (category && category !== 'all') {
          query = query.eq('category', category);
        }
        const { data: viewData, error: viewError } = await query;
        if (!viewError && viewData && viewData.length > 0) {
          // If localState has newly posted requests that fell back to local preview, merge them
          const unsaved = localState.requests.filter(
            (localReq) => !viewData.some((dbReq) => dbReq.id === localReq.id)
          );
          const combined = [
            ...unsaved.map((r) => maskLeadForPublicFeed(r, uid)),
            ...(viewData as ServiceRequest[]),
          ];
          return { data: combined, isLiveDatabase: true };
        }

        // 2. Fallback to direct service_requests table if view is not migrated yet
        let fallbackQuery = supabase.from('service_requests').select('*').order('created_at', { ascending: false });
        if (category && category !== 'all') {
          fallbackQuery = fallbackQuery.eq('category', category);
        }
        const { data, error } = await fallbackQuery;
        if (!error && data && data.length > 0) {
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

    const masked = filtered.map((r) => maskLeadForPublicFeed(r, uid));
    return { data: masked, isLiveDatabase: false };
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
        if (data && data.length > 0) {
          const unsaved = localState.quotes.filter(
            (localQ) => !data.some((dbQ) => dbQ.id === localQ.id)
          );
          const combined = [...unsaved, ...(data as Quote[])];
          let filtered = combined;
          if (filter?.requestId) filtered = filtered.filter((q) => q.request_id === filter.requestId);
          if (filter?.workerId) filtered = filtered.filter((q) => q.worker_id === filter.workerId);
          return { data: filtered, isLiveDatabase: true };
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
    request_id?: string;
    requestId?: string;
    worker_id?: string;
    workerId?: string;
    amount: number;
    estimated_duration?: string;
    estimatedDuration?: string;
    notes?: string;
    itemization?: QuoteItemization;
  }): Promise<ApiResponse<Quote>> {
    const requestId = payload.request_id || payload.requestId || '';
    const workerId = payload.worker_id || payload.workerId || '';
    const estimatedDuration = payload.estimated_duration || payload.estimatedDuration || '2 hours';
    const uid = await getActiveAuthUid();

    let computedAmount = payload.amount;
    if (payload.itemization) {
      if (payload.itemization.total_price) {
        computedAmount = payload.itemization.total_price;
      } else {
        const labour = payload.itemization.labour_charge ?? payload.itemization.labour_amount ?? 0;
        const materials = payload.itemization.materials_charge ?? payload.itemization.materials_amount ?? 0;
        const travel = payload.itemization.travel_fee ?? payload.itemization.travel_amount ?? 0;
        computedAmount = labour + materials + travel || payload.amount;
        payload.itemization.total_price = computedAmount;
        payload.itemization.labour_charge = labour;
        payload.itemization.materials_charge = materials;
        payload.itemization.travel_fee = travel;
      }
    }

    const newQuote: Quote = {
      id: crypto.randomUUID ? crypto.randomUUID() : `qt-${Date.now()}`,
      request_id: requestId,
      worker_id: workerId,
      creator_id: uid,
      amount: computedAmount,
      estimated_duration: estimatedDuration,
      notes: payload.notes || '',
      status: 'pending',
      counter_amount: null,
      counter_notes: null,
      last_updated_by: 'worker',
      itemization: payload.itemization,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const quoteInsert: Record<string, unknown> = {
          request_id: requestId,
          worker_id: workerId,
          amount: computedAmount,
          estimated_duration: estimatedDuration,
          notes: payload.notes,
          status: 'pending',
          last_updated_by: 'worker',
        };
        if (payload.itemization) quoteInsert.itemization = payload.itemization;
        if (uid) quoteInsert.creator_id = uid;

        const { data, error } = await supabase
          .from('quotes')
          .insert(quoteInsert)
          .select('*, worker:workers(*), request:service_requests(*)')
          .single();

        if (error) throw error;

        // Also update request status to 'quoted'
        await supabase
          .from('service_requests')
          .update({ status: 'quoted', updated_at: new Date().toISOString() })
          .eq('id', requestId);

        return { data: data as Quote, isLiveDatabase: true };
      } catch (err: unknown) {
        console.error('Supabase submitQuote error:', err);
        localState.quotes.unshift(newQuote);
        const req = localState.requests.find((r) => r.id === requestId);
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
          error: (err as Error).message || 'Failed to submit quote to Supabase.',
        };
      }
    }

    localState.quotes.unshift(newQuote);
    // Update local request status
    const req = localState.requests.find((r) => r.id === requestId);
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
    const uid = await getActiveAuthUid();

    // Look up the underlying request to resolve customer details if placeholders were passed
    const targetReq = localState.requests.find((r) => r.id === payload.requestId);
    const resolvedName =
      payload.customerName && payload.customerName !== 'Customer'
        ? payload.customerName
        : targetReq?.customer_name || 'Customer';
    const resolvedPhone =
      payload.customerPhone &&
      !payload.customerPhone.includes('0000') &&
      payload.customerPhone.trim() !== ''
        ? payload.customerPhone
        : targetReq?.customer_phone || '+91 98450 11223';
    const resolvedAddress =
      payload.serviceAddress &&
      !payload.serviceAddress.includes('Location') &&
      !payload.serviceAddress.includes('Address') &&
      payload.serviceAddress.trim() !== ''
        ? payload.serviceAddress
        : targetReq?.customer_address || 'Koramangala, Bengaluru';

    const newBooking: Booking = {
      id: crypto.randomUUID ? crypto.randomUUID() : `bk-${Date.now()}`,
      request_id: payload.requestId,
      worker_id: payload.workerId,
      quote_id: payload.quoteId,
      customer_id: uid || targetReq?.customer_id || null,
      customer_name: resolvedName,
      customer_phone: resolvedPhone,
      service_address: resolvedAddress,
      agreed_price: payload.agreedPrice,
      original_agreed_price: payload.agreedPrice,
      change_orders: [],
      scheduled_for: scheduledTime,
      status: 'confirmed',
      created_at: now,
      completed_at: null,
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        // 1. Mark quote as accepted by customer before confirming booking
        await supabase
          .from('quotes')
          .update({ status: 'accepted', updated_at: now })
          .eq('id', payload.quoteId);

        // 2. Insert booking (enforces quote is accepted)
        const bookingInsert: Record<string, unknown> = {
          request_id: payload.requestId,
          worker_id: payload.workerId,
          quote_id: payload.quoteId,
          customer_name: resolvedName,
          customer_phone: resolvedPhone,
          service_address: resolvedAddress,
          agreed_price: payload.agreedPrice,
          scheduled_for: scheduledTime,
          status: 'confirmed',
        };
        if (uid) bookingInsert.customer_id = uid;

        const { data: bookingData, error: bookingErr } = await supabase
          .from('bookings')
          .insert(bookingInsert)
          .select('*, worker:workers(*), request:service_requests(*)')
          .single();

        if (bookingErr) throw bookingErr;

        // 3. Mark request as booked
        await supabase
          .from('service_requests')
          .update({ status: 'booked', updated_at: now })
          .eq('id', payload.requestId);

        const resBooking = bookingData as Booking;
        if (!resBooking.original_agreed_price) {
          resBooking.original_agreed_price = payload.agreedPrice;
        }
        if (!resBooking.change_orders) {
          resBooking.change_orders = [];
        }

        return { data: resBooking, isLiveDatabase: true };
      } catch (err: unknown) {
        console.error('Supabase confirmBooking error:', err);
        localState.bookings.unshift(newBooking);
        const quote = localState.quotes.find((q) => q.id === payload.quoteId);
        if (quote) {
          quote.status = 'accepted';
          quote.updated_at = now;
        }
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
        if (data && data.length > 0) {
          const unsaved = localState.bookings.filter(
            (localB) => !data.some((dbB) => dbB.id === localB.id)
          );
          const combined = [...unsaved, ...(data as Booking[])];
          let filtered = combined;
          if (filter?.workerId) filtered = filtered.filter((b) => b.worker_id === filter.workerId);
          return { data: filtered, isLiveDatabase: true };
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
    const uid = await getActiveAuthUid();
    const newReview: Review = {
      id: crypto.randomUUID ? crypto.randomUUID() : `rev-${Date.now()}`,
      booking_id: payload.bookingId,
      worker_id: payload.workerId,
      customer_id: uid,
      customer_name: payload.customerName,
      rating: payload.rating,
      comment: payload.comment,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const reviewInsert: Record<string, unknown> = {
          booking_id: payload.bookingId,
          worker_id: payload.workerId,
          customer_name: payload.customerName,
          rating: payload.rating,
          comment: payload.comment,
        };
        if (uid) reviewInsert.customer_id = uid;

        const { data, error } = await supabase
          .from('reviews')
          .insert(reviewInsert)
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
        // Query privacy-preserving public_reviews view (anonymizes customer_name, omits customer_id)
        let query = supabase.from('public_reviews').select('*').order('created_at', { ascending: false });
        if (workerId) {
          query = query.eq('worker_id', workerId);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (data && data.length > 0) {
          const unsaved = localState.reviews.filter(
            (localR) => !data.some((dbR) => dbR.id === localR.id)
          );
          const combined = [...unsaved, ...(data as Review[])];
          let filtered = combined;
          if (workerId) filtered = filtered.filter((r) => r.worker_id === workerId);
          return { data: filtered, isLiveDatabase: true };
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

  /**
   * Propose a Change Order (ScopeLock™: worker proposes extra work; requires customer approval)
   */
  async proposeChangeOrder(
    bookingId: string,
    payload: {
      title: string;
      reason: string;
      additionalAmount?: number;
      additional_amount?: number;
    }
  ): Promise<ApiResponse<Booking>> {
    const bk = localState.bookings.find((b) => b.id === bookingId);
    if (!bk) throw new Error('Booking not found');

    const additional = Number(
      payload.additionalAmount ?? payload.additional_amount ?? 0
    );

    const newChangeOrder: ChangeOrder = {
      id: crypto.randomUUID ? crypto.randomUUID() : `co-${Date.now()}`,
      booking_id: bookingId,
      title: payload.title,
      reason: payload.reason,
      original_price: bk.agreed_price,
      additional_amount: additional,
      revised_total: bk.agreed_price + additional,
      status: 'pending_customer_approval',
      created_at: new Date().toISOString(),
    };

    if (!bk.change_orders) bk.change_orders = [];
    bk.change_orders.push(newChangeOrder);
    if (!bk.original_agreed_price) {
      bk.original_agreed_price = bk.agreed_price;
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
   * Respond to a Change Order (Customer approves or rejects)
   */
  async respondToChangeOrder(
    bookingId: string,
    changeOrderId: string,
    action: 'approved' | 'rejected',
    notes?: string
  ): Promise<ApiResponse<Booking>> {
    const bk = localState.bookings.find((b) => b.id === bookingId);
    if (!bk) throw new Error('Booking not found');

    const co = (bk.change_orders || []).find((c) => c.id === changeOrderId);
    if (!co) throw new Error('Change order not found');

    co.status = action;
    co.responded_at = new Date().toISOString();
    if (notes) co.customer_notes = notes;

    if (action === 'approved') {
      if (!bk.original_agreed_price) {
        bk.original_agreed_price = bk.agreed_price;
      }
      bk.agreed_price = co.revised_total;
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
   * Get or generate a Repair Passport™ for a completed booking
   */
  async getRepairPassport(bookingId: string): Promise<ApiResponse<RepairPassport | null>> {
    const bk = localState.bookings.find((b) => b.id === bookingId);
    if (!bk) throw new Error('Booking not found');

    if (bk.passport) {
      if (bk.passport.unapproved_changes_count === undefined) {
        bk.passport.unapproved_changes_count = (bk.change_orders || []).filter(
          (c) => c.status === 'pending_customer_approval'
        ).length;
      }
      if (!bk.passport.original_quote) {
        bk.passport.original_quote = bk.passport.original_agreed_price;
      }
      if (!bk.passport.final_total) {
        bk.passport.final_total = bk.passport.final_total_paid;
      }
      if (!bk.passport.approved_change_orders) {
        bk.passport.approved_change_orders = (bk.passport.approved_changes || []).map((c) => ({
          title: c.title,
          amount: c.additional_amount,
        }));
      }
      return { data: bk.passport, isLiveDatabase: false };
    }

    if (bk.status !== 'completed') {
      return { data: null, isLiveDatabase: false };
    }

    const req = localState.requests.find((r) => r.id === bk.request_id);
    const worker = localState.workers.find((w) => w.id === bk.worker_id);

    const unapprovedCount = (bk.change_orders || []).filter(
      (c) => c.status === 'pending_customer_approval'
    ).length;

    const approvedList = (bk.change_orders || []).filter((c) => c.status === 'approved');

    const originalScope: ScopeLock = req?.scope || {
      problem_description: req?.description || 'Service fault diagnosis & resolution',
      problem: req?.description || 'Service fault diagnosis & resolution',
      requested_work: [req?.title || 'Diagnostic and repair'],
      expected_deliverables: ['Completed in full working condition', 'Area cleaned'],
      deliverables: ['Completed in full working condition', 'Area cleaned'],
      urgency: req?.urgency || 'today',
      budget: req?.budget,
      assumptions: [],
      exclusions: [],
      is_locked: true,
    };

    const parts = [
      { name: 'Standard OEM Replacement Parts', brand: 'Certified OEM', warranty_months: 6 },
    ];

    const warrantyNotes =
      '30-Day Workmanship Satisfaction Guarantee valid until ' +
      new Date(Date.now() + 30 * 86400000).toLocaleDateString();

    const generatedPassport: RepairPassport = {
      passport_id: `RP-${bk.id.slice(0, 8).toUpperCase()}`,
      booking_id: bk.id,
      completed_at: bk.completed_at || new Date().toISOString(),
      original_scope: originalScope,
      original_agreed_price: bk.original_agreed_price || bk.agreed_price,
      approved_changes: approvedList,
      final_total_paid: bk.agreed_price,
      parts_recorded: parts,
      warranty_notes: warrantyNotes,
      technician_name: worker?.name || 'Technician',
      technician_trade: worker?.trade || 'plumber',
      is_demo_simulation: true,
      // Compatibility aliases
      agreed_scope: originalScope,
      original_quote: bk.original_agreed_price || bk.agreed_price,
      final_total: bk.agreed_price,
      final_agreed_total: bk.agreed_price,
      parts_installed: parts,
      warranty_coverage: warrantyNotes,
      unapproved_changes_count: unapprovedCount,
      approved_change_orders: approvedList.map((c) => ({
        title: c.title,
        amount: c.additional_amount,
      })),
    };

    bk.passport = generatedPassport;
    return { data: generatedPassport, isLiveDatabase: false };
  },
};
