export type RetrievalStage = {
  name: string;
  purpose: string;
  productionBackend: string;
};

export const retrievalPlan: RetrievalStage[] = [
  {
    name: "Query Rewrite",
    purpose: "Normalisiert Nutzerfragen und erzeugt technische Suchvarianten.",
    productionBackend: "OpenAI Responses API or local model",
  },
  {
    name: "Hybrid Candidate Retrieval",
    purpose: "Kombiniert pgvector-Similarity, PostgreSQL Full Text und Graph-Nachbarschaft.",
    productionBackend: "PostgreSQL + pgvector",
  },
  {
    name: "Reranking",
    purpose: "Sortiert Kandidaten nach Relevanz, Quellenqualitaet und Workspace-Kontext.",
    productionBackend: "OpenAI, Cohere, Voyage or local reranker",
  },
  {
    name: "Context Packing",
    purpose: "Baut ein tokenbudgetiertes Kontextpaket mit eindeutigen Zitaten.",
    productionBackend: "Application service",
  },
  {
    name: "Grounded Generation",
    purpose: "Streamt eine Antwort mit Quellen und validiert, dass Aussagen belegt sind.",
    productionBackend: "OpenAI streaming chat/responses",
  },
];
