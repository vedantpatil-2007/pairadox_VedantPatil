import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BannerDisclaimer } from '../components/BannerDisclaimer';
import { WorkerCard } from '../components/WorkerCard';
import { Navbar } from '../components/Navbar';
import { INITIAL_DEMO_WORKERS } from '../data/mockSeedData';
import { DEFAULT_LOCATION } from '../lib/geo';

describe('SkillNear UI Components Suite', () => {
  it('renders BannerDisclaimer with clear preview notice and storage explanation', () => {
    const onOpenSetup = vi.fn();
    render(<BannerDisclaimer isLiveDatabase={false} onOpenSetupModal={onOpenSetup} />);

    expect(screen.getByText(/SkillNear Preview/i)).toBeInTheDocument();
    expect(screen.getByText(/Worker listings are sample profiles/i)).toBeInTheDocument();
    expect(screen.getByText(/saved in this browser only \(localStorage\)/i)).toBeInTheDocument();
  });

  it('renders WorkerCard with trade badge, distance, rates, and action buttons', () => {
    const worker = {
      ...INITIAL_DEMO_WORKERS[0],
      distance_km: 2.4,
    };
    const onViewProfile = vi.fn();
    const onRequestQuote = vi.fn();

    render(
      <WorkerCard
        worker={worker}
        onViewProfile={onViewProfile}
        onRequestQuote={onRequestQuote}
      />
    );

    // Verify name, trade, rating, rate
    expect(screen.getByText(worker.name)).toBeInTheDocument();
    expect(screen.getByText('Electrician')).toBeInTheDocument();
    expect(screen.getByText('2.4 km away')).toBeInTheDocument();
    expect(screen.getByText(/Sample profile/i)).toBeInTheDocument();

    // Verify action buttons click correctly (no dead buttons)
    const viewBtn = screen.getByRole('button', { name: /View Rates & Info/i });
    fireEvent.click(viewBtn);
    expect(onViewProfile).toHaveBeenCalledWith(worker);

    const quoteBtn = screen.getByRole('button', { name: /Request Quote/i });
    fireEvent.click(quoteBtn);
    expect(onRequestQuote).toHaveBeenCalledWith(worker);
  });

  it('renders Navbar and toggles between Customer and Worker portals', () => {
    const onRoleChange = vi.fn();
    const onSelectWorker = vi.fn();
    const onOpenLocation = vi.fn();
    const onOpenSetup = vi.fn();
    const onSelectTab = vi.fn();
    const onOpenNewRequest = vi.fn();

    render(
      <Navbar
        currentRole="customer"
        onRoleChange={onRoleChange}
        activeWorker={INITIAL_DEMO_WORKERS[0]}
        onSelectWorker={onSelectWorker}
        workers={INITIAL_DEMO_WORKERS}
        currentLocation={DEFAULT_LOCATION}
        onOpenLocationModal={onOpenLocation}
        onOpenSetupModal={onOpenSetup}
        isLiveDatabase={false}
        activeTab="workers"
        onSelectTab={onSelectTab}
        onOpenNewRequest={onOpenNewRequest}
      />
    );

    // Platform title
    expect(screen.getAllByText(/Skill/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Near/i).length).toBeGreaterThanOrEqual(1);

    // Location pill is present
    expect(screen.getByText(DEFAULT_LOCATION.name)).toBeInTheDocument();

    // Click worker portal button
    const workerRoleBtn = screen.getByRole('button', { name: /Worker Portal/i });
    fireEvent.click(workerRoleBtn);
    expect(onRoleChange).toHaveBeenCalledWith('worker');

    // Click post job button
    const postJobBtn = screen.getByRole('button', { name: /Post Job/i });
    fireEvent.click(postJobBtn);
    expect(onOpenNewRequest).toHaveBeenCalled();
  });
});
