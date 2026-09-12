import * as fs from 'fs';
import * as path from 'path';
import { WorkflowController } from '../orchestrator/workflow.js';
import { CodexPlan } from '../protocol/schemas.js';

async function runReviewStage() {
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

  // Fast forward state machine to PLAN_READY -> IMPLEMENTING -> TESTING
  const sm = workflow.getStateMachine();
  sm.transition('REQUEST_RECEIVED');
  sm.transition('PLANNING');
  sm.transition('PLAN_READY');
  sm.transition('IMPLEMENTING');
  sm.transition('TESTING');

  const plan: CodexPlan = JSON.parse(
    fs.readFileSync(path.join(workflow.getRunDir(), 'plan.json'), 'utf8')
  );

  const testResults = `✓ src/calculator.test.js (6 tests) 2ms
Test Files: 1 passed (1)
Tests: 6 passed (6)
Build: vite v5.4.21 built in 352ms (exit code 0)`;

  // Load actual source files for Claude inspection
  const keyFiles: Record<string, string> = {
    'package.json': fs.readFileSync(path.join(workspacePath, 'package.json'), 'utf8'),
    'src/calculator.js': fs.readFileSync(path.join(workspacePath, 'src/calculator.js'), 'utf8'),
    'src/calculator.test.js': fs.readFileSync(path.join(workspacePath, 'src/calculator.test.js'), 'utf8'),
    'src/App.jsx': fs.readFileSync(path.join(workspacePath, 'src/App.jsx'), 'utf8'),
    'src/App.css': fs.readFileSync(path.join(workspacePath, 'src/App.css'), 'utf8'),
  };

  const gitDiff = `Files created:
- src/calculator.js (pure arithmetic, zero check returns "Cannot divide by zero")
- src/calculator.test.js (6 unit tests)
- src/App.jsx (semantic controlled form with quick keypad and aria-live output)
- src/App.css (responsive layout, max-width 440px)
- package.json (vite, vitest, react, react-dom)`;

  console.log(`[STAGE 3] Invoking Claude Code CLI for Independent Adversarial Review...`);
  const review = await workflow.runReview(plan, gitDiff, testResults, keyFiles);
  console.log(`[STAGE 3] Claude Review decision: ${review.decision}`);
  console.log(`Summary: ${review.summary}`);
  if (review.issues && review.issues.length > 0) {
    console.log(`Issues found (${review.issues.length}):`);
    review.issues.forEach((iss, i) => console.log(`  ${i + 1}. [${iss.severity}] ${iss.file}: ${iss.problem}`));
  }
}

runReviewStage().catch(err => {
  console.error('Review stage failed:', err);
  process.exit(1);
});
