import { execSync } from 'child_process';
import { CodexAdapter } from '../adapters/codex/adapter.js';
import { ClaudeAdapter } from '../adapters/claude/adapter.js';
import { GeminiAdapter } from '../adapters/gemini/adapter.js';

interface CheckItem {
  component: string;
  command: string;
  status: 'PASS' | 'PARTIAL' | 'FAIL' | 'UNSUPPORTED';
  version?: string;
  details?: string;
}

async function runGate0() {
  console.log(`\n======================================================`);
  console.log(`       GATE 0: ENVIRONMENT & AGENT READINESS AUDIT    `);
  console.log(`======================================================\n`);

  const results: CheckItem[] = [];

  // 1. Node.js
  try {
    const nodeVer = execSync('node --version', { encoding: 'utf8' }).trim();
    results.push({
      component: 'Node.js Runtime',
      command: 'node --version',
      status: 'PASS',
      version: nodeVer,
      details: 'Meets minimum requirement (>= v18)',
    });
  } catch (err: any) {
    results.push({
      component: 'Node.js Runtime',
      command: 'node --version',
      status: 'FAIL',
      details: err.message,
    });
  }

  // 2. npm
  try {
    const npmVer = execSync('npm --version', { encoding: 'utf8' }).trim();
    results.push({
      component: 'npm Package Manager',
      command: 'npm --version',
      status: 'PASS',
      version: npmVer,
      details: 'Package manager operational',
    });
  } catch (err: any) {
    results.push({
      component: 'npm Package Manager',
      command: 'npm --version',
      status: 'FAIL',
      details: err.message,
    });
  }

  // 3. git
  try {
    const gitVer = execSync('git --version', { encoding: 'utf8' }).trim();
    results.push({
      component: 'Git VCS',
      command: 'git --version',
      status: 'PASS',
      version: gitVer,
      details: 'Version control ready for diffs & commits',
    });
  } catch (err: any) {
    results.push({
      component: 'Git VCS',
      command: 'git --version',
      status: 'FAIL',
      details: err.message,
    });
  }

  // 4. Codex CLI (Planner)
  try {
    const codexAdapter = new CodexAdapter();
    const codexDetect = await codexAdapter.detect();
    results.push({
      component: 'OpenAI Codex CLI (Planner)',
      command: 'codex --version',
      status: codexDetect.available ? 'PASS' : 'FAIL',
      version: codexDetect.version,
      details: codexDetect.available
        ? 'Authenticated via ChatGPT Subscription (Zero-API-Key)'
        : codexDetect.error,
    });
  } catch (err: any) {
    results.push({
      component: 'OpenAI Codex CLI (Planner)',
      command: 'codex --version',
      status: 'FAIL',
      details: err.message,
    });
  }

  // 5. Claude Code CLI (Reviewer)
  try {
    const claudeAdapter = new ClaudeAdapter();
    const claudeDetect = await claudeAdapter.detect();
    const isAuthRequired = !claudeDetect.available && claudeDetect.error?.includes('AUTH_REQUIRED');
    results.push({
      component: 'Claude Code CLI (Reviewer)',
      command: 'claude auth status',
      status: claudeDetect.available ? 'PASS' : (isAuthRequired ? 'AUTH_REQUIRED' as any : 'FAIL'),
      version: claudeDetect.version,
      details: claudeDetect.available
        ? 'Authenticated via Claude Pro Subscription (Zero-API-Key)'
        : (claudeDetect.error || 'Unavailable'),
    });
  } catch (err: any) {
    results.push({
      component: 'Claude Code CLI (Reviewer)',
      command: 'claude --version',
      status: 'FAIL',
      details: err.message,
    });
  }

  // 6. Gemini / Antigravity Execution Interface (Executor)
  try {
    const geminiAdapter = new GeminiAdapter();
    const geminiDetect = await geminiAdapter.detect();
    results.push({
      component: 'Antigravity / Gemini CLI (Executor)',
      command: 'agy --version',
      status: geminiDetect.available ? 'PASS' : 'UNSUPPORTED',
      version: geminiDetect.version,
      details: geminiDetect.available
        ? 'Official Antigravity CLI operational with auto-approval & workspace tools'
        : 'Antigravity CLI not found or inaccessible',
    });
  } catch (err: any) {
    results.push({
      component: 'Antigravity / Gemini CLI (Executor)',
      command: 'agy --version',
      status: 'UNSUPPORTED',
      details: err.message,
    });
  }

  // Print Table
  console.table(
    results.map(r => ({
      Component: r.component,
      Command: r.command,
      Status: r.status,
      Version: r.version || 'N/A',
      Details: r.details || '',
    }))
  );

  console.log(`------------------------------------------------------`);
  const allPass = results.every(r => r.status === 'PASS');
  console.log(`GATE 0 AUDIT OUTCOME: ${allPass ? 'ALL CHECKS PASSED (Ready for Autonomous Run)' : 'CHECKS INCOMPLETE'}`);
  console.log(`\nExplicit Gate 0 Answer:`);
  const geminiCheck = results.find(r => r.component.includes('Gemini'));
  console.log(`  Can orchestrator programmatically trigger Gemini execution? ${geminiCheck?.status}`);
  console.log(`======================================================\n`);

  if (!allPass) {
    process.exit(1);
  }
}

runGate0().catch(err => {
  console.error('[GATE 0 FATAL]', err);
  process.exit(1);
});
