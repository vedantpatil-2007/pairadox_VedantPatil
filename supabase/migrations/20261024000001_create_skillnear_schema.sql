-- ============================================================================
-- SkillNear (PS03): Hyperlocal On-Demand Blue-Collar Services Platform Schema
-- ============================================================================
-- Target Database: Supabase PostgreSQL
-- RLS: Enabled on all tables with explicit access policies for milestone 1 demo.
-- Note: Milestone 1 deliberately avoids complex auth tokens for frictionless testing.
-- In production, policies should enforce `auth.uid() = user_id`.
-- ============================================================================

-- Ensure uuid-ossp or pgcrypto is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. WORKERS TABLE (Fictional Demo Profiles)
CREATE TABLE IF NOT EXISTS public.workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    trade TEXT NOT NULL CHECK (trade IN ('electrician', 'plumber', 'cleaner', 'painter')),
    avatar_url TEXT,
    phone TEXT,
    email TEXT,
    experience_years INTEGER NOT NULL DEFAULT 1 CHECK (experience_years >= 0),
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 350.00 CHECK (hourly_rate > 0),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Bengaluru',
    rating NUMERIC(3, 2) NOT NULL DEFAULT 4.8 CHECK (rating >= 1.0 AND rating <= 5.0),
    review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
    bio TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT true,
    is_available BOOLEAN NOT NULL DEFAULT true,
    badge_label TEXT DEFAULT 'Demo Profile (Fictional Simulation)',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. SERVICES TABLE (Specific offerings provided by workers)
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('electrician', 'plumber', 'cleaner', 'painter')),
    name TEXT NOT NULL,
    description TEXT,
    base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
    estimated_time TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. SERVICE REQUESTS TABLE (Customer on-demand job broadcasts)
CREATE TABLE IF NOT EXISTS public.service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    customer_lat DOUBLE PRECISION NOT NULL,
    customer_lng DOUBLE PRECISION NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('electrician', 'plumber', 'cleaner', 'painter')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'today' CHECK (urgency IN ('immediate', 'today', 'flexible')),
    budget NUMERIC(10, 2),
    preferred_worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'quoted', 'booked', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. QUOTES TABLE (Worker bids, customer counteroffers & negotiations)
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    estimated_duration TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'countered', 'accepted', 'rejected')),
    counter_amount NUMERIC(10, 2) CHECK (counter_amount IS NULL OR counter_amount > 0),
    counter_notes TEXT,
    last_updated_by TEXT NOT NULL DEFAULT 'worker' CHECK (last_updated_by IN ('worker', 'customer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. BOOKINGS TABLE (Agreed upon confirmed services)
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    service_address TEXT NOT NULL,
    agreed_price NUMERIC(10, 2) NOT NULL CHECK (agreed_price > 0),
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'in_progress', 'completed', 'cancelled')),
    completion_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- 6. REVIEWS TABLE (Customer feedback & ratings on completed bookings)
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES for fast hyperlocal queries & filtering
CREATE INDEX IF NOT EXISTS idx_workers_trade ON public.workers(trade);
CREATE INDEX IF NOT EXISTS idx_workers_coords ON public.workers(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_services_worker ON public.services(worker_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON public.service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_category ON public.service_requests(category);
CREATE INDEX IF NOT EXISTS idx_quotes_request ON public.quotes(request_id);
CREATE INDEX IF NOT EXISTS idx_quotes_worker ON public.quotes(worker_id);
CREATE INDEX IF NOT EXISTS idx_bookings_request ON public.bookings(request_id);
CREATE INDEX IF NOT EXISTS idx_bookings_worker ON public.bookings(worker_id);
CREATE INDEX IF NOT EXISTS idx_reviews_worker ON public.reviews(worker_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- All tables have RLS enabled.
-- In this milestone hackathon demo, operations are permitted for the anon role
-- using VITE_SUPABASE_PUBLISHABLE_KEY.
-- Production security note: In a production environment with authenticated users,
-- policies would enforce `auth.uid() = user_id`.
-- ============================================================================

ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Workers & Services: Public read for browsing
CREATE POLICY "Allow public read on workers" ON public.workers
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert on workers" ON public.workers
    FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update on workers" ON public.workers
    FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Allow public read on services" ON public.services
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert on services" ON public.services
    FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Service Requests: Public read and write for customer postings
CREATE POLICY "Allow public read on service_requests" ON public.service_requests
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert on service_requests" ON public.service_requests
    FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update on service_requests" ON public.service_requests
    FOR UPDATE TO anon, authenticated USING (true);

-- Quotes: Public read, insert, update for negotiations
CREATE POLICY "Allow public read on quotes" ON public.quotes
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert on quotes" ON public.quotes
    FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update on quotes" ON public.quotes
    FOR UPDATE TO anon, authenticated USING (true);

-- Bookings: Public read, insert, update for service status progression
CREATE POLICY "Allow public read on bookings" ON public.bookings
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert on bookings" ON public.bookings
    FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public update on bookings" ON public.bookings
    FOR UPDATE TO anon, authenticated USING (true);

-- Reviews: Public read and insert for ratings
CREATE POLICY "Allow public read on reviews" ON public.reviews
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert on reviews" ON public.reviews
    FOR INSERT TO anon, authenticated WITH CHECK (true);
