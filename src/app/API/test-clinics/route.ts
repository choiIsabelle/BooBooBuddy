import { getNearbyClinicDetails } from "../GooglePlaces";

/**
 * Test API route - Returns clinic data as JSON
 * Usage: GET /api/test-clinics?lat=40.7128&lng=-74.0060
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = parseFloat(url.searchParams.get("lat") || "40.7128");
    const lng = parseFloat(url.searchParams.get("lng") || "-74.0060");
    const limit = parseInt(url.searchParams.get("limit") || "5");
    const radius = parseInt(url.searchParams.get("radius") || "5000");

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng)) {
      return new Response(
        JSON.stringify({ error: "Invalid latitude or longitude" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(
      `\n🔍 Testing getNearbyClinicDetails\n` +
        `   Latitude: ${lat}\n` +
        `   Longitude: ${lng}\n` +
        `   Limit: ${limit}\n` +
        `   Radius: ${radius}m\n`
    );

    // Call the function
    const clinics = await getNearbyClinicDetails(lat, lng, limit, radius);

    console.log(
      `\n✅ Success! Found ${clinics.length} clinic(s)\n` +
        JSON.stringify(clinics, null, 2)
    );

    return new Response(JSON.stringify({ success: true, data: clinics }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("\n❌ Error:", errorMessage, "\n");
    return new Response(
      JSON.stringify({
        error: errorMessage,
        tips: [
          "Make sure NEXT_PUBLIC_GOOGLE_PLACES_API_KEY is set in .env.local",
          "Make sure your API key has the Places API enabled",
        ],
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
