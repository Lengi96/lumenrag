import { Queue } from "bullmq";
import { IngestionJobStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { ensureDemoWorkspace } from "./workspace-store";

export const ingestionQueueName = "lumenrag-ingestion";

export type IngestionJobPayload = {
  jobId: string;
  fileName: string;
  mimeType: string;
  size: number;
  lastModified: number;
  base64: string;
};

export type IngestionJobView = {
  id: string;
  fileName: string;
  documentId: string | null;
  status: "queued" | "processing" | "indexed" | "failed" | "canceled";
  progress: number;
  stage: string;
  attempts: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export function createIngestionQueue() {
  const connection = {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    maxRetriesPerRequest: null,
  };

  return new Queue<IngestionJobPayload>(ingestionQueueName, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1500 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  });
}

export async function enqueueIngestionFile(file: File) {
  const workspace = await ensureDemoWorkspace();
  const buffer = Buffer.from(await file.arrayBuffer());

  const job = await prisma.ingestionJob.create({
    data: {
      workspaceId: workspace.id,
      fileName: file.name,
      mimeType: file.type || null,
      size: file.size,
      status: IngestionJobStatus.QUEUED,
      progress: 0,
      stage: "queued",
      payload: {
        lastModified: file.lastModified,
        mimeType: file.type || "text/plain",
        base64: buffer.toString("base64"),
      },
    },
  });

  const queue = createIngestionQueue();
  await queue.add(
    "ingest-document",
    {
      jobId: job.id,
      fileName: file.name,
      mimeType: file.type || "text/plain",
      size: file.size,
      lastModified: file.lastModified,
      base64: buffer.toString("base64"),
    },
    { jobId: job.id },
  );
  await queue.close();

  return toJobView(job);
}

export async function listIngestionJobs() {
  const workspace = await ensureDemoWorkspace();
  const jobs = await prisma.ingestionJob.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return jobs.map(toJobView);
}

export async function updateIngestionJob(jobId: string, data: {
  status?: IngestionJobStatus;
  progress?: number;
  stage?: string;
  error?: string | null;
  documentId?: string | null;
  attempts?: { increment: number };
}) {
  return prisma.ingestionJob.update({
    where: { id: jobId },
    data,
  });
}

export async function cancelIngestionJob(jobId: string) {
  const queue = createIngestionQueue();
  const bullJob = await queue.getJob(jobId).catch(() => null);
  if (bullJob) {
    await bullJob.remove().catch(() => undefined);
  }
  await queue.close();

  const job = await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: IngestionJobStatus.CANCELED,
      progress: 100,
      stage: "canceled",
    },
  });
  return toJobView(job);
}

export async function retryIngestionJob(jobId: string) {
  const job = await prisma.ingestionJob.findUnique({ where: { id: jobId } });
  if (!job || !job.payload || typeof job.payload !== "object" || Array.isArray(job.payload)) {
    throw new Error("Ingestion job payload is not available for retry.");
  }

  const payload = job.payload as Record<string, unknown>;
  const base64 = typeof payload.base64 === "string" ? payload.base64 : null;
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : job.mimeType ?? "text/plain";
  const lastModified = typeof payload.lastModified === "number" ? payload.lastModified : Date.now();
  if (!base64) throw new Error("Ingestion job payload is missing file data.");

  const updated = await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: IngestionJobStatus.QUEUED,
      progress: 0,
      stage: "queued",
      error: null,
    },
  });

  const queue = createIngestionQueue();
  await queue.add(
    "ingest-document",
    {
      jobId: updated.id,
      fileName: updated.fileName,
      mimeType,
      size: updated.size,
      lastModified,
      base64,
    },
    { jobId: updated.id },
  );
  await queue.close();

  return toJobView(updated);
}

function toJobView(job: {
  id: string;
  fileName: string;
  documentId: string | null;
  status: IngestionJobStatus;
  progress: number;
  stage: string;
  attempts: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}): IngestionJobView {
  return {
    id: job.id,
    fileName: job.fileName,
    documentId: job.documentId,
    status: job.status.toLowerCase() as IngestionJobView["status"],
    progress: job.progress,
    stage: job.stage,
    attempts: job.attempts,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}
