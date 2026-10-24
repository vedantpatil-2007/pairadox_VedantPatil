import React, { useState } from 'react';
import {
  Wrench,
  MapPin,
  Database,
  User,
  HardHat,
  ShieldCheck,
  LogIn,
  LogOut,
  Sparkles,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { UserLocation, Worker } from '../types';
import { SupabaseConnectionResult, AuthUser } from '../lib/supabase';

export interface NavbarProps {
  currentRole: 'customer' | 'worker';
  onRoleChange: (role: 'customer' | 'worker') => void;
  activeWorker: Worker | null;
  onSelectWorker: (worker: Worker) => void;
  workers: Worker[];
  currentLocation: UserLocation;
  onOpenLocationModal: () => void;
  onOpenSetupModal: () => void;
  isLiveDatabase: boolean;
  dbStatus?: SupabaseConnectionResult;
  currentUser?: AuthUser | null;
  onOpenAuthModal?: (tab?: 'signin' | 'register') => void;
  onSignOut?: () => void;
  onResetDemo?: () => void;
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
  dbStatus,
  currentUser,
  onOpenAuthModal,
  onSignOut,
  activeTab,
  onSelectTab,
  onOpenNewRequest,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine accurate database status display
  const isOperationsVerified = Boolean(isLiveDatabase || dbStatus?.operationsVerified);
  const isReachable = Boolean(dbStatus?.isConnected);

  let statusLabel = 'Preview Mode';
  let statusBadgeColor = 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100';
  let statusDotColor = 'bg-amber-500';

  if (isOperationsVerified) {
    statusLabel = 'Supabase Live';
    statusBadgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100';
    statusDotColor = 'bg-emerald-500 animate-pulse';
  } else if (isReachable) {
    statusLabel = 'Connected (Local)';
    statusBadgeColor = 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100';
    statusDotColor = 'bg-sky-500';
  }

  const handleNavClick = (tab: string) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-900 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ROW 1: BRAND, LOCATION, CONTROLS, PORTAL TOGGLE & POST JOB */}
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNavClick('workers')}
              className="flex items-center gap-2.5 text-left group focus:outline-hidden cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold tracking-tight text-slate-900">
                    Skill<span className="text-brand-600">Near</span>
                  </span>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                    Verified Hyperlocal
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
                <p className="text-[11px] text-slate-500 hidden xl:block">
                  Local services. Clear agreements. Fair pricing.
                </p>
              </div>
            </button>
          </div>

          {/* Hyperlocal Location Pill */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onOpenLocationModal}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-full transition-colors border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 cursor-pointer"
              title="Click to change your location or use GPS"
            >
              <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <span className="max-w-[90px] sm:max-w-[140px] md:max-w-[180px] truncate text-slate-800">
                {currentLocation.name}
              </span>
              <span className="text-[10px] text-slate-400 hidden lg:inline">
                (Change)
              </span>
            </button>
          </div>

          {/* Controls: DB Status, Portal Switcher, Pro Selector, Post Job & Auth */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Database Connection Pill */}
            <button
              type="button"
              onClick={onOpenSetupModal}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer ${statusBadgeColor}`}
              title="Click to view database connection status and SQL migration script"
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline font-medium">
                {statusLabel}
              </span>
              <span className={`w-2 h-2 rounded-full ${statusDotColor}`} />
            </button>

            {/* Persona / Portal Switcher Pill - ALWAYS VISIBLE */}
            <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => onRoleChange('customer')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currentRole === 'customer'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3 h-3" />
                <span>Customer</span>
              </button>

              <button
                type="button"
                onClick={() => onRoleChange('worker')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currentRole === 'worker'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HardHat className="w-3 h-3" />
                <span>Worker Portal</span>
              </button>
            </div>

            {/* Active Worker Dropdown in Worker Portal */}
            {currentRole === 'worker' && workers.length > 0 && (
              <div className="hidden lg:flex items-center bg-slate-100 rounded-xl px-2.5 py-1 border border-slate-200 text-xs">
                <span className="text-slate-500 mr-1.5 text-[11px] whitespace-nowrap">Pro:</span>
                <select
                  value={activeWorker?.id || ''}
                  onChange={(e) => {
                    const w = workers.find((x) => x.id === e.target.value);
                    if (w) onSelectWorker(w);
                  }}
                  className="bg-transparent font-semibold text-slate-800 border-none focus:outline-hidden cursor-pointer max-w-[130px] truncate"
                  aria-label="Select active worker profile"
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.trade})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Customer Post Job Button - ALWAYS VISIBLE in Customer Mode */}
            {currentRole === 'customer' && (
              <button
                type="button"
                onClick={onOpenNewRequest}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Post Job</span>
              </button>
            )}

            {/* Discreet Authentication / Profile Pill */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800">
                <div className="flex items-center gap-1.5">
                  {currentRole === 'worker' ? (
                    <HardHat className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-brand-600" />
                  )}
                  <span className="max-w-[75px] sm:max-w-[110px] truncate font-semibold text-slate-900">
                    {currentUser.name || currentUser.email?.split('@')[0]}
                  </span>
                </div>

                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer ml-1"
                    title="Sign Out"
                    aria-label="Sign out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuthModal?.('signin')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-500" />
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ROW 2: APPLICATION NAVIGATION TABS BAR - ALWAYS VISIBLE */}
        <div className="flex items-center justify-between overflow-x-auto no-scrollbar py-2 border-t border-slate-100 gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            {currentRole === 'customer' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleNavClick('workers')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'workers'
                      ? 'bg-brand-50 text-brand-700 font-semibold border border-brand-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Browse Workers
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('requests')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'requests'
                      ? 'bg-brand-50 text-brand-700 font-semibold border border-brand-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  My Requests & Quotes
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('bookings')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'bookings'
                      ? 'bg-brand-50 text-brand-700 font-semibold border border-brand-200'
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
                  onClick={() => handleNavClick('dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-brand-50 text-brand-700 font-semibold border border-brand-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Nearby Job Leads
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('worker-quotes')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'worker-quotes'
                      ? 'bg-brand-50 text-brand-700 font-semibold border border-brand-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  My Quotes & Counteroffers
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('worker-bookings')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === 'worker-bookings'
                      ? 'bg-brand-50 text-brand-700 font-semibold border border-brand-200'
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

        {/* MOBILE NAVIGATION DROPDOWN MENU */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200 space-y-3">
            {/* Mobile Portal Switcher */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onRoleChange('customer');
                  setMobileMenuOpen(false);
                }}
                className={`p-2 rounded-lg text-xs font-semibold text-center cursor-pointer ${
                  currentRole === 'customer' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Customer Portal
              </button>
              <button
                type="button"
                onClick={() => {
                  onRoleChange('worker');
                  setMobileMenuOpen(false);
                }}
                className={`p-2 rounded-lg text-xs font-semibold text-center cursor-pointer ${
                  currentRole === 'worker' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Worker Portal
              </button>
            </div>

            {/* Mobile Tabs */}
            {currentRole === 'customer' ? (
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleNavClick('workers')}
                  className={`p-2 rounded-lg text-xs font-semibold text-center cursor-pointer ${
                    activeTab === 'workers' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Workers
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('requests')}
                  className={`p-2 rounded-lg text-xs font-semibold text-center cursor-pointer ${
                    activeTab === 'requests' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Requests
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('bookings')}
                  className={`p-2 rounded-lg text-xs font-semibold text-center cursor-pointer ${
                    activeTab === 'bookings' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Bookings
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleNavClick('dashboard')}
                  className={`p-2 rounded-lg text-xs font-semibold text-center cursor-pointer ${
                    activeTab === 'dashboard' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Job Leads
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('worker-quotes')}
                  className={`p-2 rounded-lg text-xs font-semibold text-center cursor-pointer ${
                    activeTab === 'worker-quotes' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Quotes
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('worker-bookings')}
                  className={`p-2 rounded-lg text-xs font-semibold text-center cursor-pointer ${
                    activeTab === 'worker-bookings' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Bookings
                </button>
              </div>
            )}

            {/* Mobile Post Job Action */}
            {currentRole === 'customer' && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenNewRequest();
                }}
                className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-brand-200" />
                <span>Post a Job Request</span>
              </button>
            )}

            {/* Mobile Auth Actions */}
            <div className="pt-2 border-t border-slate-200">
              {currentUser ? (
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-800">
                    Signed in: {currentUser.name || currentUser.email}
                  </div>
                  {onSignOut && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onSignOut();
                      }}
                      className="py-1 px-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer"
                    >
                      Sign Out
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuthModal?.('signin');
                  }}
                  className="w-full py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl text-center border border-slate-200 cursor-pointer"
                >
                  Sign In / Create Account
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
