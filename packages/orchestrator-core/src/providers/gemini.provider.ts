import { AgentProvider } from './provider.interface.js';
import { GeminiAdapter } from '../adapters/gemini/adapter.js';
import {
  AgentExecutionRequest,
  AgentExecutionResult,
  ModelOption,
  AgentCapabilities,
  AgentDetectionResult,
} from '../protocol/types.js';

export class GeminiProvider implements AgentProvider {
  public id = 'gemini';
  public name = 'Google Antigravity / Gemini';
  public provider = 'Google Antigravity';
  private adapter: GeminiAdapter;

  constructor() {
    this.adapter = new GeminiAdapter();
  }

  public getCapabilities(): AgentCapabilities {
    return this.adapter.getCapabilities();
  }

  public async detect(): Promise<AgentDetectionResult> {
    return this.adapter.detect();
  }

  public async listModels(): Promise<ModelOption[]> {
    return [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', group: 'Google Frontier', description: 'Fast code builder & planner' },
      { id: 'gemini-3.8-pro', name: 'Gemini 3.8 Pro', group: 'Google Reasoning', description: 'Deep architecture' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', group: 'Google Fast', description: 'Lightweight runner' },
    ];
  }

  public async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    return this.adapter.executeStage(request);
  }

  public async cancel(executionId: string): Promise<void> {
    // Process cancellation if running
  }
}
