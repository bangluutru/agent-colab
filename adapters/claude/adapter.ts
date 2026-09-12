import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { AgentAdapter } from '../adapter.interface.js';
import {
  AgentTask,
  AgentContext,
  AgentResult,
  AgentDetectionResult,
  AgentStatus,
  ModelSelectionConfig,
} from '../../protocol/types.js';
import { ClaudeParser } from './parser.js';

export type ClaudeErrorKind =
  | 'AUTH_REQUIRED'
  | 'AUTH_SESSION_BROKEN'
  | 'AUTH_TOKEN_EXPIRED'
  | 'MODEL_UNAVAILABLE'
  | 'USAGE_LIMIT'
  | 'NETWORK_ERROR'
  | 'PROCESS_ERROR'
  | 'INVALID_OUTPUT'
  | 'TIMEOUT'
  | 'UNKNOWN_CLAUDE_ERROR';

export interface ClaudeProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
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
  // We want the normal local Claude.ai subscription login, not a stale automation token
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  // Scrub other API keys as well
  delete env.OPENAI_API_KEY;
  delete env.GOOGLE_API_KEY;

  // Inspect CLAUDE_CONFIG_DIR: if Antigravity or custom parent injected a non-standard dir,
  // remove it so Claude defaults to user normal ~/.claude credentials
  if (env.CLAUDE_CONFIG_DIR && !env.CLAUDE_CONFIG_DIR.includes('.claude')) {
    delete env.CLAUDE_CONFIG_DIR;
  }

  // Preserve critical user identity and macOS Keychain access
  // (HOME, USER, LOGNAME, PATH, SHELL must remain untouched)
  return env;
}

export function resolveCanonicalClaudeBinary(): string {
  try {
    const raw = execSync('which -a claude', { encoding: 'utf8' }).trim();
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const preferred = lines.find((p) => p.includes('.local/bin/claude')) || lines[0];
      return preferred;
    }
  } catch {}
  return 'claude';
}

export function classifyClaudeError(
  exitCode: number,
  stdout: string,
  stderr: string
): { kind: ClaudeErrorKind; message: string; userAction?: string } {
  const combined = (stdout + '\n' + stderr).toLowerCase();

  if (combined.includes('oauth session expired')) {
    return {
      kind: 'AUTH_TOKEN_EXPIRED',
      message: 'AUTH_TOKEN_EXPIRED: OAuth session expired and could not be refreshed.',
      userAction: 'Run in terminal: claude auth logout && claude update && claude auth login',
    };
  }

  if (
    combined.includes('401') ||
    combined.includes('invalid bearer token') ||
    combined.includes('unauthorized') ||
    combined.includes('authentication error')
  ) {
    return {
      kind: 'AUTH_SESSION_BROKEN',
      message: 'AUTH_SESSION_BROKEN: Claude authentication session is invalid or unauthorized (401).',
      userAction: 'Run in terminal: claude auth logout && claude auth login',
    };
  }

  if (
    combined.includes('not logged in') ||
    combined.includes('please run /login') ||
    combined.includes('run claude auth login') ||
    combined.includes('auth_required') ||
    combined.includes('"loggedin": false') ||
    combined.includes('"authmethod": "none"')
  ) {
    return {
      kind: 'AUTH_REQUIRED',
      message: 'AUTH_REQUIRED: Claude Code is not logged in.',
      userAction: 'Run in terminal: claude auth login',
    };
  }

  if (
    combined.includes('model not found') ||
    combined.includes('does not have access to') ||
    combined.includes('invalid model') ||
    combined.includes('unknown model')
  ) {
    return {
      kind: 'MODEL_UNAVAILABLE',
      message: 'MODEL_UNAVAILABLE: The requested model is not available for your subscription tier.',
      userAction: 'Try switching to claude-sonnet-5 or verify model access at claude.ai',
    };
  }

  if (combined.includes('rate limit') || combined.includes('usage limit') || combined.includes('resets at')) {
    return {
      kind: 'USAGE_LIMIT',
      message: 'USAGE_LIMIT: Claude Code usage limit reached for the current billing window.',
      userAction: 'Wait for the usage window to reset or use Codex reviewer fallback.',
    };
  }

  if (combined.includes('enotfound') || combined.includes('network') || combined.includes('econnrefused')) {
    return {
      kind: 'NETWORK_ERROR',
      message: 'NETWORK_ERROR: Unable to communicate with Claude API service.',
      userAction: 'Check your internet connection and proxy settings.',
    };
  }

  if (combined.includes('timed out')) {
    return {
      kind: 'TIMEOUT',
      message: 'TIMEOUT: Claude Code process timed out.',
      userAction: 'Check system performance or reduce prompt size.',
    };
  }

  return {
    kind: 'PROCESS_ERROR',
    message: `PROCESS_ERROR (exit code ${exitCode}): ${stderr.trim() || stdout.trim() || 'Unknown error'}`,
    userAction: 'Inspect raw stderr output in runs/<runId>/diagnostics/',
  };
}

