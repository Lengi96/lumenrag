import { NextResponse } from "next/server";
import { buildMindmap } from "@/lib/knowledge";
import type { KnowledgeDocument } from "@/lib/types";

type GraphBody = {
  documents?: KnowledgeDocument[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as GraphBody;
  return NextResponse.json({ graph: buildMindmap(body.documents ?? []) });
}
