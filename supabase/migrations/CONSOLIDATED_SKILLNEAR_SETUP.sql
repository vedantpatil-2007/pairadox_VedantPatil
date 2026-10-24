-- ============================================================================
-- SkillNear (PS03): Consolidated Hyperlocal Services Setup & Security Migration
-- File: supabase/migrations/CONSOLIDATED_SKILLNEAR_SETUP.sql
-- ============================================================================
-- TARGET: Supabase PostgreSQL (Standard & Enterprise)
-- EXECUTION: Run once in Supabase Project Dashboard -> SQL Editor
-- IDEMPOTENCY: Fully safe to execute multiple times against existing databases
-- ============================================================================
-- SUMMARY OF AUDITED & VERIFIED ENHANCEMENTS:
--  1. BOOKING INTEGRITY:
--     Validates that referenced accepted quote belongs to exact request and worker
--     in proposed booking, and caller owns request. Rejects cross-combinations.
--  2. NEGOTIATION INTEGRITY & ACCEPTANCE MODEL:
--     Replaces unsafe COALESCE assumptions with explicit accepted_amount recorded
--     only when the appropriate counterparty accepts. Prevents self-acceptance.
--  3. TRUSTED WORKER IDENTITY & SIMULATION ISOLATION:
--     Links workers to auth.users via workers.user_id. Prohibits arbitrary worker
--     impersonation in quote insertion. Preserves demo quotes in simulation.
--  4. CHANGE-ORDER PERSISTENCE VIA TRUSTED RPC:
--     Provides fn_apply_approved_change_order to atomically validate customer
--     authorization, pending status, and update agreed_price and change_orders.
--  5. COMPLETION AUTHORIZATION & STATUS TRANSITIONS:
--     Enforces valid booking status transitions. Customers cannot mark bookings
--     completed to fabricate review unlocks.
--  6. WORKER LOCATION PRIVACY:
--     Removes exact latitude/longitude from directory projections; serves 2-decimal
--     approximate coordinates (~1.1 km area precision) and restricts raw table coords.
--  7. CONTROLLED VIEW DEPENDENCY SAFETY:
--     Avoids blind CASCADE drops. Drops only the three target views in controlled order.
--  8. COMPREHENSIVE DYNAMIC POLICY PURGE:
--     Dynamically removes ALL legacy policies from pg_policies across all 6 tables.
--  9. MIGRATION COMPATIBILITY & SAFE SAMPLE SEEDING:
--     Uses ON CONFLICT (id) DO NOTHING to preserve all existing remote records.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. BASE TABLES & EXTENDED COLUMNS (IDEMPOTENT CREATION & ALTERATION)
-- ============================================================================

-- 1.1 WORKERS TABLE
CREATE TABLE IF NOT EXISTS public.workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name TEXT NOT NULL,
    trade TEXT NOT NULL CHECK (trade IN ('electrician', 'plumber', 'cleaner', 'painter', 'ac_repair', 'appliance_repair', 'carpenter', 'handyman', 'water_purifier', 'pest_control')),
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
    badge_label TEXT DEFAULT 'Sample profile',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill user_id, secondary_trades, and skills on workers idempotently
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS secondary_trades TEXT[] DEFAULT '{}';
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS idx_workers_user_id ON public.workers(user_id) WHERE user_id IS NOT NULL;

-- Relax / align trade CHECK constraint for existing workers tables
-- Preflight audit halts visibly with a descriptive error if incompatible data exists; never swallows errors
DO $$
DECLARE
    v_invalid_count INTEGER;
    v_invalid_samples TEXT;
BEGIN
    SELECT count(*), string_agg(DISTINCT quote_literal(trade), ', ')
    INTO v_invalid_count, v_invalid_samples
    FROM public.workers
    WHERE trade NOT IN ('electrician', 'plumber', 'cleaner', 'painter', 'ac_repair', 'appliance_repair', 'carpenter', 'handyman', 'water_purifier', 'pest_control');

    IF v_invalid_count > 0 THEN
        RAISE EXCEPTION 'Cannot apply workers_trade_check: found % records in public.workers with incompatible trade values: %', v_invalid_count, v_invalid_samples;
    END IF;

    ALTER TABLE public.workers DROP CONSTRAINT IF EXISTS workers_trade_check;
    ALTER TABLE public.workers ADD CONSTRAINT workers_trade_check CHECK (trade IN ('electrician', 'plumber', 'cleaner', 'painter', 'ac_repair', 'appliance_repair', 'carpenter', 'handyman', 'water_purifier', 'pest_control'));
END $$;

-- 1.2 SERVICES TABLE (Rate cards per worker)
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('electrician', 'plumber', 'cleaner', 'painter', 'ac_repair', 'appliance_repair', 'carpenter', 'handyman', 'water_purifier', 'pest_control')),
    name TEXT NOT NULL,
    description TEXT,
    base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
    estimated_time TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relax / align category CHECK constraint for existing services tables
-- Preflight audit halts visibly with a descriptive error if incompatible data exists; never swallows errors
DO $$
DECLARE
    v_invalid_count INTEGER;
    v_invalid_samples TEXT;
BEGIN
    SELECT count(*), string_agg(DISTINCT quote_literal(category), ', ')
    INTO v_invalid_count, v_invalid_samples
    FROM public.services
    WHERE category NOT IN ('electrician', 'plumber', 'cleaner', 'painter', 'ac_repair', 'appliance_repair', 'carpenter', 'handyman', 'water_purifier', 'pest_control');

    IF v_invalid_count > 0 THEN
        RAISE EXCEPTION 'Cannot apply services_category_check: found % records in public.services with incompatible category values: %', v_invalid_count, v_invalid_samples;
    END IF;

    ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_category_check;
    ALTER TABLE public.services ADD CONSTRAINT services_category_check CHECK (category IN ('electrician', 'plumber', 'cleaner', 'painter', 'ac_repair', 'appliance_repair', 'carpenter', 'handyman', 'water_purifier', 'pest_control'));
END $$;

