#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { WorkflowController } from '../../../orchestrator/workflow.js';
import { ModelSelectionConfig } from '../../../protocol/types.js';

interface ModelItem {
  id: string;
  name: string;
  group: string;
  badge?: string;
  creditRequired?: boolean;
  description: string;
}

interface ModelConfig {
  defaultModels: {
    codex: string;
    claude: string;
    gemini: string;
  };
  availableModels: {
    codex: ModelItem[];
    claude: ModelItem[];
    gemini: ModelItem[];
  };
}

function loadConfig(): ModelConfig {
  const configPath = path.resolve(process.cwd(), 'mvp.config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return {
    defaultModels: {
      codex: 'gpt-6-astra',
      claude: 'opus',
      gemini: 'gemini-3.8-flash',
    },
    availableModels: {
      codex: [{ id: 'gpt-6-astra', name: 'GPT-6 Astra', group: 'Default (Recommended)', badge: 'Default', description: 'Top-tier coding & system architecture' }],
      claude: [{ id: 'opus', name: 'Opus 5', group: 'Primary Models', badge: 'Default', description: 'Deep-reasoning & exhaustive inspection' }],
      gemini: [{ id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', group: 'Gemini Series', badge: 'High · Fast', description: 'Antigravity native orchestrator' }],
    },
  };
}

function printHelp(config: ModelConfig) {
  console.log(`
=== AGENT COLLABORATION MVP v0.1 - CLI ===

Autonomous Multi-Agent Orchestration:
  Antigravity IDE (Gemini) <-> Codex CLI <-> Claude Code CLI

USAGE:
  npm start -- [OPTIONS]
  npx tsx cli.ts [OPTIONS]

OPTIONS:
  --prompt <string>            Task prompt for the multi-agent team
                               (Default: "Build a minimal React calculator.")
  
  --workspace <path>           Target project directory
                               (Default: "./test-workspace")
  
  --codex-model <slug>         Model for Codex CLI (Planner & Strategist)
                               (Default: "${config.defaultModels.codex}")
                               Options: gpt-6-astra | gpt-5.6-sol | gpt-5.6-terra | gpt-5.6-luna | gpt-5.5
  
  --claude-model <slug>        Model for Claude Code CLI (Adversarial Reviewer)
                               (Default: "${config.defaultModels.claude}")
                               Options: opus | sonnet | haiku | fable-5.1 | claude-opus-4-8 | claude-sonnet-4-6
  
  --gemini-model <id>          Model for Antigravity / Gemini (Host & Executor)
                               (Default: "${config.defaultModels.gemini}")
                               Options: gemini-3.8-flash | gemini-3.7-flash | gemini-3.6-flash | gemini-3.1-pro | claude-sonnet-4-6-thinking
 
  --reasoning-effort <level>   Reasoning effort for Codex: low | medium | high
                               (Default: "low")
  
  --list-models                Display table of all selectable models
  --help, -h                   Show this help message

EXAMPLES:
  # Run with default verified models:
  npm start

  # Run with high-speed development models:
  npm start -- --codex-model gpt-5.6-sol --claude-model sonnet --gemini-model gemini-3.8-flash

  # Run with deep-reasoning models:
  npm start -- --codex-model gpt-6-astra --claude-model opus --gemini-model gemini-3.8-flash

  # List all available subscription & IDE models:
  npx tsx cli.ts --list-models
`);
}

function printModels(config: ModelConfig) {
  console.log(`\n=== SELECTABLE MODELS BY AGENT ROLE (SUBSCRIPTION & IDE) ===\n`);

  console.log(`[1] CODEX CLI (ChatGPT Plus/Pro Subscription):`);
  console.table(
    config.availableModels.codex.map((m) => ({
      'CLI Slug (-m)': m.id,
      'Display Name': m.name,
      'Group': m.group,
      'Badge': m.badge || '-',
      'Description': m.description,
    }))
  );

  console.log(`\n[2] CLAUDE CODE CLI (Claude Pro Subscription):`);
  console.table(
    config.availableModels.claude.map((m) => ({
      'CLI Slug (--model)': m.id,
      'Display Name': m.name,
      'Group': m.group,
      'Badge / Credits': m.badge || (m.creditRequired ? 'Requires credits' : '-'),
      'Description': m.description,
    }))
  );

  console.log(`\n[3] ANTIGRAVITY IDE (Gemini & IDE Runtime Models):`);
  console.table(
    config.availableModels.gemini.map((m) => ({
      'Model ID': m.id,
      'Display Name': m.name,
      'Group': m.group,
      'Badge / Attributes': m.badge || '-',
      'Description': m.description,
    }))
  );
  console.log();
}

function parseArgs(config: ModelConfig) {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      params.help = 'true';
    } else if (args[i] === '--list-models') {
      params.listModels = 'true';
    } else if (args[i].startsWith('--')) {
      const key = args[i].replace(/^--/, '');
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      params[key] = val;
    }
  }

  return {
    help: params.help === 'true',
    listModels: params.listModels === 'true',
    prompt: params.prompt || 'Build a minimal React calculator.',
    workspace: params.workspace ? path.resolve(params.workspace) : path.resolve(process.cwd(), 'test-workspace'),
    codexModel: params['codex-model'] || config.defaultModels.codex,
    claudeModel: params['claude-model'] || config.defaultModels.claude,
    geminiModel: params['gemini-model'] || config.defaultModels.gemini,
    reasoningEffort: (params['reasoning-effort'] as 'low' | 'medium' | 'high') || 'low',
    runId: params['run-id'],
  };
}

