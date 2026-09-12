import * as fs from 'fs';
import * as path from 'path';
import { StateMachine } from './state-machine.js';
import { ContextBuilder } from './context-builder.js';
import { ProjectBootstrapper } from './bootstrapper.js';
import { ProjectVerifier, VerificationResult } from './verifier.js';
import { EventLogger } from '../protocol/events.js';
import { CodexAdapter } from '../adapters/codex/adapter.js';
import { ClaudeAdapter } from '../adapters/claude/adapter.js';
import { GeminiAdapter } from '../adapters/gemini/adapter.js';
import { ModelSelectionConfig, AgentResult, WorkflowState } from '../protocol/types.js';
import { CodexPlan, ClaudeReview, CodexConformance } from '../protocol/schemas.js';

export interface WorkflowOptions {
  userRequest: string;
  workspacePath: string;
  runId?: string;
  models?: ModelSelectionConfig;
  promptsDir?: string;
  runsDir?: string;
  resume?: boolean;
}

export interface WorkflowRunResult {
  runId: string;
  status: WorkflowState;
  workspacePath: string;
  plan?: CodexPlan;
  reviewApproved: boolean;
  reviewRounds: number;
  codexConformant: boolean;
  verificationPassed: boolean;
  durationMs: number;
  error?: string;
}

export class WorkflowController {
  private stateMachine: StateMachine;
  private logger: EventLogger;
  private codexAdapter: CodexAdapter;
  private claudeAdapter: ClaudeAdapter;
  private geminiAdapter: GeminiAdapter;
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
    this.codexAdapter = new CodexAdapter(options.models);
    this.claudeAdapter = new ClaudeAdapter(options.models);
    this.geminiAdapter = new GeminiAdapter(options.models);
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

  public getCodexAdapter(): CodexAdapter {
    return this.codexAdapter;
  }

  public getClaudeAdapter(): ClaudeAdapter {
    return this.claudeAdapter;
  }

  public getGeminiAdapter(): GeminiAdapter {
    return this.geminiAdapter;
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
    this.codexAdapter.cancel();
    this.claudeAdapter.cancel();
    this.geminiAdapter.cancel();

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
   * Phase 1: Codex Planning
   */
  public async runPlanning(): Promise<CodexPlan> {
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

    // 1. CODEX PLANNING
    this.transition('PLANNING');
    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: 'codex',
      type: 'PLAN_REQUESTED',
      status: 'sent',
      data: { model: this.options.models?.codexModel || 'default' },
    });

    const codexSystemPrompt = fs.readFileSync(path.join(this.promptsDir, 'codex-plan.md'), 'utf8');
    const planPrompt = ContextBuilder.buildCodexPlanPrompt(this.options.userRequest);

    const planResult: AgentResult = await this.codexAdapter.execute(
      {
        id: 'task-plan',
        type: 'planning',
        prompt: planPrompt,
        systemPrompt: codexSystemPrompt,
        modelOverride: this.options.models?.codexModel,
      },
      {
        runId: this.getRunId(),
        workspacePath: this.options.workspacePath,
        userRequest: this.options.userRequest,
      }
    );

    if (!planResult.success || !planResult.structuredOutput) {
      this.transition('BLOCKED');
      this.logger.log({
        run_id: this.getRunId(),
        from: 'codex',
        to: 'orchestrator',
        type: 'WORKFLOW_BLOCKED',
        status: 'blocked',
        data: { error: planResult.error, raw: planResult.rawOutput.slice(0, 500) },
      });
      throw new Error(`Codex planning failed: ${planResult.error}`);
    }

    const plan = planResult.structuredOutput as CodexPlan;
    fs.writeFileSync(path.join(this.runDir, 'plan.json'), JSON.stringify(plan, null, 2), 'utf8');

    this.logger.log({
      run_id: this.getRunId(),
      from: 'codex',
      to: 'orchestrator',
      type: 'PLAN_RECEIVED',
      status: 'success',
      data: {
        objective: plan.objective,
        stepsCount: plan.implementation_steps.length,
        criteriaCount: plan.acceptance_criteria.length,
        tokensUsed: planResult.tokensUsed,
        durationMs: planResult.durationMs,
      },
    });

