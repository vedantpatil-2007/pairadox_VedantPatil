import React, { useCallback, useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { BannerDisclaimer } from './components/BannerDisclaimer';
import { WorkerList } from './components/WorkerList';
import { CustomerQuotesView } from './components/CustomerQuotesView';
import { CustomerBookingsView } from './components/CustomerBookingsView';
import { WorkerDashboard } from './components/WorkerDashboard';
import { LocationModal } from './components/LocationModal';
import { SetupModal } from './components/SetupModal';
import { PostRequestModal } from './components/PostRequestModal';
import { WorkerProfileModal } from './components/WorkerProfileModal';
import { CounterofferModal } from './components/CounterofferModal';
import { ConfirmBookingModal } from './components/ConfirmBookingModal';
import { ReviewModal } from './components/ReviewModal';
import { SubmitQuoteModal } from './components/SubmitQuoteModal';
import { QuoteComparisonModal } from './components/QuoteComparisonModal';
import { ProposeChangeOrderModal } from './components/ProposeChangeOrderModal';
import { RepairPassportModal } from './components/RepairPassportModal';
import { AuthModal } from './components/AuthModal';
import { ToastContainer, ToastMessage } from './components/Toast';

import { Worker, ServiceRequest, Quote, Booking, UserLocation, Review } from './types';
import { DEFAULT_LOCATION } from './lib/geo';
import { api } from './services/api';
import {
  isSupabaseConfigured,
  getSupabaseConfigStatus,
  SupabaseConnectionResult,
  AuthUser,
} from './lib/supabase';

const getInitialStoredSession = (): AuthUser | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem('skillnear_demo_session_v2');
      if (stored) {
        return JSON.parse(stored) as AuthUser;
      }
    } catch {
      // Ignore storage errors
    }
  }
  return null;
};

