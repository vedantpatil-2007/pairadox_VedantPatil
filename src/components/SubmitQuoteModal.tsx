import React, { useEffect, useRef, useState } from 'react';
import {
  IndianRupee,
  Clock,
  MessageSquare,
  X,
  Send,
  AlertCircle,
  Sparkles,
  Scale,
  CheckCircle2,
  Lock,
  Layers,
  Wrench,
  Package,
  Car,
} from 'lucide-react';
import { ServiceRequest, Worker, Quote, QuoteItemization } from '../types';
import { api } from '../services/api';
import { ScopeCard } from './ScopeCard';

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

  // FairDeal Itemized Pricing State
  const [labourCharge, setLabourCharge] = useState<string>('350');
  const [materialsCharge, setMaterialsCharge] = useState<string>('100');
  const [travelFee, setTravelFee] = useState<string>('50');
  const [duration, setDuration] = useState<string>('1 - 2 hours');
  const [notes, setNotes] = useState<string>('');
  const [partsPolicy, setPartsPolicy] = useState<string>('Branded OEM parts with purchase receipt');

  // Included & Excluded tasks
  const [includedWork, setIncludedWork] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [newExclusion, setNewExclusion] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (request) {
      const budget = request.budget || 500;
      const initialLabour = Math.max(150, Math.round(budget * 0.7));
      const initialMaterials = Math.max(0, Math.round(budget * 0.2));
      const initialTravel = Math.max(0, budget - initialLabour - initialMaterials);

      setLabourCharge(initialLabour.toString());
      setMaterialsCharge(initialMaterials.toString());
      setTravelFee(initialTravel.toString());
      setNotes('Can reach with all necessary diagnostic tools and replacement parts.');

      if (request.scope?.requested_work) {
        setIncludedWork([...request.scope.requested_work]);
      } else {
        setIncludedWork(['Diagnostic inspection', 'Repair & testing']);
      }

      if (request.scope?.exclusions) {
        setExclusions([...request.scope.exclusions]);
      } else {
        setExclusions(['Wall masonry chipping']);
      }
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

  const parsedLabour = parseFloat(labourCharge) || 0;
  const parsedMaterials = parseFloat(materialsCharge) || 0;
  const parsedTravel = parseFloat(travelFee) || 0;
  const totalAmount = parsedLabour + parsedMaterials + parsedTravel;

  const handleToggleIncludedTask = (task: string) => {
    if (includedWork.includes(task)) {
      setIncludedWork(includedWork.filter((t) => t !== task));
    } else {
      setIncludedWork([...includedWork, task]);
    }
  };

  const handleAddExclusion = () => {
    if (newExclusion.trim()) {
      setExclusions([...exclusions, newExclusion.trim()]);
      setNewExclusion('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalAmount <= 0) {
      setErrorMsg('Total quote amount must be greater than zero.');
      return;
    }
    if (parsedLabour <= 0) {
      setErrorMsg('Please specify a valid labour charge.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const itemization: QuoteItemization = {
      labour_charge: parsedLabour,
      materials_charge: parsedMaterials,
      travel_fee: parsedTravel,
      total_price: totalAmount,
      included_work: includedWork.length > 0 ? includedWork : [request.title],
      exclusions,
      parts_policy: partsPolicy.trim(),
    };

    try {
      const res = await api.submitQuote({
        request_id: request.id,
        worker_id: worker.id,
        amount: totalAmount,
        estimated_duration: duration,
        notes: notes.trim(),
        itemization,
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
      className="p-0 rounded-2xl bg-white shadow-2xl border border-slate-200 max-w-xl w-full backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs open:animate-in open:fade-in open:zoom-in-95 duration-200 overflow-hidden"
      onClose={onClose}
    >
      <div className="p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="submitQuoteModalTitle" className="text-base font-bold text-slate-900">
                  Submit FairDeal™ Itemized Quote
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded border border-indigo-200">
                  FairDeal™
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Itemize labour, materials, and travel to ensure clear comparison
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

        {/* Customer ScopeLock Baseline Summary */}
        {request.scope ? (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Customer ScopeLock™ Baseline
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
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
            <span className="font-semibold text-slate-900 block">{request.title}</span>
            <p className="text-slate-600">{request.description}</p>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* FairDeal Itemized Breakdown Inputs */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>FairDeal™ Itemized Price Breakdown</span>
              </span>
              <span className="text-sm font-black text-indigo-700">
                Total: ₹{totalAmount}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Labour */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5 text-slate-400" />
                  <span>Labour Charge (₹) *</span>
                </label>
                <input
                  type="number"
                  min="50"
                  step="50"
                  required
                  value={labourCharge}
                  onChange={(e) => setLabourCharge(e.target.value)}
                  className="w-full font-bold px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Materials */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-slate-400" />
                  <span>Materials / Parts (₹)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={materialsCharge}
                  onChange={(e) => setMaterialsCharge(e.target.value)}
                  className="w-full font-bold px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Travel */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-slate-400" />
                  <span>Travel / Diagnostic (₹)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="25"
                  value={travelFee}
                  onChange={(e) => setTravelFee(e.target.value)}
                  className="w-full font-bold px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Parts Policy Note */}
            <div className="pt-1">
              <label className="text-[11px] font-medium text-slate-500 block mb-0.5">
                Parts & Procurement Policy
              </label>
              <input
                type="text"
                value={partsPolicy}
                onChange={(e) => setPartsPolicy(e.target.value)}
                placeholder="e.g. Branded replacement part with GST bill"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
              />
            </div>
          </div>

          {/* Included Work Alignment */}
          {request.scope?.requested_work && request.scope.requested_work.length > 0 && (
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">
                Tasks Included in this Quote (Select to confirm):
              </label>
              <div className="space-y-1">
                {request.scope.requested_work.map((task, idx) => {
                  const isChecked = includedWork.includes(task);
                  return (
                    <label
                      key={idx}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-emerald-200 bg-emerald-50/40 text-slate-900 font-medium'
                          : 'border-slate-200 bg-white text-slate-500 line-through'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleIncludedTask(task)}
                        className="rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span>{task}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Duration & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Estimated Time Required</span>
              </label>
              <input
                type="text"
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 1 - 2 hours"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>Technician Remarks</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Available immediately with toolkit"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Sending...' : `Send FairDeal™ Quote (₹${totalAmount})`}</span>
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};
