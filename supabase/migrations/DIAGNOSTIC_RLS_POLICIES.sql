-- ============================================================================
-- SkillNear (PS03): Read-Only Diagnostic — Inspect Active RLS Policies
-- File: supabase/migrations/DIAGNOSTIC_RLS_POLICIES.sql
-- ============================================================================
-- PURPOSE:
--  Provides a non-destructive, read-only inspection query listing all active
--  Row Level Security (RLS) policies on the six core SkillNear tables.
--  Use this in the Supabase Dashboard -> SQL Editor before or after migrations
--  to verify that only intended policies are active and that no custom
--  reporting, analytics, or administrative policies have been disturbed.
-- ============================================================================

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'workers',
    'services',
    'service_requests',
    'quotes',
    'bookings',
    'reviews'
  )
ORDER BY tablename ASC, policyname ASC;
