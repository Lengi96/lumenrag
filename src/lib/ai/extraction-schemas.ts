import { z } from "zod";

export const extractedRequirementSchema = z.object({
  title: z.string().min(1),
  statement: z.string().min(1),
  priority: z.enum(["must", "should", "could", "unknown"]),
  confidence: z.number().min(0).max(1),
  evidence: z.string().min(1),
});

export const extractedRiskSchema = z.object({
  title: z.string().min(1),
  evidence: z.string().min(1),
  severity: z.enum(["high", "medium", "low"]),
  confidence: z.number().min(0).max(1),
});

export const extractedEntitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["system", "role", "process", "artifact", "concept"]),
  description: z.string().optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().min(1),
});

export const extractedRelationSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.string().min(1),
});

export const extractedTestCaseSchema = z.object({
  requirementTitle: z.string().min(1),
  title: z.string().min(1),
  gherkin: z.string().min(1),
  coverage: z.enum(["covered", "partial", "missing"]),
  riskLevel: z.enum(["high", "medium", "low"]),
  evidence: z.string().min(1),
});

export const extractedUserStorySchema = z.object({
  requirementTitle: z.string().min(1),
  title: z.string().min(1),
  story: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).max(8),
  evidence: z.string().min(1),
});

export const knowledgeGapSchema = z.object({
  title: z.string().min(1),
  evidence: z.string().min(1),
  severity: z.enum(["high", "medium", "low"]),
  recommendation: z.string().min(1),
});

export const structuredExtractionSchema = z.object({
  requirements: z.array(extractedRequirementSchema).max(12),
  risks: z.array(extractedRiskSchema).max(10),
  entities: z.array(extractedEntitySchema).max(16),
  relations: z.array(extractedRelationSchema).max(12),
  testCases: z.array(extractedTestCaseSchema).max(12),
  userStories: z.array(extractedUserStorySchema).max(12),
  knowledgeGaps: z.array(knowledgeGapSchema).max(8),
});

export type StructuredExtraction = z.infer<typeof structuredExtractionSchema>;
