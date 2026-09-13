import { AgentProvider } from './provider.interface.js';
import { GeminiAdapter } from '../adapters/gemini/adapter.js';
import {
  AgentExecutionRequest,
  AgentExecutionResult,
  ModelOption,
  AgentCapabilities,
  AgentDetectionResult,
} from '../protocol/types.js';

export class AntigravityProvider implements AgentProvider {
  public id = 'antigravity';
  public name = 'Antigravity Native Agent';
  public provider = 'Google Antigravity';
  private geminiAdapter: GeminiAdapter;

  constructor() {
    this.geminiAdapter = new GeminiAdapter();
  }

  public getCapabilities(): AgentCapabilities {
    return {
      supportsPlanning: true,
      supportsImplementation: true,
      supportsReview: true,
      supportsFix: true,
      supportsFinalCheck: true,
      canWriteWorkspace: true,
      canExecuteCommands: true,
      availableModels: ['gemini-3.8-flash', 'gemini-3.8-pro', 'claude-sonnet-5', 'gpt-6-astra'],
      defaultModel: 'gemini-3.8-flash',
    };
  }

  public async detect(): Promise<AgentDetectionResult> {
    return this.geminiAdapter.detect();
  }

  public async listModels(): Promise<ModelOption[]> {
    return [
      { id: 'gemini-3.8-flash', name: 'Antigravity / Gemini 3.8 Flash', group: 'Native Host', description: 'Default Antigravity runner' },
      { id: 'gemini-3.8-pro', name: 'Antigravity / Gemini 3.8 Pro', group: 'Native Host', description: 'Deep reasoning' },
    ];
  }

  public async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    return this.geminiAdapter.executeStage(request);
  }

  public async cancel(executionId: string): Promise<void> {
    // Cancel execution
  }
}
