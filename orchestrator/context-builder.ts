import * as fs from 'fs';
import * as path from 'path';
import { PlanningResult, ReviewResult, FinalCheckResult, CodexPlan } from '../protocol/schemas.js';

export class ContextBuilder {
  /**
   * Generic Planning Prompt
   */
  public static buildPlanPrompt(userRequest: string, projectContext?: string): string {
    let prompt = `USER REQUEST:\n${userRequest}\n`;
    if (projectContext) {
      prompt += `\nPROJECT CONTEXT:\n${projectContext}\n`;
    }
    prompt += `\nProduce a comprehensive, structured implementation plan in JSON matching the specified schema.`;
    return prompt;
  }

  /**
   * Generic Physical Implementation Prompt
   */
  public static buildImplementationPrompt(
    userRequest: string,
    plan: PlanningResult,
    workspacePath: string
  ): string {
    let prompt = `# IMPLEMENTATION TASK\n\n`;
    prompt += `## USER REQUIREMENTS\n${userRequest}\n\n`;
    prompt += `## APPROVED IMPLEMENTATION PLAN\n`;
    prompt += `Objective: ${plan.objective}\n\n`;

    if (plan.requirements && plan.requirements.length > 0) {
      prompt += `### Requirements:\n`;
      plan.requirements.forEach((req, idx) => {
        prompt += `${idx + 1}. ${req}\n`;
      });
      prompt += `\n`;
    }

    if (plan.architecture && plan.architecture.length > 0) {
      prompt += `### Architecture:\n`;
      plan.architecture.forEach((arch, idx) => {
        prompt += `- ${arch}\n`;
      });
      prompt += `\n`;
    }

    if (plan.implementation_steps && plan.implementation_steps.length > 0) {
      prompt += `### Implementation Steps:\n`;
      plan.implementation_steps.forEach((step: any, idx: number) => {
        if (typeof step === 'string') {
          prompt += `${idx + 1}. ${step}\n`;
        } else {
          prompt += `${idx + 1}. [${step.file || 'File'}] ${step.action || ''}: ${step.details || JSON.stringify(step)}\n`;
        }
      });
      prompt += `\n`;
    }

    if (plan.edge_cases && plan.edge_cases.length > 0) {
      prompt += `### Edge Cases to Guard Against:\n`;
      plan.edge_cases.forEach((ec, idx) => {
        prompt += `- ${ec}\n`;
      });
      prompt += `\n`;
    }

    if (plan.acceptance_criteria && plan.acceptance_criteria.length > 0) {
      prompt += `### Acceptance Criteria:\n`;
      plan.acceptance_criteria.forEach((crit, idx) => {
        prompt += `${idx + 1}. ${crit}\n`;
      });
      prompt += `\n`;
    }

    prompt += `### Target Workspace:\n${workspacePath}\n\n`;
    prompt += `### CRITICAL EXECUTION CONSTRAINTS:\n`;
    prompt += `- DO NOT start or leave running any persistent development/preview servers (e.g. \`npm run dev\`, \`npm run preview\`, \`npm run serve\`, \`vite preview\`, \`http-server\`, or keeping a server running). Any persistent server will block the autonomous pipeline.\n`;
    prompt += `- Only run one-off commands that exit cleanly (e.g. \`npm test\` and \`npm run build\`).\n`;
    prompt += `- The application will be served for user preview by the system after pipeline completion.\n\n`;
    prompt += `Please create all required project files, write the full source code and unit tests, configure build scripts, and verify the implementation inside the workspace.`;
    return prompt;
  }

  /**
   * Generic Code Repair Prompt
   */
  public static buildFixPrompt(
    userRequest: string,
    issues: string[],
    contextSummary: string,
    testOutput?: string
  ): string {
    let prompt = `# CODE REPAIR TASK\n\n`;
    prompt += `## USER REQUIREMENTS\n${userRequest}\n\n`;
    prompt += `## ISSUES TO FIX\n`;
    issues.forEach((iss, idx) => {
      prompt += `${idx + 1}. ${iss}\n`;
    });
    prompt += `\n## CONTEXT / SUMMARY\n${contextSummary}\n\n`;
    if (testOutput) {
      prompt += `## TEST / BUILD FAILURE OUTPUT\n\`\`\`\n${testOutput}\n\`\`\`\n\n`;
    }
    prompt += `### CRITICAL EXECUTION CONSTRAINTS:\n`;
    prompt += `- DO NOT start or leave running any persistent development/preview servers (e.g. \`npm run dev\`, \`npm run preview\`, \`npm run serve\`, \`vite preview\`, \`http-server\`).\n`;
    prompt += `- Verify your fixes strictly with non-blocking commands (\`npm test\`, \`npm run build\`).\n\n`;
    prompt += `Please inspect the workspace, repair the code to resolve all issues above, run tests to verify your fix, and report what was changed.`;
    return prompt;
  }

