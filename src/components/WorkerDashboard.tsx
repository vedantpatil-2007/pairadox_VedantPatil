import React, { useState } from 'react';
import {
  Star,
  MapPin,
  Send,
  ArrowRightLeft,
  CheckCircle2,
  FileText,
  Calendar,
  Briefcase,
  ShieldCheck,
  FilePlus2,
  FileCheck2,
  AlertTriangle,
  Lock,
  Users,
} from 'lucide-react';
import { Worker, ServiceRequest, Quote, Booking } from '../types';
import { calculateDistanceKm, formatDistance } from '../lib/geo';
import { getTradeBadge } from './WorkerCard';
import { ScopeCard } from './ScopeCard';
import { api } from '../services/api';

interface WorkerDashboardProps {
  worker: Worker;
  requests: ServiceRequest[];
  quotes: Quote[];
  bookings: Booking[];
  loading: boolean;
  activeWorkerTab: 'dashboard' | 'worker-quotes' | 'worker-bookings';
  onSelectWorkerTab: (tab: 'dashboard' | 'worker-quotes' | 'worker-bookings') => void;
  onOpenSubmitQuote: (request: ServiceRequest) => void;
  onOpenCounteroffer: (quote: Quote) => void;
  onRefreshData: () => void;
  allWorkers: Worker[];
  onSelectWorker: (worker: Worker) => void;
  onOpenProposeChangeOrder?: (booking: Booking) => void;
  onOpenRepairPassport?: (booking: Booking) => void;
}

