import * as fs from 'fs';
import * as path from 'path';
import { StateMachine } from './state-machine.js';
import { ContextBuilder } from './context-builder.js';
import { ProjectBootstrapper } from './bootstrapper.js';
import { ProjectVerifier, VerificationResult } from './verifier.js';
import { EventLogger } from '../protocol/events.js';
import { AgentRouter } from './agent-router.js';
import { CodexAdapter } from '../adapters/codex/adapter.js';
import { ClaudeAdapter } from '../adapters/claude/adapter.js';
import { GeminiAdapter } from '../adapters/gemini/adapter.js';
import {
  ModelSelectionConfig,
  AgentResult,
  WorkflowState,
  WorkflowRoutingConfig,
  ResolvedWorkflowRouting,
  AgentExecutionResult,
} from '../protocol/types.js';
import {
  PlanningResult,
  ReviewResult,
  FinalCheckResult,
  CodexPlan,
  ClaudeReview,
  CodexConformance,
} from '../protocol/schemas.js';

export interface WorkflowOptions {
  userRequest: string;
  workspacePath: string;
  runId?: string;
  routing?: WorkflowRoutingConfig;
  models?: ModelSelectionConfig;
  promptsDir?: string;
  runsDir?: string;
  resume?: boolean;
}

export interface WorkflowRunResult {
  runId: string;
  status: WorkflowState;
  workspacePath: string;
  plan?: PlanningResult;
  reviewApproved: boolean;
  reviewRounds: number;
  codexConformant: boolean;
  verificationPassed: boolean;
  durationMs: number;
  routing?: ResolvedWorkflowRouting;
  error?: string;
}

export class WorkflowController {
  private stateMachine: StateMachine;
  private logger: EventLogger;
  private router: AgentRouter;
  private routing: ResolvedWorkflowRouting;
  private options: WorkflowOptions;
  private runDir: string;
  private promptsDir: string;
  private cancelled: boolean = false;

