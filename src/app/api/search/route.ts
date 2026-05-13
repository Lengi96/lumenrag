import { NextResponse } from "next/server";
import { searchDocuments } from "@/lib/knowledge";
import type { KnowledgeDocument } from "@/lib/types";

type SearchBody = {
  query?: string;
  documents?: KnowledgeDocument[];
  limit?: number;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SearchBody;

  if (!body.query?.trim()) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const results = searchDocuments(body.documents ?? [], body.query, body.limit ?? 8);
  return NextResponse.json({ results });
}