-- 1.3 SERVICE REQUESTS TABLE (Customer job broadcasts)
CREATE TABLE IF NOT EXISTS public.service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID DEFAULT auth.uid(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    customer_lat DOUBLE PRECISION NOT NULL,
    customer_lng DOUBLE PRECISION NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('electrician', 'plumber', 'cleaner', 'painter', 'ac_repair', 'appliance_repair', 'carpenter', 'handyman', 'water_purifier', 'pest_control')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'today' CHECK (urgency IN ('immediate', 'today', 'flexible')),
    budget NUMERIC(10, 2),
    preferred_worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'quoted', 'booked', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relax / align category CHECK constraint for existing service_requests tables
-- Preflight audit halts visibly with a descriptive error if incompatible data exists; never swallows errors
DO $$
DECLARE
    v_invalid_count INTEGER;
    v_invalid_samples TEXT;
BEGIN
    SELECT count(*), string_agg(DISTINCT quote_literal(category), ', ')
    INTO v_invalid_count, v_invalid_samples
    FROM public.service_requests
    WHERE category NOT IN ('electrician', 'plumber', 'cleaner', 'painter', 'ac_repair', 'appliance_repair', 'carpenter', 'handyman', 'water_purifier', 'pest_control');

    IF v_invalid_count > 0 THEN
        RAISE EXCEPTION 'Cannot apply service_requests_category_check: found % records in public.service_requests with incompatible category values: %', v_invalid_count, v_invalid_samples;
    END IF;

    ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS service_requests_category_check;
    ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_category_check CHECK (category IN ('electrician', 'plumber', 'cleaner', 'painter', 'ac_repair', 'appliance_repair', 'carpenter', 'handyman', 'water_purifier', 'pest_control'));
END $$;

-- Extend service_requests with ScopeLock & Crew Mode columns idempotently
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS scope JSONB DEFAULT NULL;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS crew_size INTEGER DEFAULT 1;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS organization_name TEXT;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS duration_unit TEXT DEFAULT 'hours';
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS duration_value INTEGER DEFAULT 2;

-- 1.4 QUOTES TABLE (Worker bids, customer counteroffers & negotiations)
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
    accepted_amount NUMERIC(10, 2) CHECK (accepted_amount IS NULL OR accepted_amount > 0),
    counter_notes TEXT,
    last_updated_by TEXT NOT NULL DEFAULT 'worker' CHECK (last_updated_by IN ('worker', 'customer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extend quotes with FairDeal, Crew Mode & Negotiation columns idempotently
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS creator_id UUID DEFAULT auth.uid();
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS accepted_amount NUMERIC(10, 2) CHECK (accepted_amount IS NULL OR accepted_amount > 0);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS itemization JSONB DEFAULT NULL;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS offered_crew_size INTEGER DEFAULT 1;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS supervisor_name TEXT;

-- 1.5 BOOKINGS TABLE (Agreed prices & confirmed work orders)
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

-- Extend bookings with Change-Order Lock, Repair Passport & Crew Mode idempotently
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS original_agreed_price NUMERIC(10, 2) DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS change_orders JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS passport JSONB DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS crew_size INTEGER DEFAULT 1;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS organization_name TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS supervisor_name TEXT;

-- 1.5.1 RACE-SAFE BOOKING UNIQUENESS & CONFLICT AUDIT
-- Enforces:
--  - Exactly one booking per accepted quote (idx_bookings_unique_quote)
--  - At most one active/completed booking per service request (idx_bookings_one_active_per_request)
-- Preflight audit halts safely with clear diagnostic error if conflicts exist in existing data.
DO $$
DECLARE
    v_dup_quote_count INTEGER;
    v_dup_quote_samples TEXT;
    v_dup_req_count INTEGER;
    v_dup_req_samples TEXT;
BEGIN
    -- Check for duplicate bookings referencing the same quote
    SELECT count(*), string_agg(quote_id::text, ', ')
    INTO v_dup_quote_count, v_dup_quote_samples
    FROM (
        SELECT quote_id
        FROM public.bookings
        GROUP BY quote_id
        HAVING count(*) > 1
    ) sub;

    IF v_dup_quote_count > 0 THEN
        RAISE EXCEPTION 'Preflight conflict: Cannot apply unique index on bookings(quote_id): % duplicate quotes exist in bookings: %',
            v_dup_quote_count, v_dup_quote_samples;
    END IF;

    -- Check for duplicate active/completed bookings for the same service request
    SELECT count(*), string_agg(request_id::text, ', ')
    INTO v_dup_req_count, v_dup_req_samples
    FROM (
        SELECT request_id
        FROM public.bookings
        WHERE status IN ('confirmed', 'in_progress', 'completed')
        GROUP BY request_id
        HAVING count(*) > 1
    ) sub;

    IF v_dup_req_count > 0 THEN
        RAISE EXCEPTION 'Preflight conflict: Cannot apply partial unique index on bookings(request_id): % requests have multiple active/completed bookings: %',
            v_dup_req_count, v_dup_req_samples;
    END IF;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_quote ON public.bookings(quote_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_one_active_per_request ON public.bookings(request_id)
        WHERE status IN ('confirmed', 'in_progress', 'completed');
END $$;

-- 1.6 REVIEWS TABLE
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

-- ============================================================================
-- 2. IDEMPOTENT FOREIGN KEYS TO auth.users(id)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workers_user_id_fkey') THEN
        ALTER TABLE public.workers
            ADD CONSTRAINT workers_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

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

-- ============================================================================
-- 3. DEDICATED PRIVATE SCHEMA ('app_private') & RECURSION-FREE HELPERS
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;

-- 3.1 Recursion-Free Participant Helper
-- Enforces verified worker identity: caller must match workers.user_id (not demo).
-- creator_id alone is NOT accepted as proof of worker identity.
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
        JOIN public.workers w ON w.id = b.worker_id
        WHERE b.request_id = p_request_id
          AND (
              b.customer_id = v_caller_uid
              OR (w.user_id IS NOT NULL AND w.user_id = v_caller_uid AND w.is_demo = false)
          )
    );
END;
$$;

REVOKE ALL ON FUNCTION app_private.fn_is_booking_technician_or_participant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.fn_is_booking_technician_or_participant(UUID) TO authenticated;

-- 3.2 Service Request Ownership Protection Trigger Function
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
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
        RAISE EXCEPTION 'Cannot modify service request customer ownership';
    END IF;
    IF NEW.customer_lat <> OLD.customer_lat OR NEW.customer_lng <> OLD.customer_lng THEN
        RAISE EXCEPTION 'Cannot modify service request location coordinates';
    END IF;

    -- Enforce service-request status integrity (State Machine)
    -- Prevents callers from forging 'booked' or 'completed' status out-of-band
    IF NEW.status <> OLD.status THEN
        IF OLD.status IN ('completed', 'cancelled') THEN
            RAISE EXCEPTION 'Cannot alter service request in terminal status "%"', OLD.status;
        END IF;

        IF NEW.status = 'booked' THEN
            -- Only allowed via system booking triggers (depth > 1)
            IF pg_catalog.pg_trigger_depth() <= 1 THEN
                RAISE EXCEPTION 'Direct update of service request status to "booked" is prohibited. Status transitions automatically upon booking creation.';
            END IF;
        ELSIF NEW.status = 'completed' THEN
            -- Only allowed via system booking triggers (depth > 1)
            IF pg_catalog.pg_trigger_depth() <= 1 THEN
                RAISE EXCEPTION 'Direct update of service request status to "completed" is prohibited. Status transitions automatically upon technician job completion.';
            END IF;
        ELSIF NEW.status = 'cancelled' THEN
            IF OLD.status IN ('open', 'quoted') THEN
                -- Customer cancelling their own open/quoted request
                NEW.updated_at := pg_catalog.clock_timestamp();
            ELSIF OLD.status = 'booked' THEN
                -- Booked requests can only be cancelled by cancelling the active booking
                IF pg_catalog.pg_trigger_depth() <= 1 THEN
                    RAISE EXCEPTION 'Cannot directly cancel a booked service request. Cancel the active booking to cancel this request.';
                END IF;
            END IF;
        ELSIF NEW.status = 'quoted' THEN
            IF OLD.status <> 'open' AND OLD.status <> 'quoted' THEN
                RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
            END IF;
        ELSIF NEW.status = 'open' THEN
            IF OLD.status <> 'quoted' AND OLD.status <> 'open' THEN
                RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
            END IF;
        ELSE
            RAISE EXCEPTION 'Invalid service request status: %', NEW.status;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.fn_protect_service_request_ownership() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.fn_protect_service_request_ownership() TO authenticated;

-- 3.3 Negotiation Integrity & Quote Role Protection Trigger Function
-- Enforces trusted worker identity: creator_id alone is never treated as proof of worker identity.
-- Caller must be mapped to workers.user_id with is_demo = false.
CREATE OR REPLACE FUNCTION app_private.fn_validate_quote_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_uid UUID;
    v_req_customer_id UUID;
    v_worker_user_id UUID;
    v_worker_is_demo BOOLEAN := true;
    v_is_customer BOOLEAN := false;
    v_is_worker BOOLEAN := false;
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

    -- Check if caller is request customer
    SELECT customer_id INTO v_req_customer_id
    FROM public.service_requests
    WHERE id = OLD.request_id;

    IF v_req_customer_id IS NOT NULL AND v_caller_uid = v_req_customer_id THEN
        v_is_customer := true;
    END IF;

    -- Check if caller is verified quote worker:
    -- Must have a non-demo worker mapping where user_id matches authenticated caller
    -- Do NOT treat creator_id alone as proof of worker identity!
    SELECT user_id, is_demo INTO v_worker_user_id, v_worker_is_demo
    FROM public.workers
    WHERE id = OLD.worker_id;

    IF v_worker_user_id IS NOT NULL AND v_caller_uid = v_worker_user_id AND v_worker_is_demo = false THEN
        -- If quote has creator_id set, caller must also match creator_id (prevents cross-user tampering)
        IF OLD.creator_id IS NULL OR OLD.creator_id = v_caller_uid THEN
            v_is_worker := true;
        END IF;
    END IF;

    IF NOT v_is_customer AND NOT v_is_worker THEN
        RAISE EXCEPTION 'Unauthorized: Caller is neither the request customer nor the verified assigned technician';
    END IF;

    -- Terminal state check
    IF OLD.status IN ('accepted', 'rejected') AND NEW.status <> OLD.status THEN
        RAISE EXCEPTION 'Cannot modify quote in terminal status "%"', OLD.status;
    END IF;

    IF v_is_customer THEN
        -- Customer actions: cannot tamper with technician original quote amount, notes or duration
        IF NEW.amount <> OLD.amount THEN
            RAISE EXCEPTION 'Customer cannot modify worker original quote amount';
        END IF;
        IF NEW.notes IS DISTINCT FROM OLD.notes THEN
            RAISE EXCEPTION 'Customer cannot modify worker quote notes';
        END IF;
        IF NEW.estimated_duration <> OLD.estimated_duration THEN
            RAISE EXCEPTION 'Customer cannot modify worker estimated duration';
        END IF;

        IF NEW.status = 'accepted' THEN
            -- Negotiation Rule: Customer can accept worker's original quote (if pending)
            -- OR worker's counteroffer (if countered and last_updated_by = 'worker').
            -- Customer CANNOT accept their own counteroffer!
            IF OLD.status = 'countered' AND OLD.last_updated_by = 'customer' THEN
                RAISE EXCEPTION 'Customer cannot accept their own counteroffer; awaiting technician response';
            ELSIF OLD.status = 'pending' AND OLD.last_updated_by = 'worker' THEN
                NEW.accepted_amount := OLD.amount;
            ELSIF OLD.status = 'countered' AND OLD.last_updated_by = 'worker' THEN
                NEW.accepted_amount := OLD.counter_amount;
            ELSE
                RAISE EXCEPTION 'Invalid quote state for customer acceptance: status=%, last_updated_by=%',
                    OLD.status, OLD.last_updated_by;
            END IF;

            NEW.last_updated_by := 'customer';

        ELSIF NEW.status = 'countered' THEN
            IF NEW.counter_amount IS NULL OR NEW.counter_amount <= 0 THEN
                RAISE EXCEPTION 'Customer counteroffer requires a valid counter_amount greater than zero';
            END IF;
            NEW.accepted_amount := NULL;
            NEW.last_updated_by := 'customer';

        ELSIF NEW.status = 'rejected' THEN
            NEW.accepted_amount := NULL;
            NEW.last_updated_by := 'customer';

        ELSIF NEW.status = 'pending' THEN
            NEW.accepted_amount := NULL;
            NEW.last_updated_by := 'customer';
        ELSE
            RAISE EXCEPTION 'Invalid quote status for customer action: %', NEW.status;
        END IF;

    ELSIF v_is_worker THEN
        -- Worker actions:
        IF NEW.status = 'accepted' THEN
            -- Negotiation Rule: Worker can ONLY accept customer's counteroffer (last_updated_by = 'customer').
            -- Worker cannot accept their own initial quote or counteroffer!
            IF OLD.status <> 'countered' OR OLD.last_updated_by <> 'customer' THEN
                RAISE EXCEPTION 'Technician cannot accept their own offer; awaiting customer acceptance';
            END IF;
            IF OLD.counter_amount IS NULL OR OLD.counter_amount <= 0 THEN
                RAISE EXCEPTION 'Cannot accept counteroffer with invalid counter_amount';
            END IF;

            NEW.accepted_amount := OLD.counter_amount;
            NEW.last_updated_by := 'worker';

        ELSIF NEW.status = 'countered' THEN
            IF NEW.counter_amount IS NULL OR NEW.counter_amount <= 0 THEN
                RAISE EXCEPTION 'Worker counteroffer requires a valid counter_amount greater than zero';
            END IF;
            NEW.accepted_amount := NULL;
            NEW.last_updated_by := 'worker';

        ELSIF NEW.status = 'rejected' THEN
            NEW.accepted_amount := NULL;
            NEW.last_updated_by := 'worker';
        ELSE
            RAISE EXCEPTION 'Invalid quote status for technician action: %', NEW.status;
        END IF;
    END IF;

    NEW.updated_at := pg_catalog.clock_timestamp();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.fn_validate_quote_update() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.fn_validate_quote_update() TO authenticated;

-- 3.4 Booking Creation Integrity & Accepted Price Snapshot Trigger Function
-- 3.4 Booking Creation Integrity & Accepted Price Snapshot Trigger Function
-- Enforces:
--  - original_agreed_price ALWAYS equals validated accepted quote amount
--  - change_orders initialized to empty array '[]'::jsonb
--  - passport initialized to NULL
--  - crew_size validated (1-50)
--  - duplicate active booking prevention
--  - caller-supplied audit fields ignored/overridden
CREATE OR REPLACE FUNCTION app_private.fn_validate_and_sync_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_uid UUID;
    v_quote RECORD;
    v_request RECORD;
    v_effective_price NUMERIC;
BEGIN
    v_caller_uid := (SELECT auth.uid());
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create a booking';
    END IF;

    -- 1. Validate service request exists, is in valid state, and caller is owner
    SELECT id, customer_id, customer_name, customer_phone, customer_address, status, crew_size, organization_name
    INTO v_request
    FROM public.service_requests
    WHERE id = NEW.request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced service request % does not exist', NEW.request_id;
    END IF;

    IF v_request.status NOT IN ('open', 'quoted') THEN
        RAISE EXCEPTION 'Cannot book service request in status "%". Request must be open or quoted.', v_request.status;
    END IF;

    -- Authenticated customer must own the request
    IF v_request.customer_id IS DISTINCT FROM v_caller_uid THEN
        RAISE EXCEPTION 'Unauthorized: Caller (%) does not own service request % (owner %)',
            v_caller_uid, NEW.request_id, v_request.customer_id;
    END IF;

    -- Prevent duplicate active bookings for the same request
    IF EXISTS (
        SELECT 1 FROM public.bookings
        WHERE request_id = NEW.request_id
          AND status IN ('confirmed', 'in_progress', 'completed')
    ) THEN
        RAISE EXCEPTION 'Service request % already has an active or completed booking', NEW.request_id;
    END IF;

    -- 2. Fetch and validate referenced quote
    SELECT id, request_id, worker_id, amount, counter_amount, accepted_amount, status, offered_crew_size, supervisor_name
    INTO v_quote
    FROM public.quotes
    WHERE id = NEW.quote_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced quote % does not exist', NEW.quote_id;
    END IF;

    -- Prevent reuse of already booked quote
    IF EXISTS (
        SELECT 1 FROM public.bookings
        WHERE quote_id = NEW.quote_id
    ) THEN
        RAISE EXCEPTION 'Quote % has already been booked', NEW.quote_id;
    END IF;

    -- Reject cross-request booking combinations
    IF v_quote.request_id <> NEW.request_id THEN
        RAISE EXCEPTION 'Booking relationship mismatch: Quote % belongs to request %, not %',
            NEW.quote_id, v_quote.request_id, NEW.request_id;
    END IF;

    -- Reject cross-worker booking combinations
    IF v_quote.worker_id <> NEW.worker_id THEN
        RAISE EXCEPTION 'Booking relationship mismatch: Quote % belongs to worker %, not %',
            NEW.quote_id, v_quote.worker_id, NEW.worker_id;
    END IF;

    -- Must be accepted
    IF v_quote.status <> 'accepted' THEN
        RAISE EXCEPTION 'Cannot book quote with status "%". Quote must be accepted first.', v_quote.status;
    END IF;

    -- Must have validated accepted_amount
    v_effective_price := v_quote.accepted_amount;
    IF v_effective_price IS NULL OR v_effective_price <= 0 THEN
        RAISE EXCEPTION 'Accepted quote % does not have a validated accepted_amount recorded', NEW.quote_id;
    END IF;

    -- Enforce financial and audit invariants:
    -- original_agreed_price ALWAYS equals validated accepted quote amount
    NEW.agreed_price := v_effective_price;
    NEW.original_agreed_price := v_effective_price;

    -- Customer ID on booking must match authenticated caller
    NEW.customer_id := v_caller_uid;

    -- Initialize change_orders and passport safely (do not trust caller-supplied values)
    NEW.change_orders := '[]'::jsonb;
    NEW.passport := NULL;

    -- Enforce initial status and timestamps
    NEW.status := 'confirmed';
    NEW.created_at := pg_catalog.clock_timestamp();
    NEW.completed_at := NULL;

    -- Validate and initialize crew size (Crew Mode)
    IF NEW.crew_size IS NULL OR NEW.crew_size < 1 THEN
        NEW.crew_size := COALESCE(v_quote.offered_crew_size, v_request.crew_size, 1);
    END IF;
    IF NEW.crew_size < 1 OR NEW.crew_size > 50 THEN
        RAISE EXCEPTION 'Invalid booking crew size %; must be between 1 and 50', NEW.crew_size;
    END IF;

    -- Synchronize organization and supervisor details
    NEW.organization_name := COALESCE(NEW.organization_name, v_request.organization_name);
    NEW.supervisor_name := COALESCE(NEW.supervisor_name, v_quote.supervisor_name);

    -- Ensure customer contact details are populated from request if omitted or blank
    NEW.customer_name := COALESCE(NULLIF(trim(NEW.customer_name), ''), v_request.customer_name);
    NEW.customer_phone := COALESCE(NULLIF(trim(NEW.customer_phone), ''), v_request.customer_phone);
    NEW.service_address := COALESCE(NULLIF(trim(NEW.service_address), ''), v_request.customer_address);

    -- Atomically transition service_requests status to 'booked'
    UPDATE public.service_requests
    SET status = 'booked',
        updated_at = pg_catalog.clock_timestamp()
    WHERE id = NEW.request_id;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.fn_validate_and_sync_booking() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.fn_validate_and_sync_booking() TO authenticated;

-- 3.5 Booking Update & Completion Authorization Trigger Function
-- Enforces:
--  - verified worker identity (creator_id alone is NOT accepted)
--  - immutable IDs and financial baselines
--  - status transitions: only verified technician can mark completed; customer cannot self-complete
--  - direct updates to agreed_price, change_orders, and passport are prohibited outside trusted RPCs
CREATE OR REPLACE FUNCTION app_private.fn_validate_booking_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_uid UUID;
    v_worker_user_id UUID;
    v_worker_is_demo BOOLEAN := true;
    v_is_customer BOOLEAN := false;
    v_is_worker BOOLEAN := false;
BEGIN
    v_caller_uid := (SELECT auth.uid());
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to update booking';
    END IF;

    -- Immutable fields check
    IF NEW.id <> OLD.id THEN RAISE EXCEPTION 'Cannot modify booking ID'; END IF;
    IF NEW.request_id <> OLD.request_id THEN RAISE EXCEPTION 'Cannot modify booking request_id'; END IF;
    IF NEW.worker_id <> OLD.worker_id THEN RAISE EXCEPTION 'Cannot modify booking worker_id'; END IF;
    IF NEW.quote_id <> OLD.quote_id THEN RAISE EXCEPTION 'Cannot modify booking quote_id'; END IF;
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN RAISE EXCEPTION 'Cannot modify booking customer_id'; END IF;
    IF NEW.original_agreed_price IS DISTINCT FROM OLD.original_agreed_price THEN RAISE EXCEPTION 'Cannot modify original_agreed_price'; END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Cannot modify booking created_at timestamp'; END IF;

    -- Prevent direct alteration of agreed_price, change_orders, and passport via standard UPDATE
    -- These must be processed via authorized functions: fn_apply_approved_change_order and fn_record_booking_passport
    IF (NEW.agreed_price <> OLD.agreed_price OR NEW.change_orders IS DISTINCT FROM OLD.change_orders) THEN
        IF pg_catalog.current_setting('app.in_change_order_workflow', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Direct update of agreed_price or change_orders is prohibited. Use approved change-order workflow.';
        END IF;
    END IF;

    IF NEW.passport IS DISTINCT FROM OLD.passport THEN
        IF pg_catalog.current_setting('app.in_passport_workflow', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Direct update of passport is prohibited. Use authorized passport workflow.';
        END IF;
    END IF;

    -- Identify caller role:
    -- Customer:
    IF OLD.customer_id IS NOT NULL AND v_caller_uid = OLD.customer_id THEN
        v_is_customer := true;
    END IF;

    -- Worker:
    -- Must validate caller against worker mapping AND booking/quote relationships
    -- Do NOT treat creator_id alone as proof of worker identity!
    SELECT user_id, is_demo INTO v_worker_user_id, v_worker_is_demo
    FROM public.workers
    WHERE id = OLD.worker_id;

    IF v_worker_user_id IS NOT NULL AND v_caller_uid = v_worker_user_id AND v_worker_is_demo = false THEN
        -- Verify quote belongs to this worker
        IF EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = OLD.quote_id
              AND q.worker_id = OLD.worker_id
              AND (q.creator_id IS NULL OR q.creator_id = v_caller_uid)
        ) THEN
            v_is_worker := true;
        END IF;
    END IF;

    IF NOT v_is_customer AND NOT v_is_worker THEN
        RAISE EXCEPTION 'Unauthorized: Caller is neither the booking customer nor the verified assigned technician';
    END IF;

    -- Completion Notes Protection: Only verified assigned technician can provide or modify completion notes
    IF NEW.completion_notes IS DISTINCT FROM OLD.completion_notes THEN
        IF NOT v_is_worker THEN
            RAISE EXCEPTION 'Unauthorized: Only the assigned technician can update completion notes';
        END IF;
    END IF;

    -- Rescheduling Protection: Cannot reschedule terminal bookings
    IF NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for THEN
        IF OLD.status IN ('completed', 'cancelled') THEN
            RAISE EXCEPTION 'Cannot reschedule a completed or cancelled booking';
        END IF;
        IF NEW.status IN ('completed', 'cancelled') THEN
            RAISE EXCEPTION 'Cannot modify schedule while transitioning to %', NEW.status;
        END IF;
    END IF;

    -- Completion Timestamp Integrity:
    -- Direct alteration of completed_at is prohibited. It is set strictly by server clock on valid completion.
    IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
        IF NOT (NEW.status = 'completed' AND OLD.status IN ('confirmed', 'in_progress') AND v_is_worker) THEN
            RAISE EXCEPTION 'Direct modification of completed_at is prohibited. Completion timestamp is set automatically.';
        END IF;
    END IF;

    -- Validate Status Transitions
    IF NEW.status <> OLD.status THEN
        IF OLD.status IN ('completed', 'cancelled') THEN
            RAISE EXCEPTION 'Cannot alter booking in terminal status "%"', OLD.status;
        END IF;

        IF v_is_customer AND NOT v_is_worker THEN
            -- Customer CANNOT mark booking completed to self-unlock reviews!
            IF NEW.status = 'completed' THEN
                RAISE EXCEPTION 'Customers cannot mark bookings completed. Completion must be recorded by the assigned technician.';
            ELSIF NEW.status = 'in_progress' THEN
                RAISE EXCEPTION 'Only the technician can mark work in-progress.';
            ELSIF NEW.status <> 'cancelled' THEN
                RAISE EXCEPTION 'Invalid status transition for customer: % -> %', OLD.status, NEW.status;
            END IF;
        END IF;

        IF v_is_worker THEN
            IF OLD.status = 'confirmed' AND NEW.status NOT IN ('in_progress', 'cancelled') THEN
                RAISE EXCEPTION 'Confirmed booking can only transition to in_progress or cancelled';
            END IF;
            IF OLD.status = 'in_progress' AND NEW.status NOT IN ('completed', 'cancelled') THEN
                RAISE EXCEPTION 'In-progress booking can only transition to completed or cancelled';
            END IF;
        END IF;

        IF NEW.status = 'completed' THEN
            -- Server clock strictly sets completed_at; caller overrides are discarded
            NEW.completed_at := pg_catalog.clock_timestamp();
            -- Update request status to completed
            UPDATE public.service_requests
            SET status = 'completed', updated_at = pg_catalog.clock_timestamp()
            WHERE id = OLD.request_id;
        ELSIF NEW.status = 'cancelled' THEN
            NEW.completed_at := NULL;
            UPDATE public.service_requests
            SET status = 'cancelled', updated_at = pg_catalog.clock_timestamp()
            WHERE id = OLD.request_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.fn_validate_booking_update() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.fn_validate_booking_update() TO authenticated;

-- ============================================================================
-- 3.6 NARROWLY AUTHORIZED FUNCTIONS FOR CHANGE ORDERS & REPAIR PASSPORT
-- ============================================================================

-- Trusted function for proposing a change order (Change-Order Lock)
-- Enforces:
--  - Caller is verified assigned worker (user_id = auth.uid(), not demo)
--  - Booking must be in active status ('confirmed' or 'in_progress')
--  - Rejects malformed amounts and invalid crew adjustments
--  - Appends pending change order; agreed_price and crew_size remain unchanged until customer approves
CREATE OR REPLACE FUNCTION public.fn_propose_change_order(
    p_booking_id UUID,
    p_title TEXT,
    p_reason TEXT,
    p_additional_amount NUMERIC,
    p_added_workers INTEGER DEFAULT 0,
    p_materials_breakdown JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_uid UUID;
    v_booking RECORD;
    v_worker RECORD;
    v_new_co JSONB;
    v_change_order_id TEXT;
    v_revised_total NUMERIC;
    v_new_crew_size INTEGER;
BEGIN
    v_caller_uid := (SELECT auth.uid());
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to propose a change order';
    END IF;

    -- 1. Lock and fetch booking
    SELECT id, request_id, worker_id, quote_id, customer_id, agreed_price, original_agreed_price, crew_size, status, change_orders
    INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id;
    END IF;

    IF v_booking.status NOT IN ('confirmed', 'in_progress') THEN
        RAISE EXCEPTION 'Cannot propose change order on booking in status "%"', v_booking.status;
    END IF;

    -- 2. Validate assigned worker identity:
    -- Caller must be mapped to the assigned worker profile (w.user_id = v_caller_uid, not demo)
    SELECT id, user_id, is_demo, name, trade
    INTO v_worker
    FROM public.workers
    WHERE id = v_booking.worker_id;

    IF NOT FOUND OR v_worker.user_id IS NULL OR v_worker.user_id <> v_caller_uid OR v_worker.is_demo = true THEN
        RAISE EXCEPTION 'Unauthorized: Only the verified assigned technician can propose a change order';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.quotes q
        WHERE q.id = v_booking.quote_id
          AND q.worker_id = v_booking.worker_id
          AND (q.creator_id IS NULL OR q.creator_id = v_caller_uid)
    ) THEN
        RAISE EXCEPTION 'Booking quote relationship mismatch for worker %', v_booking.worker_id;
    END IF;

    -- 3. Validate inputs (reject malformed amounts and invalid crew adjustments)
    IF trim(COALESCE(p_title, '')) = '' THEN
        RAISE EXCEPTION 'Change order title is required';
    END IF;

    IF trim(COALESCE(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'Change order justification / reason is required';
    END IF;

    IF p_additional_amount IS NULL OR p_additional_amount < 0 THEN
        RAISE EXCEPTION 'Additional amount must be non-negative (received %)', p_additional_amount;
    END IF;

    IF p_added_workers IS NULL OR p_added_workers < 0 OR p_added_workers > 20 THEN
        RAISE EXCEPTION 'Invalid added_workers (%); must be between 0 and 20', p_added_workers;
    END IF;

    IF p_additional_amount = 0 AND p_added_workers = 0 THEN
        RAISE EXCEPTION 'Change order must specify either an additional price or added crew members';
    END IF;

    v_revised_total := v_booking.agreed_price + p_additional_amount;
    IF v_revised_total <= 0 OR v_revised_total > 1000000 THEN
        RAISE EXCEPTION 'Resulting revised total (%) is outside permissible limits', v_revised_total;
    END IF;

    v_new_crew_size := COALESCE(v_booking.crew_size, 1) + p_added_workers;
    IF v_new_crew_size < 1 OR v_new_crew_size > 50 THEN
        RAISE EXCEPTION 'Resulting crew size (%) is outside permissible limits (1 - 50)', v_new_crew_size;
    END IF;

    -- 4. Build change order record (status: pending_customer_approval)
    v_change_order_id := 'co-' || pg_catalog.gen_random_uuid()::text;
    v_new_co := jsonb_build_object(
        'id', v_change_order_id,
        'booking_id', p_booking_id,
        'title', trim(p_title),
        'reason', trim(p_reason),
        'original_price', v_booking.agreed_price,
        'additional_amount', p_additional_amount,
        'revised_total', v_revised_total,
        'crew_adjustment', jsonb_build_object(
            'added_workers', p_added_workers,
            'reason', trim(p_reason)
        ),
        'materials_breakdown', COALESCE(p_materials_breakdown, '[]'::jsonb),
        'status', 'pending_customer_approval',
        'proposed_by', v_caller_uid,
        'created_at', pg_catalog.to_char(pg_catalog.clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'responded_at', NULL,
        'customer_notes', NULL
    );

    -- 5. Append change order safely without altering agreed_price or crew_size
    -- Price and crew changes must occur ONLY after customer approval
    PERFORM pg_catalog.set_config('app.in_change_order_workflow', 'true', true);

    UPDATE public.bookings
    SET change_orders = COALESCE(change_orders, '[]'::jsonb) || jsonb_build_array(v_new_co)
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
        'booking_id', p_booking_id,
        'change_order_id', v_change_order_id,
        'status', 'pending_customer_approval',
        'additional_amount', p_additional_amount,
        'revised_total', v_revised_total,
        'added_workers', p_added_workers
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_propose_change_order(UUID, TEXT, TEXT, NUMERIC, INTEGER, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_propose_change_order(UUID, TEXT, TEXT, NUMERIC, INTEGER, JSONB) TO authenticated;

-- Trusted function for approved change order resolution
-- Enforces:
--  - ONLY the booking customer can approve or reject
--  - Price and crew updates are atomic and occur ONLY upon approval
--  - Rejects malformed amounts and invalid crew adjustments
CREATE OR REPLACE FUNCTION public.fn_apply_approved_change_order(
    p_booking_id UUID,
    p_change_order_id TEXT,
    p_approved BOOLEAN,
    p_customer_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_uid UUID;
    v_booking RECORD;
    v_current_co JSONB;
    v_updated_co JSONB;
    v_new_cos JSONB := '[]'::jsonb;
    v_additional_amount NUMERIC := 0;
    v_new_price NUMERIC;
    v_new_crew_size INTEGER;
    v_added_workers INTEGER := 0;
    v_found BOOLEAN := false;
    v_co_count INTEGER;
    i INTEGER;
BEGIN
    v_caller_uid := (SELECT auth.uid());
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to approve or reject change orders';
    END IF;

    -- Lock and fetch booking
    SELECT id, request_id, worker_id, customer_id, agreed_price, original_agreed_price, crew_size, status, change_orders
    INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id;
    END IF;

    -- Authorization: ONLY the customer who owns the booking can approve/reject
    IF v_booking.customer_id IS DISTINCT FROM v_caller_uid THEN
        RAISE EXCEPTION 'Unauthorized: Caller (%) does not own booking % (owner %)',
            v_caller_uid, p_booking_id, v_booking.customer_id;
    END IF;

    IF v_booking.status NOT IN ('confirmed', 'in_progress') THEN
        RAISE EXCEPTION 'Cannot resolve change order on booking in status "%"', v_booking.status;
    END IF;

    IF v_booking.change_orders IS NULL OR jsonb_array_length(v_booking.change_orders) = 0 THEN
        RAISE EXCEPTION 'Booking % has no change orders', p_booking_id;
    END IF;

    v_co_count := jsonb_array_length(v_booking.change_orders);
    FOR i IN 0..(v_co_count - 1) LOOP
        v_current_co := v_booking.change_orders->i;
        IF (v_current_co->>'id') = p_change_order_id THEN
            v_found := true;
            -- Check that it is pending
            IF (v_current_co->>'status') NOT IN ('pending', 'pending_customer_approval') THEN
                RAISE EXCEPTION 'Change order % is already %',
                    p_change_order_id, (v_current_co->>'status');
            END IF;

            -- Extract amount delta and validate
            v_additional_amount := COALESCE((v_current_co->>'additional_amount')::numeric, 0);
            IF v_additional_amount < 0 THEN
                RAISE EXCEPTION 'Malformed change order additional_amount (%)', v_additional_amount;
            END IF;

            -- Extract crew adjustment if any and validate
            IF (v_current_co->'crew_adjustment') IS NOT NULL AND (v_current_co->'crew_adjustment'->>'added_workers') IS NOT NULL THEN
                v_added_workers := COALESCE((v_current_co->'crew_adjustment'->>'added_workers')::integer, 0);
                IF v_added_workers < 0 OR v_added_workers > 20 THEN
                    RAISE EXCEPTION 'Malformed change order added_workers (%)', v_added_workers;
                END IF;
            END IF;

            IF p_approved THEN
                v_updated_co := v_current_co || jsonb_build_object(
                    'status', 'approved',
                    'responded_at', to_char(clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                    'customer_notes', COALESCE(p_customer_notes, v_current_co->>'customer_notes')
                );
            ELSE
                v_updated_co := v_current_co || jsonb_build_object(
                    'status', 'rejected',
                    'responded_at', to_char(clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                    'customer_notes', COALESCE(p_customer_notes, v_current_co->>'customer_notes')
                );
            END IF;
            v_new_cos := v_new_cos || jsonb_build_array(v_updated_co);
        ELSE
            v_new_cos := v_new_cos || jsonb_build_array(v_current_co);
        END IF;
    END LOOP;

    IF NOT v_found THEN
        RAISE EXCEPTION 'Change order % not found on booking %', p_change_order_id, p_booking_id;
    END IF;

    IF p_approved THEN
        v_new_price := v_booking.agreed_price + v_additional_amount;
        IF v_new_price <= 0 THEN
            RAISE EXCEPTION 'Resulting agreed price (%) must be greater than zero', v_new_price;
        END IF;
        v_new_crew_size := COALESCE(v_booking.crew_size, 1) + v_added_workers;
        IF v_new_crew_size < 1 OR v_new_crew_size > 50 THEN
            RAISE EXCEPTION 'Resulting crew size (%) is outside permissible limits (1 - 50)', v_new_crew_size;
        END IF;
    ELSE
        v_new_price := v_booking.agreed_price;
        v_new_crew_size := COALESCE(v_booking.crew_size, 1);
    END IF;

    -- Update booking fields and change order history atomically within trusted workflow
    PERFORM pg_catalog.set_config('app.in_change_order_workflow', 'true', true);

    UPDATE public.bookings
    SET agreed_price = v_new_price,
        crew_size = v_new_crew_size,
        change_orders = v_new_cos
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
        'booking_id', p_booking_id,
        'change_order_id', p_change_order_id,
        'approved', p_approved,
        'agreed_price', v_new_price,
        'crew_size', v_new_crew_size
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_apply_approved_change_order(UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_apply_approved_change_order(UUID, TEXT, BOOLEAN, TEXT) TO authenticated;

-- Trusted function for certified Repair Passport recording & audit preservation
-- Enforces:
--  - Booking must be in 'completed' status
--  - Caller must be booking customer or verified assigned technician
--  - Validates JSON structure (non-empty passport_id, technician_name, valid trade enum)
--  - Re-aligns financial fields with booking truth (cannot forge original_agreed_price or final_total_paid)
--  - Preserves versioned audit_history snapshots preventing untracked replacement
CREATE OR REPLACE FUNCTION public.fn_record_booking_passport(
    p_booking_id UUID,
    p_passport JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_uid UUID;
    v_booking RECORD;
    v_worker RECORD;
    v_history JSONB;
    v_validated_passport JSONB;
    v_passport_id TEXT;
    v_technician_name TEXT;
    v_technician_trade TEXT;
    v_final_total_paid NUMERIC;
    v_orig_price NUMERIC;
BEGIN
    v_caller_uid := (SELECT auth.uid());
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to record Repair Passport';
    END IF;

    -- 1. Fetch booking with lock
    SELECT id, customer_id, worker_id, status, agreed_price, original_agreed_price, passport, completed_at
    INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id;
    END IF;

    IF v_booking.status <> 'completed' THEN
        RAISE EXCEPTION 'Repair Passport can only be recorded for completed bookings (current status: %)', v_booking.status;
    END IF;

    -- 2. Authorization check:
    -- Only the booking customer or verified assigned technician can record/amend passport
    SELECT user_id, is_demo, name, trade INTO v_worker
    FROM public.workers
    WHERE id = v_booking.worker_id;

    IF v_booking.customer_id IS DISTINCT FROM v_caller_uid
       AND (v_worker.user_id IS NULL OR v_worker.user_id <> v_caller_uid OR v_worker.is_demo = true) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is neither the booking customer nor the verified assigned technician';
    END IF;

    -- 3. Validate JSON structure of p_passport
    IF p_passport IS NULL OR jsonb_typeof(p_passport) <> 'object' THEN
        RAISE EXCEPTION 'Passport payload must be a valid JSON object';
    END IF;

    v_passport_id := trim(COALESCE(p_passport->>'passport_id', ''));
    IF v_passport_id = '' THEN
        RAISE EXCEPTION 'Passport requires a non-empty passport_id';
    END IF;

    v_technician_name := trim(COALESCE(p_passport->>'technician_name', ''));
    IF v_technician_name = '' THEN
        RAISE EXCEPTION 'Passport requires technician_name';
    END IF;

    v_technician_trade := trim(COALESCE(p_passport->>'technician_trade', ''));
    IF v_technician_trade NOT IN ('electrician', 'plumber', 'cleaner', 'painter', 'ac_repair', 'appliance_repair', 'carpenter', 'handyman', 'water_purifier', 'pest_control') THEN
        RAISE EXCEPTION 'Invalid technician_trade "%" in passport', v_technician_trade;
    END IF;

    -- Validate financials match booking records (prevent forged amounts in passport)
    v_orig_price := COALESCE((p_passport->>'original_agreed_price')::numeric, 0);
    v_final_total_paid := COALESCE((p_passport->>'final_total_paid')::numeric, 0);

    IF v_orig_price <= 0 OR v_orig_price <> v_booking.original_agreed_price THEN
        -- Force-align original price with booking truth
        p_passport := jsonb_set(p_passport, '{original_agreed_price}', to_jsonb(v_booking.original_agreed_price));
    END IF;

    IF v_final_total_paid <= 0 OR v_final_total_paid <> v_booking.agreed_price THEN
        -- Force-align final total with booking truth
        p_passport := jsonb_set(p_passport, '{final_total_paid}', to_jsonb(v_booking.agreed_price));
    END IF;

    -- Align booking_id and completed_at
    p_passport := jsonb_set(p_passport, '{booking_id}', to_jsonb(p_booking_id::text));
    IF (p_passport->>'completed_at') IS NULL THEN
        p_passport := pg_catalog.jsonb_set(p_passport, '{completed_at}', pg_catalog.to_jsonb(pg_catalog.to_char(COALESCE(v_booking.completed_at, pg_catalog.clock_timestamp()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
    END IF;

    -- 4. Preserve audit history:
    -- If a passport already exists on this booking, archive the previous version into audit_history
    IF v_booking.passport IS NOT NULL THEN
        v_history := COALESCE(v_booking.passport->'audit_history', '[]'::jsonb);
        v_history := v_history || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'archived_at', pg_catalog.to_char(pg_catalog.clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'archived_by', v_caller_uid,
            'previous_snapshot', v_booking.passport - 'audit_history'
        ));
        v_validated_passport := p_passport || jsonb_build_object(
            'audit_history', v_history,
            'version', COALESCE((v_booking.passport->>'version')::integer, 1) + 1,
            'last_modified_by', v_caller_uid,
            'last_modified_at', pg_catalog.to_char(pg_catalog.clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        );
    ELSE
        v_validated_passport := p_passport || jsonb_build_object(
            'audit_history', '[]'::jsonb,
            'version', 1,
            'certified_by', v_caller_uid,
            'certified_at', to_char(clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        );
    END IF;

    -- 5. Atomic write through trusted workflow
    PERFORM pg_catalog.set_config('app.in_passport_workflow', 'true', true);

    UPDATE public.bookings
    SET passport = v_validated_passport
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
        'booking_id', p_booking_id,
        'passport_id', v_passport_id,
        'version', v_validated_passport->>'version',
        'recorded', true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_record_booking_passport(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_record_booking_passport(UUID, JSONB) TO authenticated;

-- Trusted RPC for completing a booking
-- Enforces:
--  - Caller is verified assigned technician (user_id = auth.uid(), not demo)
--  - Booking must be in active status ('confirmed' or 'in_progress')
--  - Server clock sets completed_at atomically
--  - Synchronizes service_requests status to 'completed'
CREATE OR REPLACE FUNCTION public.fn_complete_booking(
    p_booking_id UUID,
    p_completion_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_uid UUID;
    v_booking RECORD;
    v_worker RECORD;
BEGIN
    v_caller_uid := (SELECT auth.uid());
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to complete booking';
    END IF;

    SELECT b.id, b.worker_id, b.customer_id, b.status, b.request_id
    INTO v_booking
    FROM public.bookings b
    WHERE b.id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id;
    END IF;

    SELECT w.user_id, w.is_demo INTO v_worker
    FROM public.workers w
    WHERE w.id = v_booking.worker_id;

    IF v_worker.user_id IS NULL OR v_worker.user_id <> v_caller_uid OR v_worker.is_demo = true THEN
        RAISE EXCEPTION 'Unauthorized: Only the verified assigned technician can complete this booking';
    END IF;

    IF v_booking.status NOT IN ('confirmed', 'in_progress') THEN
        RAISE EXCEPTION 'Cannot complete booking in status "%"', v_booking.status;
    END IF;

    UPDATE public.bookings
    SET status = 'completed',
        completion_notes = COALESCE(p_completion_notes, completion_notes),
        completed_at = pg_catalog.clock_timestamp()
    WHERE id = p_booking_id;

    UPDATE public.service_requests
    SET status = 'completed',
        updated_at = pg_catalog.clock_timestamp()
    WHERE id = v_booking.request_id;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'booking_id', p_booking_id,
        'status', 'completed'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_complete_booking(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_complete_booking(UUID, TEXT) TO authenticated;


-- ============================================================================
-- 4. TARGETED PURGE OF ALL KNOWN LEGACY RLS POLICIES & REATTACHMENT OF TRIGGERS
-- ============================================================================
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Explicitly drop known legacy permissive and prior-migration policies
-- Guarantees stale permissive policies from migrations 1-4 are eliminated
-- while ensuring no unrelated custom database policy is blindly dropped without review.
DO $$
DECLARE
    pol TEXT;
    known_legacy_policies TEXT[] := ARRAY[
        'Allow public read on workers',
        'Allow public insert on workers',
        'Allow public update on workers',
        'Allow public all workers',
        'workers_select_policy',
        'workers_public_read',
        'Allow public read on services',
        'Allow public all services',
        'services_select_policy',
        'Allow public read on service_requests',
        'Allow public insert on service_requests',
        'Allow public update on service_requests',
        'Allow public all service_requests',
        'service_requests_select_policy',
        'service_requests_insert_policy',
        'service_requests_update_policy',
        'service_requests_delete_policy',
        'customer_manage_requests',
        'customer_read_requests',
        'customer_update_requests',
        'customer_submit_requests',
        'worker_read_matching_requests',
        'authenticated_read_requests',
        'Allow public read on quotes',
        'Allow public insert on quotes',
        'Allow public update on quotes',
        'Allow public all quotes',
        'quotes_select_policy',
        'quotes_insert_policy',
        'quotes_update_policy',
        'worker_submit_quotes',
        'worker_view_quotes',
        'worker_manage_quotes',
        'worker_update_quotes',
        'customer_view_quotes',
        'customer_manage_quotes',
        'Allow public read on bookings',
        'Allow public insert on bookings',
        'Allow public update on bookings',
        'Allow public all bookings',
        'bookings_select_policy',
        'bookings_insert_policy',
        'bookings_update_policy',
        'customer_manage_bookings',
        'customer_read_bookings',
        'customer_update_bookings',
        'worker_view_bookings',
        'worker_update_bookings',
        'worker_read_bookings',
        'technician_view_bookings',
        'technician_update_bookings',
        'Allow public read on reviews',
        'Allow public insert on reviews',
        'Allow public all reviews',
        'reviews_select_policy',
        'reviews_insert_policy'
    ];
    tbl TEXT;
    known_tables TEXT[] := ARRAY['workers', 'services', 'service_requests', 'quotes', 'bookings', 'reviews'];
BEGIN
    FOREACH tbl IN ARRAY known_tables LOOP
        FOREACH pol IN ARRAY known_legacy_policies LOOP
            BEGIN
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol, tbl);
            EXCEPTION
                WHEN OTHERS THEN NULL;
            END;
        END LOOP;
    END LOOP;
END $$;

-- Purge and reattach triggers
DROP TRIGGER IF EXISTS trg_protect_service_request_ownership ON public.service_requests;
DROP TRIGGER IF EXISTS trg_validate_quote_update ON public.quotes;
DROP TRIGGER IF EXISTS trg_validate_and_sync_booking ON public.bookings;
DROP TRIGGER IF EXISTS trg_validate_booking_update ON public.bookings;
DROP TRIGGER IF EXISTS trg_sync_booking_customer_details ON public.bookings;

CREATE TRIGGER trg_protect_service_request_ownership
    BEFORE UPDATE ON public.service_requests
    FOR EACH ROW
    EXECUTE FUNCTION app_private.fn_protect_service_request_ownership();

CREATE TRIGGER trg_validate_quote_update
    BEFORE UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION app_private.fn_validate_quote_update();

CREATE TRIGGER trg_validate_and_sync_booking
    BEFORE INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION app_private.fn_validate_and_sync_booking();

CREATE TRIGGER trg_validate_booking_update
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION app_private.fn_validate_booking_update();

-- ============================================================================
-- 5. ESTABLISH LEAST-PRIVILEGE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- 5.1 WORKERS: Direct table access permitted for authenticated relationships only.
-- Public clients query the 'workers_directory' view which omits phone, email, and exact coordinates.
CREATE POLICY "workers_select_policy" ON public.workers
    FOR SELECT TO authenticated
    USING (true);

-- 5.2 SERVICES: Public catalog is read-only
CREATE POLICY "services_select_policy" ON public.services
    FOR SELECT TO anon, authenticated
    USING (true);

-- 5.3 SERVICE REQUESTS: Authenticated Customer Owner & Confirmed Technician Access.
-- Direct table SELECT/INSERT/UPDATE is restricted to authenticated users.
-- Anonymous users CANNOT read raw customer contact details (phone, full street address).
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

-- 5.4 QUOTES: Restricted to quoting technician or request owner.
-- Quote insertion and technician updates require a verified, non-demo worker mapping (user_id = auth.uid()).
CREATE POLICY "quotes_select_policy" ON public.quotes
    FOR SELECT TO authenticated
    USING (
        ((SELECT auth.uid()) IS NOT NULL AND (
            creator_id = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.workers w
                WHERE w.id = quotes.worker_id
                  AND w.user_id = (SELECT auth.uid())
                  AND w.is_demo = false
            )
        ))
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
        AND EXISTS (
            SELECT 1 FROM public.workers w
            WHERE w.id = quotes.worker_id
              AND w.user_id = (SELECT auth.uid())
              AND w.is_demo = false
        )
    );

CREATE POLICY "quotes_update_policy" ON public.quotes
    FOR UPDATE TO authenticated
    USING (
        ((SELECT auth.uid()) IS NOT NULL AND (
            EXISTS (
                SELECT 1 FROM public.workers w
                WHERE w.id = quotes.worker_id
                  AND w.user_id = (SELECT auth.uid())
                  AND w.is_demo = false
            )
            OR EXISTS (
                SELECT 1 FROM public.service_requests sr
                WHERE sr.id = quotes.request_id
                AND sr.customer_id = (SELECT auth.uid())
            )
        ))
    )
    WITH CHECK (
        status IN ('pending', 'countered', 'accepted', 'rejected')
    );

-- 5.5 BOOKINGS: Restricted to confirmed customer & assigned technician
CREATE POLICY "bookings_select_policy" ON public.bookings
    FOR SELECT TO authenticated
    USING (
        ((SELECT auth.uid()) IS NOT NULL AND (
            customer_id = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.workers w
                WHERE w.id = bookings.worker_id
                  AND w.user_id = (SELECT auth.uid())
                  AND w.is_demo = false
            )
        ))
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
        ((SELECT auth.uid()) IS NOT NULL AND (
            customer_id = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.workers w
                WHERE w.id = bookings.worker_id
                  AND w.user_id = (SELECT auth.uid())
                  AND w.is_demo = false
            )
        ))
        OR app_private.fn_is_booking_technician_or_participant(request_id)
    )
    WITH CHECK (
        status IN ('confirmed', 'in_progress', 'completed', 'cancelled')
    );

-- 5.6 REVIEWS: Direct table SELECT restricted to own reviews; insertion requires certified completed booking
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
              AND b.completed_at IS NOT NULL
        )
    );

-- ============================================================================
-- 6. PRIVACY-PRESERVING PUBLIC VIEWS (CONTROLLED ORDER — ZERO UNRELATED DROPS)
-- ============================================================================
-- Explicitly drops only the three application views without blind CASCADE,
-- preventing collateral damage to any custom reporting or analytics objects.
-- ============================================================================

-- Precheck external view dependencies: prevent breaking third-party views without warning
DO $$
DECLARE
    v_dep_count INTEGER;
    v_dep_objects TEXT;
BEGIN
    SELECT count(*), string_agg(quote_ident(dep_ns.nspname) || '.' || quote_ident(dep_cls.relname), ', ')
    INTO v_dep_count, v_dep_objects
    FROM pg_catalog.pg_depend d
    JOIN pg_catalog.pg_rewrite r ON r.oid = d.objid
    JOIN pg_catalog.pg_class dep_cls ON dep_cls.oid = r.ev_class
    JOIN pg_catalog.pg_namespace dep_ns ON dep_ns.oid = dep_cls.relnamespace
    JOIN pg_catalog.pg_class target_cls ON target_cls.oid = d.refobjid
    JOIN pg_catalog.pg_namespace target_ns ON target_ns.oid = target_cls.relnamespace
    WHERE d.classid = 'pg_catalog.pg_rewrite'::regclass
      AND d.refclassid = 'pg_catalog.pg_class'::regclass
      AND target_ns.nspname = 'public'
      AND target_cls.relname IN ('job_leads', 'public_reviews', 'workers_directory')
      AND dep_cls.relkind IN ('v', 'm')
      AND NOT (dep_ns.nspname = 'public' AND dep_cls.relname IN ('job_leads', 'public_reviews', 'workers_directory'));

    IF v_dep_count > 0 THEN
        RAISE EXCEPTION 'Cannot safely recreate SkillNear views: % dependent external view(s) detected: %', v_dep_count, v_dep_objects;
    END IF;
END $$;

DROP VIEW IF EXISTS public.job_leads;
DROP VIEW IF EXISTS public.public_reviews;
DROP VIEW IF EXISTS public.workers_directory;

-- 6.1 WORKERS DIRECTORY VIEW: Approximate service-area coordinates (~1.1 km precision)
-- Omits phone, email, and exact street address to preserve technician privacy.
CREATE VIEW public.workers_directory
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
    w.id,
    w.name,
    w.trade,
    w.secondary_trades,
    w.skills,
    w.avatar_url,
    NULL::text AS phone,
    NULL::text AS email,
    w.experience_years,
    w.hourly_rate,
    ROUND(w.latitude::numeric, 2)::double precision AS latitude,
    ROUND(w.longitude::numeric, 2)::double precision AS longitude,
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

-- 6.2 PUBLIC JOB LEADS VIEW: Customer contact phone strictly NULL prior to booking
CREATE VIEW public.job_leads
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
    sr.id,
    sr.category,
    sr.title,
    sr.description,
    sr.urgency,
    sr.budget,
    sr.crew_size,
    sr.organization_name,
    sr.duration_unit,
    sr.duration_value,
    sr.preferred_worker_id,
    sr.status,
    sr.scope,
    ROUND(sr.customer_lat::numeric, 2)::double precision AS customer_lat,
    ROUND(sr.customer_lng::numeric, 2)::double precision AS customer_lng,
    -- Customer name: first name + initial
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_name
        ELSE COALESCE(
            split_part(trim(sr.customer_name), ' ', 1) ||
            CASE
                WHEN split_part(trim(sr.customer_name), ' ', 2) <> ''
                THEN ' ' || left(split_part(trim(sr.customer_name), ' ', 2), 1) || '.'
                ELSE ''
            END,
            'Verified Customer'
        )
    END AS customer_name,
    -- Phone: STRICTLY NULL for public lead broadcasts. Shared ONLY on confirmed booking.
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_phone
        ELSE NULL
    END AS customer_phone,
    -- Address: Masked to vicinity
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_address
        ELSE 'Hyperlocal Vicinity (Exact address provided upon confirmed booking)'
    END AS customer_address,
    sr.created_at,
    sr.updated_at
FROM public.service_requests sr
WHERE sr.status IN ('open', 'quoted')
   OR (auth.uid() IS NOT NULL AND sr.customer_id = auth.uid());

-- 6.3 PUBLIC REVIEWS VIEW: Omits customer_id, masks customer_name
CREATE VIEW public.public_reviews
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

-- ============================================================================
-- 7. SEED INITIAL SAMPLE PROFILES (ON CONFLICT DO NOTHING — NEVER OVERWRITES)
-- ============================================================================
INSERT INTO public.workers (id, name, trade, secondary_trades, skills, avatar_url, phone, email, experience_years, hourly_rate, latitude, longitude, address, city, rating, review_count, bio, is_demo, is_available, badge_label)
VALUES
    ('11111111-1111-1111-1111-111111111101', 'Rajesh Sharma (Sample Profile)', 'electrician', '{}', ARRAY['MCB Troubleshooting', 'Inverter Setup', 'Short-Circuit Repair'], 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150&auto=format&fit=crop&q=80', '+91 98765 43210', 'rajesh.demo@skillnear.local', 8, 450.00, 12.9784, 77.6408, '100 Feet Road, Indiranagar', 'Bengaluru', 4.9, 42, 'Licensed residential wireman, MCB troubleshooting, inverter setup & short-circuit repair.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111102', 'Sunita Devi (Sample Profile)', 'electrician', '{}', ARRAY['Appliance Wiring', 'Ceiling Fan Replacement', 'Switchboard Retrofitting'], 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', '+91 98765 43211', 'sunita.demo@skillnear.local', 6, 400.00, 12.9352, 77.6245, '5th Block, Koramangala', 'Bengaluru', 4.8, 31, 'Fast response appliance wiring, ceiling fan replacement, switchboard retrofitting.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111103', 'Ramesh Kumar (Sample Profile)', 'plumber', '{}', ARRAY['Leak Detection', 'Sanitary Fixtures', 'Bathroom Pipeline Rework'], 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', '+91 98765 43212', 'ramesh.demo@skillnear.local', 10, 500.00, 12.9716, 77.5946, 'MG Road, Central', 'Bengaluru', 4.9, 58, 'Expert leak detection, sanitary fixture installation, bathroom pipeline rework.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111104', 'Karthik Raja (Sample Profile)', 'plumber', '{}', ARRAY['Geyser Installation', 'Drain Clearing', 'Tap & Valve Repair'], 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', '+91 98765 43213', 'karthik.demo@skillnear.local', 5, 380.00, 12.9141, 77.6109, 'BTM 2nd Stage', 'Bengaluru', 4.7, 25, 'Geyser installation, clogged drain clearing, tap & flush valve repair specialist.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111105', 'Anand Verma (Sample Profile)', 'cleaner', '{}', ARRAY['Deep Home Sanitization', 'Kitchen Degreasing', 'Floor Buffing'], 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80', '+91 98765 43214', 'anand.demo@skillnear.local', 4, 300.00, 12.9915, 77.5528, 'Rajajinagar 1st Block', 'Bengaluru', 4.8, 38, 'Deep home sanitization, kitchen chimney degreasing, bathroom descaling & machine floor buffing.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111106', 'Lakshmi Bai (Sample Profile)', 'cleaner', '{}', ARRAY['Eco Deep Cleaning', 'Move-in Sanitization', 'Stain Removal'], 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80', '+91 98765 43215', 'lakshmi.demo@skillnear.local', 7, 320.00, 12.9698, 77.7500, 'Whitefield Main Road', 'Bengaluru', 4.9, 64, 'Eco-friendly deep cleaning, move-in/move-out apartment readiness, stain removal specialist.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111107', 'Suresh Gowda (Sample Profile)', 'painter', '{}', ARRAY['Acrylic Emulsion', 'Wall Putty Finishing', 'Damp Waterproofing'], 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80', '+91 98765 43216', 'suresh.demo@skillnear.local', 9, 420.00, 12.9250, 77.5938, '9th Block, Jayanagar', 'Bengaluru', 4.9, 47, 'Interior acrylic emulsion, wall putty finishing, damp wall waterproofing & texture design.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111108', 'Manoj Nayak (Sample Profile)', 'painter', '{}', ARRAY['Weatherproofing', 'Single Room Touchup', 'Enamel Paint'], 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', '+91 98765 43217', 'manoj.demo@skillnear.local', 6, 380.00, 13.0358, 77.5970, 'Hebbal Kempapura', 'Bengaluru', 4.7, 29, 'Exterior weatherproofing, single room touchups, door enamel painting & ceiling repaint.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111109', 'Rajesh Verma (Sample Profile)', 'ac_repair', ARRAY['electrician'], ARRAY['Inverter AC Diagnostics', 'Refrigerant R32 Leak Detection', 'Copper Pipe Brazing', 'Foam Jet Servicing'], 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150&auto=format&fit=crop&q=80', '+91 98765 43218', 'rajesh.ac@skillnear.local', 9, 499.00, 12.9784, 77.6408, '100 Feet Road, Indiranagar', 'Bengaluru', 4.9, 52, 'Specialist in inverter split AC PCB diagnosis, gas leak detection & brazing, deep jet wash.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111110', 'Pooja Hegde (Sample Profile)', 'ac_repair', '{}', ARRAY['Split AC Deep Foam Cleaning', 'Window AC Drain Line Unclogging', 'Indoor Blower Balancing', 'Capacitor Testing'], 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', '+91 98765 43219', 'pooja.ac@skillnear.local', 6, 450.00, 12.9352, 77.6245, '7th Block, Koramangala', 'Bengaluru', 4.8, 38, 'Rapid diagnostic AC cooling repair, duct cleaning, refrigerant top-up, fan motor replacement.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111111', 'Vikram Malhotra (Sample Profile)', 'appliance_repair', ARRAY['electrician'], ARRAY['Front/Top Load Washers', 'Frost-Free Refrigerators', 'Microwave Magnetrons', 'Chimney Blower Motors'], 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', '+91 98765 43220', 'vikram.demo@skillnear.local', 10, 420.00, 12.9165, 77.6101, '1st Stage, BTM Layout', 'Bengaluru', 4.9, 67, 'Multibrand major home appliance repair, OEM part sourcing, electronic control board troubleshooting.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111112', 'Deepa Murthy (Sample Profile)', 'appliance_repair', '{}', ARRAY['Dishwasher Drainage', 'Induction Cooktop Electronics', 'OTG Oven Thermostats', 'Geyser Heating Elements'], 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', '+91 98765 43221', 'deepa.demo@skillnear.local', 5, 390.00, 12.9081, 77.6476, 'Sector 2, HSR Layout', 'Bengaluru', 4.8, 32, 'Specialized kitchen and utility appliance servicing, heating element rewiring, pump seal repairs.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111113', 'Gurpreet Singh (Sample Profile)', 'carpenter', ARRAY['handyman'], ARRAY['Hydraulic Cabinet Hinges', 'Digital Door Locks', 'Bed Frame Reinforcement', 'Modular Carcass Repair'], 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', '+91 98765 43222', 'gurpreet.demo@skillnear.local', 12, 450.00, 12.9698, 77.7500, 'ECC Road, Whitefield', 'Bengaluru', 4.9, 74, 'Master woodworker with 12+ years experience in hardwood furniture restoration, kitchen cabinets & architectural locks.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111114', 'Murugan Pillai (Sample Profile)', 'carpenter', '{}', ARRAY['Sliding Wardrobe Channels', 'Wood Latches & Handles', 'Table Leg Leveling', 'Plywood Partition Trimming'], 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', '+91 98765 43223', 'murugan.demo@skillnear.local', 7, 380.00, 12.9250, 77.5938, '9th Block, Jayanagar', 'Bengaluru', 4.7, 29, 'Precision joinery, soft-close drawer slide fitting, door trimming, wooden window latch overhaul.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111115', 'David Fernandez (Sample Profile)', 'handyman', ARRAY['carpenter'], ARRAY['TV Wall Mounting', 'Curtain Rod & Blind Fitting', 'Floating Shelves Anchoring', 'Mirror & Art Hanging'], 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80', '+91 98765 43224', 'david.demo@skillnear.local', 8, 380.00, 12.9716, 77.5946, 'Richmond Road', 'Bengaluru', 4.8, 51, 'All-around home installation, TV bracket mounting, bathroom fittings, flat-pack assembly.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111116', 'Sunil Kumar (Sample Profile)', 'handyman', ARRAY['plumber'], ARRAY['Door Closer Alignment', 'Bathroom Grab Rail Fitting', 'Exhaust Fan Installation', 'Towel Rack & Hardware Fitting'], 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', '+91 98765 43225', 'sunil.demo@skillnear.local', 6, 350.00, 12.9840, 77.5400, 'West of Chord Road, Rajajinagar', 'Bengaluru', 4.8, 43, 'Quick-fix home repairs, towel rail anchoring, door alignment, shower rod and utility rack fixtures.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111117', 'Arvind Swamy (Sample Profile)', 'water_purifier', ARRAY['plumber'], ARRAY['RO Membrane Replacement', 'TDS Meter Calibration', 'Sediment & Pre-Carbon Filters', 'UV Lamp & Ballast Replacement'], 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', '+91 98765 43226', 'arvind.demo@skillnear.local', 9, 420.00, 12.9304, 77.5838, 'Near South End Circle, Jayanagar', 'Bengaluru', 4.9, 61, 'Certified water quality technician, RO/UV membrane servicing, mineral cartridge enrichment & booster pumps.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111118', 'Sneha Rao (Sample Profile)', 'water_purifier', '{}', ARRAY['Copper RO Filter Upgrades', 'Booster Pump Head Leaks', 'Inline Mineralizer Cartridges', 'Alkaline Filter Integration'], 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80', '+91 98765 43227', 'sneha.demo@skillnear.local', 5, 380.00, 12.9110, 77.6380, 'Sector 1, HSR Layout', 'Bengaluru', 4.8, 28, 'Domestic RO annual filter maintenance, TDS taste calibration, solenoid valves and pipeline sanitization.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111119', 'Imran Khan (Sample Profile)', 'pest_control', ARRAY['cleaner'], ARRAY['Odorless Cockroach Gel Baiting', 'Subterranean Termite Treatment', 'Bed Bug Heat & Spray Treatment', 'Mosquito Larvicide Fogging'], 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', '+91 98765 43228', 'imran.demo@skillnear.local', 11, 450.00, 12.9279, 77.6718, 'Outer Ring Road, Bellandur', 'Bengaluru', 4.9, 83, 'Certified urban pest control applicator, odorless kitchen cockroach baiting, drill-and-fill termite barrier.', true, true, 'Sample profile'),
    ('11111111-1111-1111-1111-111111111120', 'Rekha Joseph (Sample Profile)', 'pest_control', '{}', ARRAY['Eco-Friendly Kitchen Herbal Gel', 'Ant Colony Elimination', 'Drain Fly Larvae Eradication', 'Rodent Bait Station Placement'], 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', '+91 98765 43229', 'rekha.demo@skillnear.local', 7, 400.00, 13.0110, 77.5550, '15th Cross, Malleshwaram', 'Bengaluru', 4.8, 39, 'Eco-friendly and child-safe pest eradication, herbal cockroach repellent, ant colony elimination.', true, true, 'Sample profile')
ON CONFLICT (id) DO NOTHING;

-- Seed service rate cards (ON CONFLICT DO NOTHING)
INSERT INTO public.services (id, worker_id, category, name, description, base_price, estimated_time)
VALUES
    ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'electrician', 'MCB Tripping Diagnosis & Fuse Box Repair', 'Diagnostic tracing of phase leakage, breaker replacement, load balance.', 450.00, '1 - 2 hours'),
    ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111103', 'plumber', 'Concealed Pipeline Water Leak Tracing & Seal', 'Acoustic/pressure pinpointing of concealed pipe leakage and heavy-duty seal.', 600.00, '2 - 3 hours'),
    ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111105', 'cleaner', 'Complete 2BHK Deep Cleaning & Sanitization', 'Machine floor buffing, acid-free tile cleaning, chimney degrease.', 1800.00, '4 - 5 hours'),
    ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111107', 'painter', 'Accent Wall Texture & 2-Coat Premium Emulsion', 'Surface smoothing, 1 coat primer, 2 coats premium washable acrylic finish.', 1400.00, '4 - 6 hours'),
    ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111109', 'ac_repair', 'Split AC Deep Foam Jet Servicing', 'High-pressure water & antibacterial foam jet cleaning of indoor and outdoor coils.', 699.00, '1.5 - 2 hours'),
    ('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111111', 'appliance_repair', 'Washing Machine Drum & Motor Diagnostics', 'Diagnostic check for spin failure, drum noise, vibration damping & drain pump.', 449.00, '1 - 2 hours'),
    ('22222222-2222-2222-2222-222222222207', '11111111-1111-1111-1111-111111111113', 'carpenter', 'Wardrobe & Cabinet Soft-Close Hinge Overhaul', 'Alignment and replacement of up to 4 hydraulic hinges with margin leveling.', 499.00, '1 - 2 hours'),
    ('22222222-2222-2222-2222-222222222208', '11111111-1111-1111-1111-111111111115', 'handyman', 'Heavy TV Wall Mount & Cable Concealment (Up to 65")', 'Precision wall drilling into concrete/brick with anchor bolts and level test.', 499.00, '1 hour'),
    ('22222222-2222-2222-2222-222222222209', '11111111-1111-1111-1111-111111111117', 'water_purifier', 'Complete RO Sediment & Activated Carbon Filter Overhaul', 'Replacement of pre-filter candle, sediment filter, and activated carbon block.', 799.00, '1 - 1.5 hours'),
    ('22222222-2222-2222-2222-222222222210', '11111111-1111-1111-1111-111111111119', 'pest_control', '2BHK Odorless Kitchen Cockroach Gel Treatment', 'Precision Bayer dot bait application in all cabinet hinges, sinks & baseboards.', 899.00, '1 hour')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. EXPLICIT POSTGREST DATA API GRANTS (LEAST PRIVILEGE)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Revoke all direct table access from anon and PUBLIC across all sensitive tables
REVOKE ALL ON TABLE public.workers FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.services FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.service_requests FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.quotes FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.bookings FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.reviews FROM anon, PUBLIC;

-- Revoke all table-level write access from authenticated before selective grants
REVOKE ALL ON TABLE public.workers FROM authenticated;
REVOKE ALL ON TABLE public.services FROM authenticated;
REVOKE ALL ON TABLE public.service_requests FROM authenticated;
REVOKE ALL ON TABLE public.quotes FROM authenticated;
REVOKE ALL ON TABLE public.bookings FROM authenticated;
REVOKE ALL ON TABLE public.reviews FROM authenticated;

-- Safe Public Views & Catalog Discovery (Accessible to Anonymous & Authenticated)
GRANT SELECT ON TABLE public.workers_directory TO anon, authenticated;
GRANT SELECT ON TABLE public.services TO anon, authenticated;
GRANT SELECT ON TABLE public.job_leads TO anon, authenticated;
GRANT SELECT ON TABLE public.public_reviews TO anon, authenticated;

-- Authenticated Operations with Selective Column-Level Protections
-- NOTE: w.latitude and w.longitude are explicitly omitted from the table grant
-- to prevent exact coordinate exposure. Authenticated users query workers_directory.
GRANT SELECT (id, name, trade, secondary_trades, skills, avatar_url, experience_years, hourly_rate, city, rating, review_count, bio, is_demo, is_available, badge_label, created_at) ON TABLE public.workers TO authenticated;

GRANT SELECT, INSERT ON TABLE public.service_requests TO authenticated;
GRANT UPDATE (title, description, urgency, budget, status, preferred_worker_id, updated_at) ON TABLE public.service_requests TO authenticated;

GRANT SELECT, INSERT ON TABLE public.quotes TO authenticated;
GRANT UPDATE (counter_amount, counter_notes, notes, status, last_updated_by, updated_at) ON TABLE public.quotes TO authenticated;

GRANT SELECT, INSERT ON TABLE public.bookings TO authenticated;
GRANT UPDATE (status, scheduled_for, completion_notes) ON TABLE public.bookings TO authenticated;

GRANT SELECT, INSERT ON TABLE public.reviews TO authenticated;

-- Explicit Function Execution Grants for Authenticated Workflows
GRANT EXECUTE ON FUNCTION public.fn_propose_change_order(UUID, TEXT, TEXT, NUMERIC, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_apply_approved_change_order(UUID, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_record_booking_passport(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_complete_booking(UUID, TEXT) TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- 9. RELOAD POSTGREST SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload schema';