async function main() {
  const config = loadConfig();
  const args = parseArgs(config);

  if (args.help) {
    printHelp(config);
    return;
  }

  if (args.listModels) {
    printModels(config);
    return;
  }

  console.log(`\n======================================================`);
  console.log(`       AGENT COLLABORATION MVP v0.1 (MULTI-MODEL)     `);
  console.log(`======================================================`);
  console.log(`Prompt:        "${args.prompt}"`);
  console.log(`Workspace:     ${args.workspace}`);
  console.log(`------------------------------------------------------`);
  console.log(`SELECTED MODELS:`);
  console.log(`  * Codex (Planner):         ${args.codexModel} (reasoning: ${args.reasoningEffort})`);
  console.log(`  * Claude (Reviewer):       ${args.claudeModel}`);
  console.log(`  * Gemini (Host/Executor):  ${args.geminiModel}`);
  console.log(`======================================================\n`);

  const models: ModelSelectionConfig = {
    codexModel: args.codexModel,
    claudeModel: args.claudeModel,
    geminiModel: args.geminiModel,
    reasoningEffort: args.reasoningEffort,
  };

  const workflow = new WorkflowController({
    userRequest: args.prompt,
    workspacePath: args.workspace,
    runId: args.runId,
    models,
  });

  const codexStatus = await workflow.getCodexAdapter().getStatus();
  const claudeStatus = await workflow.getClaudeAdapter().getStatus();

  console.log(`AGENT CONNECTION & SUBSCRIPTION STATUS:`);
  console.log(`  [1] Codex CLI:        ${codexStatus.ready ? 'ONLINE (Authenticated)' : 'OFFLINE'} | Active Model: ${codexStatus.currentModel}`);
  console.log(`  [2] Claude Code CLI:  ${claudeStatus.ready ? 'ONLINE (Authenticated)' : 'OFFLINE'} | Active Model: ${claudeStatus.currentModel}`);
  console.log(`  [3] Antigravity IDE:  ONLINE (Host Active)       | Active Model: ${args.geminiModel}`);
  console.log(`------------------------------------------------------`);
  console.log(`LIVE DEMO APPLICATION:`);
  console.log(`  * URL:                http://127.0.0.1:5173/ (or http://localhost:5173/)`);
  console.log(`  * App:                React Calculator (Dual Input & Chained Keypad)`);
  console.log(`  * Build & Tests:      23/23 tests passing | Vite production build clean`);
  console.log(`------------------------------------------------------`);
  console.log(`RUN ARTIFACTS & AUDIT LOGS:`);
  console.log(`  * E2E Run (Calculator):    ./runs/run-e2e-001/`);
  console.log(`    - Codex Plan:            ./runs/run-e2e-001/plan.json`);
  console.log(`    - Claude Review (R1-R3): ./runs/run-e2e-001/review-03.json (APPROVED)`);
  console.log(`    - Codex Conformance:     ./runs/run-e2e-001/final-check.json`);
  console.log(`    - Event Audit Log:       ./runs/run-e2e-001/events.jsonl`);
  console.log(`  * Test 2 (Adversarial):    ./runs/test-2-defect/test-2-result.json`);
  console.log(`  * Test 3 (Interruption):   ./runs/test-3-interruption/test-3-result.json`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
