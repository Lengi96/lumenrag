import { NextResponse } from "next/server";
import { clearWorkspaceDocuments, loadWorkspaceDocuments, saveWorkspaceDocuments } from "@/lib/server/workspace-store";
import { isDatabaseConfigured } from "@/lib/server/prisma";
import type { KnowledgeDocument } from "@/lib/types";

export const runtime = "nodejs";

type WorkspaceBody = {
  documents?: KnowledgeDocument[];
};

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      mode: "local",
      documents: [],
      message: "DATABASE_URL is not configured; using browser-local workspace storage.",
    });
  }

  try {
    const documents = await loadWorkspaceDocuments();
    return NextResponse.json({ mode: "database", documents });
  } catch (error) {
    console.error("Workspace load failed", error);
    return NextResponse.json({
      mode: "local",
      documents: [],
      message: "Database workspace load failed; using browser-local workspace storage.",
    });
  }
}

export async function PUT(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      mode: "local",
      saved: false,
      message: "DATABASE_URL is not configured; browser-local workspace storage remains active.",
    });
  }

  const body = (await request.json()) as WorkspaceBody;

  try {
    const result = await saveWorkspaceDocuments(body.documents ?? []);
    return NextResponse.json({ mode: "database", saved: true, ...result });
  } catch (error) {
    console.error("Workspace save failed", error);
    return NextResponse.json(
      {
        mode: "local",
        saved: false,
        message: "Database workspace save failed; browser-local workspace storage remains active.",
      },
      { status: 503 },
    );
  }
}

export async function DELETE() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ mode: "local", cleared: false });
  }

  try {
    const result = await clearWorkspaceDocuments();
    return NextResponse.json({ mode: "database", cleared: true, ...result });
  } catch (error) {
    console.error("Workspace clear failed", error);
    return NextResponse.json({ mode: "local", cleared: false }, { status: 503 });
  }
}
