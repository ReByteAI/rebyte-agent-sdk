// Rebyte-only Workflow API types, composed with the official OpenAI SDK types.
import type { AgentTool, PersistedAgentToolParam } from 'openai/resources/beta/agents/agents';
import type { RebyteSandbox } from '../../rebyte-sandbox';

export type WorkflowJSON = null | boolean | number | string | WorkflowJSON[] | { [key: string]: WorkflowJSON };

/** Fixed programs call directly available functions; deferred discovery is unavailable. */
export interface WorkflowFunctionTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  defer_loading?: false;
}

/** Server tools and application functions available to the saved program. */
export type WorkflowToolParam =
  | WorkflowFunctionTool
  | (Omit<PersistedAgentToolParam.PersistedAgentToolConfigParamMcp, 'transport'> & {
      transport: PersistedAgentToolParam.PersistedAgentToolConfigParamMcp['transport'] | { type: 'connection'; connection_id: string };
    })
  | (Omit<PersistedAgentToolParam.PersistedAgentToolConfigParamWebSearch, 'mode' | 'location'> & {
      mode?: 'disabled' | 'cached' | 'live' | null;
      location?: null;
    });
export type WorkflowTool =
  | (WorkflowFunctionTool & { defer_loading: false })
  | (Omit<AgentTool.AgentToolResourceMcp, 'transport'> & {
      transport: AgentTool.AgentToolResourceMcp['transport'] | { type: 'connection'; connection_id: string };
    })
  | (Omit<AgentTool.AgentToolResourceWebSearch, 'mode' | 'location'> & {
      mode: 'disabled' | 'live';
      location: null;
    });

export interface WorkflowConfiguration {
  tools?: WorkflowToolParam[];
  environment?: { type: 'none' } | RebyteSandbox;
  vault_ids?: string[];
}
export interface WorkflowDefinition extends WorkflowConfiguration {
  /** JavaScript function expression: async (input, emit) => { ... }. Maximum 32,768 code units. */
  code: string;
  input_schema: Record<string, unknown>;
}
/** Public snapshots omit private environment setup and transport headers. */
export interface WorkflowDefinitionSnapshot {
  code: string;
  input_schema: Record<string, unknown>;
  tools: WorkflowTool[];
  environment: { type: 'none' | 'openai_hosted' };
  vault_ids: string[];
  source_hash: string;
}
export interface WorkflowAgent {
  object: 'workflow_agent';
  id: string;
  name: string;
  metadata: Record<string, string>;
  latest_version: number;
  published_version: number | null;
  /** Unix seconds. */
  created_at: number;
  /** Unix seconds. */
  updated_at: number;
}
export interface WorkflowVersion extends WorkflowDefinitionSnapshot {
  object: 'workflow_agent.version';
  agent_id: string;
  version: number;
  /** Unix seconds. */
  created_at: number;
  /** Unix seconds, or null for an unpublished draft. */
  published_at: number | null;
  tested_run_id: string | null;
}
export interface WorkflowRun extends WorkflowDefinitionSnapshot {
  object: 'workflow_agent.run';
  id: string;
  agent_id: string | null;
  version: number | null;
  /** True for both unsaved previews and saved-version tests. */
  preview: boolean;
  status: 'preparing' | 'in_progress' | 'requires_action' | 'completed' | 'failed' | 'cancelled';
  input: WorkflowJSON;
  result: WorkflowJSON;
  logs: string[];
  error: string | null;
  required_actions: WorkflowRequiredAction[];
  calls: WorkflowToolCall[];
  outputs: WorkflowJSON[];
  execution_id: string | null;
  /** Current function-wait deadline in Unix milliseconds; null outside a wait. */
  expires_at: number | null;
  /** Unix seconds. */
  created_at: number;
  /** Unix seconds. */
  completed_at: number | null;
}
export interface WorkflowRequiredAction {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: Record<string, WorkflowJSON>;
}
/** Ordered execution history returned with the run, including calls replayed after a wait. */
export interface WorkflowToolCall {
  seq: number;
  connector: string;
  method: string;
  args?: WorkflowJSON;
  result?: WorkflowJSON;
  requiresApproval: boolean;
  ephemeral?: boolean;
  state: 'executing' | 'applied' | 'pending' | 'reverted';
}
/** Submit JSON directly; unlike ordinary Agent functions, output need not be a string. */
export type WorkflowToolResultParams =
  | { call_id: string; success: true; output: WorkflowJSON }
  | { call_id: string; success: false; error: string };
