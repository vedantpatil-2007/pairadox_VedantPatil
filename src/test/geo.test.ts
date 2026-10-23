import { describe, it, expect } from 'vitest';
import { calculateDistanceKm, formatDistance, POPULAR_LOCATIONS, DEFAULT_LOCATION } from '../lib/geo';

describe('Geo Distance & Location Utilities', () => {
  it('calculates deterministic distance between two points accurately using Haversine formula', () => {
    // Koramangala (12.9352, 77.6245) to Indiranagar (12.9784, 77.6408)
    const distance = calculateDistanceKm(12.9352, 77.6245, 12.9784, 77.6408);
    expect(distance).toBeGreaterThan(4);
    expect(distance).toBeLessThan(6);
    expect(typeof distance).toBe('number');
  });

  it('returns 0 for identical coordinates', () => {
    const distance = calculateDistanceKm(12.9352, 77.6245, 12.9352, 77.6245);
    expect(distance).toBe(0);
  });

  it('formats distance in meters when less than 1 km', () => {
    expect(formatDistance(0.4)).toBe('400 m away');
    expect(formatDistance(0.85)).toBe('850 m away');
  });

  it('formats distance in km when 1 km or greater', () => {
    expect(formatDistance(2.5)).toBe('2.5 km away');
    expect(formatDistance(10.0)).toBe('10.0 km away');
  });

  it('provides default location and popular metro neighborhoods', () => {
    expect(DEFAULT_LOCATION).toBeDefined();
    expect(DEFAULT_LOCATION.name).toBe('Koramangala');
    expect(POPULAR_LOCATIONS.length).toBeGreaterThanOrEqual(6);
    expect(POPULAR_LOCATIONS.some((loc) => loc.name === 'Indiranagar')).toBe(true);
    expect(POPULAR_LOCATIONS.some((loc) => loc.name === 'HSR Layout')).toBe(true);
  });
});
