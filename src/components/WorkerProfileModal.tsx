import React, { useEffect, useRef, useState } from 'react';
import {
  Star,
  Clock,
  X,
  Send,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { Worker, Service, Review } from '../types';
import { getTradeBadge } from './WorkerCard';
import { formatDistance } from '../lib/geo';
import { api } from '../services/api';

interface WorkerProfileModalProps {
  worker: Worker | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestQuote: (worker: Worker) => void;
}

export const WorkerProfileModal: React.FC<WorkerProfileModalProps> = ({
  worker,
  isOpen,
  onClose,
  onRequestQuote,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && worker) {
      if (!dialog.open) {
        dialog.showModal();
      }
      // Load services & reviews for worker
      setLoading(true);
      Promise.all([
        api.getServices(worker.id),
        api.getReviews(worker.id),
      ])
        .then(([servicesRes, reviewsRes]) => {
          setServices(servicesRes.data);
          setReviews(reviewsRes.data);
        })
        .finally(() => setLoading(false));
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, worker]);

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

  if (!worker) return null;

  const tradeInfo = getTradeBadge(worker.trade);
  const TradeIcon = tradeInfo.icon;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="workerModalTitle"
      className="p-0 rounded-2xl bg-white shadow-2xl border border-slate-200 max-w-2xl w-full backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs open:animate-in open:fade-in open:zoom-in-95 duration-200"
      onClose={onClose}
    >
      <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-start gap-4">
            <img
              src={worker.avatar_url}
              alt={worker.name}
              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-slate-100 shadow-xs shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${tradeInfo.color}`}
                >
                  <TradeIcon className="w-3.5 h-3.5" />
                  <span>{tradeInfo.label}</span>
                </span>
                <span className="text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                  Simulation Profile
                </span>
              </div>

              <h2 id="workerModalTitle" className="text-xl font-bold text-slate-900 mt-1">
                {worker.name}
              </h2>

              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                <div className="flex items-center gap-1 text-amber-500 font-semibold">
                  <Star className="w-4 h-4 fill-amber-400 stroke-amber-400" />
                  <span className="text-slate-900">{worker.rating.toFixed(1)}</span>
                  <span className="text-slate-400 font-normal">({worker.review_count} reviews)</span>
                </div>
                <span>•</span>
                <span>{worker.experience_years} Years Active</span>
                <span>•</span>
                <span className="text-slate-700 font-medium">
                  {worker.distance_km !== undefined ? formatDistance(worker.distance_km) : worker.city}
                </span>
              </div>
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

        {/* Profile Notice Box */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <span>
            <strong>Sample Profile:</strong> This profile is generated as a demonstration record. Real-world identity verification and commercial licensing are not established for sample profiles.
          </span>
        </div>

        {/* Worker Overview & Rates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider block">
              Inspection / Base Rate
            </span>
            <span className="text-base font-bold text-slate-900">
              ₹{worker.hourly_rate}
              <span className="text-xs font-normal text-slate-500"> / hour</span>
            </span>
            <p className="text-[11px] text-slate-500">
              Standard site visit, diagnostic inspection & initial labor.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <span className="text-slate-400 uppercase font-semibold text-[10px] tracking-wider block">
              Service Area & Address
            </span>
            <span className="text-sm font-semibold text-slate-900 block truncate">
              {worker.address}
            </span>
            <p className="text-[11px] text-slate-500">
              Serving within a 10 km hyperlocal radius.
            </p>
          </div>
        </div>

        {/* Bio */}
        {worker.bio && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              About Technician
            </h4>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
              {worker.bio}
            </p>
          </div>
        )}

        {/* Services & Rate Card */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Specialized Services & Upfront Pricing</span>
            <span className="text-[11px] font-normal text-slate-400">
              {services.length} services offered
            </span>
          </h4>

          {loading ? (
            <div className="py-4 text-center text-xs text-slate-400">Loading services...</div>
          ) : services.length > 0 ? (
            <div className="space-y-2">
              {services.map((svc) => (
                <div
                  key={svc.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors"
                >
                  <div className="space-y-0.5 pr-2">
                    <span className="text-sm font-semibold text-slate-900 block">
                      {svc.name}
                    </span>
                    {svc.description && (
                      <span className="text-xs text-slate-500 block">
                        {svc.description}
                      </span>
                    )}
                    {svc.estimated_time && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> Est. {svc.estimated_time}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-slate-900 block">
                      ₹{svc.base_price}
                    </span>
                    <span className="text-[10px] text-slate-400">Base rate</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
              Standard hourly service model applies for unlisted tasks.
            </p>
          )}
        </div>

        {/* Customer Reviews Section */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Customer Feedback ({reviews.length})</span>
          </h4>

          {reviews.length > 0 ? (
            <div className="space-y-2">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      {rev.customer_name}
                    </span>
                    <div className="flex items-center gap-1 text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${
                            i < rev.rating
                              ? 'fill-amber-400 stroke-amber-400'
                              : 'stroke-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {rev.comment && (
                    <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                  )}
                  <span className="text-[10px] text-slate-400 block">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl">
              No public reviews yet for this simulation profile.
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onRequestQuote(worker);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Request Direct Quote</span>
          </button>
        </div>
      </div>
    </dialog>
  );
};
