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
import { ToastContainer, ToastMessage } from './components/Toast';

import { Worker, ServiceRequest, Quote, Booking, UserLocation, Review } from './types';
import { DEFAULT_LOCATION } from './lib/geo';
import { api } from './services/api';
import { isSupabaseConfigured } from './lib/supabase';

export function App() {
  // Global Data State
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Navigation & Role State
  const [currentRole, setCurrentRole] = useState<'customer' | 'worker'>('customer');
  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  const [activeTab, setActiveTab] = useState<'workers' | 'requests' | 'bookings'>('workers');
  const [activeWorkerTab, setActiveWorkerTab] = useState<'dashboard' | 'worker-quotes' | 'worker-bookings'>('dashboard');

  // Hyperlocal Location State
  const [currentLocation, setCurrentLocation] = useState<UserLocation>(DEFAULT_LOCATION);

  // Status & Errors
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiveDatabase, setIsLiveDatabase] = useState(isSupabaseConfigured());

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
      setIsLiveDatabase(workersRes.isLiveDatabase);

      // Default active worker persona if not set
      if (!activeWorker && workersRes.data.length > 0) {
        const plumber = workersRes.data.find((w) => w.trade === 'plumber') || workersRes.data[0];
        setActiveWorker(plumber);
      }
    } catch (err: unknown) {
      console.error('Error loading SkillNear data:', err);
      setError('Unable to load technicians and jobs. Showing local offline data.');
    } finally {
      setLoading(false);
    }
  }, [activeWorker]);

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
      description: 'Nearby verified technicians can now review your job and send quotes.',
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

  const handleBookingConfirmed = (booking: Booking) => {
    addToast({
      type: 'success',
      title: 'Service Booking Confirmed!',
      description: `Appointment confirmed with ${booking.worker?.name || 'technician'} for ₹${booking.agreed_price}.`,
    });
    loadData();
    setActiveTab('bookings');
  };

  const handleOpenReviewModal = (booking: Booking) => {
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

  const handleQuoteSubmitted = (newQuote: Quote) => {
    addToast({
      type: 'success',
      title: 'Quote Sent to Customer!',
      description: `Quoted ₹${newQuote.amount}. Customer will be notified to review.`,
    });
    loadData();
    setActiveWorkerTab('worker-quotes');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Navigation Bar */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={(role) => {
          setCurrentRole(role);
          addToast({
            type: 'info',
            title: role === 'customer' ? 'Switched to Customer Experience' : 'Switched to Worker Portal',
            description:
              role === 'customer'
                ? 'Browsing as Customer Rahul Sharma'
                : `Acting as Technician ${activeWorker?.name || 'Ramesh Kumar'}`,
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
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab as 'workers' | 'requests' | 'bookings')}
        onOpenNewRequest={() => handleOpenPostRequest(null)}
      />

      {/* Persistent Hackathon & Database Notice Banner */}
      <BannerDisclaimer
        isLiveDatabase={isLiveDatabase}
        onOpenSetupModal={() => setSetupModalOpen(true)}
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
                onOpenCounteroffer={(q) => handleOpenCounteroffer(q, 'customer')}
                onOpenConfirmBooking={(q) => handleOpenConfirmBooking(q)}
              />
            )}

            {activeTab === 'bookings' && (
              <CustomerBookingsView
                bookings={bookings}
                loading={loading}
                onOpenReviewModal={(bk) => handleOpenReviewModal(bk)}
                onRefreshBookings={loadData}
              />
            )}
          </>
        ) : (
          activeWorker && (
            <WorkerDashboard
              worker={activeWorker}
              requests={requests}
              quotes={quotes}
              bookings={bookings}
              loading={loading}
              activeWorkerTab={activeWorkerTab}
              onSelectWorkerTab={setActiveWorkerTab}
              onOpenSubmitQuote={(lead) => {
                setSelectedLeadForQuote(lead);
                setSubmitQuoteModalOpen(true);
              }}
              onOpenCounteroffer={(q) => handleOpenCounteroffer(q, 'worker')}
              onRefreshData={loadData}
              allWorkers={workers}
              onSelectWorker={setActiveWorker}
            />
          )
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">SkillNear (PS03)</span>
            <span>•</span>
            <span>Hyperlocal Blue-Collar Services Platform</span>
          </div>

          <div className="text-center sm:text-right">
            <span>Hackathon Prototype</span> •{' '}
            <button
              type="button"
              onClick={() => setSetupModalOpen(true)}
              className="text-brand-600 hover:text-brand-800 font-semibold underline underline-offset-2 cursor-pointer"
            >
              Supabase PostgreSQL Docs & Migration
            </button>
          </div>
        </div>
      </footer>

      {/* MODALS */}
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

      {/* Floating Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
