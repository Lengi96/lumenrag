import { NextResponse } from "next/server";
import { buildMindmap } from "@/lib/knowledge";
import type { KnowledgeDocument } from "@/lib/types";

type ExportBody = {
  documents?: KnowledgeDocument[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as ExportBody;
  const documents = body.documents ?? [];
  const graph = buildMindmap(documents);
  const requirements = documents.flatMap((document) => document.requirements);
  const risks = documents.flatMap((document) => document.risks);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    documents,
    graph,
    requirements,
    risks,
  });
}
