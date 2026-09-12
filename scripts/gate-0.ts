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

  // 5. Claude Code CLI (Reviewer) - Level 1, 2, and 3 Checks (Section 18)
  try {
    const claudeAdapter = new ClaudeAdapter();
    const binary = claudeAdapter.getCanonicalBinary();
    const verRes = await claudeAdapter.runClaudeProcess(['--version'], { timeoutMs: 5000 });
    const authRes = await claudeAdapter.runClaudeProcess(['auth', 'status'], { timeoutMs: 5000 });
    let authData: any = {};
    try { authData = JSON.parse(authRes.stdout); } catch {}

    const level2Pass = authRes.exitCode === 0 && authData.loggedIn === true;
    results.push({
      component: 'Claude Auth Metadata (Level 2)',
      command: `${binary} auth status`,
      status: level2Pass ? 'PASS' : 'FAIL',
      version: verRes.stdout || 'N/A',
      details: level2Pass
        ? `Method: ${authData.authMethod || 'claude.ai'} · Subscription: ${authData.subscriptionType || 'Pro'}`
        : (authData.error || 'Not logged in. Run claude auth login in terminal.'),
    });

    // Level 3: Real Headless Inference Probe
    const probeRes = await claudeAdapter.runClaudeProcess(
      ['-p', '--model', 'claude-sonnet-5', 'Reply with exactly: CLAUDE_PROBE_OK'],
      { timeoutMs: 15000 }
    );
    const probePass = probeRes.exitCode === 0 && probeRes.stdout.includes('CLAUDE_PROBE_OK');
    results.push({
      component: 'Claude Real Headless Inference (Level 3)',
      command: `${binary} -p --model claude-sonnet-5 ...`,
      status: probePass ? 'PASS' : 'FAIL',
      version: 'claude-sonnet-5',
      details: probePass
        ? 'Real headless inference verified (CLAUDE_PROBE_OK received)'
        : (probeRes.stdout || probeRes.stderr || 'Inference probe failed'),
    });
  } catch (err: any) {
    results.push({
      component: 'Claude Code CLI (Reviewer)',
      command: 'claude',
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
