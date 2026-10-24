import React, { useEffect, useRef, useState } from 'react';
import { Database, Copy, Check, X, ShieldAlert, FileCode2, Terminal, RefreshCw, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { getSupabaseConfigStatus, SupabaseConnectionResult } from '../lib/supabase';

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbStatus?: SupabaseConnectionResult;
  onRefreshConnection?: () => Promise<void>;
  onResetDemo?: () => void;
}

const MIGRATION_SQL_SNIPPET = `-- SkillNear (PS03): Supabase PostgreSQL Least-Privilege Schema & Data API Grants
-- Run this in Supabase Dashboard -> SQL Editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. BASE TABLES
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

CREATE TABLE IF NOT EXISTS public.service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID DEFAULT auth.uid(),
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

ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();

CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    creator_id UUID DEFAULT auth.uid(),
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

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS creator_id UUID DEFAULT auth.uid();

CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    customer_id UUID DEFAULT auth.uid(),
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

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    customer_id UUID DEFAULT auth.uid(),
    customer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();

-- 2. PRIVACY-PRESERVING JOB LEADS VIEW (Masks Phone & Address for Public Leads Feed)
CREATE OR REPLACE VIEW public.job_leads WITH (security_invoker = false) AS
SELECT
    sr.id,
    sr.category,
    sr.title,
    sr.description,
    sr.urgency,
    sr.budget,
    sr.preferred_worker_id,
    sr.status,
    sr.customer_lat,
    sr.customer_lng,
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_name
        WHEN sr.customer_id IS NULL THEN sr.customer_name
        ELSE split_part(sr.customer_name, ' ', 1) || ' ' || COALESCE(NULLIF(left(split_part(sr.customer_name, ' ', 2), 1), '') || '.', '')
    END AS customer_name,
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_phone
        ELSE NULL
    END AS customer_phone,
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_address
        WHEN sr.customer_id IS NULL THEN sr.customer_address
        ELSE 'Hyperlocal Vicinity (Exact address provided upon confirmed booking)'
    END AS customer_address,
    sr.created_at,
    sr.updated_at
FROM public.service_requests sr;

-- 3. ROW LEVEL SECURITY (RLS) POLICIES — LEAST PRIVILEGE
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Workers & Services: Public read-only
DROP POLICY IF EXISTS "workers_select_policy" ON public.workers;
CREATE POLICY "workers_select_policy" ON public.workers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "services_select_policy" ON public.services;
CREATE POLICY "services_select_policy" ON public.services FOR SELECT TO anon, authenticated USING (true);

-- Create private schema for internal security functions (not exposed via Data API)
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;

-- Helper Function: Check if caller is customer or technician of confirmed booking
CREATE OR REPLACE FUNCTION app_private.fn_is_booking_technician_or_participant(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
    v_caller_uid UUID;
BEGIN
    v_caller_uid := (SELECT auth.uid());
    IF v_caller_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.bookings b
        JOIN public.quotes q ON q.id = b.quote_id
        WHERE b.request_id = p_request_id
          AND (
              b.customer_id = v_caller_uid
              OR q.creator_id = v_caller_uid
          )
    );
END;
$$;

REVOKE ALL ON FUNCTION app_private.fn_is_booking_technician_or_participant(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.fn_is_booking_technician_or_participant(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION app_private.fn_is_booking_technician_or_participant(UUID) TO authenticated;

-- Service Requests: Ownership & confirmed technician access
DROP POLICY IF EXISTS "service_requests_select_policy" ON public.service_requests;
CREATE POLICY "service_requests_select_policy" ON public.service_requests FOR SELECT TO authenticated
    USING (((SELECT auth.uid()) IS NOT NULL AND customer_id = (SELECT auth.uid())) OR app_private.fn_is_booking_technician_or_participant(id));

DROP POLICY IF EXISTS "service_requests_insert_policy" ON public.service_requests;
CREATE POLICY "service_requests_insert_policy" ON public.service_requests FOR INSERT TO anon, authenticated
    WITH CHECK (customer_id IS NULL OR (auth.uid() IS NOT NULL AND customer_id = auth.uid()));

DROP POLICY IF EXISTS "service_requests_update_policy" ON public.service_requests;
CREATE POLICY "service_requests_update_policy" ON public.service_requests FOR UPDATE TO authenticated
    USING (((SELECT auth.uid()) IS NOT NULL AND customer_id = (SELECT auth.uid())) OR app_private.fn_is_booking_technician_or_participant(id))
    WITH CHECK (status IN ('open', 'quoted', 'booked', 'completed', 'cancelled'));

-- Quotes: Restricted to creator or request owner
DROP POLICY IF EXISTS "quotes_select_policy" ON public.quotes;
CREATE POLICY "quotes_select_policy" ON public.quotes FOR SELECT TO anon, authenticated
    USING (creator_id = auth.uid() OR creator_id IS NULL OR EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = quotes.request_id AND (sr.customer_id = auth.uid() OR sr.customer_id IS NULL)));

DROP POLICY IF EXISTS "quotes_insert_policy" ON public.quotes;
CREATE POLICY "quotes_insert_policy" ON public.quotes FOR INSERT TO anon, authenticated
    WITH CHECK (amount > 0 AND (creator_id IS NULL OR (auth.uid() IS NOT NULL AND creator_id = auth.uid())));

DROP POLICY IF EXISTS "quotes_update_policy" ON public.quotes;
CREATE POLICY "quotes_update_policy" ON public.quotes FOR UPDATE TO anon, authenticated
    USING (creator_id = auth.uid() OR creator_id IS NULL OR EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = quotes.request_id AND (sr.customer_id = auth.uid() OR sr.customer_id IS NULL)))
    WITH CHECK (status IN ('pending', 'countered', 'accepted', 'rejected'));

-- Bookings: Restricted to confirmed customer & assigned technician
DROP POLICY IF EXISTS "bookings_select_policy" ON public.bookings;
CREATE POLICY "bookings_select_policy" ON public.bookings FOR SELECT TO authenticated
    USING (((SELECT auth.uid()) IS NOT NULL AND customer_id = (SELECT auth.uid())) OR app_private.fn_is_booking_technician_or_participant(request_id));

DROP POLICY IF EXISTS "bookings_insert_policy" ON public.bookings;
CREATE POLICY "bookings_insert_policy" ON public.bookings FOR INSERT TO authenticated
    WITH CHECK (agreed_price > 0 AND (SELECT auth.uid()) IS NOT NULL AND customer_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "bookings_update_policy" ON public.bookings;
CREATE POLICY "bookings_update_policy" ON public.bookings FOR UPDATE TO authenticated
    USING (((SELECT auth.uid()) IS NOT NULL AND customer_id = (SELECT auth.uid())) OR app_private.fn_is_booking_technician_or_participant(request_id))
    WITH CHECK (status IN ('confirmed', 'in_progress', 'completed', 'cancelled'));

-- Reviews: Public read, booking-tied write
DROP POLICY IF EXISTS "reviews_select_policy" ON public.reviews;
CREATE POLICY "reviews_select_policy" ON public.reviews FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "reviews_insert_policy" ON public.reviews;
CREATE POLICY "reviews_insert_policy" ON public.reviews FOR INSERT TO anon, authenticated
    WITH CHECK (rating >= 1 AND rating <= 5 AND (customer_id IS NULL OR (auth.uid() IS NOT NULL AND customer_id = auth.uid())));

-- 4. EXPLICIT POSTGREST DATA API GRANTS (Fixes PGRST205 when auto-exposure is disabled)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.workers TO anon, authenticated;
GRANT SELECT ON TABLE public.services TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.service_requests TO anon, authenticated;
GRANT SELECT ON TABLE public.job_leads TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.quotes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.bookings TO anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.reviews TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';`;

