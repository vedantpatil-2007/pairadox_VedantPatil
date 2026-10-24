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

// ============================================================================
// SCOPELOCK™ DATA MODEL (Phase 1)
// "Clear scope. No unapproved changes."
// ============================================================================
export interface ScopeLock {
  problem_description: string;
  problem?: string; // Alias
  requested_work: string[];
  expected_deliverables: string[];
  deliverables?: string[]; // Alias
  assumptions?: string[];
  exclusions?: string[];
  urgency: Urgency;
  budget?: number;
  property_type?: string;
  is_locked: boolean;
}

export interface ServiceRequest {
  id: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  customer_address: string;
  customer_lat: number;
  customer_lng: number;
  category: Trade;
  title: string;
  description: string;
  urgency: Urgency;
  budget?: number;
  crew_size?: number; // 1-20 workers (Crew Mode)
  organization_name?: string; // Optional commercial/organization name
  duration_unit?: 'hours' | 'days';
  duration_value?: number;
  preferred_worker_id?: string | null;
  status: RequestStatus;
  scope?: ScopeLock; // Structured ScopeLock baseline
  created_at: string;
  updated_at: string;
}

// ============================================================================
// FAIRDEAL™ QUOTE ITEMIZATION MODEL (Phase 2)
// "Itemized labour, materials, travel. Transparent comparison."
// ============================================================================
export interface QuoteItemization {
  labour_charge: number;
  materials_charge: number;
  travel_fee: number;
  total_price: number; // validated = labour_charge + materials_charge + travel_fee
  included_work: string[];
  exclusions: string[];
  // Crew Mode (Team FairDeal)
  offered_crew_size?: number;
  requested_crew_size?: number;
  crew_rate_per_person?: number;
  crew_duration_value?: number;
  crew_duration_unit?: 'hours' | 'days';
  shortfall?: number; // max(0, requested - offered)
  supervisor_name?: string;
  materials_breakdown?: {
    name?: string;
    item?: string;
    cost: number;
    brand_or_spec?: string;
  }[];
  parts_policy?: string;
  // Aliases for compatibility
  labour_amount?: number;
  materials_amount?: number;
  travel_amount?: number;
  estimated_duration?: string;
  included_tasks?: string[];
}

export interface Quote {
  id: string;
  request_id: string;
  worker_id: string;
  creator_id?: string | null;
  amount: number;
  estimated_duration: string;
  notes?: string;
  status: QuoteStatus;
  counter_amount?: number | null;
  counter_notes?: string | null;
  last_updated_by: 'worker' | 'customer';
  itemization?: QuoteItemization; // FairDeal itemization
  offered_crew_size?: number;
  shortfall?: number;
  supervisor_name?: string;
  created_at: string;
  updated_at: string;
  // Joins
  worker?: Worker;
  request?: ServiceRequest;
}

// ============================================================================
// CHANGE-ORDER LOCK MODEL (Phase 3)
// "Preserves original agreed price. Explicit customer approval required."
// ============================================================================
export type ChangeOrderStatus = 'pending_customer_approval' | 'approved' | 'rejected';

export interface ChangeOrder {
  id: string;
  booking_id: string;
  title: string;
  reason: string;
  original_price: number;
  additional_amount: number;
  revised_total: number; // original_price + additional_amount
  status: ChangeOrderStatus;
  crew_adjustment?: {
    added_workers: number;
    added_duration?: number;
    duration_unit?: 'hours' | 'days';
    reason: string;
  };
  created_at: string;
  responded_at?: string | null;
  customer_notes?: string | null;
}

// ============================================================================
// REPAIR PASSPORT™ MODEL (Phase 4)
// "Certified service history with agreed scope, approved changes, & warranty."
// ============================================================================
export interface RepairPassport {
  passport_id: string;
  booking_id: string;
  completed_at: string;
  original_scope: ScopeLock;
  original_agreed_price: number;
  approved_changes: ChangeOrder[];
  final_total_paid: number;
  parts_recorded?: { name: string; brand?: string; warranty_months?: number }[];
  warranty_notes?: string;
  technician_name: string;
  technician_trade: Trade;
  is_demo_simulation: boolean;
  // Conveniences & Aliases
  agreed_scope?: ScopeLock;
  original_quote?: number;
  final_total?: number;
  final_agreed_total?: number;
  parts_installed?: { name: string; brand?: string; warranty_months?: number }[];
  warranty_coverage?: string;
  unapproved_changes_count?: number;
  approved_change_orders?: { title: string; amount: number }[];
}

export interface Booking {
  id: string;
  request_id: string;
  worker_id: string;
  quote_id: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  service_address: string;
  agreed_price: number;
  original_agreed_price?: number;
  crew_size?: number;
  organization_name?: string;
  supervisor_name?: string;
  scheduled_for: string;
  status: BookingStatus;
  completion_notes?: string | null;
  change_orders?: ChangeOrder[];
  passport?: RepairPassport;
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
  customer_id?: string | null;
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