export class ClaudeAdapter implements AgentAdapter {
  public id = 'claude';
  public name = 'Claude Code CLI';
  private defaultModel: string;
  private claudeBinary: string;
  private activeProcess: any = null;
  private detectionCache: { result: AgentDetectionResult; timestamp: number } | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache (Section 13)

  public cancel(): void {
    if (this.activeProcess) {
      try {
        this.activeProcess.kill('SIGTERM');
        setTimeout(() => {
          if (this.activeProcess) this.activeProcess.kill('SIGKILL');
        }, 1500);
      } catch (e) {
        console.error('[CLAUDE] Error killing process:', e);
      }
    }
  }

  public invalidateCache(): void {
    this.detectionCache = null;
  }

  public static normalizeModelSlug(model?: string): string {
    if (!model) return 'claude-sonnet-5';
    const lower = model.toLowerCase().trim();
    if (lower === 'sonnet' || lower === 'sonnet 5' || lower === 'sonnet-5' || lower === 'claude-sonnet-5') {
      return 'claude-sonnet-5';
    }
    if (lower === 'opus' || lower === 'opus 5' || lower === 'opus-5' || lower === 'claude-opus-5') {
      return 'claude-opus-5';
    }
    if (lower === 'haiku' || lower === 'haiku 4.5' || lower === 'haiku-4.5' || lower === 'claude-haiku-4-5') {
      return 'haiku';
    }
    if (lower === 'fable' || lower === 'fable 5.1' || lower === 'fable-5.1') {
      return 'fable-5.1';
    }
    if (lower === 'fable 5' || lower === 'claude-fable-5') {
      return 'claude-fable-5';
    }
    return model;
  }

  constructor(config?: ModelSelectionConfig) {
    this.claudeBinary = resolveCanonicalClaudeBinary();
    // Default reviewer model: claude-sonnet-5 (Section 16)
    this.defaultModel = ClaudeAdapter.normalizeModelSlug(config?.claudeModel || 'claude-sonnet-5');
  }

  public getCanonicalBinary(): string {
    return this.claudeBinary;
  }

  /**
   * Unified lower-level process launcher (Section 12)
   * Shared by --version, auth status, probe, and actual reviews.
   */
  public runClaudeProcess(
    args: string[],
    options?: { timeoutMs?: number; cwd?: string }
  ): Promise<ClaudeProcessResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timeoutMs = options?.timeoutMs || 60000;
      let stdout = '';
      let stderr = '';

