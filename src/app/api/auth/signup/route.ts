import { NextRequest, NextResponse } from "next/server";
import * as userService from "@/lib/services/user.service";

// POST /api/auth/signup - Create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const emailExists = await userService.emailExists(email);

    if (emailExists) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    // Create new user
    // Note: In production, use proper password hashing (bcrypt, argon2)
    const user = await userService.createUser({
      email,
      password, // TODO: Hash password before storing
      name: name || undefined,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isOnboarded: user.isOnboarded,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
