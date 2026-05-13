import { NextResponse } from "next/server";
import { generateAnswer, searchDocuments } from "@/lib/knowledge";
import type { KnowledgeDocument } from "@/lib/types";

type ChatBody = {
  query?: string;
  documents?: KnowledgeDocument[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as ChatBody;

  if (!body.query?.trim()) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const results = searchDocuments(body.documents ?? [], body.query, 8);
  const answer = generateAnswer(body.query, results);

  return NextResponse.json({
    answer,
    citations: results.slice(0, 5).map((result, index) => ({
      id: index + 1,
      documentId: result.chunk.documentId,
      chunkId: result.chunk.id,
      title: result.chunk.documentTitle,
      quote: result.chunk.content.slice(0, 420),
      score: result.score,
    })),
    retrieval: {
      strategy: "local-hybrid",
      resultCount: results.length,
    },
  });
}
