import { OpenAIProvider } from "@/lib/ai/openai-provider";
import { MissingProviderError } from "@/lib/ai/provider";
import { searchDocuments } from "@/lib/knowledge";
import type { KnowledgeChunk, KnowledgeDocument, SearchResult } from "@/lib/types";
import { prisma } from "./prisma";
import { loadWorkspaceDocuments } from "./workspace-store";
import { toPgVector } from "./pgvector";

type RawChunkMatch = {
  id: string;
  documentId: string;
  documentTitle: string;
  index: number;
  content: string;
  tokenCount: number;
  metadata: unknown;
  vectorScore: number | null;
  textScore: number | null;
};

export type RetrievalMode = "database-hybrid" | "database-full-text" | "local-fallback";

export type RetrievalResponse = {
  results: SearchResult[];
  mode: RetrievalMode;
  embeddingProviderConfigured: boolean;
};

export async function retrieveWorkspace(query: string, documents: KnowledgeDocument[], limit: number): Promise<RetrievalResponse> {
  if (!process.env.DATABASE_URL) {
    return {
      results: explainLocalResults(searchDocuments(documents, query, limit)),
      mode: "local-fallback",
      embeddingProviderConfigured: Boolean(process.env.OPENAI_API_KEY),
    };
  }

  try {
    const embedding = await embedQuery(query);
    if (embedding) {
      const results = await hybridDatabaseSearch(query, embedding, limit);
      if (results.length > 0) {
        return {
          results,
          mode: "database-hybrid",
          embeddingProviderConfigured: true,
        };
      }
    }

    const fullTextResults = await fullTextDatabaseSearch(query, limit);
    if (fullTextResults.length > 0) {
      return {
        results: fullTextResults,
        mode: "database-full-text",
        embeddingProviderConfigured: Boolean(process.env.OPENAI_API_KEY),
      };
    }

    const workspaceDocuments = documents.length > 0 ? documents : await loadWorkspaceDocuments();
    return {
      results: explainLocalResults(searchDocuments(workspaceDocuments, query, limit)),
      mode: "local-fallback",
      embeddingProviderConfigured: Boolean(process.env.OPENAI_API_KEY),
    };
  } catch (error) {
    console.error("Database retrieval failed, falling back to local retrieval", error);
    return {
      results: explainLocalResults(searchDocuments(documents, query, limit)),
      mode: "local-fallback",
      embeddingProviderConfigured: Boolean(process.env.OPENAI_API_KEY),
    };
  }
}

async function embedQuery(query: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const provider = new OpenAIProvider();
    const [embedding] = await provider.embed([query]);
    return embedding ?? null;
  } catch (error) {
    if (!(error instanceof MissingProviderError)) {
      console.error("Query embedding failed; using full-text retrieval", error);
    }
    return null;
  }
}

async function hybridDatabaseSearch(query: string, embedding: number[], limit: number): Promise<SearchResult[]> {
  const vector = toPgVector(embedding);
  const rows = await prisma.$queryRawUnsafe<RawChunkMatch[]>(
    `
      WITH vector_matches AS (
        SELECT
          c.id,
          c."documentId",
          d.title AS "documentTitle",
          c.index,
          c.content,
          c."tokenCount",
          c.metadata,
          CASE
            WHEN c.embedding IS NULL THEN NULL
            ELSE 1 - (c.embedding <=> $1::vector)
          END AS "vectorScore",
          ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', $2)) AS "textScore"
        FROM "Chunk" c
        JOIN "Document" d ON d.id = c."documentId"
        WHERE c.embedding IS NOT NULL
           OR to_tsvector('simple', c.content) @@ plainto_tsquery('simple', $2)
      )
      SELECT *
      FROM vector_matches
      WHERE COALESCE("vectorScore", 0) > 0 OR COALESCE("textScore", 0) > 0
      ORDER BY (COALESCE("vectorScore", 0) * 0.7 + COALESCE("textScore", 0) * 0.3) DESC
      LIMIT $3
    `,
    vector,
    query,
    limit,
  );

  return rows.map((row) => toSearchResult(row, "Hybrid match: vector similarity plus PostgreSQL full-text rank."));
}

async function fullTextDatabaseSearch(query: string, limit: number): Promise<SearchResult[]> {
  const rows = await prisma.$queryRaw<RawChunkMatch[]>`
    SELECT
      c.id,
      c."documentId",
      d.title AS "documentTitle",
      c.index,
      c.content,
      c."tokenCount",
      c.metadata,
      NULL::double precision AS "vectorScore",
      ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', ${query})) AS "textScore"
    FROM "Chunk" c
    JOIN "Document" d ON d.id = c."documentId"
    WHERE to_tsvector('simple', c.content) @@ plainto_tsquery('simple', ${query})
    ORDER BY "textScore" DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => toSearchResult(row, "Full-text match: embedding provider is not configured or no vector match was available."));
}

function toSearchResult(row: RawChunkMatch, matchReason: string): SearchResult {
  const vectorScore = row.vectorScore ?? 0;
  const textScore = row.textScore ?? 0;
  const score = Number((vectorScore * 0.7 + textScore * 0.3).toFixed(4));
  const chunk: KnowledgeChunk = {
    id: row.id,
    documentId: row.documentId,
    documentTitle: row.documentTitle,
    index: row.index,
    content: row.content,
    tokenCount: row.tokenCount,
    keywords: extractKeywords(row.metadata),
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : undefined,
  };

  return {
    chunk,
    score,
    vectorScore: Number(vectorScore.toFixed(4)),
    textScore: Number(textScore.toFixed(4)),
    highlights: chunk.keywords.slice(0, 5),
    matchReason,
  };
}

function explainLocalResults(results: SearchResult[]): SearchResult[] {
  return results.map((result) => ({
    ...result,
    matchReason: "Local fallback match: heuristic keyword overlap over provided documents.",
  }));
}

function extractKeywords(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const keywords = (metadata as Record<string, unknown>).keywords;
  return Array.isArray(keywords) ? keywords.filter((keyword): keyword is string => typeof keyword === "string") : [];
}
