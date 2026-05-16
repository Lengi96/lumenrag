import { DocumentStatus } from "@prisma/client";
import { OpenAIProvider } from "@/lib/ai/openai-provider";
import { MissingProviderError } from "@/lib/ai/provider";
import { prisma } from "./prisma";
import { toPgVector } from "./pgvector";
import type { Entity, KnowledgeDocument, Requirement, Risk } from "@/lib/types";

export const demoOrganizationSlug = "demo-org";
export const demoWorkspaceSlug = "technical-knowledge-base";

export async function ensureDemoWorkspace() {
  const organization = await prisma.organization.upsert({
    where: { slug: demoOrganizationSlug },
    update: {},
    create: {
      name: "Demo Organization",
      slug: demoOrganizationSlug,
    },
  });

  return prisma.workspace.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: demoWorkspaceSlug,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Technical Knowledge Base",
      slug: demoWorkspaceSlug,
    },
  });
}

export async function loadWorkspaceDocuments() {
  const workspace = await ensureDemoWorkspace();
  const documents = await prisma.document.findMany({
    where: { workspaceId: workspace.id },
    include: {
      chunks: { orderBy: { index: "asc" } },
      entities: true,
      requirements: true,
      risks: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return documents.map((document): KnowledgeDocument => {
    const metadata = document.metadata && typeof document.metadata === "object" && !Array.isArray(document.metadata)
      ? (document.metadata as Record<string, unknown>)
      : {};

    return {
      id: document.id,
      title: document.title,
      type: document.mimeType ?? document.sourceType,
      size: Number(metadata.size ?? 0),
      content: String(metadata.content ?? ""),
      summary: document.summary ?? "",
      tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag): tag is string => typeof tag === "string") : [],
      classification: String(metadata.classification ?? "Wissensdokument"),
      createdAt: document.createdAt.toISOString(),
      status: document.status === DocumentStatus.INDEXED ? "indexed" : document.status === DocumentStatus.FAILED ? "failed" : "processing",
      metadata,
      chunks: document.chunks.map((chunk) => ({
        id: chunk.id,
        documentId: chunk.documentId,
        documentTitle: document.title,
        index: chunk.index,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        keywords: extractStringArray(chunk.metadata, "keywords"),
        metadata: chunk.metadata && typeof chunk.metadata === "object" && !Array.isArray(chunk.metadata)
          ? (chunk.metadata as Record<string, unknown>)
          : undefined,
      })),
      entities: document.entities.map((entity): Entity => ({
        id: entity.id,
        documentId: entity.documentId ?? document.id,
        name: entity.name,
        type: normalizeEntityType(entity.type),
        weight: Number((entity.confidence * 10).toFixed(0)),
      })),
      requirements: document.requirements.map((requirement): Requirement => ({
        id: requirement.id,
        documentId: requirement.documentId,
        title: requirement.title,
        statement: requirement.statement,
        priority: normalizePriority(requirement.priority),
        confidence: requirement.confidence,
      })),
      risks: document.risks.map((risk): Risk => ({
        id: risk.id,
        documentId: risk.documentId,
        title: risk.title,
        evidence: risk.evidence,
        severity: normalizeSeverity(risk.severity),
      })),
    };
  });
}

export async function saveWorkspaceDocuments(documents: KnowledgeDocument[]) {
  const workspace = await ensureDemoWorkspace();

  await prisma.$transaction(async (tx) => {
    await tx.document.deleteMany({ where: { workspaceId: workspace.id } });

    for (const document of documents) {
      await tx.document.create({
        data: {
          id: document.id,
          workspaceId: workspace.id,
          title: document.title,
          sourceType: document.type,
          mimeType: document.type,
          checksum: document.id,
          status: document.status === "failed" ? DocumentStatus.FAILED : DocumentStatus.INDEXED,
          summary: document.summary,
          metadata: {
            ...(document.metadata ?? {}),
            size: document.size,
            content: document.content,
            tags: document.tags,
            classification: document.classification,
          },
          chunks: {
            create: document.chunks.map((chunk) => ({
              id: chunk.id,
              workspaceId: workspace.id,
              index: chunk.index,
              content: chunk.content,
              tokenCount: chunk.tokenCount,
              metadata: { keywords: chunk.keywords },
            })),
          },
          entities: {
            create: document.entities.map((entity) => ({
              id: entity.id,
              workspaceId: workspace.id,
              name: entity.name,
              type: entity.type,
              aliases: [],
              confidence: Math.max(0.1, Math.min(1, entity.weight / 10)),
            })),
          },
          requirements: {
            create: document.requirements.map((requirement) => ({
              id: requirement.id,
              workspaceId: workspace.id,
              title: requirement.title,
              statement: requirement.statement,
              priority: requirement.priority,
              confidence: requirement.confidence,
            })),
          },
          risks: {
            create: document.risks.map((risk) => ({
              id: risk.id,
              workspaceId: workspace.id,
              title: risk.title,
              evidence: risk.evidence,
              severity: risk.severity,
            })),
          },
        },
      });
    }
  });

  await storeEmbeddingsForDocuments(documents);

  return { workspaceId: workspace.id, documentCount: documents.length };
}

export async function appendWorkspaceDocuments(documents: KnowledgeDocument[]) {
  const workspace = await ensureDemoWorkspace();

  await prisma.$transaction(async (tx) => {
    for (const document of documents) {
      await tx.document.deleteMany({
        where: {
          workspaceId: workspace.id,
          OR: [{ id: document.id }, { checksum: document.id }],
        },
      });

      await tx.document.create({
        data: {
          id: document.id,
          workspaceId: workspace.id,
          title: document.title,
          sourceType: document.type,
          mimeType: document.type,
          checksum: document.id,
          status: DocumentStatus.INDEXED,
          summary: document.summary,
          metadata: {
            ...(document.metadata ?? {}),
            size: document.size,
            content: document.content,
            tags: document.tags,
            classification: document.classification,
          },
          chunks: {
            create: document.chunks.map((chunk) => ({
              id: chunk.id,
              workspaceId: workspace.id,
              index: chunk.index,
              content: chunk.content,
              tokenCount: chunk.tokenCount,
              metadata: { keywords: chunk.keywords },
            })),
          },
          entities: {
            create: document.entities.map((entity) => ({
              id: entity.id,
              workspaceId: workspace.id,
              name: entity.name,
              type: entity.type,
              aliases: [],
              confidence: Math.max(0.1, Math.min(1, entity.weight / 10)),
            })),
          },
          requirements: {
            create: document.requirements.map((requirement) => ({
              id: requirement.id,
              workspaceId: workspace.id,
              title: requirement.title,
              statement: requirement.statement,
              priority: requirement.priority,
              confidence: requirement.confidence,
            })),
          },
          risks: {
            create: document.risks.map((risk) => ({
              id: risk.id,
              workspaceId: workspace.id,
              title: risk.title,
              evidence: risk.evidence,
              severity: risk.severity,
            })),
          },
        },
      });
    }
  });

  await storeEmbeddingsForDocuments(documents);

  return { workspaceId: workspace.id, documentCount: documents.length };
}

export async function clearWorkspaceDocuments() {
  const workspace = await ensureDemoWorkspace();
  await prisma.document.deleteMany({ where: { workspaceId: workspace.id } });
  return { workspaceId: workspace.id };
}

function extractStringArray(value: unknown, key: string): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>)[key];
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
}