      const child = spawn(this.claudeBinary, args, {
        cwd: options?.cwd || process.cwd(),
        env: buildClaudeEnvironment(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.activeProcess = child;

      let timer: NodeJS.Timeout | null = null;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          child.kill('SIGTERM');
          setTimeout(() => {
            try {
              child.kill('SIGKILL');
            } catch {}
          }, 1500);
        }, timeoutMs);
      }

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        this.activeProcess = null;
        resolve({
          exitCode: code ?? -1,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          durationMs: Date.now() - startTime,
        });
      });

      child.on('error', (err) => {
        if (timer) clearTimeout(timer);
        this.activeProcess = null;
        resolve({
          exitCode: -1,
          stdout,
          stderr: stderr + '\n' + err.message,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * 3-Level Readiness Detection (Section 2 & 13)
   * LEVEL 1: binary exists
   * LEVEL 2: auth status says logged in
   * LEVEL 3: real headless inference probe succeeds
   */
  public async detect(forceRefresh: boolean = false): Promise<AgentDetectionResult> {
    if (!forceRefresh && this.detectionCache && Date.now() - this.detectionCache.timestamp < this.CACHE_TTL_MS) {
      return this.detectionCache.result;
    }

    // LEVEL 1: Binary Existence
    const verRes = await this.runClaudeProcess(['--version'], { timeoutMs: 5000 });
    const isAvailable = verRes.exitCode === 0 && verRes.stdout.includes('Claude Code');
    if (!isAvailable) {
      const result: AgentDetectionResult = {
        available: false,
        error: `Claude Code binary not found at "${this.claudeBinary}".`,
      };
      this.detectionCache = { result, timestamp: Date.now() };
      return result;
    }

    // LEVEL 2: Auth Status Check
    let authData: any = {};
    const authRes = await this.runClaudeProcess(['auth', 'status'], { timeoutMs: 5000 });
    try {
      authData = JSON.parse(authRes.stdout);
    } catch {}

    if (!authData.loggedIn) {
      const classified = classifyClaudeError(authRes.exitCode, authRes.stdout, authRes.stderr);
      const result: AgentDetectionResult = {
        available: false,
        version: verRes.stdout,
        authMethod: authData.authMethod || 'none',
        activeSubscription: false,
        error: `${classified.message} ${classified.userAction || ''}`.trim(),
      };
      this.detectionCache = { result, timestamp: Date.now() };
      return result;
    }

    // LEVEL 3: Real Headless Inference Probe (Section 2 & 13)
    const probeRes = await this.runClaudeProcess(
      ['-p', '--model', 'claude-sonnet-5', 'Reply with exactly: CLAUDE_PROBE_OK'],
      { timeoutMs: 15000 }
    );

    const probePass = probeRes.exitCode === 0 && probeRes.stdout.includes('CLAUDE_PROBE_OK');
    if (!probePass) {
      const classified = classifyClaudeError(probeRes.exitCode, probeRes.stdout, probeRes.stderr);
      const result: AgentDetectionResult = {
        available: false,
        version: verRes.stdout,
        authMethod: authData.authMethod || 'claude.ai',
        activeSubscription: true,
        error: `LEVEL 3 Probe Failed: ${classified.message} ${classified.userAction || ''}`.trim(),
      };
      this.detectionCache = { result, timestamp: Date.now() };
      return result;
    }

    const result: AgentDetectionResult = {
      available: true,
      version: verRes.stdout,
      authMethod: authData.authMethod || 'claude.ai',
      activeSubscription: true,
    };
    this.detectionCache = { result, timestamp: Date.now() };
    return result;
  }

  public async getStatus(forceRefresh: boolean = false): Promise<AgentStatus> {
    const detection = await this.detect(forceRefresh);
    return {
      id: this.id,
      name: this.name,
      ready: detection.available,
      currentModel: this.defaultModel,
      authStatus: detection.available
        ? 'Authenticated (Claude Pro Subscription · Ready)'
        : detection.error || 'Authentication Needed',
      detectionDetails: {
        binary: this.claudeBinary,
        version: detection.version,
        authMethod: detection.authMethod,
        activeSubscription: detection.activeSubscription,
        inferencePass: detection.available,
        error: detection.error,
      },
    };
  }

  /**
   * Persist raw process execution diagnostics (Section 15)
   */
  private saveDiagnosticLog(
    task: AgentTask,
    context: AgentContext,
    model: string,
    processRes: ClaudeProcessResult
  ): void {
    try {
      const runId = context.runId || 'latest';
      const runsDir = path.resolve(process.cwd(), 'runs', runId, 'diagnostics');
      fs.mkdirSync(runsDir, { recursive: true });

      const diagFile = path.join(
        runsDir,
        `claude-${task.type}-${Date.now()}-process.json`
      );

      const diagnosticData = {
        timestamp: new Date().toISOString(),
        taskType: task.type,
        binary: this.claudeBinary,
        model,
        cwd: context.workspacePath || process.cwd(),
        exitCode: processRes.exitCode,
        durationMs: processRes.durationMs,
        stdout: processRes.stdout,
        stderr: processRes.stderr,
        environment: {
          HOME: process.env.HOME ? 'present' : 'unset',
          USER: process.env.USER ? 'present' : 'unset',
          CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR ? 'custom' : 'default',
          CLAUDE_CODE_OAUTH_TOKEN: 'unset',
          ANTHROPIC_API_KEY: 'unset',
        },
      };

      fs.writeFileSync(diagFile, JSON.stringify(diagnosticData, null, 2));
    } catch (err) {
      console.warn('[CLAUDE] Failed to persist diagnostics log:', err);
    }
  }

  public async execute(task: AgentTask, context: AgentContext): Promise<AgentResult> {
    let modelToUse = ClaudeAdapter.normalizeModelSlug(task.modelOverride || this.defaultModel);
    const timeout = task.timeoutMs || 180000; // 180s default timeout for deep review

    const fullPrompt = `${task.systemPrompt ? task.systemPrompt + '\n\n' : ''}${task.prompt}`;
    const buildArgs = (m: string) => ['-p', '--model', m, fullPrompt];

    // Primary execution attempt
    let procRes = await this.runClaudeProcess(buildArgs(modelToUse), {
      timeoutMs: timeout,
      cwd: context.workspacePath,
    });

    this.saveDiagnosticLog(task, context, modelToUse, procRes);

    // Section 17: Automatic model fallback from Opus to Sonnet if specifically MODEL_UNAVAILABLE
    if (procRes.exitCode !== 0) {
      const classification = classifyClaudeError(procRes.exitCode, procRes.stdout, procRes.stderr);

      if (classification.kind === 'MODEL_UNAVAILABLE' && modelToUse === 'claude-opus-5') {
        console.warn(`[CLAUDE] Model ${modelToUse} unavailable. Retrying with claude-sonnet-5...`);
        modelToUse = 'claude-sonnet-5';
        procRes = await this.runClaudeProcess(buildArgs(modelToUse), {
          timeoutMs: timeout,
          cwd: context.workspacePath,
        });
        this.saveDiagnosticLog(task, context, modelToUse, procRes);
      }
    }

    // Process output or handle failure
    if (procRes.exitCode !== 0) {
      const classified = classifyClaudeError(procRes.exitCode, procRes.stdout, procRes.stderr);
      return {
        success: false,
        agentId: this.id,
        modelUsed: modelToUse,
        rawOutput: procRes.stdout,
        durationMs: procRes.durationMs,
        error: `${classified.message} ${classified.userAction || ''}`.trim(),
      };
    }

    if (task.type === 'review') {
      const parsed = ClaudeParser.parseReview(procRes.stdout);
      if (parsed.success) {
        return {
          success: true,
          agentId: this.id,
          modelUsed: modelToUse,
          rawOutput: procRes.stdout,
          structuredOutput: parsed.data,
          durationMs: procRes.durationMs,
        };
      } else {
        return {
          success: false,
          agentId: this.id,
          modelUsed: modelToUse,
          rawOutput: procRes.stdout,
          durationMs: procRes.durationMs,
          error: parsed.error,
        };
      }
    }

    return {
      success: true,
      agentId: this.id,
      modelUsed: modelToUse,
      rawOutput: procRes.stdout,
      durationMs: procRes.durationMs,
    };
  }
}
