import {
  ConfiguredStage,
  TaskState,
  WorkflowEvent,
  AgentExecutionRequest,
} from './protocol/types.js';
import { AgentProvider } from './providers/provider.interface.js';
import { CodexProvider } from './providers/codex.provider.js';
import { ClaudeProvider } from './providers/claude.provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { AntigravityProvider } from './providers/antigravity.provider.js';
import { StagePipeline } from './pipeline.js';
import { RulesEngine } from './rules/rules-engine.js';
import { VerificationGate, VerificationResult } from './verification/verification-gate.js';
import { AuditLogger } from './audit/audit-logger.js';
import { WorkflowStateMachine } from './state/state-machine.js';

export interface EngineOptions {
  workspacePath: string;
  storageDir?: string;
}

export class OrchestratorEngine {
  private workspacePath: string;
  private pipeline: StagePipeline;
  private providers: Map<string, AgentProvider> = new Map();
  private rulesEngine: RulesEngine;
  private verificationGate: VerificationGate;
  private auditLogger: AuditLogger;
  private stateMachine: WorkflowStateMachine;
  private currentTaskId: string = '';
  private currentStageIndex: number = 0;
  private isPaused: boolean = false;
  private isCancelled: boolean = false;
  private pendingApprovalStageId: string | null = null;
  private eventListeners: ((event: WorkflowEvent) => void)[] = [];

