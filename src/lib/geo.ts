import { UserLocation } from '../types';

/**
 * Calculates great-circle distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Formats distance nicely for cards and lists
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

/**
 * Hyperlocal Bangalore metro neighborhoods for deterministic distance-based matching
 */
export const POPULAR_LOCATIONS: UserLocation[] = [
  {
    name: 'Koramangala',
    address: '5th Block, Koramangala, Bengaluru, Karnataka 560095',
    lat: 12.9352,
    lng: 77.6245,
    isDetected: false,
  },
  {
    name: 'Indiranagar',
    address: '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    lat: 12.9784,
    lng: 77.6408,
    isDetected: false,
  },
  {
    name: 'HSR Layout',
    address: 'Sector 3, HSR Layout, Bengaluru, Karnataka 560102',
    lat: 12.9081,
    lng: 77.6476,
    isDetected: false,
  },
  {
    name: 'BTM Layout',
    address: '2nd Stage, BTM Layout, Bengaluru, Karnataka 560076',
    lat: 12.9165,
    lng: 77.6101,
    isDetected: false,
  },
  {
    name: 'Jayanagar',
    address: '4th Block, Jayanagar, Bengaluru, Karnataka 560011',
    lat: 12.925,
    lng: 77.5938,
    isDetected: false,
  },
  {
    name: 'Bellandur / Outer Ring Rd',
    address: 'Green Glen Layout, Bellandur, Bengaluru, Karnataka 560103',
    lat: 12.9279,
    lng: 77.6781,
    isDetected: false,
  },
  {
    name: 'Whitefield',
    address: 'ITPL Main Road, Whitefield, Bengaluru, Karnataka 560066',
    lat: 12.9698,
    lng: 77.75,
    isDetected: false,
  },
  {
    name: 'Central Bengaluru / MG Road',
    address: 'MG Road, Shanthala Nagar, Bengaluru, Karnataka 560001',
    lat: 12.9716,
    lng: 77.5946,
    isDetected: false,
  },
];

export const DEFAULT_LOCATION: UserLocation = POPULAR_LOCATIONS[0]; // Koramangala by default
