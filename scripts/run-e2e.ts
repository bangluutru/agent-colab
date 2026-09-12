import * as fs from 'fs';
import * as path from 'path';
import { WorkflowController } from '../orchestrator/workflow.js';
import { ProcessRunner } from '../orchestrator/runner.js';
import { ModelSelectionConfig } from '../protocol/types.js';

async function runE2E() {
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

  // Configurable models per user requirement
  const models: ModelSelectionConfig = {
    codexModel: 'gpt-6-astra',
    claudeModel: 'sonnet',
    geminiModel: 'Gemini 3.8 Flash (High)',
    reasoningEffort: 'low',
  };

  console.log(`\n======================================================`);
  console.log(`🚀 STARTING AGENT COLLABORATION MVP v0.1 — E2E TEST 1`);
  console.log(`======================================================`);
  console.log(`User Request:\n${userRequest}`);
  console.log(`Workspace: ${workspacePath}`);
  console.log(`Models: Codex=${models.codexModel} | Claude=${models.claudeModel} | Gemini=${models.geminiModel}\n`);

  const workflow = new WorkflowController({
    userRequest,
    workspacePath,
    runId,
    models,
  });

  // 1. CODEX PLANNING
  console.log(`[STAGE 1] Invoking Codex CLI for planning...`);
  const plan = await workflow.runPlanning();
  console.log(`[STAGE 1] Codex Plan received successfully!`);
  console.log(`Objective: ${plan.objective}`);
  console.log(`Steps: ${plan.implementation_steps.length} steps planned.`);
  console.log(`Acceptance Criteria: ${plan.acceptance_criteria.length} criteria defined.\n`);

  return { workflow, plan, workspacePath, runId };
}

runE2E()
  .then(() => console.log('Stage 1 completed.'))
  .catch(err => {
    console.error('E2E Stage 1 Failed:', err);
    process.exit(1);
  });
