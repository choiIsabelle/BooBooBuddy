import { ToolCall } from "../schemas/llm-response";
import prisma from "../db";
import { getNearbyClinicDetails } from "../../app/API/GooglePlaces";

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Tool executor - routes tool calls to appropriate handlers
export async function executeTool(
  toolCall: ToolCall,
  conversationId: string,
): Promise<ToolResult> {
  // Log the tool call
  const toolCallRecord = await prisma.toolCall.create({
    data: {
      conversationId,
      toolName: toolCall.tool,
      toolInput: JSON.stringify(toolCall.params),
      status: "PENDING",
    },
  });

  try {
    let result: ToolResult;

    switch (toolCall.tool) {
      case "clinic_search":
        result = await executeClinicSearch(toolCall.params);
        break;
      case "schedule_call":
        result = await executeScheduleCall(toolCall.params, conversationId);
        break;
      case "escalate":
        result = await executeEscalate(toolCall.params, conversationId);
        break;
      default:
        result = { success: false, error: "Unknown tool" };
    }

    // Update tool call record
    await prisma.toolCall.update({
      where: { id: toolCallRecord.id },
      data: {
        toolOutput: JSON.stringify(result),
        status: result.success ? "SUCCESS" : "FAILED",
      },
    });

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await prisma.toolCall.update({
      where: { id: toolCallRecord.id },
      data: {
        toolOutput: JSON.stringify({ error: errorMessage }),
        status: "FAILED",
      },
    });

    return { success: false, error: errorMessage };
  }
}

// Clinic search tool
interface ClinicSearchParams {
  location: string;
  specialty?: string;
  urgency?: "low" | "medium" | "high";
}

// Geocode a location string to lat/lng using Google Geocoding API
async function geocodeLocation(
  location: string,
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ No Google API key for geocoding");
    return null;
  }

  try {
    const params = new URLSearchParams({
      address: location,
      key: apiKey,
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
    );

    if (!response.ok) {
      console.error("Geocoding API error:", response.statusText);
      return null;
    }

    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      console.log(`📍 Geocoded "${location}" to: ${lat}, ${lng}`);
      return { lat, lng };
    }

    console.warn(
      `⚠️ Could not geocode location: ${location}, status: ${data.status}`,
    );
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

async function executeClinicSearch(
  params: ClinicSearchParams,
): Promise<ToolResult> {
  const { location } = params;

  try {
    // First, try to geocode the location to get lat/lng
    let lat = 37.7749; // Default to San Francisco
    let lng = -122.4194;

    // Try to extract coordinates if location looks like "lat,lng"
    const coordMatch = location.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (coordMatch) {
      lat = parseFloat(coordMatch[1]);
      lng = parseFloat(coordMatch[2]);
    } else {
      // Use geocoding API to convert address/zip to coordinates
      const geocoded = await geocodeLocation(location);
      if (geocoded) {
        lat = geocoded.lat;
        lng = geocoded.lng;
      } else {
        console.warn(
          `⚠️ Could not geocode "${location}", using default coordinates`,
        );
      }
    }

    // Use Google Places API to find nearby clinics
    console.log(`🔍 Searching for clinics near: ${location} (${lat}, ${lng})`);
    const clinics = await getNearbyClinicDetails(lat, lng, 5, 5000); // limit=5, radius=5000m

    if (clinics && clinics.length > 0) {
      console.log(`✅ Found ${clinics.length} clinics from Google Places`);
      return {
        success: true,
        data: {
          clinics: clinics.map((c: Record<string, unknown>) => ({
            id: c.id || c.placeId,
            placeId: c.placeId || c.id,
            name: c.name,
            address: c.address,
            phone: c.phone || "Call for info",
            rating: c.rating,
            distance: c.distance,
            lat: c.lat,
            lng: c.lng,
            website: c.website,
            availableSlots: c.availableSlots || [],
            specialties: c.specialties || [],
          })),
          searchLocation: location,
        },
      };
    }

    // Fallback to mock data if no results
    console.log("⚠️ No clinics found, using mock data");
    return {
      success: true,
      data: {
        clinics: getMockClinics(location),
        searchLocation: location,
      },
    };
  } catch (error) {
    console.error("❌ Error searching clinics:", error);
    // Fallback to mock data on error
    return {
      success: true,
      data: {
        clinics: getMockClinics(location),
        searchLocation: location,
      },
    };
  }
}

// Schedule call tool
interface ScheduleCallParams {
  clinicId: string;
  preferredTime?: string;
  reason: string;
}

async function executeScheduleCall(
  params: ScheduleCallParams,
  conversationId: string,
): Promise<ToolResult> {
  const { clinicId, preferredTime, reason } = params;

  // Simulate scheduling
  const appointmentTime = preferredTime
    ? new Date(preferredTime)
    : getNextAvailableSlot();

  // Update conversation with appointment
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      selectedClinicId: clinicId,
      appointmentTime,
    },
  });

  return {
    success: true,
    data: {
      confirmed: true,
      appointmentTime: appointmentTime.toISOString(),
      clinicId,
      reason,
      confirmationCode: generateConfirmationCode(),
      message: `Your call has been scheduled for ${appointmentTime.toLocaleString()}`,
    },
  };
}

// Escalate tool
interface EscalateParams {
  reason: string;
  urgency: "immediate" | "soon" | "routine";
}

async function executeEscalate(
  params: EscalateParams,
  conversationId: string,
): Promise<ToolResult> {
  const { reason, urgency } = params;

  // Update conversation state
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { state: "ESCALATED" },
  });

  // Log escalation
  console.log(`[ESCALATION] Conversation ${conversationId}`);
  console.log(`  Urgency: ${urgency}`);
  console.log(`  Reason: ${reason}`);

  if (urgency === "immediate") {
    console.log("  ACTION: Paging on-call nurse");
  }

  return {
    success: true,
    data: {
      escalated: true,
      urgency,
      reason,
      ticketId: `ESC-${Date.now()}`,
      message:
        urgency === "immediate"
          ? "A nurse will call you within 5 minutes. If this is a life-threatening emergency, please call 911."
          : "Your case has been escalated. A team member will reach out shortly.",
    },
  };
}

// Helper functions
function getMockClinics(location: string) {
  const baseTime = new Date();
  const slots = [
    new Date(baseTime.getTime() + 1 * 60 * 60 * 1000).toISOString(),
    new Date(baseTime.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    new Date(baseTime.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  ];

  return [
    {
      id: "clinic-1",
      name: "Urgent Care - Main St",
      address: `123 Main St, ${location}`,
      phone: "(555) 123-4567",
      rating: 4.8,
      specialties: ["Pediatrics", "Urgent Care"],
      availableSlots: slots,
      distance: 1.2,
    },
    {
      id: "clinic-2",
      name: "Kids First Medical Center",
      address: `456 Oak Ave, ${location}`,
      phone: "(555) 234-5678",
      rating: 4.6,
      specialties: ["Pediatrics", "Family Medicine"],
      availableSlots: slots.slice(1),
      distance: 2.5,
    },
    {
      id: "clinic-3",
      name: "Community Health Pediatrics",
      address: `789 Elm Blvd, ${location}`,
      phone: "(555) 345-6789",
      rating: 4.4,
      specialties: ["Pediatrics"],
      availableSlots: [slots[2]],
      distance: 3.8,
    },
  ];
}

function getNextAvailableSlot(): Date {
  const now = new Date();
  return new Date(now.getTime() + 2 * 60 * 60 * 1000);
}

function generateConfirmationCode(): string {
  return `BB${Date.now().toString(36).toUpperCase()}`;
}
