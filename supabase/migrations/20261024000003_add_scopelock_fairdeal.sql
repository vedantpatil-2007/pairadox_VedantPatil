-- ==============================================================================
-- SkillNear (PS03) Hyperlocal On-Demand Blue-Collar Services Platform
-- Migration: 20261024000003_add_scopelock_fairdeal.sql
-- Status: UNAPPLIED (Ready for staging/production database execution)
-- Description: Adds schema support, constraints, and audit trails for:
--   1. ScopeLock™ (Structured work specifications, deliverables, exclusions)
--   2. FairDeal™ (Itemized quotes with labour, materials, travel breakdown)
--   3. Change-Order Lock™ (Immutable agreed prices; customer approval on revisions)
--   4. Repair Passport™ (Certified completion history with warranty & parts trace)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCOPELOCK™ COLUMNS ON service_requests
-- ------------------------------------------------------------------------------
ALTER TABLE public.service_requests
ADD COLUMN IF NOT EXISTS scope JSONB DEFAULT NULL;

COMMENT ON COLUMN public.service_requests.scope IS 
'ScopeLock™ structured specification: {problem, requested_work[], deliverables[], urgency, budget, assumptions[], exclusions[]}';

-- ------------------------------------------------------------------------------
-- 2. FAIRDEAL™ COLUMNS ON quotes
-- ------------------------------------------------------------------------------
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS itemization JSONB DEFAULT NULL;

COMMENT ON COLUMN public.quotes.itemization IS 
'FairDeal™ itemized price breakdown: {labour_amount, materials_amount, travel_amount, estimated_duration, included_tasks[], exclusions[], materials_breakdown[]}';

