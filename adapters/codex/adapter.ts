import { spawn } from 'child_process';
import { AgentAdapter } from '../adapter.interface.js';
import { AgentTask, AgentContext, AgentResult, AgentDetectionResult, AgentStatus, ModelSelectionConfig } from '../../protocol/types.js';
import { CodexParser } from './parser.js';
import { ClaudeParser } from '../claude/parser.js';

export class CodexAdapter implements AgentAdapter {
  public id = 'codex';
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

  public async execute(task: AgentTask, context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    const modelToUse = CodexAdapter.normalizeModelSlug(task.modelOverride || this.defaultModel);
    const timeout = task.timeoutMs || 10 * 60 * 1000; // 10 min default (Section 18)

    // Build arguments
    const args = ['exec', '--skip-git-repo-check', '-s', 'read-only'];
    if (modelToUse) {
      args.push('-m', modelToUse);
    }
    if (this.reasoningEffort) {
      args.push('-c', `model_reasoning_effort="${this.reasoningEffort}"`);
    }

    const fullPrompt = `${task.systemPrompt ? task.systemPrompt + '\n\n' : ''}${task.prompt}`;
    args.push(fullPrompt);

    try {
      let rawOutput = await this.runCommand(args, timeout, context.workspacePath);
      let durationMs = Date.now() - startTime;

      // Extract tokens if reported
      const tokenMatch = rawOutput.match(/tokens used\s*[\r\n]+([\d,]+)/i);
      const tokensUsed = tokenMatch ? parseInt(tokenMatch[1].replace(/,/g, ''), 10) : undefined;

      // Parse depending on task type
      if (task.type === 'planning') {
        let parseResult = CodexParser.parsePlan(rawOutput);

        // Section 7: If parsing fails, retry ONCE with correction instruction
        if (!parseResult.success) {
          console.warn(`[CODEX] Initial plan parsing failed (${parseResult.error}). Retrying once with correction instruction...`);
          const retryPrompt = `${fullPrompt}\n\nATTENTION: Your previous response could not be parsed as valid JSON according to the schema. Output ONLY a valid JSON object matching the required schema. No conversational text.`;
          const retryArgs = [...args.slice(0, -1), retryPrompt];
          rawOutput = await this.runCommand(retryArgs, timeout, context.workspacePath);
          durationMs = Date.now() - startTime;
          parseResult = CodexParser.parsePlan(rawOutput);

          if (!parseResult.success) {
            return {
              success: false,
              agentId: this.id,
              modelUsed: modelToUse,
              rawOutput,
              durationMs,
              tokensUsed,
              error: `Schema validation failed after retry: ${parseResult.error}`,
            };
          }
        }

        return {
          success: true,
          agentId: this.id,
          modelUsed: modelToUse,
          rawOutput,
          structuredOutput: parseResult.data,
          durationMs,
          tokensUsed,
        };
      }

      if (task.type === 'review') {
        let reviewResult = ClaudeParser.parseReview(rawOutput);

        if (!reviewResult.success) {
          console.warn(`[CODEX] Initial review parsing failed (${reviewResult.error}). Retrying once with correction instruction...`);
          const retryPrompt = `${fullPrompt}\n\nATTENTION: Your previous response could not be parsed as valid JSON according to the schema. Output ONLY a valid JSON object matching the required schema with keys "decision" ("APPROVED" or "CHANGES_REQUESTED"), "summary", and "issues". No conversational text.`;
          const retryArgs = [...args.slice(0, -1), retryPrompt];
          rawOutput = await this.runCommand(retryArgs, timeout, context.workspacePath);
          durationMs = Date.now() - startTime;
          reviewResult = ClaudeParser.parseReview(rawOutput);

          if (!reviewResult.success) {
            return {
              success: false,
              agentId: this.id,
              modelUsed: modelToUse,
              rawOutput,
              durationMs,
              tokensUsed,
              error: `Review schema validation failed after retry: ${reviewResult.error}`,
            };
          }
        }

        return {
          success: true,
          agentId: this.id,
          modelUsed: modelToUse,
          rawOutput,
          structuredOutput: reviewResult.data,
          durationMs,
          tokensUsed,
        };
      }

      if (task.type === 'final_check') {
        const conformanceResult = CodexParser.parseConformance(rawOutput);
        return {
          success: conformanceResult.success,
          agentId: this.id,
          modelUsed: modelToUse,
          rawOutput,
          structuredOutput: conformanceResult.success ? conformanceResult.data : undefined,
          durationMs,
          tokensUsed,
          error: conformanceResult.success ? undefined : conformanceResult.error,
        };
      }

      // Default unstructured or generic task
      return {
        success: true,
        agentId: this.id,
        modelUsed: modelToUse,
        rawOutput,
        durationMs,
        tokensUsed,
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
