import type {
  AgentInsight,
  EnterpriseControl,
  KnowledgeDocument,
  KnowledgeGap,
  Requirement,
  Risk,
  TestCase,
  UserStory,
} from "./types";
import { structuredKnowledgeGaps, structuredTestCases, structuredUserStories } from "./ai/structured-extraction";

const securityTerms = ["security", "datenschutz", "privacy", "auth", "rolle", "recht", "audit", "mandant"];
const qaTerms = ["test", "gherkin", "akzeptanz", "abnahme", "regression", "bug", "fehler"];
const architectureTerms = ["api", "service", "worker", "datenbank", "postgres", "pgvector", "pipeline", "stream"];

export function buildUserStories(requirements: Requirement[], documents: KnowledgeDocument[] = []): UserStory[] {
  const structured = documents.flatMap(structuredUserStories);
  const generated: UserStory[] = requirements.map((requirement) => {
    const actor = inferActor(requirement.statement);
    const goal = cleanupStatement(requirement.statement);
    return {
      id: `${requirement.id}-story`,
      requirementId: requirement.id,
      title: requirement.title,
      story: `Als ${actor} moechte ich ${goal}, damit der fachliche Nutzen nachvollziehbar umgesetzt werden kann.`,
      acceptanceCriteria: [
        `Die Anforderung "${requirement.title}" ist fachlich sichtbar umgesetzt.`,
        "Die Umsetzung ist anhand der urspruenglichen Quelle nachvollziehbar.",
        "Fehlerfaelle werden dokumentiert und fuehren zu einer klaren Nutzerreaktion.",
      ],
    };
  });
  return mergeById([...structured, ...generated]);
}

export function buildTestCases(requirements: Requirement[], risks: Risk[], documents: KnowledgeDocument[] = []): TestCase[] {
  const structured = documents.flatMap(structuredTestCases);
  const generated: TestCase[] = requirements.map((requirement, index) => {
    const relatedRisk = risks.find((risk) => risk.documentId === requirement.documentId);
    const riskLevel = relatedRisk?.severity ?? (requirement.priority === "must" ? "medium" : "low");
    const coverage = requirement.confidence > 0.88 ? "covered" : requirement.confidence > 0.78 ? "partial" : "missing";

    return {
      id: `${requirement.id}-test-${index}`,
      requirementId: requirement.id,
      title: `Validiere: ${requirement.title}`,
      riskLevel,
      coverage,
      gherkin: [
        `Feature: ${requirement.title}`,
        `Scenario: Anforderung wird erfuellt`,
        `  Given die relevante Dokumentenquelle ist im Workspace indexiert`,
        `  When die Funktion gemaess Anforderung genutzt wird`,
        `  Then ist "${requirement.title}" fachlich nachweisbar erfuellt`,
      ].join("\n"),
    };
  });
  return mergeById([...structured, ...generated]);
}

export function findKnowledgeGaps(documents: KnowledgeDocument[]): KnowledgeGap[] {
  const text = documents.map((document) => `${document.title} ${document.content}`).join("\n").toLowerCase();
  const requirements = documents.flatMap((document) => document.requirements);
  const risks = documents.flatMap((document) => document.risks);
  const gaps: KnowledgeGap[] = documents.flatMap(structuredKnowledgeGaps);

  if (requirements.length === 0) {
    gaps.push({
      id: "gap-no-requirements",
      title: "Keine expliziten Anforderungen erkannt",
      evidence: "Die Wissensbasis enthaelt Dokumente, aber keine stabil extrahierten Anforderungen.",
      severity: "high",
      recommendation: "Requirements-Extraktion mit LLM-Schema und manueller Review-Liste ergaenzen.",
    });
  }

  if (!containsAny(text, qaTerms)) {
    gaps.push({
      id: "gap-no-tests",
      title: "Testabdeckung nicht nachweisbar",
      evidence: "Es wurden keine klaren Testfaelle, Akzeptanzkriterien oder Gherkin-Szenarien gefunden.",
      severity: "high",
      recommendation: "Traceability Requirement -> Test -> Bug als Pflichtansicht einfuehren.",
    });
  }

  if (!containsAny(text, securityTerms)) {
    gaps.push({
      id: "gap-security",
      title: "Security/Compliance kaum beschrieben",
      evidence: "Begriffe zu Datenschutz, Rollen, Rechten oder Audit sind unterrepraesentiert.",
      severity: "medium",
      recommendation: "Security-Agenten Review pro Dokument ausfuehren und offene Kontrollen markieren.",
    });
  }

  risks
    .filter((risk) => risk.severity === "high")
    .slice(0, 4)
    .forEach((risk) => {
      gaps.push({
        id: `gap-risk-${risk.id}`,
        title: `Hoches Risiko: ${risk.title}`,
        evidence: risk.evidence,
        severity: "high",
        recommendation: "Owner, Gegenmassnahme und betroffene Anforderungen im Graph verknuepfen.",
      });
    });

  return gaps;
}

