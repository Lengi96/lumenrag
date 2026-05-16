import { retrieveWorkspace } from "@/lib/server/retrieval";
import { generateAnswer } from "@/lib/knowledge";
import { OpenAIProvider } from "@/lib/ai/openai-provider";
import { MissingProviderError } from "@/lib/ai/provider";
import { buildContextBlock, groundedAnswerSystemPrompt } from "@/lib/rag/prompts";
import { saveConversationTurn } from "@/lib/server/conversation-store";
import type { KnowledgeDocument } from "@/lib/types";

type StreamBody = {
  query?: string;
  documents?: KnowledgeDocument[];
  conversationId?: string | null;
  onlySources?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json()) as StreamBody;

  if (!body.query?.trim()) {
    return new Response("Query is required", { status: 400 });
  }

  const retrieval = await retrieveWorkspace(body.query, body.documents ?? [], 8);
  const results = retrieval.results;
  const citations = results.slice(0, 5).map((result, index) => ({
    id: index + 1,
    documentId: result.chunk.documentId,
    chunkId: result.chunk.id,
    title: result.chunk.documentTitle,
    quote: result.chunk.content.slice(0, 420),
    score: result.score,
    matchReason: result.matchReason,
    vectorScore: result.vectorScore,
    textScore: result.textScore,
  }));
  const answer = await buildAnswer(body.query, results, body.onlySources ?? false);
  const confidence = classifyConfidence(results);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`event: citations\ndata: ${JSON.stringify(citations)}\n\n`));
      controller.enqueue(
        encoder.encode(
          `event: retrieval\ndata: ${JSON.stringify({
            mode: retrieval.mode,
            resultCount: results.length,
            confidence,
            embeddingProviderConfigured: retrieval.embeddingProviderConfigured,
          })}\n\n`,
        ),
      );
      controller.enqueue(encoder.encode(`event: results\ndata: ${JSON.stringify(results)}\n\n`));

      for (const token of tokenizeForStreaming(answer)) {
        controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify(`${token} `)}\n\n`));
        await new Promise((resolve) => setTimeout(resolve, 12));
      }

      const conversation = await saveConversationTurn({
        conversationId: body.conversationId,
        query: body.query ?? "",
        answer,
        citations,
      });

      controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ conversation })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}

async function buildAnswer(query: string, results: Awaited<ReturnType<typeof retrieveWorkspace>>["results"], onlySources: boolean) {
  if (results.length === 0) {
    return onlySources
      ? "Ich habe keine belastbaren Quellen gefunden und beantworte die Frage im Quellenmodus deshalb nicht."
      : "Ich habe in den indexierten Dokumenten keine belastbare Quelle fuer diese Frage gefunden.";
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const provider = new OpenAIProvider();
      return await provider.answer({
        system: onlySources
          ? `${groundedAnswerSystemPrompt}\nAntworte nur mit Informationen aus den Quellen. Wenn die Quellen nicht reichen, sage das klar.`
          : groundedAnswerSystemPrompt,
        query,
        context: buildContextBlock(
          results.slice(0, 6).map((result) => ({
            id: result.chunk.id,
            documentTitle: result.chunk.documentTitle,
            content: result.chunk.content,
          })),
        ),
      });
    } catch (error) {
      if (!(error instanceof MissingProviderError)) {
        console.error("OpenAI streaming answer generation failed, falling back to local answer", error);
      }
    }
  }

  return generateAnswer(query, results);
}

function classifyConfidence(results: Awaited<ReturnType<typeof retrieveWorkspace>>["results"]) {
  if (results.length === 0) return "none";
  const topScore = results[0]?.score ?? 0;
  if (topScore < 0.25) return "low";
  if (topScore < 0.6) return "medium";
  return "high";
}

function tokenizeForStreaming(answer: string) {
  return answer.split(/\s+/).filter(Boolean);
}
