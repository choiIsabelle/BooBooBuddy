import { makeCallWithMessage } from "@/lib/twilio";

/**
 * POST /api/twilio/test
 * Test endpoint for Twilio calls
 * Makes a test call to the specified number
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const toNumber = body.toNumber || "+16133028331"; // Default to user's number
    const message =
      body.message ||
      "Hello, this is an automated assistant calling on behalf of a patient. We are looking for the next available walk-in appointment. Could you please tell us the earliest available time today or tomorrow?";

    console.log(
      `\n📞 Testing Twilio call\n   To: ${toNumber}\n   Message: "${message}"\n`
    );

    const result = await makeCallWithMessage(toNumber, message);

    console.log(`\n✅ Call test successful!\n`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("\n❌ Error testing Twilio call:", errorMessage, "\n");

    return new Response(
      JSON.stringify({
        error: errorMessage,
        tips: [
          "Make sure TWILIO_ACCOUNT_SID is set in .env.local",
          "Make sure TWILIO_AUTH_TOKEN is set in .env.local",
          "Make sure TWILIO_PHONE_NUMBER is set in .env.local (your Twilio number)",
          "Make sure NEXT_PUBLIC_APP_URL is set in .env.local",
          "Phone numbers should be in E.164 format: +1234567890",
        ],
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