export function buildAgentInsights(documents: KnowledgeDocument[]): AgentInsight[] {
  const allText = documents.map((document) => `${document.title} ${document.summary} ${document.content}`).join("\n");
  const requirements = documents.flatMap((document) => document.requirements);
  const risks = documents.flatMap((document) => document.risks);
  const entities = documents.flatMap((document) => document.entities);

  return [
    {
      id: "agent-docs",
      agent: "documentation",
      title: "Dokumentations-Agent",
      finding: `${documents.length} Dokumente, ${requirements.length} Anforderungen und ${entities.length} Entitaeten sind fuer ein Projektgedaechtnis nutzbar.`,
      priority: documents.length > 0 ? "medium" : "high",
    },
    {
      id: "agent-architecture",
      agent: "architecture",
      title: "Architektur-Agent",
      finding: containsAny(allText.toLowerCase(), architectureTerms)
        ? "Architekturartefakte sind vorhanden und koennen zu Komponenten- und Abhaengigkeitskarten verdichtet werden."
        : "Es fehlen klare Architekturartefakte wie APIs, Services, Datenfluesse oder Deployment-Ziele.",
      priority: containsAny(allText.toLowerCase(), architectureTerms) ? "medium" : "high",
    },
    {
      id: "agent-qa",
      agent: "qa",
      title: "QA-Agent",
      finding: `${requirements.length} Anforderungen koennen in Testfaelle und Traceability-Matrix ueberfuehrt werden.`,
      priority: requirements.length > 0 ? "high" : "medium",
    },
    {
      id: "agent-security",
      agent: "security",
      title: "Security-Agent",
      finding: containsAny(allText.toLowerCase(), securityTerms)
        ? "Security-/Governance-Begriffe wurden erkannt; Review sollte sensible Daten, Rollen und Audit pruefen."
        : "Security-Signale sind schwach. Ein dedizierter Security-Review ist notwendig.",
      priority: "high",
    },
    {
      id: "agent-compliance",
      agent: "compliance",
      title: "Compliance-Agent",
      finding: "DSGVO, Auditierbarkeit, Datenklassifikation und Tenant-Isolation sollten als Enterprise-Kontrollen verfolgt werden.",
      priority: "medium",
    },
    {
      id: "agent-release",
      agent: "release",
      title: "Release-Agent",
      finding: risks.some((risk) => risk.severity === "high")
        ? "Release Readiness ist blockiert, solange hohe Risiken ohne Massnahme offen sind."
        : "Keine kritischen Risiken erkannt; Release-Readiness braucht noch Test- und Scope-Abdeckung.",
      priority: risks.some((risk) => risk.severity === "high") ? "high" : "medium",
    },
  ];
}

export function buildEnterpriseControls(documents: KnowledgeDocument[]): EnterpriseControl[] {
  const text = documents.map((document) => `${document.title} ${document.content}`).join(" ").toLowerCase();
  return [
    {
      id: "control-rbac",
      area: "RBAC",
      status: text.includes("rolle") || text.includes("rechte") ? "ready" : "planned",
      description: "Rollenmodell fuer Owner, Admin, Editor und Viewer mit Workspace-Grenzen.",
    },
    {
      id: "control-dsgvo",
      area: "DSGVO",
      status: text.includes("datenschutz") || text.includes("dsgvo") ? "ready" : "gap",
      description: "Sensible Daten erkennen, klassifizieren und fuer lokale LLMs sperren koennen.",
    },
    {
      id: "control-audit",
      area: "Audit",
      status: text.includes("audit") ? "ready" : "planned",
      description: "Suchanfragen, Exporte, Uploads und AI-Antworten nachvollziehbar protokollieren.",
    },
    {
      id: "control-classification",
      area: "Data Classification",
      status: documents.some((document) => document.classification !== "Wissensdokument") ? "ready" : "planned",
      description: "Dokumente nach Lastenheft, Architektur, Tests, Code und Meeting klassifizieren.",
    },
    {
      id: "control-local-llm",
      area: "Local LLM",
      status: "planned",
      description: "Provider-Schicht fuer OpenAI, Ollama, vLLM und Azure OpenAI austauschbar halten.",
    },
    {
      id: "control-tenant",
      area: "Tenant Isolation",
      status: text.includes("mandant") ? "ready" : "gap",
      description: "Organisationen, Workspaces, Dokumente und Vektorindizes strikt trennen.",
    },
  ];
}

export function buildArchitectureSummary(documents: KnowledgeDocument[]): string[] {
  const entities = documents.flatMap((document) => document.entities);
  const systems = entities.filter((entity) => entity.type === "system").map((entity) => entity.name);
  const processes = entities.filter((entity) => entity.type === "process").map((entity) => entity.name);
  const artifacts = entities.filter((entity) => entity.type === "artifact").map((entity) => entity.name);

  return [
    `Systeme: ${unique(systems).slice(0, 6).join(", ") || "noch nicht erkannt"}`,
    `Prozesse: ${unique(processes).slice(0, 6).join(", ") || "noch nicht erkannt"}`,
    `Artefakte: ${unique(artifacts).slice(0, 6).join(", ") || "noch nicht erkannt"}`,
  ];
}

function inferActor(statement: string): string {
  if (/admin|administrator/i.test(statement)) return "Administrator";
  if (/sachbearbeiter/i.test(statement)) return "Sachbearbeiter";
  if (/benutzer|user|kunde/i.test(statement)) return "Benutzer";
  return "Projektbeteiligter";
}

function cleanupStatement(statement: string): string {
  return statement
    .replace(/^das system muss\s+/i, "")
    .replace(/^benutzer sollen\s+/i, "")
    .replace(/^der chat muss\s+/i, "im Chat ")
    .replace(/\.$/, "");
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function mergeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
