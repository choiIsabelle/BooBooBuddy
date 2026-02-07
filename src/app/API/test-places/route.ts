import { NextResponse } from "next/server";
import { getNearbyClinicDetails } from "@/lib/google-places";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "45.5017");
  const lng = parseFloat(searchParams.get("lng") || "-73.5673");

  console.log("=".repeat(50));
  console.log("🏥 Testing Google Places API");
  console.log("=".repeat(50));
  console.log(`📍 Coordinates: lat=${lat}, lng=${lng}`);
  console.log(
    `🔑 API Key exists: ${!!process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`,
  );
  console.log("=".repeat(50));

  try {
    const clinics = await getNearbyClinicDetails(lat, lng, 3, 5000);

    console.log("\n✅ SUCCESS! Found", clinics.length, "clinics:\n");

    clinics.forEach((clinic: string, index: number) => {
      console.log(`--- Clinic ${index + 1} ---`);
      console.log(JSON.stringify(clinic, null, 2));
      console.log("");
    });

    return NextResponse.json({
      success: true,
      count: clinics.length,
      data: clinics,
    });
  } catch (error) {
    console.error("\n❌ ERROR:", error);

    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
