import * as fs from 'fs';
import * as path from 'path';
import { WorkflowController } from '../orchestrator/workflow.js';
import { CodexPlan } from '../protocol/schemas.js';

async function runReReviewStage() {
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
  // We are at Round 2
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

  const plan: CodexPlan = JSON.parse(
    fs.readFileSync(path.join(workflow.getRunDir(), 'plan.json'), 'utf8')
  );

  const testResults = `✓ src/calculator.test.js (7 tests) 3ms
✓ src/App.test.jsx (8 tests) 177ms
Test Files: 2 passed (2)
Tests: 15 passed (15)
Build: vite v5.4.21 built in 468ms (exit code 0)`;

  const keyFiles: Record<string, string> = {
    'package.json': fs.readFileSync(path.join(workspacePath, 'package.json'), 'utf8'),
    'src/calculator.js': fs.readFileSync(path.join(workspacePath, 'src/calculator.js'), 'utf8'),
    'src/calculator.test.js': fs.readFileSync(path.join(workspacePath, 'src/calculator.test.js'), 'utf8'),
    'src/App.jsx': fs.readFileSync(path.join(workspacePath, 'src/App.jsx'), 'utf8'),
    'src/App.test.jsx': fs.readFileSync(path.join(workspacePath, 'src/App.test.jsx'), 'utf8'),
  };

  const gitDiff = `CHANGES IN RESPONSE TO CLAUDE REVIEW ROUND 1:
1. Created src/App.test.jsx with 8 component tests covering arithmetic, exact division by zero, empty inputs, clear, labels, and submission.
2. Installed @testing-library/react, @testing-library/jest-dom, and jsdom in package.json and vite.config.js.
3. Updated src/calculator.js to guard against overflow on all operations (returns "Calculation overflow") while preserving exact "Cannot divide by zero" for actual zero divisors.
4. Updated src/App.jsx with activeTarget tracking and removed dead code.`;

  console.log(`[STAGE 5] Invoking Claude Code CLI for Round 2 Re-Review...`);
  const review = await workflow.runReview(plan, gitDiff, testResults, keyFiles);
  console.log(`[STAGE 5] Claude Review decision: ${review.decision}`);
  console.log(`Summary: ${review.summary}`);
  if (review.issues && review.issues.length > 0) {
    console.log(`Issues remaining: ${review.issues.length}`);
    review.issues.forEach((iss, i) => console.log(`  ${i + 1}. [${iss.severity}] ${iss.file}: ${iss.problem}`));
  }
}

runReReviewStage().catch(err => {
  console.error('Re-review stage failed:', err);
  process.exit(1);
});
