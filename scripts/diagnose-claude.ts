import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface DiagnosticReport {
  timestamp: string;
  process: {
    user: string;
    cwd: string;
    home: string;
    userName: string;
    logName: string;
    shell: string;
  };
  environmentFlags: Record<string, string>;
  claudeBinaries: string[];
  canonicalBinary: string;
  version: string;
  authStatus: any;
  inferenceProbe: {
    status: 'PASS' | 'FAIL';
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
    error?: string;
  };
  classification: 'CASE_A' | 'CASE_B' | 'CASE_C' | 'CASE_D' | 'READY';
  recommendations: string[];
}

export function buildClaudeEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  // Never allow API billing
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  // Prevent unrelated cloud providers
  delete env.ANTHROPIC_BASE_URL;
  delete env.CLAUDE_CODE_USE_BEDROCK;
  delete env.CLAUDE_CODE_USE_VERTEX;
  delete env.CLAUDE_CODE_USE_FOUNDRY;
  // We want the normal local Claude.ai login, not a stale automation token
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  // Clean other API keys to guarantee zero leakage
  delete env.OPENAI_API_KEY;
  delete env.GOOGLE_API_KEY;

  // Inspect CLAUDE_CONFIG_DIR: remove if unexpected
  if (env.CLAUDE_CONFIG_DIR && !env.CLAUDE_CONFIG_DIR.includes('.claude')) {
    delete env.CLAUDE_CONFIG_DIR;
  }

  return env;
}

export function resolveCanonicalClaudeBinary(): string {
  try {
    const raw = execSync('which -a claude', { encoding: 'utf8' }).trim();
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      // Prioritize ~/.local/bin/claude if present
      const preferred = lines.find((p) => p.includes('.local/bin/claude')) || lines[0];
      return preferred;
    }
  } catch {}
  return 'claude';
}