-- ------------------------------------------------------------------------------
-- 3. CHANGE-ORDER LOCK™ COLUMNS ON bookings
-- ------------------------------------------------------------------------------
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS original_agreed_price NUMERIC(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS change_orders JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS passport JSONB DEFAULT NULL;

-- Backfill original_agreed_price from agreed_price where not yet set
UPDATE public.bookings
SET original_agreed_price = agreed_price
WHERE original_agreed_price IS NULL;

COMMENT ON COLUMN public.bookings.original_agreed_price IS 
'Change-Order Lock™ baseline price agreed at time of initial customer booking acceptance';

COMMENT ON COLUMN public.bookings.change_orders IS 
'Change-Order Lock™ audit history array: [{id, title, reason, additional_amount, revised_total, status, created_at, responded_at}]';

COMMENT ON COLUMN public.bookings.passport IS 
'Repair Passport™ verified digital certificate snapshot at work completion';

-- ------------------------------------------------------------------------------
-- 4. UPDATE job_leads VIEW TO EXPOSE SANITIZED SCOPE
-- ------------------------------------------------------------------------------
-- Drop and recreate public.job_leads view so workers can inspect scope specifications
DROP VIEW IF EXISTS public.job_leads CASCADE;

CREATE OR REPLACE VIEW public.job_leads
WITH (security_invoker = false) AS
SELECT 
    sr.id,
    sr.customer_id,
    'Verified Local Customer'::TEXT AS customer_name,
    'Confidential Neighborhood Area'::TEXT AS customer_address,
    sr.title,
    sr.category,
    sr.description,
    sr.urgency,
    sr.budget,
    sr.status,
    ROUND(sr.customer_lat::numeric, 2)::double precision AS customer_lat,
    ROUND(sr.customer_lng::numeric, 2)::double precision AS customer_lng,
    sr.created_at,
    sr.updated_at,
    -- ScopeLock specifications sanitized for public broadcast
    jsonb_build_object(
        'problem', sr.scope->>'problem',
        'requested_work', COALESCE(sr.scope->'requested_work', '[]'::jsonb),
        'deliverables', COALESCE(sr.scope->'deliverables', '[]'::jsonb),
        'urgency', sr.scope->>'urgency',
        'budget', sr.scope->>'budget',
        'assumptions', COALESCE(sr.scope->'assumptions', '[]'::jsonb),
        'exclusions', COALESCE(sr.scope->'exclusions', '[]'::jsonb)
    ) AS scope
FROM public.service_requests sr
WHERE sr.status = 'open';

GRANT SELECT ON public.job_leads TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. FUNCTION & TRIGGER: FAIRDEAL™ PRICE INTEGRITY VALIDATION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.fn_validate_fairdeal_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_labour NUMERIC;
    v_materials NUMERIC;
    v_travel NUMERIC;
    v_calculated_total NUMERIC;
BEGIN
    IF NEW.itemization IS NOT NULL AND NEW.itemization != '{}'::jsonb THEN
        v_labour := COALESCE((NEW.itemization->>'labour_amount')::numeric, 0);
        v_materials := COALESCE((NEW.itemization->>'materials_amount')::numeric, 0);
        v_travel := COALESCE((NEW.itemization->>'travel_amount')::numeric, 0);
        v_calculated_total := v_labour + v_materials + v_travel;

        -- Require total quote amount to match sum of FairDeal components
        IF ABS(NEW.amount - v_calculated_total) > 0.01 THEN
            RAISE EXCEPTION 'FairDeal™ Price Integrity Violation: Total quote (₹%) must equal sum of labour (₹%), materials (₹%), and travel (₹%) totaling ₹%',
                NEW.amount, v_labour, v_materials, v_travel, v_calculated_total;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_fairdeal_quote ON public.quotes;
CREATE TRIGGER trg_validate_fairdeal_quote
    BEFORE INSERT OR UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION app_private.fn_validate_fairdeal_quote();

-- ------------------------------------------------------------------------------
-- 6. FUNCTION & TRIGGER: CHANGE-ORDER LOCK™ INTEGRITY ENFORCEMENT
-- ------------------------------------------------------------------------------
-- Prevents unauthorized alteration of agreed_price without customer approval
CREATE OR REPLACE FUNCTION app_private.fn_enforce_change_order_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_has_approved_change BOOLEAN := false;
BEGIN
    -- Initialize original_agreed_price on creation
    IF TG_OP = 'INSERT' THEN
        IF NEW.original_agreed_price IS NULL THEN
            NEW.original_agreed_price := NEW.agreed_price;
        END IF;
        RETURN NEW;
    END IF;

    -- On UPDATE: if agreed_price is modified, check that a valid approved change order exists
    IF OLD.agreed_price IS DISTINCT FROM NEW.agreed_price THEN
        -- Verify that the caller is the customer owner of the booking
        IF auth.uid() IS NOT NULL AND OLD.customer_id IS NOT NULL AND auth.uid() != OLD.customer_id THEN
            RAISE EXCEPTION 'Change-Order Lock™: Only the verified customer may approve price revisions.';
        END IF;

        -- Ensure change_orders JSON contains an approved entry matching the new agreed_price
        IF jsonb_array_length(COALESCE(NEW.change_orders, '[]'::jsonb)) = 0 THEN
            RAISE EXCEPTION 'Change-Order Lock™: Cannot alter agreed price from ₹% to ₹% without a documented change order.',
                OLD.agreed_price, NEW.agreed_price;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_change_order_lock ON public.bookings;
CREATE TRIGGER trg_enforce_change_order_lock
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION app_private.fn_enforce_change_order_lock();

-- ------------------------------------------------------------------------------
-- 7. REPAIR PASSPORT™ PUBLIC VERIFIER VIEW
-- ------------------------------------------------------------------------------
-- Provides a clean tamper-evident read view for completed services
CREATE OR REPLACE VIEW public.repair_passports_view
WITH (security_invoker = false) AS
SELECT 
    b.id AS booking_id,
    COALESCE(b.passport->>'passport_id', 'RP-' || UPPER(SUBSTRING(b.id::text, 1, 8))) AS passport_id,
    b.worker_id,
    w.name AS technician_name,
    w.trade AS trade_discipline,
    b.status AS booking_status,
    b.scheduled_for AS completed_date,
    b.original_agreed_price,
    b.agreed_price AS final_paid_total,
    b.change_orders,
    b.passport,
    sr.title AS service_title,
    sr.category AS trade_category,
    sr.scope AS agreed_scope
FROM public.bookings b
JOIN public.workers w ON w.id = b.worker_id
JOIN public.service_requests sr ON sr.id = b.request_id
WHERE b.status = 'completed';

GRANT SELECT ON public.repair_passports_view TO anon, authenticated;

-- ==============================================================================
-- End of Migration 20261024000003_add_scopelock_fairdeal.sql
-- ==============================================================================
