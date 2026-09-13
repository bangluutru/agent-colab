import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { AgentAdapter } from '../adapter.interface.js';
import {
  AgentTask,
  AgentContext,
  AgentResult,
  AgentDetectionResult,
  AgentStatus,
  ModelSelectionConfig,
  AgentCapabilities,
  AgentExecutionRequest,
  AgentExecutionResult,
  AgentId,
} from '../../protocol/types.js';
import { CodexParser } from '../codex/parser.js';
import { ClaudeParser } from '../claude/parser.js';

export function buildGeminiAgyArgs(
  workspacePath: string,
  fullPrompt: string,
  model: string,
  readOnly: boolean = true,
  reasoningEffort?: 'low' | 'medium' | 'high'
): string[] {
  const args: string[] = [
    '--add-dir', workspacePath,
    '--dangerously-skip-permissions',
    '--print-timeout', '15m'
  ];

  if (!readOnly) {
    args.push('--mode', 'accept-edits');
  }

  args.push('-p', fullPrompt);

  if (model && model !== 'default') {
    const effort = reasoningEffort || 'high';
    // Only standard gemini-* models without pre-baked effort suffixes support --effort in agy
    const supportsEffort = model.startsWith('gemini-') &&
      !model.includes('-high') &&
      !model.includes('-medium') &&
      !model.includes('-low') &&
      !model.includes('thinking');

    args.push('--model', model);
    if (supportsEffort) {
      args.push('--effort', effort);
    }
  }
  return args;
}

export class GeminiAdapter implements AgentAdapter {
  public id: AgentId = 'gemini';
  public name = 'Antigravity / Gemini (Host & Executor)';
  private defaultModel: string;
  private activeProcess: ChildProcess | null = null;

  constructor(config?: ModelSelectionConfig) {
    this.defaultModel = config?.geminiModel || 'gemini-3.8-flash';
  }

