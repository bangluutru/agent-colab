import { AgentProvider } from './provider.interface.js';
import { ClaudeAdapter } from '../adapters/claude/adapter.js';
import {
  AgentExecutionRequest,
  AgentExecutionResult,
  ModelOption,
  AgentCapabilities,
  AgentDetectionResult,
} from '../protocol/types.js';

export class ClaudeProvider implements AgentProvider {
  public id = 'claude';
  public name = 'Anthropic Claude Code CLI';
  public provider = 'Anthropic';
  private adapter: ClaudeAdapter;

  constructor() {
    this.adapter = new ClaudeAdapter();
  }

  public getCapabilities(): AgentCapabilities {
    return this.adapter.getCapabilities();
  }

  public async detect(): Promise<AgentDetectionResult> {
    return this.adapter.detect();
  }

  public async listModels(): Promise<ModelOption[]> {
    return [
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', group: 'Anthropic Frontier', description: 'Deep review & architecture' },
      { id: 'opus', name: 'Claude Opus 4.6', group: 'Anthropic Thinking', description: 'Complex reasoning' },
      { id: 'haiku', name: 'Claude Haiku 4.5', group: 'Anthropic Fast', description: 'High speed inspection' },
    ];
  }

  public async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    return this.adapter.executeStage(request);
  }

  public async cancel(executionId: string): Promise<void> {
    // Process cancellation if running
  }
}
