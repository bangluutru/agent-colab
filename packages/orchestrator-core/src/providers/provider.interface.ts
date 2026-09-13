import {
  AgentExecutionRequest,
  AgentExecutionResult,
  ModelOption,
  AgentCapabilities,
  AgentDetectionResult,
} from '../protocol/types.js';

export interface AgentProvider {
  id: string;
  name: string;
  provider: string;
  getCapabilities(): AgentCapabilities;
  detect(): Promise<AgentDetectionResult>;
  listModels(): Promise<ModelOption[]>;
  execute(request: AgentExecutionRequest): Promise<AgentExecutionResult>;
  cancel(executionId: string): Promise<void>;
}
