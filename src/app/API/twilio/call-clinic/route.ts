import { NextRequest, NextResponse } from "next/server";
import { makeCallWithMessage } from "@/lib/twilio";

/**
 * Synthesizes raw symptom text into a clear, medical summary using the LLM
 */
async function synthesizeSymptoms(rawSymptoms: string): Promise<string> {
  if (!rawSymptoms || rawSymptoms.trim().length === 0) {
    return "";
  }

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback: basic cleanup without LLM
    return cleanupSymptoms(rawSymptoms);
  }

  const isOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const baseURL = isOpenRouter
    ? "https://openrouter.ai/api/v1"
    : "https://api.openai.com/v1";

  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(isOpenRouter && {
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "BooBoo Buddy",
        }),
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a medical assistant helping to summarize a patient's symptoms for a clinic receptionist. 
Given the patient's conversation history, extract and summarize ONLY the actual medical symptoms mentioned.

Rules:
- Extract only medical symptoms (pain, fever, cough, injury, etc.)
- Ignore location requests, clinic searches, or non-medical text
- Be concise - one sentence maximum
- Use clear medical terminology appropriate for a phone call
- If no clear symptoms are mentioned, respond with "general medical consultation"

Examples:
- Input: "I have a headache and fever since yesterday, also feeling nauseous"
  Output: "headache, fever, and nausea for the past day"
- Input: "Find nearby clinics, k1j9a1. my throat hurts and I can't swallow"
  Output: "sore throat with difficulty swallowing"
- Input: "I need to see a doctor"
  Output: "general medical consultation"`,
          },
          {
            role: "user",
            content: rawSymptoms,
          },
        ],
        temperature: 0.3,
        max_tokens: 100,
      }),
    });

    const data = await response.json();
    const synthesized = data.choices?.[0]?.message?.content?.trim() || "";

    console.log(
      `🔬 Symptom synthesis: "${rawSymptoms.substring(0, 50)}..." → "${synthesized}"`,
    );

    return synthesized || cleanupSymptoms(rawSymptoms);
  } catch (error) {
    console.error("Error synthesizing symptoms:", error);
    return cleanupSymptoms(rawSymptoms);
  }
}

/**
 * Basic symptom cleanup without LLM (fallback)
 */
function cleanupSymptoms(symptoms: string): string {
  // Remove common non-symptom phrases
  const cleaned = symptoms
    .replace(/find\s*(nearby\s*)?clinics?/gi, "")
    .replace(/search\s*(for\s*)?clinics?/gi, "")
    .replace(/[a-z]\d[a-z]\s*\d[a-z]\d/gi, "") // Remove postal codes
    .replace(/\b\d{5}(-\d{4})?\b/g, "") // Remove ZIP codes
    .replace(/book\s*(an?\s*)?appointment/gi, "")
    .replace(/i\s*need\s*(to\s*see\s*)?(a\s*)?doctor/gi, "")
    .trim();

  return cleaned || "general medical consultation";
}

/**
 * POST /api/twilio/call-clinic
 * Makes an automated call to a clinic on behalf of a patient
 * Supports both inquiry calls and booking confirmation calls
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clinicPhone,
      clinicName,
      patientMessage,
      symptoms,
      isBookingCall = false,
      requestedTime,
      patientName = "the patient",
    } = body;

    if (!clinicPhone) {
      return NextResponse.json(
        { error: "Clinic phone number is required" },
        { status: 400 },
      );
    }

    // Format phone number to E.164 if needed
    let formattedPhone = clinicPhone.replace(/[^0-9+]/g, "");
    if (!formattedPhone.startsWith("+")) {
      // Assume North American number if no country code
      if (formattedPhone.length === 10) {
        formattedPhone = `+1${formattedPhone}`;
      } else if (
        formattedPhone.length === 11 &&
        formattedPhone.startsWith("1")
      ) {
        formattedPhone = `+${formattedPhone}`;
      }
    }

    // Synthesize symptoms into a clear medical summary
    const synthesizedSymptoms = symptoms
      ? await synthesizeSymptoms(symptoms)
      : "";

    console.log(`🔬 Raw symptoms: "${symptoms}"`);
    console.log(`🔬 Synthesized: "${synthesizedSymptoms}"`);

    // Build the message for the clinic - different for booking vs inquiry
    const message =
      patientMessage ||
      (isBookingCall
        ? buildBookingMessage(
            clinicName,
            requestedTime,
            patientName,
            synthesizedSymptoms,
          )
        : buildDefaultMessage(clinicName, synthesizedSymptoms));

    console.log(`\n📞 Calling clinic: ${clinicName}`);
    console.log(`   Phone: ${formattedPhone}`);
    console.log(`   Is booking call: ${isBookingCall}`);
    console.log(`   Message: "${message}"\n`);

    const result = await makeCallWithMessage(formattedPhone, message);

    return NextResponse.json({
      success: true,
      callSid: result.callSid,
      status: result.status,
      clinicName,
      isBookingCall,
      message: isBookingCall
        ? `Booking call initiated to ${clinicName}`
        : `Call initiated to ${clinicName}`,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Error calling clinic:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}

function buildDefaultMessage(clinicName?: string, symptoms?: string): string {
  const clinicGreeting = clinicName
    ? `Hello, I am calling ${clinicName}.`
    : "Hello.";

  const symptomInfo =
    symptoms && symptoms !== "general medical consultation"
      ? `The patient is experiencing ${symptoms}.`
      : "The patient would like to be seen for a general medical consultation.";

  return `${clinicGreeting} This is an automated health assistant calling on behalf of a patient. ${symptomInfo} Could you please let us know if you accept walk-ins, or if an appointment is required? If appointments are needed, what is the earliest available time today or tomorrow? We will record your response. Thank you.`;
}

function buildBookingMessage(
  clinicName?: string,
  requestedTime?: string,
  patientName?: string,
  symptoms?: string,
): string {
  const clinicGreeting = clinicName
    ? `Hello, I am calling ${clinicName} again.`
    : "Hello.";

  const timeRequest = requestedTime
    ? `We would like to book an appointment for ${requestedTime}.`
    : "We would like to book the next available appointment.";

  const symptomInfo =
    symptoms && symptoms !== "general medical consultation"
      ? `The patient is experiencing ${symptoms}.`
      : "";

  return `${clinicGreeting} This is an automated health assistant calling to book an appointment on behalf of ${patientName}. ${timeRequest} ${symptomInfo} Can you please confirm this appointment? We will record your response. Thank you.`;
}
