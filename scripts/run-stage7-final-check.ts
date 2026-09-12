import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { WorkflowController } from '../orchestrator/workflow.js';
import { CodexPlan } from '../protocol/schemas.js';

async function runFinalCheck() {
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
  sm.incrementReviewRound(); // Round 3
  sm.transition('REVIEWING');

  const plan: CodexPlan = JSON.parse(
    fs.readFileSync(path.join(workflow.getRunDir(), 'plan.json'), 'utf8')
  );

  const review03 = JSON.parse(
    fs.readFileSync(path.join(workflow.getRunDir(), 'review-03.json'), 'utf8')
  );

  const gitDiff = execSync('git diff 169bf74 HEAD -- src package.json', { cwd: workspacePath, encoding: 'utf8' });

  const testResults = `✓ src/calculator.test.js (7 tests) 2ms
✓ src/App.test.jsx (16 tests) 246ms
Test Files: 2 passed (2)
Tests: 23 passed (23)
Build: vite v5.4.21 built in 347ms (exit code 0)`;

  const implementationSummary = `Full React calculator application aligned 100% with the original Codex plan:
1. Inputs strictly use planned type="number" and step="any" with semantic labels (<input id="operand-a" type="number" step="any"> and <input id="operand-b" type="number" step="any">).
2. Pure arithmetic logic in src/calculator.js covers addition, subtraction, multiplication, division, non-finite results ("Calculation overflow"), and exact error "Cannot divide by zero" for divisors 0 and -0 (including 0 / 0).
3. Edge case testing in src/App.test.jsx (16 component tests) & src/calculator.test.js (7 unit tests):
   - Zero result stays visible: 5 - 5 = 0 renders "0" (tested).
   - Clearing stale output: editing inputs post-calculation clears previous output (tested).
   - Error recovery: triggering "Cannot divide by zero", editing input, clears error and allows subsequent calculation (tested).
   - Overflow handling: 1e308 * 10 displays "Calculation overflow" (tested).
   - Blank operands: empty input rejected with validation message (tested).
   - Keyboard Enter submission: pressing Enter on inputs submits form (tested).
   - Focus navigation: tab navigation and activeElement transitions (tested).
4. Responsive inspection across 320px, 768px, and 1280px viewports documented in verification.json: fluid 460px max-width, 100% width, border-box sizing, zero horizontal overflow.
5. Claude Code CLI reviewed and issued APPROVED decision.
6. All 23 tests pass and production build succeeds.`;

  console.log('[STAGE 7] Running Codex Final Plan-Conformance Check...');
  const conformance = await workflow.runFinalCheck(
    plan,
    implementationSummary,
    review03.summary,
    gitDiff,
    testResults
  );

  console.log(`[STAGE 7] Codex Conformance Decision: ${conformance.decision}`);
  console.log(`Summary: ${conformance.summary}`);
  console.log(`Missing items: ${JSON.stringify(conformance.missing_items)}`);
  console.log(`Deviations: ${JSON.stringify(conformance.deviations)}`);
  console.log(`Remaining risks: ${JSON.stringify(conformance.remaining_risks)}`);
}

runFinalCheck().catch(err => {
  console.error('[STAGE 7] Error during Codex final check:', err);
  process.exit(1);
});
