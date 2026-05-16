import { Worker } from "bullmq";
import { IngestionJobStatus } from "@prisma/client";
import { analyzeDocument } from "../src/lib/knowledge.ts";
import { extractStructuredKnowledge } from "../src/lib/ai/langchain-extraction-provider.ts";
import { applyStructuredExtraction } from "../src/lib/ai/structured-extraction.ts";
import { parseUploadedBuffer } from "../src/lib/server/document-parser.ts";
import { appendWorkspaceDocuments } from "../src/lib/server/workspace-store.ts";
import { ingestionQueueName, updateIngestionJob } from "../src/lib/server/ingestion-queue.ts";
import { prisma } from "../src/lib/server/prisma.ts";

const connection = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
  maxRetriesPerRequest: null,
};

function stableId(input) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

async function setProgress(jobId, progress, stage) {
  await updateIngestionJob(jobId, {
    status: IngestionJobStatus.PROCESSING,
    progress,
    stage,
  });
}

const worker = new Worker(
  ingestionQueueName,
  async (job) => {
    const payload = job.data;
    const existing = await prisma.ingestionJob.findUnique({ where: { id: payload.jobId } });
    if (!existing || existing.status === IngestionJobStatus.CANCELED) return;

    await updateIngestionJob(payload.jobId, {
      status: IngestionJobStatus.PROCESSING,
      progress: 5,
      stage: "started",
      attempts: { increment: 1 },
    });

    await setProgress(payload.jobId, 20, "parsing");
    const parsed = await parseUploadedBuffer({
      name: payload.fileName,
      mimeType: payload.mimeType,
      buffer: Buffer.from(payload.base64, "base64"),
    });

    await setProgress(payload.jobId, 45, "chunking-and-extraction");
    let document = analyzeDocument({
      id: stableId(`${payload.fileName}-${payload.size}-${payload.lastModified}`),
      title: payload.fileName,
      type: payload.mimeType || "text/plain",
      size: payload.size,
      content: parsed.content,
    });

    if (process.env.EXTRACTION_PROVIDER === "langchain") {
      await setProgress(payload.jobId, 60, "langchain-structured-extraction");
      const extraction = await extractStructuredKnowledge({
        documentTitle: document.title,
        content: document.content,
      });
      document = applyStructuredExtraction(document, extraction);
    }

    await setProgress(payload.jobId, 70, "persisting");
    await appendWorkspaceDocuments([
      {
        ...document,
        metadata: {
          parser: parsed.parser,
          originalMimeType: payload.mimeType || null,
          ingestionJobId: payload.jobId,
        },
      },
    ]);

    await setProgress(payload.jobId, 90, "embeddings");
    await updateIngestionJob(payload.jobId, {
      status: IngestionJobStatus.INDEXED,
      progress: 100,
      stage: "indexed",
      documentId: document.id,
      error: null,
    });
  },
  { connection, concurrency: Number(process.env.INGESTION_WORKER_CONCURRENCY ?? 2) },
);

worker.on("failed", async (job, error) => {
  if (!job?.data?.jobId) return;
  await updateIngestionJob(job.data.jobId, {
    status: IngestionJobStatus.FAILED,
    progress: 100,
    stage: "failed",
    error: error.message,
  }).catch(() => undefined);
});

process.on("SIGINT", async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log(`LumenRAG ingestion worker listening on ${ingestionQueueName}`);
