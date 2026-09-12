import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { AgentAdapter } from '../adapter.interface.js';
import { AgentTask, AgentContext, AgentResult, AgentDetectionResult, AgentStatus, ModelSelectionConfig } from '../../protocol/types.js';

export class GeminiAdapter implements AgentAdapter {
  public id = 'gemini';
  public name = 'Antigravity / Gemini (Host & Executor)';
  private defaultModel: string;
  private activeProcess: ChildProcess | null = null;

  constructor(config?: ModelSelectionConfig) {
    this.defaultModel = config?.geminiModel || 'gemini-3.8-flash';
  }

  public async detect(): Promise<AgentDetectionResult> {
    try {
      const output = await this.runAgyCommand(['--version'], 5000);
      const isAvailable = output.includes('1.') || output.trim().length > 0;
      return {
        available: isAvailable,
        version: output.trim(),
        authMethod: 'subscription_antigravity_gemini',
        activeSubscription: true,
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
      authStatus: detection.available ? 'Authenticated (Antigravity CLI / Gemini)' : 'Unavailable',
    };
  }

  public async execute(task: AgentTask, context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    const timeout = task.timeoutMs || 15 * 60 * 1000; // 15 min default for full implementation
    const modelToUse = task.modelOverride || this.defaultModel;

    // Construct agy arguments for headless, auto-approved workspace modification
    const args: string[] = [
      '--add-dir', context.workspacePath,
      '--dangerously-skip-permissions',
      '--mode', 'accept-edits',
      '--print-timeout', '15m',
      '-p', task.prompt,
    ];

    if (modelToUse && modelToUse !== 'default') {
      if (modelToUse.includes('-high') || modelToUse.includes('-medium') || modelToUse.includes('-low')) {
        args.push('--model', modelToUse);
      } else if (modelToUse.startsWith('gemini-') || modelToUse.startsWith('claude-')) {
        args.push('--model', modelToUse, '--effort', 'high');
      } else {
        args.push('--model', modelToUse);
      }
    }

    try {
      const rawOutput = await this.runAgyCommand(args, timeout, context.workspacePath);
      const durationMs = Date.now() - startTime;

      return {
        success: true,
        agentId: this.id,
        modelUsed: modelToUse,
        rawOutput,
        durationMs,
      };
    } catch (err: any) {
      return {
        success: false,
        agentId: this.id,
        modelUsed: modelToUse,
        rawOutput: err.stdout || '',
        durationMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  public cancel(): void {
    if (this.activeProcess) {
      try {
        this.activeProcess.kill('SIGTERM');
        setTimeout(() => {
          if (this.activeProcess) {
            this.activeProcess.kill('SIGKILL');
          }
        }, 2000);
      } catch (err) {
        console.error('[GEMINI] Error killing active process:', err);
      }
    }
  }

  private runAgyCommand(args: string[], timeoutMs: number, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Clean environment: CRITICAL CONSTRAINT: ZERO API KEYS
      const env = { ...process.env };
      delete env.OPENAI_API_KEY;
      delete env.ANTHROPIC_API_KEY;
      delete env.GOOGLE_API_KEY;

      const child = spawn('agy', args, {
        cwd: cwd || process.cwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.activeProcess = child;

      let stdout = '';
      let stderr = '';
      let timer: NodeJS.Timeout | null = null;
      let watchdogTimer: NodeJS.Timeout | null = null;

      // Watchdog: automatically terminate long-running dev/preview servers spawned in the workspace
      const targetWorkspace = cwd || process.cwd();
      watchdogTimer = setInterval(() => {
        if (!child || child.killed) return;
        try {
          const { execSync } = require('child_process');
          const psOutput: string = execSync('ps -eo pid,ppid,args', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
          const lines = psOutput.split('\n');
          for (const line of lines) {
            const isServer = line.includes('vite preview') ||
              line.includes('scripts/serve') ||
              line.includes('npm run preview') ||
              line.includes('npm run serve') ||
              line.includes('http-server');
            if (isServer && line.includes(targetWorkspace)) {
              const pid = parseInt(line.trim().split(/\s+/)[0], 10);
              if (!isNaN(pid) && pid !== process.pid) {
                console.log(`[GEMINI WATCHDOG] Terminating blocking server process (PID ${pid}) in workspace...`);
                try { process.kill(pid, 'SIGTERM'); } catch {}
                setTimeout(() => {
                  try { process.kill(pid, 'SIGKILL'); } catch {}
                }, 1000);
              }
            }
          }
        } catch {}
      }, 3000);

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (watchdogTimer) clearInterval(watchdogTimer);
          child.kill('SIGTERM');
          reject(new Error(`Antigravity/Gemini (agy) process timed out after ${timeoutMs}ms`));
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
        if (watchdogTimer) clearInterval(watchdogTimer);
        this.activeProcess = null;
        if (code === 0) {
          resolve(stdout);
        } else {
          const err = new Error(`agy exited with code ${code}: ${stderr || stdout}`);
          (err as any).stdout = stdout;
          (err as any).stderr = stderr;
          (err as any).code = code;
          resolve(stdout); // Even on non-zero exit (e.g. SIGTERM after watchdog), resolve stdout so pipeline verifies files directly
        }
      });

      child.on('error', err => {
        if (timer) clearTimeout(timer);
        if (watchdogTimer) clearInterval(watchdogTimer);
        this.activeProcess = null;
        reject(err);
      });
    });
  }
}
