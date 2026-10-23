import React from 'react';
import {
  MessageSquare,
  Clock,
  ArrowRightLeft,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { ServiceRequest, Quote } from '../types';
import { getTradeBadge } from './WorkerCard';

interface CustomerQuotesViewProps {
  requests: ServiceRequest[];
  quotes: Quote[];
  loading: boolean;
  onOpenNewRequest: () => void;
  onOpenCounteroffer: (quote: Quote) => void;
  onOpenConfirmBooking: (quote: Quote) => void;
}

export const CustomerQuotesView: React.FC<CustomerQuotesViewProps> = ({
  requests,
  quotes,
  loading,
  onOpenNewRequest,
  onOpenCounteroffer,
  onOpenConfirmBooking,
}) => {
  if (loading) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Loading your job requests and quotes...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center max-w-lg mx-auto space-y-4">
        <div className="w-14 h-14 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto">
          <MessageSquare className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">No Service Requests Active</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Broadcast a new job to nearby electricians, plumbers, cleaners, and painters to receive competitive quotes.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenNewRequest}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors"
        >
          <Send className="w-4 h-4" />
          <span>Post Your First Job Request</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            My Job Requests & Negotiation Desk
          </h2>
          <p className="text-xs text-slate-500">
            Review incoming bids, counteroffer prices, and lock in bookings
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenNewRequest}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors self-start sm:self-auto"
        >
          <span>+ Post Another Job</span>
        </button>
      </div>

      <div className="space-y-4">
        {requests.map((req) => {
          const reqQuotes = quotes.filter((q) => q.request_id === req.id);
          const tradeInfo = getTradeBadge(req.category);

          return (
            <div
              key={req.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
            >
              {/* Request Summary Banner */}
              <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${tradeInfo.color}`}
                    >
                      {tradeInfo.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        req.status === 'booked'
                          ? 'bg-emerald-100 text-emerald-800'
                          : req.status === 'quoted'
                          ? 'bg-sky-100 text-sky-800'
                          : req.status === 'completed'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {req.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      Posted {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{req.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                    {req.description}
                  </p>
                </div>

                <div className="flex sm:flex-col items-start sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 text-xs shrink-0">
                  <div className="text-slate-500">
                    Target Budget:{' '}
                    <span className="font-bold text-slate-900">
                      {req.budget ? `₹${req.budget}` : 'Flexible'}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Urgency: <span className="capitalize text-slate-700 font-medium">{req.urgency}</span>
                  </div>
                </div>
              </div>

              {/* Quotes List under this Request */}
              <div className="p-4 sm:p-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Received Worker Quotes ({reqQuotes.length})</span>
                  {reqQuotes.length === 0 && (
                    <span className="text-[11px] font-normal text-amber-600">
                      Awaiting technician response in your area...
                    </span>
                  )}
                </h4>

                {reqQuotes.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {reqQuotes.map((q) => {
                      const isNegotiated = Boolean(q.counter_amount);
                      const finalAmount = q.counter_amount || q.amount;

                      return (
                        <div
                          key={q.id}
                          className={`p-4 rounded-xl border transition-all ${
                            q.status === 'accepted'
                              ? 'bg-emerald-50/40 border-emerald-300'
                              : q.status === 'countered'
                              ? 'bg-amber-50/40 border-amber-300'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Worker Info */}
                            <div className="flex items-start gap-3">
                              <img
                                src={
                                  q.worker?.avatar_url ||
                                  'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=100'
                                }
                                alt={q.worker?.name || 'Worker'}
                                className="w-11 h-11 rounded-xl object-cover ring-1 ring-slate-200 shrink-0"
                              />
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-bold text-slate-900">
                                    {q.worker?.name || 'Assigned Technician'}
                                  </span>
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                    Demo Profile
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span>⭐ {q.worker?.rating?.toFixed(1) || '4.8'}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    Est. {q.estimated_duration}
                                  </span>
                                </div>
                                {q.notes && (
                                  <p className="text-xs text-slate-600 mt-1 italic">
                                    &ldquo;{q.notes}&rdquo;
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Price & Negotiation Status */}
                            <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/80">
                              <div className="text-right">
                                <span className="text-lg font-extrabold text-slate-900 block">
                                  ₹{finalAmount}
                                </span>
                                {isNegotiated && (
                                  <span className="text-[10px] text-amber-700 block line-through">
                                    Original: ₹{q.amount}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded mt-1 ${
                                  q.status === 'accepted'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : q.status === 'countered'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-sky-100 text-sky-800'
                                }`}
                              >
                                {q.status === 'countered'
                                  ? `Countered by ${q.last_updated_by}`
                                  : q.status}
                              </span>
                            </div>
                          </div>

                          {/* Negotiation Note Banner if active */}
                          {q.counter_notes && (
                            <div className="mt-3 p-2.5 bg-amber-50 rounded-lg text-xs text-amber-900 border border-amber-200 flex items-start gap-1.5">
                              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold capitalize">
                                  {q.last_updated_by}&rsquo;s counter proposal:
                                </span>{' '}
                                &ldquo;{q.counter_notes}&rdquo;
                              </div>
                            </div>
                          )}

                          {/* Negotiation & Confirmation Action Bar */}
                          {req.status !== 'booked' && req.status !== 'completed' && (
                            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => onOpenCounteroffer(q)}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-slate-500" />
                                <span>Counteroffer</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onOpenConfirmBooking(q)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Agree & Confirm Booking</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 border border-dashed border-slate-200">
                    No quotes received yet. Switch to the <strong>Worker Portal</strong> in the top
                    navigation to view this request as a technician and submit a quote!
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
