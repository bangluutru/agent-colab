import { WorkflowState } from '../protocol/types.js';

export class StateMachine {
  private currentState: WorkflowState = 'IDLE';
  private reviewRound: number = 0;
  public readonly MAX_REVIEW_ROUNDS = 3; // Section 11

  constructor(initialState: WorkflowState = 'IDLE') {
    this.currentState = initialState;
  }

  public getState(): WorkflowState {
    return this.currentState;
  }

  public getReviewRound(): number {
    return this.reviewRound;
  }

  public incrementReviewRound(): number {
    this.reviewRound++;
    return this.reviewRound;
  }

  /**
   * Deterministic state transition validator (Section 14)
   */
  public transition(targetState: WorkflowState): void {
    if (targetState === this.currentState) {
      return;
    }

    const validTransitions: Record<WorkflowState, WorkflowState[]> = {
      IDLE: ['REQUEST_RECEIVED', 'PLANNING', 'PLAN_READY', 'IMPLEMENTING', 'TESTING', 'REVIEWING', 'FINAL_CHECK', 'VERIFYING'],
      REQUEST_RECEIVED: ['PLANNING', 'FAILED', 'CANCELLED'],
      PLANNING: ['PLAN_READY', 'BLOCKED', 'FAILED', 'INTERRUPTED', 'CANCELLED'],
      PLAN_READY: ['IMPLEMENTING', 'TESTING', 'FAILED', 'CANCELLED'],
      IMPLEMENTING: ['TESTING', 'FAILED', 'INTERRUPTED', 'CANCELLED'],
      TESTING: ['REVIEWING', 'FIXING', 'FINAL_CHECK', 'FAILED', 'INTERRUPTED', 'CANCELLED'],
      REVIEWING: ['CHANGES_REQUESTED', 'FINAL_CHECK', 'FAILED', 'BLOCKED', 'INTERRUPTED', 'CANCELLED'],
      CHANGES_REQUESTED: ['FIXING', 'BLOCKED', 'FAILED', 'CANCELLED'],
      FIXING: ['TESTING', 'FAILED', 'INTERRUPTED', 'CANCELLED'],
      FINAL_CHECK: ['VERIFYING', 'FIXING', 'FAILED', 'BLOCKED', 'INTERRUPTED', 'CANCELLED'],
      VERIFYING: ['COMPLETED', 'FAILED', 'BLOCKED', 'INTERRUPTED'],
      COMPLETED: ['IDLE'],
      BLOCKED: ['PLANNING', 'IMPLEMENTING', 'REVIEWING', 'FIXING', 'FINAL_CHECK', 'VERIFYING', 'FAILED', 'CANCELLED'],
      FAILED: ['IDLE'],
      CANCELLED: ['IDLE'],
      INTERRUPTED: ['PLANNING', 'IMPLEMENTING', 'REVIEWING', 'FIXING', 'FINAL_CHECK', 'VERIFYING', 'FAILED'],
    };

    const allowed = validTransitions[this.currentState] || [];
    if (!allowed.includes(targetState)) {
      throw new Error(`Invalid state transition attempted: from ${this.currentState} to ${targetState}`);
    }

    // Check review round boundary
    if (targetState === 'CHANGES_REQUESTED' && this.reviewRound >= this.MAX_REVIEW_ROUNDS) {
      console.warn(`[STATE_MACHINE] Maximum review rounds (${this.MAX_REVIEW_ROUNDS}) reached without approval. Transitioning to BLOCKED.`);
      this.currentState = 'BLOCKED';
      return;
    }

    this.currentState = targetState;
  }

  public interrupt(): void {
    this.currentState = 'INTERRUPTED';
  }
}
