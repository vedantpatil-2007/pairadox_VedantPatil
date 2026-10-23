import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  X,
  Zap,
  Droplet,
  Paintbrush,
  MapPin,
  Clock,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Trade, Urgency, UserLocation, Worker } from '../types';
import { api } from '../services/api';

interface PostRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: UserLocation;
  preselectedWorker: Worker | null;
  onRequestCreated: (requestId: string) => void;
}

export const PostRequestModal: React.FC<PostRequestModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  preselectedWorker,
  onRequestCreated,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Form State
  const [category, setCategory] = useState<Trade>(
    preselectedWorker ? preselectedWorker.trade : 'plumber'
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('today');
  const [budget, setBudget] = useState<string>('500');
  const [customerName, setCustomerName] = useState('Rahul Sharma');
  const [customerPhone, setCustomerPhone] = useState('+91 98450 12345');
  const [customerAddress, setCustomerAddress] = useState(currentLocation.address);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (preselectedWorker) {
      setCategory(preselectedWorker.trade);
    }
  }, [preselectedWorker]);

  useEffect(() => {
    setCustomerAddress(currentLocation.address);
  }, [currentLocation]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      setIsSuccess(false);
      setErrorMsg(null);
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Fallback for browsers without closedby support
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMsg('Please provide a job title and description of the issue.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await api.createServiceRequest({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        customer_lat: currentLocation.lat,
        customer_lng: currentLocation.lng,
        category,
        title,
        description,
        urgency,
        budget: budget ? parseFloat(budget) : undefined,
        preferred_worker_id: preselectedWorker ? preselectedWorker.id : null,
      });

      setIsSuccess(true);
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
        onRequestCreated(res.data.id);
      }, 1200);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMsg((err as Error).message || 'Failed to submit service request. Please retry.');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="requestModalTitle"
      className="p-0 rounded-2xl bg-white shadow-2xl border border-slate-200 max-w-xl w-full backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs open:animate-in open:fade-in open:zoom-in-95 duration-200"
      onClose={onClose}
    >
      <div className="p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="requestModalTitle" className="text-lg font-bold text-slate-900">
                {preselectedWorker
                  ? `Request Quote from ${preselectedWorker.name}`
                  : 'Post an On-Demand Job Broadcast'}
              </h2>
              <p className="text-xs text-slate-500">
                {preselectedWorker
                  ? 'Send a direct inquiry for negotiation'
                  : 'Receive quotes from verified nearby technicians'}
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

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Service Request Created!</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Your request is now live in the hyperlocal feed. Technicians can review and send quotes.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Category selection */}
            {!preselectedWorker && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Service Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'electrician', label: 'Electrician', icon: Zap },
                    { id: 'plumber', label: 'Plumber', icon: Droplet },
                    { id: 'cleaner', label: 'Cleaner', icon: Sparkles },
                    { id: 'painter', label: 'Painter', icon: Paintbrush },
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id as Trade)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-1" />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Job Title */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Problem / Job Summary</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bathroom pipe leakage under washbasin"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-slate-900"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Detailed Description</label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide symptoms, access details or specific parts required..."
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-slate-900"
              />
            </div>

            {/* Urgency & Target Budget */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Urgency</span>
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as Urgency)}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                >
                  <option value="immediate">Immediate / Emergency (Within 1 hour)</option>
                  <option value="today">Today (Within 4 hours)</option>
                  <option value="flexible">Flexible / Weekend</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                  <span>Target Budget (₹)</span>
                </label>
                <input
                  type="number"
                  min="100"
                  step="50"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="500"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Customer Details & Address */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Contact & Hyperlocal Address
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your Name"
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone Number"
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-300">
                <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full bg-transparent border-none p-0 focus:outline-hidden text-xs text-slate-800"
                  placeholder="Service address"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Posting Request...</span>
                ) : (
                  <span>Submit Service Request</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
};
