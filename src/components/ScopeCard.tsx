import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Tag,
  Ban,
  Clock,
  IndianRupee,
  Lock,
} from 'lucide-react';
import { ScopeLock, Trade } from '../types';
import { getTradeBadge } from './WorkerCard';

interface ScopeCardProps {
  scope?: ScopeLock;
  title?: string;
  category?: Trade;
  urgency?: string;
  budget?: number;
  compact?: boolean;
  defaultExpanded?: boolean;
}

export const ScopeCard: React.FC<ScopeCardProps> = ({
  scope,
  title,
  category,
  urgency,
  budget,
  compact = false,
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!scope) return null;

  const tradeBadge = category ? getTradeBadge(category) : null;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50 p-4 sm:p-5 shadow-xs transition-all space-y-3.5">
      {/* Header Banner */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 shadow-xs">
            <Lock className="w-3.5 h-3.5 text-indigo-700" />
            <span>ScopeLock™ Verified</span>
          </span>
          {tradeBadge && (
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${tradeBadge.color}`}>
              {tradeBadge.label}
            </span>
          )}
          {scope.property_type && (
            <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
              {scope.property_type}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          {budget && (
            <span className="font-bold text-slate-800 flex items-center gap-0.5">
              <IndianRupee className="w-3 h-3 text-slate-500" />
              <span>Target: ₹{budget}</span>
            </span>
          )}
          {urgency && (
            <span className="capitalize text-slate-600 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{urgency}</span>
            </span>
          )}
          {compact && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
            >
              <span>{expanded ? 'Hide Scope' : 'View Scope'}</span>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {title && (
        <h4 className="text-sm sm:text-base font-bold text-slate-900">
          {title}
        </h4>
      )}

      {/* Scope Details (expandable in compact mode, always visible in full mode) */}
      {(!compact || expanded) && (
        <div className="space-y-3 pt-1 text-xs">
          {/* Problem Statement */}
          <div className="p-3 bg-white/90 rounded-xl border border-indigo-100/80 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 block mb-1">
              Problem Description
            </span>
            <p className="text-slate-700 leading-relaxed">
              {scope.problem_description}
            </p>
          </div>

          {/* Requested Tasks & Deliverables Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Requested Work */}
            <div className="p-3 bg-white/90 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Requested Work ({scope.requested_work?.length || 0})</span>
              </span>
              <ul className="space-y-1.5">
                {scope.requested_work?.map((task, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Expected Deliverables */}
            <div className="p-3 bg-white/90 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Expected Deliverables ({scope.expected_deliverables?.length || 0})</span>
              </span>
              <ul className="space-y-1.5">
                {scope.expected_deliverables?.map((deliv, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>{deliv}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Assumptions & Exclusions Row */}
          {((scope.assumptions && scope.assumptions.length > 0) ||
            (scope.exclusions && scope.exclusions.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Assumptions */}
              {scope.assumptions && scope.assumptions.length > 0 && (
                <div className="p-2.5 bg-sky-50/50 rounded-xl border border-sky-200/60 text-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-sky-600" />
                    <span>Assumptions</span>
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {scope.assumptions.map((assump, i) => (
                      <span
                        key={i}
                        className="inline-block bg-white text-slate-600 px-2 py-0.5 rounded text-[11px] border border-sky-100"
                      >
                        {assump}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Exclusions */}
              {scope.exclusions && scope.exclusions.length > 0 && (
                <div className="p-2.5 bg-rose-50/50 rounded-xl border border-rose-200/60 text-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1">
                    <Ban className="w-3 h-3 text-rose-600" />
                    <span>Exclusions (Out of Scope)</span>
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {scope.exclusions.map((excl, i) => (
                      <span
                        key={i}
                        className="inline-block bg-white text-rose-700 px-2 py-0.5 rounded text-[11px] border border-rose-100"
                      >
                        ✕ {excl}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-[11px] text-slate-500 italic flex items-center justify-between pt-1">
            <span>🔒 All quotes for this job are strictly tied to this baseline scope.</span>
            <span>No surprises or unapproved extra charges.</span>
          </div>
        </div>
      )}
    </div>
  );
};
