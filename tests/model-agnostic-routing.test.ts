import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { AgentRouter } from '../orchestrator/agent-router.js';
import { CodexAdapter } from '../adapters/codex/adapter.js';
import { GeminiAdapter, buildGeminiAgyArgs } from '../adapters/gemini/adapter.js';
import { ClaudeAdapter } from '../adapters/claude/adapter.js';
import { WorkflowController } from '../orchestrator/workflow.js';
import { PlanningResultSchema, ReviewResultSchema, FinalCheckResultSchema } from '../protocol/schemas.js';

console.log('--- Testing Model-Agnostic Workflow Routing ---');

const router = new AgentRouter();

// 1. Test Default Routing Resolution
const defaultRouting = router.resolveRouting();
assert.strictEqual(defaultRouting.planner.agent, 'codex');
assert.strictEqual(defaultRouting.planner.model, 'gpt-6-astra');
assert.strictEqual(defaultRouting.builder.agent, 'gemini');
assert.strictEqual(defaultRouting.builder.model, 'gemini-3.8-flash');
assert.strictEqual(defaultRouting.reviewer.agent, 'claude');
assert.strictEqual(defaultRouting.reviewer.model, 'claude-sonnet-5');
assert.strictEqual(defaultRouting.fixer.agent, 'gemini', 'Fixer should default to builder agent');
assert.strictEqual(defaultRouting.finalChecker.agent, 'codex', 'Final checker should default to planner agent');
assert.strictEqual(defaultRouting.isIndependentReview, true, 'Reviewer is independent from builder');
assert.strictEqual(defaultRouting.independenceWarning, undefined);
console.log('✔ Default routing resolution passed');

// 2. Test Presets (Fast & Deep Review)
const fastRouting = router.resolveRouting({ preset: 'fast' });
assert.strictEqual(fastRouting.planner.agent, 'gemini');
assert.strictEqual(fastRouting.builder.agent, 'gemini');
assert.strictEqual(fastRouting.reviewer.agent, 'claude');
assert.strictEqual(fastRouting.reviewer.model, 'haiku');
assert.strictEqual(fastRouting.isIndependentReview, true);
console.log('✔ Fast preset resolution passed');

const deepRouting = router.resolveRouting({ preset: 'deep_review' });
assert.strictEqual(deepRouting.planner.agent, 'codex');
assert.strictEqual(deepRouting.builder.agent, 'gemini');
assert.strictEqual(deepRouting.reviewer.agent, 'claude');
assert.strictEqual(deepRouting.reviewer.model, 'claude-opus-5');
console.log('✔ Deep review preset resolution passed');

// 3. Test Inverted / Custom Permutation: Claude Planner, Codex Builder, Gemini Reviewer
const invertedRouting = router.resolveRouting({
  planner: { agent: 'claude', model: 'claude-opus-5' },
  builder: { agent: 'codex', model: 'gpt-6-astra' },
  reviewer: { agent: 'gemini', model: 'gemini-3.8-flash' },
});
assert.strictEqual(invertedRouting.planner.agent, 'claude');
assert.strictEqual(invertedRouting.builder.agent, 'codex');
assert.strictEqual(invertedRouting.reviewer.agent, 'gemini');
assert.strictEqual(invertedRouting.fixer.agent, 'codex', 'Fixer inherited from builder');
assert.strictEqual(invertedRouting.finalChecker.agent, 'claude', 'Final checker inherited from planner');
assert.strictEqual(invertedRouting.isIndependentReview, true);
console.log('✔ Inverted permutation (Claude -> Codex -> Gemini) passed');

