import React, { useEffect, useRef, useState } from 'react';
import { Database, Copy, Check, X, ShieldAlert, FileCode2, Terminal, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getSupabaseConfigStatus, SupabaseConnectionResult } from '../lib/supabase';

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbStatus?: SupabaseConnectionResult;
  onRefreshConnection?: () => Promise<void>;
}

const MIGRATION_SQL_SNIPPET = `-- Run this in Supabase Dashboard -> SQL Editor
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
    rating NUMERIC(3, 2) NOT NULL DEFAULT 4.8,
    review_count INTEGER NOT NULL DEFAULT 0,
    bio TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT true,
    is_available BOOLEAN NOT NULL DEFAULT true,
    badge_label TEXT DEFAULT 'Demo Profile (Fictional Simulation)',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    base_price NUMERIC(10, 2) NOT NULL,
    estimated_time TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
    urgency TEXT NOT NULL DEFAULT 'today',
    budget NUMERIC(10, 2),
    preferred_worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    estimated_duration TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    counter_amount NUMERIC(10, 2),
    counter_notes TEXT,
    last_updated_by TEXT NOT NULL DEFAULT 'worker',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    service_address TEXT NOT NULL,
    agreed_price NUMERIC(10, 2) NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'confirmed',
    completion_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS setup
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all workers" ON public.workers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all services" ON public.services FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all requests" ON public.service_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all quotes" ON public.quotes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all bookings" ON public.bookings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all reviews" ON public.reviews FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`;

export const SetupModal: React.FC<SetupModalProps> = ({
  isOpen,
  onClose,
  dbStatus,
  onRefreshConnection,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Single shared configuration check
  const status = getSupabaseConfigStatus();
  const isConnected = dbStatus?.isConnected ?? false;
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

  const handleCopy = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_SNIPPET);
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

        {/* Current Connection Status Box - Accurate & Synchronized */}
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
            isConnected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : status.isConfigured
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                isConnected
                  ? 'bg-emerald-500 animate-pulse'
                  : status.isConfigured
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
              }`}
            />
            <div className="space-y-1 text-xs sm:text-sm">
              <h3 className="font-semibold">
                {isConnected
                  ? 'Supabase Database Connected & Verified Active'
                  : status.isConfigured
                  ? 'Supabase Credentials Detected — Live Database Inactive'
                  : 'Supabase Not Configured — Running in Local Preview Simulation'}
              </h3>
              <p className="text-xs opacity-90">
                {isConnected ? (
                  <>
                    Live database query verified on:{' '}
                    <span className="font-mono font-medium">{status.url}</span>
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
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <FileCode2 className="w-3.5 h-3.5" />
              <span>SQL Schema & RLS Policies</span>
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy SQL Migration</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-3 bg-slate-900 text-slate-100 text-[11px] font-mono rounded-xl max-h-44 overflow-y-auto leading-relaxed border border-slate-800">
            {MIGRATION_SQL_SNIPPET}
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
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {isConnected ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                PostgreSQL persistence active
              </span>
            ) : (
              <span>Simulation mode fallback active</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
};
