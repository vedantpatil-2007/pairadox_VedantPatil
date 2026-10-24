import React, { useMemo, useState } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Sparkles,
  MapPin,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Worker, Trade, UserLocation } from '../types';
import { WorkerCard } from './WorkerCard';
import { calculateDistanceKm } from '../lib/geo';
import { SERVICE_CATEGORIES, getCategoryById } from '../data/categories';

interface WorkerListProps {
  workers: Worker[];
  loading: boolean;
  error: string | null;
  currentLocation: UserLocation;
  onRefresh: () => void;
  onViewProfile: (worker: Worker) => void;
  onRequestQuote: (worker: Worker) => void;
  onOpenNewRequest: () => void;
}

type SortOption = 'distance' | 'rating' | 'rate_low' | 'experience';

export const WorkerList: React.FC<WorkerListProps> = ({
  workers,
  loading,
  error,
  currentLocation,
  onRefresh,
  onViewProfile,
  onRequestQuote,
  onOpenNewRequest,
}) => {
  const [selectedTrade, setSelectedTrade] = useState<Trade | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('distance');

  // Compute workers with calculated distance from current selected location
  const enrichedWorkers = useMemo(() => {
    return workers.map((w) => {
      const distance = calculateDistanceKm(
        currentLocation.lat,
        currentLocation.lng,
        w.latitude,
        w.longitude
      );
      return {
        ...w,
        distance_km: distance,
      };
    });
  }, [workers, currentLocation]);

  // Filter and Sort
  const filteredAndSortedWorkers = useMemo(() => {
    let result = enrichedWorkers;

    // Filter by trade (supporting primary trade and secondary capabilities)
    if (selectedTrade !== 'all') {
      result = result.filter(
        (w) => w.trade === selectedTrade || (w.secondary_trades && w.secondary_trades.includes(selectedTrade))
      );
    }

    // Filter by search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.trade.toLowerCase().includes(q) ||
          w.address.toLowerCase().includes(q) ||
          (w.bio && w.bio.toLowerCase().includes(q)) ||
          (w.skills && w.skills.some((s) => s.toLowerCase().includes(q)))
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          return (a.distance_km ?? 999) - (b.distance_km ?? 999);
        case 'rating':
          return b.rating - a.rating;
        case 'rate_low':
          return a.hourly_rate - b.hourly_rate;
        case 'experience':
          return b.experience_years - a.experience_years;
        default:
          return 0;
      }
    });

    return result;
  }, [enrichedWorkers, selectedTrade, searchQuery, sortBy]);

  // Dynamic 10-category list with matching provider counts
  const categoryPills = useMemo(() => {
    return [
      { id: 'all' as const, label: 'All Services', icon: Sparkles, count: enrichedWorkers.length },
      ...SERVICE_CATEGORIES.map((cat) => ({
        id: cat.id,
        label: cat.pluralLabel,
        icon: cat.icon,
        count: enrichedWorkers.filter(
          (w) => w.trade === cat.id || (w.secondary_trades && w.secondary_trades.includes(cat.id))
        ).length,
      })),
    ];
  }, [enrichedWorkers]);

  const activeCategoryMeta = selectedTrade !== 'all' ? getCategoryById(selectedTrade) : null;

  return (
    <div className="space-y-6">
      {/* 1. HERO WELCOME & BROADCAST CTA (Original SkillNear Theme) */}
      <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur-xs border border-white/20">
            <MapPin className="w-3.5 h-3.5 text-brand-300" />
            <span>Hyperlocal Service Hub: <strong>{currentLocation.name}</strong></span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            On-Demand Blue-Collar Technicians Near You
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Need urgent home repairs? Browse nearby certified specialists or broadcast your
            job to receive direct competitive quotes in minutes.
          </p>

          <div className="pt-2 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={onOpenNewRequest}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-brand-200" />
              <span>Broadcast a Job Request</span>
            </button>
          </div>

          <div className="pt-2 border-t border-white/15 flex items-center gap-2 text-xs text-brand-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>ScopeLock™ + FairDeal™:</strong> Clear scope. Comparable quotes. No unapproved changes.
            </span>
          </div>
        </div>
      </div>

      {/* 2. CATEGORY PILLS FILTER BAR (10 Core Hyperlocal Categories) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {categoryPills.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedTrade === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedTrade(cat.id as Trade | 'all')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Category Highlight Details if category is selected */}
      {activeCategoryMeta && (
        <div className="bg-sky-50/70 border border-sky-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-sky-100 text-sky-700 shrink-0 mt-0.5">
              <activeCategoryMeta.icon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sky-950 text-sm">{activeCategoryMeta.label}</span>
                {activeCategoryMeta.isTeamBased && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-200/80 text-sky-900 border border-sky-300">
                    <Users className="w-3 h-3" />
                    Crew Mode: {activeCategoryMeta.suggestedCrewSize}+ Technicians
                  </span>
                )}
              </div>
              <p className="text-slate-600 mt-0.5">{activeCategoryMeta.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenNewRequest}
            className="self-start sm:self-auto px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-xs shrink-0 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-200" />
            <span>Post in {activeCategoryMeta.shortLabel}</span>
          </button>
        </div>
      )}

      {/* 3. SEARCH & SORT CONTROLS BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by technician name, trade, skills or address..."
            className="w-full text-xs sm:text-sm pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-slate-900"
          />
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-xs bg-white border border-slate-300 rounded-xl py-2 px-2.5 font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-500 cursor-pointer"
          >
            <option value="distance">Proximity (Nearest First)</option>
            <option value="rating">Highest Rating</option>
            <option value="rate_low">Price (Lowest Inspection Rate)</option>
            <option value="experience">Most Experience</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">
            Calculating hyperlocal distances & loading providers...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3 max-w-md mx-auto">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="text-sm font-bold text-rose-900">Failed to Load Technicians</h3>
          <p className="text-xs text-rose-700">{error}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredAndSortedWorkers.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-3">
          <Filter className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No Matching Technicians Found</h3>
          <p className="text-xs text-slate-500">
            No technicians match your current search & category filter. Try clearing your search or
            changing your location.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedTrade('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-xl transition-colors cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Workers Grid */}
      {!loading && !error && filteredAndSortedWorkers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAndSortedWorkers.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onViewProfile={onViewProfile}
              onRequestQuote={onRequestQuote}
            />
          ))}
        </div>
      )}
    </div>
  );
};