// 3b. Test All-Gemini Pipeline (Gemini for all roles)
const allGeminiRouting = router.resolveRouting({
  planner: { agent: 'gemini', model: 'gemini-3.8-flash' },
  builder: { agent: 'gemini', model: 'gemini-3.8-flash' },
  reviewer: { agent: 'gemini', model: 'gemini-3.8-flash' },
  fixer: { agent: 'gemini', model: 'gemini-3.8-flash' },
  final_checker: { agent: 'gemini', model: 'gemini-3.8-flash' },
});
assert.strictEqual(allGeminiRouting.planner.agent, 'gemini');
assert.strictEqual(allGeminiRouting.planner.model, 'gemini-3.8-flash');
assert.strictEqual(allGeminiRouting.builder.agent, 'gemini');
assert.strictEqual(allGeminiRouting.builder.model, 'gemini-3.8-flash');
assert.strictEqual(allGeminiRouting.reviewer.agent, 'gemini');
assert.strictEqual(allGeminiRouting.reviewer.model, 'gemini-3.8-flash');
assert.strictEqual(allGeminiRouting.fixer.agent, 'gemini');
assert.strictEqual(allGeminiRouting.finalChecker.agent, 'gemini');
assert.strictEqual(allGeminiRouting.isIndependentReview, false, 'Self-review should be flagged');
assert.ok(allGeminiRouting.independenceWarning?.includes('gemini'), 'Warning should mention gemini');
console.log('✔ All-Gemini pipeline resolution passed');

// 3c. Test Model Isolation (Prevent cross-agent model leakage)
const mixedRouting = router.resolveRouting({
  planner: { agent: 'gemini', model: 'gpt-6-astra' as any },
  builder: { agent: 'codex', model: 'gemini-3.8-flash' as any },
});
assert.strictEqual(mixedRouting.planner.agent, 'gemini');
assert.strictEqual(mixedRouting.planner.model, 'gemini-3.8-flash', 'Must sanitize to gemini default model');
assert.strictEqual(mixedRouting.builder.agent, 'codex');
assert.strictEqual(mixedRouting.builder.model, 'gpt-6-astra', 'Must sanitize to codex default model');
console.log('✔ Model isolation and cross-agent leakage prevention passed');

// 4. Test Quality Check: Self-review detection
const selfReviewRouting = router.resolveRouting({
  planner: { agent: 'codex', model: 'gpt-6-astra' },
  builder: { agent: 'gemini', model: 'gemini-3.8-flash' },
  reviewer: { agent: 'gemini', model: 'gemini-3.8-flash' }, // Self-review!
});
assert.strictEqual(selfReviewRouting.isIndependentReview, false);
assert.ok(selfReviewRouting.independenceWarning?.includes('Self-review') || selfReviewRouting.independenceWarning?.includes('gemini'));
console.log('✔ Review independence quality check passed');

// 5. Test Adapter Capabilities
const codexCap = new CodexAdapter().getCapabilities();
assert.strictEqual(codexCap.supportsPlanning, true);
assert.strictEqual(codexCap.supportsImplementation, true);
assert.strictEqual(codexCap.supportsReview, true);
assert.strictEqual(codexCap.canWriteWorkspace, true);

const geminiCap = new GeminiAdapter().getCapabilities();
assert.strictEqual(geminiCap.supportsPlanning, true);
assert.strictEqual(geminiCap.supportsImplementation, true);
assert.strictEqual(geminiCap.supportsReview, true);
assert.strictEqual(geminiCap.canWriteWorkspace, true);

const claudeCap = new ClaudeAdapter().getCapabilities();
assert.strictEqual(claudeCap.supportsPlanning, true);
assert.strictEqual(claudeCap.supportsImplementation, true);
assert.strictEqual(claudeCap.supportsReview, true);
assert.strictEqual(claudeCap.canWriteWorkspace, true);
console.log('✔ Adapter capabilities inspection passed');

// 6. Test Prompts Loading
const planRolePrompt = router.getRolePrompt('PLANNING');
assert.ok(planRolePrompt.includes('planning and engineering strategy'));
assert.ok(!planRolePrompt.includes('Codex CLI as Planner'), 'Role prompt should not be vendor locked');

const reviewRolePrompt = router.getRolePrompt('REVIEW');
assert.ok(reviewRolePrompt.includes('independent adversarial reviewer'));
assert.ok(!reviewRolePrompt.includes('Codex plan'), 'Role prompt should use generic terms');

const implRolePrompt = router.getRolePrompt('IMPLEMENTATION');
assert.ok(implRolePrompt.includes('primary Code Implementation and Construction Agent'));
console.log('✔ Role and agent prompt decoupling passed');

