const GOOGLE_PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place";

/**
 * Nearby Search API - Find places near a given location
 * @param lat - Latitude of the search center
 * @param lng - Longitude of the search center
 * @param radius - Search radius in meters (default: 1500)
 * @param type - Type of place to search for (e.g., 'restaurant', 'cafe', 'park')
 * @param keyword - Optional keyword to filter results
 * @returns Nearby places data or error
 */
export async function getNearbyPlaces(
  lat: number,
  lng: number,
  radius: number = 5000,
  type?: string,
  keyword?: string,
) {
  try {
    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: radius.toString(),
      key: GOOGLE_PLACES_API_KEY || "",
    });

    if (type) {
      params.append("type", type);
    }

    if (keyword) {
      params.append("keyword", keyword);
    }

    const response = await fetch(
      `${GOOGLE_PLACES_BASE_URL}/nearbysearch/json?${params}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Google Places API error: ${data.status}`);
    }

    return data;
  } catch (error) {
    console.error("Error fetching nearby places:", error);
    throw error;
  }
}

/**
 * Place Details API - Get detailed information about a specific place
 * @param placeId - The unique identifier for the place
 * @param fields - Specific fields to retrieve (optional)
 * @returns Detailed place information or error
 */
export async function getPlaceDetails(placeId: string, fields?: string[]) {
  try {
    const params = new URLSearchParams({
      place_id: placeId,
      key: GOOGLE_PLACES_API_KEY || "",
    });

    // Add fields if provided, otherwise use default comprehensive fields
    const defaultFields = [
      "name",
      "formatted_address",
      "geometry",
      "formatted_phone_number",
      "website",
      "opening_hours",
      "rating",
      "reviews",
      "photos",
      "url",
      "types",
    ];

    const fieldsToRequest =
      fields && fields.length > 0 ? fields : defaultFields;
    params.append("fields", fieldsToRequest.join(","));

    const response = await fetch(
      `${GOOGLE_PLACES_BASE_URL}/details/json?${params}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== "OK") {
      throw new Error(`Google Places API error: ${data.status}`);
    }

    return data.result;
  } catch (error) {
    console.error("Error fetching place details:", error);
    throw error;
  }
}

/**
 * Get nearby clinics with full details - Orchestrates Nearby Search + Place Details
 * @param lat - Latitude of the search center
 * @param lng - Longitude of the search center
 * @param limit - Number of clinics to return (default: 3)
 * @param radius - Search radius in meters (default: 5000)
 * @returns Array of clinic objects with combined data
 */
export async function getNearbyClinicDetails(
  lat: number,
  lng: number,
  limit: number = 5,
  radius: number = 5000,
) {
  try {
    // Step 1: Get nearby places
    const nearbyData = await getNearbyPlaces(
      lat,
      lng,
      radius,
      "health",
      "Clinic",
    );

    if (!nearbyData.results || nearbyData.results.length === 0) {
      return [];
    }

    // Step 2: Get top N results
    const topPlaces = nearbyData.results.slice(0, limit);

    // Step 3: Fetch detailed information for each place in parallel
    const detailsPromises = topPlaces.map((place: { place_id: string }) =>
      getPlaceDetails(place.place_id),
    );

    const detailsResults = await Promise.all(detailsPromises);

    // Step 4: Transform into clinic objects
    const clinics = topPlaces.map((place: { place_id: string; name: string; geometry?: { location?: { lat: number; lng: number } }; vicinity?: string; rating?: number }, index: number) => {
      const details = detailsResults[index];
      const geometry = place.geometry?.location;
      const distance = calculateDistance(
        lat,
        lng,
        geometry?.lat ?? 0,
        geometry?.lng ?? 0,
      );

      return {
        id: place.place_id,
        placeId: place.place_id,
        name: details.name || place.name,
        phone: details.formatted_phone_number || null,
        address: details.formatted_address || place.vicinity,
        lat: geometry?.lat || 0,
        lng: geometry?.lng || 0,
        distance: Math.round(distance * 0.621371 * 10) / 10, // Convert km to miles
        distanceKm: distance,
        rating: details.rating || place.rating || null,
        website: details.website || null,
        openNow: details.opening_hours?.open_now || null,
        hoursText: details.opening_hours?.weekday_text || [],
        availableSlots: [], // Placeholder - would need scheduling system
        specialties:
          details.types?.filter(
            (t: string) => t.includes("health") || t.includes("doctor"),
          ) || [],
      };
    });

    return clinics;
  } catch (error) {
    console.error("Error fetching nearby clinic details:", error);
    throw error;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 - First latitude
 * @param lng1 - First longitude
 * @param lat2 - Second latitude
 * @param lng2 - Second longitude
 * @returns Distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100; // Round to 2 decimal places
}
