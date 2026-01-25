import { NextRequest, NextResponse } from "next/server";
import { makeCallWithMessage } from "../../Twilio";

/**
 * POST /api/twilio/call-clinic
 * Makes an automated call to a clinic on behalf of a patient
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clinicPhone, clinicName, patientMessage, symptoms } = body;

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

    // Build the message for the clinic
    const message = patientMessage || buildDefaultMessage(clinicName, symptoms);

    console.log(`\n📞 Calling clinic: ${clinicName}`);
    console.log(`   Phone: ${formattedPhone}`);
    console.log(`   Message: "${message}"\n`);

    const result = await makeCallWithMessage(formattedPhone, message);

    return NextResponse.json({
      success: true,
      callSid: result.callSid,
      status: result.status,
      clinicName,
      message: `Call initiated to ${clinicName}`,
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

  const symptomInfo = symptoms
    ? `The patient is experiencing ${symptoms}.`
    : "The patient needs to be seen as soon as possible.";

  return `${clinicGreeting} This is an automated assistant calling on behalf of a patient who is looking to book a walk-in appointment. ${symptomInfo} Could you please let us know the earliest available time today or tomorrow? We will record your response.`;
}
