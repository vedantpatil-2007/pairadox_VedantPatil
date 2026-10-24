import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  ShieldCheck,
  Award,
  CheckCircle2,
  Calendar,
  Clock,
  IndianRupee,
  Lock,
  Printer,
  Copy,
  Check,
  FileCheck2,
  Sparkles,
} from 'lucide-react';
import { Booking, RepairPassport } from '../types';

interface RepairPassportModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RepairPassportModal: React.FC<RepairPassportModalProps> = ({
  booking,
  isOpen,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && booking) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, booking]);

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

  if (!booking) return null;

  // Resolve or generate deterministic passport data from booking
  const passportId =
    booking.passport?.passport_id ||
    `SKN-PASS-${booking.id.slice(0, 8).toUpperCase()}`;

  const originalPrice = booking.original_agreed_price || booking.agreed_price;
  const approvedChanges = (booking.change_orders || []).filter(
    (co) => co.status === 'approved'
  );
  const hasUnapprovedChanges = (booking.change_orders || []).some(
    (co) => co.status === 'pending_customer_approval'
  );
  const finalTotal = booking.agreed_price;

  const recordedWarranty =
    booking.passport?.warranty_notes || booking.passport?.warranty_coverage;
  const recordedParts =
    booking.passport?.parts_recorded || booking.passport?.parts_installed;

  const handleCopyId = () => {
    navigator.clipboard.writeText(passportId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="passportModalTitle"
      className="p-0 rounded-3xl bg-white shadow-2xl border border-emerald-200 max-w-2xl w-full backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm open:animate-in open:fade-in open:zoom-in-95 duration-200 overflow-hidden"
      onClose={onClose}
    >
      <div className="flex flex-col max-h-[92vh]">
        {/* Passport Luxury Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 text-white p-6 sm:p-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between gap-4 relative z-10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Digital Service Record</span>
                </span>
                <span className="text-[10px] font-bold bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded border border-amber-400/30 tracking-wide">
                  DEMO — SIMULATED SERVICE RECORD
                </span>
              </div>

              <h2 id="passportModalTitle" className="text-xl sm:text-2xl font-black tracking-tight">
                SkillNear Repair Passport™
              </h2>
              <p className="text-xs text-emerald-100/80">
                Service history audit: Agreed Scope, Recorded Change Orders & Final Sign-off
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Verification Bar */}
          <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-mono text-emerald-200">
              <span className="text-white/60">Passport ID:</span>
              <strong className="tracking-wider">{passportId}</strong>
              <button
                type="button"
                onClick={handleCopyId}
                className="text-white/60 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
                title="Copy Passport ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="text-[11px] text-white/70 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Completed: {booking.completed_at ? new Date(booking.completed_at).toLocaleDateString() : 'Today'}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Certificate Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Section 1: Technician & Service Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
              <img
                src={
                  booking.worker?.avatar_url ||
                  'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=100'
                }
                alt={booking.worker?.name || 'Technician'}
                className="w-12 h-12 rounded-xl object-cover ring-2 ring-emerald-600/20"
              />
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Assigned Technician
                </span>
                <h4 className="text-sm font-bold text-slate-900">{booking.worker?.name || 'Technician'}</h4>
                <p className="capitalize text-slate-500">{booking.worker?.trade} • Bengaluru</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Service Location
              </span>
              <h4 className="font-bold text-slate-900">{booking.customer_name}</h4>
              <p className="text-slate-600 truncate">{booking.service_address}</p>
            </div>
          </div>

          {/* Section 2: ScopeLock Baseline Delivered */}
          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                <span>ScopeLock™ Baseline Delivered</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Scope Verified
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              {booking.completion_notes ||
                'Job inspected, tested and signed off by both customer and technician without unapproved deviations.'}
            </p>
          </div>

          {/* Section 3: Financial & Change Order Audit */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Financial Audit & Change-Order Trail
            </span>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-600">
                <span>Original Agreed Quote:</span>
                <span className="font-semibold text-slate-900">₹{originalPrice}</span>
              </div>

              {approvedChanges.length > 0 ? (
                approvedChanges.map((co) => (
                  <div
                    key={co.id}
                    className="flex justify-between items-center text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100"
                  >
                    <div>
                      <span className="font-medium">+ {co.title}</span>
                      <span className="text-[10px] text-emerald-600 block italic">
                        Approved: {co.reason}
                      </span>
                    </div>
                    <span className="font-bold">+₹{co.additional_amount}</span>
                  </div>
                ))
              ) : !hasUnapprovedChanges ? (
                <div className="text-[11px] text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>No unapproved changes recorded. Original quote baseline preserved.</span>
                </div>
              ) : (
                <div className="text-[11px] text-amber-700 italic bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  Note: Change orders pending customer review.
                </div>
              )}

              <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-extrabold text-slate-900">
                <div>
                  <span>Final Agreed Total:</span>
                  <span className="block text-[10px] font-normal text-slate-400">
                    Agreed on completion (payment simulation not active)
                  </span>
                </div>
                <span className="text-base text-emerald-700">₹{finalTotal}</span>
              </div>
            </div>
          </div>

          {/* Section 4: Parts & Warranty Coverage */}
          {recordedWarranty || (recordedParts && recordedParts.length > 0) ? (
            <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-teal-700" />
                  <span>Recorded Warranty & Parts Information</span>
                </span>
                <span className="text-[10px] font-bold text-teal-800">Recorded</span>
              </div>
              <ul className="space-y-1.5 text-slate-700 text-[11px]">
                {recordedWarranty && (
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>{recordedWarranty}</span>
                  </li>
                )}
                {recordedParts &&
                  recordedParts.map((p, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span>
                        <strong>{p.name || (p as unknown as { item?: string }).item}:</strong>{' '}
                        {p.brand ? `Brand: ${p.brand}` : ''}{' '}
                        {p.warranty_months ? `(${p.warranty_months} mo. parts warranty)` : ''}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-slate-400" />
                  <span>Warranty Information</span>
                </span>
              </div>
              <p className="text-slate-500 text-[11px] italic">Warranty not specified.</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Service Record</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
};
