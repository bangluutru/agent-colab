import assert from 'node:assert';
import { extractJsonFromText, CodexPlanSchema, ClaudeReviewSchema, CodexConformanceSchema } from '../protocol/schemas.js';

console.log('--- Testing Schemas & JSON Extractor ---');

// Test 1: JSON extractor with markdown block
const rawWithMarkdown = `Here is the plan:
\`\`\`json
{
  "objective": "Build a calculator",
  "assumptions": ["Uses React"],
  "requirements": ["Addition", "Division"],
  "architecture": ["App.jsx", "Calculator.jsx"],
  "implementation_steps": ["Init vite", "Write components", "Write tests"],
  "edge_cases": ["Zero division"],
  "acceptance_criteria": ["All tests pass"],
  "verification_plan": ["Run vitest"],
  "risks": []
}
\`\`\`
Good luck!`;

const extracted = extractJsonFromText(rawWithMarkdown);
const parsedPlan = CodexPlanSchema.parse(extracted);
assert.strictEqual(parsedPlan.objective, 'Build a calculator');
assert.strictEqual(parsedPlan.requirements.length, 2);
console.log('✔ JSON extraction from markdown block passed');

// Test 2: Claude Review schema
const rawReview = JSON.stringify({
  decision: 'CHANGES_REQUESTED',
  summary: 'Missing divide by zero check',
  issues: [
    {
      severity: 'high',
      category: 'logic',
      file: 'src/calc.js',
      problem: '8 / 0 returns Infinity',
      required_change: 'Return "Cannot divide by zero"',
    },
  ],
});

const parsedReview = ClaudeReviewSchema.parse(JSON.parse(rawReview));
assert.strictEqual(parsedReview.decision, 'CHANGES_REQUESTED');
assert.strictEqual(parsedReview.issues[0].severity, 'high');
console.log('✔ Claude Review schema validation passed');

// Test 3: Codex Conformance schema
const rawConformance = JSON.stringify({
  decision: 'CONFORMANT',
  summary: 'All requirements met',
  missing_items: [],
  deviations: [],
  remaining_risks: [],
});

const parsedConformance = CodexConformanceSchema.parse(JSON.parse(rawConformance));
assert.strictEqual(parsedConformance.decision, 'CONFORMANT');
console.log('✔ Codex Conformance schema validation passed');

console.log('All Schema unit tests PASSED! 🎉');