const CORRECTIVE_MIGRATION_SQL = `-- SkillNear (PS03): Corrective Migration 2 — Comprehensive Least-Privilege
-- Hardening, Column Backfills, Safe Directory & Review Views, Role-Specific
-- Quote & Price Integrity, Private Schema Isolation & RLS Security
-- File: supabase/migrations/20261024000002_secure_job_leads_view.sql
-- Run this in Supabase Dashboard -> SQL Editor on your existing database!

-- 1. Idempotent column additions & foreign key constraints to auth.users
DO $$
BEGIN
    ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();
    ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS creator_id UUID DEFAULT auth.uid();
    ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_requests_customer_id_fkey') THEN
        ALTER TABLE public.service_requests
            ADD CONSTRAINT service_requests_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_customer_id_fkey') THEN
        ALTER TABLE public.bookings
            ADD CONSTRAINT bookings_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_creator_id_fkey') THEN
        ALTER TABLE public.quotes
            ADD CONSTRAINT quotes_creator_id_fkey
            FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_customer_id_fkey') THEN
        ALTER TABLE public.reviews
            ADD CONSTRAINT reviews_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Dedicated private schema (unexposed to PostgREST Data API)
CREATE SCHEMA IF NOT EXISTS app_private;
DROP FUNCTION IF EXISTS public.fn_is_booking_technician_or_participant(UUID);
DROP FUNCTION IF EXISTS public.fn_sync_booking_customer_details();
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;

-- 3. Purge all legacy permissive policies from Migration 1
DROP POLICY IF EXISTS "Allow public read on workers" ON public.workers;
DROP POLICY IF EXISTS "Allow public insert on workers" ON public.workers;
DROP POLICY IF EXISTS "Allow public update on workers" ON public.workers;
DROP POLICY IF EXISTS "Allow public all workers" ON public.workers;
DROP POLICY IF EXISTS "workers_select_policy" ON public.workers;

DROP POLICY IF EXISTS "Allow public read on services" ON public.services;
DROP POLICY IF EXISTS "Allow public insert on services" ON public.services;
DROP POLICY IF EXISTS "Allow public all services" ON public.services;
DROP POLICY IF EXISTS "services_select_policy" ON public.services;

DROP POLICY IF EXISTS "Allow public read on service_requests" ON public.service_requests;
DROP POLICY IF EXISTS "Allow public insert on service_requests" ON public.service_requests;
DROP POLICY IF EXISTS "Allow public update on service_requests" ON public.service_requests;
DROP POLICY IF EXISTS "Allow public all requests" ON public.service_requests;
DROP POLICY IF EXISTS "service_requests_select_policy" ON public.service_requests;
DROP POLICY IF EXISTS "service_requests_insert_policy" ON public.service_requests;
DROP POLICY IF EXISTS "service_requests_update_policy" ON public.service_requests;

DROP POLICY IF EXISTS "Allow public read on quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow public insert on quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow public update on quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow public all quotes" ON public.quotes;
DROP POLICY IF EXISTS "quotes_select_policy" ON public.quotes;
DROP POLICY IF EXISTS "quotes_insert_policy" ON public.quotes;
DROP POLICY IF EXISTS "quotes_update_policy" ON public.quotes;

DROP POLICY IF EXISTS "Allow public read on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow public insert on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow public update on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow public all bookings" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_policy" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_policy" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_policy" ON public.bookings;

DROP POLICY IF EXISTS "Allow public read on reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow public insert on reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow public all reviews" ON public.reviews;
DROP POLICY IF EXISTS "reviews_select_policy" ON public.reviews;
DROP POLICY IF EXISTS "reviews_insert_policy" ON public.reviews;

-- 4. Privacy-preserving safe public views
CREATE OR REPLACE VIEW public.job_leads
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
    sr.id,
    sr.category,
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.title
        ELSE regexp_replace(
            regexp_replace(sr.title, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contact redacted]', 'g'),
            '(\+?[0-9]{1,3}[-.\s]*)?(\b[6-9]\d{9}\b|\b\d{5}[-.\s]\d{5}\b|\b\d{3,4}[-.\s]\d{3,4}[-.\s]\d{3,4}\b)',
            '[contact redacted]',
            'g'
        )
    END AS title,
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.description
        ELSE regexp_replace(
            regexp_replace(sr.description, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contact redacted]', 'g'),
            '(\+?[0-9]{1,3}[-.\s]*)?(\b[6-9]\d{9}\b|\b\d{5}[-.\s]\d{5}\b|\b\d{3,4}[-.\s]\d{3,4}[-.\s]\d{3,4}\b)',
            '[contact redacted]',
            'g'
        )
    END AS description,
    sr.urgency,
    sr.budget,
    sr.preferred_worker_id,
    sr.status,
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_lat
        ELSE round(sr.customer_lat::numeric, 2)::double precision
    END AS customer_lat,
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_lng
        ELSE round(sr.customer_lng::numeric, 2)::double precision
    END AS customer_lng,
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_name
        ELSE 
            split_part(sr.customer_name, ' ', 1) || 
            CASE 
                WHEN split_part(sr.customer_name, ' ', 2) <> '' 
                THEN ' ' || left(split_part(sr.customer_name, ' ', 2), 1) || '.'
                ELSE ''
            END
    END AS customer_name,
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_phone
        ELSE NULL
    END AS customer_phone,
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_address
        ELSE 'Hyperlocal Vicinity (Exact address provided upon confirmed booking)'
    END AS customer_address,
    sr.created_at,
    sr.updated_at
FROM public.service_requests sr
WHERE sr.status IN ('open', 'quoted')
   OR (auth.uid() IS NOT NULL AND sr.customer_id = auth.uid());

CREATE OR REPLACE VIEW public.workers_directory
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
    w.id,
    w.name,
    w.trade,
    w.avatar_url,
    NULL::text AS phone,
    NULL::text AS email,
    w.experience_years,
    w.hourly_rate,
    w.latitude,
    w.longitude,
    w.city AS address,
    w.city,
    w.rating,
    w.review_count,
    w.bio,
    w.is_demo,
    w.is_available,
    w.badge_label,
    w.created_at
FROM public.workers w;

CREATE OR REPLACE VIEW public.public_reviews
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
    r.id,
    r.booking_id,
    r.worker_id,
    CASE
        WHEN auth.uid() IS NOT NULL AND r.customer_id = auth.uid() THEN r.customer_id
        ELSE NULL::uuid
    END AS customer_id,
    CASE
        WHEN auth.uid() IS NOT NULL AND r.customer_id = auth.uid() THEN r.customer_name
        ELSE 
            split_part(r.customer_name, ' ', 1) || 
            CASE 
                WHEN split_part(r.customer_name, ' ', 2) <> '' 
                THEN ' ' || left(split_part(r.customer_name, ' ', 2), 1) || '.'
                ELSE ''
            END
    END AS customer_name,
    r.rating,
    r.comment,
    r.created_at
FROM public.reviews r;

-- 5. Helper & Validation Functions in app_private
CREATE OR REPLACE FUNCTION app_private.fn_is_booking_technician_or_participant(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
    v_caller_uid UUID;
BEGIN
    v_caller_uid := (SELECT auth.uid());
    IF v_caller_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.bookings b
        JOIN public.quotes q ON q.id = b.quote_id
        WHERE b.request_id = p_request_id
          AND (
              b.customer_id = v_caller_uid
              OR q.creator_id = v_caller_uid
          )
    );
END;
$$;

REVOKE ALL ON FUNCTION app_private.fn_is_booking_technician_or_participant(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.fn_is_booking_technician_or_participant(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION app_private.fn_is_booking_technician_or_participant(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.fn_protect_service_request_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.id <> OLD.id THEN
        RAISE EXCEPTION 'Cannot modify service request ID';
    END IF;
    IF NEW.customer_id <> OLD.customer_id THEN
        RAISE EXCEPTION 'Cannot change service request customer ownership';
    END IF;
    IF NEW.customer_lat <> OLD.customer_lat OR NEW.customer_lng <> OLD.customer_lng THEN
        RAISE EXCEPTION 'Cannot change service request location coordinates';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.fn_protect_service_request_ownership() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.fn_protect_service_request_ownership() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_service_request_ownership ON public.service_requests;
CREATE TRIGGER trg_protect_service_request_ownership
    BEFORE UPDATE ON public.service_requests
    FOR EACH ROW
    EXECUTE FUNCTION app_private.fn_protect_service_request_ownership();

CREATE OR REPLACE FUNCTION app_private.fn_validate_quote_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_uid UUID;
    v_req_customer_id UUID;
BEGIN
    v_caller_uid := (SELECT auth.uid());
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to update quotes';
    END IF;

    IF NEW.id <> OLD.id THEN
        RAISE EXCEPTION 'Cannot modify quote ID';
    END IF;
    IF NEW.request_id <> OLD.request_id THEN
        RAISE EXCEPTION 'Cannot modify quote request_id';
    END IF;
    IF NEW.worker_id <> OLD.worker_id THEN
        RAISE EXCEPTION 'Cannot modify quote worker_id';
    END IF;
    IF NEW.creator_id IS DISTINCT FROM OLD.creator_id THEN
        RAISE EXCEPTION 'Cannot modify quote creator_id';
    END IF;

    SELECT customer_id INTO v_req_customer_id
    FROM public.service_requests
    WHERE id = OLD.request_id;

    IF v_req_customer_id IS NOT NULL AND v_caller_uid = v_req_customer_id THEN
        IF NEW.amount <> OLD.amount THEN
            RAISE EXCEPTION 'Customer cannot modify worker original quote amount';
        END IF;
        IF NEW.notes IS DISTINCT FROM OLD.notes THEN
            RAISE EXCEPTION 'Customer cannot modify worker quote notes';
        END IF;
        IF NEW.estimated_duration <> OLD.estimated_duration THEN
            RAISE EXCEPTION 'Customer cannot modify worker estimated duration';
        END IF;

        NEW.last_updated_by := 'customer';

        IF NEW.status NOT IN ('countered', 'accepted', 'rejected', 'pending') THEN
            RAISE EXCEPTION 'Invalid quote status for customer action: %', NEW.status;
        END IF;

        IF NEW.status = 'countered' THEN
            IF NEW.counter_amount IS NULL OR NEW.counter_amount <= 0 THEN
                RAISE EXCEPTION 'Counteroffer requires a valid counter_amount greater than zero';
            END IF;
        END IF;

        IF NEW.status = 'accepted' THEN
            IF NEW.counter_amount IS DISTINCT FROM OLD.counter_amount THEN
                RAISE EXCEPTION 'Cannot modify counter_amount during quote acceptance';
            END IF;
        END IF;

    ELSIF OLD.creator_id IS NOT NULL AND v_caller_uid = OLD.creator_id THEN
        IF NEW.status = 'accepted' THEN
            RAISE EXCEPTION 'Only the customer can accept a quote';
        END IF;

        NEW.last_updated_by := 'worker';

        IF NEW.status = 'countered' THEN
            IF NEW.counter_amount IS NULL OR NEW.counter_amount <= 0 THEN
                RAISE EXCEPTION 'Worker counteroffer requires a valid counter_amount greater than zero';
            END IF;
        END IF;
    ELSE
        RAISE EXCEPTION 'Unauthorized: Caller is neither the request customer nor the quote technician';
    END IF;

    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.fn_validate_quote_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.fn_validate_quote_update() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_quote_update ON public.quotes;
CREATE TRIGGER trg_validate_quote_update
    BEFORE UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION app_private.fn_validate_quote_update();

CREATE OR REPLACE FUNCTION app_private.fn_validate_and_sync_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_req RECORD;
    v_quote RECORD;
    v_caller_uid UUID;
    v_effective_agreed_price NUMERIC(10, 2);
BEGIN
    v_caller_uid := (SELECT auth.uid());
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create a booking';
    END IF;

    IF NEW.customer_id IS NULL OR NEW.customer_id <> v_caller_uid THEN
        RAISE EXCEPTION 'Booking customer_id must match authenticated caller';
    END IF;

    SELECT customer_name, customer_phone, customer_address, customer_id, status
    INTO v_req
    FROM public.service_requests
    WHERE id = NEW.request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced service request does not exist';
    END IF;

    IF v_req.customer_id IS NULL OR v_req.customer_id <> v_caller_uid THEN
        RAISE EXCEPTION 'Service request does not belong to authenticated caller';
    END IF;

    SELECT id, request_id, worker_id, status, amount, counter_amount
    INTO v_quote
    FROM public.quotes
    WHERE id = NEW.quote_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced quote does not exist';
    END IF;

    IF v_quote.request_id <> NEW.request_id THEN
        RAISE EXCEPTION 'Mismatched request_id between booking and quote';
    END IF;

    IF v_quote.worker_id <> NEW.worker_id THEN
        RAISE EXCEPTION 'Mismatched worker_id between booking and quote';
    END IF;

    IF v_quote.status <> 'accepted' THEN
        RAISE EXCEPTION 'Referenced quote must be accepted before confirming booking';
    END IF;

    v_effective_agreed_price := COALESCE(v_quote.counter_amount, v_quote.amount);

    IF v_effective_agreed_price IS NULL OR v_effective_agreed_price <= 0 THEN
        RAISE EXCEPTION 'Effective agreed price from quote is invalid';
    END IF;

    IF NEW.agreed_price <> v_effective_agreed_price THEN
        RAISE EXCEPTION 'Booking agreed_price (%) must match accepted quote effective price (%)',
            NEW.agreed_price, v_effective_agreed_price;
    END IF;

    NEW.agreed_price := v_effective_agreed_price;

    NEW.customer_name := v_req.customer_name;
    NEW.customer_phone := v_req.customer_phone;
    NEW.service_address := v_req.customer_address;
    NEW.customer_id := v_req.customer_id;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.fn_validate_and_sync_booking() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.fn_validate_and_sync_booking() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_booking_customer_details ON public.bookings;
DROP TRIGGER IF EXISTS trg_validate_and_sync_booking ON public.bookings;
CREATE TRIGGER trg_validate_and_sync_booking
    BEFORE INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION app_private.fn_validate_and_sync_booking();

CREATE OR REPLACE FUNCTION app_private.fn_protect_booking_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.id <> OLD.id THEN
        RAISE EXCEPTION 'Cannot modify booking ID';
    END IF;
    IF NEW.request_id <> OLD.request_id THEN
        RAISE EXCEPTION 'Cannot modify booking request_id';
    END IF;
    IF NEW.worker_id <> OLD.worker_id THEN
        RAISE EXCEPTION 'Cannot modify booking worker_id';
    END IF;
    IF NEW.quote_id <> OLD.quote_id THEN
        RAISE EXCEPTION 'Cannot modify booking quote_id';
    END IF;
    IF NEW.customer_id <> OLD.customer_id THEN
        RAISE EXCEPTION 'Cannot modify booking customer_id';
    END IF;
    IF NEW.agreed_price <> OLD.agreed_price THEN
        RAISE EXCEPTION 'Cannot modify booking agreed_price without authorized change-order';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.fn_protect_booking_immutable_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.fn_protect_booking_immutable_fields() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_booking_immutable_fields ON public.bookings;
CREATE TRIGGER trg_protect_booking_immutable_fields
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION app_private.fn_protect_booking_immutable_fields();

CREATE OR REPLACE FUNCTION app_private.fn_validate_booking_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_uid UUID;
    v_quote_creator_id UUID;
BEGIN
    v_caller_uid := (SELECT auth.uid());
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to update booking status';
    END IF;

    IF NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;

    SELECT creator_id INTO v_quote_creator_id
    FROM public.quotes
    WHERE id = OLD.quote_id;

    IF v_caller_uid = OLD.customer_id THEN
        IF NEW.status IN ('in_progress', 'completed') THEN
            RAISE EXCEPTION 'Customers cannot mark bookings as in-progress or completed. Only the assigned technician can complete the work.';
        END IF;

        IF NEW.status = 'cancelled' THEN
            IF OLD.status <> 'confirmed' THEN
                RAISE EXCEPTION 'Cannot cancel booking that is already %', OLD.status;
            END IF;
        ELSE
            RAISE EXCEPTION 'Invalid status transition by customer: % -> %', OLD.status, NEW.status;
        END IF;

    ELSIF v_quote_creator_id IS NOT NULL AND v_caller_uid = v_quote_creator_id THEN
        IF NEW.status = 'in_progress' THEN
            IF OLD.status <> 'confirmed' THEN
                RAISE EXCEPTION 'Cannot start booking that is not confirmed';
            END IF;
        ELSIF NEW.status = 'completed' THEN
            IF OLD.status NOT IN ('confirmed', 'in_progress') THEN
                RAISE EXCEPTION 'Cannot complete booking with status %', OLD.status;
            END IF;
            IF NEW.completed_at IS NULL THEN
                NEW.completed_at := clock_timestamp();
            END IF;
        ELSIF NEW.status = 'cancelled' THEN
            IF OLD.status = 'completed' THEN
                RAISE EXCEPTION 'Cannot cancel an already completed booking';
            END IF;
        ELSE
            RAISE EXCEPTION 'Invalid status transition by technician: % -> %', OLD.status, NEW.status;
        END IF;
    ELSE
        RAISE EXCEPTION 'Unauthorized: Caller is neither the booking customer nor the assigned technician';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.fn_validate_booking_status_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.fn_validate_booking_status_transition() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_booking_status_transition ON public.bookings;
CREATE TRIGGER trg_validate_booking_status_transition
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION app_private.fn_validate_booking_status_transition();

-- 6. Least-Privilege RLS Policies
CREATE POLICY "services_select_policy" ON public.services
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "workers_select_policy" ON public.workers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_requests_select_policy" ON public.service_requests
    FOR SELECT TO authenticated
    USING (
        ((SELECT auth.uid()) IS NOT NULL AND customer_id = (SELECT auth.uid()))
        OR app_private.fn_is_booking_technician_or_participant(id)
    );

CREATE POLICY "service_requests_insert_policy" ON public.service_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) IS NOT NULL
        AND customer_id = (SELECT auth.uid())
    );

CREATE POLICY "service_requests_update_policy" ON public.service_requests
    FOR UPDATE TO authenticated
    USING (
        ((SELECT auth.uid()) IS NOT NULL AND customer_id = (SELECT auth.uid()))
        OR app_private.fn_is_booking_technician_or_participant(id)
    )
    WITH CHECK (
        ((SELECT auth.uid()) IS NOT NULL AND customer_id = (SELECT auth.uid()))
        AND status IN ('open', 'quoted', 'booked', 'completed', 'cancelled')
    );

CREATE POLICY "quotes_select_policy" ON public.quotes
    FOR SELECT TO authenticated
    USING (
        ((SELECT auth.uid()) IS NOT NULL AND creator_id = (SELECT auth.uid()))
        OR EXISTS (
            SELECT 1 FROM public.service_requests sr
            WHERE sr.id = quotes.request_id
            AND sr.customer_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "quotes_insert_policy" ON public.quotes
    FOR INSERT TO authenticated
    WITH CHECK (
        amount > 0
        AND (SELECT auth.uid()) IS NOT NULL
        AND creator_id = (SELECT auth.uid())
    );

CREATE POLICY "quotes_update_policy" ON public.quotes
    FOR UPDATE TO authenticated
    USING (
        ((SELECT auth.uid()) IS NOT NULL AND creator_id = (SELECT auth.uid()))
        OR EXISTS (
            SELECT 1 FROM public.service_requests sr
            WHERE sr.id = quotes.request_id
            AND sr.customer_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (status IN ('pending', 'countered', 'accepted', 'rejected'));

CREATE POLICY "bookings_select_policy" ON public.bookings
    FOR SELECT TO authenticated
    USING (
        ((SELECT auth.uid()) IS NOT NULL AND customer_id = (SELECT auth.uid()))
        OR app_private.fn_is_booking_technician_or_participant(request_id)
    );

CREATE POLICY "bookings_insert_policy" ON public.bookings
    FOR INSERT TO authenticated
    WITH CHECK (
        agreed_price > 0
        AND (SELECT auth.uid()) IS NOT NULL
        AND customer_id = (SELECT auth.uid())
    );

CREATE POLICY "bookings_update_policy" ON public.bookings
    FOR UPDATE TO authenticated
    USING (
        ((SELECT auth.uid()) IS NOT NULL AND customer_id = (SELECT auth.uid()))
        OR app_private.fn_is_booking_technician_or_participant(request_id)
    )
    WITH CHECK (status IN ('confirmed', 'in_progress', 'completed', 'cancelled'));

CREATE POLICY "reviews_select_policy" ON public.reviews
    FOR SELECT TO authenticated
    USING (
        (SELECT auth.uid()) IS NOT NULL
        AND customer_id = (SELECT auth.uid())
    );

CREATE POLICY "reviews_insert_policy" ON public.reviews
    FOR INSERT TO authenticated
    WITH CHECK (
        rating >= 1 AND rating <= 5
        AND (SELECT auth.uid()) IS NOT NULL
        AND customer_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = reviews.booking_id
              AND b.worker_id = reviews.worker_id
              AND b.customer_id = (SELECT auth.uid())
              AND b.status = 'completed'
        )
    );

-- 7. Data API Grants & Schema Cache Reload
GRANT USAGE ON SCHEMA public TO anon, authenticated;

REVOKE ALL ON TABLE public.workers FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.services FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.service_requests FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.quotes FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.bookings FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.reviews FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.job_leads FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.workers_directory FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.public_reviews FROM anon, PUBLIC;

REVOKE ALL ON TABLE public.workers FROM authenticated;
REVOKE ALL ON TABLE public.services FROM authenticated;
REVOKE ALL ON TABLE public.service_requests FROM authenticated;
REVOKE ALL ON TABLE public.quotes FROM authenticated;
REVOKE ALL ON TABLE public.bookings FROM authenticated;
REVOKE ALL ON TABLE public.reviews FROM authenticated;
REVOKE ALL ON TABLE public.job_leads FROM authenticated;
REVOKE ALL ON TABLE public.workers_directory FROM authenticated;
REVOKE ALL ON TABLE public.public_reviews FROM authenticated;

GRANT SELECT ON TABLE public.workers_directory TO anon, authenticated;
GRANT SELECT ON TABLE public.services TO anon, authenticated;
GRANT SELECT ON TABLE public.job_leads TO anon, authenticated;
GRANT SELECT ON TABLE public.public_reviews TO anon, authenticated;

GRANT SELECT (id, name, trade, avatar_url, experience_years, hourly_rate, latitude, longitude, city, rating, review_count, bio, is_demo, is_available, badge_label, created_at) ON TABLE public.workers TO authenticated;

GRANT SELECT, INSERT ON TABLE public.service_requests TO authenticated;
GRANT UPDATE (title, description, urgency, budget, status, preferred_worker_id, updated_at) ON TABLE public.service_requests TO authenticated;

GRANT SELECT, INSERT ON TABLE public.quotes TO authenticated;
GRANT UPDATE (counter_amount, counter_notes, notes, status, last_updated_by, updated_at) ON TABLE public.quotes TO authenticated;

GRANT SELECT, INSERT ON TABLE public.bookings TO authenticated;
GRANT UPDATE (status, scheduled_for, completion_notes, completed_at) ON TABLE public.bookings TO authenticated;

GRANT SELECT, INSERT ON TABLE public.reviews TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

NOTIFY pgrst, 'reload schema';`;

