import assert from 'node:assert';
import { ClaudeParser } from '../adapters/claude/parser.js';
import { ClaudeReviewSchema } from '../protocol/schemas.js';

console.log('--- Testing Codex Reviewer Fallback & Parser ---');

// Test 1: Codex output formatted as valid JSON review
const codexReviewJson = JSON.stringify({
  decision: 'APPROVED',
  summary: 'Codex fallback reviewer: All acceptance criteria and edge cases verified successfully.',
  issues: [],
});

const parse1 = ClaudeParser.parseReview(codexReviewJson);
assert.strictEqual(parse1.success, true);
if (parse1.success) {
  assert.strictEqual(parse1.data.decision, 'APPROVED');
  assert.strictEqual(parse1.data.issues.length, 0);
  console.log('✔ Codex review APPROVED parsing passed');
}

// Test 2: Codex output requesting changes
const codexChangesJson = JSON.stringify({
  decision: 'CHANGES_REQUESTED',
  summary: 'Codex fallback reviewer: Found 1 missing edge case.',
  issues: [
    {
      severity: 'high',
      category: 'requirement',
      file: 'src/App.jsx',
      problem: 'Enter key does not submit task',
      required_change: 'Add onKeyDown handler for Enter key',
    },
  ],
});

const parse2 = ClaudeParser.parseReview(codexChangesJson);
assert.strictEqual(parse2.success, true);
if (parse2.success) {
  assert.strictEqual(parse2.data.decision, 'CHANGES_REQUESTED');
  assert.strictEqual(parse2.data.issues[0].file, 'src/App.jsx');
  console.log('✔ Codex review CHANGES_REQUESTED parsing passed');
}

// Test 3: Markdown-wrapped Codex response
const codexMarkdownResponse = `I have audited the code as requested. Here is my adversarial review:

\`\`\`json
{
  "decision": "APPROVED",
  "summary": "100% compliant with plan and tests.",
  "issues": []
}
\`\`\`
All tests pass.`;

const parse3 = ClaudeParser.parseReview(codexMarkdownResponse);
assert.strictEqual(parse3.success, true);
if (parse3.success) {
  assert.strictEqual(parse3.data.decision, 'APPROVED');
  console.log('✔ Markdown-wrapped review extraction passed');
}

console.log('All Reviewer Fallback tests PASSED! 🎉');
