import * as fs from 'fs';
import * as path from 'path';
import { AgentAdapter } from '../adapters/adapter.interface.js';
import { CodexAdapter } from '../adapters/codex/adapter.js';
import { GeminiAdapter } from '../adapters/gemini/adapter.js';
import { ClaudeAdapter } from '../adapters/claude/adapter.js';
import {
  AgentId,
  WorkflowRole,
  WorkflowStage,
  RoleAssignment,
  WorkflowRoutingConfig,
  ResolvedWorkflowRouting,
  StageContext,
  AgentExecutionRequest,
  AgentExecutionResult,
  AgentStatus,
  AgentCapabilities,
  TeamPreset,
  ModelSelectionConfig,
} from '../protocol/types.js';

export class AgentRouter {
  private adapters: Map<AgentId, AgentAdapter> = new Map();
  private promptsDir: string;

  constructor(promptsDir?: string, modelConfig?: ModelSelectionConfig) {
    this.promptsDir = promptsDir || path.resolve(process.cwd(), 'prompts');

    const codex = new CodexAdapter(modelConfig);
    const gemini = new GeminiAdapter(modelConfig);
    const claude = new ClaudeAdapter(modelConfig);

    this.adapters.set('codex', codex);
    this.adapters.set('gemini', gemini);
    this.adapters.set('claude', claude);
  }

