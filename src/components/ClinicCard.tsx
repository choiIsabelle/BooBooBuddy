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
  enableTwilioCall?: boolean;
  symptoms?: string;
}

export default function ClinicCard({
  clinic,
  onSchedule,
  onCall,
  isSelected,
  enableTwilioCall = true,
  symptoms,
}: ClinicCardProps) {
  const [showMap, setShowMap] = useState(true);
  const [isCallingClinic, setIsCallingClinic] = useState(false);
  const [callStatus, setCallStatus] = useState<
    | "idle"
    | "calling"
    | "waiting-transcript"
    | "analyzing"
    | "complete"
    | "booking-available"
    | "booking-calling"
    | "booking-waiting"
    | "booking-analyzing"
    | "booking-complete"
    | "error"
  >("idle");
  const [callMessage, setCallMessage] = useState("");
  const [callSid, setCallSid] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [transcriptAnalysis, setTranscriptAnalysis] = useState<{
    summary?: string;
    acceptingPatients?: boolean | null;
    acceptsWalkIns?: boolean | null;
    appointmentsOnly?: boolean;
    hoursOfOperation?: string | null;
    availableTimeRange?: {
      start?: string | null;
      end?: string | null;
      date?: string | null;
    } | null;
    specificTimeSlots?: string[];
    nextAvailable?: string | null;
    suggestedTime?: string | null;
    waitTime?: string | null;
    canBook?: boolean;
    additionalInfo?: string | null;
    // Booking-specific fields
    bookingConfirmed?: boolean;
    confirmedTimeSlot?: string | null;
    appointmentTime?: string | null;
    bookingDeclined?: boolean;
    declineReason?: string | null;
  } | null>(null);
  const demoPhoneNumber = process.env.DEMO_PHONE_NUMBER;

  // Generate time slots every 30 minutes within a range
  const generateTimeSlots = (start: string, end: string): string[] => {
    const slots: string[] = [];

    // Parse time strings like "9:00 AM", "2:30 PM"
    const parseTime = (
      timeStr: string,
    ): { hours: number; minutes: number } | null => {
      const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
      if (!match) return null;

      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2] || "0");
      const period = match[3]?.toUpperCase();

      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      return { hours, minutes };
    };

    const formatTime = (hours: number, minutes: number): string => {
      const period = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
    };

    const startTime = parseTime(start);
    const endTime = parseTime(end);

    if (!startTime || !endTime) return slots;

    let currentMinutes = startTime.hours * 60 + startTime.minutes;
    const endMinutes = endTime.hours * 60 + endTime.minutes;

    while (currentMinutes <= endMinutes) {
      const hours = Math.floor(currentMinutes / 60);
      const mins = currentMinutes % 60;
      slots.push(formatTime(hours, mins));
      currentMinutes += 30; // 30 minute intervals
    }

    return slots;
  };

  // Get available time slots from analysis
  const getAvailableTimeSlots = (): string[] => {
    if (!transcriptAnalysis) return [];

    // If specific time slots were mentioned, use those
    if (
      transcriptAnalysis.specificTimeSlots &&
      transcriptAnalysis.specificTimeSlots.length > 0
    ) {
      return transcriptAnalysis.specificTimeSlots;
    }

    // If a time range was given, generate 30-minute slots
    if (
      transcriptAnalysis.availableTimeRange?.start &&
      transcriptAnalysis.availableTimeRange?.end
    ) {
      return generateTimeSlots(
        transcriptAnalysis.availableTimeRange.start,
        transcriptAnalysis.availableTimeRange.end,
      );
    }

    // Fallback to suggested time or next available
    if (transcriptAnalysis.suggestedTime) {
      return [transcriptAnalysis.suggestedTime];
    }

    return [];
  };

  // Poll for transcript after call completes (used for both inquiry and booking calls)
  const pollForTranscript = async (
    sid: string,
    attempts = 0,
    isBookingCall = false,
  ): Promise<void> => {
    const maxAttempts = 20; // Poll for up to 2 minutes (20 * 6 seconds)
    const pollInterval = 6000; // 6 seconds between polls

    if (attempts >= maxAttempts) {
      setCallStatus(isBookingCall ? "booking-complete" : "complete");
      setCallMessage(
        "Call completed. Transcript not available - the recording may still be processing.",
      );
      return;
    }

    try {
      console.log(
        `📝 Polling for transcript (attempt ${attempts + 1}/${maxAttempts})... ${isBookingCall ? "(booking call)" : ""}`,
      );
      const response = await fetch(`/api/twilio/get-transcript?callSid=${sid}`);
      const data = await response.json();

      if (response.status === 200 && data.transcriptionText) {
        // Got transcript - now analyze it
        setCallStatus(isBookingCall ? "booking-analyzing" : "analyzing");
        setCallMessage(
          isBookingCall
            ? "Checking booking confirmation..."
            : "Analyzing clinic response...",
        );

        const analysisResponse = await fetch("/api/twilio/analyze-transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: data.transcriptionText,
            clinicName: clinic.name,
            isBookingCall: isBookingCall,
          }),
        });

        const analysisData = await analysisResponse.json();

        if (analysisData.success && analysisData.analysis) {
          // Merge new analysis with existing (preserve initial call info)
          setTranscriptAnalysis((prev) => ({
            ...prev,
            ...analysisData.analysis,
          }));

          if (isBookingCall) {
            setCallStatus("booking-complete");
            if (analysisData.analysis.bookingConfirmed) {
              setCallMessage("🎉 Appointment booked successfully!");
            } else if (analysisData.analysis.bookingDeclined) {
              setCallMessage("Booking was not confirmed");
            } else {
              setCallMessage("Booking response received");
            }
          } else {
            // Check response: walk-ins accepted vs appointments-only
            const analysis = analysisData.analysis;

            if (analysis.acceptsWalkIns === true) {
              // Walk-ins are accepted - patient can go directly!
              setCallStatus("complete");
              setCallMessage(
                "✅ Walk-ins welcome! You can go to the clinic now.",
              );
            } else if (
              analysis.appointmentsOnly === true ||
              analysis.canBook === true
            ) {
              // Appointments only - offer to book
              setCallStatus("booking-available");
              setCallMessage(
                "This clinic requires appointments. Would you like us to book for you?",
              );
            } else {
              // General response - show info
              setCallStatus("complete");
              setCallMessage("Clinic response received!");
            }
          }
        } else {
          setCallStatus(isBookingCall ? "booking-complete" : "complete");
          setTranscriptAnalysis((prev) => ({
            ...prev,
            summary: data.transcriptionText,
          }));
          setCallMessage("Response received!");
        }
      } else if (response.status === 202 || response.status === 404) {
        // Transcript not ready yet - continue polling
        setTimeout(
          () => pollForTranscript(sid, attempts + 1, isBookingCall),
          pollInterval,
        );
      } else {
        // Error - stop polling
        setCallStatus(isBookingCall ? "booking-complete" : "complete");
        setCallMessage("Call completed. Unable to retrieve transcript.");
      }
    } catch (error) {
      console.error("Error polling for transcript:", error);
      setTimeout(
        () => pollForTranscript(sid, attempts + 1, isBookingCall),
        pollInterval,
      );
    }
  };

  // Make the booking call with a specific time slot
  const handleBookingCall = async (timeSlot?: string) => {
    const bookingTime =
      timeSlot ||
      selectedTimeSlot ||
      transcriptAnalysis?.suggestedTime ||
      transcriptAnalysis?.nextAvailable;

    setCallStatus("booking-calling");
    setCallMessage(
      `Calling clinic to book appointment for ${bookingTime || "next available"}...`,
    );

    try {
      const response = await fetch("/api/twilio/call-clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicPhone: demoPhoneNumber, // Always use this test number
          clinicName: clinic.name,
          symptoms: symptoms,
          isBookingCall: true,
          requestedTime: bookingTime,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCallSid(data.callSid);
        setCallStatus("booking-waiting");
        setCallMessage(`Booking call in progress. Waiting for confirmation...`);

        // Start polling for transcript after a delay
        setTimeout(() => pollForTranscript(data.callSid, 0, true), 30000);
      } else {
        setCallStatus("error");
        setCallMessage(data.error || "Failed to initiate booking call.");
      }
    } catch (error) {
      console.error("Error making booking call:", error);
      setCallStatus("error");
      setCallMessage("Failed to initiate booking call.");
    }
  };

  // Handle Twilio call to clinic
  const handleTwilioCall = async () => {
    setIsCallingClinic(true);
    setCallStatus("calling");
    setCallMessage("Initiating call to clinic...");
    setTranscriptAnalysis(null);

    try {
      const response = await fetch("/api/twilio/call-clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicPhone: demoPhoneNumber, // Always use this test number
          clinicName: clinic.name,
          symptoms: symptoms,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCallSid(data.callSid);
        setCallStatus("waiting-transcript");
        setCallMessage(
          `Call in progress to ${clinic.name}. Waiting for clinic response...`,
        );
        onCall?.(clinic);

        // Start polling for transcript after a delay (give time for call to complete)
        setTimeout(() => pollForTranscript(data.callSid, 0), 30000); // Start polling after 30 seconds
      } else {
        setCallStatus("error");
        setCallMessage(
          data.error || "Failed to initiate call. Please try calling directly.",
        );
      }
    } catch (error) {
      console.error("Error calling clinic:", error);
      setCallStatus("error");
      setCallMessage("Failed to initiate call. Please try calling directly.");
    }
  };

  const handleCallClick = (e: React.MouseEvent) => {
    if (enableTwilioCall) {
      e.preventDefault();
      handleTwilioCall();
    } else {
      onCall?.(clinic);
    }
  };

  const closeCallModal = () => {
    setIsCallingClinic(false);
    setCallStatus("idle");
    setCallMessage("");
  };

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
          {/* Call Button - Uses Twilio if enabled */}
          {enableTwilioCall ? (
            <button
              onClick={handleCallClick}
              disabled={callStatus === "calling"}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 transition-colors disabled:opacity-50"
            >
              {callStatus === "calling" ? (
                <span className="text-xl animate-pulse">📞</span>
              ) : (
                <span className="text-xl">📞</span>
              )}
              <span className="text-xs font-medium text-green-700 dark:text-green-400">
                {callStatus === "calling" ? "Calling..." : "Auto Call"}
              </span>
            </button>
          ) : (
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
          )}

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

      {/* Call Status Modal */}
      {isCallingClinic && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="text-center">
              {/* Calling State */}
              {callStatus === "calling" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <span className="text-3xl animate-bounce">📞</span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Calling {clinic.name}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Our assistant is calling the clinic on your behalf...
                  </p>
                  <div className="mt-4 flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-500 border-t-transparent"></div>
                  </div>
                </>
              )}

              {/* Waiting for Transcript State */}
              {callStatus === "waiting-transcript" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                    <span className="text-3xl">🎙️</span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Call in Progress
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {callMessage}
                  </p>
                  <div className="mt-4 flex justify-center items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-yellow-500 border-t-transparent"></div>
                    <span className="text-xs text-zinc-400">
                      Waiting for response...
                    </span>
                  </div>
                  {callSid && (
                    <p className="mt-2 text-xs text-zinc-400">
                      Call ID: {callSid.substring(0, 10)}...
                    </p>
                  )}
                </>
              )}

              {/* Analyzing Transcript State */}
              {callStatus === "analyzing" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <span className="text-3xl">🤖</span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Analyzing Response
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Processing the clinic&apos;s response...
                  </p>
                  <div className="mt-4 flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                  </div>
                </>
              )}

              {/* Complete State with Analysis */}
              {callStatus === "complete" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <span className="text-3xl">✅</span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {callMessage}
                  </h3>

                  {transcriptAnalysis && (
                    <div className="mt-4 text-left space-y-3">
                      {/* Summary */}
                      {transcriptAnalysis.summary && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
                          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            📝 Summary
                          </p>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {transcriptAnalysis.summary}
                          </p>
                        </div>
                      )}

                      {/* Accepting Patients */}
                      {transcriptAnalysis.acceptingPatients !== null &&
                        transcriptAnalysis.acceptingPatients !== undefined && (
                          <div
                            className={`p-3 rounded-lg ${transcriptAnalysis.acceptingPatients ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}
                          >
                            <p className="text-sm font-medium flex items-center gap-2">
                              {transcriptAnalysis.acceptingPatients ? (
                                <>
                                  <span>✅</span>
                                  <span className="text-green-700 dark:text-green-400">
                                    Accepting Patients
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>❌</span>
                                  <span className="text-red-700 dark:text-red-400">
                                    Not Accepting Patients
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        )}

                      {/* Walk-ins Status */}
                      {transcriptAnalysis.acceptsWalkIns === true && (
                        <div className="p-4 bg-green-100 dark:bg-green-900/40 rounded-lg border-2 border-green-500">
                          <p className="text-sm font-bold text-green-800 dark:text-green-300 flex items-center gap-2 mb-2">
                            <span className="text-xl">🚶</span>
                            Walk-ins Welcome!
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-400">
                            No appointment needed. You can go to the clinic now!
                          </p>
                          {transcriptAnalysis.waitTime && (
                            <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                              ⏱️ Estimated wait: {transcriptAnalysis.waitTime}
                            </p>
                          )}
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clinic.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
                          >
                            <span>🗺️</span> Get Directions
                          </a>
                        </div>
                      )}

                      {/* Appointments Only Notice */}
                      {transcriptAnalysis.appointmentsOnly === true && (
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                          <p className="text-sm font-medium text-orange-700 dark:text-orange-400 flex items-center gap-2">
                            <span>📅</span>
                            Appointments Required
                          </p>
                          <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                            This clinic does not accept walk-ins
                          </p>
                        </div>
                      )}

                      {/* Hours of Operation */}
                      {transcriptAnalysis.hoursOfOperation && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
                            🕐 Hours of Operation
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-300">
                            {transcriptAnalysis.hoursOfOperation}
                          </p>
                        </div>
                      )}

                      {/* Next Available */}
                      {transcriptAnalysis.nextAvailable && (
                        <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
                          <p className="text-sm font-medium text-teal-700 dark:text-teal-400 mb-1">
                            📅 Next Available
                          </p>
                          <p className="text-sm text-teal-600 dark:text-teal-300">
                            {transcriptAnalysis.nextAvailable}
                          </p>
                        </div>
                      )}

                      {/* Additional Info */}
                      {transcriptAnalysis.additionalInfo && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
                          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            ℹ️ Additional Info
                          </p>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {transcriptAnalysis.additionalInfo}
                          </p>
                        </div>
                      )}

                      {/* Book Appointment Button */}
                      {transcriptAnalysis.canBook && (
                        <button
                          onClick={() => handleBookingCall()}
                          className="w-full py-3 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 font-medium"
                        >
                          <span>📅</span> Book Appointment
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Booking Available State - Time slot selection after inquiry call */}
              {callStatus === "booking-available" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                    <span className="text-3xl">📅</span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Select a Time Slot
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    {callMessage}
                  </p>

                  {transcriptAnalysis && (
                    <div className="mt-4 text-left space-y-3">
                      {/* Summary */}
                      {transcriptAnalysis.summary && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
                          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            📝 Clinic Response
                          </p>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {transcriptAnalysis.summary}
                          </p>
                        </div>
                      )}

                      {/* Date info if available */}
                      {transcriptAnalysis.availableTimeRange?.date && (
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                            📆 {transcriptAnalysis.availableTimeRange.date}
                          </p>
                        </div>
                      )}

                      {/* Time Slot Selection */}
                      {getAvailableTimeSlots().length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            🕐 Choose a time:
                          </p>
                          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                            {getAvailableTimeSlots().map((slot, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  setSelectedTimeSlot(slot);
                                  handleBookingCall(slot);
                                }}
                                className="py-2 px-3 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-800/50 transition-colors text-sm font-medium border border-teal-200 dark:border-teal-700"
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        /* Fallback: Next Available info and book button */
                        <>
                          {transcriptAnalysis.nextAvailable && (
                            <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
                              <p className="text-sm font-medium text-teal-700 dark:text-teal-400 mb-1">
                                📅 Next Available
                              </p>
                              <p className="text-sm text-teal-600 dark:text-teal-300">
                                {transcriptAnalysis.nextAvailable}
                              </p>
                            </div>
                          )}
                          <button
                            onClick={() => handleBookingCall()}
                            className="w-full py-3 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 font-medium"
                          >
                            <span>📅</span> Book Next Available
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Booking Call State */}
              {callStatus === "booking-calling" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                    <span className="text-3xl animate-pulse">📅</span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Calling to Book Appointment
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Scheduling your appointment at {clinic.name}...
                  </p>
                  <div className="mt-4 flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-500 border-t-transparent"></div>
                  </div>
                </>
              )}

              {/* Waiting for Booking Transcript State */}
              {callStatus === "booking-waiting" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                    <span className="text-3xl">📞</span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Booking Call in Progress
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {callMessage}
                  </p>
                  <div className="mt-4 flex justify-center items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-yellow-500 border-t-transparent"></div>
                    <span className="text-xs text-zinc-400">
                      Confirming your booking...
                    </span>
                  </div>
                </>
              )}

              {/* Analyzing Booking Transcript State */}
              {callStatus === "booking-analyzing" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <span className="text-3xl">🤖</span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Processing Confirmation
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Analyzing the booking response...
                  </p>
                  <div className="mt-4 flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                  </div>
                </>
              )}

              {/* Booking Complete State */}
              {callStatus === "booking-complete" && (
                <>
                  <div
                    className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                      transcriptAnalysis?.bookingConfirmed
                        ? "bg-green-100 dark:bg-green-900/30"
                        : "bg-orange-100 dark:bg-orange-900/30"
                    }`}
                  >
                    <span className="text-3xl">
                      {transcriptAnalysis?.bookingConfirmed ? "✅" : "📋"}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {transcriptAnalysis?.bookingConfirmed
                      ? "Appointment Booked!"
                      : "Booking Update"}
                  </h3>

                  {transcriptAnalysis && (
                    <div className="mt-4 text-left space-y-3">
                      {/* Booking Status */}
                      <div
                        className={`p-3 rounded-lg ${
                          transcriptAnalysis.bookingConfirmed
                            ? "bg-green-50 dark:bg-green-900/20"
                            : "bg-orange-50 dark:bg-orange-900/20"
                        }`}
                      >
                        <p className="text-sm font-medium flex items-center gap-2">
                          {transcriptAnalysis.bookingConfirmed ? (
                            <>
                              <span>✅</span>
                              <span className="text-green-700 dark:text-green-400">
                                Confirmed
                              </span>
                            </>
                          ) : (
                            <>
                              <span>⏳</span>
                              <span className="text-orange-700 dark:text-orange-400">
                                Requires Follow-up
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Appointment Details - show confirmed time slot prominently */}
                      {(transcriptAnalysis.confirmedTimeSlot ||
                        transcriptAnalysis.appointmentTime ||
                        selectedTimeSlot) && (
                        <div
                          className={`p-4 rounded-lg border-2 ${
                            transcriptAnalysis.bookingConfirmed
                              ? "bg-teal-50 dark:bg-teal-900/20 border-teal-500"
                              : "bg-zinc-50 dark:bg-zinc-700/50 border-zinc-300"
                          }`}
                        >
                          <p className="text-sm font-medium text-teal-700 dark:text-teal-400 mb-1">
                            📅{" "}
                            {transcriptAnalysis.bookingConfirmed
                              ? "Confirmed Appointment"
                              : "Requested Time"}
                          </p>
                          <p className="text-lg font-bold text-teal-800 dark:text-teal-300">
                            {transcriptAnalysis.confirmedTimeSlot ||
                              transcriptAnalysis.appointmentTime ||
                              selectedTimeSlot}
                          </p>
                          {transcriptAnalysis.bookingConfirmed && (
                            <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                              at {clinic.name}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Decline Reason */}
                      {transcriptAnalysis.bookingDeclined &&
                        transcriptAnalysis.declineReason && (
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                              ⚠️ Reason
                            </p>
                            <p className="text-sm text-red-600 dark:text-red-300">
                              {transcriptAnalysis.declineReason}
                            </p>
                          </div>
                        )}

                      {/* Summary */}
                      {transcriptAnalysis.summary && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
                          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            📝 Summary
                          </p>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {transcriptAnalysis.summary}
                          </p>
                        </div>
                      )}

                      {/* Additional Info for next steps */}
                      {transcriptAnalysis.additionalInfo && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
                            ℹ️ Additional Info
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-300">
                            {transcriptAnalysis.additionalInfo}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Error State */}
              {callStatus === "error" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <span className="text-3xl">❌</span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Call Failed
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    {callMessage}
                  </p>
                  <a
                    href={`tel:${clinic.phone}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <span>📞</span> Call Directly: {clinic.phone}
                  </a>
                </>
              )}

              {/* Close Button - show for all non-in-progress states */}
              {![
                "calling",
                "waiting-transcript",
                "analyzing",
                "booking-calling",
                "booking-waiting",
                "booking-analyzing",
              ].includes(callStatus) && (
                <button
                  onClick={closeCallModal}
                  className="mt-4 w-full py-2 px-4 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                >
                  Close
                </button>
              )}

              {/* Cancel Button - show during waiting */}
              {(callStatus === "waiting-transcript" ||
                callStatus === "booking-waiting") && (
                <button
                  onClick={closeCallModal}
                  className="mt-4 w-full py-2 px-4 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                >
                  Close (call will continue in background)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