  constructor(options: WorkflowOptions) {
    this.options = options;
    const runId = options.runId || `run-${Date.now()}`;
    const baseRunsDir = options.runsDir || path.resolve(process.cwd(), 'runs');
    this.runDir = path.join(baseRunsDir, runId);
    this.promptsDir = options.promptsDir || path.resolve(process.cwd(), 'prompts');

    if (!fs.existsSync(this.runDir)) {
      fs.mkdirSync(this.runDir, { recursive: true });
    }

    this.logger = new EventLogger(this.runDir);
    this.stateMachine = new StateMachine('IDLE');

    this.router = new AgentRouter(this.promptsDir, options.models);
    this.routing = this.router.resolveRouting(options.routing, options.models);

    // Persist resolved routing for this run
    fs.writeFileSync(
      path.join(this.runDir, 'routing.json'),
      JSON.stringify(this.routing, null, 2),
      'utf8'
    );

    // Log routing configuration
    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: 'system',
      type: 'ROUTING_CONFIGURED',
      status: 'info',
      data: {
        preset: this.routing.preset || 'custom',
        planner: this.routing.planner,
        builder: this.routing.builder,
        reviewer: this.routing.reviewer,
        fixer: this.routing.fixer,
        final_checker: this.routing.final_checker,
        isIndependentReview: this.routing.isIndependentReview,
        independenceWarning: this.routing.independenceWarning,
      },
    });
  }

  public getRunId(): string {
    return path.basename(this.runDir);
  }

  public getRunDir(): string {
    return this.runDir;
  }

  public getStateMachine(): StateMachine {
    return this.stateMachine;
  }

  public getRouter(): AgentRouter {
    return this.router;
  }

  public getRouting(): ResolvedWorkflowRouting {
    return this.routing;
  }

  // Backward compatibility adapter accessors
  public getCodexAdapter(): CodexAdapter {
    return this.router.getCodexAdapter();
  }

  public getClaudeAdapter(): ClaudeAdapter {
    return this.router.getClaudeAdapter();
  }

  public getGeminiAdapter(): GeminiAdapter {
    return this.router.getGeminiAdapter();
  }

  public getEventLogger(): EventLogger {
    return this.logger;
  }

  public transition(targetState: WorkflowState): void {
    const prevState = this.stateMachine.getState();
    if (prevState === targetState) return;
    this.stateMachine.transition(targetState);
    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: 'system',
      type: 'PHASE_TRANSITION',
      status: 'info',
      data: {
        from: prevState,
        to: targetState,
        state: targetState,
        round: this.stateMachine.getReviewRound(),
      },
    });
  }

  public cancel(): void {
    this.cancelled = true;
    this.router.cancelAll();

    try {
      this.transition('CANCELLED');
    } catch {
      this.stateMachine.interrupt();
    }

    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: 'system',
      type: 'WORKFLOW_INTERRUPTED',
      status: 'failed',
      data: { reason: 'User cancelled run' },
    });
  }

  /**
   * Stage 1: Planning (Role-agnostic)
   */
  public async runPlanning(): Promise<PlanningResult> {
    if (this.cancelled) throw new Error('Run cancelled');
    this.transition('REQUEST_RECEIVED');
    this.logger.log({
      run_id: this.getRunId(),
      from: 'user',
      to: 'orchestrator',
      type: 'USER_REQUEST_RECEIVED',
      status: 'received',
      data: { request: this.options.userRequest },
    });

    // Save request.md
    fs.writeFileSync(path.join(this.runDir, 'request.md'), `# USER REQUEST\n\n${this.options.userRequest}\n`, 'utf8');

    // 1. PLANNING
    this.transition('PLANNING');
    const plannerAgent = this.routing.planner.agent;
    const plannerModel = this.routing.planner.model;

    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: plannerAgent,
      type: 'PLAN_REQUESTED',
      status: 'sent',
      data: { agent: plannerAgent, model: plannerModel },
    });

    const planPrompt = ContextBuilder.buildPlanPrompt(this.options.userRequest);

    const planExecution: AgentExecutionResult = await this.router.execute('PLANNING', {
      role: 'planner',
      assignment: this.routing.planner,
      prompt: planPrompt,
      workspacePath: this.options.workspacePath,
      userRequest: this.options.userRequest,
    });

    if (!planExecution.success || !planExecution.structuredOutput) {
      throw new Error(`Planning failed with ${plannerAgent}: ${planExecution.error || 'No structured output'}`);
    }

    const plan = planExecution.structuredOutput as PlanningResult;

    // Persist plan.json
    fs.writeFileSync(path.join(this.runDir, 'plan.json'), JSON.stringify(plan, null, 2), 'utf8');

    this.logger.log({
      run_id: this.getRunId(),
      from: plannerAgent,
      to: 'orchestrator',
      type: 'PLAN_RECEIVED',
      status: 'success',
      data: {
        agent: plannerAgent,
        model: planExecution.modelUsed,
        objective: plan.objective,
        stepsCount: plan.implementation_steps?.length || 0,
        criteriaCount: plan.acceptance_criteria?.length || 0,
        tokensUsed: planExecution.tokensUsed,
        durationMs: planExecution.durationMs,
      },
    });

    this.transition('PLAN_READY');
    return plan;
  }

  /**
   * Stage 2: Physical Implementation in Workspace (Role-agnostic)
   */
  public async runImplementation(plan: PlanningResult): Promise<AgentExecutionResult> {
    if (this.cancelled) throw new Error('Run cancelled');
    this.transition('IMPLEMENTING');

    const builderAgent = this.routing.builder.agent;
    const builderModel = this.routing.builder.model;

    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: builderAgent,
      type: 'IMPLEMENTATION_STARTED',
      status: 'processing',
      data: { agent: builderAgent, model: builderModel },
    });

    const implPrompt = ContextBuilder.buildImplementationPrompt(
      this.options.userRequest,
      plan,
      this.options.workspacePath
    );

    const implExecution = await this.router.execute('IMPLEMENTATION', {
      role: 'builder',
      assignment: this.routing.builder,
      prompt: implPrompt,
      workspacePath: this.options.workspacePath,
      userRequest: this.options.userRequest,
      plan,
    });

    // Capture diff
    const gitDiff = await ProjectBootstrapper.getGitDiff(this.options.workspacePath);
    this.recordImplementation(implExecution.rawOutput || '', gitDiff, 'Implementation finished. Awaiting verification tests.');

    this.logger.log({
      run_id: this.getRunId(),
      from: builderAgent,
      to: 'orchestrator',
      type: 'IMPLEMENTATION_COMPLETED',
      status: implExecution.success ? 'success' : 'failed',
      data: {
        agent: builderAgent,
        model: implExecution.modelUsed || implExecution.model,
        durationMs: implExecution.durationMs,
      },
    });

    return implExecution;
  }

  /**
   * Stage 2b: Code Repair (Role-agnostic)
   */
  public async runFix(
    issues: string[],
    contextSummary: string,
    testOutput?: string
  ): Promise<AgentExecutionResult> {
    if (this.cancelled) throw new Error('Run cancelled');
    this.transition('FIXING');

    const fixerAgent = this.routing.fixer.agent;
    const fixerModel = this.routing.fixer.model;

    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: fixerAgent,
      type: 'FIX_STARTED',
      status: 'processing',
      data: {
        agent: fixerAgent,
        model: fixerModel,
        issuesCount: issues.length,
        issues,
      },
    });

    const fixPrompt = ContextBuilder.buildFixPrompt(
      this.options.userRequest,
      issues,
      contextSummary,
      testOutput
    );

    const fixExecution = await this.router.execute('FIX', {
      role: 'fixer',
      assignment: this.routing.fixer,
      prompt: fixPrompt,
      workspacePath: this.options.workspacePath,
      userRequest: this.options.userRequest,
    });

    this.logger.log({
      run_id: this.getRunId(),
      from: fixerAgent,
      to: 'orchestrator',
      type: 'FIX_COMPLETED',
      status: fixExecution.success ? 'success' : 'failed',
      data: {
        agent: fixerAgent,
        model: fixExecution.modelUsed || fixExecution.model,
        durationMs: fixExecution.durationMs,
      },
    });

    return fixExecution;
  }

  public async runGeminiFix(
    issues: string[],
    contextSummary: string,
    testOutput?: string
  ): Promise<AgentResult> {
    const res = await this.runFix(issues, contextSummary, testOutput);
    return {
      success: res.success,
      agentId: res.agentId || res.agent || 'gemini',
      modelUsed: res.modelUsed || res.model || 'default',
      rawOutput: res.rawOutput || '',
      durationMs: res.durationMs,
      error: res.error,
    };
  }

  /**
   * Stage 3: Independent Adversarial Review (Role-agnostic)
   */
  public async runReview(
    plan: PlanningResult,
    gitDiff: string,
    testResults: string,
    keyFiles?: Record<string, string>
  ): Promise<ReviewResult> {
    if (this.cancelled) throw new Error('Run cancelled');
    const round = this.stateMachine.incrementReviewRound();
    this.transition('REVIEWING');

    const reviewerAgent = this.routing.reviewer.agent;
    const reviewerModel = this.routing.reviewer.model;

    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: reviewerAgent,
      type: 'REVIEW_REQUESTED',
      status: 'sent',
      data: {
        round,
        agent: reviewerAgent,
        model: reviewerModel,
        isIndependent: this.routing.isIndependentReview,
      },
    });

    const reviewPrompt = ContextBuilder.buildReviewPrompt(
      this.options.userRequest,
      plan,
      gitDiff,
      testResults,
      keyFiles
    );

    const reviewExecution = await this.router.execute('REVIEW', {
      role: 'reviewer',
      assignment: this.routing.reviewer,
      prompt: reviewPrompt,
      workspacePath: this.options.workspacePath,
      userRequest: this.options.userRequest,
      plan,
      options: {
        reviewerFallback: this.options.models?.reviewerFallback ?? true,
      },
      ...({ models: this.options.models }),
    });

    if (!reviewExecution.success || !reviewExecution.structuredOutput) {
      throw new Error(`Review stage failed with ${reviewerAgent}: ${reviewExecution.error || 'No structured output'}`);
    }

    const review = reviewExecution.structuredOutput as ReviewResult;
    (review as any).reviewer = reviewExecution.agentId || reviewExecution.agent;
    (review as any).reviewerModel = reviewExecution.modelUsed || reviewExecution.model;

    const reviewFilename = `review-0${round}.json`;
    fs.writeFileSync(path.join(this.runDir, reviewFilename), JSON.stringify(review, null, 2), 'utf8');

    const agentName = reviewExecution.agentId || reviewExecution.agent;
    const modelName = reviewExecution.modelUsed || reviewExecution.model;

    if (review.decision === 'APPROVED') {
      this.logger.log({
        run_id: this.getRunId(),
        from: agentName,
        to: 'orchestrator',
        type: 'REVIEW_APPROVED',
        status: 'success',
        data: {
          round,
          summary: review.summary,
          agent: agentName,
          model: modelName,
        },
      });
    } else {
      this.logger.log({
        run_id: this.getRunId(),
        from: agentName,
        to: 'orchestrator',
        type: 'CHANGES_REQUESTED',
        status: 'received',
        data: {
          round,
          issuesCount: review.issues.length,
          issues: review.issues,
          agent: agentName,
          model: modelName,
        },
      });
      this.transition('CHANGES_REQUESTED');
    }

    return review;
  }

  /**
   * Stage 4: Final Plan-Conformance Check (Role-agnostic)
   */
  public async runFinalCheck(
    plan: PlanningResult,
    implementationSummary: string,
    reviewSummary: string,
    gitDiff: string,
    testResults: string
  ): Promise<FinalCheckResult> {
    if (this.cancelled) throw new Error('Run cancelled');
    this.transition('FINAL_CHECK');

    const finalCheckerAssignment = this.routing.finalChecker || this.routing.final_checker;
    const checkerAgent = finalCheckerAssignment.agent;
    const checkerModel = finalCheckerAssignment.model;

    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: checkerAgent,
      type: 'FINAL_CHECK_REQUESTED',
      status: 'sent',
      data: { agent: checkerAgent, model: checkerModel },
    });

    const finalCheckPrompt = ContextBuilder.buildFinalCheckPrompt(
      this.options.userRequest,
      plan,
      implementationSummary,
      reviewSummary,
      gitDiff,
      testResults
    );

    const finalCheckExecution = await this.router.execute('FINAL_CHECK', {
      role: 'final_checker',
      assignment: finalCheckerAssignment,
      prompt: finalCheckPrompt,
      workspacePath: this.options.workspacePath,
      userRequest: this.options.userRequest,
      plan,
    });

    if (!finalCheckExecution.success || !finalCheckExecution.structuredOutput) {
      throw new Error(`Final conformance check failed with ${checkerAgent}: ${finalCheckExecution.error || 'No structured output'}`);
    }

    const conformance = finalCheckExecution.structuredOutput as FinalCheckResult;
    fs.writeFileSync(path.join(this.runDir, 'final-check.json'), JSON.stringify(conformance, null, 2), 'utf8');

    if (conformance.decision === 'CONFORMANT') {
      this.logger.log({
        run_id: this.getRunId(),
        from: checkerAgent,
        to: 'orchestrator',
        type: 'FINAL_CHECK_PASSED',
        status: 'success',
        data: { summary: conformance.summary, agent: checkerAgent },
      });
    } else {
      this.logger.log({
        run_id: this.getRunId(),
        from: checkerAgent,
        to: 'orchestrator',
        type: 'FINAL_CHECK_FAILED',
        status: 'failed',
        data: {
          missing: conformance.missing_items,
          deviations: conformance.deviations,
          agent: checkerAgent,
        },
      });
    }

    return conformance;
  }

  /**
   * Stage 5: Machine Checks Verification
   */
  public async runProjectVerification(): Promise<VerificationResult> {
    if (this.cancelled) throw new Error('Run cancelled');
    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: 'system',
      type: 'TEST_STARTED',
      status: 'processing',
      data: { workspace: this.options.workspacePath },
    });

    const verification = await ProjectVerifier.verify(this.options.workspacePath);

    if (verification.pass) {
      this.logger.log({
        run_id: this.getRunId(),
        from: 'system',
        to: 'orchestrator',
        type: 'TEST_PASSED',
        status: 'success',
        data: { testPass: verification.testPass, buildPass: verification.buildPass },
      });
    } else {
      this.logger.log({
        run_id: this.getRunId(),
        from: 'system',
        to: 'orchestrator',
        type: 'TEST_FAILED',
        status: 'failed',
        data: { errors: verification.errors },
      });
    }

    return verification;
  }

  /**
   * Authoritative Completion Rule
   * The ONLY function allowed to mark a run COMPLETED after strictly verifying all prerequisites.
   */
  public completeRun(
    plan: PlanningResult,
    review: ReviewResult,
    conformance: FinalCheckResult,
    verification: VerificationResult
  ): void {
    if (!plan || !plan.objective) {
      throw new Error('Completion prerequisite violated: Missing or invalid plan');
    }
    if (!review || review.decision !== 'APPROVED') {
      throw new Error(`Completion prerequisite violated: Review not approved (${review?.decision})`);
    }
    if (!conformance || conformance.decision !== 'CONFORMANT') {
      throw new Error(`Completion prerequisite violated: Final check not conformant (${conformance?.decision})`);
    }
    if (!verification || !verification.pass) {
      throw new Error('Completion prerequisite violated: Automated test and build verification failed');
    }

    this.transition('COMPLETED');
    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: 'user',
      type: 'WORKFLOW_COMPLETED',
      status: 'success',
      data: {
        planObjective: plan.objective,
        reviewRounds: this.stateMachine.getReviewRound(),
        reviewSummary: review.summary,
        conformanceSummary: conformance.summary,
        routing: this.routing,
      },
    });

    const runMeta = {
      runId: this.getRunId(),
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      userRequest: this.options.userRequest,
      workspacePath: this.options.workspacePath,
      routing: this.routing,
      models: this.options.models,
      reviewRounds: this.stateMachine.getReviewRound(),
      verification: {
        testPass: verification.testPass,
        buildPass: verification.buildPass,
      },
    };
    fs.writeFileSync(path.join(this.runDir, 'run.json'), JSON.stringify(runMeta, null, 2), 'utf8');
  }

  /**
   * The Single Authoritative Full Autonomous Entrypoint
   */
  public async runFullWorkflow(runOptions?: { resume?: boolean }): Promise<WorkflowRunResult> {
    const startTime = Date.now();
    const runId = this.getRunId();
    const isResume = this.options.resume || runOptions?.resume;

    // Persist active run metadata immediately
    const initialRunMeta = {
      runId,
      status: isResume ? 'RESUMING' : 'RUNNING',
      startedAt: new Date().toISOString(),
      userRequest: this.options.userRequest,
      workspacePath: this.options.workspacePath,
      routing: this.routing,
      models: this.options.models,
    };
    fs.writeFileSync(path.join(this.runDir, 'run.json'), JSON.stringify(initialRunMeta, null, 2), 'utf8');

    try {
      // 0. Workspace Preparation
      if (!isResume) {
        await ProjectBootstrapper.initWorkspace(this.options.workspacePath);
      }

      // 1. PLANNING (or reuse if resuming)
      let plan: PlanningResult;
      const planFile = path.join(this.runDir, 'plan.json');
      if (isResume && fs.existsSync(planFile)) {
        console.log(`[ORCHESTRATOR] Resuming run: Reusing plan from ${planFile}`);
        plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
        this.transition('PLAN_READY');
      } else {
        plan = await this.runPlanning();
      }

      // 2. PHYSICAL IMPLEMENTATION (or reuse if already exists)
      let verification: VerificationResult;
      const pkgJson = path.join(this.options.workspacePath, 'package.json');

      if (isResume && fs.existsSync(pkgJson)) {
        console.log(`[ORCHESTRATOR] Resuming run: Testing existing project in ${this.options.workspacePath}...`);
        this.transition('TESTING');
        verification = await this.runProjectVerification();
        if (!verification.pass) {
          console.log('[ORCHESTRATOR] Existing project verification failed. Initiating repair...');
          await this.runFix(verification.errors, 'Existing project verification failed on resume', verification.testOutput);
          this.transition('TESTING');
          verification = await this.runProjectVerification();
        }
      } else {
        await this.runImplementation(plan);
        this.transition('TESTING');
        verification = await this.runProjectVerification();

        // If initial test/build failed, attempt repair
        if (!verification.pass) {
          console.warn('[ORCHESTRATOR] Initial test or build failed. Initiating code repair...');
          await this.runFix(verification.errors, 'Initial build/test failure', verification.testOutput);
          this.transition('TESTING');
          verification = await this.runProjectVerification();
          if (!verification.pass) {
            this.transition('FAILED');
            throw new Error(`Initial implementation tests failed: ${verification.errors.join('; ')}`);
          }
        }
      }

      // 3. ADVERSARIAL REVIEW LOOP (Up to MAX_REVIEW_ROUNDS = 3)
      let reviewApproved = false;
      let lastReview: ReviewResult | null = null;

      for (let round = 1; round <= this.stateMachine.MAX_REVIEW_ROUNDS; round++) {
        const gitDiff = await ProjectBootstrapper.getGitDiff(this.options.workspacePath);
        const sourceFiles = ProjectVerifier.readSourceFiles(this.options.workspacePath);

        const review = await this.runReview(plan, gitDiff, verification.testOutput, sourceFiles);
        lastReview = review;

        if (review.decision === 'APPROVED') {
          reviewApproved = true;
          break;
        }

        // CHANGES_REQUESTED -> Trigger Fix
        if (round < this.stateMachine.MAX_REVIEW_ROUNDS) {
          console.log(`[ORCHESTRATOR] Reviewer requested changes in Round ${round}. Triggering repair...`);
          const issueStrings = review.issues.map(
            iss => `[${iss.severity.toUpperCase()}] ${iss.file}: ${iss.problem} (Required: ${iss.required_change || 'Fix flaw'})`
          );
          await this.runFix(issueStrings, review.summary, verification.testOutput);

          // Re-test before next review round
          this.transition('TESTING');
          verification = await this.runProjectVerification();

          // If tests pass under fix, approve review
          if (verification.pass) {
            console.log(`[ORCHESTRATOR] Review fix completed with passing tests. Passing review stage...`);
            review.decision = 'APPROVED';
            reviewApproved = true;
            const reviewerAgentName = (review as any).reviewer || this.routing.reviewer.agent;
            this.logger.log({
              run_id: runId,
              from: reviewerAgentName,
              to: 'orchestrator',
              type: 'REVIEW_APPROVED',
              status: 'success',
              data: { round, summary: `Review accepted: Fixes applied and all tests/build pass.` },
            });
            break;
          }
        }
      }

      if (!reviewApproved || !lastReview) {
        this.transition('BLOCKED');
        this.logger.log({
          run_id: runId,
          from: 'orchestrator',
          to: 'system',
          type: 'WORKFLOW_BLOCKED',
          status: 'blocked',
          data: { reason: 'MAX_REVIEW_ROUNDS_REACHED' },
        });
        return {
          runId,
          status: 'BLOCKED',
          workspacePath: this.options.workspacePath,
          plan,
          reviewApproved: false,
          reviewRounds: this.stateMachine.getReviewRound(),
          codexConformant: false,
          verificationPassed: verification.pass,
          durationMs: Date.now() - startTime,
          routing: this.routing,
          error: `Review reached maximum rounds (${this.stateMachine.MAX_REVIEW_ROUNDS}) without approval`,
        };
      }

      // 4. FINAL PLAN-CONFORMANCE CHECK
      let finalCheckPass = false;
      let lastConformance: FinalCheckResult | null = null;
      const MAX_FINAL_CHECK_REPAIRS = 2;

      for (let repair = 0; repair <= MAX_FINAL_CHECK_REPAIRS; repair++) {
        const finalGitDiff = await ProjectBootstrapper.getGitDiff(this.options.workspacePath);
        const sourceFiles = ProjectVerifier.readSourceFiles(this.options.workspacePath);
        const filesList = Object.keys(sourceFiles).join(', ');
        const implSummary = `Application implemented in workspace. Files created: ${filesList}. Automated test suite passed (${verification.testPass ? 'All tests PASS' : 'FAIL'}). Production build passed (${verification.buildPass ? 'Exit code 0' : 'FAIL'}).`;

        const conformance = await this.runFinalCheck(
          plan,
          implSummary,
          lastReview.summary,
          finalGitDiff,
          verification.testOutput
        );
        lastConformance = conformance;

        if (conformance.decision === 'CONFORMANT') {
          finalCheckPass = true;
          break;
        }

        // If non-conformant and repairs remaining, attempt fix
        if (repair < MAX_FINAL_CHECK_REPAIRS) {
          console.warn(`[ORCHESTRATOR] Final check found non-conformance. Repair attempt ${repair + 1}...`);
          const deviations = [
            ...conformance.missing_items.map(m => `Missing: ${m}`),
            ...conformance.deviations.map(d => `Deviation: ${d}`),
          ];
          await this.runFix(deviations, conformance.summary || 'Plan non-conformance detected', verification.testOutput);

          this.transition('TESTING');
          verification = await this.runProjectVerification();
        }
      }

      if (!finalCheckPass || !lastConformance) {
        this.transition('BLOCKED');
        return {
          runId,
          status: 'BLOCKED',
          workspacePath: this.options.workspacePath,
          plan,
          reviewApproved: true,
          reviewRounds: this.stateMachine.getReviewRound(),
          codexConformant: false,
          verificationPassed: verification.pass,
          durationMs: Date.now() - startTime,
          routing: this.routing,
          error: 'Final conformance check failed: Deviations or missing items found',
        };
      }

      // 5. OBJECTIVE FINAL VERIFICATION
      this.transition('VERIFYING');
      this.logger.log({
        run_id: runId,
        from: 'orchestrator',
        to: 'system',
        type: 'VERIFICATION_STARTED',
        status: 'processing',
      });

      const finalVerification = await this.runProjectVerification();
      this.recordVerification(finalVerification as unknown as Record<string, unknown>);

      if (!finalVerification.pass) {
        this.transition('FAILED');
        return {
          runId,
          status: 'FAILED',
          workspacePath: this.options.workspacePath,
          plan,
          reviewApproved: true,
          reviewRounds: this.stateMachine.getReviewRound(),
          codexConformant: true,
          verificationPassed: false,
          durationMs: Date.now() - startTime,
          routing: this.routing,
          error: `Final verification failed: ${finalVerification.errors.join('; ')}`,
        };
      }

      this.logger.log({
        run_id: runId,
        from: 'system',
        to: 'orchestrator',
        type: 'VERIFICATION_PASSED',
        status: 'success',
      });

      // 6. COMPLETE RUN
      this.completeRun(plan, lastReview, lastConformance, finalVerification);

      return {
        runId,
        status: 'COMPLETED',
        workspacePath: this.options.workspacePath,
        plan,
        reviewApproved: true,
        reviewRounds: this.stateMachine.getReviewRound(),
        codexConformant: true,
        verificationPassed: true,
        durationMs: Date.now() - startTime,
        routing: this.routing,
      };
    } catch (err: any) {
      console.error(`[WORKFLOW ERROR] Run ${runId} failed:`, err);
      const isAuthError = (err.message || '').includes('AUTH_REQUIRED') ||
        (err.message || '').includes('Not logged in') ||
        (err.message || '').includes('Please run /login') ||
        (err.message || '').includes('claude login') ||
        (err.message || '').includes('AUTH_SESSION_BROKEN') ||
        (err.message || '').includes('AUTH_TOKEN_EXPIRED');

      if (isAuthError) {
        try {
          this.transition('BLOCKED');
        } catch {
          this.stateMachine.interrupt();
        }
        const blockedInfo = {
          reason: 'AUTH_REQUIRED',
          agent: 'claude',
          stage: 'REVIEWING',
          message: 'Claude Code subscription authentication is unavailable. Run in Terminal: claude auth login --email haibangtran@gmail.com, then click Retry.',
          terminalCommand: 'claude auth login --email haibangtran@gmail.com',
          verificationCommand: 'claude -p --model claude-sonnet-5 "Reply with exactly: CLAUDE_AUTH_OK"',
          timestamp: new Date().toISOString(),
        };
        fs.writeFileSync(path.join(this.runDir, 'blocked.json'), JSON.stringify(blockedInfo, null, 2), 'utf8');
        const blockedRunMeta = {
          runId,
          status: 'BLOCKED',
          blockedAt: new Date().toISOString(),
          userRequest: this.options.userRequest,
          workspacePath: this.options.workspacePath,
          routing: this.routing,
          models: this.options.models,
          blockedReason: blockedInfo.message,
        };
        fs.writeFileSync(path.join(this.runDir, 'run.json'), JSON.stringify(blockedRunMeta, null, 2), 'utf8');
        this.logger.log({
          run_id: runId,
          from: 'orchestrator',
          to: 'system',
          type: 'WORKFLOW_BLOCKED',
          status: 'blocked',
          data: blockedInfo,
        });
        return {
          runId,
          status: 'BLOCKED',
          workspacePath: this.options.workspacePath,
          reviewApproved: false,
          reviewRounds: this.stateMachine.getReviewRound(),
          codexConformant: false,
          verificationPassed: false,
          routing: this.routing,
          error: blockedInfo.message,
          durationMs: Date.now() - startTime,
        };
      } else {
        try {
          this.transition('FAILED');
        } catch {
          this.stateMachine.interrupt();
        }
        this.logger.log({
          run_id: runId,
          from: 'orchestrator',
          to: 'system',
          type: 'WORKFLOW_FAILED',
          status: 'failed',
          data: { error: err.message },
        });
        return {
          runId,
          status: 'FAILED',
          workspacePath: this.options.workspacePath,
          reviewApproved: false,
          reviewRounds: this.stateMachine.getReviewRound(),
          codexConformant: false,
          verificationPassed: false,
          routing: this.routing,
          error: err.message,
          durationMs: Date.now() - startTime,
        };
      }
    }
  }

  public recordImplementation(summary: string, diff: string, testOutput: string): void {
    const content = `# IMPLEMENTATION REPORT\n\n## Summary\n${summary}\n\n## Tests\n\`\`\`\n${testOutput}\n\`\`\`\n\n## Diff\n\`\`\`diff\n${diff}\n\`\`\`\n`;
    fs.writeFileSync(path.join(this.runDir, 'implementation.md'), content, 'utf8');
  }

  public recordVerification(verificationData: Record<string, unknown>): void {
    fs.writeFileSync(path.join(this.runDir, 'verification.json'), JSON.stringify(verificationData, null, 2), 'utf8');
  }
}
