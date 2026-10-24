-- ============================================================================
-- SkillNear (PS03): Corrective Migration 2 — Comprehensive Least-Privilege
-- Hardening, Column Backfills, Safe Directory & Review Views, Role-Specific
-- Quote & Price Integrity, Private Schema Isolation & RLS Security
-- ============================================================================
-- Migration: 20261024000002_secure_job_leads_view.sql
-- Applicable to: Existing Supabase PostgreSQL Database with 20261024000001 applied
-- ============================================================================
-- Security Architecture & Fixes:
--  1. Idempotent Column Additions & Foreign Key Constraints:
--     - Ensures service_requests.customer_id, bookings.customer_id, quotes.creator_id,
--       and reviews.customer_id exist with DEFAULT auth.uid().
--     - Adds foreign keys to auth.users(id) ON DELETE SET NULL idempotently.
--     - Preserves all existing seed/demo rows without rewriting or rerunning Migration 1.
--  2. Dedicated Private Schema ('app_private'):
--     - Unexposed to Supabase PostgREST Data API.
--     - USAGE granted strictly to 'authenticated' (revoked from PUBLIC and anon).
--     - Contains all security definer helper and validation trigger functions.
--  3. Complete Legacy Policy Purge:
--     - Drops every legacy permissive policy from Migration 1 across all 6 tables.
--     - Removes all 'customer_id IS NULL' bypasses from table RLS.
--  4. Privacy-Preserving Views:
--     - public.job_leads: Obfuscates coordinates to ~1.1 km, masks customer name to
--       first name + initial, sets customer_phone to NULL, masks address to vicinity,
--       and redacts phone numbers & email addresses from title & description.
--     - public.workers_directory: Safe directory view omitting worker phone, email,
--       and exact street address.
--     - public.public_reviews: Safe reviews view omitting customer_id and masking
--       customer_name to first name + initial.
--  5. Role-Specific Quote Permissions & Tampering Protection:
--     - Validates that customers cannot modify worker's original quote amount, notes,
--       estimated duration, or immutable identifiers.
--     - Customers can only counteroffer (status 'countered', counter_amount > 0)
--       or accept/reject.
--     - Quoting workers cannot accept their own quotes. Demo workers remain simulated.
--  6. Price Integrity Snapshot on Booking Creation:
--     - Enforces agreed_price must equal the accepted quote's effective agreed price
--       (COALESCE(counter_amount, amount)). Rejects mismatched or unaccepted quotes.
--  7. Booking Lifecycle & Review Protection:
--     - Customers cannot mark bookings in_progress or completed to unlock reviews.
--     - Only assigned technicians can transition bookings to completed.
--  8. Strict PostgREST Data API Grants:
--     - Anon role: SELECT only on workers_directory, services, job_leads, and public_reviews.
--       ZERO access to raw workers, reviews, service_requests, quotes, or bookings.
--     - Authenticated role: Least-privilege table grants with column-level UPDATE restrictions.
-- ============================================================================

-- ============================================================================
-- 1. IDEMPOTENT COLUMN ADDITIONS & FOREIGN KEY CONSTRAINTS TO auth.users
-- ============================================================================
DO $$
BEGIN
    -- 1.1 Ensure ownership columns exist with safe auth.uid() defaults
    ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();
    ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS creator_id UUID DEFAULT auth.uid();
    ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS customer_id UUID DEFAULT auth.uid();

    -- 1.2 Add foreign keys to auth.users(id) ON DELETE SET NULL idempotently
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
-- 2. DEDICATED PRIVATE SCHEMA (NOT EXPOSED TO DATA API)
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS app_private;

-- Clean up any legacy helper definitions in public schema
DROP FUNCTION IF EXISTS public.fn_is_booking_technician_or_participant(UUID);
DROP FUNCTION IF EXISTS public.fn_sync_booking_customer_details();

-- Restrict schema permissions: Only authenticated role receives USAGE for RLS execution
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;

-- ============================================================================
-- 3. REMOVE ALL LEGACY PERMISSIVE POLICIES FROM MIGRATION 1
-- ============================================================================
-- 3.1 Workers
DROP POLICY IF EXISTS "Allow public read on workers" ON public.workers;
DROP POLICY IF EXISTS "Allow public insert on workers" ON public.workers;
DROP POLICY IF EXISTS "Allow public update on workers" ON public.workers;
DROP POLICY IF EXISTS "Allow public all workers" ON public.workers;
DROP POLICY IF EXISTS "workers_select_policy" ON public.workers;

