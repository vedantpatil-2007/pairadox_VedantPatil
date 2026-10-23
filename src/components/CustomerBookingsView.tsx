import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Star,
  Play,
} from 'lucide-react';
import { Booking } from '../types';
import { api } from '../services/api';

interface CustomerBookingsViewProps {
  bookings: Booking[];
  loading: boolean;
  onOpenReviewModal: (booking: Booking) => void;
  onRefreshBookings: () => void;
}

export const CustomerBookingsView: React.FC<CustomerBookingsViewProps> = ({
  bookings,
  loading,
  onOpenReviewModal,
  onRefreshBookings,
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
          service appointments will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Confirmed Service Bookings</h2>
        <p className="text-xs text-slate-500">
          Track active appointments, simulate on-site progression, and review completed jobs
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {bookings.map((bk) => {
          const isCompleted = bk.status === 'completed';
          const isInProgress = bk.status === 'in_progress';
          const isConfirmed = bk.status === 'confirmed';

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
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs text-slate-500 block">Agreed Final Rate</span>
                  <span className="text-lg font-extrabold text-slate-900">₹{bk.agreed_price}</span>
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

              {/* Job Summary */}
              {bk.request && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                  <span className="font-semibold text-slate-900 block">{bk.request.title}</span>
                  <p className="text-slate-600 line-clamp-2">{bk.request.description}</p>
                </div>
              )}

              {/* Status Simulation Bar & Feedback Trigger */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div className="text-[11px] text-slate-500">
                  {isCompleted ? (
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Job marked complete on {bk.completed_at ? new Date(bk.completed_at).toLocaleDateString() : 'today'}
                    </span>
                  ) : (
                    <span>Simulate job workflow progression for hackathon review</span>
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

                  {isCompleted && (
                    <button
                      type="button"
                      onClick={() => onOpenReviewModal(bk)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 fill-white stroke-white" />
                      <span>Leave Review & Rating</span>
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
