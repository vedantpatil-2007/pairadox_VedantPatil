import React, { useEffect, useRef, useState } from 'react';
import { IndianRupee, Clock, MessageSquare, X, Send, AlertCircle, Sparkles } from 'lucide-react';
import { ServiceRequest, Worker, Quote } from '../types';
import { api } from '../services/api';

interface SubmitQuoteModalProps {
  request: ServiceRequest | null;
  worker: Worker | null;
  isOpen: boolean;
  onClose: () => void;
  onQuoteSubmitted: (newQuote: Quote) => void;
}

export const SubmitQuoteModal: React.FC<SubmitQuoteModalProps> = ({
  request,
  worker,
  isOpen,
  onClose,
  onQuoteSubmitted,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState<string>('');
  const [duration, setDuration] = useState<string>('1 - 2 hours');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (request) {
      setAmount(request.budget ? request.budget.toString() : '450');
      setNotes('Can reach with necessary tools and spare parts.');
    }
  }, [request]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && request && worker) {
      if (!dialog.open) {
        dialog.showModal();
      }
      setErrorMsg(null);
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, request, worker]);

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

  if (!request || !worker) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg('Please enter a valid quote amount.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await api.submitQuote({
        request_id: request.id,
        worker_id: worker.id,
        amount: amountNum,
        estimated_duration: duration,
        notes: notes.trim(),
      });

      setIsSubmitting(false);
      onClose();
      onQuoteSubmitted(res.data);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMsg((err as Error).message || 'Failed to submit quote.');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="submitQuoteModalTitle"
      className="p-0 rounded-2xl bg-white shadow-2xl border border-slate-200 max-w-lg w-full backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs open:animate-in open:fade-in open:zoom-in-95 duration-200"
      onClose={onClose}
    >
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 id="submitQuoteModalTitle" className="text-base font-bold text-slate-900">
                Submit Quote for Job Lead
              </h2>
              <p className="text-xs text-slate-500">
                Propose your price & service timeline to the customer
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

        {/* Lead Summary */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
          <span className="font-semibold text-slate-900 block">{request.title}</span>
          <p className="text-slate-600">{request.description}</p>
          <div className="flex items-center justify-between pt-1 text-slate-500">
            <span>Customer: {request.customer_name}</span>
            <span>Target Budget: {request.budget ? `₹${request.budget}` : 'Flexible'}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                <span>Your Quote (₹)</span>
              </label>
              <input
                type="number"
                min="50"
                step="50"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
                className="w-full text-sm font-bold px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Estimated Time</span>
              </label>
              <input
                type="text"
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 1 hour, 2 hours"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>Notes to Customer (What's included)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Standard materials included; replacement valve charged at cost..."
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
              {isSubmitting ? 'Sending...' : 'Send Quote'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};