  public getCapabilities(): AgentCapabilities {
    return {
      supportsPlanning: true,
      supportsImplementation: true,
      supportsReview: true,
      supportsFix: true,
      supportsFinalCheck: true,
      canWriteWorkspace: true,
      canExecuteCommands: true,
      availableModels: ['gemini-3.8-flash', 'gemini-3.8-pro', 'gemini-3.5-flash'],
      defaultModel: 'gemini-3.8-flash',
    };
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

  /**
   * Model-Agnostic Stage Execution
   */
  public async executeStage(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const timeout = request.timeoutMs || 15 * 60 * 1000;
    const modelToUse = request.model || this.defaultModel;
    const isWriteRole = request.role === 'builder' || request.role === 'fixer' || (request.role as any) === 'BUILDER' || (request.role as any) === 'FIXER' || request.stage === 'IMPLEMENTATION' || request.stage === 'IMPLEMENTING' || request.stage === 'FIX' || request.stage === 'FIXING';
    const readOnly = request.readOnly !== undefined ? request.readOnly : !isWriteRole;

    const fullPrompt = `${request.systemPrompt ? request.systemPrompt + '\n\n' : ''}${request.prompt}`;

    const buildAgyArgs = (model: string): string[] => {
      return buildGeminiAgyArgs(request.workspacePath, fullPrompt, model, readOnly, request.reasoningEffort);
    };

    const parseResult = (rawOutput: string, modelUsed: string, durationMs: number): AgentExecutionResult => {
      const expectedSchema = request.expectedSchema || (
        request.stage === 'PLANNING' ? 'planning' :
        request.stage === 'REVIEW' || request.stage === 'REVIEWING' ? 'review' :
        request.stage === 'FINAL_CHECK' ? 'final_check' : 'none'
      );

      if (expectedSchema === 'planning') {
        const planRes = CodexParser.parsePlan(rawOutput);
        return {
          success: planRes.success,
          agent: 'gemini',
          agentId: this.id,
          model: modelUsed,
          modelUsed,
          role: request.role,
          stage: request.stage,
          output: planRes.success ? planRes.data : undefined,
          rawOutput,
          structuredOutput: planRes.success ? planRes.data : undefined,
          durationMs,
          error: planRes.success ? undefined : planRes.error,
        };
      }

      if (expectedSchema === 'review') {
        const revRes = ClaudeParser.parseReview(rawOutput);
        return {
          success: revRes.success,
          agent: 'gemini',
          agentId: this.id,
          model: modelUsed,
          modelUsed,
          role: request.role,
          stage: request.stage,
          output: revRes.success ? revRes.data : undefined,
          rawOutput,
          structuredOutput: revRes.success ? revRes.data : undefined,
          durationMs,
          error: revRes.success ? undefined : revRes.error,
        };
      }

      if (expectedSchema === 'final_check') {
        const confRes = CodexParser.parseConformance(rawOutput);
        return {
          success: confRes.success,
          agent: 'gemini',
          agentId: this.id,
          model: modelUsed,
          modelUsed,
          role: request.role,
          stage: request.stage,
          output: confRes.success ? confRes.data : undefined,
          rawOutput,
          structuredOutput: confRes.success ? confRes.data : undefined,
          durationMs,
          error: confRes.success ? undefined : confRes.error,
        };
      }

      return {
        success: true,
        agent: 'gemini',
        agentId: this.id,
        model: modelUsed,
        modelUsed,
        role: request.role,
        stage: request.stage,
        output: rawOutput,
        rawOutput,
        durationMs,
      };
    };

    try {
      let rawOutput = await this.runAgyCommand(buildAgyArgs(modelToUse), timeout, request.workspacePath);
      let durationMs = Date.now() - startTime;

      let result = parseResult(rawOutput, modelToUse, durationMs);

      // If schema parsing failed or output is empty, and model was not default Gemini, retry with defaultModel inside Gemini
      if (!result.success && modelToUse !== this.defaultModel) {
        console.warn(`[GEMINI] Model "${modelToUse}" failed validation (${result.error}). Retrying with default Gemini model "${this.defaultModel}"...`);
        const fallbackRaw = await this.runAgyCommand(buildAgyArgs(this.defaultModel), timeout, request.workspacePath);
        return parseResult(fallbackRaw, this.defaultModel, Date.now() - startTime);
      }

      return result;
    } catch (err: any) {
      // If execution crashed on custom/thinking model, retry with canonical default Gemini model
      if (modelToUse !== this.defaultModel) {
        console.warn(`[GEMINI] Execution failed with model "${modelToUse}" (${err.message}). Retrying with default Gemini model "${this.defaultModel}"...`);
        try {
          const fallbackRaw = await this.runAgyCommand(buildAgyArgs(this.defaultModel), timeout, request.workspacePath);
          return parseResult(fallbackRaw, this.defaultModel, Date.now() - startTime);
        } catch (retryErr: any) {
          console.error(`[GEMINI] Fallback to default model "${this.defaultModel}" also failed:`, retryErr);
        }
      }

      return {
        success: false,
        agent: 'gemini',
        agentId: this.id,
        model: modelToUse,
        modelUsed: modelToUse,
        role: request.role,
        stage: request.stage,
        output: null,
        rawOutput: err.stdout || '',
        durationMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  /**
   * Backward-compatible execute method
   */
  public async execute(task: AgentTask, context: AgentContext): Promise<AgentResult> {
    const stageRes = await this.executeStage({
      id: task.id,
      runId: context.workspacePath.split('/').pop() || 'run',
      role: 'builder',
      stage: 'IMPLEMENTATION',
      model: task.modelOverride || this.defaultModel,
      prompt: task.prompt,
      systemPrompt: task.systemPrompt,
      workspacePath: context.workspacePath,
      context: {
        runId: context.workspacePath.split('/').pop() || 'run',
        workspacePath: context.workspacePath,
        userRequest: task.prompt,
      },
      readOnly: false,
      timeoutMs: task.timeoutMs,
      expectedSchema: 'none',
    });

    return {
      success: stageRes.success,
      agentId: stageRes.agentId,
      modelUsed: stageRes.modelUsed,
      rawOutput: stageRes.rawOutput || '',
      durationMs: stageRes.durationMs,
      error: stageRes.error,
    };
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
