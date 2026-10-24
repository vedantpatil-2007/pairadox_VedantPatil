import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  FilePlus2,
  Lock,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  Send,
  Users,
} from 'lucide-react';
import { Booking } from '../types';
import { api } from '../services/api';

interface ProposeChangeOrderModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedBooking: Booking) => void;
}

export const ProposeChangeOrderModal: React.FC<ProposeChangeOrderModalProps> = ({
  booking,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [additionalAmount, setAdditionalAmount] = useState('250');
  const [adjustCrew, setAdjustCrew] = useState<boolean>(false);
  const [crewDelta, setCrewDelta] = useState<number>(1);
  const [durationDelta, setDurationDelta] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && booking) {
      if (!dialog.open) {
        dialog.showModal();
      }
      setErrorMsg(null);
      setTitle('');
      setReason('');
      setAdditionalAmount('250');
      setAdjustCrew(false);
      setCrewDelta(1);
      setDurationDelta(1);
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, booking]);

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

  if (!booking) return null;

  const originalPrice = booking.agreed_price;
  const parsedExtra = parseFloat(additionalAmount) || 0;
  const revisedTotal = originalPrice + parsedExtra;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !reason.trim()) {
      setErrorMsg('Please describe the extra task and the reason why it is required.');
      return;
    }
    if (parsedExtra <= 0) {
      setErrorMsg('Additional amount must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await api.proposeChangeOrder(booking.id, {
        title: title.trim(),
        reason: reason.trim(),
        additionalAmount: parsedExtra,
        crew_adjustment: adjustCrew
          ? {
              added_workers: crewDelta,
              added_duration: durationDelta,
              reason: reason.trim(),
            }
          : undefined,
      });

      if (res.error) {
        setIsSubmitting(false);
        setErrorMsg(res.error);
        return;
      }

      setIsSubmitting(false);
      onClose();
      onSuccess(res.data);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMsg((err as Error).message || 'Failed to submit change order.');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="proposeChangeModalTitle"
      className="p-0 rounded-2xl bg-white shadow-2xl border border-slate-200 max-w-lg w-full backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs open:animate-in open:fade-in open:zoom-in-95 duration-200 overflow-hidden"
      onClose={onClose}
    >
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <FilePlus2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="proposeChangeModalTitle" className="text-base font-bold text-slate-900">
                Propose Change Order
              </h2>
              <p className="text-xs text-slate-500">
                ScopeLock™: Extra work requires customer approval before price change
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

        {/* Current Price Banner */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 block text-[11px]">Currently Locked Price</span>
            <span className="text-base font-bold text-slate-900">₹{originalPrice}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block text-[11px]">Proposed Revised Total</span>
            <span className="text-base font-extrabold text-amber-700">₹{revisedTotal}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Extra Task or Part Required *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Replace damaged internal valve / extra wiring conduit"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900 text-xs"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Detailed Reason for Change *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this extra work was not visible in initial inspection..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900 text-xs resize-none"
            />
          </div>

          {/* Crew Adjustment Option */}
          <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={adjustCrew}
                  onChange={(e) => setAdjustCrew(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="font-bold text-sky-950 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-700" />
                  <span>Crew Adjustment (Headcount or Days)</span>
                </span>
              </label>
              {booking.crew_size && (
                <span className="text-[10px] text-slate-500">
                  Current: {booking.crew_size} workers
                </span>
              )}
            </div>

            {adjustCrew && (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-sky-100">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                    Added Workers (+/-)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={crewDelta}
                    onChange={(e) => setCrewDelta(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                    Added Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={durationDelta}
                    onChange={(e) => setDurationDelta(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Additional Charge (Labour + Parts) *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">
                ₹
              </span>
              <input
                type="number"
                min="50"
                step="50"
                required
                value={additionalAmount}
                onChange={(e) => setAdditionalAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900 text-xs font-semibold"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              New Total will be ₹{originalPrice} + ₹{parsedExtra} = ₹{revisedTotal}
            </p>
          </div>

          {/* ScopeLock Protection Alert */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>ScopeLock™ Policy Reminder</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              The original agreed price of ₹{originalPrice} will remain active until the customer explicitly reviews and approves this change.
            </p>
          </div>

          {errorMsg && (
            <p className="text-rose-600 text-xs bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              {errorMsg}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Send for Customer Approval'}</span>
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};
