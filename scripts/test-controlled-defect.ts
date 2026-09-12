import * as fs from 'fs';
import * as path from 'path';
import { WorkflowController } from '../orchestrator/workflow.js';
import { CodexPlan } from '../protocol/schemas.js';

async function runControlledDefectTest() {
  console.log('=== RUNNING TEST 2: CONTROLLED DEFECT DETECTION ===');
  const workspacePath = path.resolve(process.cwd(), 'test-workspace');
  const runId = 'test-2-defect';
  const calcJsPath = path.join(workspacePath, 'src/calculator.js');

  // Backup original calculator.js
  const originalCalcJs = fs.readFileSync(calcJsPath, 'utf8');

  try {
    // Inject deliberate defect: Division by zero returns Infinity instead of 'Cannot divide by zero'
    console.log('[TEST 2] Injecting controlled defect into src/calculator.js (division by zero returns Infinity)...');
    const buggyCalcJs = originalCalcJs.replace(
      /if \(b === 0 \|\| Object\.is\(b, -0\)\) \{\s*return 'Cannot divide by zero';\s*\}/,
      `// DEFECT: Missing division by zero check!\n    return a / b;`
    );
    fs.writeFileSync(calcJsPath, buggyCalcJs, 'utf8');

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

    const plan: CodexPlan = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'runs/run-e2e-001/plan.json'), 'utf8')
    );

    const sm = workflow.getStateMachine();
    sm.transition('REQUEST_RECEIVED');
    sm.transition('PLANNING');
    sm.transition('PLAN_READY');
    sm.transition('IMPLEMENTING');
    sm.transition('TESTING');
    sm.incrementReviewRound();

    const buggyFiles: Record<string, string> = {
      'src/calculator.js': buggyCalcJs,
      'src/App.jsx': fs.readFileSync(path.join(workspacePath, 'src/App.jsx'), 'utf8'),
    };

    const gitDiff = `--- a/src/calculator.js\n+++ b/src/calculator.js\n@@ -25,3 +25,2 @@\n-    if (b === 0 || Object.is(b, -0)) {\n-      return 'Cannot divide by zero';\n-    }\n+    // DEFECT: Missing division by zero check!\n+    return a / b;`;

    const testResults = `Failing test: Division by zero expected "Cannot divide by zero" but received Infinity`;

    console.log('[TEST 2] Invoking Claude Code CLI to review deliberately defective code...');
    const review = await workflow.runReview(plan, gitDiff, testResults, buggyFiles);

    console.log(`[TEST 2] Claude Decision: ${review.decision}`);
    console.log(`[TEST 2] Claude Summary: ${review.summary}`);

    // Assert that Claude caught the defect
    const detectedIssue = review.issues.some(
      (iss) =>
        iss.problem.toLowerCase().includes('divide by zero') ||
        iss.problem.toLowerCase().includes('cannot divide by zero') ||
        iss.file.includes('calculator.js')
    );

    if (review.decision === 'CHANGES_REQUESTED' && detectedIssue) {
      console.log('✅ [TEST 2 PASSED] Claude Code CLI successfully detected the controlled defect and rejected the change!');
      fs.writeFileSync(
        path.join(workflow.getRunDir(), 'test-2-result.json'),
        JSON.stringify({ passed: true, reviewDecision: review.decision, detected: true, review }, null, 2),
        'utf8'
      );
    } else {
      console.error('❌ [TEST 2 FAILED] Claude did not flag the controlled defect as expected.');
      process.exitCode = 1;
    }
  } finally {
    // Restore original file
    console.log('[TEST 2] Restoring original src/calculator.js...');
    fs.writeFileSync(calcJsPath, originalCalcJs, 'utf8');
  }
}

runControlledDefectTest().catch((err) => {
  console.error('[TEST 2 ERROR]', err);
  process.exit(1);
});
