/**
 * Protocol Types for Agent Collaboration Platform
 * Model-Agnostic Workflow Routing Architecture
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
  | 'ROUTING_CONFIGURED'
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

// ============================================================================
// Model-Agnostic Workflow Architecture Types
// ============================================================================

export type AgentId = 'codex' | 'gemini' | 'claude';

export type WorkflowRole =
  | 'planner'
  | 'builder'
  | 'reviewer'
  | 'fixer'
  | 'final_checker'
  | 'verifier';

export type WorkflowStage =
  | 'PLANNING'
  | 'IMPLEMENTING'
  | 'IMPLEMENTATION'
  | 'REVIEWING'
  | 'REVIEW'
  | 'FIXING'
  | 'FIX'
  | 'FINAL_CHECK'
  | 'VERIFYING';

export interface AgentCapabilities {
  planning?: boolean;
  implementation?: boolean;
  review?: boolean;
  fileEditing?: boolean;
  commandExecution?: boolean;
  structuredOutput?: boolean;
  supportsPlanning?: boolean;
  supportsImplementation?: boolean;
  supportsReview?: boolean;
  supportsFix?: boolean;
  supportsFinalCheck?: boolean;
  canWriteWorkspace?: boolean;
  canExecuteCommands?: boolean;
  availableModels?: string[];
  defaultModel?: string;
}

export interface RoleAssignment {
  agent: AgentId;
  model: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface WorkflowRoutingConfig {
  preset?: string;
  planner?: RoleAssignment;
  builder?: RoleAssignment;
  reviewer?: RoleAssignment | {
    primary?: RoleAssignment;
    fallback?: RoleAssignment;
    agent?: AgentId;
    model?: string;
  };
  fixer?: RoleAssignment | {
    mode?: 'same_as_builder' | 'custom';
    assignment?: RoleAssignment;
    agent?: AgentId;
    model?: string;
  };
  finalChecker?: RoleAssignment | {
    mode?: 'same_as_planner' | 'custom';
    assignment?: RoleAssignment;
    agent?: AgentId;
    model?: string;
  };
  final_checker?: RoleAssignment | {
    mode?: 'same_as_planner' | 'custom';
    assignment?: RoleAssignment;
    agent?: AgentId;
    model?: string;
  };
}

export interface ResolvedWorkflowRouting {
  preset?: string;
  planner: RoleAssignment;
  builder: RoleAssignment;
  reviewer: RoleAssignment;
  fixer: RoleAssignment;
  finalChecker: RoleAssignment;
  final_checker?: RoleAssignment;
  isIndependentReview?: boolean;
  independenceWarning?: string | null;
}

export interface StageContext {
  runId?: string;
  workspacePath?: string;
  userRequest?: string;
  role?: WorkflowRole;
  assignment?: RoleAssignment;
  prompt?: string;
  plan?: Record<string, unknown>;
  gitDiff?: string;
  testResults?: string;
  reviewRound?: number;
  issues?: string[];
  sourceFiles?: Record<string, string>;
  metadata?: Record<string, unknown>;
  options?: Record<string, unknown>;
  models?: ModelSelectionConfig | Record<string, unknown>;
}

export interface AgentExecutionRequest {
  id?: string;
  runId: string;
  stage: WorkflowStage;
  role: WorkflowRole;
  model: string;
  workspacePath: string;
  prompt: string;
  systemPrompt?: string;
  context: StageContext;
  timeoutMs?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  readOnly?: boolean;
  expectedSchema?: 'planning' | 'review' | 'final_check' | 'none';
}

export interface AgentExecutionResult {
  agent?: AgentId;
  agentId: AgentId;
  model?: string;
  modelUsed: string;
  stage: WorkflowStage;
  role: WorkflowRole;
  success: boolean;
  output?: unknown;
  structuredOutput?: any;
  rawOutput?: string;
  durationMs: number;
  tokensUsed?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TeamPreset {
  id: string;
  name: string;
  description: string;
  badge?: string;
  routing: WorkflowRoutingConfig;
}

// ============================================================================
// Events & Telemetry
// ============================================================================

export interface WorkflowEvent {
  timestamp: string;
  run_id: string;
  from: 'user' | 'orchestrator' | 'codex' | 'gemini' | 'claude' | 'system';
  to: 'user' | 'orchestrator' | 'codex' | 'gemini' | 'claude' | 'system' | 'all';
  type: EventType;
  status: 'sent' | 'received' | 'processing' | 'success' | 'failed' | 'blocked' | 'warning' | 'info';
  role?: WorkflowRole;
  agent?: AgentId;
  model?: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// Legacy & Adapter Types (Maintained for Backward Compatibility)
// ============================================================================

export interface ModelOption {
  id: string;
  name: string;
  group: string;
  badge?: string;
  creditRequired?: boolean;
  description: string;
}

export interface ModelSelectionConfig {
  codexModel?: string;
  claudeModel?: string;
  geminiModel?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  reviewerFallback?: boolean;
  routing?: WorkflowRoutingConfig;
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
  detectionDetails?: any;
}

// ============================================================================
// Orchestrator UI Mode & Dynamic Pipeline Types (Build Specification)
// ============================================================================

export interface StagePermissions {
  read: boolean;
  write: boolean;
  terminal: boolean;
  browser: boolean;
}

export interface VerificationPolicy {
  build?: boolean;
  lint?: boolean;
  unitTest?: boolean;
  integrationTest?: boolean;
  browserCheck?: boolean;
  visualCheck?: boolean;
  reviewerApproval?: boolean;
  customCommand?: string;
}

export type StageStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'review'
  | 'failed'
  | 'completed'
  | 'skipped';

export interface RuleRef {
  id: string;
  name?: string;
  scope: 'global' | 'project' | 'workflow' | 'stage' | 'agent';
  content?: string;
  path?: string;
}

export interface ConfiguredStage {
  id: string;
  name: string;
  role: WorkflowRole;
  agent: AgentId | string;
  provider?: string;
  model: string;
  rules: (string | RuleRef)[];
  permissions: StagePermissions;
  verification?: VerificationPolicy;
  autoContinue?: boolean;
  status: StageStatus;
  output?: any;
  error?: string;
  durationMs?: number;
}

export type TaskState =
  | 'Draft'
  | 'Ready'
  | 'Running'
  | 'Paused'
  | 'Needs Attention'
  | 'Review'
  | 'Verification'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export type UIMessage =
  | { type: 'OPEN_FILE'; path: string; line?: number }
  | { type: 'OPEN_DIFF'; originalPath?: string; modifiedPath: string; title?: string }
  | { type: 'OPEN_TERMINAL'; command?: string }
  | { type: 'BROWSER_VERIFY'; url: string }
  | { type: 'EXIT_UI_MODE' }
  | { type: 'GET_WORKSPACE_INFO' }
  | { type: 'GET_STATE' }
  | { type: 'RUN_WORKFLOW'; task?: string; pipeline?: ConfiguredStage[]; routing?: WorkflowRoutingConfig }
  | { type: 'PAUSE_WORKFLOW' }
  | { type: 'RESUME_WORKFLOW' }
  | { type: 'STOP_WORKFLOW' }
  | { type: 'RETRY_STAGE'; stageId: string; modelOverride?: string }
  | { type: 'SKIP_STAGE'; stageId: string }
  | { type: 'APPROVE_STAGE'; stageId: string }
  | { type: 'UPDATE_STAGE'; stageId: string; updates: Partial<ConfiguredStage> };

export type ExtensionMessage =
  | { type: 'WORKSPACE_INFO'; workspacePath: string; projectName: string; branch: string; isGit: boolean }
  | { type: 'STATE_UPDATE'; state: any }
  | { type: 'WORKFLOW_EVENT'; event: WorkflowEvent }
  | { type: 'STAGE_OUTPUT'; stageId: string; output: any }
  | { type: 'ERROR'; message: string; details?: any }
  | { type: 'TOAST'; text: string; level?: 'info' | 'warn' | 'error' | 'success' };

