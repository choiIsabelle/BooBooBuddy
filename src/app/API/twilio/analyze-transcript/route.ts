import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/twilio/analyze-transcript
 * Analyzes a clinic call transcript using the LLM to extract:
 * - Whether the clinic is accepting patients
 * - Hours of operation
 * - Available appointment times
 * - Whether booking is possible
 * - If this is a booking confirmation response
 * - General summary
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, clinicName, isBookingCall = false } = body;

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 },
      );
    }

    console.log(`🔍 Analyzing transcript for ${clinicName || "clinic"}...`);
    console.log(`   Is booking call: ${isBookingCall}`);
    console.log(`   Transcript: "${transcript.substring(0, 100)}..."`);

    // Use OpenRouter/OpenAI to analyze the transcript
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    const isOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const baseURL = isOpenRouter
      ? "https://openrouter.ai/api/v1"
      : "https://api.openai.com/v1";

    if (!apiKey) {
      // Fallback to simple analysis if no API key
      return NextResponse.json({
        success: true,
        analysis: {
          summary: transcript,
          acceptingPatients: null,
          hoursOfOperation: null,
          nextAvailable: null,
          canBook: false,
          rawTranscript: transcript,
        },
      });
    }

    // Different prompts for initial call vs booking confirmation call
    const systemPrompt = isBookingCall
      ? `You are analyzing a phone call transcript where we attempted to book an appointment at a medical clinic. Extract the following information and respond in JSON format:

{
  "summary": "A brief 1-2 sentence summary of the clinic's response",
  "bookingConfirmed": true/false (did they confirm an appointment was booked?),
  "confirmedTimeSlot": "the exact time slot that was confirmed, e.g. '2:30 PM' or 'January 25 at 10:00 AM', or null if not confirmed",
  "appointmentTime": "string describing the confirmed appointment time in full detail, or null if not confirmed",
  "bookingDeclined": true/false (did they explicitly decline or say they couldn't book?),
  "declineReason": "reason given for declining, or null",
  "additionalInfo": "any other relevant details like what to bring, where to go, etc."
}

Be concise and extract only factual information. If the booking was successful, set bookingConfirmed to true and include the exact time in confirmedTimeSlot.`
      : `You are analyzing a phone call transcript from a medical clinic. Extract the following information and respond in JSON format:

{
  "summary": "A brief 1-2 sentence summary of what the clinic said",
  "acceptingPatients": true/false/null (null if not mentioned),
  "acceptsWalkIns": true/false/null (true if they said walk-ins are welcome/accepted, false if appointments only, null if not mentioned),
  "appointmentsOnly": true/false (true if they explicitly said appointments are required and no walk-ins, false otherwise),
  "hoursOfOperation": "string describing hours if mentioned, or null",
  "availableTimeRange": {
    "start": "start time if a range was given, e.g. '9:00 AM', or null",
    "end": "end time if a range was given, e.g. '5:00 PM', or null",
    "date": "the date these times are for, e.g. 'today', 'tomorrow', 'January 25', or null"
  },
  "specificTimeSlots": ["array of specific time slots if mentioned, e.g. ['10:00 AM', '2:30 PM', '4:00 PM'], or empty array []"],
  "nextAvailable": "string describing next available appointment if mentioned, or null",
  "canBook": true/false (set to true ONLY if appointments are required - meaning they don't accept walk-ins),
  "suggestedTime": "if they mentioned a specific available time, include it here, otherwise null",
  "waitTime": "estimated wait time if mentioned, or null",
  "additionalInfo": "any other relevant details mentioned"
}

IMPORTANT: 
- If the clinic accepts walk-ins, set acceptsWalkIns=true, appointmentsOnly=false, canBook=false (no booking needed, patient can just go)
- If the clinic requires appointments (no walk-ins), set acceptsWalkIns=false, appointmentsOnly=true, canBook=true (we need to book)
- Extract time slot information carefully:
  - If they say "we have openings between 2 PM and 5 PM", set availableTimeRange with start="2:00 PM", end="5:00 PM"
  - If they say "we have slots at 10 AM, 2:30 PM, or 4 PM", set specificTimeSlots=["10:00 AM", "2:30 PM", "4:00 PM"]
- Be concise and extract only factual information from the transcript.`;

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
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Clinic: ${clinicName || "Unknown"}\n\nTranscript:\n${transcript}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error("LLM API error:", await response.text());
      // Fallback to raw transcript
      return NextResponse.json({
        success: true,
        analysis: {
          summary: transcript,
          acceptingPatients: null,
          hoursOfOperation: null,
          nextAvailable: null,
          canBook: false,
          rawTranscript: transcript,
        },
      });
    }

    const llmResponse = await response.json();
    const content = llmResponse.choices?.[0]?.message?.content;

    console.log("📝 LLM Analysis:", content);

    // Try to parse JSON from response
    let analysis;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = { summary: content };
      }
    } catch {
      analysis = { summary: content };
    }

    // Add raw transcript and booking call flag
    analysis.rawTranscript = transcript;
    analysis.isBookingCall = isBookingCall;

    return NextResponse.json({
      success: true,
      clinicName,
      analysis,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Error analyzing transcript:", errorMessage);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