-- 3.2 Services
DROP POLICY IF EXISTS "Allow public read on services" ON public.services;
DROP POLICY IF EXISTS "Allow public insert on services" ON public.services;
DROP POLICY IF EXISTS "Allow public all services" ON public.services;
DROP POLICY IF EXISTS "services_select_policy" ON public.services;

-- 3.3 Service Requests
DROP POLICY IF EXISTS "Allow public read on service_requests" ON public.service_requests;
DROP POLICY IF EXISTS "Allow public insert on service_requests" ON public.service_requests;
DROP POLICY IF EXISTS "Allow public update on service_requests" ON public.service_requests;
DROP POLICY IF EXISTS "Allow public all requests" ON public.service_requests;
DROP POLICY IF EXISTS "service_requests_select_policy" ON public.service_requests;
DROP POLICY IF EXISTS "service_requests_insert_policy" ON public.service_requests;
DROP POLICY IF EXISTS "service_requests_update_policy" ON public.service_requests;

-- 3.4 Quotes
DROP POLICY IF EXISTS "Allow public read on quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow public insert on quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow public update on quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow public all quotes" ON public.quotes;
DROP POLICY IF EXISTS "quotes_select_policy" ON public.quotes;
DROP POLICY IF EXISTS "quotes_insert_policy" ON public.quotes;
DROP POLICY IF EXISTS "quotes_update_policy" ON public.quotes;

-- 3.5 Bookings
DROP POLICY IF EXISTS "Allow public read on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow public insert on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow public update on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow public all bookings" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_policy" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_policy" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_policy" ON public.bookings;

-- 3.6 Reviews
DROP POLICY IF EXISTS "Allow public read on reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow public insert on reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow public all reviews" ON public.reviews;
DROP POLICY IF EXISTS "reviews_select_policy" ON public.reviews;
DROP POLICY IF EXISTS "reviews_insert_policy" ON public.reviews;

-- ============================================================================
-- 4. PRIVACY-PRESERVING SAFE PUBLIC VIEWS
-- ============================================================================

-- 4.1 Privacy-Preserving Job Leads View (with Phone/Email Redaction from Title/Description)
CREATE OR REPLACE VIEW public.job_leads
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
    sr.id,
    sr.category,
    -- Redact telephone numbers and email patterns from title for non-owners
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.title
        ELSE regexp_replace(
            regexp_replace(sr.title, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contact redacted]', 'g'),
            '(\+?[0-9]{1,3}[-.\s]*)?(\b[6-9]\d{9}\b|\b\d{5}[-.\s]\d{5}\b|\b\d{3,4}[-.\s]\d{3,4}[-.\s]\d{3,4}\b)',
            '[contact redacted]',
            'g'
        )
    END AS title,
    -- Redact telephone numbers and email patterns from description for non-owners
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
    -- Coarse coordinates: Obfuscate to 2 decimal places (~1.1 km neighborhood resolution)
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_lat
        ELSE round(sr.customer_lat::numeric, 2)::double precision
    END AS customer_lat,
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_lng
        ELSE round(sr.customer_lng::numeric, 2)::double precision
    END AS customer_lng,
    -- Masked customer name: First name + initial only
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
    -- Phone number: STRICTLY NULL in public feed. Never exposed prior to confirmed booking.
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_phone
        ELSE NULL
    END AS customer_phone,
    -- Address: Mask full door/street address to generalized vicinity
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_address
        ELSE 'Hyperlocal Vicinity (Exact address provided upon confirmed booking)'
    END AS customer_address,
    sr.created_at,
    sr.updated_at
FROM public.service_requests sr
WHERE sr.status IN ('open', 'quoted')
   OR (auth.uid() IS NOT NULL AND sr.customer_id = auth.uid());

-- 4.2 Safe Workers Directory View (Omits worker phone, email, and exact street)
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

-- 4.3 Safe Public Reviews View (Omits customer_id, masks customer_name)
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

-- ============================================================================
-- 5. SECURITY FUNCTIONS & TRIGGERS IN PRIVATE SCHEMA
-- ============================================================================

-- 5.1 RLS Helper: Verified Booking Participant Check
-- Verifies caller's auth.uid() against customer ownership or quoting technician identity.
-- Unauthenticated callers or demo workers without an authenticated identity return FALSE.
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

-- 5.2 Service Request Ownership & Coordinates Protection Trigger
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