  public getAdapter(agentId: AgentId): AgentAdapter {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      throw new Error(`Unknown agent ID: "${agentId}". Available agents: codex, gemini, claude.`);
    }
    return adapter;
  }

  public getCodexAdapter(): CodexAdapter {
    return this.adapters.get('codex') as CodexAdapter;
  }

  public getGeminiAdapter(): GeminiAdapter {
    return this.adapters.get('gemini') as GeminiAdapter;
  }

  public getClaudeAdapter(): ClaudeAdapter {
    return this.adapters.get('claude') as ClaudeAdapter;
  }

  public cancelAll(): void {
    for (const adapter of this.adapters.values()) {
      if (typeof adapter.cancel === 'function') {
        adapter.cancel();
      }
    }
  }

  /**
   * Resolves partial or preset routing into a fully resolved 5-role configuration.
   */
  public resolveRouting(
    config?: WorkflowRoutingConfig,
    legacyModels?: ModelSelectionConfig
  ): ResolvedWorkflowRouting {
    // If preset requested, apply preset defaults
    let basePlanner: RoleAssignment = { agent: 'codex', model: 'gpt-6-astra' };
    let baseBuilder: RoleAssignment = { agent: 'gemini', model: 'gemini-3.8-flash' };
    let baseReviewer: RoleAssignment = { agent: 'claude', model: 'claude-sonnet-5' };
    let baseFixer: RoleAssignment = { agent: 'gemini', model: 'gemini-3.8-flash' };
    let baseFinalChecker: RoleAssignment = { agent: 'codex', model: 'gpt-6-astra' };

    const preset = config?.preset || 'recommended';
    if (preset === 'all_gemini') {
      basePlanner = { agent: 'gemini', model: 'gemini-3.8-flash' };
      baseBuilder = { agent: 'gemini', model: 'gemini-3.8-flash' };
      baseReviewer = { agent: 'gemini', model: 'gemini-3.8-flash' };
      baseFixer = { agent: 'gemini', model: 'gemini-3.8-flash' };
      baseFinalChecker = { agent: 'gemini', model: 'gemini-3.8-flash' };
    } else if (preset === 'fast') {
      basePlanner = { agent: 'gemini', model: 'gemini-3.8-flash' };
      baseBuilder = { agent: 'gemini', model: 'gemini-3.8-flash' };
      baseReviewer = { agent: 'claude', model: 'haiku' };
      baseFixer = { agent: 'gemini', model: 'gemini-3.8-flash' };
      baseFinalChecker = { agent: 'gemini', model: 'gemini-3.8-flash' };
    } else if (preset === 'deep_review') {
      basePlanner = { agent: 'codex', model: 'gpt-6-astra' };
      baseBuilder = { agent: 'gemini', model: 'gemini-3.8-flash' };
      baseReviewer = { agent: 'claude', model: 'claude-opus-5' };
      baseFixer = { agent: 'gemini', model: 'gemini-3.8-flash' };
      baseFinalChecker = { agent: 'codex', model: 'gpt-6-astra' };
    }

    // Apply legacy model config overrides if provided
    if (legacyModels?.codexModel) {
      basePlanner.model = CodexAdapter.normalizeModelSlug(legacyModels.codexModel);
      baseFinalChecker.model = basePlanner.model;
    }
    if (legacyModels?.geminiModel) {
      baseBuilder.model = legacyModels.geminiModel;
      baseFixer.model = baseBuilder.model;
    }
    if (legacyModels?.claudeModel) {
      baseReviewer.model = ClaudeAdapter.normalizeModelSlug(legacyModels.claudeModel);
    }

    // Helper to safely resolve role assignment with model isolation
    const resolveRole = (
      roleName: string,
      assigned?: Partial<RoleAssignment>,
      baseDefault?: RoleAssignment
    ): RoleAssignment => {
      const agent: AgentId = assigned?.agent || baseDefault?.agent || 'codex';
      const adapter = this.adapters.get(agent);
      const fallbackModel = agent === 'gemini' ? 'gemini-3.8-flash' : agent === 'claude' ? 'claude-sonnet-5' : 'gpt-6-astra';
      const defaultModel = adapter?.getCapabilities().defaultModel || fallbackModel;

      let model = assigned?.model;

      // Validate model compatibility with agent to prevent cross-agent model leakage
      if (model && model !== 'default') {
        if (agent === 'gemini' && (model.startsWith('gpt-') || (model.startsWith('claude-') && !model.includes('thinking')))) {
          model = defaultModel;
        } else if (agent === 'codex' && (model.startsWith('gemini-') || model.startsWith('claude-'))) {
          model = defaultModel;
        } else if (agent === 'claude' && (model.startsWith('gpt-') || model.startsWith('gemini-'))) {
          model = defaultModel;
        }
      } else {
        model = (baseDefault?.agent === agent && baseDefault?.model) ? baseDefault.model : defaultModel;
      }

      const finalModel: string = model || defaultModel;
      return { agent, model: finalModel };
    };

    // Apply explicit role overrides from config with safe fallback
    const planner = resolveRole('planner', config?.planner, basePlanner);
    const builder = resolveRole('builder', config?.builder, baseBuilder);
    const reviewer = resolveRole('reviewer', config?.reviewer, baseReviewer);

    // Fixer defaults to same as builder unless explicitly specified
    const fixer = resolveRole('fixer', config?.fixer, builder);

    // Final checker defaults to same as planner unless explicitly specified
    const final_checker = resolveRole(
      'final_checker',
      config?.final_checker || config?.finalChecker,
      planner
    );

    // Quality check: review independence
    const isIndependentReview = reviewer.agent !== builder.agent;
    const independenceWarning = !isIndependentReview
      ? `Reviewer and Builder are both assigned to "${reviewer.agent}". Independent review is disabled (Self-review).`
      : undefined;

    return {
      preset: config?.preset,
      planner,
      builder,
      reviewer,
      fixer,
      finalChecker: final_checker,
      final_checker,
      isIndependentReview,
      independenceWarning,
    };
  }

  /**
   * Load prompt content for role and agent
   */
  public getRolePrompt(stage: WorkflowStage): string {
    const fileMap: Record<string, string> = {
      PLANNING: 'planning.md',
      IMPLEMENTATION: 'implementation.md',
      IMPLEMENTING: 'implementation.md',
      REVIEW: 'review.md',
      REVIEWING: 'review.md',
      FIX: 'fixing.md',
      FIXING: 'fixing.md',
      FINAL_CHECK: 'final-check.md',
      VERIFYING: 'final-check.md',
    };

    const targetFile = path.join(this.promptsDir, 'roles', fileMap[stage] || 'planning.md');
    if (fs.existsSync(targetFile)) {
      return fs.readFileSync(targetFile, 'utf8');
    }

    // Backward compatibility fallback to legacy prompts directory
    const legacyMap: Record<string, string> = {
      PLANNING: 'codex-plan.md',
      IMPLEMENTATION: 'gemini-impl.md',
      IMPLEMENTING: 'gemini-impl.md',
      REVIEW: 'claude-review.md',
      REVIEWING: 'claude-review.md',
      FIX: 'gemini-fix.md',
      FIXING: 'gemini-fix.md',
      FINAL_CHECK: 'codex-final-check.md',
      VERIFYING: 'codex-final-check.md',
    };
    const legacyFile = path.join(this.promptsDir, legacyMap[stage] || 'codex-plan.md');
    if (fs.existsSync(legacyFile)) {
      return fs.readFileSync(legacyFile, 'utf8');
    }

    return `You are performing the ${stage} role in the autonomous multi-agent engineering workflow.`;
  }

  public getAgentInstruction(agentId: AgentId): string {
    const targetFile = path.join(this.promptsDir, 'agents', `${agentId}.md`);
    if (fs.existsSync(targetFile)) {
      return fs.readFileSync(targetFile, 'utf8');
    }
    return '';
  }

  /**
   * Execute a workflow stage through the assigned agent adapter.
   */
  public async execute(
    stage: WorkflowStage,
    context: StageContext
  ): Promise<AgentExecutionResult> {
    const assignment = context.assignment || { agent: 'codex' as AgentId, model: 'gpt-6-astra' };
    const adapter = this.getAdapter(assignment.agent);

    const rolePrompt = this.getRolePrompt(stage);
    const agentInstruction = this.getAgentInstruction(assignment.agent);

    const systemPrompt = [rolePrompt, agentInstruction].filter(Boolean).join('\n\n');

    const expectedSchemaMap: Record<string, 'planning' | 'review' | 'final_check' | 'none'> = {
      PLANNING: 'planning',
      IMPLEMENTATION: 'none',
      IMPLEMENTING: 'none',
      REVIEW: 'review',
      REVIEWING: 'review',
      FIX: 'none',
      FIXING: 'none',
      FINAL_CHECK: 'final_check',
      VERIFYING: 'none',
    };

    const isWriteStage = stage === 'IMPLEMENTATION' || stage === 'IMPLEMENTING' || stage === 'FIX' || stage === 'FIXING';

    const request: AgentExecutionRequest = {
      id: `task-${stage.toLowerCase()}-${Date.now()}`,
      runId: context.runId || 'run',
      role: context.role || 'builder',
      stage,
      model: assignment.model,
      prompt: context.prompt || '',
      systemPrompt,
      workspacePath: context.workspacePath || '.',
      context,
      readOnly: !isWriteStage,
      timeoutMs: isWriteStage ? 15 * 60 * 1000 : 10 * 60 * 1000,
      expectedSchema: expectedSchemaMap[stage] || 'none',
    };

    let result = await adapter.executeStage(request);

    // Operational Fallback: If Reviewer fails due to auth or service error,
    // fallback to another available agent (e.g. Codex) ONLY if configured.
    const isFallbackAllowed = (context.options?.reviewerFallback !== false) && ((context as any).models?.reviewerFallback !== false);

    if (!result.success && stage === 'REVIEW' && assignment.agent !== 'codex' && isFallbackAllowed) {
      console.warn(`[ROUTER] Review stage failed with primary agent "${assignment.agent}" (${result.error}). Attempting operational fallback to Codex reviewer...`);
      try {
        const fallbackAdapter = this.getAdapter('codex');
        const fallbackRequest: AgentExecutionRequest = {
          ...request,
          model: 'gpt-6-astra',
          systemPrompt: [rolePrompt, this.getAgentInstruction('codex')].filter(Boolean).join('\n\n'),
        };
        const fallbackResult = await fallbackAdapter.executeStage(fallbackRequest);
        if (fallbackResult.success) {
          console.log(`[ROUTER] Review fallback to Codex succeeded!`);
          return fallbackResult;
        }
      } catch (fallbackErr: any) {
        console.error(`[ROUTER] Fallback review attempt also failed:`, fallbackErr);
      }
    }

    return result;
  }

  /**
   * Return full agent inventory with capabilities and status.
   */
  public async getAgentInventory(forceRefresh: boolean = false): Promise<Array<{
    id: AgentId;
    name: string;
    ready: boolean;
    authStatus: string;
    capabilities: AgentCapabilities;
  }>> {
    const inventory = [];
    for (const [id, adapter] of this.adapters.entries()) {
      const status = await adapter.getStatus(forceRefresh);
      const capabilities = adapter.getCapabilities();
      inventory.push({
        id,
        name: adapter.name,
        ready: status.ready,
        authStatus: status.authStatus,
        capabilities,
      });
    }
    return inventory;
  }
}
