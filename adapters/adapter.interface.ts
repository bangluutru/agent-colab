import {
  AgentTask,
  AgentContext,
  AgentResult,
  AgentDetectionResult,
  AgentStatus,
  AgentId,
  AgentCapabilities,
  AgentExecutionRequest,
  AgentExecutionResult,
} from '../protocol/types.js';

/**
 * Standard Agent Adapter Contract
 * Isolates the orchestrator core from agent-specific CLI execution semantics.
 * Decouples roles and stages from specific AI providers.
 */
export interface AgentAdapter {
  id: AgentId | string;
  name: string;
  getCapabilities(): AgentCapabilities;
  detect(forceRefresh?: boolean): Promise<AgentDetectionResult>;
  getStatus(forceRefresh?: boolean): Promise<AgentStatus>;
  executeStage(request: AgentExecutionRequest): Promise<AgentExecutionResult>;
  execute(task: AgentTask, context: AgentContext): Promise<AgentResult>;
  cancel?(): void;
}
