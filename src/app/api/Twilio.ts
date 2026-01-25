import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client
const client = twilio(accountSid, authToken);

/**
 * Make an outbound call with a specific message
 * @param toNumber - The phone number to call (E.164 format: +1234567890)
 * @param message - The message to be read to the recipient
 * @returns Call SID and status
 */
export async function makeCallWithMessage(toNumber: string, message: string) {
  try {
    if (!accountSid || !authToken || !twilioPhoneNumber) {
      throw new Error(
        "Missing Twilio credentials. Check environment variables."
      );
    }

    console.log(`📞 Making call to ${toNumber} with message: "${message}"`);

    // Create TwiML inline
    const twiml = `
      <Response>
        <Say voice="alice">
          ${message}
        </Say>
        <Record
          maxLength="120"
          transcribe="true"
        />
        <Say voice="alice">
          Thank you. Goodbye.
        </Say>
      </Response>
    `;

    const call = await client.calls.create({
      from: twilioPhoneNumber,
      to: toNumber,
      twiml: twiml,
    });

    console.log(`✅ Call initiated with SID: ${call.sid}`);

    return {
      success: true,
      callSid: call.sid,
      status: call.status,
      to: call.to,
      message: "Call initiated successfully",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Error making call:", errorMessage);
    throw error;
  }
}
