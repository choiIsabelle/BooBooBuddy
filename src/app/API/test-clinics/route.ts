import { getNearbyClinicDetails } from "@/src/app/API/GooglePlaces";

/**
 * Test API route - Logs results to terminal
 * Usage: GET /api/test-clinics?lat=40.7128&lng=-74.0060
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = parseFloat(url.searchParams.get("lat") || "40.7128");
    const lng = parseFloat(url.searchParams.get("lng") || "-74.0060");
    const limit = parseInt(url.searchParams.get("limit") || "3");
    const radius = parseInt(url.searchParams.get("radius") || "5000");

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng)) {
      console.log("❌ Invalid latitude or longitude");
      return new Response("Invalid coordinates", { status: 400 });
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

    return new Response("Check your terminal for results!", { status: 200 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("\n❌ Error:", errorMessage, "\n");
    return new Response(`Error: ${errorMessage}`, { status: 500 });
  }
}
