import type {
  Entity,
  KnowledgeChunk,
  KnowledgeDocument,
  MindmapEdge,
  MindmapGraph,
  MindmapNode,
  Requirement,
  Risk,
  SearchResult,
} from "./types";

const requirementTerms = [
  "muss",
  "soll",
  "sollen",
  "shall",
  "must",
  "required",
  "anforderung",
  "user story",
  "akzeptanzkriterium",
];

const riskTerms = [
  "risiko",
  "risk",
  "unklar",
  "widerspruch",
  "abhängigkeit",
  "kritisch",
  "security",
  "datenschutz",
  "performance",
];

const stopWords = new Set([
  "aber",
  "alle",
  "auch",
  "auf",
  "aus",
  "bei",
  "das",
  "dem",
  "den",
  "der",
  "die",
  "ein",
  "eine",
  "einer",
  "eines",
  "for",
  "ist",
  "mit",
  "oder",
  "sich",
  "the",
  "und",
  "von",
  "werden",
  "wird",
  "zur",
]);

export async function readFiles(files: FileList | File[]): Promise<KnowledgeDocument[]> {
  const items = Array.from(files);
  const docs = await Promise.all(
    items.map(async (file) => {
      const content = await file.text();
      return analyzeDocument({
        id: stableId(`${file.name}-${file.size}-${file.lastModified}`),
        title: file.name,
        type: file.type || "text/plain",
        size: file.size,
        content,
      });
    }),
  );

  return docs;
}

export function analyzeDocument(input: {
  id: string;
  title: string;
  type: string;
  size: number;
  content: string;
}): KnowledgeDocument {
  const chunks = chunkText(input.content, input.id, input.title);
  const keywords = topKeywords(input.content, 8);
  const requirements = extractRequirements(input.id, input.content);
  const risks = extractRisks(input.id, input.content);
  const entities = extractEntities(input.id, input.content, keywords);

  return {
    id: input.id,
    title: input.title,
    type: input.type,
    size: input.size,
    content: input.content,
    status: "indexed",
    createdAt: new Date().toISOString(),
    classification: classifyDocument(input.title, input.content),
    summary: summarize(input.content),
    tags: keywords.slice(0, 6),
    chunks,
    requirements,
    risks,
    entities,
  };
}