export interface WorkflowAgentDeleted {
  object: 'workflow_agent.deleted';
  id: string;
  deleted: true;
}
export interface WorkflowRunDeleted {
  object: 'workflow_agent.run.deleted';
  id: string;
  deleted: true;
}
export interface WorkflowAgentCreateParams extends WorkflowDefinition {
  name: string;
  metadata?: Record<string, string>;
}
export interface WorkflowListParams {
  limit?: number;
  after?: string;
}
export interface WorkflowRunListParams extends WorkflowListParams {
  agent_id?: string;
}
export type WorkflowVersionCreateParams = WorkflowDefinition | {
  /** Retain this version's private tools, environment and vault configuration. */
  base_version: number;
  code: string;
  input_schema: Record<string, unknown>;
};
export interface WorkflowVersionListParams {
  limit?: number;
  /** Versions are returned newest first. */
  before?: number;
}
export interface WorkflowExecutionParams {
  input: WorkflowJSON;
  stream?: boolean;
  /** HTTP header. Reuse for the same logical request; a different body returns 409. */
  'Idempotency-Key'?: string;
}
export interface WorkflowRunCreateParams extends WorkflowExecutionParams {
  /** Defaults to the published version. Explicit versions must have been published. */
  version?: number;
}
export interface WorkflowTestParams extends WorkflowExecutionParams {
  /** Required: testing never silently picks a different draft. */
  version: number;
}
export interface WorkflowPreviewParams extends WorkflowDefinition, WorkflowExecutionParams {}
export interface WorkflowPublishParams {
  version: number;
  /** A successful, non-deleted test of this exact Agent and version. */
  test_run_id: string;
}
export interface WorkflowEventListParams {
  /** Replay events after this sequence. Keep it a string to preserve 64-bit precision. */
  after?: string;
}
export interface WorkflowDraft {
  name: string;
  summary: string;
  code: string;
  input_schema: Record<string, unknown>;
  input: WorkflowJSON;
}
export interface WorkflowGenerateParams extends WorkflowConfiguration {
  prompt: string;
  draft?: WorkflowDraft;
  preview_error?: string;
  stream?: boolean;
}
export interface WorkflowGenerateResponse { draft: WorkflowDraft }
export type WorkflowGenerationEvent =
  | { type: 'generation.started'; sequence: string }
  | { type: 'generation.delta'; sequence: string; delta: string }
  | { type: 'generation.completed'; sequence: string; draft: WorkflowDraft };

export interface WorkflowRunEventBase {
  event_id: string;
  created_at: number;
  run_id: string;
  /** Persist this cursor to resume an event-only subscription. */
  sequence: string;
}
export type WorkflowRunEvent = WorkflowRunEventBase & (
  | { type: 'workflow.run.created'; run: WorkflowRun }
  | { type: 'workflow.run.started'; run: WorkflowRun }
  | { type: 'workflow.run.output'; value: WorkflowJSON; run: WorkflowRun }
  | { type: 'workflow.run.requires_action'; run: WorkflowRun }
  | ({ type: 'workflow.run.tool_result'; run: WorkflowRun } & WorkflowToolResultParams)
  // Older persisted histories can still contain individual tool events.
  | { type: 'workflow.run.tool.started'; execution_id: string;
      call: { callId: string; name: string; arguments: WorkflowJSON } }
  | { type: 'workflow.run.tool.completed'; execution_id: string; call_id: string; result?: WorkflowJSON }
  | { type: 'workflow.run.tool.failed'; execution_id: string; call_id: string; error: string }
  | { type: 'workflow.run.completed'; run: WorkflowRun }
  | { type: 'workflow.run.failed'; run: WorkflowRun }
  | { type: 'workflow.run.cancelled'; run: WorkflowRun }
);
