import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  X,
  Zap,
  Droplet,
  Paintbrush,
  MapPin,
  Clock,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Lock,
  Plus,
  Trash2,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { Trade, Urgency, UserLocation, Worker, ScopeLock } from '../types';
import { api } from '../services/api';

interface PostRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: UserLocation;
  preselectedWorker: Worker | null;
  onRequestCreated: (requestId: string) => void;
}

const DEFAULT_PRESETS: Record<
  Trade,
  { tasks: string[]; deliverables: string[]; exclusions: string[] }
> = {
  electrician: {
    tasks: ['Isolate circuit & check line voltage', 'Inspect switchboard/MCB wiring', 'Repair/replace faulty components', 'Live load test'],
    deliverables: ['Continuous flicker-free operation', 'Zero phase-neutral leakage', 'Faceplate mounted flush'],
    exclusions: ['Internal wall re-conduit cabling', 'Appliance motor rewinding'],
  },
  plumber: {
    tasks: ['Locate exact pipe/joint leak', 'Dismantle faulty fitting & clean threads', 'Install heavy-duty UPVC/brass fitting', 'Full drainage pressure test'],
    deliverables: ['Zero water dripping under running pressure', 'Cupboard/floor wiped dry', 'Work area cleaned'],
    exclusions: ['Granite counter breaking', 'Civil wall masonry tiling'],
  },
  cleaner: {
    tasks: ['Deep scrubbing of kitchen/bathrooms', 'Floor machine buffing & vacuuming', 'Window track and balcony cleaning', 'Hospital-grade sanitization'],
    deliverables: ['Grout free of stains/lime scale', 'Streak-free glass & mirrors', 'Fresh disinfectant aroma'],
    exclusions: ['External high-rise window facade', 'Internal appliance coil repair'],
  },
  painter: {
    tasks: ['Surface scraping & sanding', 'Wall putty application & primer coat', 'Two finish coats premium washable paint', 'Floor masking & cleanup'],
    deliverables: ['Even paint texture with zero roller marks', 'Clean switchboard edges', 'Zero paint splatter on tiles'],
    exclusions: ['Ceiling structural plaster repairs', 'Exterior weatherproofing scaffolding'],
  },
};