export function App() {
  // Global Data State
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Navigation & Role State
  const initialUser = getInitialStoredSession();
  const [currentRole, setCurrentRole] = useState<'customer' | 'worker'>(initialUser?.role || 'customer');
  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  const [activeTab, setActiveTab] = useState<'workers' | 'requests' | 'bookings'>('workers');
  const [activeWorkerTab, setActiveWorkerTab] = useState<'dashboard' | 'worker-quotes' | 'worker-bookings'>('dashboard');

  // Authenticated User & Auth Modal State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(initialUser);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalInitialTab, setAuthModalInitialTab] = useState<'signin' | 'register'>('signin');

  // Hyperlocal Location State
  const [currentLocation, setCurrentLocation] = useState<UserLocation>(DEFAULT_LOCATION);

  // Status & Errors
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiveDatabase, setIsLiveDatabase] = useState(false);
  const [dbStatus, setDbStatus] = useState<SupabaseConnectionResult>(() => ({
    isConfigured: getSupabaseConfigStatus().isConfigured,
    isConnected: false,
    operationsVerified: false,
    url: getSupabaseConfigStatus().url,
  }));

  // Modal States
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [postRequestModalOpen, setPostRequestModalOpen] = useState(false);
  const [preselectedWorker, setPreselectedWorker] = useState<Worker | null>(null);
  const [selectedWorkerForProfile, setSelectedWorkerForProfile] = useState<Worker | null>(null);

  const [submitQuoteModalOpen, setSubmitQuoteModalOpen] = useState(false);
  const [selectedLeadForQuote, setSelectedLeadForQuote] = useState<ServiceRequest | null>(null);

  const [counterofferModalOpen, setCounterofferModalOpen] = useState(false);
  const [selectedQuoteForCounter, setSelectedQuoteForCounter] = useState<Quote | null>(null);
  const [counterByRole, setCounterByRole] = useState<'customer' | 'worker'>('customer');

  const [confirmBookingModalOpen, setConfirmBookingModalOpen] = useState(false);
  const [selectedQuoteForBooking, setSelectedQuoteForBooking] = useState<Quote | null>(null);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<Booking | null>(null);

  // ScopeLock & FairDeal Modals
  const [quoteComparisonModalOpen, setQuoteComparisonModalOpen] = useState(false);
  const [selectedRequestForComparison, setSelectedRequestForComparison] = useState<ServiceRequest | null>(null);

  const [proposeChangeOrderModalOpen, setProposeChangeOrderModalOpen] = useState(false);
  const [selectedBookingForChangeOrder, setSelectedBookingForChangeOrder] = useState<Booking | null>(null);

  const [repairPassportModalOpen, setRepairPassportModalOpen] = useState(false);
  const [selectedBookingForPassport, setSelectedBookingForPassport] = useState<Booking | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch all initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Verify 3-tier health status: configured, reachable, verified
      const health = await api.getHealthStatus();
      setDbStatus(health);
      setIsLiveDatabase(health.operationsVerified);

      // 2. Restore active session
      const user = await api.getCurrentUser();
      setCurrentUser(user);
      if (user?.role) {
        setCurrentRole(user.role);
      }

      // 3. Load application data
      const [workersRes, requestsRes, quotesRes, bookingsRes] = await Promise.all([
        api.getWorkers(),
        api.getServiceRequests(),
        api.getQuotes(),
        api.getBookings(),
      ]);

      setWorkers(workersRes.data);
      setRequests(requestsRes.data);
      setQuotes(quotesRes.data);
      setBookings(bookingsRes.data);

      // Default active worker persona if not set
      if (!activeWorker && workersRes.data.length > 0) {
        const plumber = workersRes.data.find((w: Worker) => w.trade === 'plumber') || workersRes.data[0];
        setActiveWorker(plumber);
      }
    } catch (err: unknown) {
      console.error('Error loading SkillNear data:', err);
      setError('Unable to load technicians and jobs. Showing local data.');
    } finally {
      setLoading(false);
    }
  }, [activeWorker]);

  const handleRefreshConnection = useCallback(async () => {
    const health = await api.getHealthStatus();
    setDbStatus(health);
    setIsLiveDatabase(health.operationsVerified);
    if (health.operationsVerified) {
      addToast({
        type: 'success',
        title: 'Supabase Live Verified!',
        description: 'Persistent PostgreSQL storage is verified and active.',
      });
      loadData();
    } else if (health.isReachable) {
      addToast({
        type: 'info',
        title: 'Supabase Connected (Simulated Writes)',
        description: 'PostgreSQL endpoint reachable. Corrective migration pending execution.',
      });
      loadData();
    } else if (health.isConfigured) {
      addToast({
        type: 'error',
        title: 'Database Endpoint Unreachable',
        description: health.error || 'Please verify network and database configuration.',
      });
    } else {
      addToast({
        type: 'info',
        title: 'Demo Simulation Active',
        description: 'Operating in local browser storage demo mode.',
      });
    }
  }, [addToast, loadData]);

  const handleResetDemoData = useCallback(() => {
    api.resetDemoData();
    addToast({
      type: 'info',
      title: 'Demo Data Reset',
      description: 'Restored all requests, quotes, bookings, and worker rating baselines to clean seed fixtures.',
    });
    loadData();
  }, [addToast, loadData]);

  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    if (user.role) {
      setCurrentRole(user.role);
    }
    setAuthModalOpen(false);
    addToast({
      type: 'success',
      title: `Signed in as ${user.name || user.email}`,
      description: user.is_demo
        ? 'Operating in simulated demo session.'
        : 'Authenticated with Supabase Auth.',
    });
    loadData();
  };

  const handleSignOut = async () => {
    await api.signOut();
    setCurrentUser(null);
    addToast({
      type: 'info',
      title: 'Signed Out',
      description: 'Browsing public marketplace as guest.',
    });
    loadData();
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Modal Handlers
  const handleOpenPostRequest = (worker: Worker | null = null) => {
    setPreselectedWorker(worker);
    setPostRequestModalOpen(true);
  };

  const handleRequestCreated = (_requestId: string) => {
    addToast({
      type: 'success',
      title: 'Job Request Broadcasted!',
      description: 'Saved and broadcasted. Nearby verified technicians can now review your job and send quotes.',
    });
    loadData();
    setActiveTab('requests');
  };

  const handleOpenCounteroffer = (quote: Quote, role: 'customer' | 'worker') => {
    setSelectedQuoteForCounter(quote);
    setCounterByRole(role);
    setCounterofferModalOpen(true);
  };

  const handleCounterSubmitted = (updatedQuote: Quote) => {
    addToast({
      type: 'success',
      title: 'Counteroffer Sent Successfully!',
      description: `Proposed new rate of ₹${updatedQuote.counter_amount}. Awaiting response.`,
    });
    loadData();
  };

  const handleOpenConfirmBooking = (quote: Quote) => {
    setSelectedQuoteForBooking(quote);
    setConfirmBookingModalOpen(true);
  };

  const handleBookingConfirmed = (_newBooking: Booking) => {
    addToast({
      type: 'success',
      title: 'Booking Confirmed!',
      description: 'Technician has been notified. Track updates in your active bookings.',
    });
    loadData();
    setActiveTab('bookings');
  };

  const handleOpenReview = (booking: Booking) => {
    setSelectedBookingForReview(booking);
    setReviewModalOpen(true);
  };

  const handleReviewSubmitted = (review: Review) => {
    addToast({
      type: 'success',
      title: 'Review & Rating Submitted!',
      description: `Thank you for rating ${review.rating} stars! Feedback helps build transparency.`,
    });
    loadData();
  };

  const handleOpenQuoteComparison = (request: ServiceRequest) => {
    setSelectedRequestForComparison(request);
    setQuoteComparisonModalOpen(true);
  };

  const handleOpenChangeOrder = (booking: Booking) => {
    setSelectedBookingForChangeOrder(booking);
    setProposeChangeOrderModalOpen(true);
  };

  const handleChangeOrderProposed = (_updatedBooking: Booking) => {
    addToast({
      type: 'success',
      title: 'Change-Order Submitted!',
      description: 'Work is paused pending customer approval. Price adjustment locked.',
    });
    loadData();
  };

  const handleOpenRepairPassport = (booking: Booking) => {
    setSelectedBookingForPassport(booking);
    setRepairPassportModalOpen(true);
  };

  const handleQuoteSubmitted = (_newQuote: Quote) => {
    addToast({
      type: 'success',
      title: 'Quote Sent to Customer!',
      description: 'Your quote with ScopeLock breakdown has been delivered to the customer.',
    });
    loadData();
    setActiveWorkerTab('worker-quotes');
  };

  // DIRECT APPLICATION VIEW: ALWAYS OPEN TO MARKETPLACE
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      {/* Application Navbar */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={(role) => {
          setCurrentRole(role);
          addToast({
            type: 'info',
            title: role === 'customer' ? 'Customer Mode Active' : 'Worker Portal Active',
            description:
              role === 'customer'
                ? 'Search nearby technicians, post jobs & view quotes.'
                : 'Browse incoming job leads & submit quotes.',
          });
        }}
        activeWorker={activeWorker}
        onSelectWorker={(w) => {
          setActiveWorker(w);
          addToast({
            type: 'info',
            title: `Active Technician: ${w.name}`,
            description: `Switched trade to ${w.trade.toUpperCase()}`,
          });
        }}
        workers={workers}
        currentLocation={currentLocation}
        onOpenLocationModal={() => setLocationModalOpen(true)}
        onOpenSetupModal={() => setSetupModalOpen(true)}
        isLiveDatabase={isLiveDatabase}
        dbStatus={dbStatus}
        currentUser={currentUser}
        onOpenAuthModal={(tab) => {
          setAuthModalInitialTab(tab || 'signin');
          setAuthModalOpen(true);
        }}
        onSignOut={handleSignOut}
        onResetDemo={handleResetDemoData}
        activeTab={currentRole === 'customer' ? activeTab : activeWorkerTab}
        onSelectTab={(tab) => {
          if (currentRole === 'customer') {
            setActiveTab(tab as 'workers' | 'requests' | 'bookings');
          } else {
            setActiveWorkerTab(tab as 'dashboard' | 'worker-quotes' | 'worker-bookings');
          }
        }}
        onOpenNewRequest={() => handleOpenPostRequest(null)}
      />

      {/* Persistent Hackathon & Database Notice Banner */}
      <BannerDisclaimer
        isLiveDatabase={isLiveDatabase}
        dbStatus={dbStatus}
        onOpenSetupModal={() => setSetupModalOpen(true)}
        onResetDemo={handleResetDemoData}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {currentRole === 'customer' ? (
          <>
            {activeTab === 'workers' && (
              <WorkerList
                workers={workers}
                loading={loading}
                error={error}
                currentLocation={currentLocation}
                onRefresh={loadData}
                onViewProfile={(w) => {
                  setSelectedWorkerForProfile(w);
                }}
                onRequestQuote={(w) => {
                  handleOpenPostRequest(w);
                }}
                onOpenNewRequest={() => handleOpenPostRequest(null)}
              />
            )}

            {activeTab === 'requests' && (
              <CustomerQuotesView
                requests={requests}
                quotes={quotes}
                loading={loading}
                onOpenNewRequest={() => handleOpenPostRequest(null)}
                onOpenConfirmBooking={handleOpenConfirmBooking}
                onOpenCounteroffer={(q: Quote) => handleOpenCounteroffer(q, 'customer')}
                onOpenCompareQuotes={handleOpenQuoteComparison}
              />
            )}

            {activeTab === 'bookings' && (
              <CustomerBookingsView
                bookings={bookings}
                loading={loading}
                onRefreshBookings={loadData}
                onOpenReviewModal={handleOpenReview}
                onOpenRepairPassport={handleOpenRepairPassport}
              />
            )}
          </>
        ) : (
          (activeWorker || workers[0]) ? (
            <WorkerDashboard
              worker={activeWorker || workers[0]}
              requests={requests}
              quotes={quotes}
              bookings={bookings}
              loading={loading}
              activeWorkerTab={activeWorkerTab}
              onSelectWorkerTab={setActiveWorkerTab}
              onOpenSubmitQuote={(req: ServiceRequest) => {
                setSelectedLeadForQuote(req);
                setSubmitQuoteModalOpen(true);
              }}
              onOpenCounteroffer={(q: Quote) => handleOpenCounteroffer(q, 'worker')}
              onRefreshData={loadData}
              allWorkers={workers}
              onSelectWorker={(w: Worker) => setActiveWorker(w)}
              onOpenProposeChangeOrder={handleOpenChangeOrder}
              onOpenRepairPassport={handleOpenRepairPassport}
            />
          ) : (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Loading service provider workspace...</p>
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">SkillNear</span>
            <span>•</span>
            <span>Hyperlocal Blue-Collar Services Platform</span>
          </div>

          <div className="text-center sm:text-right">
            <span>Local services. Clear agreements. Fair pricing.</span> •{' '}
            <button
              type="button"
              onClick={() => setSetupModalOpen(true)}
              className="text-brand-600 hover:text-brand-800 font-semibold underline underline-offset-2 cursor-pointer"
            >
              Database & Storage Setup
            </button>
          </div>
        </div>
      </footer>

      {/* Interactive Global Modals */}
      <LocationModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        currentLocation={currentLocation}
        onSelectLocation={(loc) => {
          setCurrentLocation(loc);
          addToast({
            type: 'info',
            title: `Location Updated: ${loc.name}`,
            description: 'Recalculating distances to all technicians in your neighborhood.',
          });
        }}
      />

      <SetupModal
        isOpen={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        dbStatus={dbStatus}
        onRefreshConnection={handleRefreshConnection}
        onResetDemo={handleResetDemoData}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        initialTab={authModalInitialTab}
        initialRole={currentRole}
      />

      <PostRequestModal
        isOpen={postRequestModalOpen}
        onClose={() => {
          setPostRequestModalOpen(false);
          setPreselectedWorker(null);
        }}
        currentLocation={currentLocation}
        preselectedWorker={preselectedWorker}
        onRequestCreated={handleRequestCreated}
      />

      <WorkerProfileModal
        worker={selectedWorkerForProfile}
        isOpen={Boolean(selectedWorkerForProfile)}
        onClose={() => setSelectedWorkerForProfile(null)}
        onRequestQuote={(w) => {
          setSelectedWorkerForProfile(null);
          handleOpenPostRequest(w);
        }}
      />

      <SubmitQuoteModal
        request={selectedLeadForQuote}
        worker={activeWorker}
        isOpen={submitQuoteModalOpen}
        onClose={() => {
          setSubmitQuoteModalOpen(false);
          setSelectedLeadForQuote(null);
        }}
        onQuoteSubmitted={handleQuoteSubmitted}
      />

      <CounterofferModal
        quote={selectedQuoteForCounter}
        isOpen={counterofferModalOpen}
        onClose={() => {
          setCounterofferModalOpen(false);
          setSelectedQuoteForCounter(null);
        }}
        byRole={counterByRole}
        onCounterSubmitted={handleCounterSubmitted}
      />

      <ConfirmBookingModal
        quote={selectedQuoteForBooking}
        isOpen={confirmBookingModalOpen}
        onClose={() => {
          setConfirmBookingModalOpen(false);
          setSelectedQuoteForBooking(null);
        }}
        onBookingConfirmed={handleBookingConfirmed}
      />

      <ReviewModal
        booking={selectedBookingForReview}
        isOpen={reviewModalOpen}
        onClose={() => {
          setReviewModalOpen(false);
          setSelectedBookingForReview(null);
        }}
        onReviewSubmitted={handleReviewSubmitted}
      />

      {/* ScopeLock & FairDeal Modals */}
      <QuoteComparisonModal
        request={selectedRequestForComparison}
        quotes={quotes}
        isOpen={quoteComparisonModalOpen}
        onClose={() => {
          setQuoteComparisonModalOpen(false);
          setSelectedRequestForComparison(null);
        }}
        onAcceptQuote={(quote) => {
          setQuoteComparisonModalOpen(false);
          handleOpenConfirmBooking(quote);
        }}
        onCounteroffer={(quote) => {
          setQuoteComparisonModalOpen(false);
          handleOpenCounteroffer(quote, 'customer');
        }}
      />

      <ProposeChangeOrderModal
        booking={selectedBookingForChangeOrder}
        isOpen={proposeChangeOrderModalOpen}
        onClose={() => {
          setProposeChangeOrderModalOpen(false);
          setSelectedBookingForChangeOrder(null);
        }}
        onSuccess={handleChangeOrderProposed}
      />

      <RepairPassportModal
        booking={selectedBookingForPassport}
        isOpen={repairPassportModalOpen}
        onClose={() => {
          setRepairPassportModalOpen(false);
          setSelectedBookingForPassport(null);
        }}
      />

      {/* Floating Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
