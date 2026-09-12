import { CodexPlan, CodexPlanSchema, CodexConformance, CodexConformanceSchema, extractJsonFromText } from '../../protocol/schemas.js';

export class CodexParser {
  public static parsePlan(rawText: string): { success: true; data: CodexPlan } | { success: false; error: string } {
    try {
      const parsedJson = extractJsonFromText(rawText);
      const validated = CodexPlanSchema.parse(parsedJson);
      return { success: true, data: validated };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  public static parseConformance(rawText: string): { success: true; data: CodexConformance } | { success: false; error: string } {
    try {
      const parsedJson = extractJsonFromText(rawText);
      const validated = CodexConformanceSchema.parse(parsedJson);
      return { success: true, data: validated };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
}
