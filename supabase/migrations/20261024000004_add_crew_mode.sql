-- SkillNear (PS03): Crew Mode Database Extension
-- File: supabase/migrations/20261024000004_add_crew_mode.sql
-- Status: PREPARED FOR MIGRATION (UNAPPLIED REMOTELY)
-- DO NOT EXECUTE REMOTELY AUTOMATICALLY. Keep local application in safe simulation mode.

-- 1. EXTEND SERVICE REQUESTS TABLE FOR CREW SPECIFICATIONS
ALTER TABLE public.service_requests
    ADD COLUMN IF NOT EXISTS crew_size INTEGER DEFAULT 1 CHECK (crew_size >= 1 AND crew_size <= 20);

ALTER TABLE public.service_requests
    ADD COLUMN IF NOT EXISTS organization_name TEXT;

ALTER TABLE public.service_requests
    ADD COLUMN IF NOT EXISTS duration_unit TEXT DEFAULT 'hours' CHECK (duration_unit IN ('hours', 'days'));

ALTER TABLE public.service_requests
    ADD COLUMN IF NOT EXISTS duration_value INTEGER DEFAULT 2 CHECK (duration_value > 0);

-- 2. EXTEND QUOTES TABLE FOR TEAM OFFERS AND SUPERVISION
ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS offered_crew_size INTEGER DEFAULT 1 CHECK (offered_crew_size >= 1 AND offered_crew_size <= 20);

ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS supervisor_name TEXT;

-- 3. EXTEND BOOKINGS TABLE FOR CONFIRMED CREW ALLOCATION
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS crew_size INTEGER DEFAULT 1 CHECK (crew_size >= 1 AND crew_size <= 20);

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS organization_name TEXT;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS supervisor_name TEXT;

-- 4. UPDATE PUBLIC.JOB_LEADS VIEW TO SAFELY EXPOSE CREW REQUIREMENTS
-- Sanitizes customer contact details while broadcasting team requirements
CREATE OR REPLACE VIEW public.job_leads
WITH (security_invoker = true) AS
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
    sr.created_at,
    sr.updated_at,
    -- Sanitized customer display: first name + initial
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
    -- Strictly null phone for public broadcast
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_phone
        ELSE NULL::TEXT
    END AS customer_phone,
    -- Coarsened neighborhood location
    CASE
        WHEN auth.uid() IS NOT NULL AND sr.customer_id = auth.uid() THEN sr.customer_address
        ELSE 'Hyperlocal Vicinity (Exact address provided upon confirmed booking)'
    END AS customer_address,
    round(sr.customer_lat::numeric, 2)::double precision AS customer_lat,
    round(sr.customer_lng::numeric, 2)::double precision AS customer_lng
FROM public.service_requests sr
WHERE sr.status IN ('open', 'quoted');

-- 5. GRANTS FOR CREW SPECIFICATIONS
GRANT SELECT (id, category, title, description, urgency, budget, crew_size, organization_name, duration_unit, duration_value, preferred_worker_id, status, created_at, updated_at, customer_name, customer_phone, customer_address, customer_lat, customer_lng)
ON TABLE public.job_leads TO anon, authenticated;
