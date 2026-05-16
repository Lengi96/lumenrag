import { DocumentStatus, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const demoOrganizationSlug = "demo-org";
const demoWorkspaceSlug = "technical-knowledge-base";

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

const requirementTerms = ["muss", "soll", "sollen", "must", "required", "anforderung", "akzeptanzkriterium"];
const riskTerms = ["risiko", "kritisch", "security", "datenschutz", "performance", "unklar"];
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
  "ist",
  "mit",
  "oder",
  "sich",
  "und",
  "von",
  "werden",
  "wird",
  "zur",
]);

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: demoOrganizationSlug },
    update: {},
    create: {
      name: "Demo Organization",
      slug: demoOrganizationSlug,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "demo@lumenrag.local" },
    update: { name: "Demo Owner" },
    create: {
      email: "demo@lumenrag.local",
      name: "Demo Owner",
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
    update: { role: Role.OWNER },
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: Role.OWNER,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: demoWorkspaceSlug,
      },
    },
    update: { name: "Technical Knowledge Base" },
    create: {
      organizationId: organization.id,
      name: "Technical Knowledge Base",
      slug: demoWorkspaceSlug,
    },
  });

  const documents = rawSampleDocuments.map(analyzeDocument);

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
          status: DocumentStatus.INDEXED,
          summary: document.summary,
          metadata: {
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

  console.log(`Seeded ${documents.length} documents into workspace "${workspace.slug}".`);
}

function analyzeDocument(input) {
  const content = input.content.trim();
  const chunks = chunkText(content, input.id, input.title);
  const keywords = topKeywords(content, 8);

  return {
    id: input.id,
    title: input.title,
    type: input.type,
    size: input.size,
    content,
    classification: classifyDocument(input.title, content),
    summary: splitSentences(content).slice(0, 3).join(" "),
    tags: keywords.slice(0, 6),
    chunks,
    requirements: extractRequirements(input.id, content),
    risks: extractRisks(input.id, content),
    entities: extractEntities(input.id, content, keywords),
  };
}

function chunkText(content, documentId, documentTitle) {
  return splitSentences(content).map((chunk, index) => ({
    id: `${documentId}-chunk-${index}`,
    documentId,
    documentTitle,
    index,
    content: chunk,
    tokenCount: chunk.split(/\s+/).length,
    keywords: topKeywords(chunk, 6),
  }));
}

function extractRequirements(documentId, content) {
  return splitSentences(content)
    .filter((sentence) => containsAny(sentence, requirementTerms))
    .slice(0, 8)
    .map((sentence, index) => ({
      id: `${documentId}-req-${index}`,
      documentId,
      title: titleFromSentence(sentence),
      statement: sentence,
      priority: /muss|must|required/i.test(sentence) ? "must" : /soll|should/i.test(sentence) ? "should" : "unknown",
      confidence: 0.82,
    }));
}

function extractRisks(documentId, content) {
  return splitSentences(content)
    .filter((sentence) => containsAny(sentence, riskTerms))
    .slice(0, 6)
    .map((sentence, index) => ({
      id: `${documentId}-risk-${index}`,
      documentId,
      title: titleFromSentence(sentence),
      evidence: sentence,
      severity: /kritisch|security|datenschutz/i.test(sentence) ? "high" : /performance|unklar/i.test(sentence) ? "medium" : "low",
    }));
}

function extractEntities(documentId, content, keywords) {
  const properNouns = Array.from(content.matchAll(/\b[A-Z][A-Za-z0-9-]{3,}\b/g)).map((match) => match[0]);
  const candidates = [...properNouns, ...keywords].filter((word) => !stopWords.has(word.toLowerCase()));
  const counts = new Map();
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

function classifyDocument(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  if (text.includes("lastenheft")) return "Lastenheft";
  if (text.includes("architektur")) return "Architekturdokument";
  if (text.includes("testfall") || text.includes("teststrategie")) return "Testdokument";
  if (text.includes("governance")) return "Governance";
  return "Wissensdokument";
}

function topKeywords(content, limit) {
  const counts = new Map();
  tokenize(content).forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gi, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3 && !stopWords.has(word));
}

function splitSentences(content) {
  return content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 24);
}

function titleFromSentence(sentence) {
  const clean = sentence.replace(/^[*-]\s*/, "").trim();
  return clean.length > 72 ? `${clean.slice(0, 69)}...` : clean;
}

function containsAny(text, terms) {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function inferEntityType(name) {
  if (/portal|system|plattform|service|api/i.test(name)) return "system";
  if (/admin|benutzer|kunde|owner|editor|viewer/i.test(name)) return "role";
  if (/pipeline|retrieval|ingestion/i.test(name)) return "process";
  if (/dokument|log|report|export|postgresql|pgvector/i.test(name)) return "artifact";
  return "concept";
}

main()
  .catch((error) => {
    console.error("Demo seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