export const PostRequestModal: React.FC<PostRequestModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  preselectedWorker,
  onRequestCreated,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Form State
  const [category, setCategory] = useState<Trade>(
    preselectedWorker ? preselectedWorker.trade : 'plumber'
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('today');
  const [budget, setBudget] = useState<string>('500');
  const [customerName, setCustomerName] = useState('Rahul Sharma');
  const [customerPhone, setCustomerPhone] = useState('+91 98450 12345');
  const [customerAddress, setCustomerAddress] = useState(currentLocation.address);
  const [propertyType, setPropertyType] = useState('Apartment / Flat');

  // ScopeLock Structured State (Phase 1)
  const [showScopeLock, setShowScopeLock] = useState(true);
  const [tasks, setTasks] = useState<string[]>(DEFAULT_PRESETS['plumber'].tasks);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [deliverables, setDeliverables] = useState<string[]>(DEFAULT_PRESETS['plumber'].deliverables);
  const [newDeliverableInput, setNewDeliverableInput] = useState('');
  const [exclusions, setExclusions] = useState<string[]>(DEFAULT_PRESETS['plumber'].exclusions);
  const [newExclusionInput, setNewExclusionInput] = useState('');
  const [assumptions, setAssumptions] = useState<string[]>([
    'Area cleared for technician access',
    'Electricity and water available',
  ]);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (preselectedWorker) {
      setCategory(preselectedWorker.trade);
      setTasks(DEFAULT_PRESETS[preselectedWorker.trade].tasks);
      setDeliverables(DEFAULT_PRESETS[preselectedWorker.trade].deliverables);
      setExclusions(DEFAULT_PRESETS[preselectedWorker.trade].exclusions);
    }
  }, [preselectedWorker]);

  const handleCategoryChange = (cat: Trade) => {
    setCategory(cat);
    setTasks(DEFAULT_PRESETS[cat].tasks);
    setDeliverables(DEFAULT_PRESETS[cat].deliverables);
    setExclusions(DEFAULT_PRESETS[cat].exclusions);
  };

  useEffect(() => {
    setCustomerAddress(currentLocation.address);
  }, [currentLocation]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      setIsSuccess(false);
      setErrorMsg(null);
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Fallback for browsers without closedby support
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isInside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!isInside) {
        onClose();
      }
    };

    dialog.addEventListener('click', handleBackdropClick);
    return () => dialog.removeEventListener('click', handleBackdropClick);
  }, [onClose]);

  const handleAddTask = () => {
    if (newTaskInput.trim()) {
      setTasks([...tasks, newTaskInput.trim()]);
      setNewTaskInput('');
    }
  };

  const handleRemoveTask = (idx: number) => {
    setTasks(tasks.filter((_, i) => i !== idx));
  };

  const handleAddDeliverable = () => {
    if (newDeliverableInput.trim()) {
      setDeliverables([...deliverables, newDeliverableInput.trim()]);
      setNewDeliverableInput('');
    }
  };

  const handleRemoveDeliverable = (idx: number) => {
    setDeliverables(deliverables.filter((_, i) => i !== idx));
  };

  const handleAddExclusion = () => {
    if (newExclusionInput.trim()) {
      setExclusions([...exclusions, newExclusionInput.trim()]);
      setNewExclusionInput('');
    }
  };

  const handleRemoveExclusion = (idx: number) => {
    setExclusions(exclusions.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMsg('Please provide a job title and description of the issue.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const scopeData: ScopeLock = {
      problem_description: description.trim(),
      requested_work: tasks.length > 0 ? tasks : [title.trim()],
      expected_deliverables: deliverables.length > 0 ? deliverables : ['Completed in working condition'],
      assumptions,
      exclusions,
      urgency,
      budget: budget ? parseFloat(budget) : undefined,
      property_type: propertyType,
      is_locked: true,
    };

    try {
      const res = await api.createServiceRequest({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        customer_lat: currentLocation.lat,
        customer_lng: currentLocation.lng,
        category,
        title: title.trim(),
        description: description.trim(),
        urgency,
        budget: budget ? parseFloat(budget) : undefined,
        preferred_worker_id: preselectedWorker ? preselectedWorker.id : null,
        scope: scopeData,
      });

      setIsSuccess(true);
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
        onRequestCreated(res.data.id);
      }, 1200);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMsg((err as Error).message || 'Failed to submit service request. Please retry.');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="requestModalTitle"
      className="p-0 rounded-2xl bg-white shadow-2xl border border-slate-200 max-w-2xl w-full backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs open:animate-in open:fade-in open:zoom-in-95 duration-200"
      onClose={onClose}
    >
      <div className="p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="requestModalTitle" className="text-base sm:text-lg font-bold text-slate-900">
                  {preselectedWorker
                    ? `Request Quote from ${preselectedWorker.name}`
                    : 'Post an On-Demand Job Broadcast'}
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded border border-indigo-200">
                  ScopeLock™
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Define a locked scope so all technicians provide comparable, non-deviating quotes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">ScopeLock™ Request Broadcasted!</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Your structured Scope Card is active. Technicians will quote against these exact deliverables with itemized labour and materials.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Category selection */}
            {!preselectedWorker && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Service Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'electrician', label: 'Electrician', icon: Zap },
                    { id: 'plumber', label: 'Plumber', icon: Droplet },
                    { id: 'cleaner', label: 'Cleaner', icon: Sparkles },
                    { id: 'painter', label: 'Painter', icon: Paintbrush },
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleCategoryChange(cat.id as Trade)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-1" />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Job Title & Property Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-700">Job Title / Fault Summary *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Bathroom washbasin PVC pipe leaking"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>Property Type</span>
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Apartment / Flat">Apartment / Flat</option>
                  <option value="Independent Villa">Independent Villa</option>
                  <option value="Commercial / Office">Commercial / Office</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Detailed Problem Description *</label>
              <textarea
                required
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What exactly is happening? (e.g. When the kitchen tap runs, water pools into the cabinet below...)"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>

            {/* SCOPELOCK™ STRUCTURED SPECIFICATION */}
            <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-indigo-700" />
                  <span className="text-xs font-bold text-indigo-900">
                    ScopeLock™ Structured Specification
                  </span>
                </div>
                <span className="text-[11px] text-indigo-700 font-medium">
                  Prevents surprise extra charges
                </span>
              </div>

              {/* Specific Tasks List */}
              <div className="space-y-1.5 text-xs">
                <label className="font-semibold text-slate-700 block">
                  Specific Requested Work ({tasks.length})
                </label>
                <div className="space-y-1.5">
                  {tasks.map((task, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-200"
                    >
                      <span className="text-slate-800 text-[11px] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{task}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(idx)}
                        className="text-slate-400 hover:text-rose-600 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTask();
                      }
                    }}
                    placeholder="+ Add custom task item (e.g. Inspect rubber gasket)"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Add Task
                  </button>
                </div>
              </div>

              {/* Expected Deliverables */}
              <div className="space-y-1.5 text-xs pt-1">
                <label className="font-semibold text-slate-700 block">
                  Expected Deliverables / Definition of Done ({deliverables.length})
                </label>
                <div className="space-y-1.5">
                  {deliverables.map((deliv, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-200"
                    >
                      <span className="text-slate-800 text-[11px] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{deliv}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDeliverable(idx)}
                        className="text-slate-400 hover:text-rose-600 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newDeliverableInput}
                    onChange={(e) => setNewDeliverableInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDeliverable();
                      }
                    }}
                    placeholder="+ Add completion criteria (e.g. Tested for 5 mins without leaks)"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddDeliverable}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Exclusions */}
              <div className="space-y-1 text-xs pt-1">
                <label className="font-semibold text-rose-700 block">
                  Explicitly Excluded from Scope ({exclusions.length})
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {exclusions.map((ex, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-800 rounded text-[11px] border border-rose-200"
                    >
                      <span>✕ {ex}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExclusion(idx)}
                        className="text-rose-400 hover:text-rose-700"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newExclusionInput}
                    onChange={(e) => setNewExclusionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddExclusion();
                      }
                    }}
                    placeholder="+ Add exclusion (e.g. Wall masonry or painting)"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddExclusion}
                    className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Urgency & Target Budget */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Urgency</span>
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as Urgency)}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="immediate">Immediate / Emergency (Within 1 hour)</option>
                  <option value="today">Today (Within 4 hours)</option>
                  <option value="flexible">Flexible / Weekend</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                  <span>Target Budget (₹)</span>
                </label>
                <input
                  type="number"
                  min="100"
                  step="50"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="500"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Customer Details & Address */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Contact & Hyperlocal Address
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your Name"
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone Number"
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-300">
                <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full bg-transparent border-none p-0 focus:outline-hidden text-xs text-slate-800"
                  placeholder="Service address"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Locking Scope & Broadcasting...</span>
                ) : (
                  <span>Post ScopeLock™ Job Request</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
};
