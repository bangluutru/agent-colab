/**
 * Protocol Types for Agent Collaboration MVP v0.1
 */

export type WorkflowState =
  | 'IDLE'
  | 'REQUEST_RECEIVED'
  | 'PLANNING'
  | 'PLAN_READY'
  | 'IMPLEMENTING'
  | 'TESTING'
  | 'REVIEWING'
  | 'CHANGES_REQUESTED'
  | 'FIXING'
  | 'FINAL_CHECK'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'FAILED'
  | 'CANCELLED'
  | 'INTERRUPTED';

export type EventType =
  | 'USER_REQUEST_RECEIVED'
  | 'PLAN_REQUESTED'
  | 'PLAN_RECEIVED'
  | 'IMPLEMENTATION_STARTED'
  | 'IMPLEMENTATION_COMPLETED'
  | 'TEST_STARTED'
  | 'TEST_PASSED'
  | 'TEST_FAILED'
  | 'REVIEW_REQUESTED'
  | 'REVIEW_APPROVED'
  | 'CHANGES_REQUESTED'
  | 'FIX_STARTED'
  | 'FIX_COMPLETED'
  | 'FINAL_CHECK_REQUESTED'
  | 'FINAL_CHECK_PASSED'
  | 'FINAL_CHECK_FAILED'
  | 'VERIFICATION_STARTED'
  | 'VERIFICATION_PASSED'
  | 'VERIFICATION_FAILED'
  | 'REVIEW_FALLBACK_TRIGGERED'
  | 'PHASE_TRANSITION'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_BLOCKED'
  | 'WORKFLOW_FAILED'
  | 'WORKFLOW_INTERRUPTED';

export interface WorkflowEvent {
  timestamp: string;
  run_id: string;
  from: 'user' | 'orchestrator' | 'codex' | 'gemini' | 'claude' | 'system';
  to: 'user' | 'orchestrator' | 'codex' | 'gemini' | 'claude' | 'system' | 'all';
  type: EventType;
  status: 'sent' | 'received' | 'processing' | 'success' | 'failed' | 'blocked' | 'warning' | 'info';
  data?: Record<string, unknown>;
}

export interface ModelOption {
  id: string;
  name: string;
  group: string;
  badge?: string;
  creditRequired?: boolean;
  description: string;
}

export interface ModelSelectionConfig {
  codexModel?: string;    // e.g. "gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.5"
  claudeModel?: string;   // e.g. "opus", "sonnet", "haiku", "fable-5.1", "claude-fable-5", "claude-opus-4-8"
  geminiModel?: string;   // e.g. "gemini-3.8-flash", "gemini-3.7-flash", "claude-sonnet-4-6-thinking"
  reasoningEffort?: 'low' | 'medium' | 'high';
  reviewerFallback?: boolean; // When true, automatically switch to Codex if Claude CLI fails/unauthorized
}

export interface AgentTask {
  id: string;
  type: 'planning' | 'review' | 'final_check' | 'debug_assist' | 're_plan';
  prompt: string;
  systemPrompt?: string;
  modelOverride?: string;
  timeoutMs?: number;
}

export interface AgentContext {
  runId: string;
  workspacePath: string;
  userRequest: string;
  plan?: Record<string, unknown>;
  gitDiff?: string;
  testResults?: string;
  reviewRound?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  success: boolean;
  agentId: string;
  modelUsed: string;
  rawOutput: string;
  structuredOutput?: unknown;
  durationMs: number;
  tokensUsed?: number;
  error?: string;
}

export interface AgentDetectionResult {
  available: boolean;
  version?: string;
  path?: string;
  authMethod?: string;
  activeSubscription?: boolean;
  error?: string;
}

export interface AgentStatus {
  id: string;
  name: string;
  ready: boolean;
  currentModel: string;
  authStatus: string;
}
