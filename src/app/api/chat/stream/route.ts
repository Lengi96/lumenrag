import { searchDocuments } from "@/lib/knowledge";
import type { KnowledgeDocument } from "@/lib/types";

type StreamBody = {
  query?: string;
  documents?: KnowledgeDocument[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as StreamBody;

  if (!body.query?.trim()) {
    return new Response("Query is required", { status: 400 });
  }

  const results = searchDocuments(body.documents ?? [], body.query, 8);
  const citations = results.slice(0, 5).map((result, index) => ({
    id: index + 1,
    documentId: result.chunk.documentId,
    chunkId: result.chunk.id,
    title: result.chunk.documentTitle,
    score: result.score,
  }));
  const text =
    results.length === 0
      ? "Ich habe in den indexierten Dokumenten keine belastbare Quelle fuer diese Frage gefunden."
      : `Ich habe ${results.length} relevante Quellen gefunden. Die staerksten Treffer stammen aus ${citations
          .map((citation) => citation.title)
          .slice(0, 3)
          .join(", ")}.`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`event: citations\ndata: ${JSON.stringify(citations)}\n\n`));

      for (const token of text.split(" ")) {
        controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify(`${token} `)}\n\n`));
        await new Promise((resolve) => setTimeout(resolve, 12));
      }

      controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
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
