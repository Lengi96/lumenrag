import type { Prisma } from "@prisma/client";
import { prisma, isDatabaseConfigured } from "./prisma";
import { ensureDemoWorkspace } from "./workspace-store";

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type ConversationMessage = {
  id: string;
  role: string;
  content: string;
  citations?: unknown;
  createdAt: string;
};

export async function listConversations(): Promise<ConversationSummary[]> {
  if (!isDatabaseConfigured()) return [];

  const workspace = await ensureDemoWorkspace();
  const conversations = await prisma.conversation.findMany({
    where: { workspaceId: workspace.id },
    include: { _count: { select: { messages: true } } },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messageCount: conversation._count.messages,
  }));
}

export async function loadConversation(conversationId: string): Promise<{
  id: string;
  title: string;
  messages: ConversationMessage[];
} | null> {
  if (!isDatabaseConfigured()) return null;

  const workspace = await ensureDemoWorkspace();
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, workspaceId: workspace.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) return null;

  return {
    id: conversation.id,
    title: conversation.title,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      citations: message.citations,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export async function saveConversationTurn(input: {
  conversationId?: string | null;
  query: string;
  answer: string;
  citations: Prisma.InputJsonValue;
}) {
  if (!isDatabaseConfigured()) return null;

  const workspace = await ensureDemoWorkspace();
  const title = titleFromQuery(input.query);
  const conversation = input.conversationId
    ? await prisma.conversation.findFirst({
        where: { id: input.conversationId, workspaceId: workspace.id },
      })
    : null;

  const savedConversation =
    conversation ??
    (await prisma.conversation.create({
      data: {
        workspaceId: workspace.id,
        title,
      },
    }));

  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: savedConversation.id,
        role: "user",
        content: input.query,
      },
    }),
    prisma.message.create({
      data: {
        conversationId: savedConversation.id,
        role: "assistant",
        content: input.answer,
        citations: input.citations,
      },
    }),
    prisma.conversation.update({
      where: { id: savedConversation.id },
      data: { updatedAt: new Date() },
    }),
  ]);

  return {
    id: savedConversation.id,
    title: savedConversation.title,
  };
}

function titleFromQuery(query: string): string {
  const normalized = query.trim().replace(/\s+/g, " ");
  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized || "Neue Unterhaltung";
}
