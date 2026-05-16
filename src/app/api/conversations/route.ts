import { NextResponse } from "next/server";
import { listConversations } from "@/lib/server/conversation-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const conversations = await listConversations();
    return NextResponse.json({ mode: process.env.DATABASE_URL ? "database" : "local", conversations });
  } catch (error) {
    console.error("Conversation list failed", error);
    return NextResponse.json({ mode: "local", conversations: [] }, { status: 503 });
  }
}
