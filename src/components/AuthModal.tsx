import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  HardHat,
  Eye,
  EyeOff,
  AlertCircle,
  Wrench,
  MapPin,
  Briefcase,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { AuthUser } from '../lib/supabase';
import { Trade } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: AuthUser) => void;
  initialTab?: 'signin' | 'register' | 'personas';
  initialRole?: 'customer' | 'worker';
}

const DEMO_PERSONAS: AuthUser[] = [
  {
    id: 'demo-customer-arjun',
    name: 'Arjun Mehta (Customer)',
    email: 'arjun.mehta@demo.local',
    role: 'customer',
    is_demo: true,
  },
  {
    id: '11111111-1111-1111-1111-111111111104',
    name: 'Karthik Nair (Plumber)',
    email: 'karthik.demo@skillnear.local',
    role: 'worker',
    is_demo: true,
  },
  {
    id: '11111111-1111-1111-1111-111111111101',
    name: 'Rajesh Sharma (Electrician)',
    email: 'rajesh.demo@skillnear.local',
    role: 'worker',
    is_demo: true,
  },
  {
    id: '11111111-1111-1111-1111-111111111105',
    name: 'Priya Das (Cleaner)',
    email: 'priya.demo@skillnear.local',
    role: 'worker',
    is_demo: true,
  },
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialTab = 'signin',
  initialRole = 'customer',
}) => {
  const [tab, setTab] = useState<'signin' | 'register' | 'personas'>(initialTab);
  const [role, setRole] = useState<'customer' | 'worker'>(initialRole);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [trade, setTrade] = useState<Trade>('electrician');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<string | null>(null);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  if (!isOpen) return null;

  const validateEmail = (e: string) => {
    return /\S+@\S+\.\S+/.test(e);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errors: { [key: string]: string } = {};
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const result = await api.signIn(email.trim(), password);
      if (result.error) {
        setError(result.error);
      } else if (result.user) {
        onAuthSuccess(result.user);
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errors: { [key: string]: string } = {};
    if (!name.trim()) {
      errors.name = 'Full name is required.';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    if (role === 'worker' && !city.trim()) {
      errors.city = 'Please enter your primary service city.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const result = await api.signUp(
        email.trim(),
        password,
        name.trim(),
        role
      );

      if (result.error) {
        setError(result.error);
      } else if (result.user) {
        onAuthSuccess(result.user);
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPersona = (persona: AuthUser) => {
    api.setDemoUser(persona);
    onAuthSuccess(persona);
    onClose();
  };

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex items-center justify-center w-full h-full bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-slate-900 tracking-tight">
                  Skill<span className="text-brand-600">Near</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>ScopeLock™ Secured</span>
                </span>
              </div>
              <h2 id="auth-modal-title" className="text-sm font-semibold text-slate-600">
                {tab === 'signin'
                  ? 'Sign In to SkillNear'
                  : tab === 'register'
                  ? 'Create Your Verified Account'
                  : 'Fast Evaluator Demo Access'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close authentication modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Toggle: Sign In vs Create Account */}
        <div className="p-6 pb-0">
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setError(null);
                setFieldErrors({});
                setForgotPasswordMessage(null);
              }}
              className={`py-2.5 rounded-xl transition-all cursor-pointer ${
                tab === 'signin'
                  ? 'bg-white text-brand-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError(null);
                setFieldErrors({});
                setForgotPasswordMessage(null);
              }}
              className={`py-2.5 rounded-xl transition-all cursor-pointer ${
                tab === 'register'
                  ? 'bg-white text-brand-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {forgotPasswordMessage && (
            <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-800 text-xs flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>{forgotPasswordMessage}</span>
            </div>
          )}

          {/* SIGN IN VIEW */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Welcome Back
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your credentials to manage service bookings and quotes.
                </p>
              </div>

              {/* Email Field */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className={`w-full bg-white border ${
                      fieldErrors.email ? 'border-rose-500' : 'border-slate-300'
                    } rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 transition-colors`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-[11px] text-rose-600">{fieldErrors.email}</p>
                )}
              </div>

              {/* Password Field with Show/Hide Toggle */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForgotPasswordMessage(
                        'Password reset: In this environment, use your registered credentials or select an evaluator demo profile below.'
                      )
                    }
                    className="text-[11px] text-brand-600 hover:text-brand-800 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full bg-white border ${
                      fieldErrors.password ? 'border-rose-500' : 'border-slate-300'
                    } rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 transition-colors`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-[11px] text-rose-600">{fieldErrors.password}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 sm:py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>

              <div className="text-center pt-1 text-xs text-slate-500">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setError(null);
                    setFieldErrors({});
                  }}
                  className="font-bold text-brand-600 hover:text-brand-800 underline underline-offset-2 cursor-pointer"
                >
                  Create one now
                </button>
              </div>
            </form>
          )}

          {/* REGISTRATION VIEW WITH ROLE SELECTION */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Join SkillNear
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose your account type to get started.
                </p>
              </div>

              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Select Your Account Role
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRole('customer')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      role === 'customer'
                        ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-500/20'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`p-1.5 rounded-lg ${role === 'customer' ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        <User className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">I need services</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Customer account to post jobs & compare quotes.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('worker')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      role === 'worker'
                        ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-500/20'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`p-1.5 rounded-lg ${role === 'worker' ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        <HardHat className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">I offer services</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Technician account to review leads & send quotes.
                    </p>
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={role === 'worker' ? 'Ramesh Kumar' : 'Aarav Sharma'}
                    className={`w-full bg-white border ${
                      fieldErrors.name ? 'border-rose-500' : 'border-slate-300'
                    } rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 transition-colors`}
                  />
                </div>
                {fieldErrors.name && (
                  <p className="text-[11px] text-rose-600">{fieldErrors.name}</p>
                )}
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className={`w-full bg-white border ${
                      fieldErrors.email ? 'border-rose-500' : 'border-slate-300'
                    } rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 transition-colors`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-[11px] text-rose-600">{fieldErrors.email}</p>
                )}
              </div>

              {/* Worker-Specific Fields */}
              {role === 'worker' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Primary Trade
                    </label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <select
                        value={trade}
                        onChange={(e) => setTrade(e.target.value as Trade)}
                        className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-3 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500 cursor-pointer"
                      >
                        <option value="electrician">Electrician</option>
                        <option value="plumber">Plumber</option>
                        <option value="cleaner">Cleaner</option>
                        <option value="painter">Painter</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      City / Service Area
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Bengaluru, Mumbai"
                        className={`w-full bg-white border ${
                          fieldErrors.city ? 'border-rose-500' : 'border-slate-300'
                        } rounded-xl pl-10 pr-3 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500`}
                      />
                    </div>
                    {fieldErrors.city && (
                      <p className="text-[11px] text-rose-600">{fieldErrors.city}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Password Field with Show/Hide Toggle */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className={`w-full bg-white border ${
                      fieldErrors.password ? 'border-rose-500' : 'border-slate-300'
                    } rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 transition-colors`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-[11px] text-rose-600">{fieldErrors.password}</p>
                )}
              </div>

              {/* Create Account Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 sm:py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>

              <div className="text-center pt-1 text-xs text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('signin');
                    setError(null);
                    setFieldErrors({});
                  }}
                  className="font-bold text-brand-600 hover:text-brand-800 underline underline-offset-2 cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* QUICK DEMO PERSONAS TAB (DISCREET EVALUATOR ACCESS) */}
          {tab === 'personas' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Evaluator Demo Personas
                </h4>
                <button
                  type="button"
                  onClick={() => setTab('signin')}
                  className="text-xs text-brand-600 hover:text-brand-800 font-semibold"
                >
                  ← Back to Sign In
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Select a simulated profile to test real authentication ownership and data binding without typing credentials:
              </p>
              <div className="space-y-2">
                {DEMO_PERSONAS.map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => handleSelectPersona(persona)}
                    className="w-full text-left p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-brand-500 hover:bg-brand-50/50 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-200 group-hover:bg-brand-600 text-slate-700 group-hover:text-white flex items-center justify-center transition-colors">
                        {persona.role === 'worker' ? (
                          <HardHat className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-900">
                          {persona.name}
                        </div>
                        <div className="text-[11px] text-slate-500">{persona.email}</div>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 group-hover:bg-brand-100 group-hover:text-brand-800">
                      {persona.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subtle Evaluator Link at Bottom */}
          {tab !== 'personas' && (
            <div className="pt-2 text-center border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setTab('personas');
                  setError(null);
                }}
                className="text-[11px] text-slate-500 hover:text-brand-600 transition-colors cursor-pointer"
              >
                Looking for evaluator demo profiles? Click here
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
