import { spawn } from 'child_process';
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
  WorkflowRole,
  WorkflowStage,
} from '../../protocol/types.js';
import { CodexParser } from './parser.js';
import { ClaudeParser } from '../claude/parser.js';

export class CodexAdapter implements AgentAdapter {
  public id: AgentId = 'codex';
  public name = 'Codex CLI';
  private defaultModel: string;
  private reasoningEffort?: string;
  private activeProcess: any = null;

  public cancel(): void {
    if (this.activeProcess) {
      try {
        this.activeProcess.kill('SIGTERM');
        setTimeout(() => {
          if (this.activeProcess) this.activeProcess.kill('SIGKILL');
        }, 1500);
      } catch (e) {
        console.error('[CODEX] Error killing process:', e);
      }
    }
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
      availableModels: ['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'],
      defaultModel: 'gpt-6-astra',
    };
  }

  public static normalizeModelSlug(model?: string): string {
    if (!model) return 'gpt-6-astra';
    const lower = model.toLowerCase().trim();
    if (lower.includes('astra') || lower === 'gpt-6') return 'gpt-6-astra';
    if (lower.includes('sol')) return 'gpt-5.6-sol';
    if (lower.includes('terra')) return 'gpt-5.6-terra';
    if (lower.includes('luna')) return 'gpt-5.6-luna';
    if (lower.includes('5.5') || lower === 'gpt-5.5') return 'gpt-5.5';
    return model;
  }

  constructor(config?: ModelSelectionConfig) {
    this.defaultModel = CodexAdapter.normalizeModelSlug(config?.codexModel);
    this.reasoningEffort = config?.reasoningEffort || 'low';
  }

  public async detect(): Promise<AgentDetectionResult> {
    try {
      const output = await this.runCommand(['--version'], 5000);
      const isAvailable = output.includes('codex-cli');
      return {
        available: isAvailable,
        version: output.trim(),
        authMethod: 'subscription_openai',
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
      authStatus: detection.available ? 'Authenticated (OpenAI Subscription)' : 'Unavailable',
    };
  }

  /**
   * Model-Agnostic Stage Execution
   */
  public async executeStage(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const modelToUse = CodexAdapter.normalizeModelSlug(request.model || this.defaultModel);
    const isWriteRole = request.role === 'builder' || request.role === 'fixer' || (request.role as any) === 'BUILDER' || (request.role as any) === 'FIXER' || request.stage === 'IMPLEMENTATION' || request.stage === 'IMPLEMENTING' || request.stage === 'FIX' || request.stage === 'FIXING';
    const readOnly = request.readOnly !== undefined ? request.readOnly : !isWriteRole;
    const timeout = request.timeoutMs || (readOnly ? 10 * 60 * 1000 : 15 * 60 * 1000);

    const args = ['exec', '--skip-git-repo-check'];
    if (readOnly) {
      args.push('-s', 'read-only');
    } else {
      args.push('-s', 'workspace-write', '-a', 'never');
    }

    if (modelToUse) {
      args.push('-m', modelToUse);
    }
    if (this.reasoningEffort) {
      args.push('-c', `model_reasoning_effort="${this.reasoningEffort}"`);
    }

    const fullPrompt = `${request.systemPrompt ? request.systemPrompt + '\n\n' : ''}${request.prompt}`;
    args.push(fullPrompt);

    try {
      let rawOutput = await this.runCommand(args, timeout, request.workspacePath);
      let durationMs = Date.now() - startTime;

      const tokenMatch = rawOutput.match(/tokens used\s*[\r\n]+([\d,]+)/i);
      const tokensUsed = tokenMatch ? parseInt(tokenMatch[1].replace(/,/g, ''), 10) : undefined;

      const expectedSchema = request.expectedSchema || (
        request.stage === 'PLANNING' ? 'planning' :
        request.stage === 'REVIEW' ? 'review' :
        request.stage === 'FINAL_CHECK' ? 'final_check' : 'none'
      );

      if (expectedSchema === 'planning') {
        let parseResult = CodexParser.parsePlan(rawOutput);
        if (!parseResult.success) {
          console.warn(`[CODEX] Initial plan parsing failed (${parseResult.error}). Retrying once with correction instruction...`);
          const retryPrompt = `${fullPrompt}\n\nATTENTION: Your previous response could not be parsed as valid JSON according to the schema. Output ONLY a valid JSON object matching the required schema. No conversational text.`;
          const retryArgs = [...args.slice(0, -1), retryPrompt];
          rawOutput = await this.runCommand(retryArgs, timeout, request.workspacePath);
          durationMs = Date.now() - startTime;
          parseResult = CodexParser.parsePlan(rawOutput);

          if (!parseResult.success) {
            return {
              success: false,
              agentId: this.id,
              modelUsed: modelToUse,
              role: request.role,
              stage: request.stage,
              rawOutput,
              durationMs,
              tokensUsed,
              error: `Plan schema validation failed after retry: ${parseResult.error}`,
            };
          }
        }

        return {
          success: true,
          agentId: this.id,
          modelUsed: modelToUse,
          role: request.role,
          stage: request.stage,
          rawOutput,
          structuredOutput: parseResult.data,
          durationMs,
          tokensUsed,
        };
      }

      if (expectedSchema === 'review') {
        let reviewResult = ClaudeParser.parseReview(rawOutput);
        if (!reviewResult.success) {
          console.warn(`[CODEX] Initial review parsing failed (${reviewResult.error}). Retrying once with correction instruction...`);
          const retryPrompt = `${fullPrompt}\n\nATTENTION: Your previous response could not be parsed as valid JSON according to the schema. Output ONLY a valid JSON object matching the required schema with keys "decision" ("APPROVED" or "CHANGES_REQUESTED"), "summary", and "issues". No conversational text.`;
          const retryArgs = [...args.slice(0, -1), retryPrompt];
          rawOutput = await this.runCommand(retryArgs, timeout, request.workspacePath);
          durationMs = Date.now() - startTime;
          reviewResult = ClaudeParser.parseReview(rawOutput);

          if (!reviewResult.success) {
            return {
              success: false,
              agent: 'codex',
              agentId: this.id,
              model: modelToUse,
              modelUsed: modelToUse,
              role: request.role,
              stage: request.stage,
              output: null,
              rawOutput,
              durationMs,
              tokensUsed,
              error: `Review schema validation failed after retry: ${reviewResult.error}`,
            };
          }
        }

        const parsedReview = reviewResult.data;
        return {
          success: true,
          agent: 'codex',
          agentId: 'codex',
          model: modelToUse,
          modelUsed: modelToUse,
          role: request.role,
          stage: request.stage,
          output: parsedReview,
          rawOutput,
          structuredOutput: parsedReview,
          durationMs,
          tokensUsed,
        };
      }

      if (expectedSchema === 'final_check') {
        const confRes = CodexParser.parseConformance(rawOutput);
        const confData = confRes.success ? confRes.data : undefined;
        return {
          success: confRes.success && confData?.decision === 'CONFORMANT',
          agent: 'codex',
          agentId: 'codex',
          model: modelToUse,
          modelUsed: modelToUse,
          role: request.role,
          stage: request.stage,
          output: confData,
          rawOutput,
          structuredOutput: confData,
          durationMs: Date.now() - startTime,
          tokensUsed,
          error: confRes.success ? undefined : confRes.error,
        };
      }

      return {
        success: true,
        agent: 'codex',
        agentId: 'codex',
        model: modelToUse,
        modelUsed: modelToUse,
        role: request.role,
        stage: request.stage,
        output: rawOutput,
        rawOutput,
        durationMs,
        tokensUsed,
      };
    } catch (err: any) {
      return {
        success: false,
        agent: 'codex',
        agentId: 'codex',
        model: modelToUse,
        modelUsed: modelToUse,
        role: request.role,
        stage: request.stage,
        output: null,
        rawOutput: err.stdout || err.stderr || '',
        durationMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  /**
   * Backward-compatible execute method
   */
  public async execute(task: AgentTask, context: AgentContext): Promise<AgentResult> {
    const roleMap: Record<string, WorkflowRole> = {
      planning: 'planner',
      review: 'reviewer',
      final_check: 'final_checker',
    };
    const stageMap: Record<string, WorkflowStage> = {
      planning: 'PLANNING',
      review: 'REVIEW',
      final_check: 'FINAL_CHECK',
    };

    const role: WorkflowRole = roleMap[task.type] || 'planner';
    const stage: WorkflowStage = stageMap[task.type] || 'PLANNING';

    const stageRes = await this.executeStage({
      id: task.id,
      runId: context.workspacePath.split('/').pop() || 'run',
      role,
      stage,
      model: task.modelOverride || this.defaultModel,
      prompt: task.prompt,
      systemPrompt: task.systemPrompt,
      workspacePath: context.workspacePath,
      context: {
        runId: context.workspacePath.split('/').pop() || 'run',
        workspacePath: context.workspacePath,
        userRequest: task.prompt,
      },
      readOnly: task.type !== 'planning' && task.type !== 'review' && task.type !== 'final_check' ? false : true,
      timeoutMs: task.timeoutMs,
      expectedSchema: task.type === 'planning' ? 'planning' : task.type === 'review' ? 'review' : task.type === 'final_check' ? 'final_check' : 'none',
    });

    return {
      success: stageRes.success,
      agentId: stageRes.agentId,
      modelUsed: stageRes.modelUsed,
      rawOutput: stageRes.rawOutput || '',
      structuredOutput: stageRes.structuredOutput,
      durationMs: stageRes.durationMs,
      tokensUsed: stageRes.tokensUsed,
      error: stageRes.error,
    };
  }

  private runCommand(args: string[], timeoutMs: number, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Clean environment: CRITICAL CONSTRAINT: ZERO API KEYS
      const env = { ...process.env };
      delete env.OPENAI_API_KEY;
      delete env.ANTHROPIC_API_KEY;
      delete env.GOOGLE_API_KEY;

      const child = spawn('codex', args, {
        cwd: cwd || process.cwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe'], // stdin closed (equivalent to </dev/null)
      });
      this.activeProcess = child;

      let stdout = '';
      let stderr = '';
      let timer: NodeJS.Timeout | null = null;

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Codex process timed out after ${timeoutMs}ms`));
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
          const err = new Error(`Codex exited with code ${code}: ${stderr || stdout}`);
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
