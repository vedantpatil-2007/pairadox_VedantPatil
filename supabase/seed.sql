-- ============================================================================
-- SkillNear (PS03): Repeatable Seed Script for Demo Data
-- Fictional, Clearly Labelled Demo Worker Records & Workflow State
-- ============================================================================

-- Clean existing demo data if re-running
DELETE FROM public.reviews WHERE id IN (
  '66666666-6666-6666-6666-666666666601'
);

DELETE FROM public.bookings WHERE id IN (
  '55555555-5555-5555-5555-555555555501',
  '55555555-5555-5555-5555-555555555502'
);

DELETE FROM public.quotes WHERE id IN (
  '44444444-4444-4444-4444-444444444401',
  '44444444-4444-4444-4444-444444444402',
  '44444444-4444-4444-4444-444444444403'
);

DELETE FROM public.service_requests WHERE id IN (
  '33333333-3333-3333-3333-333333333301',
  '33333333-3333-3333-3333-333333333302',
  '33333333-3333-3333-3333-333333333303'
);

DELETE FROM public.services WHERE worker_id IN (
  '11111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111104',
  '11111111-1111-1111-1111-111111111105',
  '11111111-1111-1111-1111-111111111106',
  '11111111-1111-1111-1111-111111111107',
  '11111111-1111-1111-1111-111111111108'
);

DELETE FROM public.workers WHERE id IN (
  '11111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111104',
  '11111111-1111-1111-1111-111111111105',
  '11111111-1111-1111-1111-111111111106',
  '11111111-1111-1111-1111-111111111107',
  '11111111-1111-1111-1111-111111111108'
);

-- ----------------------------------------------------------------------------
-- 1. SEED WORKERS (Fictional Demo Profiles)
-- Notice: Clearly labelled as demo simulation profiles.
-- Coordinates are centered around Bengaluru metro for distance calculations.
-- ----------------------------------------------------------------------------

