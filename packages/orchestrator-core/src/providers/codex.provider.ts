import { AgentProvider } from './provider.interface.js';
import { CodexAdapter } from '../adapters/codex/adapter.js';
import {
  AgentExecutionRequest,
  AgentExecutionResult,
  ModelOption,
  AgentCapabilities,
  AgentDetectionResult,
} from '../protocol/types.js';

export class CodexProvider implements AgentProvider {
  public id = 'codex';
  public name = 'OpenAI Codex CLI';
  public provider = 'OpenAI';
  private adapter: CodexAdapter;

  constructor() {
    this.adapter = new CodexAdapter();
  }

  public getCapabilities(): AgentCapabilities {
    return this.adapter.getCapabilities();
  }

  public async detect(): Promise<AgentDetectionResult> {
    return this.adapter.detect();
  }

  public async listModels(): Promise<ModelOption[]> {
    return [
      { id: 'gpt-6-astra', name: 'GPT-6 Astra', group: 'OpenAI Frontier', description: 'Flagship reasoning & coding' },
      { id: 'gpt-5-turbo', name: 'GPT-5 Turbo', group: 'OpenAI Fast', description: 'Fast execution' },
    ];
  }

  public async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    return this.adapter.executeStage(request);
  }

  public async cancel(executionId: string): Promise<void> {
    // Process cancellation if running
  }
}