    this.transition('PLAN_READY');
    return plan;
  }

  /**
   * Phase 2: Gemini Physical Implementation in Workspace
   */
  public async runImplementation(plan: CodexPlan): Promise<AgentResult> {
    if (this.cancelled) throw new Error('Run cancelled');
    this.transition('IMPLEMENTING');
    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: 'gemini',
      type: 'IMPLEMENTATION_STARTED',
      status: 'processing',
      data: { model: this.options.models?.geminiModel || 'gemini-3.8-flash' },
    });

    const geminiSystemPrompt = fs.existsSync(path.join(this.promptsDir, 'gemini-impl.md'))
      ? fs.readFileSync(path.join(this.promptsDir, 'gemini-impl.md'), 'utf8')
      : 'You are the primary Code Implementation Agent.';

    const implPrompt = ContextBuilder.buildGeminiImplPrompt(
      this.options.userRequest,
      plan,
      this.options.workspacePath
    );

    const implResult = await this.geminiAdapter.execute(
      {
        id: 'task-implementation',
        type: 'planning', // agy handles generic execution
        prompt: `${geminiSystemPrompt}\n\n${implPrompt}`,
        modelOverride: this.options.models?.geminiModel,
      },
      {
        runId: this.getRunId(),
        workspacePath: this.options.workspacePath,
        userRequest: this.options.userRequest,
        plan,
      }
    );

    // Capture diff
    const gitDiff = await ProjectBootstrapper.getGitDiff(this.options.workspacePath);
    this.recordImplementation(implResult.rawOutput, gitDiff, 'Implementation finished. Awaiting verification tests.');

    this.logger.log({
      run_id: this.getRunId(),
      from: 'gemini',
      to: 'orchestrator',
      type: 'IMPLEMENTATION_COMPLETED',
      status: implResult.success ? 'success' : 'failed',
      data: { durationMs: implResult.durationMs },
    });

    return implResult;
  }

  /**
   * Phase 2b: Gemini Code Repair
   */
  public async runGeminiFix(
    issues: string[],
    contextSummary: string,
    testOutput?: string
  ): Promise<AgentResult> {
    if (this.cancelled) throw new Error('Run cancelled');
    this.transition('FIXING');
    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: 'gemini',
      type: 'FIX_STARTED',
      status: 'processing',
      data: { issuesCount: issues.length, issues },
    });

    const geminiFixSystemPrompt = fs.existsSync(path.join(this.promptsDir, 'gemini-fix.md'))
      ? fs.readFileSync(path.join(this.promptsDir, 'gemini-fix.md'), 'utf8')
      : 'You are the Code Repair Agent.';

    const fixPrompt = ContextBuilder.buildGeminiFixPrompt(
      this.options.userRequest,
      issues,
      contextSummary,
      testOutput
    );

    const fixResult = await this.geminiAdapter.execute(
      {
        id: `task-fix-${Date.now()}`,
        type: 'planning',
        prompt: `${geminiFixSystemPrompt}\n\n${fixPrompt}`,
        modelOverride: this.options.models?.geminiModel,
      },
      {
        runId: this.getRunId(),
        workspacePath: this.options.workspacePath,
        userRequest: this.options.userRequest,
      }
    );

    this.logger.log({
      run_id: this.getRunId(),
      from: 'gemini',
      to: 'orchestrator',
      type: 'FIX_COMPLETED',
      status: fixResult.success ? 'success' : 'failed',
      data: { durationMs: fixResult.durationMs },
    });

    return fixResult;
  }

  /**
   * Phase 3: Claude Code Adversarial Review
   */
  public async runReview(
    plan: CodexPlan,
    gitDiff: string,
    testResults: string,
    keyFiles?: Record<string, string>
  ): Promise<ClaudeReview> {
    if (this.cancelled) throw new Error('Run cancelled');
    const round = this.stateMachine.incrementReviewRound();
    this.transition('REVIEWING');

    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: 'claude',
      type: 'REVIEW_REQUESTED',
      status: 'sent',
      data: { round, model: this.options.models?.claudeModel || 'default' },
    });

    const claudeSystemPrompt = fs.readFileSync(path.join(this.promptsDir, 'claude-review.md'), 'utf8');
    const reviewPrompt = ContextBuilder.buildClaudeReviewPrompt(
      this.options.userRequest,
      plan,
      gitDiff,
      testResults,
      keyFiles
    );

    let reviewResult: AgentResult | null = null;
    let usedFallback = false;
    let claudeErrorReason = '';

    // Check if reviewerFallback is enabled (default: true)
    const allowFallback = this.options.models?.reviewerFallback !== false;

    try {
      reviewResult = await this.claudeAdapter.execute(
        {
          id: `task-review-${round}`,
          type: 'review',
          prompt: reviewPrompt,
          systemPrompt: claudeSystemPrompt,
          modelOverride: this.options.models?.claudeModel,
          timeoutMs: 60000,
        },
        {
          runId: this.getRunId(),
          workspacePath: this.options.workspacePath,
          userRequest: this.options.userRequest,
          plan,
          gitDiff,
          testResults,
          reviewRound: round,
        }
      );
    } catch (claudeErr: any) {
      claudeErrorReason = claudeErr.message;
      reviewResult = {
        success: false,
        agentId: 'claude',
        modelUsed: this.options.models?.claudeModel || 'opus',
        rawOutput: '',
        durationMs: 0,
        error: claudeErr.message,
      };
    }

    if (!reviewResult || !reviewResult.success || !reviewResult.structuredOutput) {
      claudeErrorReason = reviewResult?.error || claudeErrorReason || 'Claude review failed';

      if (allowFallback) {
        console.log(`\n🛡️ [ORCHESTRATOR] Claude review unavailable (${claudeErrorReason}).`);
        console.log(`🔄 [ORCHESTRATOR] Automatic Fallback Triggered: Delegating Adversarial Review to Codex CLI...`);

        this.logger.log({
          run_id: this.getRunId(),
          from: 'orchestrator',
          to: 'codex',
          type: 'REVIEW_FALLBACK_TRIGGERED',
          status: 'warning',
          data: {
            round,
            primaryReviewer: 'claude',
            fallbackReviewer: 'codex',
            reason: claudeErrorReason,
            model: this.options.models?.codexModel || 'gpt-6-astra',
          },
        });

        // Prompt Codex as Adversarial Reviewer
        const codexReviewPrompt = `You are acting as the INDEPENDENT ADVERSARIAL REVIEWER (fallback reviewer) for this project.\nInspect the actual code, git diff, and test results.\nDo not trust implementation claims.\n\n${claudeSystemPrompt}\n\n${reviewPrompt}`;

        const codexReviewResult = await this.codexAdapter.execute(
          {
            id: `task-codex-review-${round}`,
            type: 'review',
            prompt: codexReviewPrompt,
            modelOverride: this.options.models?.codexModel,
          },
          {
            runId: this.getRunId(),
            workspacePath: this.options.workspacePath,
            userRequest: this.options.userRequest,
            plan,
            gitDiff,
            testResults,
            reviewRound: round,
          }
        );

        if (!codexReviewResult.success || !codexReviewResult.structuredOutput) {
          throw new Error(`Both Claude and Codex review failed. Codex error: ${codexReviewResult.error || 'No structured output'}`);
        }

        reviewResult = codexReviewResult;
        usedFallback = true;
      } else {
        if (claudeErrorReason.includes('AUTH_REQUIRED') || claudeErrorReason.includes('Not logged in') || claudeErrorReason.includes('Please run /login')) {
          throw new Error(`AUTH_REQUIRED: Claude Code not logged in. Please run "claude login" in terminal.`);
        }
        throw new Error(`Claude review failed: ${claudeErrorReason}`);
      }
    }

    const review = reviewResult.structuredOutput as ClaudeReview;
    if (usedFallback) {
      (review as any).reviewer = 'codex-fallback';
      (review as any).reviewerModel = reviewResult.modelUsed || this.options.models?.codexModel || 'codex';
    } else {
      (review as any).reviewer = 'claude';
      (review as any).reviewerModel = reviewResult.modelUsed || this.options.models?.claudeModel || 'claude';
    }

    const reviewFilename = `review-0${round}.json`;
    fs.writeFileSync(path.join(this.runDir, reviewFilename), JSON.stringify(review, null, 2), 'utf8');

    const reviewerAgent = usedFallback ? 'codex' : 'claude';

    if (review.decision === 'APPROVED') {
      this.logger.log({
        run_id: this.getRunId(),
        from: reviewerAgent,
        to: 'orchestrator',
        type: 'REVIEW_APPROVED',
        status: 'success',
        data: { round, summary: review.summary, fallback: usedFallback },
      });
    } else {
      this.logger.log({
        run_id: this.getRunId(),
        from: reviewerAgent,
        to: 'orchestrator',
        type: 'CHANGES_REQUESTED',
        status: 'received',
        data: {
          round,
          issuesCount: review.issues.length,
          issues: review.issues,
          fallback: usedFallback,
        },
      });
      this.transition('CHANGES_REQUESTED');
    }

    return review;
  }

  /**
   * Phase 4: Codex Final Conformance Check
   */
  public async runFinalCheck(
    plan: CodexPlan,
    implementationSummary: string,
    claudeSummary: string,
    gitDiff: string,
    testResults: string
  ): Promise<CodexConformance> {
    if (this.cancelled) throw new Error('Run cancelled');
    this.transition('FINAL_CHECK');

    this.logger.log({
      run_id: this.getRunId(),
      from: 'orchestrator',
      to: 'codex',
      type: 'FINAL_CHECK_REQUESTED',
      status: 'sent',
      data: { model: this.options.models?.codexModel || 'default' },
    });

    const finalCheckSystemPrompt = fs.readFileSync(path.join(this.promptsDir, 'codex-final-check.md'), 'utf8');
    const finalCheckPrompt = ContextBuilder.buildCodexFinalCheckPrompt(
      this.options.userRequest,
      plan,
      implementationSummary,
      claudeSummary,
      gitDiff,
      testResults
    );

    const finalCheckResult: AgentResult = await this.codexAdapter.execute(
      {
        id: 'task-final-check',
        type: 'final_check',
        prompt: finalCheckPrompt,
        systemPrompt: finalCheckSystemPrompt,
        modelOverride: this.options.models?.codexModel,
      },
      {
        runId: this.getRunId(),
        workspacePath: this.options.workspacePath,
        userRequest: this.options.userRequest,
        plan,
        gitDiff,
        testResults,
      }
    );

    if (!finalCheckResult.success || !finalCheckResult.structuredOutput) {
      throw new Error(`Codex final conformance check failed: ${finalCheckResult.error}`);
    }

    const conformance = finalCheckResult.structuredOutput as CodexConformance;
    fs.writeFileSync(path.join(this.runDir, 'final-check.json'), JSON.stringify(conformance, null, 2), 'utf8');

    if (conformance.decision === 'CONFORMANT') {
      this.logger.log({
        run_id: this.getRunId(),
        from: 'codex',
        to: 'orchestrator',
        type: 'FINAL_CHECK_PASSED',
        status: 'success',
        data: { summary: conformance.summary },
      });
    } else {
      this.logger.log({
        run_id: this.getRunId(),
        from: 'codex',
        to: 'orchestrator',
        type: 'FINAL_CHECK_FAILED',
        status: 'failed',
        data: { missing: conformance.missing_items, deviations: conformance.deviations },
      });
    }

    return conformance;
  }

  /**
   * Phase 5: Machine Checks Verification
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
   * Authoritative Completion Rule (Section 30)
   * The ONLY function allowed to mark a run COMPLETED after strictly verifying all prerequisites.
   */
  public completeRun(
    plan: CodexPlan,
    claudeReview: ClaudeReview,
    conformance: CodexConformance,
    verification: VerificationResult
  ): void {
    if (!plan || !plan.objective) {
      throw new Error('Completion prerequisite violated: Missing or invalid Codex plan');
    }
    if (!claudeReview || claudeReview.decision !== 'APPROVED') {
      throw new Error(`Completion prerequisite violated: Claude review not approved (${claudeReview?.decision})`);
    }
    if (!conformance || conformance.decision !== 'CONFORMANT') {
      throw new Error(`Completion prerequisite violated: Codex final check not conformant (${conformance?.decision})`);
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
        claudeSummary: claudeReview.summary,
        conformanceSummary: conformance.summary,
      },
    });

    const runMeta = {
      runId: this.getRunId(),
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      userRequest: this.options.userRequest,
      workspacePath: this.options.workspacePath,
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
   * The Single Authoritative Full Autonomous Entrypoint (Section 5 & 6)
   */
  public async runFullWorkflow(runOptions?: { resume?: boolean }): Promise<WorkflowRunResult> {
    const startTime = Date.now();
    const runId = this.getRunId();
    const isResume = this.options.resume || runOptions?.resume;

    try {
      // 0. Workspace Preparation
      if (!isResume) {
        await ProjectBootstrapper.initWorkspace(this.options.workspacePath);
      }

      // 1. CODEX PLANNING (or reuse if resuming)
      let plan: CodexPlan;
      const planFile = path.join(this.runDir, 'plan.json');
      if (isResume && fs.existsSync(planFile)) {
        console.log(`[ORCHESTRATOR] Resuming run: Reusing plan from ${planFile}`);
        plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
        this.transition('PLAN_READY');
      } else {
        plan = await this.runPlanning();
      }

      // 2. GEMINI PHYSICAL IMPLEMENTATION (or reuse if already exists)
      let verification: VerificationResult;
      const pkgJson = path.join(this.options.workspacePath, 'package.json');

      if (isResume && fs.existsSync(pkgJson)) {
        console.log(`[ORCHESTRATOR] Resuming run: Testing existing project in ${this.options.workspacePath}...`);
        this.transition('TESTING');
        verification = await this.runProjectVerification();
        if (!verification.pass) {
          console.log('[ORCHESTRATOR] Existing project verification failed. Initiating Gemini fix...');
          await this.runGeminiFix(verification.errors, 'Existing project verification failed on resume', verification.testOutput);
          this.transition('TESTING');
          verification = await this.runProjectVerification();
        }
      } else {
        await this.runImplementation(plan);
        this.transition('TESTING');
        verification = await this.runProjectVerification();

        // If initial test/build failed, let Gemini attempt repair
        if (!verification.pass) {
          console.warn('[ORCHESTRATOR] Initial test or build failed. Initiating Gemini fix...');
          await this.runGeminiFix(verification.errors, 'Initial build/test failure', verification.testOutput);
          this.transition('TESTING');
          verification = await this.runProjectVerification();
          if (!verification.pass) {
            this.transition('FAILED');
            throw new Error(`Initial implementation tests failed: ${verification.errors.join('; ')}`);
          }
        }
      }

      // 4. CLAUDE CODE ADVERSARIAL REVIEW LOOP (Up to MAX_REVIEW_ROUNDS = 3)
      let reviewApproved = false;
      let lastReview: ClaudeReview | null = null;

      for (let round = 1; round <= this.stateMachine.MAX_REVIEW_ROUNDS; round++) {
        const gitDiff = await ProjectBootstrapper.getGitDiff(this.options.workspacePath);
        const sourceFiles = ProjectVerifier.readSourceFiles(this.options.workspacePath);

        const review = await this.runReview(plan, gitDiff, verification.testOutput, sourceFiles);
        lastReview = review;

        if (review.decision === 'APPROVED') {
          reviewApproved = true;
          break;
        }

        const isFallback = (review as any).reviewer === 'codex-fallback';

        // CHANGES_REQUESTED -> Trigger Gemini Fix
        if (round < this.stateMachine.MAX_REVIEW_ROUNDS) {
          console.log(`[ORCHESTRATOR] Reviewer (${isFallback ? 'Codex Fallback' : 'Claude'}) requested changes in Round ${round}. Triggering Gemini repair...`);
          const issueStrings = review.issues.map(
            iss => `[${iss.severity.toUpperCase()}] ${iss.file}: ${iss.description} (Expected: ${iss.suggested_fix || 'Fix flaw'})`
          );
          await this.runGeminiFix(issueStrings, review.summary, verification.testOutput);

          // Re-test before next review round
          this.transition('TESTING');
          verification = await this.runProjectVerification();

          // USER REQUIREMENT: "trường hợp kẹt thì chuyển về codex review xong thì pass phần review của claude và chuyển sang bước tiếp theo nhé."
          // If fallback reviewer was used, once Gemini has applied the fixes and automated verification (tests + build) passes,
          // mark review approved so we advance directly to Step 5 (Codex Conformance) and Step 6 (Completed)!
          if (isFallback && verification.pass) {
            console.log(`[ORCHESTRATOR] Codex review fallback completed with passing tests. Passing review stage to proceed to Step 5...`);
            review.decision = 'APPROVED';
            reviewApproved = true;
            this.logger.log({
              run_id: runId,
              from: 'codex',
              to: 'orchestrator',
              type: 'REVIEW_APPROVED',
              status: 'success',
              data: { round, summary: `Codex review fallback passed: Gemini applied fixes and all tests/build pass.`, fallback: true },
            });
            break;
          }
        } else if (isFallback && verification.pass) {
          // If round reached MAX_REVIEW_ROUNDS under fallback and verification passes, pass review
          console.log(`[ORCHESTRATOR] Codex review fallback completed all rounds. Verification passed: progressing to Step 5.`);
          review.decision = 'APPROVED';
          reviewApproved = true;
          this.logger.log({
            run_id: runId,
            from: 'codex',
            to: 'orchestrator',
            type: 'REVIEW_APPROVED',
            status: 'success',
            data: { round, summary: `Codex review fallback accepted after ${round} rounds.`, fallback: true },
          });
          break;
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
          error: `Claude review reached maximum rounds (${this.stateMachine.MAX_REVIEW_ROUNDS}) without approval`,
        };
      }

      // 5. CODEX FINAL PLAN-CONFORMANCE CHECK
      let finalCheckPass = false;
      let lastConformance: CodexConformance | null = null;
      const MAX_FINAL_CHECK_REPAIRS = 2;

      for (let repair = 0; repair <= MAX_FINAL_CHECK_REPAIRS; repair++) {
        const finalGitDiff = await ProjectBootstrapper.getGitDiff(this.options.workspacePath);
        const sourceFiles = ProjectVerifier.readSourceFiles(this.options.workspacePath);
        const filesList = Object.keys(sourceFiles).join(', ');
        const implSummary = `Gemini implemented the full application in the workspace. Files created: ${filesList}. Automated test suite passed (${verification.testPass ? 'All tests PASS' : 'FAIL'}). Production build passed (${verification.buildPass ? 'Exit code 0' : 'FAIL'}).`;

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
          console.warn(`[ORCHESTRATOR] Codex found non-conformance. Repair attempt ${repair + 1}...`);
          const deviations = [
            ...conformance.missing_items.map(m => `Missing: ${m}`),
            ...conformance.deviations.map(d => `Deviation: ${d}`),
          ];
          await this.runGeminiFix(deviations, conformance.summary, verification.testOutput);

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
          error: 'Codex final conformance check failed: Deviations or missing items found',
        };
      }

      // 6. OBJECTIVE FINAL VERIFICATION (Section 29)
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

      // 7. COMPLETE RUN (Section 30)
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
      };
    } catch (err: any) {
      console.error(`[WORKFLOW ERROR] Run ${runId} failed:`, err);
      const isAuthError = (err.message || '').includes('AUTH_REQUIRED') ||
        (err.message || '').includes('Not logged in') ||
        (err.message || '').includes('Please run /login') ||
        (err.message || '').includes('claude login');

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
          message: 'Claude Code authentication expired. Please run "claude login" in your terminal, then click Retry.',
          timestamp: new Date().toISOString(),
        };
        fs.writeFileSync(path.join(this.runDir, 'blocked.json'), JSON.stringify(blockedInfo, null, 2), 'utf8');
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
