/**
 * Admin Conversations API - Conversation management
 * GET: List all conversations
 */

import { NextRequest, NextResponse } from "next/server";
import * as conversationService from "@/lib/services/conversation.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const conversations = await conversationService.getAllConversations({ limit, offset });
    const total = await conversationService.getConversationCount();

    return NextResponse.json({
      success: true,
      conversations,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + conversations.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}
