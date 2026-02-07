"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface UserData {
  id: string;
  email: string;
  name: string;
}

export default function PostSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [step, setStep] = useState(1);

  // Form state
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState("");
  const [preferredClinic, setPreferredClinic] = useState("");
  const [location, setLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const userId = searchParams.get("userId");
      const email = searchParams.get("email");

      if (!userId && !email) {
        // No user info, redirect to login
        router.push("/login");
        return;
      }

      try {
        if (email) {
          const response = await fetch(
            `/api/auth/check-user?email=${encodeURIComponent(email)}`,
          );
          const data = await response.json();

          if (data.exists && data.isOnboarded) {
            // User is already onboarded, go directly to chat
            router.push("/chat");
            return;
          }

          if (data.exists) {
            setUserData(data.user);
          }
        }
      } catch (error) {
        console.error("Error checking user:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();
  }, [router, searchParams]);

  const handleAddAllergy = () => {
    if (allergyInput.trim() && !allergies.includes(allergyInput.trim())) {
      setAllergies([...allergies, allergyInput.trim()]);
      setAllergyInput("");
    }
  };

  const handleRemoveAllergy = (allergy: string) => {
    setAllergies(allergies.filter((a) => a !== allergy));
  };

  const handleAddCondition = () => {
    if (conditionInput.trim() && !conditions.includes(conditionInput.trim())) {
      setConditions([...conditions, conditionInput.trim()]);
      setConditionInput("");
    }
  };

  const handleRemoveCondition = (condition: string) => {
    setConditions(conditions.filter((c) => c !== condition));
  };

  const handleComplete = async () => {
    if (!userData?.id) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userData.id,
          childAllergies: allergies,
          medicalConditions: conditions,
          preferredClinic,
          location,
        }),
      });

      if (response.ok) {
        // Onboarding complete, redirect to chat
        router.push("/chat");
      } else {
        console.error("Failed to complete onboarding");
      }
    } catch (error) {
      console.error("Error completing onboarding:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    router.push("/chat");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-teal-950 dark:to-cyan-900">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900">
            <span className="text-3xl animate-bounce">🩹</span>
          </div>
          <p className="text-teal-700 dark:text-teal-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-teal-950 dark:to-cyan-900 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900">
            <span className="text-3xl">🩹</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Welcome to BooBoo Buddy!
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {userData?.name ? `Hi ${userData.name}! ` : ""}
            Let&apos;s set up your profile to personalize your experience.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full ${
                s <= step ? "bg-teal-500" : "bg-zinc-200 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Location Information */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              Your Location
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              This helps us find clinics near you when you need care.
            </p>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Zip Code or City
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., 98101 or Seattle, WA"
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 rounded-xl border border-zinc-300 px-6 py-3 font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Skip for now
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-xl bg-teal-600 px-6 py-3 font-medium text-white transition-colors hover:bg-teal-700"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Medical Information */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              Medical Information
            </h2>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Known Allergies
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={allergyInput}
                  onChange={(e) => setAllergyInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddAllergy()}
                  placeholder="Add an allergy"
                  className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  onClick={handleAddAllergy}
                  className="rounded-xl bg-teal-100 px-4 py-2 text-teal-700 hover:bg-teal-200 dark:bg-teal-900 dark:text-teal-400"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {allergies.map((allergy) => (
                  <span
                    key={allergy}
                    className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm text-red-700 dark:bg-red-900 dark:text-red-300"
                  >
                    {allergy}
                    <button
                      onClick={() => handleRemoveAllergy(allergy)}
                      className="ml-1 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Medical Conditions
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddCondition()}
                  placeholder="Add a condition"
                  className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  onClick={handleAddCondition}
                  className="rounded-xl bg-teal-100 px-4 py-2 text-teal-700 hover:bg-teal-200 dark:bg-teal-900 dark:text-teal-400"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {conditions.map((condition) => (
                  <span
                    key={condition}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                  >
                    {condition}
                    <button
                      onClick={() => handleRemoveCondition(condition)}
                      className="ml-1 text-amber-500 hover:text-amber-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-zinc-300 px-6 py-3 font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 rounded-xl bg-teal-600 px-6 py-3 font-medium text-white transition-colors hover:bg-teal-700"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preferred Clinic */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              Preferred Healthcare Provider
            </h2>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Preferred Clinic or Doctor (Optional)
              </label>
              <input
                type="text"
                value={preferredClinic}
                onChange={(e) => setPreferredClinic(e.target.value)}
                placeholder="Enter clinic or doctor name"
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                We&apos;ll prioritize this clinic when searching for available
                appointments.
              </p>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
              <h3 className="mb-3 font-medium text-zinc-800 dark:text-zinc-200">
                Profile Summary
              </h3>
              <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                {location && <p>� Location: {location}</p>}
                {allergies.length > 0 && (
                  <p>⚠️ Allergies: {allergies.join(", ")}</p>
                )}
                {conditions.length > 0 && (
                  <p>🏥 Conditions: {conditions.join(", ")}</p>
                )}
                {preferredClinic && (
                  <p>🏨 Preferred Clinic: {preferredClinic}</p>
                )}
                {!location &&
                  !allergies.length &&
                  !conditions.length &&
                  !preferredClinic && (
                    <p className="italic">No information added yet.</p>
                  )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-xl border border-zinc-300 px-6 py-3 font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-teal-600 px-6 py-3 font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Complete Setup"}
              </button>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
          You can update this information anytime from your profile.
        </p>
      </div>
    </div>
  );
}
