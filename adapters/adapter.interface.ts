import { AgentTask, AgentContext, AgentResult, AgentDetectionResult, AgentStatus } from '../protocol/types.js';

/**
 * Standard Agent Adapter Contract (Section 6)
 * Isolates the orchestrator core from agent-specific CLI execution semantics.
 */
export interface AgentAdapter {
  id: string;
  name: string;
  detect(): Promise<AgentDetectionResult>;
  getStatus(): Promise<AgentStatus>;
  execute(task: AgentTask, context: AgentContext): Promise<AgentResult>;
}
