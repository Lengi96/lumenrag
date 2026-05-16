import { NextResponse } from "next/server";
import { analyzeDocument } from "@/lib/knowledge";
import { parseUploadedFile } from "@/lib/server/document-parser";
import { isDatabaseConfigured } from "@/lib/server/prisma";
import { appendWorkspaceDocuments } from "@/lib/server/workspace-store";
import { enqueueIngestionFile } from "@/lib/server/ingestion-queue";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files").filter((file): file is File => file instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (isDatabaseConfigured() && process.env.REDIS_URL) {
    try {
      const jobs = await Promise.all(files.map((file) => enqueueIngestionFile(file)));
      return NextResponse.json({ documents: [], jobs, persistence: { mode: "queued" } }, { status: 202 });
    } catch (error) {
      console.error("Ingestion enqueue failed; falling back to synchronous analysis", error);
    }
  }

  const documents = await Promise.all(
    files.map(async (file) => {
      const parsed = await parseUploadedFile(file);
      const document = analyzeDocument({
        id: stableId(`${file.name}-${file.size}-${file.lastModified}`),
        title: file.name,
        type: file.type || "text/plain",
        size: file.size,
        content: parsed.content,
      });
      return {
        ...document,
        metadata: {
          parser: parsed.parser,
          originalMimeType: file.type || null,
        },
      };
    }),
  );

  if (isDatabaseConfigured()) {
    try {
      const persistence = await appendWorkspaceDocuments(documents);
      return NextResponse.json({ documents, persistence: { mode: "database", ...persistence } });
    } catch (error) {
      console.error("Document persistence failed; returning analyzed documents for browser-local fallback", error);
    }
  }

  return NextResponse.json({ documents, persistence: { mode: "local" } });
}

function stableId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
