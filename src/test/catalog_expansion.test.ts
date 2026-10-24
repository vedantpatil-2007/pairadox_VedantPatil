import { describe, it, expect } from 'vitest';
import { SERVICE_CATEGORIES, CATEGORY_MAP, getCategoryById, isValidTrade } from '../data/categories';
import { INITIAL_DEMO_WORKERS, INITIAL_DEMO_SERVICES, INITIAL_DEMO_REQUESTS } from '../data/mockSeedData';
import { api } from '../services/api';
import { Trade } from '../types';

describe('SkillNear Hyperlocal Catalog Expansion (10 Services)', () => {
  const EXPECTED_CATEGORIES: Trade[] = [
    'electrician',
    'plumber',
    'cleaner',
    'painter',
    'ac_repair',
    'appliance_repair',
    'carpenter',
    'handyman',
    'water_purifier',
    'pest_control',
  ];

  it('contains exactly the 10 approved categories in the Single Source of Truth', () => {
    expect(SERVICE_CATEGORIES).toHaveLength(10);
    const categoryIds = SERVICE_CATEGORIES.map((c) => c.id);
    EXPECTED_CATEGORIES.forEach((expectedId) => {
      expect(categoryIds).toContain(expectedId);
    });
  });

  it('verifies metadata completeness for all 10 categories', () => {
    SERVICE_CATEGORIES.forEach((category) => {
      expect(category.id).toBeDefined();
      expect(category.label).toBeTruthy();
      expect(category.shortLabel).toBeTruthy();
      expect(category.description).toBeTruthy();
      expect(category.icon).toBeDefined();
      expect(category.badgeColor).toContain('bg-');
      expect(category.defaultHourlyRate).toBeGreaterThan(0);
      expect(category.suggestedCrewSize).toBeGreaterThanOrEqual(1);
      expect(category.tasks.length).toBeGreaterThanOrEqual(3);
      expect(category.deliverables.length).toBeGreaterThanOrEqual(2);
      expect(category.exclusions.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('correctly configures Crew Mode for team-based categories', () => {
    const teamCategories = SERVICE_CATEGORIES.filter((c) => c.isTeamBased);
    const teamIds = teamCategories.map((c) => c.id);

    // Cleaner, Painter, AC Repair, and Pest Control are team-based
    expect(teamIds).toContain('cleaner');
    expect(teamIds).toContain('painter');
    expect(teamIds).toContain('ac_repair');
    expect(teamIds).toContain('pest_control');

    teamCategories.forEach((cat) => {
      expect(cat.suggestedCrewSize).toBeGreaterThanOrEqual(2);
    });
  });

  it('validates trades correctly using isValidTrade and getCategoryById', () => {
    EXPECTED_CATEGORIES.forEach((trade) => {
      expect(isValidTrade(trade)).toBe(true);
      const cat = getCategoryById(trade);
      expect(cat).toBeDefined();
      expect(cat?.id).toBe(trade);
    });

    expect(isValidTrade('gardener')).toBe(false);
    expect(isValidTrade('mechanic')).toBe(false);
    expect(isValidTrade('')).toBe(false);
    expect(getCategoryById('unknown_trade')).toBeUndefined();
  });

  it('provides at least 2 demo workers for every one of the 10 categories', () => {
    EXPECTED_CATEGORIES.forEach((trade) => {
      const workers = INITIAL_DEMO_WORKERS.filter((w) => w.trade === trade);
      expect(
        workers.length,
        `Expected at least 2 workers for trade ${trade}, found ${workers.length}`
      ).toBeGreaterThanOrEqual(2);

      // Verify every worker has complete coordinates and rating
      workers.forEach((w) => {
        expect(w.latitude).toBeGreaterThan(12.0);
        expect(w.longitude).toBeGreaterThan(77.0);
        expect(w.rating).toBeGreaterThanOrEqual(4.5);
        expect(w.hourly_rate).toBeGreaterThan(0);
        expect(w.is_demo).toBe(true);
      });
    });
  });

  it('supports worker secondary trades and skill capabilities', () => {
    // Check workers with secondary trades
    const multiTradeWorkers = INITIAL_DEMO_WORKERS.filter(
      (w) => w.secondary_trades && w.secondary_trades.length > 0
    );
    expect(multiTradeWorkers.length).toBeGreaterThanOrEqual(5);

    // Verify AC specialist Farhan Khan also handles appliance repair
    const farhan = INITIAL_DEMO_WORKERS.find((w) => w.name.includes('Farhan Khan'));
    expect(farhan).toBeDefined();
    expect(farhan?.trade).toBe('ac_repair');
    expect(farhan?.secondary_trades).toContain('appliance_repair');
    expect(farhan?.skills).toContain('Split AC Jet Wash');

    // Verify Appliance expert Vikram Malhotra also handles electrical work
    const vikram = INITIAL_DEMO_WORKERS.find((w) => w.name.includes('Vikram Malhotra'));
    expect(vikram).toBeDefined();
    expect(vikram?.trade).toBe('appliance_repair');
    expect(vikram?.secondary_trades).toContain('electrician');
    expect(vikram?.skills).toContain('Front/Top Load Washers');

    // Verify Carpenter Gurpreet Singh also handles handyman tasks
    const gurpreet = INITIAL_DEMO_WORKERS.find((w) => w.name.includes('Gurpreet Singh'));
    expect(gurpreet).toBeDefined();
    expect(gurpreet?.trade).toBe('carpenter');
    expect(gurpreet?.secondary_trades).toContain('handyman');
  });

  it('includes rate card service offerings across the 10 categories', () => {
    EXPECTED_CATEGORIES.forEach((trade) => {
      const services = INITIAL_DEMO_SERVICES.filter((s) => s.category === trade);
      expect(
        services.length,
        `Expected at least 1 upfront rate card service for ${trade}`
      ).toBeGreaterThanOrEqual(1);

      services.forEach((s) => {
        expect(s.base_price).toBeGreaterThan(0);
        expect(s.name).toBeTruthy();
        expect(s.estimated_time).toBeTruthy();
      });
    });
  });

  it('creates and retrieves requests with ScopeLock and Crew Mode for new categories via API', async () => {
    // Test creating an AC Repair request with Crew Mode (2 technicians)
    const acReq = await api.createServiceRequest({
      customer_name: 'Aditi Rao',
      customer_phone: '+91 98111 22233',
      customer_address: 'Sobha Dream Acres, Panathur',
      customer_lat: 12.935,
      customer_lng: 77.712,
      category: 'ac_repair',
      title: 'Dual AC deep foam wash & gas top-up',
      description: 'Need 2 technicians with high-pressure foam jet for indoor and outdoor units.',
      urgency: 'today',
      budget: 1800,
      crew_size: 2,
      duration_unit: 'hours',
      duration_value: 3,
      scope: {
        problem_description: 'Dual AC units require jet washing before summer season',
        requested_work: [
          'High pressure foam jet cleaning',
          'Drain line de-clogging',
          'Refrigerant gas pressure check',
        ],
        expected_deliverables: [
          'Vent temperature below 14°C',
          'Zero condensate leak',
        ],
        exclusions: ['PCB repair'],
        urgency: 'today',
        budget: 1800,
        is_locked: true,
      },
    });

    expect(acReq.data.id).toBeDefined();
    expect(acReq.data.category).toBe('ac_repair');
    expect(acReq.data.crew_size).toBe(2);
    expect(acReq.data.scope?.is_locked).toBe(true);

    // Test creating a Water Purifier service request
    const roReq = await api.createServiceRequest({
      customer_name: 'Kiran Patel',
      customer_phone: '+91 98222 33344',
      customer_address: '4th Block, Koramangala',
      customer_lat: 12.934,
      customer_lng: 77.625,
      category: 'water_purifier',
      title: 'RO filter replacement & TDS calibration',
      description: 'Slow water flow and bad taste. Need full filter overhaul.',
      urgency: 'today',
      budget: 1200,
    });

    expect(roReq.data.id).toBeDefined();
    expect(roReq.data.category).toBe('water_purifier');

    // Retrieve via API
    const allReqs = await api.getServiceRequests();
    expect(allReqs.data.some((r) => r.id === acReq.data.id)).toBe(true);
    expect(allReqs.data.some((r) => r.id === roReq.data.id)).toBe(true);
  });
});