-- 5.3 Role-Specific Quote Permissions & Tampering Protection Trigger
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

    -- Immutable identifiers
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

    -- Fetch request customer_id
    SELECT customer_id INTO v_req_customer_id
    FROM public.service_requests
    WHERE id = OLD.request_id;

    -- Determine caller role
    IF v_req_customer_id IS NOT NULL AND v_caller_uid = v_req_customer_id THEN
        -- Caller is CUSTOMER
        -- Customer CANNOT tamper with worker original proposal
        IF NEW.amount <> OLD.amount THEN
            RAISE EXCEPTION 'Customer cannot modify worker original quote amount';
        END IF;
        IF NEW.notes IS DISTINCT FROM OLD.notes THEN
            RAISE EXCEPTION 'Customer cannot modify worker quote notes';
        END IF;
        IF NEW.estimated_duration <> OLD.estimated_duration THEN
            RAISE EXCEPTION 'Customer cannot modify worker estimated duration';
        END IF;

        -- Customer must mark last_updated_by = 'customer'
        NEW.last_updated_by := 'customer';

        -- Validate customer status transitions
        IF NEW.status NOT IN ('countered', 'accepted', 'rejected', 'pending') THEN
            RAISE EXCEPTION 'Invalid quote status for customer action: %', NEW.status;
        END IF;

        -- If customer is countering, require positive counter_amount
        IF NEW.status = 'countered' THEN
            IF NEW.counter_amount IS NULL OR NEW.counter_amount <= 0 THEN
                RAISE EXCEPTION 'Counteroffer requires a valid counter_amount greater than zero';
            END IF;
        END IF;

        -- If customer is accepting, do not allow simultaneous modification of counter_amount
        IF NEW.status = 'accepted' THEN
            IF NEW.counter_amount IS DISTINCT FROM OLD.counter_amount THEN
                RAISE EXCEPTION 'Cannot modify counter_amount during quote acceptance';
            END IF;
        END IF;

    ELSIF OLD.creator_id IS NOT NULL AND v_caller_uid = OLD.creator_id THEN
        -- Caller is WORKER
        -- Worker CANNOT accept their own quote
        IF NEW.status = 'accepted' THEN
            RAISE EXCEPTION 'Only the customer can accept a quote';
        END IF;

        NEW.last_updated_by := 'worker';

        -- If worker is countering, counter_amount must be valid
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

-- 5.4 Booking Creation Validation, Price Integrity & Details Synchronization Trigger
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

    -- Ensure booking customer_id matches caller
    IF NEW.customer_id IS NULL OR NEW.customer_id <> v_caller_uid THEN
        RAISE EXCEPTION 'Booking customer_id must match authenticated caller';
    END IF;

    -- Verify request exists and belongs to caller
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

    -- Verify quote matches request, worker, and is accepted
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

    -- Price Integrity: Enforce that agreed_price equals effective accepted quote amount
    -- (COALESCE(counter_amount, amount))
    v_effective_agreed_price := COALESCE(v_quote.counter_amount, v_quote.amount);

    IF v_effective_agreed_price IS NULL OR v_effective_agreed_price <= 0 THEN
        RAISE EXCEPTION 'Effective agreed price from quote is invalid';
    END IF;

    IF NEW.agreed_price <> v_effective_agreed_price THEN
        RAISE EXCEPTION 'Booking agreed_price (%) must match accepted quote effective price (%)',
            NEW.agreed_price, v_effective_agreed_price;
    END IF;

    -- Snapshot the verified effective agreed price
    NEW.agreed_price := v_effective_agreed_price;

    -- Securely populate verified customer details from the verified request
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

-- 5.5 Booking Immutability Protection Trigger
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

-- 5.6 Booking Status Transitions & Review Unlock Trigger
-- Enforces:
--  - Customers CANNOT mark bookings 'in_progress' or 'completed' to unlock reviews.
--  - Only assigned technicians can transition bookings to 'completed'.
--  - Demo workers remain in simulation mode.
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

    -- If status hasn't changed, allow non-status updates (e.g. notes)
    IF NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;

    -- Fetch quote creator (assigned technician)
    SELECT creator_id INTO v_quote_creator_id
    FROM public.quotes
    WHERE id = OLD.quote_id;

    -- Customer restrictions
    IF v_caller_uid = OLD.customer_id THEN
        -- Customers CANNOT mark in_progress or completed
        IF NEW.status IN ('in_progress', 'completed') THEN
            RAISE EXCEPTION 'Customers cannot mark bookings as in-progress or completed. Only the assigned technician can complete the work.';
        END IF;

        -- Customer can only cancel a confirmed booking
        IF NEW.status = 'cancelled' THEN
            IF OLD.status <> 'confirmed' THEN
                RAISE EXCEPTION 'Cannot cancel booking that is already %', OLD.status;
            END IF;
        ELSE
            RAISE EXCEPTION 'Invalid status transition by customer: % -> %', OLD.status, NEW.status;
        END IF;

    ELSIF v_quote_creator_id IS NOT NULL AND v_caller_uid = v_quote_creator_id THEN
        -- Technician transitions
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

