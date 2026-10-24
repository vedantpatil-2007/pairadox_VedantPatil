import { LucideIcon, Zap, Droplet, Sparkles, Paintbrush, Snowflake, Tv, Hammer, Wrench, Filter, Bug } from 'lucide-react';
import { Trade } from '../types';

export interface ServiceCategoryMeta {
  id: Trade;
  label: string;
  pluralLabel: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  badgeColor: string; // Tailwind class string
  suggestedCrewSize: number;
  isTeamBased: boolean;
  defaultHourlyRate: number;
  tasks: string[];
  deliverables: string[];
  exclusions: string[];
}

export const SERVICE_CATEGORIES: ServiceCategoryMeta[] = [
  {
    id: 'electrician',
    label: 'Electrician',
    pluralLabel: 'Electricians',
    shortLabel: 'Electrical',
    description: 'Wiring diagnosis, MCB tripping, inverter setup, switches & lighting',
    icon: Zap,
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    suggestedCrewSize: 1,
    isTeamBased: false,
    defaultHourlyRate: 450,
    tasks: [
      'Isolate circuit & check line voltage',
      'Inspect switchboard/MCB wiring',
      'Repair/replace faulty components',
      'Live load & continuity test',
    ],
    deliverables: [
      'Continuous flicker-free operation',
      'Zero phase-neutral leakage',
      'Faceplate mounted flush without gaps',
    ],
    exclusions: [
      'Internal wall re-conduit cabling',
      'Appliance motor rewinding',
    ],
  },
  {
    id: 'plumber',
    label: 'Plumber',
    pluralLabel: 'Plumbers',
    shortLabel: 'Plumbing',
    description: 'Leak detection, sanitaryware, motor fittings, tap & drainage unblocking',
    icon: Droplet,
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    suggestedCrewSize: 1,
    isTeamBased: false,
    defaultHourlyRate: 380,
    tasks: [
      'Locate exact pipe/joint leak',
      'Dismantle faulty fitting & clean threads',
      'Install heavy-duty UPVC/brass fitting',
      'Full drainage pressure test',
    ],
    deliverables: [
      'Zero water dripping under running pressure',
      'Cupboard/floor wiped dry',
      'Work area cleared of debris',
    ],
    exclusions: [
      'Granite counter breaking',
      'Civil wall masonry tiling',
    ],
  },
  {
    id: 'cleaner',
    label: 'Home Cleaning',
    pluralLabel: 'Home Cleaners',
    shortLabel: 'Cleaning',
    description: 'Deep house sanitization, kitchen chimney degreasing, bathroom descaling & floor buffing',
    icon: Sparkles,
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    suggestedCrewSize: 2,
    isTeamBased: true,
    defaultHourlyRate: 320,
    tasks: [
      'Deep scrubbing of kitchen/bathrooms',
      'Single-disc floor machine buffing & vacuuming',
      'Window track and balcony cleaning',
      'Hospital-grade sanitization spray',
    ],
    deliverables: [
      'Tile grout free of visible stains and lime scale',
      'Streak-free glass & mirrors',
      'Fresh disinfectant aroma throughout premises',
    ],
    exclusions: [
      'External high-rise window facade',
      'Internal appliance coil repair',
    ],
  },
  {
    id: 'painter',
    label: 'Painter',
    pluralLabel: 'Painters',
    shortLabel: 'Painting',
    description: 'Interior emulsion, wall putty, damp waterproofing, texture designs & wood polish',
    icon: Paintbrush,
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    suggestedCrewSize: 2,
    isTeamBased: true,
    defaultHourlyRate: 400,
    tasks: [
      'Surface scraping & sanding',
      'Wall putty application & primer coat',
      'Two finish coats premium washable paint',
      'Floor masking & thorough cleanup',
    ],
    deliverables: [
      'Even paint texture with zero roller marks',
      'Clean switchboard edges and trim lines',
      'Zero paint splatter on tiles and fixtures',
    ],
    exclusions: [
      'Ceiling structural plaster repairs',
      'Exterior weatherproofing scaffolding above 2 floors',
    ],
  },
  {
    id: 'ac_repair',
    label: 'AC Repair & Servicing',
    pluralLabel: 'AC Technicians',
    shortLabel: 'AC Repair',
    description: 'Split & window AC jet foam servicing, gas leak top-up, compressor & PCB repair',
    icon: Snowflake,
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    suggestedCrewSize: 2,
    isTeamBased: true,
    defaultHourlyRate: 480,
    tasks: [
      'Inspect cooling coil & blower pressure',
      'Jet pump high-pressure foam wash',
      'Check refrigerant gas pressure & suction temp',
      'Clean drainage pipe & test remote functions',
    ],
    deliverables: [
      'Sub-18°C vent air delivery verified with digital probe',
      'Zero water leakage from indoor evaporator unit',
      'Outdoor condenser fins clear of dust and debris',
    ],
    exclusions: [
      'Copper piping extension exceeding 3 meters',
      'Inverter PCB micro-component soldering',
    ],
  },
  {
    id: 'appliance_repair',
    label: 'Appliance Repair',
    pluralLabel: 'Appliance Specialists',
    shortLabel: 'Appliances',
    description: 'Washing machine, refrigerator, microwave oven & chimney fault diagnosis & repair',
    icon: Tv,
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
    suggestedCrewSize: 1,
    isTeamBased: false,
    defaultHourlyRate: 420,
    tasks: [
      'Diagnostic safety isolation & error code scan',
      'Disassemble chassis to access motor/sensor',
      'Bench test resistance & replace defective OEM parts',
      'Full operational cycle check under active load',
    ],
    deliverables: [
      'Normal operating noise and vibration levels',
      'All appliance cycles running without error codes',
      'Original wiring harness secured and insulated',
    ],
    exclusions: [
      'Sealed compressor internal rebuilding',
      'Cosmetic dent removal or body shell replacement',
    ],
  },
  {
    id: 'carpenter',
    label: 'Carpentry & Furniture Repair',
    pluralLabel: 'Carpenters',
    shortLabel: 'Carpentry',
    description: 'Door lock fitting, hydraulic cabinet hinges, furniture assembly, wooden shelf mounting',
    icon: Hammer,
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-400',
    suggestedCrewSize: 1,
    isTeamBased: false,
    defaultHourlyRate: 390,
    tasks: [
      'Accurately measure clearances and inspect hinge alignment',
      'Chisel/route wood recess to exact depth',
      'Mount heavy-duty hardware with anti-rust screws',
      'Sand rough edges and adjust door swing',
    ],
    deliverables: [
      'Smooth zero-friction door/drawer movement',
      'Handles and locks aligned flush without wobble',
      'Sawdust vacuumed and work site swept clean',
    ],
    exclusions: [
      'Complete termite structural timber replacement',
      'Full-house modular kitchen carcass rebuilding',
    ],
  },
  {
    id: 'handyman',
    label: 'Handyman & Installation',
    pluralLabel: 'Handymen',
    shortLabel: 'Handyman',
    description: 'TV wall mounting, curtain rods, mirror drilling, flatpack assembly & general repairs',
    icon: Wrench,
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    suggestedCrewSize: 1,
    isTeamBased: false,
    defaultHourlyRate: 350,
    tasks: [
      'Laser/bubble level marking of drill coordinates',
      'Inspect concealed electrical/plumbing conduits with sensor',
      'Hammer drill holes and insert heavy-duty wall anchors',
      'Mount fixtures and perform pull-test for load capacity',
    ],
    deliverables: [
      'Perfect horizontal level alignment',
      'Anchors secured with zero wall chipping or cracking',
      'Dust collector used during drilling to prevent mess',
    ],
    exclusions: [
      'Structural RCC beam breaking or core cutting',
      'High-voltage industrial equipment wiring',
    ],
  },
  {
    id: 'water_purifier',
    label: 'Water Purifier Service',
    pluralLabel: 'RO Specialists',
    shortLabel: 'Water Purifier',
    description: 'RO+UV membrane change, TDS calibration, pump vibration & filter cartridge replacement',
    icon: Filter,
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    suggestedCrewSize: 1,
    isTeamBased: false,
    defaultHourlyRate: 380,
    tasks: [
      'Test incoming tap water TDS and output TDS levels',
      'Replace sediment, pre-carbon, and post-carbon filter candles',
      'Inspect RO membrane pressure and backflush',
      'Sanitize storage tank and verify auto-cutoff sensor',
    ],
    deliverables: [
      'Certified drinking water TDS within standard range (50-150 ppm)',
      'Zero leakage around tubing or push-fit connectors',
      'Tank auto shut-off functional upon full level',
    ],
    exclusions: [
      'Commercial industrial effluent treatment plants',
      'Plumbing line modification to main overhead building tank',
    ],
  },
  {
    id: 'pest_control',
    label: 'Pest Control',
    pluralLabel: 'Pest Exterminators',
    shortLabel: 'Pest Control',
    description: 'Cockroach herbal gel, bedbug eradication, anti-termite drilling & general fumigation',
    icon: Bug,
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    suggestedCrewSize: 2,
    isTeamBased: true,
    defaultHourlyRate: 450,
    tasks: [
      'Inspect breeding hotspots and entry crevices',
      'Apply odorless, government-approved herbal gel/emulsion',
      'Inject residual spray into skirting boards and pipe shafts',
      'Provide post-treatment ventilation and safety guidance',
    ],
    deliverables: [
      '100% targeted coverage of infested zones',
      'Safe non-toxic application around food prep areas',
      'Post-service warranty certificate against re-infestation',
    ],
    exclusions: [
      'Pest-damaged drywall or false-ceiling replacement',
      'Off-site deep fumigation of external vehicles',
    ],
  },
];

export const ALL_TRADE_IDS: Trade[] = SERVICE_CATEGORIES.map((cat) => cat.id);

export const CATEGORY_MAP: Record<Trade, ServiceCategoryMeta> = SERVICE_CATEGORIES.reduce(
  (acc, cat) => {
    acc[cat.id] = cat;
    return acc;
  },
  {} as Record<Trade, ServiceCategoryMeta>
);

export function getCategoryById(id: string): ServiceCategoryMeta | undefined {
  return CATEGORY_MAP[id as Trade];
}

export function isValidTrade(id: string): id is Trade {
  return id in CATEGORY_MAP;
}