export const WorkerDashboard: React.FC<WorkerDashboardProps> = ({
  worker,
  requests,
  quotes,
  bookings,
  loading,
  activeWorkerTab,
  onSelectWorkerTab,
  onOpenSubmitQuote,
  onOpenCounteroffer,
  onRefreshData,
  allWorkers,
  onSelectWorker,
  onOpenProposeChangeOrder,
  onOpenRepairPassport,
}) => {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filter requests matching this worker's trade
  const tradeLeads = requests.filter(
    (r) => r.category === worker.trade && r.status !== 'booked' && r.status !== 'completed'
  );

  // Filter quotes submitted by this worker
  const workerQuotes = quotes.filter((q) => q.worker_id === worker.id);

  // Filter bookings assigned to this worker
  const workerBookings = bookings.filter((b) => b.worker_id === worker.id);

  const tradeInfo = getTradeBadge(worker.trade);
  const TradeIcon = tradeInfo.icon;

  const handleAcceptCounter = async (quote: Quote) => {
    if (!quote.counter_amount) return;
    setUpdatingId(quote.id);
    try {
      await api.confirmBooking({
        quoteId: quote.id,
        requestId: quote.request_id,
        workerId: worker.id,
        customerName: quote.request?.customer_name || 'Customer',
        customerPhone: quote.request?.customer_phone || '+91 98450 00000',
        serviceAddress: quote.request?.customer_address || 'Customer Address',
        agreedPrice: quote.counter_amount,
      });
      onRefreshData();
    } catch (err) {
      console.error('Failed to accept counteroffer:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateBookingStatus = async (
    bookingId: string,
    status: Booking['status']
  ) => {
    setUpdatingId(bookingId);
    try {
      await api.updateBookingStatus(bookingId, status);
      onRefreshData();
    } catch (err) {
      console.error('Failed to update booking:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Worker Persona Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <img
                src={worker.avatar_url}
                alt={worker.name}
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-slate-100 shadow-xs"
              />
              <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-white shadow-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${tradeInfo.color}`}
                >
                  <TradeIcon className="w-3.5 h-3.5" />
                  <span>{tradeInfo.label}</span>
                </span>
                <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                  Demo Technician Portal
                </span>
              </div>

              <h1 className="text-xl font-bold text-slate-900">{worker.name}</h1>

              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                <div className="flex items-center gap-1 text-amber-500 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
                  <span className="text-slate-900">{worker.rating.toFixed(1)}</span>
                  <span className="text-slate-400 font-normal">({worker.review_count} ratings)</span>
                </div>
                <span>•</span>
                <span>{worker.experience_years} Years Experience</span>
                <span>•</span>
                <span className="text-slate-700 font-medium">Base: ₹{worker.hourly_rate}/hr</span>
              </div>
            </div>
          </div>

          {/* Quick Switch Worker Persona */}
          <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 self-start md:self-auto">
            <span className="text-xs text-slate-500 font-medium">Switch Technician:</span>
            <select
              value={worker.id}
              onChange={(e) => {
                const found = allWorkers.find((w) => w.id === e.target.value);
                if (found) onSelectWorker(found);
              }}
              className="text-xs bg-white border border-slate-300 rounded-lg py-1 px-2 text-slate-800 font-semibold cursor-pointer"
            >
              {allWorkers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.trade})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Nearby Job Leads</span>
            <span className="text-lg font-bold text-brand-600">{tradeLeads.length} Available</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Active Quotes</span>
            <span className="text-lg font-bold text-sky-700">{workerQuotes.length} Submitted</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Assigned Jobs</span>
            <span className="text-lg font-bold text-emerald-700">{workerBookings.length} Active</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Base Hyperlocal Hub</span>
            <span className="text-xs font-bold text-slate-800 truncate block mt-1">
              {worker.address}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation for Worker Portal */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => onSelectWorkerTab('dashboard')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeWorkerTab === 'dashboard'
              ? 'bg-brand-600 text-white'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          Hyperlocal Job Leads ({tradeLeads.length})
        </button>

        <button
          type="button"
          onClick={() => onSelectWorkerTab('worker-quotes')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeWorkerTab === 'worker-quotes'
              ? 'bg-brand-600 text-white'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          My Quotes & Negotiations ({workerQuotes.length})
        </button>

        <button
          type="button"
          onClick={() => onSelectWorkerTab('worker-bookings')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeWorkerTab === 'worker-bookings'
              ? 'bg-brand-600 text-white'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          Assigned Bookings ({workerBookings.length})
        </button>
      </div>

      {/* TAB 1: HYPERLOCAL LEADS */}
      {activeWorkerTab === 'dashboard' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Open Broadcasts in {tradeInfo.label} Trade
            </h2>
            <p className="text-xs text-slate-500">
              Customers waiting for nearby quotes. Review requirements and submit your price.
            </p>
          </div>

          {tradeLeads.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {tradeLeads.map((lead) => {
                const distanceKm = calculateDistanceKm(
                  worker.latitude,
                  worker.longitude,
                  lead.customer_lat,
                  lead.customer_lng
                );

                const hasQuoted = workerQuotes.some((q) => q.request_id === lead.id);

                return (
                  <div
                    key={lead.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-brand-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 px-2 py-0.5 rounded border border-brand-200">
                          {lead.category}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-brand-600" />
                          <strong className="text-slate-800">{formatDistance(distanceKm)}</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-500 capitalize">
                          Urgency: <strong>{lead.urgency}</strong>
                        </span>
                        {lead.crew_size && lead.crew_size > 1 && (
                          <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                            <Users className="w-3 h-3 text-indigo-600" />
                            <span>Crew: {lead.crew_size} Techs</span>
                          </span>
                        )}
                        {lead.organization_name && (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                            {lead.organization_name}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900">{lead.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                        {lead.description}
                      </p>

                      {lead.scope && (
                        <div className="pt-1 max-w-xl">
                          <ScopeCard scope={lead.scope} compact defaultExpanded={false} />
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                        <span>Customer: <strong className="text-slate-700">{lead.customer_name}</strong></span>
                        <span>•</span>
                        <span>Location: {lead.customer_address}</span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 gap-2 shrink-0">
                      <div className="text-left sm:text-right">
                        <span className="text-[11px] text-slate-400 block">Customer Budget</span>
                        <span className="text-base font-extrabold text-slate-900">
                          {lead.budget ? `₹${lead.budget}` : 'Open to offers'}
                        </span>
                      </div>

                      {hasQuoted ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Quote Sent</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenSubmitQuote(lead)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Quote</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500 max-w-md mx-auto space-y-2">
              <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-700">No Open Leads for {tradeInfo.label}s</p>
              <p>Switch to Customer Mode and post a request to test quote dispatching!</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WORKER QUOTES & NEGOTIATIONS */}
      {activeWorkerTab === 'worker-quotes' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              My Active Quotes & Negotiations Desk
            </h2>
            <p className="text-xs text-slate-500">
              Track customer responses, negotiate counteroffers, and finalize agreements
            </p>
          </div>

          {workerQuotes.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {workerQuotes.map((q) => {
                const isCounteredByCustomer =
                  q.status === 'countered' && q.last_updated_by === 'customer';

                return (
                  <div
                    key={q.id}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs transition-all ${
                      isCounteredByCustomer
                        ? 'border-amber-300 bg-amber-50/20 ring-2 ring-amber-500/10'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              q.status === 'accepted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : q.status === 'countered'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {q.status}
                          </span>
                          <span className="text-xs text-slate-400">
                            Quote ID: <code className="font-mono">{q.id.slice(0, 8)}</code>
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900">
                          {q.request?.title || 'Service Request'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Customer: <strong>{q.request?.customer_name}</strong> •{' '}
                          {q.request?.customer_address}
                        </p>
                      </div>

                      <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <span className="text-[11px] text-slate-400 block">Your Quoted Rate</span>
                        <span className="text-base font-bold text-slate-900">₹{q.amount}</span>
                        {q.counter_amount && (
                          <div className="text-xs text-amber-800 font-semibold mt-0.5">
                            Counter: ₹{q.counter_amount}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Counteroffer details if countered */}
                    {q.counter_notes && (
                      <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
                          <span>Customer Counteroffer: ₹{q.counter_amount}</span>
                        </div>
                        <p className="italic text-slate-700">&ldquo;{q.counter_notes}&rdquo;</p>
                      </div>
                    )}

                    {/* Worker Action Buttons */}
                    {isCounteredByCustomer && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onOpenCounteroffer(q)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-slate-500" />
                          <span>Propose Revised Counter</span>
                        </button>

                        <button
                          type="button"
                          disabled={updatingId === q.id}
                          onClick={() => handleAcceptCounter(q)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Accept Customer Price (₹{q.counter_amount})</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500 max-w-md mx-auto space-y-2">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-700">No Quotes Sent Yet</p>
              <p>Check the Job Leads tab to send bids to customers.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ASSIGNED BOOKINGS */}
      {activeWorkerTab === 'worker-bookings' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              My Assigned Job Schedule
            </h2>
            <p className="text-xs text-slate-500">
              Confirmed client appointments assigned to your profile
            </p>
          </div>

          {workerBookings.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {workerBookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          b.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'in_progress'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(b.scheduled_for).toLocaleDateString()}
                      </span>
                      {b.crew_size && b.crew_size > 1 && (
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                          <Users className="w-3 h-3 text-indigo-600" />
                          <span>Crew: {b.crew_size}</span>
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-500">Agreed Payout: </span>
                      <strong className="text-emerald-700 font-bold text-base">₹{b.agreed_price}</strong>
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">
                      {b.request?.title || 'Service Task'}
                    </h3>
                    <p className="text-slate-600 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                      <span>{b.service_address}</span>
                    </p>
                    <p className="text-slate-500">
                      Client Contact: <strong>{b.customer_name}</strong> ({b.customer_phone})
                    </p>
                    {b.supervisor_name && (
                      <p className="text-indigo-700 font-medium text-[11px]">
                        Supervisor Lead: <strong>{b.supervisor_name}</strong>
                      </p>
                    )}
                  </div>

                  {/* ScopeLock Specifications */}
                  {b.request?.scope && (
                    <div className="pt-1">
                      <ScopeCard scope={b.request.scope} compact defaultExpanded={false} />
                    </div>
                  )}

                  {/* Change Orders Section */}
                  {b.change_orders && b.change_orders.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Scope Change Orders ({b.change_orders.length})</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          Requires Customer Approval
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {b.change_orders.map((co) => (
                          <div
                            key={co.id}
                            className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">{co.title}</span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    co.status === 'approved'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : co.status === 'rejected'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {co.status === 'pending_customer_approval'
                                    ? 'Awaiting Approval'
                                    : co.status.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-slate-600 text-[11px]">{co.reason}</p>
                              {co.crew_adjustment && (
                                <p className="text-indigo-600 text-[10px] font-semibold">
                                  Crew Adjustment: +{co.crew_adjustment.added_workers} worker(s)
                                  {co.crew_adjustment.added_duration ? ` for ${co.crew_adjustment.added_duration} ${co.crew_adjustment.duration_unit || 'days'}` : ''}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-bold text-slate-900">+₹{co.additional_amount}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Worker status update & USP triggers */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                    {b.status !== 'completed' && b.status !== 'cancelled' && onOpenProposeChangeOrder && (
                      <button
                        type="button"
                        onClick={() => onOpenProposeChangeOrder(b)}
                        className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        title="Propose an out-of-scope task or price adjustment requiring customer sign-off"
                      >
                        <FilePlus2 className="w-3.5 h-3.5 text-amber-600" />
                        <span>+ Propose Scope Change</span>
                      </button>
                    )}

                    {b.status === 'completed' && onOpenRepairPassport && (
                      <button
                        type="button"
                        onClick={() => onOpenRepairPassport(b)}
                        className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="View certified digital service passport with immutable scope and audit history"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Repair Passport™</span>
                      </button>
                    )}

                    {b.status === 'confirmed' && (
                      <button
                        type="button"
                        disabled={updatingId === b.id}
                        onClick={() => handleUpdateBookingStatus(b.id, 'in_progress')}
                        className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <span>Start Work (Mark In-Progress)</span>
                      </button>
                    )}

                    {b.status === 'in_progress' && (
                      <button
                        type="button"
                        disabled={updatingId === b.id}
                        onClick={() => handleUpdateBookingStatus(b.id, 'completed')}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        <span>Complete Service & Sign Off</span>
                      </button>
                    )}

                    {b.status === 'completed' && (
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Work Completed</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500 max-w-md mx-auto space-y-2">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-700">No Assigned Bookings</p>
              <p>Bookings are confirmed when a customer accepts your quote.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