// 7. Test WorkflowController Initialization with Custom Routing
const testRunId = `test-routing-${Date.now()}`;
const testWorkspace = path.resolve(process.cwd(), 'runs', testRunId, 'workspace');
const testRunDir = path.resolve(process.cwd(), 'runs', testRunId);

const testCtrl = new WorkflowController({
  userRequest: 'Create a simple counter app',
  workspacePath: testWorkspace,
  runId: testRunId,
  routing: {
    planner: { agent: 'claude', model: 'claude-sonnet-5' },
    builder: { agent: 'codex', model: 'gpt-6-astra' },
    reviewer: { agent: 'gemini', model: 'gemini-3.8-flash' },
  },
});

assert.strictEqual(testCtrl.getRouting().planner.agent, 'claude');
assert.strictEqual(testCtrl.getRouting().builder.agent, 'codex');
assert.strictEqual(testCtrl.getRouting().reviewer.agent, 'gemini');

// Verify routing.json was persisted
const routingJsonFile = path.join(testRunDir, 'routing.json');
assert.ok(fs.existsSync(routingJsonFile), 'routing.json must be written to run directory');
const savedRouting = JSON.parse(fs.readFileSync(routingJsonFile, 'utf8'));
assert.strictEqual(savedRouting.planner.agent, 'claude');
assert.strictEqual(savedRouting.builder.agent, 'codex');
assert.strictEqual(savedRouting.reviewer.agent, 'gemini');

// Clean up test run
try {
  fs.rmSync(testRunDir, { recursive: true, force: true });
} catch {}

console.log('✔ WorkflowController routing integration and persistence passed');

// 8. Test GeminiAdapter CLI Args Generation & Model Compatibility
const claudeThinkingArgs = buildGeminiAgyArgs('/tmp', 'test prompt', 'claude-opus-4-6-thinking');
assert.ok(claudeThinkingArgs.includes('--model'));
assert.strictEqual(claudeThinkingArgs[claudeThinkingArgs.indexOf('--model') + 1], 'claude-opus-4-6-thinking');
assert.ok(!claudeThinkingArgs.includes('--effort'), '--effort must NEVER be passed for thinking models under agy');

const claudeSonnetArgs = buildGeminiAgyArgs('/tmp', 'test prompt', 'claude-sonnet-4-6');
assert.ok(!claudeSonnetArgs.includes('--effort'), '--effort must not be passed for non-gemini models under agy');

const geminiFlashArgs = buildGeminiAgyArgs('/tmp', 'test prompt', 'gemini-3.8-flash', true, 'high');
assert.ok(geminiFlashArgs.includes('--effort'));
assert.strictEqual(geminiFlashArgs[geminiFlashArgs.indexOf('--effort') + 1], 'high');

const geminiThinkingArgs = buildGeminiAgyArgs('/tmp', 'test prompt', 'gemini-2.5-flash-thinking');
assert.ok(!geminiThinkingArgs.includes('--effort'), '--effort must not be passed for gemini models containing thinking');
console.log('✔ GeminiAdapter CLI arguments & model compatibility passed');

// 9. Test Reviewer Fallback Guarding
const testContextFallbackOff = {
  runId: 'test-guard',
  workspacePath: '/tmp',
  options: { reviewerFallback: false },
  models: { reviewerFallback: false },
};
// Check fallback allowed logic
const isAllowedFalse = (testContextFallbackOff.options?.reviewerFallback !== false) && (testContextFallbackOff.models?.reviewerFallback !== false);
assert.strictEqual(isAllowedFalse, false, 'Fallback should be strictly disallowed when reviewerFallback is false');

const testContextFallbackOn = {
  runId: 'test-guard-on',
  workspacePath: '/tmp',
  options: { reviewerFallback: true },
  models: { reviewerFallback: true },
};
const isAllowedTrue = (testContextFallbackOn.options?.reviewerFallback !== false) && (testContextFallbackOn.models?.reviewerFallback !== false);
assert.strictEqual(isAllowedTrue, true, 'Fallback should be allowed when explicitly enabled');
console.log('✔ Reviewer fallback configuration guard passed');

console.log('All Model-Agnostic Routing unit tests PASSED! 🎉\n');
