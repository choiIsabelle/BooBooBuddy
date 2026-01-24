"use client";

import { useState } from "react";

interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  rating: number | null;
  distance?: number;
  availableSlots: string[];
  specialties: string[];
  lat?: number;
  lng?: number;
  website?: string;
  placeId?: string;
}

interface ClinicCardProps {
  clinic: Clinic;
  onSchedule?: (clinic: Clinic) => void;
  onCall?: (clinic: Clinic) => void;
  isSelected?: boolean;
}

export default function ClinicCard({
  clinic,
  onSchedule,
  onCall,
  isSelected,
}: ClinicCardProps) {
  const [showMap, setShowMap] = useState(true);

  // Generate Google Maps embed URL
  const getMapUrl = () => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (clinic.placeId && apiKey) {
      return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=place_id:${clinic.placeId}&zoom=15`;
    }
    if (clinic.lat && clinic.lng && apiKey) {
      return `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${clinic.lat},${clinic.lng}&zoom=15`;
    }
    // Fallback to address search
    const encodedAddress = encodeURIComponent(
      `${clinic.name}, ${clinic.address}`,
    );
    return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedAddress}&zoom=15`;
  };

  // Generate Google Maps directions URL
  const getDirectionsUrl = () => {
    const encodedAddress = encodeURIComponent(
      `${clinic.name}, ${clinic.address}`,
    );
    return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
  };

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden bg-white dark:bg-zinc-800 shadow-lg transition-all ${
        isSelected
          ? "border-teal-500 ring-2 ring-teal-200"
          : "border-zinc-200 dark:border-zinc-700"
      }`}
    >
      {/* Map View */}
      {showMap && (
        <div className="relative h-40 w-full bg-zinc-100 dark:bg-zinc-900">
          <iframe
            src={getMapUrl()}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Map of ${clinic.name}`}
          />
          <button
            onClick={() => setShowMap(false)}
            className="absolute top-2 right-2 p-1 rounded-full bg-white/80 hover:bg-white shadow-sm"
            title="Hide map"
          >
            <svg
              className="w-4 h-4 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Clinic Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              {clinic.name}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {clinic.address}
            </p>
          </div>
          {clinic.rating && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <span className="text-yellow-500">⭐</span>
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                {clinic.rating}
              </span>
            </div>
          )}
        </div>

        {/* Distance & Next Available */}
        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400 mb-3">
          {clinic.distance && (
            <span className="flex items-center gap-1">
              <span>📍</span> {clinic.distance} mi
            </span>
          )}
          {clinic.availableSlots && clinic.availableSlots.length > 0 && (
            <span className="flex items-center gap-1">
              <span>⏰</span> Next:{" "}
              {new Date(clinic.availableSlots[0]).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {/* Call Button */}
          <a
            href={`tel:${clinic.phone}`}
            onClick={() => onCall?.(clinic)}
            className="flex flex-col items-center gap-1 p-2 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 transition-colors"
          >
            <span className="text-xl">📞</span>
            <span className="text-xs font-medium text-green-700 dark:text-green-400">
              Call
            </span>
          </a>

          {/* Schedule Button */}
          <button
            onClick={() => onSchedule?.(clinic)}
            className="flex flex-col items-center gap-1 p-2 rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/20 dark:hover:bg-teal-900/40 transition-colors"
          >
            <span className="text-xl">📅</span>
            <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
              Schedule
            </span>
          </button>

          {/* Directions Button */}
          <a
            href={getDirectionsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 p-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 transition-colors"
          >
            <span className="text-xl">🗺️</span>
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
              Directions
            </span>
          </a>
        </div>

        {/* Website Link (if available) */}
        {clinic.website && (
          <a
            href={clinic.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center justify-center gap-2 w-full p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-700/50 transition-colors"
          >
            <span>🌐</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              View Website
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
