import { analyzeDocument } from "./knowledge";
import type { KnowledgeDocument } from "./types";

const rawSampleDocuments = [
  {
    id: "doc-lastenheft",
    title: "Lastenheft Kundenportal.md",
    type: "text/markdown",
    size: 18420,
    content: `
Das Kundenportal muss Dokumente versionieren, Rollen und Rechte abbilden und alle relevanten Aktivitaeten im Audit Log speichern.
Benutzer sollen Suchergebnisse inklusive Quellen als PDF und Markdown exportieren koennen.
Sachbearbeiter muessen Dokumente nach Kunde, Status, Dokumenttyp und Erstellungsdatum filtern koennen.
Das System muss Mandantentrennung zwischen Organisationen sicherstellen.
Risiko: Die Isolation zwischen Organisationen ist kritisch und muss in der Architektur eindeutig spezifiziert werden.
Akzeptanzkriterium: Ein Benutzer darf niemals Dokumente eines anderen Mandanten sehen.
Testfall: Wenn ein Benutzer ohne Berechtigung ein Dokument oeffnet, muss die Plattform den Zugriff verweigern.
`,
  },
  {
    id: "doc-architektur",
    title: "Architekturkonzept RAG Plattform.md",
    type: "text/markdown",
    size: 22110,
    content: `
Die Plattform nutzt Next.js, PostgreSQL, pgvector und OpenAI.
Eine Ingestion Worker Pipeline verarbeitet Uploads, erstellt Chunks, Embeddings, Entities, Requirements und Risiken.
Der Chat muss Antworten tokenweise streamen und Quellen bereits waehrend der Antwort anzeigen.
Die API muss Dokumente, Suchanfragen, Graph-Abfragen und Exporte getrennt bereitstellen.
Risiko: Grosse Dokumentmengen benoetigen Batch-Verarbeitung, Caching und Kostenkontrolle fuer Embeddings.
Performance: Retrieval muss Full Text, Vektor-Suche und Graph Expansion kombinieren.
`,
  },
  {
    id: "doc-qa",
    title: "QA Teststrategie.md",
    type: "text/markdown",
    size: 12600,
    content: `
Alle Muss-Anforderungen sollen mindestens einen funktionalen Testfall besitzen.
Regressionstests muessen Requirements, Bugs und Code-Aenderungen miteinander verknuepfen.
Gherkin-Szenarien sollen aus Akzeptanzkriterien automatisch vorgeschlagen und durch QA freigegeben werden.
Testabdeckung muss pro Release sichtbar sein.
Risiko: Anforderungen ohne Testfall fuehren zu unklarer Release Readiness.
Bug Reports muessen auf betroffene Anforderungen und Quellen referenzieren.
`,
  },
  {
    id: "doc-compliance",
    title: "Enterprise Governance.md",
    type: "text/markdown",
    size: 9900,
    content: `
Die Plattform muss DSGVO-konform betrieben werden und sensible Daten erkennen.
Owner, Admin, Editor und Viewer muessen unterschiedliche Rechte pro Workspace erhalten.
Audit Logs sollen Uploads, Exporte, Suchanfragen und AI-Antworten nachvollziehbar speichern.
Lokale LLMs sollen fuer vertrauliche Workspaces moeglich sein.
Risiko: Ohne Datenklassifikation koennen sensible Informationen versehentlich an externe Provider gesendet werden.
`,
  },
];

export const sampleDocuments: KnowledgeDocument[] = rawSampleDocuments.map((document) =>
  analyzeDocument({
    id: document.id,
    title: document.title,
    type: document.type,
    size: document.size,
    content: document.content.trim(),
  }),
);