  /**
   * Generic Independent Adversarial Review Prompt
   */
  public static buildReviewPrompt(
    userRequest: string,
    plan: PlanningResult,
    gitDiff: string,
    testResults: string,
    keyFilesContent?: Record<string, string>
  ): string {
    let prompt = `# REVIEW TASK\n`;
    prompt += `## ORIGINAL USER REQUEST\n${userRequest}\n\n`;
    prompt += `## APPROVED IMPLEMENTATION PLAN\n${JSON.stringify(plan, null, 2)}\n\n`;
    prompt += `## ACCEPTANCE CRITERIA\n${plan.acceptance_criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n`;
    prompt += `## TEST & BUILD RESULTS\n${testResults || 'No test output available.'}\n\n`;
    prompt += `## ACTUAL GIT DIFF\n\`\`\`diff\n${gitDiff || 'No git diff detected.'}\n\`\`\`\n\n`;

    if (keyFilesContent && Object.keys(keyFilesContent).length > 0) {
      prompt += `## KEY IMPLEMENTED SOURCE FILES\n`;
      for (const [file, content] of Object.entries(keyFilesContent)) {
        prompt += `### ${file}\n\`\`\`\n${content}\n\`\`\`\n\n`;
      }
    }

    prompt += `Inspect the actual code above. Compare it strictly against the requirements and plan. Return either APPROVED or CHANGES_REQUESTED in the required JSON schema.`;
    return prompt;
  }

  /**
   * Generic Final Plan-Conformance Check Prompt
   */
  public static buildFinalCheckPrompt(
    userRequest: string,
    plan: PlanningResult,
    implementationSummary: string,
    reviewSummary: string,
    gitDiff: string,
    testResults: string
  ): string {
    let prompt = `# FINAL PLAN-CONFORMANCE CHECK\n`;
    prompt += `## ORIGINAL USER REQUEST\n${userRequest}\n\n`;
    prompt += `## APPROVED IMPLEMENTATION PLAN\n${JSON.stringify(plan, null, 2)}\n\n`;
    prompt += `## INDEPENDENT REVIEW DECISION\n${reviewSummary}\n\n`;
    prompt += `## IMPLEMENTATION SUMMARY\n${implementationSummary}\n\n`;
    prompt += `## TEST & VERIFICATION RESULTS\n${testResults}\n\n`;
    prompt += `## FINAL GIT DIFF\n\`\`\`diff\n${gitDiff}\n\`\`\`\n\n`;
    prompt += `Evaluate whether the implementation plan was actually fulfilled. Return CONFORMANT or NON_CONFORMANT in the required JSON schema.`;
    return prompt;
  }

  // --- Backward-compatible aliases ---

  public static buildCodexPlanPrompt(userRequest: string, projectContext?: string): string {
    return this.buildPlanPrompt(userRequest, projectContext);
  }

  public static buildGeminiImplPrompt(
    userRequest: string,
    plan: CodexPlan,
    workspacePath: string
  ): string {
    return this.buildImplementationPrompt(userRequest, plan, workspacePath);
  }

  public static buildGeminiFixPrompt(
    userRequest: string,
    issues: string[],
    contextSummary: string,
    testOutput?: string
  ): string {
    return this.buildFixPrompt(userRequest, issues, contextSummary, testOutput);
  }

  public static buildGeminiContext(userRequest: string, plan: CodexPlan, workspacePath: string): {
    userRequest: string;
    plan: CodexPlan;
    acceptanceCriteria: string[];
    workspacePath: string;
  } {
    return {
      userRequest,
      plan,
      acceptanceCriteria: plan.acceptance_criteria,
      workspacePath,
    };
  }

  public static buildClaudeReviewPrompt(
    userRequest: string,
    plan: CodexPlan,
    gitDiff: string,
    testResults: string,
    keyFilesContent?: Record<string, string>
  ): string {
    return this.buildReviewPrompt(userRequest, plan, gitDiff, testResults, keyFilesContent);
  }

  public static buildCodexFinalCheckPrompt(
    userRequest: string,
    plan: CodexPlan,
    implementationSummary: string,
    claudeReviewSummary: string,
    gitDiff: string,
    testResults: string
  ): string {
    return this.buildFinalCheckPrompt(
      userRequest,
      plan,
      implementationSummary,
      claudeReviewSummary,
      gitDiff,
      testResults
    );
  }
}