  constructor(options: EngineOptions, initialStages: ConfiguredStage[] = []) {
    this.workspacePath = options.workspacePath;
    this.pipeline = new StagePipeline(initialStages);
    this.rulesEngine = new RulesEngine(options.workspacePath);
    this.verificationGate = new VerificationGate(options.workspacePath);
    this.auditLogger = new AuditLogger(options.storageDir || options.workspacePath);
    this.stateMachine = new WorkflowStateMachine('Draft');

    // Register Default Providers
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new AntigravityProvider());
    this.registerProvider(new CodexProvider());
    this.registerProvider(new ClaudeProvider());
  }

  public registerProvider(provider: AgentProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: string): AgentProvider | undefined {
    return this.providers.get(id);
  }

  public listProviders(): AgentProvider[] {
    return Array.from(this.providers.values());
  }

  public getPipeline(): StagePipeline {
    return this.pipeline;
  }

  public getStateMachine(): WorkflowStateMachine {
    return this.stateMachine;
  }

  public getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  public onEvent(listener: (event: WorkflowEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== listener);
    };
  }

  private emitEvent(event: WorkflowEvent): void {
    this.eventListeners.forEach(fn => fn(event));
  }

  public async startWorkflow(taskId: string, userPrompt: string): Promise<TaskState> {
    this.currentTaskId = taskId;
    this.isPaused = false;
    this.isCancelled = false;
    this.currentStageIndex = 0;
    this.stateMachine.setState('Running');

    this.emitEvent({
      timestamp: new Date().toISOString(),
      run_id: taskId,
      from: 'orchestrator',
      to: 'all',
      type: 'USER_REQUEST_RECEIVED',
      status: 'received',
      data: { userPrompt, stageCount: this.pipeline.getStages().length },
    });

    return this.executePipeline(userPrompt);
  }

  private async executePipeline(userPrompt: string): Promise<TaskState> {
    const stages = this.pipeline.getStages();

    while (this.currentStageIndex < stages.length) {
      if (this.isCancelled) {
        this.stateMachine.setState('Cancelled');
        return 'Cancelled';
      }

      if (this.isPaused) {
        this.stateMachine.setState('Paused');
        return 'Paused';
      }

      const stage = stages[this.currentStageIndex];

      // Human-in-the-loop approval gate before running stage if configured
      if (stage.autoContinue === false && this.pendingApprovalStageId !== stage.id) {
        this.pendingApprovalStageId = stage.id;
        this.stateMachine.setState('Needs Attention');
        this.pipeline.updateStage(stage.id, { status: 'waiting' });
        this.emitEvent({
          timestamp: new Date().toISOString(),
          run_id: this.currentTaskId,
          from: 'orchestrator',
          to: 'user',
          type: 'PHASE_TRANSITION',
          status: 'info',
          data: { stageId: stage.id, stageName: stage.name, actionNeeded: 'APPROVAL_REQUIRED' },
        });
        return 'Needs Attention';
      }

      // Execute current stage
      this.pendingApprovalStageId = null;
      this.pipeline.updateStage(stage.id, { status: 'running' });
      this.stateMachine.setStageStatus(stage.id, 'running');

      const startTime = Date.now();
      const resolvedRules = this.rulesEngine.resolveRulesForStage(stage.rules, [], stage.agent);
      const rulesPrompt = this.rulesEngine.compileRulesPrompt(resolvedRules);

      const provider = this.getProvider(stage.agent) || this.getProvider('gemini') || Array.from(this.providers.values())[0];
      if (!provider) {
        this.pipeline.updateStage(stage.id, { status: 'failed', error: `Provider ${stage.agent} not found` });
        this.stateMachine.setState('Failed');
        return 'Failed';
      }

      const req: AgentExecutionRequest = {
        runId: this.currentTaskId,
        stage: stage.name.toUpperCase() as any,
        role: stage.role,
        model: stage.model,
        workspacePath: this.workspacePath,
        prompt: userPrompt,
        systemPrompt: rulesPrompt,
        readOnly: !stage.permissions.write,
        context: {
          runId: this.currentTaskId,
          workspacePath: this.workspacePath,
          userRequest: userPrompt,
          role: stage.role,
        },
      };

      try {
        const executionResult = await provider.execute(req);
        const durationMs = Date.now() - startTime;

        if (!executionResult.success) {
          this.pipeline.updateStage(stage.id, { status: 'failed', error: executionResult.error, durationMs });
          this.stateMachine.setState('Failed');
          return 'Failed';
        }

        // Run Verification Gate
        let verificationResult: VerificationResult | undefined;
        if (stage.verification) {
          this.stateMachine.setState('Verification');
          verificationResult = await this.verificationGate.evaluate(stage.verification, {
            stageOutput: executionResult.structuredOutput,
          });

          if (!verificationResult.passed) {
            this.pipeline.updateStage(stage.id, {
              status: 'failed',
              error: `Verification failed: ${verificationResult.failedChecks.join(', ')}`,
              durationMs,
            });
            this.stateMachine.setState('Failed');
            return 'Failed';
          }
        }

        // Audit Trail Logging
        this.auditLogger.log({
          taskId: this.currentTaskId,
          stageId: stage.id,
          stageName: stage.name,
          agent: stage.agent,
          provider: stage.provider,
          model: stage.model,
          rulesApplied: resolvedRules.map(r => r.name || r.id),
          filesChanged: [],
          commandsExecuted: [],
          reviewResult: executionResult.structuredOutput,
          verificationResult,
          durationMs,
          status: 'SUCCESS',
        });

        this.pipeline.updateStage(stage.id, {
          status: 'completed',
          output: executionResult.structuredOutput || executionResult.rawOutput,
          durationMs,
        });

        this.currentStageIndex++;
      } catch (err: any) {
        this.pipeline.updateStage(stage.id, { status: 'failed', error: err.message });
        this.stateMachine.setState('Failed');
        return 'Failed';
      }
    }

    this.stateMachine.setState('Completed');
    this.emitEvent({
      timestamp: new Date().toISOString(),
      run_id: this.currentTaskId,
      from: 'orchestrator',
      to: 'all',
      type: 'WORKFLOW_COMPLETED',
      status: 'success',
      data: { taskId: this.currentTaskId },
    });
    return 'Completed';
  }

  public approveStage(stageId: string): Promise<TaskState> {
    if (this.pendingApprovalStageId === stageId) {
      this.pendingApprovalStageId = null;
      this.stateMachine.setState('Running');
      return this.executePipeline('');
    }
    return Promise.resolve(this.stateMachine.getState());
  }

  public pause(): void {
    this.isPaused = true;
    this.stateMachine.setState('Paused');
  }

  public resume(prompt: string = ''): Promise<TaskState> {
    this.isPaused = false;
    this.stateMachine.setState('Running');
    return this.executePipeline(prompt);
  }

  public cancel(): void {
    this.isCancelled = true;
    this.stateMachine.setState('Cancelled');
  }

  public retryStage(stageId: string, modelOverride?: string): Promise<TaskState> {
    const idx = this.pipeline.getStages().findIndex(s => s.id === stageId);
    if (idx !== -1) {
      if (modelOverride) {
        this.pipeline.updateStage(stageId, { model: modelOverride });
      }
      this.currentStageIndex = idx;
      this.isPaused = false;
      this.isCancelled = false;
      this.stateMachine.setState('Running');
      return this.executePipeline('');
    }
    return Promise.resolve(this.stateMachine.getState());
  }
}
