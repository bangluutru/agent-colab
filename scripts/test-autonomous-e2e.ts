import * as path from 'path';
import * as fs from 'fs';
import { WorkflowController } from '../orchestrator/workflow.js';

async function runAutonomousE2E() {
  console.log('======================================================');
  console.log('   FULL AUTONOMOUS END-TO-END ACCEPTANCE TEST');
  console.log('   Task: React Todo Web App');
  console.log('   Agents: Codex (Plan) -> Gemini (Build) -> Claude (Review) -> Codex (Audit)');
  console.log('======================================================\n');

  const runId = `run-todo-${Date.now()}`;
  const workspacePath = path.resolve(process.cwd(), 'workspaces', runId, 'project');

  const userRequest = `Build a simple Todo web app.
Requirements:
- React
- add task
- delete task
- mark completed
- localStorage persistence
- basic responsive UI
- unit tests
- npm run build must succeed`;

  console.log(`[E2E] Run ID: ${runId}`);
  console.log(`[E2E] Fresh Workspace: ${workspacePath}`);
  console.log(`[E2E] Requirement:\n${userRequest}\n`);

  const workflow = new WorkflowController({
    userRequest,
    workspacePath,
    runId,
    models: {
      codexModel: 'gpt-6-astra',
      claudeModel: 'opus',
      geminiModel: 'gemini-3.8-flash',
      reasoningEffort: 'low',
    },
  });

  const startTime = Date.now();
  console.log('⏳ Starting autonomous execution loop (zero manual intervention)...');

  const result = await workflow.runFullWorkflow();
  const durationSec = Math.round((Date.now() - startTime) / 1000);

  console.log('\n------------------------------------------------------');
  console.log(`[E2E] Run completed in ${durationSec}s with status: ${result.status}`);
  console.log('------------------------------------------------------\n');

  // Verify assertions
  const checks = [
    {
      name: 'Status is COMPLETED',
      pass: result.status === 'COMPLETED',
      detail: `Current status: ${result.status}`,
    },
    {
      name: 'Codex Plan exists and valid',
      pass: !!result.plan && (result.plan.acceptance_criteria?.length || 0) > 0,
      detail: `Objective: "${result.plan?.objective || 'None'}"`,
    },
    {
      name: 'Workspace source files exist',
      pass: fs.existsSync(path.join(workspacePath, 'src')) && fs.readdirSync(path.join(workspacePath, 'src')).length > 0,
      detail: `Files: ${fs.existsSync(path.join(workspacePath, 'src')) ? fs.readdirSync(path.join(workspacePath, 'src')).join(', ') : 'None'}`,
    },
    {
      name: 'Claude Code review approved',
      pass: result.reviewApproved === true,
      detail: `Review rounds: ${result.reviewRounds}`,
    },
    {
      name: 'Codex final conformance check passed',
      pass: result.codexConformant === true,
      detail: `Conformant: ${result.codexConformant}`,
    },
    {
      name: 'Automated machine verification passed (tests & build)',
      pass: result.verificationPassed === true,
      detail: `Verification passed: ${result.verificationPassed}`,
    },
  ];

  console.table(checks);

  const allPassed = checks.every(c => c.pass);
  if (allPassed) {
    console.log('\n🎉 ALL ACCEPTANCE CRITERIA PASSED! The MVP is truly autonomous!');
    process.exit(0);
  } else {
    console.error('\n❌ E2E TEST FAILED: One or more acceptance criteria failed.');
    if (result.error) console.error('Error detail:', result.error);
    process.exit(1);
  }
}

runAutonomousE2E().catch((err) => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