INSERT INTO public.workers (
  id, name, trade, avatar_url, phone, email, experience_years, hourly_rate,
  latitude, longitude, address, city, rating, review_count, bio, is_demo, is_available, badge_label
) VALUES
-- Electrician 1 (Indiranagar)
(
  '11111111-1111-1111-1111-111111111101',
  'Rajesh Sharma (Demo Electrician)',
  'electrician',
  'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150&auto=format&fit=crop&q=80',
  '+91 98765 43210',
  'rajesh.demo@skillnear.local',
  8,
  450.00,
  12.9784,
  77.6408,
  '100 Feet Road, Indiranagar',
  'Bengaluru',
  4.9,
  42,
  'Fictional Demo Profile: Licensed residential wireman, MCB troubleshooting, inverter setup & short-circuit repair.',
  true,
  true,
  'Demo Profile (Fictional Simulation)'
),
-- Electrician 2 (Koramangala)
(
  '11111111-1111-1111-1111-111111111102',
  'Sunita Devi (Demo Electrician)',
  'electrician',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  '+91 98765 43211',
  'sunita.demo@skillnear.local',
  6,
  400.00,
  12.9352,
  77.6245,
  '5th Block, Koramangala',
  'Bengaluru',
  4.8,
  31,
  'Fictional Demo Profile: Fast response appliance wiring, ceiling fan replacement, switchboard retrofitting.',
  true,
  true,
  'Demo Profile (Fictional Simulation)'
),
-- Plumber 1 (BTM Layout)
(
  '11111111-1111-1111-1111-111111111103',
  'Ramesh Kumar (Demo Plumber)',
  'plumber',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  '+91 98765 43212',
  'ramesh.demo@skillnear.local',
  10,
  380.00,
  12.9165,
  77.6101,
  '2nd Stage, BTM Layout',
  'Bengaluru',
  4.9,
  58,
  'Fictional Demo Profile: Master plumber specialized in concealed pipe leaks, motor installations, tap & valve overhauls.',
  true,
  true,
  'Demo Profile (Fictional Simulation)'
),
-- Plumber 2 (Bellandur / Sarjapur Road)
(
  '11111111-1111-1111-1111-111111111104',
  'Karthik Nair (Demo Plumber)',
  'plumber',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  '+91 98765 43213',
  'karthik.demo@skillnear.local',
  5,
  350.00,
  12.9279,
  77.6781,
  'Green Glen Layout, Bellandur',
  'Bengaluru',
  4.7,
  24,
  'Fictional Demo Profile: Rapid drain unclogging, bathroom sanitaryware fitting, geyser connection specialist.',
  true,
  true,
  'Demo Profile (Fictional Simulation)'
),
-- Cleaner 1 (HSR Layout)
(
  '11111111-1111-1111-1111-111111111105',
  'Priya Das (Demo Cleaner)',
  'cleaner',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  '+91 98765 43214',
  'priya.demo@skillnear.local',
  7,
  320.00,
  12.9081,
  77.6476,
  'Sector 3, HSR Layout',
  'Bengaluru',
  4.9,
  64,
  'Fictional Demo Profile: Eco-friendly deep home sanitization, kitchen degreasing, bathroom scrubbing, sofa shampooing.',
  true,
  true,
  'Demo Profile (Fictional Simulation)'
),
-- Cleaner 2 (Domlur / Old Airport Road)
(
  '11111111-1111-1111-1111-111111111106',
  'Anita Roy (Demo Cleaner)',
  'cleaner',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  '+91 98765 43215',
  'anita.demo@skillnear.local',
  4,
  300.00,
  12.9609,
  77.6387,
  'Diamond District, Domlur',
  'Bengaluru',
  4.8,
  19,
  'Fictional Demo Profile: Move-in/move-out deep cleaning, window pane cleaning, balcony dusting & kitchen detailing.',
  true,
  true,
  'Demo Profile (Fictional Simulation)'
),
-- Painter 1 (Jayanagar)
(
  '11111111-1111-1111-1111-111111111107',
  'Anil Verma (Demo Painter)',
  'painter',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
  '+91 98765 43216',
  'anil.demo@skillnear.local',
  11,
  420.00,
  12.9250,
  77.5938,
  '4th Block, Jayanagar',
  'Bengaluru',
  4.8,
  51,
  'Fictional Demo Profile: Interior wall emulsion, waterproof putty application, texture design, touch-up painting.',
  true,
  true,
  'Demo Profile (Fictional Simulation)'
),
-- Painter 2 (Whitefield)
(
  '11111111-1111-1111-1111-111111111108',
  'Suresh Rao (Demo Painter)',
  'painter',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
  '+91 98765 43217',
  'suresh.demo@skillnear.local',
  9,
  400.00,
  12.9698,
  77.7500,
  'ITPL Main Road, Whitefield',
  'Bengaluru',
  4.7,
  36,
  'Fictional Demo Profile: Exterior weather-guard painting, damp proofing, wood polish & metal grill painting.',
  true,
  true,
  'Demo Profile (Fictional Simulation)'
);

-- ----------------------------------------------------------------------------
-- 2. SEED SERVICES (Detailed offerings per worker)
-- ----------------------------------------------------------------------------
INSERT INTO public.services (worker_id, category, name, description, base_price, estimated_time) VALUES
-- Rajesh (Electrician)
('11111111-1111-1111-1111-111111111101', 'electrician', 'Emergency Short Circuit Diagnosis', 'Tripped MCB detection and wiring fault isolation', 499.00, '1 - 2 hours'),
('11111111-1111-1111-1111-111111111101', 'electrician', 'Inverter & Battery Wiring', 'Safe inverter connection with heavy-gauge cabling', 750.00, '2 hours'),
('11111111-1111-1111-1111-111111111101', 'electrician', 'Switchboard Repair & Replacement', 'Modular switch fixing or replacement (up to 4 sockets)', 350.00, '45 mins'),

-- Sunita (Electrician)
('11111111-1111-1111-1111-111111111102', 'electrician', 'Ceiling Fan Installation / Uninstallation', 'Mounting, balancing and regulator check', 299.00, '45 mins'),
('11111111-1111-1111-1111-111111111102', 'electrician', 'Full Home Electrical Inspection', 'Comprehensive safety inspection of distribution board and grounding', 899.00, '3 hours'),

