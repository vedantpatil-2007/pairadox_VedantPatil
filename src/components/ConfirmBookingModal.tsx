import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Calendar, MapPin, IndianRupee, X, AlertCircle } from 'lucide-react';
import { Quote, Booking } from '../types';
import { api } from '../services/api';

interface ConfirmBookingModalProps {
  quote: Quote | null;
  isOpen: boolean;
  onClose: () => void;
  onBookingConfirmed: (booking: Booking) => void;
}

export const ConfirmBookingModal: React.FC<ConfirmBookingModalProps> = ({
  quote,
  isOpen,
  onClose,
  onBookingConfirmed,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('14:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Default scheduled date to today
    const today = new Date().toISOString().split('T')[0];
    setScheduledDate(today);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && quote) {
      if (!dialog.open) {
        dialog.showModal();
      }
      setErrorMsg(null);
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, quote]);

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

  if (!quote) return null;

  const agreedAmount = quote.counter_amount || quote.amount;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const scheduledIso = `${scheduledDate}T${scheduledTime}:00`;
      const res = await api.confirmBooking({
        quoteId: quote.id,
        requestId: quote.request_id,
        workerId: quote.worker_id,
        customerName: quote.request?.customer_name || 'Customer',
        customerPhone: quote.request?.customer_phone || '+91 98765 00000',
        serviceAddress: quote.request?.customer_address || 'Service Location',
        agreedPrice: agreedAmount,
        scheduledFor: scheduledIso,
      });

      setIsSubmitting(false);
      onClose();
      onBookingConfirmed(res.data);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMsg((err as Error).message || 'Failed to confirm booking.');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="confirmModalTitle"
      className="p-0 rounded-2xl bg-white shadow-2xl border border-slate-200 max-w-md w-full backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs open:animate-in open:fade-in open:zoom-in-95 duration-200"
      onClose={onClose}
    >
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="confirmModalTitle" className="text-base font-bold text-slate-900">
                Confirm Service Booking
              </h2>
              <p className="text-xs text-slate-500">
                Lock in agreed price & schedule the technician
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

        {errorMsg && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Agreed Rate Card */}
        <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-800 font-medium">Agreed Service Price</span>
            <span className="text-xl font-extrabold text-emerald-900">₹{agreedAmount}</span>
          </div>
          <p className="text-[11px] text-emerald-700">
            {quote.counter_amount
              ? 'Negotiated counteroffer successfully agreed between customer & technician.'
              : 'Direct quote price accepted.'}
          </p>
        </div>

        {/* Job Details */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Technician:</span>
            <span className="font-semibold text-slate-900">
              {quote.worker?.name || 'Assigned Technician'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Job:</span>
            <span className="font-semibold text-slate-900 truncate max-w-[200px]">
              {quote.request?.title || 'Service Task'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Location:</span>
            <span className="font-medium text-slate-700 truncate max-w-[200px]">
              {quote.request?.customer_address || 'Customer Address'}
            </span>
          </div>
        </div>

        {/* Schedule Timing Form */}
        <form onSubmit={handleConfirm} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Date</label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Time Window</label>
              <input
                type="time"
                required
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="p-2.5 bg-slate-100 rounded-lg text-[11px] text-slate-600">
            Payment note: Payment is settled directly upon job completion. Milestone 1 prototype
            bypasses digital checkout gateways.
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Confirming...' : 'Agree on Price & Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};
