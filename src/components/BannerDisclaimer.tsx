import React, { useState } from 'react';
import { X, Database, ShieldAlert, ExternalLink, AlertTriangle } from 'lucide-react';
import { SupabaseConnectionResult } from '../lib/supabase';

interface BannerDisclaimerProps {
  isLiveDatabase: boolean;
  dbStatus?: SupabaseConnectionResult;
  onOpenSetupModal: () => void;
}

export const BannerDisclaimer: React.FC<BannerDisclaimerProps> = ({
  isLiveDatabase,
  dbStatus,
  onOpenSetupModal,
}) => {
  const [dismissNotice, setDismissNotice] = useState(false);

  // If dbStatus is available, check whether credentials were found vs live connection
  const hasCredentials = dbStatus?.isConfigured ?? false;
  const connectionError = dbStatus?.error;

  return (
    <div className="w-full space-y-2">
      {/* Primary Hackathon Disclaimer Banner */}
      {!dismissNotice && (
        <div className="bg-amber-500/10 border-b border-amber-200 px-4 py-2.5 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-start sm:items-center justify-between gap-3 text-xs sm:text-sm text-amber-950">
            <div className="flex items-start sm:items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <strong className="font-semibold text-amber-900">
                  Hackathon Prototype (PS03 Evaluation Only):
                </strong>{' '}
                All worker profiles, customer reviews, ratings, and past job counts are
                fictional simulations. No genuine identity verification or commercial certification is claimed.
                Payment gateways & paid APIs are bypassed for this milestone.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissNotice(true)}
              className="text-amber-800 hover:text-amber-950 p-1 rounded-md transition-colors shrink-0"
              aria-label="Dismiss disclaimer banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Supabase Connection State Banner if not running live database */}
      {!isLiveDatabase && (
        <div className="bg-sky-50 border-y border-sky-200 px-4 py-2 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-sky-950">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                <strong>Local Preview Simulation Mode:</strong>{' '}
                {hasCredentials ? (
                  <>
                    Supabase credentials detected, but live database request was not successful
                    {connectionError ? ` (${connectionError})` : ''}. Operating in safe simulation fallback mode.
                  </>
                ) : (
                  <>
                    Supabase credentials not detected. All quotes, requests, and counteroffers
                    operate in-memory and are{' '}
                    <span className="underline font-semibold text-sky-900">
                      never pretended to be saved to Supabase
                    </span>.
                  </>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenSetupModal}
              className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800 underline underline-offset-2 shrink-0 self-start sm:self-auto cursor-pointer"
            >
              {hasCredentials ? 'View Setup & Run Migration SQL' : 'Connect Supabase & Run SQL'}{' '}
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
