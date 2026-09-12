import { ClaudeReview, ClaudeReviewSchema, extractJsonFromText } from '../../protocol/schemas.js';

export class ClaudeParser {
  public static parseReview(rawText: string): { success: true; data: ClaudeReview } | { success: false; error: string } {
    try {
      const parsedJson = extractJsonFromText(rawText);
      const validated = ClaudeReviewSchema.parse(parsedJson);
      return { success: true, data: validated };
    } catch (err: any) {
      // Fallback: If Claude answered in plain text with bold keywords
      const isApproved = /\bAPPROVED\b/i.test(rawText) && !/\bCHANGES_REQUESTED\b/i.test(rawText);
      const isChangesRequested = /\bCHANGES_REQUESTED\b/i.test(rawText);

      if (isApproved) {
        return {
          success: true,
          data: {
            decision: 'APPROVED',
            summary: rawText.trim().slice(0, 500),
            issues: [],
          },
        };
      }

      if (isChangesRequested) {
        return {
          success: true,
          data: {
            decision: 'CHANGES_REQUESTED',
            summary: rawText.trim().slice(0, 500),
            issues: [
              {
                severity: 'high',
                category: 'review',
                file: 'workspace',
                problem: rawText.trim().slice(0, 1000),
                required_change: 'Address review objections',
              },
            ],
          },
        };
      }

      return { success: false, error: err?.message || String(err) };
    }
  }
}