function normalizeEntityType(type: string): Entity["type"] {
  if (["system", "role", "process", "artifact", "concept"].includes(type)) {
    return type as Entity["type"];
  }
  return "concept";
}

function normalizePriority(priority: string): Requirement["priority"] {
  if (["must", "should", "could", "unknown"].includes(priority)) {
    return priority as Requirement["priority"];
  }
  return "unknown";
}

function normalizeSeverity(severity: string): Risk["severity"] {
  if (["high", "medium", "low"].includes(severity)) {
    return severity as Risk["severity"];
  }
  return "low";
}

async function storeEmbeddingsForDocuments(documents: KnowledgeDocument[]) {
  if (!process.env.OPENAI_API_KEY) return;

  const chunks = documents.flatMap((document) => document.chunks);
  if (chunks.length === 0) return;

  try {
    const provider = new OpenAIProvider();
    const batchSize = 64;

    for (let index = 0; index < chunks.length; index += batchSize) {
      const batch = chunks.slice(index, index + batchSize);
      const embeddings = await provider.embed(batch.map((chunk) => chunk.content));

      for (const [batchIndex, embedding] of embeddings.entries()) {
        const chunk = batch[batchIndex];
        if (!chunk || embedding.length === 0) continue;
        await prisma.$executeRawUnsafe(
          'UPDATE "Chunk" SET embedding = $1::vector WHERE id = $2',
          toPgVector(embedding),
          chunk.id,
        );
      }
    }
  } catch (error) {
    if (!(error instanceof MissingProviderError)) {
      console.error("Embedding generation failed; documents remain searchable via full-text fallback", error);
    }
  }
}