-- Ramesh (Plumber)
('11111111-1111-1111-1111-111111111103', 'plumber', 'Pipe Leak Repair & Concealed Fitting', 'Repair burst pipes, leaky elbows or cracked PVC joints', 450.00, '1 - 2 hours'),
('11111111-1111-1111-1111-111111111103', 'plumber', 'Tap & Mixer Valve Replacement', 'Precision installation of kitchen or washbasin bib taps and angle valves', 320.00, '30 mins'),
('11111111-1111-1111-1111-111111111103', 'plumber', 'Water Tank & Booster Pump Overhaul', 'Motor priming, check valve inspection and line pressure test', 799.00, '2.5 hours'),

-- Karthik (Plumber)
('11111111-1111-1111-1111-111111111104', 'plumber', 'Blocked Drain & Sink Clearing', 'Manual motorized snake auger clearing of clogged lines', 399.00, '1 hour'),
('11111111-1111-1111-1111-111111111104', 'plumber', 'Toilet Flush Tank Repair', 'Syphon mechanism replacement and leak prevention', 350.00, '45 mins'),

-- Priya (Cleaner)
('11111111-1111-1111-1111-111111111105', 'cleaner', 'Complete 2BHK Deep Cleaning', 'Floor scrubbing, kitchen degreasing, bathroom disinfection & dust removal', 2499.00, '4 - 5 hours'),
('11111111-1111-1111-1111-111111111105', 'cleaner', 'Intensive Kitchen Sanitization', 'Chimney surface wipe, grease removal, cabinet interiors and tile scrub', 1199.00, '2 - 3 hours'),
('11111111-1111-1111-1111-111111111105', 'cleaner', 'Bathroom Disinfection & Tile Scaling', 'Hard water stain removal, sanitaryware polish and floor sanitization', 699.00, '1.5 hours'),

-- Anita (Cleaner)
('11111111-1111-1111-1111-111111111106', 'cleaner', 'Fabric Sofa & Upholstery Shampooing', 'Wet extraction cleaning and sanitization (3+1+1)', 1299.00, '2 hours'),
('11111111-1111-1111-1111-111111111106', 'cleaner', 'Balcony & Window Grill Steam Wash', 'Pressure wash and rail dusting', 599.00, '1.5 hours'),

-- Anil (Painter)
('11111111-1111-1111-1111-111111111107', 'painter', 'Single Room Wall Fresh Coat (Emulsion)', 'Surface sanding, 1 coat primer and 2 coats premium washable emulsion', 1899.00, '4 - 6 hours'),
('11111111-1111-1111-1111-111111111107', 'painter', 'Wall Crack Filling & Damp Sealing', 'Polymer putty application and anti-efflorescence treatment', 799.00, '2 hours'),

-- Suresh (Painter)
('11111111-1111-1111-1111-111111111108', 'painter', 'Accent Feature Wall Texture Finish', 'Designer metallic or stenciled texture wall application', 2999.00, '5 hours'),
('11111111-1111-1111-1111-111111111108', 'painter', 'Door & Window Frame Enamel Repaint', 'Sanding and double coat synthetic enamel gloss finish', 950.00, '3 hours');

-- ----------------------------------------------------------------------------
-- 3. SEED INITIAL SERVICE REQUESTS (To demonstrate workflow immediately)
-- ----------------------------------------------------------------------------
INSERT INTO public.service_requests (
  id, customer_name, customer_phone, customer_address, customer_lat, customer_lng,
  category, title, description, urgency, budget, preferred_worker_id, status, created_at
) VALUES
-- Request 1: Quoted state ready for negotiation
(
  '33333333-3333-3333-3333-333333333301',
  'Arjun Mehta',
  '+91 98450 11223',
  'Flat 302, Palm Heights, 12th Main, Koramangala 4th Block',
  12.9344,
  77.6250,
  'plumber',
  'Kitchen sink pipe leaking into lower cupboard',
  'The PVC elbow below the double sink cracked this morning. Water is leaking whenever the tap is used. Need urgent replacement.',
  'today',
  500.00,
  '11111111-1111-1111-1111-111111111103', -- Ramesh Kumar
  'quoted',
  now() - interval '2 hours'
),
-- Request 2: Open request awaiting quotes
(
  '33333333-3333-3333-3333-333333333302',
  'Kavita Sen',
  '+91 98451 99887',
  'Villa 14, Rainbow Colony, Indiranagar',
  12.9750,
  77.6420,
  'electrician',
  'Main hall chandelier and 2 ceiling lights not powering on',
  'The switches seem fine, but power cuts off intermittently to the light points. Suspect loose neutral wire in the switchboard.',
  'immediate',
  600.00,
  NULL,
  'open',
  now() - interval '45 minutes'
),
-- Request 3: Booked & completed request for review demo
(
  '33333333-3333-3333-3333-333333333303',
  'Rohan Gupta',
  '+91 98452 44556',
  'Tower 5, Salarpuria Green, HSR Sector 2',
  12.9110,
  77.6450,
  'cleaner',
  'Deep sanitization for move-in 2BHK flat',
  'Empty apartment needs full kitchen degreasing, bathroom scrubbing, and floor machine cleaning before tenants arrive.',
  'today',
  2500.00,
  '11111111-1111-1111-1111-111111111105', -- Priya Das
  'completed',
  now() - interval '1 day'
);

