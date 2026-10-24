import React from 'react';
import {
  Wrench,
  Zap,
  Droplet,
  Sparkles,
  Paintbrush,
  MapPin,
  Database,
  User,
  HardHat,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import { UserLocation, Worker } from '../types';

interface NavbarProps {
  currentRole: 'customer' | 'worker';
  onRoleChange: (role: 'customer' | 'worker') => void;
  activeWorker: Worker | null;
  onSelectWorker: (worker: Worker) => void;
  workers: Worker[];
  currentLocation: UserLocation;
  onOpenLocationModal: () => void;
  onOpenSetupModal: () => void;
  isLiveDatabase: boolean;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenNewRequest: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  activeWorker,
  onSelectWorker,
  workers,
  currentLocation,
  onOpenLocationModal,
  onOpenSetupModal,
  isLiveDatabase,
  activeTab,
  onSelectTab,
  onOpenNewRequest,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
          {/* Logo & Platform Tag */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  Skill<span className="text-brand-600">Near</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                  PS03 Hyperlocal
                </span>
                <span
                  className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                  title="ScopeLock + FairDeal: Clear scope. Comparable quotes. No unapproved changes."
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>ScopeLock™ + FairDeal™</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                On-Demand Blue-Collar Services Platform
              </p>
            </div>
          </div>

          {/* Hyperlocal Location Pill */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={onOpenLocationModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-full transition-colors border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              title="Click to change your location or use GPS"
            >
              <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <span className="max-w-[110px] sm:max-w-[160px] md:max-w-[200px] truncate text-slate-800">
                {currentLocation.name}
              </span>
              <span className="text-[10px] text-slate-400 hidden lg:inline">
                (Change)
              </span>
            </button>
          </div>

          {/* Persona & System Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Database Connection Pill */}
            <button
              type="button"
              onClick={onOpenSetupModal}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                isLiveDatabase
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
              title="Click to view database connection status and SQL migration script"
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">
                {isLiveDatabase ? 'Supabase Live' : 'Preview Mode'}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveDatabase ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
            </button>

            {/* Persona Switcher Dropdown */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => onRoleChange('customer')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  currentRole === 'customer'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Customer</span>
              </button>

              <button
                type="button"
                onClick={() => onRoleChange('worker')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  currentRole === 'worker'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HardHat className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Worker Portal</span>
              </button>
            </div>

            {/* If in worker role, provide worker profile picker */}
            {currentRole === 'worker' && workers.length > 0 && (
              <div className="relative hidden lg:block">
                <select
                  value={activeWorker?.id || ''}
                  onChange={(e) => {
                    const found = workers.find((w) => w.id === e.target.value);
                    if (found) onSelectWorker(found);
                  }}
                  className="text-xs bg-white border border-slate-300 rounded-lg py-1.5 pl-2.5 pr-7 font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500 cursor-pointer"
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.trade})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Customer Post Request Action */}
            {currentRole === 'customer' && (
              <button
                type="button"
                onClick={onOpenNewRequest}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Post Job</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between overflow-x-auto no-scrollbar py-2 border-t border-slate-100 gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            {currentRole === 'customer' ? (
              <>
                <button
                  type="button"
                  onClick={() => onSelectTab('workers')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'workers'
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Browse Workers
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTab('requests')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'requests'
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  My Requests & Quotes
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTab('bookings')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'bookings'
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Active Bookings & Reviews
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelectTab('dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'dashboard'
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Nearby Job Leads
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTab('worker-quotes')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'worker-quotes'
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  My Quotes & Counteroffers
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTab('worker-bookings')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'worker-bookings'
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Assigned Bookings
                </button>
              </>
            )}
          </div>

          {currentRole === 'worker' && activeWorker && (
            <div className="text-xs text-slate-500 flex items-center gap-1.5 shrink-0 pl-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                Acting as: <strong className="text-slate-700">{activeWorker.name}</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
