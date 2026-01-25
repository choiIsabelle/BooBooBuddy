import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

// In-memory store for transcriptions (in production, use a database)
// This allows the get-transcript endpoint to retrieve completed transcriptions
const transcriptionStore = new Map<
  string,
  {
    text: string;
    timestamp: string;
    recordingSid: string;
  }
>();

// Export the store so get-transcript can access it
export { transcriptionStore };

/**
 * POST /api/twilio/transcription-callback
 * Receives transcription results from Twilio when they're ready
 *
 * Twilio sends:
 * - TranscriptionSid
 * - TranscriptionText
 * - TranscriptionStatus
 * - TranscriptionUrl
 * - RecordingSid
 * - RecordingUrl
 * - CallSid
 * - AccountSid
 */
export async function POST(request: NextRequest) {
  try {
    // Twilio sends form data
    const formData = await request.formData();

    const callSid = formData.get("CallSid") as string;
    const recordingSid = formData.get("RecordingSid") as string;
    const transcriptionSid = formData.get("TranscriptionSid") as string;
    const transcriptionText = formData.get("TranscriptionText") as string;
    const transcriptionStatus = formData.get("TranscriptionStatus") as string;

    console.log(`\n📨 Received transcription callback:`);
    console.log(`   Call SID: ${callSid}`);
    console.log(`   Recording SID: ${recordingSid}`);
    console.log(`   Transcription SID: ${transcriptionSid}`);
    console.log(`   Status: ${transcriptionStatus}`);
    console.log(`   Text: "${transcriptionText}"\n`);

    if (transcriptionStatus === "completed" && transcriptionText) {
      // Store the transcription so get-transcript can retrieve it
      transcriptionStore.set(callSid, {
        text: transcriptionText,
        timestamp: new Date().toISOString(),
        recordingSid: recordingSid,
      });

      // Also save to file for persistence
      try {
        const transcriptsDir = join(process.cwd(), "transcripts");
        await mkdir(transcriptsDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `transcript_callback_${timestamp}.txt`;
        const filepath = join(transcriptsDir, filename);

        const fileContent = `=== Clinic Response Transcript (Callback) ===
Call SID: ${callSid}
Recording SID: ${recordingSid}
Transcription SID: ${transcriptionSid}
Date/Time: ${new Date().toISOString()}
Status: ${transcriptionStatus}

TRANSCRIPT:
${transcriptionText}

=================================`;

        await writeFile(filepath, fileContent, "utf-8");
        console.log(`💾 Transcription saved to: ${filepath}`);
      } catch (fileError) {
        console.error("❌ Error saving transcript file:", fileError);
      }
    }

    // Twilio expects a 200 OK response
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("❌ Error processing transcription callback:", error);
    // Still return 200 to prevent Twilio from retrying
    return new NextResponse("OK", { status: 200 });
  }
}
