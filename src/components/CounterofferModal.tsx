import React, { useEffect, useRef, useState } from 'react';
import { IndianRupee, MessageSquare, X, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { Quote } from '../types';
import { api } from '../services/api';

interface CounterofferModalProps {
  quote: Quote | null;
  isOpen: boolean;
  onClose: () => void;
  byRole: 'customer' | 'worker';
  onCounterSubmitted: (updatedQuote: Quote) => void;
}

export const CounterofferModal: React.FC<CounterofferModalProps> = ({
  quote,
  isOpen,
  onClose,
  byRole,
  onCounterSubmitted,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [counterPrice, setCounterPrice] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (quote) {
      // Default counter to something reasonable
      const currentVal = quote.counter_amount || quote.amount;
      const suggested = byRole === 'customer' ? Math.round(currentVal * 0.9) : currentVal;
      setCounterPrice(suggested.toString());
      setNotes('');
    }
  }, [quote, byRole]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(counterPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Please enter a valid counteroffer amount greater than 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await api.submitCounteroffer(
        quote.id,
        priceNum,
        notes.trim() || `Proposed new rate of ₹${priceNum}`,
        byRole
      );

      if (res.error) {
        setIsSubmitting(false);
        setErrorMsg(res.error);
        return;
      }

      setIsSubmitting(false);
      onClose();
      onCounterSubmitted(res.data);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMsg((err as Error).message || 'Failed to submit counteroffer.');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="counterModalTitle"
      className="p-0 rounded-2xl bg-white shadow-2xl border border-slate-200 max-w-md w-full backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs open:animate-in open:fade-in open:zoom-in-95 duration-200"
      onClose={onClose}
    >
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 id="counterModalTitle" className="text-base font-bold text-slate-900">
                Counteroffer & Price Negotiation
              </h2>
              <p className="text-xs text-slate-500">
                Propose an alternate rate to reach agreement
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

        {/* Existing Quote Summary */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Original Quote Amount:</span>
            <span className="font-semibold text-slate-900">₹{quote.amount}</span>
          </div>
          {quote.counter_amount && (
            <div className="flex justify-between text-amber-700 font-medium">
              <span>Last Countered Amount:</span>
              <span>₹{quote.counter_amount}</span>
            </div>
          )}
          {quote.worker && (
            <div className="flex justify-between text-slate-500">
              <span>Technician:</span>
              <span className="text-slate-700 font-medium">{quote.worker.name}</span>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
              <span>Your Proposed Rate (₹)</span>
            </label>
            <input
              type="number"
              min="50"
              step="10"
              required
              value={counterPrice}
              onChange={(e) => setCounterPrice(e.target.value)}
              className="w-full text-base font-bold text-slate-900 px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>Negotiation Note / Reasoning</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Can do ₹450 if you can visit within 1 hour..."
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            />
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
              className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Submitting...' : 'Send Counteroffer'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};