export const SetupModal: React.FC<SetupModalProps> = ({
  isOpen,
  onClose,
  dbStatus,
  onRefreshConnection,
  onResetDemo,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'corrective' | 'full'>('corrective');

  // Single shared configuration check
  const status = getSupabaseConfigStatus();
  const isConnected = dbStatus?.isConnected ?? false;
  const isOperationsVerified = Boolean(dbStatus?.operationsVerified);
  const connectionError = dbStatus?.error;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isInside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!isInside) {
        onClose();
      }
    };

    dialog.addEventListener('click', handleBackdropClick);
    return () => dialog.removeEventListener('click', handleBackdropClick);
  }, [onClose]);

  const activeSql = activeTab === 'corrective' ? CORRECTIVE_MIGRATION_SQL : MIGRATION_SQL_SNIPPET;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = async () => {
    if (!onRefreshConnection) return;
    setIsTesting(true);
    try {
      await onRefreshConnection();
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="setupModalTitle"
      className="p-0 rounded-2xl bg-white shadow-2xl border border-slate-200 max-w-2xl w-full backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs open:animate-in open:fade-in open:zoom-in-95 duration-200"
      onClose={onClose}
    >
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 id="setupModalTitle" className="text-lg font-bold text-slate-900">
                Supabase PostgreSQL Connection & Setup
              </h2>
              <p className="text-xs text-slate-500">
                Persistent database source of truth for SkillNear
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Connection Status Box - Accurate & Synchronized 3-Tier Model */}
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
            isOperationsVerified
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : isConnected
              ? 'bg-sky-50 border-sky-200 text-sky-950'
              : status.isConfigured
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                isOperationsVerified
                  ? 'bg-emerald-500 animate-pulse'
                  : isConnected
                  ? 'bg-sky-500'
                  : status.isConfigured
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
              }`}
            />
            <div className="space-y-1 text-xs sm:text-sm">
              <h3 className="font-semibold">
                {isOperationsVerified
                  ? 'Supabase Database Connected & Write Operations Verified'
                  : isConnected
                  ? 'Supabase Reachable — Corrective Schema Migration Pending'
                  : status.isConfigured
                  ? 'Supabase Credentials Detected — Database Endpoint Unreachable'
                  : 'Supabase Not Configured — Running in Demo Simulation Mode'}
              </h3>
              <p className="text-xs opacity-90">
                {isOperationsVerified ? (
                  <>
                    Live database query and schema verified on:{' '}
                    <span className="font-mono font-medium">{status.url}</span>
                  </>
                ) : isConnected ? (
                  <>
                    Endpoint reachable on <span className="font-mono font-medium">{status.url}</span>,
                    but corrective migrations (views/RLS) have not been run. Operating safely in local demo repository.
                  </>
                ) : status.isConfigured ? (
                  <>
                    Credentials found for project{' '}
                    <span className="font-mono font-medium">{status.url}</span>, but an actual database
                    request did not succeed
                    {connectionError ? ` (${connectionError})` : ''}.
                    SkillNear is safely operating in simulation mode until tables are created.
                  </>
                ) : (
                  'SkillNear is operating in pure local simulation mode. All data is held in memory and will NOT persist to PostgreSQL until configured.'
                )}
              </p>
              {!status.isConfigured && status.missingKeys.length > 0 && (
                <div className="mt-2 text-xs font-mono bg-white/70 px-2.5 py-1.5 rounded border border-amber-300">
                  Missing environment variables:{' '}
                  <span className="font-bold text-amber-900">
                    {status.missingKeys.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {onRefreshConnection && (
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>
          )}
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" />
            <span>How to Connect Your Supabase Project (3 Easy Steps)</span>
          </h4>

          <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <li>
              Create a free project at{' '}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 underline font-medium"
              >
                supabase.com
              </a>.
            </li>
            <li>
              Copy <code className="bg-slate-200 px-1 py-0.5 rounded">.env.example</code> to{' '}
              <code className="bg-slate-200 px-1 py-0.5 rounded">.env</code> and fill in{' '}
              <code className="font-semibold text-slate-900">VITE_SUPABASE_URL</code> and{' '}
              <code className="font-semibold text-slate-900">VITE_SUPABASE_PUBLISHABLE_KEY</code>.
            </li>
            <li>
              In your Supabase project dashboard, open the <strong>SQL Editor</strong>, paste the
              schema below (or run the files in <code className="bg-slate-200 px-1 py-0.5 rounded">supabase/migrations/</code>), and click <strong>Run</strong>.
            </li>
          </ol>
        </div>

        {/* SQL Snippet & Copy Button */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('corrective')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  activeTab === 'corrective'
                    ? 'bg-white text-brand-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Migration 2 (Corrective Fix)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('full')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  activeTab === 'full'
                    ? 'bg-white text-brand-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Migration 1 (Full Schema)
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>
                    Copy {activeTab === 'corrective' ? 'Corrective Fix SQL' : 'Full Schema SQL'}
                  </span>
                </>
              )}
            </button>
          </div>

          <pre className="p-3 bg-slate-900 text-slate-100 text-[11px] font-mono rounded-xl max-h-48 overflow-y-auto leading-relaxed border border-slate-800">
            {activeSql}
          </pre>
        </div>

        {/* Security Alert Note */}
        <div className="flex items-start gap-2 p-3 bg-slate-100 text-slate-600 text-xs rounded-xl">
          <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <span>
            <strong>Security Reminder:</strong> Only use your publishable/anon key in the frontend.
            Never expose your Supabase <code className="text-rose-600">service_role</code> key.
          </span>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            {isOperationsVerified ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                PostgreSQL persistence active
              </span>
            ) : isConnected ? (
              <span className="text-sky-700 font-semibold flex items-center gap-1">
                <Database className="w-3.5 h-3.5" />
                Supabase reachable (Local browser writes active)
              </span>
            ) : (
              <span>Local browser storage mode active</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onResetDemo && (
              <button
                type="button"
                onClick={() => {
                  onResetDemo();
                  onClose();
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 flex items-center gap-1 cursor-pointer"
                title="Reset browser demo repository to clean initial fixtures"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Local Data</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
};