function runCommand(
  bin: string,
  args: string[],
  timeoutMs: number = 30000,
  customEnv?: NodeJS.ProcessEnv
): Promise<{ exitCode: number; stdout: string; stderr: string; durationMs: number }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    const child = spawn(bin, args, {
      env: customEnv || buildClaudeEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let timer: NodeJS.Timeout | null = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 1000);
      }, timeoutMs);
    }

    child.stdout?.on('data', (c) => {
      stdout += c.toString();
    });
    child.stderr?.on('data', (c) => {
      stderr += c.toString();
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: code ?? -1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        durationMs: Date.now() - startTime,
      });
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: -1,
        stdout,
        stderr: stderr + '\n' + err.message,
        durationMs: Date.now() - startTime,
      });
    });
  });
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`      CLAUDE CODE SUBSCRIPTION DIAGNOSTIC SUITE       `);
  console.log(`======================================================\n`);

  // 1. Process Metadata
  const procInfo = {
    user: process.env.USER || 'unknown',
    cwd: process.cwd(),
    home: process.env.HOME || 'unknown',
    userName: process.env.LOGNAME || process.env.USER || 'unknown',
    logName: process.env.LOGNAME || 'unknown',
    shell: process.env.SHELL || 'unknown',
  };

  console.log(`[PROCESS ENVIRONMENT]`);
  console.log(`  User:        ${procInfo.user}`);
  console.log(`  HOME:        ${procInfo.home}`);
  console.log(`  CWD:         ${procInfo.cwd}`);
  console.log(`  SHELL:       ${procInfo.shell}`);

  // 2. Sensitive Env Flags (Presence Only: SET / NOT SET)
  const envKeys = [
    'CLAUDE_CONFIG_DIR',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL',
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX',
    'CLAUDE_CODE_USE_FOUNDRY',
  ];

  const envFlags: Record<string, string> = {};
  console.log(`\n[SECURITY & AUTH FLAGS]`);
  for (const k of envKeys) {
    const isSet = process.env[k] !== undefined && process.env[k] !== '';
    envFlags[k] = isSet ? 'SET' : 'NOT SET';
    console.log(`  ${k.padEnd(26)}: ${envFlags[k]}`);
  }

  // 3. Binary Discovery
  let binaries: string[] = [];
  try {
    const raw = execSync('which -a claude', { encoding: 'utf8' }).trim();
    binaries = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {}
  const canonical = resolveCanonicalClaudeBinary();

  console.log(`\n[BINARY RESOLUTION]`);
  console.log(`  Detected Binaries:      ${binaries.join(', ') || 'NONE'}`);
  console.log(`  Canonical Binary:       ${canonical}`);

  // Level 1: Version Check
  const verRes = await runCommand(canonical, ['--version']);
  const version = verRes.stdout || verRes.stderr || 'UNKNOWN';
  console.log(`  Version:                ${version}`);
  const level1Pass = verRes.exitCode === 0 && version.includes('Claude Code');
  console.log(`  LEVEL 1 (Binary):       ${level1Pass ? '✅ PASS' : '❌ FAIL'}`);

  // Level 2: Auth Status
  const authRes = await runCommand(canonical, ['auth', 'status']);
  let parsedAuth: any = { raw: authRes.stdout || authRes.stderr };
  try {
    parsedAuth = JSON.parse(authRes.stdout);
  } catch {}

  const level2Pass = authRes.exitCode === 0 && parsedAuth.loggedIn === true;
  console.log(`\n[AUTHENTICATION METADATA]`);
  console.log(`  Auth Exit Code:         ${authRes.exitCode}`);
  console.log(`  Logged In:              ${parsedAuth.loggedIn ? 'true' : 'false'}`);
  console.log(`  Auth Method:            ${parsedAuth.authMethod || 'none'}`);
  console.log(`  API Provider:           ${parsedAuth.apiProvider || 'none'}`);
  console.log(`  Subscription:           ${parsedAuth.subscriptionType || 'none'}`);
  console.log(`  LEVEL 2 (Auth Status):  ${level2Pass ? '✅ PASS' : '❌ FAIL'}`);

  // Level 3: Real Headless Inference Probe (Sonnet 5)
  console.log(`\n[HEADLESS INFERENCE PROBE]`);
  console.log(`  Testing: ${canonical} -p --model claude-sonnet-5 "Reply with exactly: CLAUDE_PROBE_OK"`);
  const probeRes = await runCommand(canonical, [
    '-p',
    '--model',
    'claude-sonnet-5',
    'Reply with exactly: CLAUDE_PROBE_OK',
  ]);

  const probeSuccess = probeRes.exitCode === 0 && probeRes.stdout.includes('CLAUDE_PROBE_OK');
  console.log(`  Probe Duration:         ${probeRes.durationMs}ms`);
  console.log(`  Probe Exit Code:        ${probeRes.exitCode}`);
  console.log(`  Probe Output:           ${probeRes.stdout || '(empty)'}`);
  if (probeRes.stderr) {
    console.log(`  Probe Error Stream:     ${probeRes.stderr}`);
  }
  console.log(`  LEVEL 3 (Real Inference): ${probeSuccess ? '✅ PASS' : '❌ FAIL'}`);

  // Determine Classification (Section 26)
  let classification: 'CASE_A' | 'CASE_B' | 'CASE_C' | 'CASE_D' | 'READY' = 'READY';
  const recommendations: string[] = [];

  if (level1Pass && level2Pass && probeSuccess) {
    classification = 'READY';
    recommendations.push('Claude Code is fully ready and verified for autonomous review.');
  } else if (!level2Pass || !probeSuccess) {
    // Check if terminal auth is expired / broken
    const errText = (probeRes.stderr + ' ' + probeRes.stdout + ' ' + JSON.stringify(parsedAuth)).toLowerCase();
    if (errText.includes('oauth session expired') || errText.includes('not logged in') || errText.includes('auth_required') || !parsedAuth.loggedIn) {
      classification = 'CASE_A';
      recommendations.push(
        'CASE A: Claude Code subscription authentication is broken or expired.',
        'Run the following commands in your normal terminal to sign back in with your Claude Pro subscription:',
        '  claude auth logout',
        '  claude update',
        '  claude auth login',
        'Then verify with:',
        '  claude -p --model claude-sonnet-5 "Reply with exactly: CLAUDE_AUTH_OK"'
      );
    } else {
      classification = 'CASE_C';
      recommendations.push(
        'CASE C: Auth status passed but probe failed due to model or syntax issue.',
        `Inspect stderr: ${probeRes.stderr}`
      );
    }
  }

  console.log(`\n======================================================`);
  console.log(`DIAGNOSTIC VERDICT: ${classification}`);
  console.log(`======================================================`);
  recommendations.forEach((r) => console.log(r));

  // Save diagnostic report
  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    process: procInfo,
    environmentFlags: envFlags,
    claudeBinaries: binaries,
    canonicalBinary: canonical,
    version,
    authStatus: parsedAuth,
    inferenceProbe: {
      status: probeSuccess ? 'PASS' : 'FAIL',
      exitCode: probeRes.exitCode,
      stdout: probeRes.stdout,
      stderr: probeRes.stderr,
      durationMs: probeRes.durationMs,
    },
    classification,
    recommendations,
  };

  const outDir = path.resolve(process.cwd(), 'docs');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'claude-diagnostic-latest.json'), JSON.stringify(report, null, 2));
  console.log(`\nDiagnostic report saved to docs/claude-diagnostic-latest.json\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal diagnostic error:', err);
    process.exit(1);
  });
}
