export type DocumentStatus = "indexed" | "processing" | "failed";

export type KnowledgeDocument = {
  id: string;
  title: string;
  type: string;
  size: number;
  content: string;
  summary: string;
  tags: string[];
  classification: string;
  createdAt: string;
  status: DocumentStatus;
  metadata?: Record<string, unknown>;
  chunks: KnowledgeChunk[];
  requirements: Requirement[];
  risks: Risk[];
  entities: Entity[];
};

export type KnowledgeChunk = {
  id: string;
  documentId: string;
  documentTitle: string;
  index: number;
  content: string;
  tokenCount: number;
  keywords: string[];
};

export type Requirement = {
  id: string;
  documentId: string;
  title: string;
  statement: string;
  priority: "must" | "should" | "could" | "unknown";
  confidence: number;
};

export type Risk = {
  id: string;
  documentId: string;
  title: string;
  evidence: string;
  severity: "high" | "medium" | "low";
};

export type Entity = {
  id: string;
  documentId: string;
  name: string;
  type: "system" | "role" | "process" | "artifact" | "concept";
  weight: number;
};

export type SearchResult = {
  chunk: KnowledgeChunk;
  score: number;
  highlights: string[];
};

export type MindmapNode = {
  id: string;
  label: string;
  kind: "workspace" | "document" | "topic" | "requirement" | "risk" | "entity";
  x: number;
  y: number;
  size: number;
  color: string;
};

export type MindmapEdge = {
  id: string;
  source: string;
  target: string;
  strength: number;
};

export type MindmapGraph = {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
};
