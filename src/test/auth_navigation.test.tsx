import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';
import { Navbar } from '../components/Navbar';
import { INITIAL_DEMO_WORKERS } from '../data/mockSeedData';
import { DEFAULT_LOCATION } from '../lib/geo';
import { AuthUser } from '../lib/supabase';
import { api } from '../services/api';

describe('SkillNear — Direct-to-Marketplace & Navigation Recovery Suite', () => {
  const mockCustomerUser: AuthUser = {
    id: 'user-customer-01',
    name: 'Priya Sharma',
    email: 'priya@example.com',
    role: 'customer',
    is_demo: false,
  };

  const mockWorkerUser: AuthUser = {
    id: '11111111-1111-1111-1111-111111111104',
    name: 'Karthik Nair',
    email: 'karthik.demo@skillnear.local',
    role: 'worker',
    is_demo: true,
  };

  beforeEach(() => {
    localStorage.clear();
    api.setDemoUser(null);
  });

  /* =========================================================================
   * 1. DIRECT MARKETPLACE NAVBAR (UNAUTHENTICATED GUEST)
   * ========================================================================= */
  describe('Direct Marketplace Navbar (Unauthenticated / Guest Visitor)', () => {
    it('renders logo, location, portal switcher, Post Job, tabs row, and Sign In button', () => {
      const onOpenLocation = vi.fn();
      const onRoleChange = vi.fn();
      const onSelectTab = vi.fn();
      const onOpenNewRequest = vi.fn();
      const onOpenAuthModal = vi.fn();

      render(
        <Navbar
          currentRole="customer"
          onRoleChange={onRoleChange}
          activeWorker={INITIAL_DEMO_WORKERS[0]}
          onSelectWorker={vi.fn()}
          workers={INITIAL_DEMO_WORKERS}
          currentLocation={DEFAULT_LOCATION}
          onOpenLocationModal={onOpenLocation}
          onOpenSetupModal={vi.fn()}
          isLiveDatabase={false}
          currentUser={null} // Guest visitor
          onOpenAuthModal={onOpenAuthModal}
          activeTab="workers"
          onSelectTab={onSelectTab}
          onOpenNewRequest={onOpenNewRequest}
        />
      );

      // 1. Logo & Brand identity with ScopeLock
      expect(screen.getAllByText(/Skill/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Near/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/ScopeLock™ \+ FairDeal™/i)).toBeInTheDocument();

      // 2. Location Selector Pill
      expect(screen.getByText(DEFAULT_LOCATION.name)).toBeInTheDocument();

      // 3. Portal switcher is ALWAYS accessible
      expect(screen.getByRole('button', { name: /Customer/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Worker Portal/i })).toBeInTheDocument();

      // 4. Post Job button is ALWAYS accessible in customer mode
      const postJobBtn = screen.getByRole('button', { name: /Post Job/i });
      expect(postJobBtn).toBeInTheDocument();
      fireEvent.click(postJobBtn);
      expect(onOpenNewRequest).toHaveBeenCalled();

      // 5. Tabs row is ALWAYS accessible (clean customer tabs without map discovery)
      expect(screen.getByRole('button', { name: /Browse Workers/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^My Requests & Quotes$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Active Bookings & Reviews$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Nearby Local Businesses/i })).not.toBeInTheDocument();

      // 6. Sign In button is present for unauthenticated users
      const signInBtn = screen.getByRole('button', { name: /^Sign In$/i });
      expect(signInBtn).toBeInTheDocument();
      fireEvent.click(signInBtn);
      expect(onOpenAuthModal).toHaveBeenCalledWith('signin');
    });
  });

  /* =========================================================================
   * 2. DIRECT APPLICATION ENTRY (APP OPENS DIRECTLY TO MARKETPLACE)
   * ========================================================================= */
  describe('Direct Application Entry & Marketplace Browsing', () => {
    it('opens directly into the technician marketplace on initial load without onboarding gates', async () => {
      localStorage.clear();
      render(<App />);

      // 1. Marketplace technician banner is immediately visible
      expect(
        await screen.findByText(/On-Demand Blue-Collar Technicians Near You/i)
      ).toBeInTheDocument();

      // 2. Broadcast Job Request CTA is present
      expect(screen.getByRole('button', { name: /Broadcast a Job Request/i })).toBeInTheDocument();

      // 3. Service category filter pills are present
      expect(screen.getByRole('button', { name: /All Services/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Electricians/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Plumbers/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cleaners/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Painters/i })).toBeInTheDocument();

      // 4. ScopeLock & FairDeal product differentiators are prominently highlighted
      expect(screen.getAllByText(/ScopeLock™ \+ FairDeal™/i).length).toBeGreaterThanOrEqual(1);
    });

    it('allows toggling between Customer and Worker portals immediately without logging in', async () => {
      localStorage.clear();
      render(<App />);

      expect(
        await screen.findByText(/On-Demand Blue-Collar Technicians Near You/i)
      ).toBeInTheDocument();

      // Switch to Worker Portal
      const workerPortalBtn = screen.getByRole('button', { name: /Worker Portal/i });
      fireEvent.click(workerPortalBtn);

      // Worker dashboard / leads view is immediately accessible
      expect(await screen.findByText(/Nearby Job Leads/i)).toBeInTheDocument();
    });

    it('opens the AuthModal when Sign In is clicked without replacing the page', async () => {
      localStorage.clear();
      render(<App />);

      expect(
        await screen.findByText(/On-Demand Blue-Collar Technicians Near You/i)
      ).toBeInTheDocument();

      const signInBtn = screen.getByRole('button', { name: /^Sign In$/i });
      fireEvent.click(signInBtn);

      // AuthModal dialog appears over the marketplace
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Sign In to SkillNear/i })).toBeInTheDocument();
    });
  });

  /* =========================================================================
   * 3. AUTHENTICATED CUSTOMER & WORKER EXPERIENCES
   * ========================================================================= */
  describe('Authenticated Customer Experience', () => {
    it('renders customer user profile, Post Job action, and 4 customer navigation tabs', () => {
      const onSignOut = vi.fn();
      const onOpenNewRequest = vi.fn();
      const onSelectTab = vi.fn();

      render(
        <Navbar
          currentRole="customer"
          onRoleChange={vi.fn()}
          activeWorker={INITIAL_DEMO_WORKERS[0]}
          onSelectWorker={vi.fn()}
          workers={INITIAL_DEMO_WORKERS}
          currentLocation={DEFAULT_LOCATION}
          onOpenLocationModal={vi.fn()}
          onOpenSetupModal={vi.fn()}
          isLiveDatabase={false}
          currentUser={mockCustomerUser}
          onSignOut={onSignOut}
          activeTab="workers"
          onSelectTab={onSelectTab}
          onOpenNewRequest={onOpenNewRequest}
        />
      );

      // Customer name is displayed
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();

      // Sign Out button is present
      const signOutBtn = screen.getByRole('button', { name: /Sign out/i });
      expect(signOutBtn).toBeInTheDocument();
      fireEvent.click(signOutBtn);
      expect(onSignOut).toHaveBeenCalled();

      // Post Job button is present
      expect(screen.getByRole('button', { name: /Post Job/i })).toBeInTheDocument();

      // All customer tabs are present
      expect(screen.getByRole('button', { name: /Browse Workers/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^My Requests & Quotes$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Active Bookings & Reviews$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Nearby Local Businesses/i })).not.toBeInTheDocument();
    });
  });

  describe('Authenticated Service Provider Experience', () => {
    it('renders worker profile, technician switcher, worker tabs and no Post Job button', () => {
      const onSignOut = vi.fn();
      const onSelectWorker = vi.fn();
      const onSelectTab = vi.fn();

      render(
        <Navbar
          currentRole="worker"
          onRoleChange={vi.fn()}
          activeWorker={INITIAL_DEMO_WORKERS[0]}
          onSelectWorker={onSelectWorker}
          workers={INITIAL_DEMO_WORKERS}
          currentLocation={DEFAULT_LOCATION}
          onOpenLocationModal={vi.fn()}
          onOpenSetupModal={vi.fn()}
          isLiveDatabase={false}
          currentUser={mockWorkerUser}
          onSignOut={onSignOut}
          activeTab="dashboard"
          onSelectTab={onSelectTab}
          onOpenNewRequest={vi.fn()}
        />
      );

      // Worker name
      expect(screen.getByText('Karthik Nair')).toBeInTheDocument();

      // Worker tabs
      expect(screen.getByRole('button', { name: /^Nearby Job Leads$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^My Quotes & Counteroffers$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Assigned Bookings$/i })).toBeInTheDocument();

      // Worker does not have Post Job button
      expect(screen.queryByRole('button', { name: /Post Job/i })).not.toBeInTheDocument();
    });
  });

  /* =========================================================================
   * 4. SESSION RESTORATION & GUEST SIGN-OUT FLOW
   * ========================================================================= */
  describe('Session Restoration and Guest Sign-Out', () => {
    it('restores stored customer session on load and stays on marketplace', async () => {
      localStorage.setItem('skillnear_demo_session_v2', JSON.stringify(mockCustomerUser));

      render(<App />);

      expect(await screen.findByText('Priya Sharma')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Browse Workers$/i })).toBeInTheDocument();
      expect(screen.getByText(/On-Demand Blue-Collar Technicians Near You/i)).toBeInTheDocument();
    });

    it('signing out returns user to guest state within the marketplace without leaving the page', async () => {
      localStorage.setItem('skillnear_demo_session_v2', JSON.stringify(mockCustomerUser));

      render(<App />);

      expect(await screen.findByText('Priya Sharma')).toBeInTheDocument();

      const signOutBtn = screen.getByRole('button', { name: /Sign out/i });
      fireEvent.click(signOutBtn);

      await waitFor(() => {
        expect(screen.queryByText('Priya Sharma')).not.toBeInTheDocument();
        // Marketplace remains visible as a guest
        expect(screen.getByText(/On-Demand Blue-Collar Technicians Near You/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument();
      });
    });
  });
});
