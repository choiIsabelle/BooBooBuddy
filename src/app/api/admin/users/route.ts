/**
 * Admin Users API - User management
 * GET: List all users
 * DELETE: Delete a user
 */

import { NextRequest, NextResponse } from "next/server";
import * as userService from "@/lib/services/user.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const users = await userService.getAllUsers({ limit, offset });
    const total = await userService.getUserCount();

    return NextResponse.json({
      success: true,
      users,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + users.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
