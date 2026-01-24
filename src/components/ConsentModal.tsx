"use client";

import { useState } from "react";

interface ConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function ConsentModal({ onAccept, onDecline }: ConsentModalProps) {
  const [hasReadTerms, setHasReadTerms] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-teal-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🩹</span>
            <div>
              <h2 className="text-xl font-bold text-white">Welcome to BooBoo Buddy</h2>
              <p className="text-teal-100 text-sm">Please review before continuing</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                <span>⚕️</span> Important Medical Disclaimer
              </h3>
              <p className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-amber-800 dark:text-amber-200">
                <strong>BooBoo Buddy is NOT a substitute for professional medical advice, diagnosis, or treatment.</strong> Always seek the advice of a qualified healthcare provider with any questions regarding a medical condition. If you think your child may have a medical emergency, call your doctor or 911 immediately.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                <span>🤖</span> How This Service Works
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>BooBoo Buddy uses AI to help you describe symptoms and find nearby clinics</li>
                <li>We collect information about your child&apos;s symptoms to assist in triage</li>
                <li>We may suggest healthcare providers based on your location</li>
                <li>All recommendations are for informational purposes only</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                <span>🔒</span> Your Privacy
              </h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Conversations are stored securely to provide continuous care</li>
                <li>Your data is never sold to third parties</li>
                <li>Health information is handled in accordance with applicable privacy laws</li>
                <li>You can request deletion of your data at any time</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                <span>📋</span> Informed Consent
              </h3>
              <p>By using BooBoo Buddy, you acknowledge and agree that:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li>You are the parent or legal guardian of the child being discussed</li>
                <li>You understand this is an AI assistant, not a licensed medical professional</li>
                <li>You will seek professional medical care for serious or emergency conditions</li>
                <li>You consent to the collection of health information for triage purposes</li>
                <li>You understand that AI responses may not always be accurate</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                <span>🚨</span> When to Seek Emergency Care
              </h3>
              <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-800 dark:text-red-200">
                Call 911 or go to the emergency room immediately if your child experiences: difficulty breathing, loss of consciousness, severe bleeding, seizures, signs of poisoning, or any life-threatening symptoms.
              </p>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
          <label className="flex items-start gap-3 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={hasReadTerms}
              onChange={(e) => setHasReadTerms(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              I have read and understood the above information. I consent to using BooBoo Buddy and understand it is not a substitute for professional medical care.
            </span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={onDecline}
              className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              Decline
            </button>
            <button
              onClick={onAccept}
              disabled={!hasReadTerms}
              className="flex-1 px-4 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I Agree & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
