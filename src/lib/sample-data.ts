import type { KnowledgeDocument } from "./types";

export const sampleDocuments: KnowledgeDocument[] = [
  {
    id: "doc-lastenheft",
    title: "Lastenheft Kundenportal",
    type: "text/markdown",
    size: 18420,
    createdAt: "2026-05-13T08:30:00.000Z",
    status: "indexed",
    classification: "Lastenheft",
    tags: ["portal", "anforderungen", "rollen", "audit", "export"],
    summary:
      "Das Dokument beschreibt ein Kundenportal mit Self-Service, Rollenmodell, Dokumentverwaltung, Suchfunktionen und revisionssicherem Export.",
    chunks: [],
    entities: [
      { id: "e1", documentId: "doc-lastenheft", name: "Kundenportal", type: "system", weight: 10 },
      { id: "e2", documentId: "doc-lastenheft", name: "Sachbearbeiter", type: "role", weight: 7 },
      { id: "e3", documentId: "doc-lastenheft", name: "Audit Log", type: "artifact", weight: 6 },
    ],
    requirements: [
      {
        id: "r1",
        documentId: "doc-lastenheft",
        title: "Dokumente versionieren",
        statement: "Das System muss hochgeladene Dokumente versionieren und Änderungen nachvollziehbar speichern.",
        priority: "must",
        confidence: 0.91,
      },
      {
        id: "r2",
        documentId: "doc-lastenheft",
        title: "Export bereitstellen",
        statement: "Benutzer sollen Suchergebnisse inklusive Quellen als PDF und Markdown exportieren können.",
        priority: "should",
        confidence: 0.86,
      },
    ],
    risks: [
      {
        id: "risk1",
        documentId: "doc-lastenheft",
        title: "Unklare Mandantentrennung",
        evidence: "Rollen werden erwähnt, aber die Isolation zwischen Organisationen ist nicht vollständig spezifiziert.",
        severity: "high",
      },
    ],
    content:
      "Das Kundenportal muss Dokumente versionieren, Rollen und Rechte abbilden und alle relevanten Aktivitäten im Audit Log speichern. Benutzer sollen Suchergebnisse inklusive Quellen exportieren können. Risiken bestehen bei unklarer Mandantentrennung.",
  },
  {
    id: "doc-architektur",
    title: "Architekturkonzept RAG Plattform",
    type: "text/markdown",
    size: 22110,
    createdAt: "2026-05-13T09:15:00.000Z",
    status: "indexed",
    classification: "Architekturdokument",
    tags: ["rag", "pgvector", "worker", "openai", "streaming"],
    summary:
      "Das Architekturkonzept definiert eine Next.js-Plattform mit PostgreSQL, pgvector, Worker-Pipeline, OpenAI-Integration und Streaming Chat.",
    chunks: [],
    entities: [
      { id: "e4", documentId: "doc-architektur", name: "pgvector", type: "artifact", weight: 9 },
      { id: "e5", documentId: "doc-architektur", name: "Ingestion Worker", type: "process", weight: 8 },
      { id: "e6", documentId: "doc-architektur", name: "RAG Pipeline", type: "process", weight: 10 },
    ],
    requirements: [
      {
        id: "r3",
        documentId: "doc-architektur",
        title: "Streaming Antworten",
        statement: "Der Chat muss Antworten tokenweise streamen und Quellen bereits während der Antwort anzeigen.",
        priority: "must",
        confidence: 0.89,
      },
    ],
    risks: [
      {
        id: "risk2",
        documentId: "doc-architektur",
        title: "Embedding-Kosten",
        evidence: "Große Dokumentmengen benötigen Batch-Verarbeitung, Caching und Kostenkontrolle.",
        severity: "medium",
      },
    ],
    content:
      "Die Plattform nutzt Next.js, PostgreSQL, pgvector und OpenAI. Eine Worker-Pipeline verarbeitet Uploads, erstellt Chunks, Embeddings, Entities, Requirements und Risiken. Der Chat streamt Antworten mit Quellen.",
  },
];
