import { z } from 'zod';

/**
 * Standard Stage-Based Output Schemas
 * Stage contracts are strictly model-agnostic.
 */

// ============================================================================
// 1. Planning Result Schema (Standard contract for any Planner agent)
// ============================================================================
export const PlanningResultSchema = z.object({
  objective: z.string().min(1, 'Objective is required'),
  assumptions: z.array(z.string()).default([]),
  requirements: z.array(z.string()).min(1, 'At least one requirement is required'),
  architecture: z.array(z.string()).min(1, 'Architecture details required'),
  implementation_steps: z.array(z.string()).min(1, 'Implementation steps required'),
  edge_cases: z.array(z.string()).default([]),
  acceptance_criteria: z.array(z.string()).min(1, 'Acceptance criteria required'),
  verification_plan: z.array(z.string()).min(1, 'Verification plan required'),
  risks: z.array(z.string()).default([]),
});

export type PlanningResult = z.infer<typeof PlanningResultSchema>;
// Backward-compatible alias
export const CodexPlanSchema = PlanningResultSchema;
export type CodexPlan = PlanningResult;

// ============================================================================
// 2. Review Result Schema (Standard contract for any Reviewer agent)
// ============================================================================
export const ReviewIssueSchema = z.object({
  severity: z.string().default('medium'),
  category: z.string().optional().default('general'),
  file: z.string().optional().default('general'),
  problem: z.string().optional(),
  description: z.string().optional(),
  required_change: z.string().optional(),
  suggested_fix: z.string().optional(),
}).transform(issue => ({
  severity: (['critical', 'high', 'medium', 'low'].includes((issue.severity || '').toLowerCase()) ? (issue.severity || '').toLowerCase() : 'medium') as 'critical' | 'high' | 'medium' | 'low',
  category: issue.category || 'general',
  file: issue.file || 'general',
  problem: issue.problem || issue.description || 'Issue detected',
  description: issue.description || issue.problem || 'Issue detected',
  required_change: issue.required_change || issue.suggested_fix || 'Fix issue',
  suggested_fix: issue.suggested_fix || issue.required_change || 'Fix issue',
}));

export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;
// Backward-compatible alias
export const ClaudeReviewIssueSchema = ReviewIssueSchema;

export const ReviewResultSchema = z.object({
  decision: z.enum(['APPROVED', 'CHANGES_REQUESTED']),
  summary: z.string(),
  issues: z.array(ReviewIssueSchema).default([]),
});

export type ReviewResult = z.infer<typeof ReviewResultSchema>;
// Backward-compatible alias
export const ClaudeReviewSchema = ReviewResultSchema;
export type ClaudeReview = ReviewResult;

// ============================================================================
// 3. Final Check Result Schema (Standard contract for any Final Checker)
// ============================================================================
export const FinalCheckResultSchema = z.object({
  decision: z.enum(['CONFORMANT', 'NON_CONFORMANT']),
  summary: z.string().optional(),
  missing_items: z.array(z.string()).default([]),
  deviations: z.array(z.string()).default([]),
  remaining_risks: z.array(z.string()).default([]),
});

export type FinalCheckResult = z.infer<typeof FinalCheckResultSchema>;
// Backward-compatible alias
export const CodexConformanceSchema = FinalCheckResultSchema;
export type CodexConformance = FinalCheckResult;

// ============================================================================
// Robust JSON Extractor: Parses JSON directly or extracts from code blocks
// ============================================================================
export function extractJsonFromText(rawText: string): unknown {
  const trimmed = rawText.trim();

  // 1. Direct parse attempt
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue to block extraction
  }

  // 2. Extract ```json ... ``` block
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch {
      // continue
    }
  }

  // 3. Find outermost curly braces { ... }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  throw new Error(`Failed to extract valid JSON from output. Length was ${rawText.length}`);
}
