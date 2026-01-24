import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/auth/complete-onboarding - Complete user onboarding
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      childAllergies,
      medicalConditions,
      preferredClinic,
      location,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Update user with onboarding information
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isOnboarded: true,
        onboardedAt: new Date(),
        allergies: childAllergies ? JSON.stringify(childAllergies) : null,
        medicalConditions: medicalConditions
          ? JSON.stringify(medicalConditions)
          : null,
        preferredClinic: preferredClinic || null,
        location: location || null,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isOnboarded: user.isOnboarded,
        location: user.location,
      },
    });
  } catch (error) {
    console.error("Error completing onboarding:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 },
    );
  }
}
