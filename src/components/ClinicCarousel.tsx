"use client";

import { useState, useRef } from "react";
import ClinicCard from "./ClinicCard";

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

interface ClinicCarouselProps {
  clinics: Clinic[];
  onSchedule?: (clinic: Clinic) => void;
  onCall?: (clinic: Clinic) => void;
}

export default function ClinicCarousel({
  clinics,
  onSchedule,
  onCall,
}: ClinicCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollToIndex = (index: number) => {
    if (carouselRef.current) {
      const cardWidth = carouselRef.current.offsetWidth;
      carouselRef.current.scrollTo({
        left: index * cardWidth,
        behavior: "smooth",
      });
    }
    setCurrentIndex(index);
  };

  const handlePrev = () => {
    const newIndex = Math.max(0, currentIndex - 1);
    scrollToIndex(newIndex);
  };

  const handleNext = () => {
    const newIndex = Math.min(clinics.length - 1, currentIndex + 1);
    scrollToIndex(newIndex);
  };

  const handleScroll = () => {
    if (carouselRef.current) {
      const scrollLeft = carouselRef.current.scrollLeft;
      const cardWidth = carouselRef.current.offsetWidth;
      const newIndex = Math.round(scrollLeft / cardWidth);
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
    }
  };

  if (clinics.length === 0) return null;

  return (
    <div className="mt-3 w-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          📍 Nearby Clinics Found ({clinics.length})
        </p>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <span>{currentIndex + 1}</span>
          <span>/</span>
          <span>{clinics.length}</span>
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative">
        {/* Left Arrow */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 -ml-3 w-8 h-8 rounded-full bg-white dark:bg-zinc-700 shadow-lg flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-600 transition-colors border border-zinc-200 dark:border-zinc-600"
            aria-label="Previous clinic"
          >
            <svg
              className="w-5 h-5 text-zinc-600 dark:text-zinc-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* Right Arrow */}
        {currentIndex < clinics.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 -mr-3 w-8 h-8 rounded-full bg-white dark:bg-zinc-700 shadow-lg flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-600 transition-colors border border-zinc-200 dark:border-zinc-600"
            aria-label="Next clinic"
          >
            <svg
              className="w-5 h-5 text-zinc-600 dark:text-zinc-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}

        {/* Scrollable Cards */}
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 pb-2"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {clinics.map((clinic, index) => (
            <div key={clinic.id} className="flex-shrink-0 w-full snap-center">
              <ClinicCard
                clinic={clinic}
                onSchedule={onSchedule}
                onCall={onCall}
                isSelected={index === currentIndex}
              />
            </div>
          ))}
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center gap-1.5 mt-3">
          {clinics.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex
                  ? "bg-teal-500"
                  : "bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500"
              }`}
              aria-label={`Go to clinic ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
