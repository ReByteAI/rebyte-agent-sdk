import type * as OfficialAgents from 'openai/resources/beta/agents/agents';

export type AgentResource = OfficialAgents.Agent;
export interface AgentCreateParams extends OfficialAgents.AgentCreateParams {
  /**
   * Organization-scoped creation key (1 to 256 characters), sent as the `Idempotency-Key` header.
   * A retry after a lost response returns the Agent the first attempt created (HTTP 200; a new
   * Agent is 201). A different request, or a key whose Agent was deleted, is 409 `idempotency_key_in_use`.
   */
  'Idempotency-Key'?: string;
}
export interface AgentListParams extends OfficialAgents.AgentListParams {
  /** Exact-match filter, 1 to 16 entries: only Agents carrying every entry. Filtered by Rebyte. */
  metadata?: Record<string, string>;
}
