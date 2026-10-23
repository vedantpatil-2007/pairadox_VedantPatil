import React from 'react';
import {
  Star,
  MapPin,
  Clock,
  ShieldCheck,
  Zap,
  Droplet,
  Sparkles,
  Paintbrush,
  ChevronRight,
  Send,
} from 'lucide-react';
import { Worker, Trade } from '../types';
import { formatDistance } from '../lib/geo';

interface WorkerCardProps {
  worker: Worker;
  onViewProfile: (worker: Worker) => void;
  onRequestQuote: (worker: Worker) => void;
}

export const getTradeBadge = (trade: Trade) => {
  switch (trade) {
    case 'electrician':
      return {
        label: 'Electrician',
        icon: Zap,
        color: 'bg-amber-100 text-amber-800 border-amber-300',
      };
    case 'plumber':
      return {
        label: 'Plumber',
        icon: Droplet,
        color: 'bg-blue-100 text-blue-800 border-blue-300',
      };
    case 'cleaner':
      return {
        label: 'Home Cleaner',
        icon: Sparkles,
        color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      };
    case 'painter':
      return {
        label: 'Painter',
        icon: Paintbrush,
        color: 'bg-purple-100 text-purple-800 border-purple-300',
      };
  }
};

export const WorkerCard: React.FC<WorkerCardProps> = ({
  worker,
  onViewProfile,
  onRequestQuote,
}) => {
  const tradeInfo = getTradeBadge(worker.trade);
  const TradeIcon = tradeInfo.icon;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 hover:border-brand-300 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between group">
      <div>
        {/* Top Header: Avatar, Name & Trade */}
        <div className="flex items-start gap-3.5">
          <div className="relative shrink-0">
            <img
              src={worker.avatar_url}
              alt={worker.name}
              className="w-14 h-14 rounded-2xl object-cover ring-2 ring-slate-100 shadow-xs"
              loading="lazy"
            />
            <span
              className="absolute -bottom-1 -right-1 p-1 rounded-full bg-white shadow-xs border border-slate-100"
              title="Verified Demo Simulation Profile"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${tradeInfo.color}`}
              >
                <TradeIcon className="w-3 h-3" />
                <span>{tradeInfo.label}</span>
              </span>

              {/* Fictional Demo Badge */}
              <span className="inline-flex items-center text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                Demo Profile
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900 mt-1 truncate group-hover:text-brand-600 transition-colors">
              {worker.name}
            </h3>

            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
              <div className="flex items-center gap-1 text-amber-500 font-semibold">
                <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
                <span className="text-slate-900">{worker.rating.toFixed(1)}</span>
                <span className="text-slate-400 font-normal">({worker.review_count})</span>
              </div>
              <span className="text-slate-300">•</span>
              <span>{worker.experience_years} yrs exp</span>
            </div>
          </div>
        </div>

        {/* Hyperlocal Proximity & Rate */}
        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 p-2 rounded-xl">
            <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
            <div className="truncate">
              <span className="font-semibold block text-slate-900">
                {worker.distance_km !== undefined
                  ? formatDistance(worker.distance_km)
                  : worker.city}
              </span>
              <span className="text-[10px] text-slate-400 truncate block">
                {worker.address}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 p-2 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-semibold block text-slate-900">
                ₹{worker.hourly_rate}
                <span className="text-[10px] font-normal text-slate-500">/hr</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-medium block">
                Base inspection
              </span>
            </div>
          </div>
        </div>

        {/* Bio snippet */}
        {worker.bio && (
          <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {worker.bio}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onViewProfile(worker)}
          className="flex-1 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors text-center focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
        >
          View Rates & Info
        </button>
        <button
          type="button"
          onClick={() => onRequestQuote(worker)}
          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
        >
          <Send className="w-3 h-3" />
          <span>Request Quote</span>
        </button>
      </div>
    </div>
  );
};
