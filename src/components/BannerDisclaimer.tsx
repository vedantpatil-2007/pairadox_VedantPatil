import React, { useState } from 'react';
import { X, Info, ExternalLink } from 'lucide-react';
import { SupabaseConnectionResult } from '../lib/supabase';

interface BannerDisclaimerProps {
  isLiveDatabase: boolean;
  dbStatus?: SupabaseConnectionResult;
  onOpenSetupModal: () => void;
  onResetDemo?: () => void;
}

export const BannerDisclaimer: React.FC<BannerDisclaimerProps> = ({
  isLiveDatabase,
  dbStatus,
  onOpenSetupModal,
}) => {
  const [dismissNotice, setDismissNotice] = useState(false);

  if (dismissNotice || isLiveDatabase) {
    return null;
  }

  return (
    <div className="w-full bg-slate-100/90 border-b border-slate-200 px-4 py-2 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-brand-600 shrink-0" />
          <span>
            <strong className="font-semibold text-slate-900">SkillNear Preview:</strong>{' '}
            Worker listings are sample profiles. Records are saved in this browser only (localStorage) and are not sent to live service providers.
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={onOpenSetupModal}
            className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800 underline underline-offset-2 cursor-pointer"
          >
            <span>Storage & Database Details</span>
            <ExternalLink className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setDismissNotice(true)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
