import * as fs from 'fs';
import * as path from 'path';
import { WorkflowController } from '../orchestrator/workflow.js';
import { CodexPlan } from '../protocol/schemas.js';

async function runRound3Review() {
  const userRequest = `Build a minimal React calculator.
Requirements:
- addition
- subtraction
- multiplication
- division
- division by zero must display exactly: "Cannot divide by zero"
- responsive basic UI
- unit tests
- npm run build must succeed`;

  const workspacePath = path.resolve(process.cwd(), 'test-workspace');
  const runId = 'run-e2e-001';

  const workflow = new WorkflowController({
    userRequest,
    workspacePath,
    runId,
    models: {
      codexModel: 'gpt-6-astra',
      claudeModel: 'sonnet',
      geminiModel: 'Gemini 3.8 Flash (High)',
    },
  });

  const sm = workflow.getStateMachine();
  sm.transition('REQUEST_RECEIVED');
  sm.transition('PLANNING');
  sm.transition('PLAN_READY');
  sm.transition('IMPLEMENTING');
  sm.transition('TESTING');
  sm.incrementReviewRound(); // Round 1
  sm.transition('REVIEWING');
  sm.transition('CHANGES_REQUESTED');
  sm.transition('FIXING');
  sm.transition('TESTING');
  sm.incrementReviewRound(); // Round 2
  sm.transition('REVIEWING');
  sm.transition('CHANGES_REQUESTED');
  sm.transition('FIXING');
  sm.transition('TESTING');

  const plan: CodexPlan = JSON.parse(
    fs.readFileSync(path.join(workflow.getRunDir(), 'plan.json'), 'utf8')
  );

  const testResults = `✓ src/calculator.test.js (7 tests) 2ms
✓ src/App.test.jsx (12 tests) 210ms
Test Files: 2 passed (2)
Tests: 19 passed (19)
Build: vite v5.4.21 built in 364ms (exit code 0)`;

  const keyFiles: Record<string, string> = {
    'package.json': fs.readFileSync(path.join(workspacePath, 'package.json'), 'utf8'),
    'src/calculator.js': fs.readFileSync(path.join(workspacePath, 'src/calculator.js'), 'utf8'),
    'src/calculator.test.js': fs.readFileSync(path.join(workspacePath, 'src/calculator.test.js'), 'utf8'),
    'src/App.jsx': fs.readFileSync(path.join(workspacePath, 'src/App.jsx'), 'utf8'),
    'src/App.test.jsx': fs.readFileSync(path.join(workspacePath, 'src/App.test.jsx'), 'utf8'),
  };

  const gitDiff = `CHANGES IN RESPONSE TO CLAUDE REVIEW ROUND 2:
1. In onKeypadClick (src/App.jsx): When pressing an operator (+, -, *, /) after a result exists, the previous result is promoted to operandA and operandB is cleared (String(result) -> operandA, '' -> operandB). Tested chained operations (e.g. 5 / 2 = 2.5, then * 4 = 10).
2. Added test for zero-result visibility in src/App.test.jsx: asserts 5 - 5 = 0 displays '0' visibly.
3. Added test for stale output clearing in src/App.test.jsx: editing operandA post-result clears output and allows subsequent valid calculation.
4. Added test for keyboard submission in src/App.test.jsx: verifies form submission via Enter key.
5. Streamlined validation in src/App.jsx using Number.isFinite check.
All 19 tests in 2 test suites pass. Build succeeds.`;

  console.log(`[STAGE 6] Invoking Claude Code CLI for Round 3 Re-Review...`);
  const review = await workflow.runReview(plan, gitDiff, testResults, keyFiles);
  console.log(`[STAGE 6] Claude Review decision: ${review.decision}`);
  console.log(`Summary: ${review.summary}`);
  if (review.issues && review.issues.length > 0) {
    console.log(`Issues remaining: ${review.issues.length}`);
    review.issues.forEach((iss, i) => console.log(`  ${i + 1}. [${iss.severity}] ${iss.file}: ${iss.problem}`));
  }
}

runRound3Review().catch(err => {
  console.error('Round 3 review failed:', err);
  process.exit(1);
});
