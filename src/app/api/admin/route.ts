/**
 * Admin API - Database overview and management
 * GET: Returns stats and recent records
 */

import { NextResponse } from "next/server";
import * as conversationService from "@/lib/services/conversation.service";

export async function GET() {
  try {
    // Use the centralized service for DRY
    const stats = await conversationService.getDatabaseStats();

    return NextResponse.json({
      success: true,
      stats: stats.counts,
      recentUsers: stats.recentUsers,
      recentConversations: stats.recentConversations,
    });
  } catch (error) {
    console.error("Admin API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
