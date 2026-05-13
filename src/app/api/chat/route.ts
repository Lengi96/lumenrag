import { NextResponse } from "next/server";
import { generateAnswer, searchDocuments } from "@/lib/knowledge";
import { OpenAIProvider } from "@/lib/ai/openai-provider";
import { MissingProviderError } from "@/lib/ai/provider";
import { buildContextBlock, groundedAnswerSystemPrompt } from "@/lib/rag/prompts";
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
  let answer = generateAnswer(body.query, results);
  let strategy = "local-hybrid";

  if (process.env.OPENAI_API_KEY && results.length > 0) {
    try {
      const provider = new OpenAIProvider();
      answer = await provider.answer({
        system: groundedAnswerSystemPrompt,
        query: body.query,
        context: buildContextBlock(
          results.slice(0, 6).map((result) => ({
            id: result.chunk.id,
            documentTitle: result.chunk.documentTitle,
            content: result.chunk.content,
          })),
        ),
      });
      strategy = "openai-grounded";
    } catch (error) {
      if (!(error instanceof MissingProviderError)) {
        console.error("OpenAI answer generation failed, falling back to local answer", error);
      }
    }
  }

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
      strategy,
      resultCount: results.length,
    },
  });
}