export function searchDocuments(
  documents: KnowledgeDocument[],
  query: string,
  limit = 8,
): SearchResult[] {
  const normalized = tokenize(query);
  if (normalized.length === 0) return [];

  return documents
    .flatMap((doc) => doc.chunks)
    .map((chunk) => {
      const haystack = tokenize(`${chunk.content} ${chunk.keywords.join(" ")}`);
      const overlap = normalized.filter((term) => haystack.includes(term));
      const keywordBoost = chunk.keywords.filter((term) => normalized.includes(term)).length * 2;
      const score = overlap.length / normalized.length + keywordBoost + semanticHint(chunk, normalized);
      return {
        chunk,
        score,
        highlights: overlap.slice(0, 5),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function generateAnswer(query: string, results: SearchResult[]): string {
  if (results.length === 0) {
    return "Ich habe in den indexierten Dokumenten keine belastbare Quelle für diese Frage gefunden.";
  }

  const sources = results.slice(0, 3);
  const bullets = sources
    .map((result, index) => {
      const sentence = firstSentence(result.chunk.content);
      return `- ${sentence} [${index + 1}]`;
    })
    .join("\n");

  const refs = sources
    .map((result, index) => `- [${index + 1}] ${result.chunk.documentTitle}, Chunk ${result.chunk.index + 1}`)
    .join("\n");

  return `Auf Basis der geladenen Dokumente ergibt sich für "${query}":\n\n${bullets}\n\n### Quellen\n${refs}`;
}

export function buildMindmap(documents: KnowledgeDocument[]): MindmapGraph {
  const nodes: MindmapNode[] = [
    {
      id: "workspace",
      label: "Knowledge Workspace",
      kind: "workspace",
      x: 500,
      y: 300,
      size: 34,
      color: "#38bdf8",
    },
  ];
  const edges: MindmapEdge[] = [];
  const topicIds = new Map<string, string>();

  documents.forEach((doc, docIndex) => {
    const angle = (Math.PI * 2 * docIndex) / Math.max(documents.length, 1);
    const docNode: MindmapNode = {
      id: doc.id,
      label: doc.title.replace(/\.[^.]+$/, ""),
      kind: "document",
      x: 500 + Math.cos(angle) * 220,
      y: 300 + Math.sin(angle) * 160,
      size: 24,
      color: "#f8fafc",
    };
    nodes.push(docNode);
    edges.push({ id: `workspace-${doc.id}`, source: "workspace", target: doc.id, strength: 1 });

    doc.tags.slice(0, 4).forEach((tag, tagIndex) => {
      const topicId = topicIds.get(tag) ?? `topic-${stableId(tag)}`;
      if (!topicIds.has(tag)) {
        topicIds.set(tag, topicId);
        nodes.push({
          id: topicId,
          label: tag,
          kind: "topic",
          x: docNode.x + Math.cos(angle + tagIndex * 0.7) * 130,
          y: docNode.y + Math.sin(angle + tagIndex * 0.7) * 105,
          size: 16,
          color: "#a7f3d0",
        });
      }
      edges.push({ id: `${doc.id}-${topicId}`, source: doc.id, target: topicId, strength: 0.72 });
    });

    doc.requirements.slice(0, 3).forEach((requirement, index) => {
      nodes.push({
        id: requirement.id,
        label: requirement.title,
        kind: "requirement",
        x: docNode.x + 90 + index * 16,
        y: docNode.y + 72 + index * 44,
        size: 14,
        color: "#fde68a",
      });
      edges.push({ id: `${doc.id}-${requirement.id}`, source: doc.id, target: requirement.id, strength: 0.82 });
    });

    doc.risks.slice(0, 2).forEach((risk, index) => {
      nodes.push({
        id: risk.id,
        label: risk.title,
        kind: "risk",
        x: docNode.x - 110 - index * 20,
        y: docNode.y + 84 + index * 50,
        size: 14,
        color: "#fca5a5",
      });
      edges.push({ id: `${doc.id}-${risk.id}`, source: doc.id, target: risk.id, strength: 0.7 });
    });
  });

  return { nodes, edges };
}

function chunkText(content: string, documentId: string, documentTitle: string): KnowledgeChunk[] {
  const blocks = content
    .split(/\n{2,}|(?<=\.)\s+(?=[A-ZÄÖÜ])/)
    .map((block) => block.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buffer = "";

  blocks.forEach((block) => {
    if ((buffer + " " + block).split(/\s+/).length > 180 && buffer) {
      chunks.push(buffer.trim());
      buffer = block;
    } else {
      buffer = `${buffer} ${block}`.trim();
    }
  });
  if (buffer) chunks.push(buffer.trim());

  return chunks.map((chunk, index) => ({
    id: `${documentId}-chunk-${index}`,
    documentId,
    documentTitle,
    index,
    content: chunk,
    tokenCount: chunk.split(/\s+/).length,
    keywords: topKeywords(chunk, 6),
  }));
}

function extractRequirements(documentId: string, content: string): Requirement[] {
  return splitSentences(content)
    .filter((sentence) => containsAny(sentence, requirementTerms))
    .slice(0, 8)
    .map((sentence, index) => ({
      id: `${documentId}-req-${index}`,
      documentId,
      title: titleFromSentence(sentence),
      statement: sentence,
      priority: /muss|must|required/i.test(sentence)
        ? "must"
        : /soll|should/i.test(sentence)
          ? "should"
          : "unknown",
      confidence: 0.72 + Math.min(sentence.length / 500, 0.2),
    }));
}

function extractRisks(documentId: string, content: string): Risk[] {
  return splitSentences(content)
    .filter((sentence) => containsAny(sentence, riskTerms))
    .slice(0, 6)
    .map((sentence, index) => ({
      id: `${documentId}-risk-${index}`,
      documentId,
      title: titleFromSentence(sentence),
      evidence: sentence,
      severity: /kritisch|security|datenschutz|widerspruch/i.test(sentence)
        ? "high"
        : /performance|abhängigkeit|unklar/i.test(sentence)
          ? "medium"
          : "low",
    }));
}

function extractEntities(documentId: string, content: string, keywords: string[]): Entity[] {
  const properNouns = Array.from(content.matchAll(/\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9-]{3,}\b/g))
    .map((match) => match[0])
    .filter((word) => !stopWords.has(word.toLowerCase()));
  const candidates = [...properNouns, ...keywords];
  const counts = new Map<string, number>();
  candidates.forEach((candidate) => counts.set(candidate, (counts.get(candidate) ?? 0) + 1));

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, weight], index) => ({
      id: `${documentId}-entity-${index}`,
      documentId,
      name,
      type: inferEntityType(name),
      weight,
    }));
}

function classifyDocument(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase();
  if (text.includes("lastenheft")) return "Lastenheft";
  if (text.includes("pflichtenheft")) return "Pflichtenheft";
  if (text.includes("architektur")) return "Architekturdokument";
  if (text.includes("testfall") || text.includes("test case")) return "Testdokument";
  if (text.includes("prozess")) return "Prozessdokumentation";
  if (text.includes("user story") || text.includes("anforderung")) return "Anforderungsdokument";
  return "Wissensdokument";
}

function summarize(content: string): string {
  const sentences = splitSentences(content).slice(0, 3);
  if (sentences.length === 0) return "Noch keine Zusammenfassung verfügbar.";
  return sentences.join(" ");
}

function topKeywords(content: string, limit: number): string[] {
  const counts = new Map<string, number>();
  tokenize(content).forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s-]/gi, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3 && !stopWords.has(word));
}

function splitSentences(content: string): string[] {
  return content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 24);
}

function titleFromSentence(sentence: string): string {
  const clean = sentence.replace(/^[*-]\s*/, "").trim();
  return clean.length > 72 ? `${clean.slice(0, 69)}...` : clean;
}

function containsAny(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function semanticHint(chunk: KnowledgeChunk, queryTerms: string[]): number {
  const related = chunk.keywords.filter((keyword) =>
    queryTerms.some((term) => keyword.includes(term) || term.includes(keyword)),
  );
  return related.length * 0.35;
}

function firstSentence(content: string): string {
  return splitSentences(content)[0] ?? content.slice(0, 220);
}

function inferEntityType(name: string): Entity["type"] {
  if (/portal|system|plattform|service|api/i.test(name)) return "system";
  if (/manager|admin|benutzer|kunde|user|rolle/i.test(name)) return "role";
  if (/prozess|pipeline|workflow|index/i.test(name)) return "process";
  if (/dokument|log|report|export|datenbank|pgvector/i.test(name)) return "artifact";
  return "concept";
}

function stableId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
