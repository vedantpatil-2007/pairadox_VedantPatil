import React, { useEffect, useRef } from 'react';
import {
  X,
  ShieldCheck,
  Scale,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Clock,
  ArrowRightLeft,
  Check,
  Star,
  MapPin,
  Lock,
} from 'lucide-react';
import { Quote, ServiceRequest } from '../types';
import { ScopeCard } from './ScopeCard';

interface QuoteComparisonModalProps {
  request: ServiceRequest | null;
  quotes: Quote[];
  isOpen: boolean;
  onClose: () => void;
  onAcceptQuote: (quote: Quote) => void;
  onCounteroffer: (quote: Quote) => void;
}

export const QuoteComparisonModal: React.FC<QuoteComparisonModalProps> = ({
  request,
  quotes,
  isOpen,
  onClose,
  onAcceptQuote,
  onCounteroffer,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  if (!request) return null;

  // Filter only quotes for this request
  const relevantQuotes = quotes.filter((q) => q.request_id === request.id);

  // Find lowest total price for highlighting
  const lowestPrice = relevantQuotes.length > 0
    ? Math.min(...relevantQuotes.map((q) => q.counter_amount || q.amount))
    : 0;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="comparisonModalTitle"
      className="p-0 rounded-2xl bg-white shadow-2xl border border-slate-200 max-w-4xl w-full backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs open:animate-in open:fade-in open:zoom-in-95 duration-200 overflow-hidden"
      onClose={onClose}
    >
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl shadow-xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="comparisonModalTitle" className="text-base sm:text-lg font-bold text-slate-900">
                  FairDeal™ Side-by-Side Quote Comparison
                </h2>
                <span className="text-[11px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                  ScopeLock Baseline
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Transparent itemized price breakdown benchmarked against the exact same job scope
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Baseline Scope Card */}
          {request.scope ? (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Unified Job Baseline
              </span>
              <ScopeCard
                scope={request.scope}
                title={request.title}
                category={request.category}
                urgency={request.urgency}
                budget={request.budget}
                compact={true}
                defaultExpanded={false}
              />
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-800 block">{request.title}</span>
              <p className="text-slate-600">{request.description}</p>
            </div>
          )}

          {/* Quotes Comparison Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Received Technician Quotes ({relevantQuotes.length})
              </span>
              <span className="text-xs text-indigo-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero Hidden Fees Guarantee</span>
              </span>
            </div>

            {relevantQuotes.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                No quotes received for this job yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {relevantQuotes.map((q) => {
                  const effectivePrice = q.counter_amount || q.amount;
                  const isLowest = effectivePrice === lowestPrice && relevantQuotes.length > 1;
                  const item = q.itemization || {
                    labour_charge: Math.round(effectivePrice * 0.7),
                    materials_charge: Math.round(effectivePrice * 0.2),
                    travel_fee: Math.round(effectivePrice * 0.1),
                    total_price: effectivePrice,
                    included_work: request.scope?.requested_work || ['Diagnostic & fix'],
                    exclusions: ['Unrelated wiring'],
                    parts_policy: 'Standard replacement parts with receipt',
                  };

                  return (
                    <div
                      key={q.id}
                      className={`rounded-2xl border p-5 flex flex-col justify-between space-y-4 bg-white shadow-xs transition-all ${
                        isLowest
                          ? 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/10'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="space-y-4">
                        {/* Worker Header */}
                        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                q.worker?.avatar_url ||
                                'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=100'
                              }
                              alt={q.worker?.name || 'Worker'}
                              className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-200"
                            />
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">
                                {q.worker?.name || 'Technician'}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                                  <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
                                  <span>{q.worker?.rating?.toFixed(1) || '4.8'}</span>
                                </span>
                                <span>•</span>
                                <span>{q.worker?.experience_years || 5} yrs exp</span>
                              </div>
                            </div>
                          </div>

                          {isLowest && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Best Value
                            </span>
                          )}
                        </div>

                        {/* Total Price Banner */}
                        <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="text-[11px] text-slate-500 block">Total Agreed Price</span>
                            <span className="text-xl font-black text-slate-900">
                              ₹{effectivePrice}
                            </span>
                            {q.counter_amount && (
                              <span className="text-[10px] text-amber-700 font-semibold block">
                                (Countered from ₹{q.amount})
                              </span>
                            )}
                          </div>
                          <div className="text-right text-xs">
                            <span className="text-slate-500 block">Estimated Time</span>
                            <span className="font-semibold text-slate-800 flex items-center gap-1 justify-end">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{q.estimated_duration}</span>
                            </span>
                          </div>
                        </div>

                        {/* Itemized Breakdown Table */}
                        <div className="space-y-1.5 text-xs">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            FairDeal™ Itemization
                          </span>
                          <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                            <div className="flex justify-between items-center text-slate-700">
                              <span>🛠️ Labour & Diagnostics:</span>
                              <span className="font-semibold text-slate-900">₹{item.labour_charge}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-700">
                              <span>📦 Materials & Parts:</span>
                              <span className="font-semibold text-slate-900">₹{item.materials_charge}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-700">
                              <span>🚗 Travel & Transport:</span>
                              <span className="font-semibold text-slate-900">₹{item.travel_fee}</span>
                            </div>
                            <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center font-bold text-slate-900">
                              <span>Total Quote:</span>
                              <span>₹{item.labour_charge + item.materials_charge + item.travel_fee}</span>
                            </div>
                          </div>
                        </div>

                        {/* Included Work & Exclusions */}
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Included in Quote
                            </span>
                            <ul className="space-y-1">
                              {item.included_work?.map((work, idx) => (
                                <li key={idx} className="flex items-center gap-1.5 text-slate-700 text-[11px]">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{work}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {item.exclusions && item.exclusions.length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block mb-1">
                                Excluded
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {item.exclusions.map((ex, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-100"
                                  >
                                    ✕ {ex}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {item.parts_policy && (
                            <p className="text-[11px] text-slate-500 italic pt-1">
                              Note: {item.parts_policy}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onCounteroffer(q);
                          }}
                          className="flex-1 py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                          <span>Counter</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onAcceptQuote(q);
                          }}
                          className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accept (₹{effectivePrice})</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
};
