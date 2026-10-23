export type Trade = 'electrician' | 'plumber' | 'cleaner' | 'painter';

export type Urgency = 'immediate' | 'today' | 'flexible';

export type RequestStatus = 'open' | 'quoted' | 'booked' | 'completed' | 'cancelled';

export type QuoteStatus = 'pending' | 'countered' | 'accepted' | 'rejected';

export type BookingStatus = 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface Worker {
  id: string;
  name: string;
  trade: Trade;
  avatar_url?: string;
  phone: string;
  email: string;
  experience_years: number;
  hourly_rate: number;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  rating: number;
  review_count: number;
  bio?: string;
  is_demo: boolean;
  is_available: boolean;
  badge_label: string;
  created_at?: string;
  distance_km?: number; // Calculated dynamically based on customer's active location
}

export interface Service {
  id: string;
  worker_id: string;
  category: Trade;
  name: string;
  description?: string;
  base_price: number;
  estimated_time?: string;
  created_at?: string;
}

export interface ServiceRequest {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_lat: number;
  customer_lng: number;
  category: Trade;
  title: string;
  description: string;
  urgency: Urgency;
  budget?: number;
  preferred_worker_id?: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  request_id: string;
  worker_id: string;
  amount: number;
  estimated_duration: string;
  notes?: string;
  status: QuoteStatus;
  counter_amount?: number | null;
  counter_notes?: string | null;
  last_updated_by: 'worker' | 'customer';
  created_at: string;
  updated_at: string;
  // Joins
  worker?: Worker;
  request?: ServiceRequest;
}

export interface Booking {
  id: string;
  request_id: string;
  worker_id: string;
  quote_id: string;
  customer_name: string;
  customer_phone: string;
  service_address: string;
  agreed_price: number;
  scheduled_for: string;
  status: BookingStatus;
  completion_notes?: string | null;
  created_at: string;
  completed_at?: string | null;
  // Joins
  worker?: Worker;
  request?: ServiceRequest;
}

export interface Review {
  id: string;
  booking_id: string;
  worker_id: string;
  customer_name: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface UserLocation {
  name: string;
  address: string;
  lat: number;
  lng: number;
  isDetected: boolean;
}
