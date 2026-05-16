import type { Entity, KnowledgeDocument, Requirement, Risk, TestCase, UserStory, KnowledgeGap } from "@/lib/types";
import type { StructuredExtraction } from "./extraction-schemas";

export function applyStructuredExtraction(document: KnowledgeDocument, extraction: StructuredExtraction): KnowledgeDocument {
  if (
    extraction.requirements.length === 0 &&
    extraction.risks.length === 0 &&
    extraction.entities.length === 0
  ) {
    return document;
  }

  return {
    ...document,
    requirements: extraction.requirements.length > 0 ? toRequirements(document.id, extraction) : document.requirements,
    risks: extraction.risks.length > 0 ? toRisks(document.id, extraction) : document.risks,
    entities: extraction.entities.length > 0 ? toEntities(document.id, extraction) : document.entities,
    metadata: {
      ...(document.metadata ?? {}),
      structuredExtraction: {
        provider: "langchain",
        relationCount: extraction.relations.length,
        testCaseCount: extraction.testCases.length,
        userStoryCount: extraction.userStories.length,
        knowledgeGapCount: extraction.knowledgeGaps.length,
        relations: extraction.relations,
        testCases: extraction.testCases,
        userStories: extraction.userStories,
        knowledgeGaps: extraction.knowledgeGaps,
      },
    },
  };
}

export function structuredTestCases(document: KnowledgeDocument): TestCase[] {
  const extraction = readStructuredExtraction(document);
  return extraction.testCases.map((testCase, index) => ({
    id: `${document.id}-ai-test-${index}`,
    requirementId: findRequirementId(document, testCase.requirementTitle),
    title: testCase.title,
    gherkin: testCase.gherkin,
    coverage: testCase.coverage,
    riskLevel: testCase.riskLevel,
  }));
}

export function structuredUserStories(document: KnowledgeDocument): UserStory[] {
  const extraction = readStructuredExtraction(document);
  return extraction.userStories.map((story, index) => ({
    id: `${document.id}-ai-story-${index}`,
    requirementId: findRequirementId(document, story.requirementTitle),
    title: story.title,
    story: story.story,
    acceptanceCriteria: story.acceptanceCriteria,
  }));
}

export function structuredKnowledgeGaps(document: KnowledgeDocument): KnowledgeGap[] {
  const extraction = readStructuredExtraction(document);
  return extraction.knowledgeGaps.map((gap, index) => ({
    id: `${document.id}-ai-gap-${index}`,
    title: gap.title,
    evidence: gap.evidence,
    severity: gap.severity,
    recommendation: gap.recommendation,
  }));
}

function toRequirements(documentId: string, extraction: StructuredExtraction): Requirement[] {
  return extraction.requirements.map((requirement, index) => ({
    id: `${documentId}-ai-req-${index}`,
    documentId,
    title: requirement.title,
    statement: requirement.statement,
    priority: requirement.priority,
    confidence: requirement.confidence,
  }));
}

function toRisks(documentId: string, extraction: StructuredExtraction): Risk[] {
  return extraction.risks.map((risk, index) => ({
    id: `${documentId}-ai-risk-${index}`,
    documentId,
    title: risk.title,
    evidence: risk.evidence,
    severity: risk.severity,
  }));
}

function toEntities(documentId: string, extraction: StructuredExtraction): Entity[] {
  return extraction.entities.map((entity, index) => ({
    id: `${documentId}-ai-entity-${index}`,
    documentId,
    name: entity.name,
    type: entity.type,
    weight: Math.max(1, Math.round(entity.confidence * 10)),
  }));
}

function readStructuredExtraction(document: KnowledgeDocument): Pick<StructuredExtraction, "testCases" | "userStories" | "knowledgeGaps"> {
  const raw = document.metadata?.structuredExtraction;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { testCases: [], userStories: [], knowledgeGaps: [] };
  }

  const record = raw as Record<string, unknown>;
  return {
    testCases: Array.isArray(record.testCases) ? record.testCases as StructuredExtraction["testCases"] : [],
    userStories: Array.isArray(record.userStories) ? record.userStories as StructuredExtraction["userStories"] : [],
    knowledgeGaps: Array.isArray(record.knowledgeGaps) ? record.knowledgeGaps as StructuredExtraction["knowledgeGaps"] : [],
  };
}

function findRequirementId(document: KnowledgeDocument, title: string): string {
  return document.requirements.find((requirement) => requirement.title === title)?.id ?? document.requirements[0]?.id ?? `${document.id}-unknown-req`;
}
