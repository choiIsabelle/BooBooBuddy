import twilio from "twilio";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Initialize Twilio client
const client = twilio(accountSid, authToken);

/**
 * GET /api/twilio/get-transcript?callSid=CA1234567890
 * Fetches transcription for a call from Twilio's API
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const callSid = url.searchParams.get("callSid");

    if (!callSid) {
      return new Response(JSON.stringify({ error: "callSid required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`📝 Fetching transcription for call ${callSid}`);

    // Get recordings for this call
    const recordings = await client.recordings.list({
      callSid: callSid,
    });

    if (recordings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recordings found for this call" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const recording = recordings[0];
    console.log(`Found recording: ${recording.sid}`);

    // Get transcriptions for the recording
    const transcriptions = await client
      .recordings(recording.sid)
      .transcriptions.list();

    if (transcriptions.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No transcriptions found yet. Please try again in a few seconds.",
          recordingSid: recording.sid,
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const transcription = transcriptions[0];
    const transcriptData = {
      callSid: callSid,
      recordingSid: recording.sid,
      transcriptionText: transcription.transcriptionText,
      recordingUrl: recording.uri,
      timestamp: new Date().toISOString(),
    };

    console.log("✅ Transcript retrieved:", transcriptData);

    // Save to file
    try {
      const transcriptsDir = join(process.cwd(), "transcripts");
      await mkdir(transcriptsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `transcript_${timestamp}.txt`;
      const filepath = join(transcriptsDir, filename);

      const fileContent = `=== Clinic Response Transcript ===
Call SID: ${callSid}
Recording SID: ${recording.sid}
Date/Time: ${transcriptData.timestamp}

TRANSCRIPT:
${transcription.transcriptionText}

RECORDING URL:
${recording.uri}

=================================`;

      await writeFile(filepath, fileContent, "utf-8");
      console.log(`💾 Transcript saved to: ${filepath}`);
    } catch (fileError) {
      console.error("❌ Error saving transcript file:", fileError);
    }

    return new Response(JSON.stringify(transcriptData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Error fetching transcript:", errorMessage);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
