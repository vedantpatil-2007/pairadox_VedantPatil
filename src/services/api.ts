import {
  supabase,
  isSupabaseConfigured,
  verifySupabaseHealth,
  authService,
  AuthUser,
  SupabaseHealthStatus,
} from '../lib/supabase';
import { demoRepo } from './demoRepository';
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

async function getActiveAuthUid(): Promise<string | null> {
  const currentUser = await authService.getCurrentUser();
  if (currentUser) return currentUser.id;
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
    organization_name: req.organization_name || (req as any).organizationName,
  };
}

export interface ApiResponse<T> {
  data: T;
  isLiveDatabase: boolean;
  isDemoSimulation?: boolean;
  error?: string;
}

export interface SubmitQuotePayload {
  request_id?: string;
  requestId?: string;
  worker_id?: string;
  workerId?: string;
  amount: number;
  estimated_duration?: string;
  estimatedDuration?: string;
  notes?: string;
  itemization?: QuoteItemization;
}

export const api = {
  /**
   * Reset local demo repository back to clean seed fixtures
   */
  resetDemoData(): void {
    demoRepo.reset();
  },

  /**
   * Check 3-tier health status
   */
  async getHealthStatus(): Promise<SupabaseHealthStatus> {
    return verifySupabaseHealth();
  },

  /**
   * Current user management
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    return authService.getCurrentUser();
  },
  async signIn(email: string, password: string) {
    return authService.signInWithEmail(email, password);
  },
  async signUp(email: string, password: string, name?: string, role: 'customer' | 'worker' = 'customer') {
    return authService.signUpWithEmail(email, password, name, role);
  },
  async signOut() {
    return authService.signOut();
  },
  setDemoUser(user: AuthUser | null) {
    authService.setDemoUser(user);
  },

  /**
   * Fetch workers, optionally filtered by trade
   */
  async getWorkers(trade?: Trade | 'all'): Promise<ApiResponse<Worker[]>> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('workers_directory').select('*').order('rating', { ascending: false });
        if (trade && trade !== 'all') {
          query = query.eq('trade', trade);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return { data: data as Worker[], isLiveDatabase: true };
        }

        // If workers_directory view does not exist yet (PGRST205), attempt fallback query to base workers table
        if (error && (error.code === 'PGRST205' || error.message.includes('workers_directory'))) {
          let baseQuery = supabase.from('workers').select('*').order('rating', { ascending: false });
          if (trade && trade !== 'all') {
            baseQuery = baseQuery.eq('trade', trade);
          }
          const { data: baseData, error: baseErr } = await baseQuery;
          if (!baseErr && baseData && baseData.length > 0) {
            return { data: baseData as Worker[], isLiveDatabase: true };
          }
        }
      } catch (err) {
        console.warn('Supabase fetch workers failed, reading from demo repository:', err);
      }
    }

    const workers = demoRepo.getWorkers(trade);
    return { data: workers, isLiveDatabase: false, isDemoSimulation: true };
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
        if (!error && data) {
          return { data: data as Worker, isLiveDatabase: true };
        }

        if (error && (error.code === 'PGRST205' || error.message.includes('workers_directory'))) {
          const { data: baseData, error: baseErr } = await supabase
            .from('workers')
            .select('*')
            .eq('id', workerId)
            .single();
          if (!baseErr && baseData) {
            return { data: baseData as Worker, isLiveDatabase: true };
          }
        }
      } catch (err) {
        console.warn('Supabase getWorkerById failed, reading from demo repository:', err);
      }
    }
    const found = demoRepo.getWorkerById(workerId);
    return { data: found, isLiveDatabase: false, isDemoSimulation: true };
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
        if (!error && data && data.length > 0) {
          return { data: data as Service[], isLiveDatabase: true };
        }
      } catch (err) {
        console.warn('Supabase fetch services failed, reading from demo repository:', err);
      }
    }

    const services = demoRepo.getServices(workerId);
    return { data: services, isLiveDatabase: false, isDemoSimulation: true };
  },

  /**
   * Create a new Service Request.
   * If running in verified live database mode: explicitly awaits write and reads back record.
   * If running in simulation mode: writes to local storage-backed demo repository (survives refresh).
   */
  async createServiceRequest(
    payload: Omit<ServiceRequest, 'id' | 'created_at' | 'updated_at' | 'status'>
  ): Promise<ApiResponse<ServiceRequest>> {
    const uid = await getActiveAuthUid();
    const health = await verifySupabaseHealth();

    // If live operations are fully verified, write to remote Supabase and verify read-back
    if (health.operationsVerified && supabase) {
      try {
        const insertPayload: Record<string, unknown> = {
          customer_name: payload.customer_name,
          customer_phone: payload.customer_phone,
          customer_address: payload.customer_address,
          customer_lat: payload.customer_lat,
          customer_lng: payload.customer_lng,
          category: payload.category,
          title: payload.title,
          description: payload.description,
          urgency: payload.urgency,
          budget: payload.budget,
          preferred_worker_id: payload.preferred_worker_id || null,
          status: 'open',
        };
        if (payload.crew_size) insertPayload.crew_size = payload.crew_size;
        if (payload.organization_name) insertPayload.organization_name = payload.organization_name;
        if (payload.duration_value) insertPayload.duration_value = payload.duration_value;
        if (payload.duration_unit) insertPayload.duration_unit = payload.duration_unit;
        if (payload.scope) insertPayload.scope = payload.scope;
        if (uid) insertPayload.customer_id = uid;

        let { data, error } = await supabase
          .from('service_requests')
          .insert(insertPayload)
          .select()
          .single();

        // If insert failed because extended columns are missing on remote table (PGRST204 or 42703), retry with core columns
        if (error && (error.code === 'PGRST204' || error.code === '42703')) {
          const corePayload: Record<string, unknown> = {
            customer_name: payload.customer_name,
            customer_phone: payload.customer_phone,
            customer_address: payload.customer_address,
            customer_lat: payload.customer_lat,
            customer_lng: payload.customer_lng,
            category: payload.category,
            title: payload.title,
            description: payload.description,
            urgency: payload.urgency,
            budget: payload.budget,
            preferred_worker_id: payload.preferred_worker_id || null,
            status: 'open',
          };
          if (uid) corePayload.customer_id = uid;
          const retryRes = await supabase.from('service_requests').insert(corePayload).select().single();
          data = retryRes.data;
          error = retryRes.error;
        }

        if (error) throw error;

        // Read-back verification before reporting success
        const { data: readBack, error: readBackErr } = await supabase
          .from('service_requests')
          .select('*')
          .eq('id', (data as ServiceRequest).id)
          .single();

        if (readBackErr || !readBack) {
          throw new Error('Write verification failed: Created record could not be read back from database.');
        }

        return { data: readBack as ServiceRequest, isLiveDatabase: true };
      } catch (err: unknown) {
        console.error('Supabase live createServiceRequest error, safely preserving in local storage:', err);
        // Fall through to save in local demo repository so user data is NEVER lost!
      }
    }

    const customerName = payload.customer_name || (payload as any).customerName || 'Verified Customer';
    const customerPhone = payload.customer_phone || (payload as any).customerPhone || null;
    const customerAddress = payload.customer_address || (payload as any).customerAddress || 'Indiranagar, Bengaluru';
    const customerLat = payload.customer_lat ?? (payload as any).customerLat ?? 12.9784;
    const customerLng = payload.customer_lng ?? (payload as any).customerLng ?? 77.6408;
    const crewSize = payload.crew_size ?? (payload as any).crewSize ?? 1;
    const organizationName = payload.organization_name || (payload as any).organizationName || undefined;
    const durationValue = payload.duration_value ?? (payload as any).durationValue ?? undefined;
    const durationUnit = payload.duration_unit || (payload as any).durationUnit || undefined;

    // Simulation Mode: Save to persistent demo repository (survives page refresh)
    const newRequest: ServiceRequest = {
      ...payload,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      customer_lat: customerLat,
      customer_lng: customerLng,
      crew_size: crewSize,
      organization_name: organizationName,
      duration_value: durationValue,
      duration_unit: durationUnit,
      id: crypto.randomUUID ? crypto.randomUUID() : `sr-${Date.now()}`,
      customer_id: uid,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const saved = demoRepo.addRequest(newRequest);
    return { data: saved, isLiveDatabase: false, isDemoSimulation: true };
  },

  /**
   * Get public job leads specifically for the worker portal and open broadcast discovery.
   * Strictly queries the public.job_leads view in Supabase, guaranteeing that customer
   * phone is null, address is masked, name is anonymized, and coordinates are coarsened.
   */
  async getJobLeads(category?: Trade | 'all'): Promise<ApiResponse<ServiceRequest[]>> {
    const uid = await getActiveAuthUid();
    const health = await verifySupabaseHealth();

    if (health.operationsVerified && supabase) {
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
        console.warn('Supabase getJobLeads view query failed, using demo repository:', err);
      }
    }

    // Local fallback: read from demo repository and apply strict privacy masking
    const allRequests = demoRepo.getRequests(category);
    const eligible = allRequests.filter(
      (r) => r.status === 'open' || r.status === 'quoted' || (uid && r.customer_id === uid)
    );

    const masked = eligible.map((r) => maskLeadForPublicFeed(r, uid));
    return { data: masked, isLiveDatabase: false, isDemoSimulation: true };
  },

  /**
   * Get all service requests
   */
  async getServiceRequests(category?: Trade | 'all'): Promise<ApiResponse<ServiceRequest[]>> {
    const uid = await getActiveAuthUid();
    const health = await verifySupabaseHealth();

    if (health.operationsVerified && supabase) {
      try {
        let query = supabase.from('job_leads').select('*').order('created_at', { ascending: false });
        if (category && category !== 'all') {
          query = query.eq('category', category);
        }
        const { data: viewData, error: viewError } = await query;
        if (!viewError && viewData && viewData.length > 0) {
          return { data: viewData as ServiceRequest[], isLiveDatabase: true };
        }
      } catch (err) {
        console.warn('Supabase getServiceRequests failed, reading from demo repository:', err);
      }
    }

    const allRequests = demoRepo.getRequests(category);
    const masked = allRequests.map((r) => maskLeadForPublicFeed(r, uid));
    return { data: masked, isLiveDatabase: false, isDemoSimulation: true };
  },

  /**
   * Get quotes for a specific request or worker
   */
  async getQuotes(filter?: { requestId?: string; workerId?: string }): Promise<ApiResponse<Quote[]>> {
    const health = await verifySupabaseHealth();

    if (health.operationsVerified && supabase) {
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
        if (!error && data && data.length > 0) {
          return { data: data as Quote[], isLiveDatabase: true };
        }
      } catch (err) {
        console.warn('Supabase getQuotes failed, using demo repository:', err);
      }
    }

    const quotes = demoRepo.getQuotes(filter);
    const workers = demoRepo.getWorkers();
    const requests = demoRepo.getRequests();

    // Populate joined relations
    const enriched = quotes.map((q) => ({
      ...q,
      worker: workers.find((w) => w.id === q.worker_id),
      request: requests.find((r) => r.id === q.request_id),
    }));

    return { data: enriched, isLiveDatabase: false, isDemoSimulation: true };
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

    const health = await verifySupabaseHealth();
    if (health.operationsVerified && supabase) {
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
        console.error('Supabase live submitQuote error:', err);
        return {
          data: null as unknown as Quote,
          isLiveDatabase: true,
          error: (err as Error).message || 'Failed to submit quote to database.',
        };
      }
    }

    // Simulation mode: Save in demo repository
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

    const saved = demoRepo.addQuote(newQuote);
    const worker = demoRepo.getWorkerById(workerId);
    const request = demoRepo.getRequests().find((r) => r.id === requestId);

    return {
      data: { ...saved, worker: worker || undefined, request },
      isLiveDatabase: false,
      isDemoSimulation: true,
    };
  },

  /**
   * Alias for submitQuote
   */
  async createQuote(payload: SubmitQuotePayload): Promise<ApiResponse<Quote>> {
    return this.submitQuote(payload);
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
    const health = await verifySupabaseHealth();

    if (health.operationsVerified && supabase) {
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
        return {
          data: null as unknown as Quote,
          isLiveDatabase: true,
          error: (err as Error).message || 'Failed to submit counteroffer to database.',
        };
      }
    }

    // Simulation Mode
    const updated = demoRepo.updateQuote(quoteId, {
      counter_amount: counterAmount,
      counter_notes: counterNotes,
      status: 'countered',
      last_updated_by: by,
    });

    if (updated) {
      const worker = demoRepo.getWorkerById(updated.worker_id);
      const request = demoRepo.getRequests().find((r) => r.id === updated.request_id);
      return {
        data: { ...updated, worker: worker || undefined, request },
        isLiveDatabase: false,
        isDemoSimulation: true,
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
    crewSize?: number;
    organizationName?: string;
    supervisorName?: string;
  }): Promise<ApiResponse<Booking>> {
    const now = new Date().toISOString();
    const scheduledTime = payload.scheduledFor || new Date(Date.now() + 2 * 3600000).toISOString();
    const uid = await getActiveAuthUid();
    const health = await verifySupabaseHealth();

    const targetReq = demoRepo.getRequests().find((r) => r.id === payload.requestId);
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

    if (health.operationsVerified && supabase) {
      try {
        // 1. Mark quote as accepted
        await supabase
          .from('quotes')
          .update({ status: 'accepted', updated_at: now })
          .eq('id', payload.quoteId);

        // 2. Insert booking
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
        console.error('Supabase live confirmBooking error:', err);
        return {
          data: null as unknown as Booking,
          isLiveDatabase: true,
          error: (err as Error).message || 'Failed to persist booking in Supabase.',
        };
      }
    }

    // Simulation Mode: Save to persistent demo repository
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
      crew_size: payload.crewSize || targetReq?.crew_size || 1,
      organization_name: payload.organizationName || targetReq?.organization_name,
      supervisor_name: payload.supervisorName,
      change_orders: [],
      scheduled_for: scheduledTime,
      status: 'confirmed',
      created_at: now,
      completed_at: null,
    };

    const saved = demoRepo.addBooking(newBooking);
    const worker = demoRepo.getWorkerById(payload.workerId);
    const request = demoRepo.getRequests().find((r) => r.id === payload.requestId);

    return {
      data: { ...saved, worker: worker || undefined, request },
      isLiveDatabase: false,
      isDemoSimulation: true,
    };
  },

  /**
   * Get bookings
   */
  async getBookings(filter?: { workerId?: string; customerPhone?: string }): Promise<ApiResponse<Booking[]>> {
    const health = await verifySupabaseHealth();

    if (health.operationsVerified && supabase) {
      try {
        let query = supabase
          .from('bookings')
          .select('*, worker:workers(*), request:service_requests(*)')
          .order('created_at', { ascending: false });

        if (filter?.workerId) {
          query = query.eq('worker_id', filter.workerId);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return { data: data as Booking[], isLiveDatabase: true };
        }
      } catch (err) {
        console.warn('Supabase getBookings failed, reading from demo repository:', err);
      }
    }

    const list = demoRepo.getBookings(filter?.workerId);
    const workers = demoRepo.getWorkers();
    const requests = demoRepo.getRequests();

    const enriched = list.map((b) => ({
      ...b,
      worker: workers.find((w) => w.id === b.worker_id),
      request: requests.find((r) => r.id === b.request_id),
    }));

    return { data: enriched, isLiveDatabase: false, isDemoSimulation: true };
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
    const health = await verifySupabaseHealth();

    if (health.operationsVerified && supabase) {
      try {
        // completed_at is strictly managed by trusted database logic to prevent client forgery
        const updateData: Record<string, unknown> = { status };
        if (completionNotes) updateData.completion_notes = completionNotes;

        const { data, error } = await supabase
          .from('bookings')
          .update(updateData)
          .eq('id', bookingId)
          .select('*, worker:workers(*), request:service_requests(*)')
          .single();

        if (error) throw error;

        if (status === 'completed' && data?.request_id) {
          await supabase
            .from('service_requests')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', data.request_id);
        }

        return { data: data as Booking, isLiveDatabase: true };
      } catch (err) {
        return {
          data: null as unknown as Booking,
          isLiveDatabase: true,
          error: (err as Error).message || 'Failed to update booking status in Supabase.',
        };
      }
    }

    // Simulation mode
    const updated = demoRepo.updateBooking(bookingId, {
      status,
      completed_at: completedAt,
      completion_notes: completionNotes,
    });

    if (!updated) throw new Error('Booking not found');

    const worker = demoRepo.getWorkerById(updated.worker_id);
    const request = demoRepo.getRequests().find((r) => r.id === updated.request_id);

    return {
      data: { ...updated, worker: worker || undefined, request },
      isLiveDatabase: false,
      isDemoSimulation: true,
    };
  },

  /**
   * Submit customer review.
   * Separates historical seed ratings from real/simulated customer reviews.
   * Calculates displayed rating and review count mathematically:
   * (baseRating * baseCount + sum(newReviews)) / (baseCount + newCount)
   */
  async submitReview(payload: {
    bookingId: string;
    workerId: string;
    customerName: string;
    rating: number;
    comment: string;
  }): Promise<ApiResponse<Review>> {
    const uid = await getActiveAuthUid();
    const health = await verifySupabaseHealth();

    if (health.operationsVerified && supabase) {
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
        return {
          data: null as unknown as Review,
          isLiveDatabase: true,
          error: (err as Error).message || 'Failed to submit review to Supabase.',
        };
      }
    }

    // Simulation Mode: Save to demo repository with baseline preservation
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

    const { review } = demoRepo.addReview(newReview);
    return { data: review, isLiveDatabase: false, isDemoSimulation: true };
  },

  /**
   * Get reviews for a worker
   */
  async getReviews(workerId?: string): Promise<ApiResponse<Review[]>> {
    const health = await verifySupabaseHealth();

    if (health.operationsVerified && supabase) {
      try {
        let query = supabase.from('public_reviews').select('*').order('created_at', { ascending: false });
        if (workerId) {
          query = query.eq('worker_id', workerId);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return { data: data as Review[], isLiveDatabase: true };
        }

        // If public_reviews view does not exist yet (PGRST205), attempt fallback query to base reviews table
        if (error && (error.code === 'PGRST205' || error.message.includes('public_reviews'))) {
          let baseQuery = supabase.from('reviews').select('*').order('created_at', { ascending: false });
          if (workerId) {
            baseQuery = baseQuery.eq('worker_id', workerId);
          }
          const { data: baseData, error: baseErr } = await baseQuery;
          if (!baseErr && baseData && baseData.length > 0) {
            return { data: baseData as Review[], isLiveDatabase: true };
          }
        }
      } catch (err) {
        console.warn('Supabase getReviews failed, using demo repository:', err);
      }
    }

    const reviews = demoRepo.getReviews(workerId);
    return { data: reviews, isLiveDatabase: false, isDemoSimulation: true };
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
      crew_adjustment?: {
        added_workers: number;
        added_duration?: number;
        reason: string;
      };
    }
  ): Promise<ApiResponse<Booking>> {
    const additional = Number(
      payload.additionalAmount ?? payload.additional_amount ?? 0
    );
    const addedWorkers = payload.crew_adjustment?.added_workers ?? 0;
    const health = await verifySupabaseHealth();

    if (health.operationsVerified && supabase) {
      try {
        const { error: rpcErr } = await supabase.rpc('fn_propose_change_order', {
          p_booking_id: bookingId,
          p_title: payload.title,
          p_reason: payload.reason,
          p_additional_amount: additional,
          p_added_workers: addedWorkers,
        });

        if (rpcErr) throw rpcErr;

        const { data: bookingData, error: fetchErr } = await supabase
          .from('bookings')
          .select('*, worker:workers(*), request:service_requests(*)')
          .eq('id', bookingId)
          .single();

        if (fetchErr) throw fetchErr;
        return { data: bookingData as Booking, isLiveDatabase: true };
      } catch (err) {
        console.warn('Live DB propose change order failed, falling back to local simulation:', err);
      }
    }

    const bk = demoRepo.getBookings().find((b) => b.id === bookingId);
    if (!bk) throw new Error('Booking not found');

    const newChangeOrder: ChangeOrder = {
      id: crypto.randomUUID ? crypto.randomUUID() : `co-${Date.now()}`,
      booking_id: bookingId,
      title: payload.title,
      reason: payload.reason,
      original_price: bk.agreed_price,
      additional_amount: additional,
      revised_total: bk.agreed_price + additional,
      status: 'pending_customer_approval',
      crew_adjustment: payload.crew_adjustment,
      created_at: new Date().toISOString(),
    };

    const updated = demoRepo.addChangeOrder(bookingId, newChangeOrder);
    if (!updated) throw new Error('Failed to record change order');

    const worker = demoRepo.getWorkerById(updated.worker_id);
    const request = demoRepo.getRequests().find((r) => r.id === updated.request_id);

    return {
      data: {
        ...updated,
        worker: worker || undefined,
        request,
      },
      isLiveDatabase: false,
      isDemoSimulation: true,
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
    const health = await verifySupabaseHealth();
    if (health.operationsVerified && supabase) {
      try {
        const { error: rpcErr } = await supabase.rpc('fn_apply_approved_change_order', {
          p_booking_id: bookingId,
          p_change_order_id: changeOrderId,
          p_approved: action === 'approved',
          p_customer_notes: notes || null,
        });

        if (rpcErr) throw rpcErr;

        const { data: bookingData, error: fetchErr } = await supabase
          .from('bookings')
          .select('*, worker:workers(*), request:service_requests(*)')
          .eq('id', bookingId)
          .single();

        if (fetchErr) throw fetchErr;
        return { data: bookingData as Booking, isLiveDatabase: true };
      } catch (err) {
        console.warn('Live DB change order failed, falling back to local simulation:', err);
      }
    }

    const updated = demoRepo.respondChangeOrder(bookingId, changeOrderId, action, notes);
    if (!updated) throw new Error('Change order or booking not found');

    const worker = demoRepo.getWorkerById(updated.worker_id);
    const request = demoRepo.getRequests().find((r) => r.id === updated.request_id);

    return {
      data: {
        ...updated,
        worker: worker || undefined,
        request,
      },
      isLiveDatabase: false,
      isDemoSimulation: true,
    };
  },

  /**
   * Get or generate a Repair Passport™ for a completed booking
   */
  async getRepairPassport(bookingId: string): Promise<ApiResponse<RepairPassport | null>> {
    const bk = demoRepo.getBookings().find((b) => b.id === bookingId);
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
      return { data: bk.passport, isLiveDatabase: false, isDemoSimulation: true };
    }

    if (bk.status !== 'completed') {
      return { data: null, isLiveDatabase: false, isDemoSimulation: true };
    }

    const req = demoRepo.getRequests().find((r) => r.id === bk.request_id);
    const worker = demoRepo.getWorkerById(bk.worker_id);

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
    return { data: generatedPassport, isLiveDatabase: false, isDemoSimulation: true };
  },
};
