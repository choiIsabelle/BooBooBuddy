import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/auth/check-user?email=... - Check if user exists and their status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        isOnboarded: true,
        childName: true,
        childAge: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        exists: false,
      });
    }

    return NextResponse.json({
      exists: true,
      isOnboarded: user.isOnboarded,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        childName: user.childName,
        childAge: user.childAge,
      },
    });
  } catch (error) {
    console.error("Error checking user:", error);
    return NextResponse.json(
      { error: "Failed to check user" },
      { status: 500 }
    );
  }
}
