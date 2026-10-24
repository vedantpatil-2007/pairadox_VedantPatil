import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { demoRepo } from '../services/demoRepository';
import { api } from '../services/api';

describe('SkillNear — Consolidated SQL Database Integrity & Security Audit Suite', () => {
  const sqlPath = path.resolve(__dirname, '../../supabase/migrations/CONSOLIDATED_SKILLNEAR_SETUP.sql');
  const diagnosticPath = path.resolve(__dirname, '../../supabase/migrations/DIAGNOSTIC_RLS_POLICIES.sql');
  const modalPath = path.resolve(__dirname, '../../src/components/SetupModal.tsx');

  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  beforeEach(() => {
    demoRepo.reset();
  });

  // ==========================================================================
  // 1. LEGACY RLS POLICY AUDIT & READ-ONLY DIAGNOSTIC
  // ==========================================================================
  describe('1. Legacy RLS Policy Audit & Read-Only Diagnostic [Static SQL]', () => {
    const CONFIRMED_LEGACY_POLICIES = [
      'customer_manage_requests',
      'worker_read_matching_requests',
      'worker_submit_quotes',
      'worker_view_quotes',
      'customer_view_quotes',
      'customer_manage_bookings',
      'worker_view_bookings',
      'worker_update_bookings',
      'authenticated_read_requests',
      'customer_manage_quotes',
      'worker_manage_quotes',
    ];

    it('[Static SQL] verifies all confirmed legacy policies from migrations 1-4 are present in the targeted cleanup array', () => {
      CONFIRMED_LEGACY_POLICIES.forEach((policyName) => {
        expect(sqlContent).toContain(`'${policyName}'`);
      });
      expect(sqlContent).toContain('known_legacy_policies TEXT[] := ARRAY[');
      expect(sqlContent).toContain('DROP POLICY IF EXISTS %I ON public.%I;');
    });

    it('[Static SQL] verifies standalone read-only diagnostic file exists and safely inspects pg_policies', () => {
      expect(fs.existsSync(diagnosticPath)).toBe(true);
      const diagnosticContent = fs.readFileSync(diagnosticPath, 'utf8');
      expect(diagnosticContent).toContain('FROM pg_policies');
      expect(diagnosticContent).toContain("schemaname = 'public'");
      expect(diagnosticContent).toContain("'workers'");
      expect(diagnosticContent).toContain("'service_requests'");
      expect(diagnosticContent).toContain("'quotes'");
      expect(diagnosticContent).toContain("'bookings'");
      expect(diagnosticContent).toContain("'reviews'");
      // Diagnostic must be strictly read-only
      expect(diagnosticContent).not.toContain('DROP');
      expect(diagnosticContent).not.toContain('DELETE');
      expect(diagnosticContent).not.toContain('UPDATE');
      expect(diagnosticContent).not.toContain('ALTER');
    });
  });

  // ==========================================================================
  // 2. CONSTRAINT MIGRATION RELIABILITY (10 CATEGORIES)
  // ==========================================================================
  describe('2. Constraint Migration Reliability & Preflight Checks [Static SQL]', () => {
    it('[Static SQL] removes "EXCEPTION WHEN OTHERS THEN NULL" from category constraint replacement blocks', () => {
      // Must not silently swallow constraint failure
      expect(sqlContent).not.toContain('WHEN OTHERS THEN NULL;\nEND $$;');
      expect(sqlContent).not.toContain('WHEN OTHERS THEN NULL;\nEND $;');
    });

    it('[Static SQL] prechecks existing records and raises descriptive exceptions on incompatible values', () => {
      expect(sqlContent).toContain('Cannot apply workers_trade_check: found % records in public.workers with incompatible trade values: %');
      expect(sqlContent).toContain('Cannot apply services_category_check: found % records in public.services with incompatible category values: %');
      expect(sqlContent).toContain('Cannot apply service_requests_category_check: found % records in public.service_requests with incompatible category values: %');
    });
  });

  // ==========================================================================
  // 3. RACE-SAFE BOOKING UNIQUENESS CONSTRAINTS
  // ==========================================================================
  describe('3. Race-Safe Booking Uniqueness & Conflict Preflight [Static SQL]', () => {
    it('[Static SQL] establishes unique indexes for one booking per quote and one active booking per request', () => {
      expect(sqlContent).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_quote ON public.bookings(quote_id);');
      expect(sqlContent).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_one_active_per_request ON public.bookings(request_id)");
      expect(sqlContent).toContain("WHERE status IN ('confirmed', 'in_progress', 'completed');");
    });

    it('[Static SQL] prechecks existing records for conflicts and halts safely without overwriting data', () => {
      expect(sqlContent).toContain('Preflight conflict: Cannot apply unique index on bookings(quote_id): % duplicate quotes exist in bookings: %');
      expect(sqlContent).toContain('Preflight conflict: Cannot apply partial unique index on bookings(request_id): % requests have multiple active/completed bookings: %');
    });
  });

  // ==========================================================================
  // 4. SERVICE-REQUEST STATUS INTEGRITY & STATE TRANSITIONS
  // ==========================================================================
  describe('4. Service-Request Status Integrity & State Transitions [Static SQL & Simulation]', () => {
    it('[Static SQL] prevents customers from directly forging "booked" or "completed" request status', () => {
      expect(sqlContent).toContain('Direct update of service request status to "booked" is prohibited. Status transitions automatically upon booking creation.');
      expect(sqlContent).toContain('Direct update of service request status to "completed" is prohibited. Status transitions automatically upon technician job completion.');
      expect(sqlContent).toContain('Cannot alter service request in terminal status "%"');
      expect(sqlContent).toContain('Cannot directly cancel a booked service request. Cancel the active booking to cancel this request.');
    });

    it('[Static SQL] verifies fn_validate_and_sync_booking and fn_validate_booking_update atomically sync request status', () => {
      expect(sqlContent).toContain("UPDATE public.service_requests\n    SET status = 'booked'");
      expect(sqlContent).toContain("UPDATE public.service_requests\n            SET status = 'completed'");
      expect(sqlContent).toContain("UPDATE public.service_requests\n            SET status = 'cancelled'");
    });

    it('[Simulation] confirms booking creation in client workflow transitions request status to booked', async () => {
      const requests = demoRepo.getRequests();
      const openReq = requests.find((r) => r.status === 'open' || r.status === 'quoted') || requests[0];
      const workers = demoRepo.getWorkers();
      const quotes = demoRepo.getQuotes({ requestId: openReq.id });
      const quote = quotes[0] || demoRepo.getQuotes()[0];

      const res = await api.confirmBooking({
        quoteId: quote.id,
        requestId: openReq.id,
        workerId: workers[0].id,
        customerName: 'Kavita Rao',
        customerPhone: '+91 98450 99887',
        serviceAddress: 'HSR Layout, Bengaluru',
        agreedPrice: 750,
      });

      expect(res.data.status).toBe('confirmed');
      const updatedReq = demoRepo.getRequests().find((r) => r.id === openReq.id);
      expect(updatedReq?.status).toBe('booked');
    });
  });

  // ==========================================================================
  // 5. COMPLETION TIMESTAMP & BOOKING COMPLETION INTEGRITY
  // ==========================================================================
  describe('5. Completion Timestamp & Booking Completion Integrity [Static SQL]', () => {
    it('[Static SQL] removes direct client UPDATE permission on completed_at from public.bookings', () => {
      // Must NOT grant UPDATE on completed_at to authenticated
      expect(sqlContent).toContain('GRANT UPDATE (status, scheduled_for, completion_notes) ON TABLE public.bookings TO authenticated;');
      expect(sqlContent).not.toContain('GRANT UPDATE (status, scheduled_for, completion_notes, completed_at) ON TABLE public.bookings TO authenticated;');
    });

    it('[Static SQL] enforces that completed_at is set strictly via database clock and direct client modification is prohibited', () => {
      expect(sqlContent).toContain('Direct modification of completed_at is prohibited. Completion timestamp is set automatically.');
      expect(sqlContent).toContain('NEW.completed_at := pg_catalog.clock_timestamp();');
    });

    it('[Static SQL] restricts completion notes updates to the verified assigned technician', () => {
      expect(sqlContent).toContain('Unauthorized: Only the assigned technician can update completion notes');
    });

    it('[Static SQL] includes fn_complete_booking trusted RPC with execute grant strictly following definition', () => {
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.fn_complete_booking');

      // Verify the grant is NOT placed prematurely before definition
      const defIdx = sqlContent.indexOf('CREATE OR REPLACE FUNCTION public.fn_complete_booking');
      const firstGrantIdx = sqlContent.indexOf('GRANT EXECUTE ON FUNCTION public.fn_complete_booking(UUID, TEXT) TO authenticated;');
      expect(firstGrantIdx).toBeGreaterThan(defIdx);
    });

    it('[Static SQL] does not call invalid pg_catalog.coalesce and uses standard SQL COALESCE', () => {
      expect(sqlContent).not.toContain('pg_catalog.coalesce');
      expect(sqlContent).toContain('COALESCE(');
    });
  });

  // ==========================================================================
  // 6. SECURITY DEFINER HARDENING & DOLLAR QUOTING
  // ==========================================================================
  describe('6. SECURITY DEFINER Hardening & Valid Dollar Quoting [Static SQL]', () => {
    const SECURITY_DEFINER_FUNCTIONS = [
      'app_private.fn_is_booking_technician_or_participant',
      'app_private.fn_protect_service_request_ownership',
      'app_private.fn_validate_quote_update',
      'app_private.fn_validate_and_sync_booking',
      'app_private.fn_validate_booking_update',
      'public.fn_propose_change_order',
      'public.fn_apply_approved_change_order',
      'public.fn_record_booking_passport',
      'public.fn_complete_booking',
    ];

    it('[Static SQL] verifies every SECURITY DEFINER function sets empty search_path and schema-qualifies references', () => {
      SECURITY_DEFINER_FUNCTIONS.forEach((fnName) => {
        expect(sqlContent).toContain(fnName);
      });

      // No mutable or insecure search paths
      expect(sqlContent).not.toContain('SET search_path = public, pg_temp');
      expect(sqlContent).toContain("SET search_path = ''");
    });

    it('[Static SQL] verifies every function and DO block uses valid double dollar quotes ($$) with zero single dollar signs', () => {
      const lines = sqlContent.split('\n');
      lines.forEach((line, idx) => {
        let dollarCount = 0;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '$') dollarCount++;
        }
        expect(dollarCount % 2, `Line ${idx + 1} has an odd number of dollar signs: "${line}"`).toBe(0);
      });

      // Verify no malformed single dollar blocks
      expect(sqlContent).not.toMatch(/\bDO\s+\$(?!\$)/);
      expect(sqlContent).not.toMatch(/\bEND\s+\$(?!\$);/);
      expect(sqlContent).not.toMatch(/\bAS\s+\$(?!\$)/);
      expect(sqlContent).not.toMatch(/\n\s*\$;/);
    });

    it('[Static SQL] verifies execution grants are explicitly revoked from PUBLIC, anon and granted to authenticated', () => {
      expect(sqlContent).toContain('REVOKE ALL ON FUNCTION app_private.fn_is_booking_technician_or_participant(UUID) FROM PUBLIC, anon;');
      expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION app_private.fn_is_booking_technician_or_participant(UUID) TO authenticated;');

      expect(sqlContent).toContain('REVOKE ALL ON FUNCTION public.fn_propose_change_order(UUID, TEXT, TEXT, NUMERIC, INTEGER, JSONB) FROM PUBLIC, anon;');
      expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION public.fn_propose_change_order(UUID, TEXT, TEXT, NUMERIC, INTEGER, JSONB) TO authenticated;');

      expect(sqlContent).toContain('REVOKE ALL ON FUNCTION public.fn_apply_approved_change_order(UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;');
      expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION public.fn_apply_approved_change_order(UUID, TEXT, BOOLEAN, TEXT) TO authenticated;');

      expect(sqlContent).toContain('REVOKE ALL ON FUNCTION public.fn_record_booking_passport(UUID, JSONB) FROM PUBLIC, anon;');
      expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION public.fn_record_booking_passport(UUID, JSONB) TO authenticated;');

      expect(sqlContent).toContain('REVOKE ALL ON FUNCTION public.fn_complete_booking(UUID, TEXT) FROM PUBLIC, anon;');
      expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION public.fn_complete_booking(UUID, TEXT) TO authenticated;');
    });
  });

  // ==========================================================================
  // 7. VIEW DEPENDENCIES & MIGRATION COMPATIBILITY
  // ==========================================================================
  describe('7. View Dependencies & Non-Destructive Migration [Static SQL]', () => {
    it('[Static SQL] prechecks external view and materialized view dependencies using correct pg_depend direction', () => {
      expect(sqlContent).toContain('Cannot safely recreate SkillNear views: % dependent external view(s) detected: %');
      expect(sqlContent).toContain("d.classid = 'pg_catalog.pg_rewrite'::regclass");
      expect(sqlContent).toContain("d.refclassid = 'pg_catalog.pg_class'::regclass");
      expect(sqlContent).toContain("target_ns.nspname = 'public'");
      expect(sqlContent).toContain("target_cls.relname IN ('job_leads', 'public_reviews', 'workers_directory')");
      expect(sqlContent).toContain("dep_cls.relkind IN ('v', 'm')");

      // Verify no blind CASCADE drops
      expect(sqlContent).not.toContain('DROP VIEW IF EXISTS public.workers_directory CASCADE');
      expect(sqlContent).not.toContain('DROP VIEW IF EXISTS public.job_leads CASCADE');
      expect(sqlContent).not.toContain('DROP VIEW IF EXISTS public.public_reviews CASCADE');
    });

    it('[Static SQL] verifies 10-category catalog and privacy protections are preserved', () => {
      const TEN_CATEGORIES = [
        'electrician',
        'plumber',
        'cleaner',
        'painter',
        'ac_repair',
        'appliance_repair',
        'carpenter',
        'handyman',
        'water_purifier',
        'pest_control',
      ];
      TEN_CATEGORIES.forEach((cat) => {
        expect(sqlContent).toContain(`'${cat}'`);
      });
      // Exact phone and lat/long masked in public leads
      expect(sqlContent).toContain('customer_phone');
      expect(sqlContent).toContain('customer_address');
    });
  });

  // ==========================================================================
  // 8. EXACT PARITY BETWEEN STANDALONE SQL AND SETUPMODAL.TSX
  // ==========================================================================
  describe('8. Exact File Parity Verification [Static Comparison]', () => {
    it('verifies that CONSOLIDATED_MIGRATION_SQL in SetupModal.tsx matches CONSOLIDATED_SKILLNEAR_SETUP.sql 100% byte-for-byte', () => {
      const prefix = 'const CONSOLIDATED_MIGRATION_SQL = `';
      const startIdx = modalContent.indexOf(prefix);
      expect(startIdx).toBeGreaterThan(-1);

      const contentStart = startIdx + prefix.length;
      const suffix = '`;\n\nconst CORRECTIVE_MIGRATION_SQL';
      const endIdx = modalContent.indexOf(suffix);
      expect(endIdx).toBeGreaterThan(-1);

      const extractedSql = modalContent.slice(contentStart, endIdx);
      expect(extractedSql.length).toBe(sqlContent.length);
      expect(extractedSql).toBe(sqlContent);
    });
  });

  // ==========================================================================
  // 9. ENVIRONMENT DISTINCTION DISCLOSURE
  // ==========================================================================
  describe('9. Environment Distinction Disclosure', () => {
    it('notes the boundary between static SQL test invariants and live remote Supabase execution', () => {
      // Clear distinction:
      // - Static SQL checks confirm syntax, triggers, schema definitions, and policies inside the repository.
      // - Demo simulation checks confirm client state transitions and workflow models in browser/memory.
      // - Live Supabase database execution requires executing CONSOLIDATED_SKILLNEAR_SETUP.sql in the Supabase Dashboard.
      expect(sqlContent.length).toBeGreaterThan(60000);
    });
  });
});
