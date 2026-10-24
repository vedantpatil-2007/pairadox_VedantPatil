import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Star,
  Play,
  ShieldCheck,
  AlertTriangle,
  Lock,
  FileCheck2,
  Check,
  X,
  History,
  Users,
} from 'lucide-react';
import { Booking } from '../types';
import { api } from '../services/api';
import { ScopeCard } from './ScopeCard';

interface CustomerBookingsViewProps {
  bookings: Booking[];
  loading: boolean;
  onOpenReviewModal: (booking: Booking) => void;
  onRefreshBookings: () => void;
  onOpenRepairPassport: (booking: Booking) => void;
}

export const CustomerBookingsView: React.FC<CustomerBookingsViewProps> = ({
  bookings,
  loading,
  onOpenReviewModal,
  onRefreshBookings,
  onOpenRepairPassport,
}) => {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleUpdateStatus = async (
    bookingId: string,
    nextStatus: Booking['status']
  ) => {
    setUpdatingId(bookingId);
    try {
      await api.updateBookingStatus(bookingId, nextStatus);
      onRefreshBookings();
    } catch (err) {
      console.error('Failed to update booking status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApproveChangeOrder = async (bookingId: string, changeOrderId: string) => {
    setUpdatingId(changeOrderId);
    try {
      await api.respondToChangeOrder(bookingId, changeOrderId, 'approved');
      onRefreshBookings();
    } catch (err) {
      console.error('Failed to approve change order:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRejectChangeOrder = async (bookingId: string, changeOrderId: string) => {
    setUpdatingId(changeOrderId);
    try {
      await api.respondToChangeOrder(bookingId, changeOrderId, 'rejected');
      onRefreshBookings();
    } catch (err) {
      console.error('Failed to reject change order:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Loading confirmed bookings...</p>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center max-w-lg mx-auto space-y-3">
        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
          <Calendar className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900">No Confirmed Bookings Yet</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Once you and a technician agree on a quote price in the Negotiation Desk, your confirmed
          service appointments with ScopeLock™ protection will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Confirmed Service Bookings</h2>
          <p className="text-xs text-slate-500">
            ScopeLock™ Protected: Original rate is locked; change orders require your explicit approval
          </p>
        </div>
        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto flex items-center gap-1">
          <Lock className="w-3.5 h-3.5 text-emerald-700" />
          <span>Change-Order Lock Active</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {bookings.map((bk) => {
          const isCompleted = bk.status === 'completed';
          const isInProgress = bk.status === 'in_progress';
          const isConfirmed = bk.status === 'confirmed';

          const pendingChangeOrders = (bk.change_orders || []).filter(
            (c) => c.status === 'pending_customer_approval'
          );
          const historyChangeOrders = (bk.change_orders || []).filter(
            (c) => c.status !== 'pending_customer_approval'
          );

          return (
            <div
              key={bk.id}
              className={`bg-white rounded-2xl border transition-all overflow-hidden p-5 space-y-4 ${
                isCompleted
                  ? 'border-emerald-200 bg-emerald-50/10'
                  : isInProgress
                  ? 'border-sky-300 ring-2 ring-sky-500/10'
                  : 'border-slate-200'
              }`}
            >
              {/* Header Status & Price */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : isInProgress
                        ? 'bg-sky-100 text-sky-800 animate-pulse'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {isInProgress && <Clock className="w-3.5 h-3.5" />}
                    <span>{bk.status.replace('_', ' ')}</span>
                  </span>
                  <span className="text-xs text-slate-400">
                    Booking ID: <code className="font-mono text-slate-600">{bk.id.slice(0, 8)}</code>
                  </span>
                  {bk.crew_size && bk.crew_size > 1 && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Team of {bk.crew_size} Technicians</span>
                    </span>
                  )}
                  {bk.organization_name && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      Org: {bk.organization_name}
                    </span>
                  )}
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs text-slate-500 block">Agreed Locked Rate</span>
                  <span className="text-lg font-extrabold text-slate-900">₹{bk.agreed_price}</span>
                  {bk.original_agreed_price && bk.original_agreed_price !== bk.agreed_price && (
                    <span className="text-[10px] text-emerald-700 block font-semibold">
                      (Includes approved changes from base ₹{bk.original_agreed_price})
                    </span>
                  )}
                </div>
              </div>

              {/* Technician & Job Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Technician Card */}
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <img
                    src={
                      bk.worker?.avatar_url ||
                      'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=100'
                    }
                    alt={bk.worker?.name || 'Worker'}
                    className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-200 shrink-0"
                  />
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Assigned Technician
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{bk.worker?.name || 'Technician'}</h4>
                    <p className="text-slate-500 capitalize">{bk.worker?.trade}</p>
                    {bk.supervisor_name && (
                      <p className="text-indigo-700 font-medium text-[11px]">
                        Supervisor: {bk.supervisor_name}
                      </p>
                    )}
                    <p className="text-slate-600 font-mono text-[11px]">{bk.worker?.phone}</p>
                  </div>
                </div>

                {/* Service Address & Timing */}
                <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-slate-700">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block text-slate-900">Service Location</span>
                      <span className="text-slate-600">{bk.service_address}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 text-slate-600">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      Scheduled:{' '}
                      <strong>{new Date(bk.scheduled_for).toLocaleDateString()}</strong> at{' '}
                      <strong>{new Date(bk.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Job Scope Baseline */}
              {bk.request?.scope ? (
                <ScopeCard
                  scope={bk.request.scope}
                  compact={true}
                  defaultExpanded={false}
                />
              ) : bk.request ? (
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                  <span className="font-semibold text-slate-900 block">{bk.request.title}</span>
                  <p className="text-slate-600 line-clamp-2">{bk.request.description}</p>
                </div>
              ) : null}

              {/* PHASE 3: PENDING CHANGE ORDERS BANNER */}
              {pendingChangeOrders.length > 0 && (
                <div className="p-4 bg-amber-50 rounded-2xl border-2 border-amber-300 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-200 text-amber-900 rounded-lg">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">
                        Action Required: Change Order Requested by Technician
                      </h4>
                      <p className="text-[11px] text-amber-800">
                        Work cannot proceed at the revised rate without your explicit authorization.
                      </p>
                    </div>
                  </div>

                  {pendingChangeOrders.map((co) => (
                    <div
                      key={co.id}
                      className="p-3 bg-white rounded-xl border border-amber-200 text-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900 block text-sm">{co.title}</span>
                          <p className="text-slate-600 italic mt-0.5">&ldquo;{co.reason}&rdquo;</p>
                          {co.crew_adjustment && (
                            <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-medium">
                              <Users className="w-3.5 h-3.5 text-indigo-600" />
                              <span>
                                Crew Adjustment: +{co.crew_adjustment.added_workers} worker(s)
                                {co.crew_adjustment.added_duration ? ` for ${co.crew_adjustment.added_duration} ${co.crew_adjustment.duration_unit || 'days'}` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[11px] text-slate-400 block">Proposed Price</span>
                          <span className="text-xs text-slate-400 line-through">₹{co.original_price}</span>
                          <span className="text-sm font-extrabold text-amber-800 block">
                            ₹{co.revised_total} (+₹{co.additional_amount})
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={updatingId === co.id}
                          onClick={() => handleRejectChangeOrder(bk.id, co.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Reject Change Order
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === co.id}
                          onClick={() => handleApproveChangeOrder(bk.id, co.id)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Lock Revised Total (₹{co.revised_total})</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CHANGE ORDER HISTORY */}
              {historyChangeOrders.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <span className="font-semibold text-slate-600 flex items-center gap-1 text-[11px]">
                    <History className="w-3 h-3 text-slate-400" />
                    <span>Change-Order History ({historyChangeOrders.length})</span>
                  </span>
                  <div className="space-y-1">
                    {historyChangeOrders.map((co) => (
                      <div
                        key={co.id}
                        className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-100 text-[11px]"
                      >
                        <span className="text-slate-700">
                          {co.title} (+₹{co.additional_amount})
                          {co.crew_adjustment && (
                            <span className="text-indigo-600 font-semibold ml-1">
                              [+{co.crew_adjustment.added_workers} crew]
                            </span>
                          )}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            co.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {co.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Simulation Bar & Feedback Trigger */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div className="text-[11px] text-slate-500">
                  {isCompleted ? (
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Job completed on {bk.completed_at ? new Date(bk.completed_at).toLocaleDateString() : 'today'}
                    </span>
                  ) : (
                    <span>Simulate job workflow progression for preview</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isConfirmed && (
                    <button
                      type="button"
                      disabled={updatingId === bk.id}
                      onClick={() => handleUpdateStatus(bk.id, 'in_progress')}
                      className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Simulate Technician Arrived (Start Job)</span>
                    </button>
                  )}

                  {isInProgress && (
                    <button
                      type="button"
                      disabled={updatingId === bk.id}
                      onClick={() => handleUpdateStatus(bk.id, 'completed')}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Job Completed</span>
                    </button>
                  )}

                  {/* PHASE 4: VIEW REPAIR PASSPORT BUTTON */}
                  {isCompleted && (
                    <button
                      type="button"
                      onClick={() => onOpenRepairPassport(bk)}
                      className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>View Repair Passport™</span>
                    </button>
                  )}

                  {isCompleted && (
                    <button
                      type="button"
                      onClick={() => onOpenReviewModal(bk)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 fill-white stroke-white" />
                      <span>Review</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

