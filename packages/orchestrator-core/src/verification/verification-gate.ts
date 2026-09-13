import { exec } from 'child_process';
import { promisify } from 'util';
import { VerificationPolicy } from '../protocol/types.js';

const execAsync = promisify(exec);

export interface VerificationResult {
  passed: boolean;
  checksRun: string[];
  passedChecks: string[];
  failedChecks: string[];
  details: Record<string, { success: boolean; output: string; error?: string }>;
}

export class VerificationGate {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  public async evaluate(
    policy?: VerificationPolicy,
    context?: { stageOutput?: any; reviewerDecision?: string }
  ): Promise<VerificationResult> {
    const result: VerificationResult = {
      passed: true,
      checksRun: [],
      passedChecks: [],
      failedChecks: [],
      details: {},
    };

    if (!policy) {
      return result;
    }

    // 1. Reviewer Approval Gate
    if (policy.reviewerApproval) {
      result.checksRun.push('reviewerApproval');
      const approved = context?.reviewerDecision === 'PASS' ||
                       context?.stageOutput?.decision === 'PASS' ||
                       context?.stageOutput?.status === 'PASS';
      if (approved) {
        result.passedChecks.push('reviewerApproval');
        result.details['reviewerApproval'] = { success: true, output: 'Reviewer approved the stage changes.' };
      } else {
        result.passed = false;
        result.failedChecks.push('reviewerApproval');
        result.details['reviewerApproval'] = {
          success: false,
          output: 'Reviewer has not granted approval.',
          error: context?.stageOutput?.issues?.join(', ') || 'Unapproved changes',
        };
      }
    }

    // 2. Custom Command Gate
    if (policy.customCommand) {
      result.checksRun.push('customCommand');
      try {
        const { stdout, stderr } = await execAsync(policy.customCommand, {
          cwd: this.workspacePath,
          timeout: 60000,
        });
        result.passedChecks.push('customCommand');
        result.details['customCommand'] = { success: true, output: stdout || stderr };
      } catch (err: any) {
        result.passed = false;
        result.failedChecks.push('customCommand');
        result.details['customCommand'] = {
          success: false,
          output: err.stdout || '',
          error: err.stderr || err.message,
        };
      }
    }

    // 3. Build Check Gate
    if (policy.build) {
      result.checksRun.push('build');
      try {
        const { stdout, stderr } = await execAsync('npx tsc --noEmit', {
          cwd: this.workspacePath,
          timeout: 45000,
        });
        result.passedChecks.push('build');
        result.details['build'] = { success: true, output: stdout || stderr || 'Typecheck succeeded' };
      } catch (err: any) {
        result.passed = false;
        result.failedChecks.push('build');
        result.details['build'] = { success: false, output: err.stdout || '', error: err.stderr || err.message };
      }
    }

    // 4. Test Check Gate
    if (policy.unitTest) {
      result.checksRun.push('unitTest');
      try {
        const { stdout, stderr } = await execAsync('npm test', {
          cwd: this.workspacePath,
          timeout: 60000,
        });
        result.passedChecks.push('unitTest');
        result.details['unitTest'] = { success: true, output: stdout || stderr };
      } catch (err: any) {
        result.passed = false;
        result.failedChecks.push('unitTest');
        result.details['unitTest'] = { success: false, output: err.stdout || '', error: err.stderr || err.message };
      }
    }

    return result;
  }
}