-- ============================================================================
-- 6. LEAST-PRIVILEGE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- 6.1 Services: Public catalog is read-only (no writes)
CREATE POLICY "services_select_policy" ON public.services
    FOR SELECT TO anon, authenticated
    USING (true);

-- 6.2 Workers: Direct table SELECT permitted for authenticated relationships
CREATE POLICY "workers_select_policy" ON public.workers
    FOR SELECT TO authenticated
    USING (true);

-- 6.3 Service Requests: Authenticated customer ownership & confirmed technician
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

-- 6.4 Quotes: Ownership-aware bids and negotiations
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
    WITH CHECK (
        status IN ('pending', 'countered', 'accepted', 'rejected')
    );

-- 6.5 Bookings: Restricted to confirmed customer & assigned technician
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
    WITH CHECK (
        status IN ('confirmed', 'in_progress', 'completed', 'cancelled')
    );

-- 6.6 Reviews: Direct table SELECT restricted to own reviews; insert tied to completed bookings
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

-- ============================================================================
-- 7. EXPLICIT POSTGREST DATA API GRANTS (MINIMAL LEAST PRIVILEGE)
-- ============================================================================
-- 7.1 Schema USAGE
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 7.2 Revoke all table-level access from anon and PUBLIC across all tables
REVOKE ALL ON TABLE public.workers FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.services FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.service_requests FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.quotes FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.bookings FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.reviews FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.job_leads FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.workers_directory FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.public_reviews FROM anon, PUBLIC;

-- 7.3 Revoke all table-level write access from authenticated before selective grants
REVOKE ALL ON TABLE public.workers FROM authenticated;
REVOKE ALL ON TABLE public.services FROM authenticated;
REVOKE ALL ON TABLE public.service_requests FROM authenticated;
REVOKE ALL ON TABLE public.quotes FROM authenticated;
REVOKE ALL ON TABLE public.bookings FROM authenticated;
REVOKE ALL ON TABLE public.reviews FROM authenticated;
REVOKE ALL ON TABLE public.job_leads FROM authenticated;
REVOKE ALL ON TABLE public.workers_directory FROM authenticated;
REVOKE ALL ON TABLE public.public_reviews FROM authenticated;

-- 7.4 Safe Public Views & Catalog Discovery (Accessible to Anonymous & Authenticated)
GRANT SELECT ON TABLE public.workers_directory TO anon, authenticated;
GRANT SELECT ON TABLE public.services TO anon, authenticated;
GRANT SELECT ON TABLE public.job_leads TO anon, authenticated;
GRANT SELECT ON TABLE public.public_reviews TO anon, authenticated;

-- 7.5 Authenticated Operations with Selective Column-Level Protections
-- Raw workers: Column-level SELECT for relations (omits phone, email, and exact address)
GRANT SELECT (id, name, trade, avatar_url, experience_years, hourly_rate, latitude, longitude, city, rating, review_count, bio, is_demo, is_available, badge_label, created_at) ON TABLE public.workers TO authenticated;

-- Service Requests: Insert and query; update restricted to non-ownership fields
GRANT SELECT, INSERT ON TABLE public.service_requests TO authenticated;
GRANT UPDATE (title, description, urgency, budget, status, preferred_worker_id, updated_at) ON TABLE public.service_requests TO authenticated;

-- Quotes: Insert and query; update restricted to negotiation fields
GRANT SELECT, INSERT ON TABLE public.quotes TO authenticated;
GRANT UPDATE (counter_amount, counter_notes, notes, status, last_updated_by, updated_at) ON TABLE public.quotes TO authenticated;

-- Bookings: Insert and query; update restricted to status progression fields
GRANT SELECT, INSERT ON TABLE public.bookings TO authenticated;
GRANT UPDATE (status, scheduled_for, completion_notes, completed_at) ON TABLE public.bookings TO authenticated;

-- Reviews: Insert permitted for verified completed bookings
GRANT SELECT, INSERT ON TABLE public.reviews TO authenticated;

-- Sequences & Functions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- 8. RELOAD POSTGREST SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload schema';
