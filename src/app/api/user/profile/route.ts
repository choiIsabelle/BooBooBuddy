import { NextRequest, NextResponse } from "next/server";
import * as userService from "@/lib/services/user.service";

// GET /api/user/profile - Get user profile
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const user = await userService.findUserById(userId);
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    console.log("📋 Fetched user profile:", {
      id: user.id,
      name: user.name,
      allergies: user.allergies,
      medicalConditions: user.medicalConditions,
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}

// PUT /api/user/profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, allergies, medicalConditions, preferredClinic, location } = body;

    console.log("🔄 Updating user profile:", {
      userId,
      name,
      allergies,
      medicalConditions,
      preferredClinic,
      location,
    });

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Build update object only with provided fields
    const updateData: {
      name?: string;
      allergies?: string[];
      medicalConditions?: string[];
      preferredClinic?: string;
      location?: string;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (allergies !== undefined) updateData.allergies = allergies;
    if (medicalConditions !== undefined) updateData.medicalConditions = medicalConditions;
    if (preferredClinic !== undefined) updateData.preferredClinic = preferredClinic;
    if (location !== undefined) updateData.location = location;

    const user = await userService.updateUser(userId, updateData);

    console.log("✅ Profile updated successfully:", {
      id: user.id,
      allergies: user.allergies,
      medicalConditions: user.medicalConditions,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        allergies: user.allergies,
        medicalConditions: user.medicalConditions,
        preferredClinic: user.preferredClinic,
        location: user.location,
        isOnboarded: user.isOnboarded,
      },
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Failed to update user profile" },
      { status: 500 }
    );
  }
}
