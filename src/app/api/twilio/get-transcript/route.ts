import twilio from "twilio";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

// Import the transcription store from the callback endpoint
import { transcriptionStore } from "../../../API/twilio/transcription-callback/route";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Initialize Twilio client
const client = twilio(accountSid, authToken);

/**
 * GET /api/twilio/get-transcript?callSid=CA1234567890
 * Fetches transcription for a call from Twilio's API
 * Also checks the in-memory store for transcriptions received via callback
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

    // First, check if we received the transcription via callback
    const storedTranscription = transcriptionStore.get(callSid);
    if (storedTranscription) {
      console.log(`✅ Found transcription in callback store`);
      return new Response(
        JSON.stringify({
          callSid: callSid,
          recordingSid: storedTranscription.recordingSid,
          transcriptionText: storedTranscription.text,
          timestamp: storedTranscription.timestamp,
          source: "callback",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get recordings for this call

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
        },
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
          message:
            "No transcriptions found yet. Please try again in a few seconds.",
          recordingSid: recording.sid,
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const transcription = transcriptions[0];

    // Check if transcription is still processing
    console.log(`Transcription status: ${transcription.status}`);
    console.log(`Transcription text: ${transcription.transcriptionText}`);

    // If transcription exists but text is null/empty, it's still processing
    if (
      !transcription.transcriptionText ||
      transcription.transcriptionText === null
    ) {
      // If status is "failed", return error
      if (transcription.status === "failed") {
        return new Response(
          JSON.stringify({
            message: "Transcription failed",
            transcriptionSid: transcription.sid,
            status: transcription.status,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Try fetching the full transcription object (sometimes list doesn't include text)
      try {
        const fullTranscription = await client
          .recordings(recording.sid)
          .transcriptions(transcription.sid)
          .fetch();

        console.log(`Full transcription status: ${fullTranscription.status}`);
        console.log(
          `Full transcription text: ${fullTranscription.transcriptionText}`,
        );

        if (fullTranscription.transcriptionText) {
          // Use the fetched text
          const transcriptData = {
            callSid: callSid,
            recordingSid: recording.sid,
            transcriptionSid: transcription.sid,
            transcriptionText: fullTranscription.transcriptionText,
            recordingUrl: recording.uri,
            timestamp: new Date().toISOString(),
          };

          console.log("✅ Transcript retrieved (via fetch):", transcriptData);

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
Transcription SID: ${transcription.sid}
Date/Time: ${transcriptData.timestamp}

TRANSCRIPT:
${fullTranscription.transcriptionText}

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
        } else {
          // Still no text, tell client to retry
          return new Response(
            JSON.stringify({
              message:
                "Transcription text not yet available. Please try again.",
              transcriptionSid: transcription.sid,
              status: fullTranscription.status,
            }),
            {
              status: 202,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      } catch (fetchError) {
        console.error("Error fetching full transcription:", fetchError);
        return new Response(
          JSON.stringify({
            message: "Transcription not yet available. Please try again.",
            transcriptionSid: transcription.sid,
          }),
          {
            status: 202,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

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
