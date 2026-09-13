import { TaskState, StageStatus } from '../protocol/types.js';

export class WorkflowStateMachine {
  private currentState: TaskState = 'Draft';
  private stageStatuses: Map<string, StageStatus> = new Map();
  private listeners: ((state: TaskState) => void)[] = [];

  constructor(initialState: TaskState = 'Draft') {
    this.currentState = initialState;
  }

  public getState(): TaskState {
    return this.currentState;
  }

  public setState(newState: TaskState): void {
    if (this.currentState === newState) return;
    this.currentState = newState;
    this.listeners.forEach(fn => fn(newState));
  }

  public onStateChange(listener: (state: TaskState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public setStageStatus(stageId: string, status: StageStatus): void {
    this.stageStatuses.set(stageId, status);
  }

  public getStageStatus(stageId: string): StageStatus {
    return this.stageStatuses.get(stageId) || 'pending';
  }

  public canTransitionTo(target: TaskState): boolean {
    const validTransitions: Record<TaskState, TaskState[]> = {
      Draft: ['Ready', 'Cancelled'],
      Ready: ['Running', 'Cancelled'],
      Running: ['Paused', 'Needs Attention', 'Review', 'Verification', 'Completed', 'Failed', 'Cancelled'],
      Paused: ['Running', 'Cancelled'],
      'Needs Attention': ['Running', 'Failed', 'Cancelled'],
      Review: ['Running', 'Needs Attention', 'Verification', 'Failed', 'Cancelled'],
      Verification: ['Completed', 'Needs Attention', 'Running', 'Failed', 'Cancelled'],
      Completed: ['Ready', 'Draft'],
      Failed: ['Ready', 'Draft', 'Cancelled'],
      Cancelled: ['Draft'],
    };

    return validTransitions[this.currentState]?.includes(target) ?? false;
  }
}
