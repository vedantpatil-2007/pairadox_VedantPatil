import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Check, AlertCircle, X, RotateCcw, Search, Plus } from 'lucide-react';
import { UserLocation } from '../types';
import { POPULAR_LOCATIONS, DEFAULT_LOCATION } from '../lib/geo';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: UserLocation;
  onSelectLocation: (loc: UserLocation) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSelectLocation,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showCustomCoords, setShowCustomCoords] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customLat, setCustomLat] = useState('12.9352');
  const [customLng, setCustomLng] = useState('77.6245');

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = parseFloat(customLat);
    const parsedLng = parseFloat(customLng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setGeoError('Please enter valid numeric latitude and longitude coordinates.');
      return;
    }

    const name = customName.trim() || `Custom (${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)})`;
    onSelectLocation({
      name,
      address: `Manual Map Coordinates: ${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)}`,
      lat: parsedLat,
      lng: parsedLng,
      isDetected: false,
    });
    onClose();
  };

  const handleResetToDefault = () => {
    onSelectLocation(DEFAULT_LOCATION);
    onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
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

  const handleDetectLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser. Please select a neighborhood below.');
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetecting(false);
        const detectedLoc: UserLocation = {
          name: 'My GPS Location',
          address: `GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          isDetected: true,
        };
        onSelectLocation(detectedLoc);
        onClose();
      },
      (err) => {
        setIsDetecting(false);
        console.warn('Geolocation error:', err);
        setGeoError(
          err.code === 1
            ? 'Location permission was denied. Please select a neighborhood below from the manual list.'
            : 'Unable to determine GPS location. Please select a neighborhood below.'
        );
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="locationModalTitle"
      className="p-0 rounded-2xl bg-white shadow-2xl border border-slate-200 max-w-lg w-full backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs open:animate-in open:fade-in open:zoom-in-95 duration-200"
      onClose={onClose}
    >
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 id="locationModalTitle" className="text-lg font-bold text-slate-900">
                Set Your Service Location
              </h2>
              <p className="text-xs text-slate-500">
                Calculates precise distances to nearby technicians
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

        {/* GPS Quick Action */}
        <div>
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={isDetecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold rounded-xl border border-brand-200 transition-colors focus:ring-2 focus:ring-brand-500 disabled:opacity-60 cursor-pointer"
          >
            <Navigation className={`w-4 h-4 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>{isDetecting ? 'Detecting GPS Coordinates...' : 'Detect My Exact Location (GPS)'}</span>
          </button>

          {geoError && (
            <div className="mt-2.5 flex items-start gap-2 p-3 bg-amber-50 text-amber-900 text-xs rounded-xl border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{geoError}</span>
            </div>
          )}
        </div>

        {/* Manual Fallback: Popular Metro Neighborhoods */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Or Choose Metro Neighborhood (Manual Selection)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {POPULAR_LOCATIONS.map((loc) => {
              const isSelected =
                currentLocation.lat === loc.lat && currentLocation.lng === loc.lng;
              return (
                <button
                  key={loc.name}
                  type="button"
                  onClick={() => {
                    onSelectLocation(loc);
                    onClose();
                  }}
                  className={`flex items-start justify-between p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-slate-800 block">
                      {loc.name}
                    </span>
                    <span className="text-[11px] text-slate-500 line-clamp-1">
                      {loc.address}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-brand-600 shrink-0 mt-0.5 ml-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Option 3: Manual Exact Map Coordinates */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowCustomCoords((s) => !s)}
            className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 cursor-pointer"
          >
            <span>{showCustomCoords ? '− Hide Custom Coordinates' : '+ Enter Custom Coordinates / Map Position'}</span>
          </button>

          {showCustomCoords && (
            <form onSubmit={handleApplyCustom} className="mt-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Location Label / Area Name</label>
                <input
                  type="text"
                  placeholder="e.g. Whitefield Export Promotion Zone"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={customLat}
                    onChange={(e) => setCustomLat(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={customLng}
                    onChange={(e) => setCustomLng(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Set Custom Position
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default ({DEFAULT_LOCATION.name})</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
};
