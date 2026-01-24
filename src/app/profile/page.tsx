"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Allergy {
  id: number;
  name: string;
  severity: "mild" | "moderate" | "severe";
}

interface Ailment {
  id: number;
  name: string;
  diagnosedDate: string;
}

interface Prescription {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
}

interface PreferredFacility {
  id: number;
  name: string;
  type: "hospital" | "clinic" | "urgent-care" | "pharmacy";
  address: string;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  location: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
  };
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  insurance: {
    hasInsurance: boolean;
    provider: string;
    policyNumber: string;
    groupNumber: string;
  };
  allergies: Allergy[];
  ailments: Ailment[];
  prescriptions: Prescription[];
  preferredFacilities: PreferredFacility[];
}

const initialProfile: UserProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  location: {
    address: "",
    city: "",
    state: "",
    zipCode: "",
  },
  emergencyContact: {
    name: "",
    phone: "",
    relationship: "",
  },
  insurance: {
    hasInsurance: false,
    provider: "",
    policyNumber: "",
    groupNumber: "",
  },
  allergies: [],
  ailments: [],
  prescriptions: [],
  preferredFacilities: [],
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [activeTab, setActiveTab] = useState<
    "personal" | "medical" | "facilities"
  >("personal");
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  // Allergy handlers
  const [newAllergy, setNewAllergy] = useState<{
    name: string;
    severity: "mild" | "moderate" | "severe";
  }>({ name: "", severity: "mild" });
  const addAllergy = () => {
    if (newAllergy.name.trim()) {
      setProfile((prev) => ({
        ...prev,
        allergies: [...prev.allergies, { id: Date.now(), ...newAllergy }],
      }));
      setNewAllergy({ name: "", severity: "mild" });
    }
  };
  const removeAllergy = (id: number) => {
    setProfile((prev) => ({
      ...prev,
      allergies: prev.allergies.filter((a) => a.id !== id),
    }));
  };

  // Ailment handlers
  const [newAilment, setNewAilment] = useState({ name: "", diagnosedDate: "" });
  const addAilment = () => {
    if (newAilment.name.trim()) {
      setProfile((prev) => ({
        ...prev,
        ailments: [...prev.ailments, { id: Date.now(), ...newAilment }],
      }));
      setNewAilment({ name: "", diagnosedDate: "" });
    }
  };
  const removeAilment = (id: number) => {
    setProfile((prev) => ({
      ...prev,
      ailments: prev.ailments.filter((a) => a.id !== id),
    }));
  };

  // Prescription handlers
  const [newPrescription, setNewPrescription] = useState({
    name: "",
    dosage: "",
    frequency: "",
  });
  const addPrescription = () => {
    if (newPrescription.name.trim()) {
      setProfile((prev) => ({
        ...prev,
        prescriptions: [
          ...prev.prescriptions,
          { id: Date.now(), ...newPrescription },
        ],
      }));
      setNewPrescription({ name: "", dosage: "", frequency: "" });
    }
  };
  const removePrescription = (id: number) => {
    setProfile((prev) => ({
      ...prev,
      prescriptions: prev.prescriptions.filter((p) => p.id !== id),
    }));
  };

  // Facility handlers
  const [newFacility, setNewFacility] = useState<{
    name: string;
    type: "hospital" | "clinic" | "urgent-care" | "pharmacy";
    address: string;
  }>({ name: "", type: "clinic", address: "" });
  const addFacility = () => {
    if (newFacility.name.trim()) {
      setProfile((prev) => ({
        ...prev,
        preferredFacilities: [
          ...prev.preferredFacilities,
          { id: Date.now(), ...newFacility },
        ],
      }));
      setNewFacility({ name: "", type: "clinic", address: "" });
    }
  };
  const removeFacility = (id: number) => {
    setProfile((prev) => ({
      ...prev,
      preferredFacilities: prev.preferredFacilities.filter((f) => f.id !== id),
    }));
  };

  const handleSave = () => {
    setIsSaving(true);
    // Simulate save
    setTimeout(() => {
      setIsSaving(false);
      console.log("Profile saved:", profile);
    }, 1000);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "mild":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "moderate":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "severe":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
    }
  };

  const getFacilityIcon = (type: string) => {
    switch (type) {
      case "hospital":
        return "🏥";
      case "clinic":
        return "🩺";
      case "urgent-care":
        return "🚑";
      case "pharmacy":
        return "💊";
      default:
        return "🏢";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-teal-950 dark:to-cyan-900">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-teal-200 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-teal-800 dark:bg-zinc-900/80">
        <div className="flex items-center gap-3">
          <Link href="/chat" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900">
              <span className="text-xl">🩹</span>
            </div>
            <div>
              <h1 className="font-bold text-teal-700 dark:text-teal-400">
                BooBoo Buddy
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Health Profile
              </p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Back to Chat
          </Link>
          <button
            onClick={() => router.push("/login")}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 md:p-8">
        {/* Profile Header Card */}
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-100 text-4xl dark:bg-teal-900">
              👤
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {profile.firstName || profile.lastName
                  ? `${profile.firstName} ${profile.lastName}`
                  : "Your Profile"}
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400">
                Manage your health information and preferences
              </p>
            </div>
            <div className="ml-auto">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-lg bg-teal-600 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 overflow-x-auto rounded-xl bg-white p-1.5 shadow-lg dark:bg-zinc-900">
          {[
            { id: "personal", label: "Personal Info", icon: "👤" },
            { id: "medical", label: "Medical History", icon: "🏥" },
            { id: "facilities", label: "Preferred Facilities", icon: "📍" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-teal-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Personal Info Tab */}
        {activeTab === "personal" && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                <span>📋</span> Basic Information
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profile.firstName}
                    onChange={(e) =>
                      setProfile({ ...profile, firstName: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={profile.lastName}
                    onChange={(e) =>
                      setProfile({ ...profile, lastName: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="Doe"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile({ ...profile, email: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile({ ...profile, phone: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={profile.dateOfBirth}
                    onChange={(e) =>
                      setProfile({ ...profile, dateOfBirth: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                <span>📍</span> Location
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={profile.location.address}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        location: {
                          ...profile.location,
                          address: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="123 Main St"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    City
                  </label>
                  <input
                    type="text"
                    value={profile.location.city}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        location: { ...profile.location, city: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="New York"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    State
                  </label>
                  <input
                    type="text"
                    value={profile.location.state}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        location: {
                          ...profile.location,
                          state: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="NY"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={profile.location.zipCode}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        location: {
                          ...profile.location,
                          zipCode: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="10001"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                <span>🚨</span> Emergency Contact
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Name
                  </label>
                  <input
                    type="text"
                    value={profile.emergencyContact.name}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        emergencyContact: {
                          ...profile.emergencyContact,
                          name: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={profile.emergencyContact.phone}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        emergencyContact: {
                          ...profile.emergencyContact,
                          phone: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="(555) 987-6543"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Relationship
                  </label>
                  <input
                    type="text"
                    value={profile.emergencyContact.relationship}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        emergencyContact: {
                          ...profile.emergencyContact,
                          relationship: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="Spouse"
                  />
                </div>
              </div>
            </div>

            {/* Health Insurance */}
            <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                <span>🏦</span> Health Insurance
              </h3>
              <div className="mb-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={profile.insurance.hasInsurance}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        insurance: {
                          ...profile.insurance,
                          hasInsurance: e.target.checked,
                        },
                      })
                    }
                    className="h-5 w-5 rounded border-zinc-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    I have health insurance
                  </span>
                </label>
              </div>
              {profile.insurance.hasInsurance && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Provider
                    </label>
                    <input
                      type="text"
                      value={profile.insurance.provider}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          insurance: {
                            ...profile.insurance,
                            provider: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="Blue Cross Blue Shield"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Policy Number
                    </label>
                    <input
                      type="text"
                      value={profile.insurance.policyNumber}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          insurance: {
                            ...profile.insurance,
                            policyNumber: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="ABC123456789"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Group Number
                    </label>
                    <input
                      type="text"
                      value={profile.insurance.groupNumber}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          insurance: {
                            ...profile.insurance,
                            groupNumber: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="GRP001"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Medical History Tab */}
        {activeTab === "medical" && (
          <div className="space-y-6">
            {/* Allergies */}
            <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                <span>⚠️</span> Medication Allergies
              </h3>
              <div className="mb-4 flex flex-wrap gap-2">
                {profile.allergies.map((allergy) => (
                  <span
                    key={allergy.id}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${getSeverityColor(
                      allergy.severity,
                    )}`}
                  >
                    {allergy.name}
                    <span className="text-xs opacity-75">
                      ({allergy.severity})
                    </span>
                    <button
                      onClick={() => removeAllergy(allergy.id)}
                      className="ml-1 hover:opacity-75"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {profile.allergies.length === 0 && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No allergies added
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newAllergy.name}
                  onChange={(e) =>
                    setNewAllergy({ ...newAllergy, name: e.target.value })
                  }
                  placeholder="Medication name"
                  className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <select
                  value={newAllergy.severity}
                  onChange={(e) =>
                    setNewAllergy({
                      ...newAllergy,
                      severity: e.target.value as Allergy["severity"],
                    })
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
                <button
                  onClick={addAllergy}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Diagnosed Ailments */}
            <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                <span>🩺</span> Diagnosed Conditions
              </h3>
              <div className="mb-4 space-y-2">
                {profile.ailments.map((ailment) => (
                  <div
                    key={ailment.id}
                    className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800"
                  >
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {ailment.name}
                      </p>
                      {ailment.diagnosedDate && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Diagnosed:{" "}
                          {new Date(ailment.diagnosedDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeAilment(ailment.id)}
                      className="text-zinc-400 hover:text-red-500"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
                {profile.ailments.length === 0 && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No conditions added
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newAilment.name}
                  onChange={(e) =>
                    setNewAilment({ ...newAilment, name: e.target.value })
                  }
                  placeholder="Condition name"
                  className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <input
                  type="date"
                  value={newAilment.diagnosedDate}
                  onChange={(e) =>
                    setNewAilment({
                      ...newAilment,
                      diagnosedDate: e.target.value,
                    })
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  onClick={addAilment}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Current Prescriptions */}
            <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                <span>💊</span> Current Prescriptions
              </h3>
              <div className="mb-4 space-y-2">
                {profile.prescriptions.map((prescription) => (
                  <div
                    key={prescription.id}
                    className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800"
                  >
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {prescription.name}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {prescription.dosage} • {prescription.frequency}
                      </p>
                    </div>
                    <button
                      onClick={() => removePrescription(prescription.id)}
                      className="text-zinc-400 hover:text-red-500"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
                {profile.prescriptions.length === 0 && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No prescriptions added
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newPrescription.name}
                  onChange={(e) =>
                    setNewPrescription({
                      ...newPrescription,
                      name: e.target.value,
                    })
                  }
                  placeholder="Medication name"
                  className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <input
                  type="text"
                  value={newPrescription.dosage}
                  onChange={(e) =>
                    setNewPrescription({
                      ...newPrescription,
                      dosage: e.target.value,
                    })
                  }
                  placeholder="Dosage (e.g., 10mg)"
                  className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <input
                  type="text"
                  value={newPrescription.frequency}
                  onChange={(e) =>
                    setNewPrescription({
                      ...newPrescription,
                      frequency: e.target.value,
                    })
                  }
                  placeholder="Frequency (e.g., Once daily)"
                  className="w-40 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  onClick={addPrescription}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preferred Facilities Tab */}
        {activeTab === "facilities" && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                <span>🏥</span> Preferred Healthcare Facilities
              </h3>
              <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                Add hospitals, clinics, urgent care centers, or pharmacies you
                prefer to visit.
              </p>
              <div className="mb-4 space-y-3">
                {profile.preferredFacilities.map((facility) => (
                  <div
                    key={facility.id}
                    className="flex items-start justify-between rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">
                        {getFacilityIcon(facility.type)}
                      </span>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {facility.name}
                        </p>
                        <p className="text-sm capitalize text-teal-600 dark:text-teal-400">
                          {facility.type.replace("-", " ")}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {facility.address}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFacility(facility.id)}
                      className="text-zinc-400 hover:text-red-500"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
                {profile.preferredFacilities.length === 0 && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No preferred facilities added
                  </p>
                )}
              </div>
              <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Add New Facility
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={newFacility.name}
                    onChange={(e) =>
                      setNewFacility({ ...newFacility, name: e.target.value })
                    }
                    placeholder="Facility name"
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <select
                    value={newFacility.type}
                    onChange={(e) =>
                      setNewFacility({
                        ...newFacility,
                        type: e.target.value as PreferredFacility["type"],
                      })
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="hospital">Hospital</option>
                    <option value="clinic">Walk-in Clinic</option>
                    <option value="urgent-care">Urgent Care</option>
                    <option value="pharmacy">Pharmacy</option>
                  </select>
                  <input
                    type="text"
                    value={newFacility.address}
                    onChange={(e) =>
                      setNewFacility({
                        ...newFacility,
                        address: e.target.value,
                      })
                    }
                    placeholder="Address"
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:col-span-2"
                  />
                </div>
                <button
                  onClick={addFacility}
                  className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Add Facility
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