-- ----------------------------------------------------------------------------
-- 4. SEED QUOTES (Showing initial bid and active counteroffer workflow)
-- ----------------------------------------------------------------------------
INSERT INTO public.quotes (
  id, request_id, worker_id, amount, estimated_duration, notes,
  status, counter_amount, counter_notes, last_updated_by, created_at, updated_at
) VALUES
-- Quote 1: For Request 1 - Plumber Ramesh Kumar offered 550, Customer countered 480
(
  '44444444-4444-4444-4444-444444444401',
  '33333333-3333-3333-3333-333333333301',
  '11111111-1111-1111-1111-111111111103',
  550.00,
  '1.5 hours',
  'Includes heavy-duty UPVC elbow replacement and silicone seal test.',
  'countered',
  480.00,
  'Could you do 480? I already have the teflon tape and extra gasket on hand.',
  'customer',
  now() - interval '1 hour 45 minutes',
  now() - interval '30 minutes'
),
-- Quote 2: For Request 1 - Plumber Karthik Nair also offered quote
(
  '44444444-4444-4444-4444-444444444402',
  '33333333-3333-3333-3333-333333333301',
  '11111111-1111-1111-1111-111111111104',
  500.00,
  '1 hour',
  'Available to reach within 40 minutes with PVC cutter and replacement pipe.',
  'pending',
  NULL,
  NULL,
  'worker',
  now() - interval '1 hour',
  now() - interval '1 hour'
),
-- Quote 3: For Request 3 - Accepted and booked
(
  '44444444-4444-4444-4444-444444444403',
  '33333333-3333-3333-3333-333333333303',
  '11111111-1111-1111-1111-111111111105',
  2400.00,
  '4 hours',
  'Full team of two cleaners with industrial vacuum and chemical disinfectant.',
  'accepted',
  2400.00,
  'Agreed at 2400.',
  'customer',
  now() - interval '22 hours',
  now() - interval '20 hours'
);

-- ----------------------------------------------------------------------------
-- 5. SEED BOOKINGS
-- ----------------------------------------------------------------------------
INSERT INTO public.bookings (
  id, request_id, worker_id, quote_id, customer_name, customer_phone,
  service_address, agreed_price, scheduled_for, status, completion_notes, created_at, completed_at
) VALUES
(
  '55555555-5555-5555-5555-555555555501',
  '33333333-3333-3333-3333-333333333303',
  '11111111-1111-1111-1111-111111111105',
  '44444444-4444-4444-4444-444444444403',
  'Rohan Gupta',
  '+91 98452 44556',
  'Tower 5, Salarpuria Green, HSR Sector 2',
  2400.00,
  now() - interval '18 hours',
  'completed',
  'Job completed with customer sign-off. Flat sanitized and verified clean.',
  now() - interval '20 hours',
  now() - interval '14 hours'
);

-- ----------------------------------------------------------------------------
-- 6. SEED REVIEWS
-- ----------------------------------------------------------------------------
INSERT INTO public.reviews (
  id, booking_id, worker_id, customer_name, rating, comment, created_at
) VALUES
(
  '66666666-6666-6666-6666-666666666601',
  '55555555-5555-5555-5555-555555555501',
  '11111111-1111-1111-1111-111111111105',
  'Rohan Gupta',
  5,
  'Exceptional deep cleaning service! Arrived right on schedule, spotless kitchen and bathrooms. Highly recommend Priya for move-in cleaning.',
  now() - interval '13 hours'
);
