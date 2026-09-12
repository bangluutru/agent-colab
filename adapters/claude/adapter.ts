import { spawn } from 'child_process';
import { AgentAdapter } from '../adapter.interface.js';
import { AgentTask, AgentContext, AgentResult, AgentDetectionResult, AgentStatus, ModelSelectionConfig } from '../../protocol/types.js';
import { ClaudeParser } from './parser.js';

export class ClaudeAdapter implements AgentAdapter {
  public id = 'claude';
  public name = 'Claude Code CLI';
  private defaultModel: string;
  private activeProcess: any = null;

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

  public static normalizeModelSlug(model?: string): string {
    if (!model) return 'opus';
    const lower = model.toLowerCase().trim();
    if (lower === 'opus' || lower === 'opus 5' || lower === 'opus-5' || lower === 'claude-opus-5') return 'opus';
    if (lower === 'sonnet' || lower === 'sonnet 5' || lower === 'sonnet-5' || lower === 'claude-sonnet-5') return 'sonnet';
    if (lower === 'haiku' || lower === 'haiku 4.5' || lower === 'haiku-4.5' || lower === 'claude-haiku-4-5') return 'haiku';
    if (lower === 'fable' || lower === 'fable 5.1' || lower === 'fable-5.1') return 'fable-5.1';
    if (lower === 'fable 5' || lower === 'claude-fable-5' || lower === 'fable-5') return 'claude-fable-5';
    if (lower === 'opus 4.8' || lower === 'claude-opus-4-8') return 'claude-opus-4-8';
    if (lower === 'opus 4.7' || lower === 'claude-opus-4-7') return 'claude-opus-4-7';
    if (lower === 'opus 4.6' || lower === 'claude-opus-4-6') return 'claude-opus-4-6';
    if (lower === 'sonnet 4.6' || lower === 'claude-sonnet-4-6') return 'claude-sonnet-4-6';
    return model;
  }

  constructor(config?: ModelSelectionConfig) {
    this.defaultModel = ClaudeAdapter.normalizeModelSlug(config?.claudeModel);
  }

  public async detect(): Promise<AgentDetectionResult> {
    try {
      const output = await this.runCommand(['--version'], 5000);
      const isAvailable = output.includes('Claude Code');
      if (!isAvailable) {
        return {
          available: false,
          error: 'Claude Code CLI binary not found',
        };
      }

      // Check real authentication status via claude auth status
      let isLoggedIn = false;
      try {
        const authRaw = await this.runCommand(['auth', 'status'], 5000);
        const authData = JSON.parse(authRaw.trim());
        isLoggedIn = !!authData.loggedIn;
      } catch (authErr: any) {
        const out = (authErr.stdout || '') + (authErr.stderr || '');
        if (out.includes('"loggedIn": true')) {
          isLoggedIn = true;
        } else if (out.includes('"loggedIn": false') || out.includes('Not logged in')) {
          isLoggedIn = false;
        }
      }

      return {
        available: isAvailable && isLoggedIn,
        version: output.trim(),
        authMethod: 'subscription_claude_pro',
        activeSubscription: isLoggedIn,
        error: isLoggedIn ? undefined : 'AUTH_REQUIRED: Claude Code not logged in. Please run "claude login" in terminal.',
      };
    } catch (err: any) {
      return {
        available: false,
        error: err.message,
      };
    }
  }

  public async getStatus(): Promise<AgentStatus> {
    const detection = await this.detect();
    return {
      id: this.id,
      name: this.name,
      ready: detection.available,
      currentModel: this.defaultModel,
      authStatus: detection.available ? 'Authenticated (Claude Pro Subscription)' : 'Unavailable',
    };
  }

  public async execute(task: AgentTask, context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    const modelToUse = ClaudeAdapter.normalizeModelSlug(task.modelOverride || this.defaultModel);
    const timeout = task.timeoutMs || 15 * 60 * 1000; // 15 min default (Section 18)

    // Construct command arguments
    const args = ['-p'];
    if (modelToUse) {
      args.push('--model', modelToUse);
    }

    const fullPrompt = `${task.systemPrompt ? task.systemPrompt + '\n\n' : ''}${task.prompt}`;
    args.push(fullPrompt);

    try {
      const rawOutput = await this.runCommand(args, timeout, context.workspacePath);
      const durationMs = Date.now() - startTime;

      if (task.type === 'review') {
        const parsed = ClaudeParser.parseReview(rawOutput);
        return {
          success: parsed.success,
          agentId: this.id,
          modelUsed: modelToUse,
          rawOutput,
          structuredOutput: parsed.success ? parsed.data : undefined,
          durationMs,
          error: parsed.success ? undefined : parsed.error,
        };
      }

      return {
        success: true,
        agentId: this.id,
        modelUsed: modelToUse,
        rawOutput,
        durationMs,
      };
    } catch (err: any) {
      const isAuth = (err.message || '').includes('Not logged in') || (err.message || '').includes('Please run /login') || (err.stdout || '').includes('Not logged in') || (err.stderr || '').includes('Not logged in');
      return {
        success: false,
        agentId: this.id,
        modelUsed: modelToUse,
        rawOutput: err.stdout || '',
        durationMs: Date.now() - startTime,
        error: isAuth ? 'AUTH_REQUIRED: Claude Code not logged in. Please run "claude login" in terminal.' : err.message,
      };
    }
  }

  private runCommand(args: string[], timeoutMs: number, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Clean environment: ZERO API KEYS
      const env = { ...process.env };
      delete env.OPENAI_API_KEY;
      delete env.ANTHROPIC_API_KEY;
      delete env.GOOGLE_API_KEY;

      const child = spawn('claude', args, {
        cwd: cwd || process.cwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.activeProcess = child;

      let stdout = '';
      let stderr = '';
      let timer: NodeJS.Timeout | null = null;

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Claude process timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      child.stdout.on('data', chunk => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });

      child.on('close', code => {
        if (timer) clearTimeout(timer);
        this.activeProcess = null;
        if (code === 0) {
          resolve(stdout);
        } else {
          const err = new Error(`Claude exited with code ${code}: ${stderr || stdout}`);
          (err as any).stdout = stdout;
          (err as any).stderr = stderr;
          (err as any).code = code;
          reject(err);
        }
      });

      child.on('error', err => {
        if (timer) clearTimeout(timer);
        this.activeProcess = null;
        reject(err);
      });
    });
  }
}
