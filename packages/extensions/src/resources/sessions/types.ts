import type { EnvironmentReference } from '../environments/index';
import type { AgentSession, AgentSessionEvent } from 'openai/resources/beta/agents/agents';
import type * as OfficialSessions from 'openai/resources/beta/agents/sessions/sessions';
import type { EventCreateParams } from 'openai/resources/beta/agents/sessions/events';
import type { Turn, TurnRetrieveParams } from 'openai/resources/beta/agents/sessions/turns';

/** Scenario binding is fixed at Session creation; null means unbound. */
export interface SessionResource extends AgentSession { scenario_id: string | null }
export interface TurnResource extends Turn { scenario_id: string | null; model_version_id: string | null }

export interface SessionHistoryEntry {
  object: 'agent.session.history_entry'; id: string; scenario_id: string | null; model_version_id: string | null;
  status: Turn['status']; created_at: number; completed_at: number | null; error: Turn['error'];
  input: Array<Record<string, unknown>>; output_text: string | null;
  items?: Array<import('openai/resources/beta/agents/agents').AgentSessionItem & { id: string }>;
}
export interface SessionHistoryListParams { limit?: number; order?: 'asc' | 'desc'; after?: string; full?: boolean }
export interface SessionTraceListParams { limit?: number; order?: 'asc' | 'desc'; after?: string }
export interface SessionTrace {
  object: 'agent.session.trace'; id: string; session_id: string; scenario_id: string | null; model_version_id: string | null;
  created_at: number; otlp: { resourceSpans: Array<Record<string, unknown>> };
}

type WithScenarioResources<Event> = Event extends { session: AgentSession }
  ? Omit<Event, 'session'> & { session: SessionResource }
  : Event extends { turn: Turn } ? Omit<Event, 'turn'> & { turn: TurnResource } : Event;

/** Retains the official discriminated event union and enriches embedded resources. */
export type SessionEvent = WithScenarioResources<AgentSessionEvent>;
export interface SessionCreateParamsBase extends Omit<OfficialSessions.SessionCreateParamsBase, 'environment'> {
  /** Omission/null selects none and requires initial input. Inline hosted input
   * allocates a new Environment; reference explicitly shares an organization-owned
   * Environment. This binding cannot be changed by a Session update.
   */
  environment?: OfficialSessions.SessionCreateParamsBase['environment'] | EnvironmentReference;
  /** Omitted/null creates an unbound Session. The binding cannot be updated. */
  scenario_id?: string | null;
  /**
   * Organization-scoped creation key (1 to 256 characters), sent as the `Idempotency-Key` header.
   * The key names the Session: a retry after a lost response returns the Session the first attempt
   * created (HTTP 200; a new Session is 201) and never starts a second Turn for `input`. The retry
   * must send the same request; a different request, or a key whose Session was deleted, is 409
   * `idempotency_key_in_use`. Derive it from the record the Session serves.
   */
  'Idempotency-Key'?: string;
}
export interface SessionCreateParamsNonStreaming extends SessionCreateParamsBase { stream?: false }
export interface SessionCreateParamsStreaming extends SessionCreateParamsBase { stream: true }
export type SessionCreateParams = SessionCreateParamsNonStreaming | SessionCreateParamsStreaming;
export type SessionUpdateParams = OfficialSessions.SessionUpdateParams;
export interface SessionListParams extends OfficialSessions.SessionListParams {
  scenario_id?: string;
  /** Exact-match filter, 1 to 16 entries: only Sessions carrying every entry. Filtered by Rebyte. */
  metadata?: Record<string, string>;
}
/** Accepted input. A message creates a Turn; read that Turn directly by its ID. */
export interface SessionEventsAccepted {
  /** The Turn this request's message created, or null when it carried no message. */
  turn_id: string | null;
}
/** Item listing narrowed, optionally, to one Turn. */
export interface SessionItemListParams { limit?: number; order?: 'asc' | 'desc'; after?: string; turn_id?: string }
/** Resume a live event stream after an earlier event's `id` while the stream still retains it. */
export interface SessionEventStreamParams { lastEventId?: string }
/**
 * Retrieve a Turn, or with `stream: true` stream its events, as OpenAI Responses retrieval does:
 * from the Turn's start, then live until it ends. `starting_after` resumes after an event's
 * `sequence_number` while Rebyte retains the Turn's events (about ten minutes).
 */
export interface TurnRetrieveParamsBase extends TurnRetrieveParams { stream?: boolean; starting_after?: number }
export interface TurnRetrieveParamsNonStreaming extends TurnRetrieveParams { stream?: false }
export interface TurnRetrieveParamsStreaming extends TurnRetrieveParams { stream: true; starting_after?: number }
/** One Turn's event, numbered from 0 at its `agent.session.turn.created`. */
export type TurnStreamEvent = Extract<SessionEvent, { turn_id: string }> & { sequence_number: number };
export interface SessionEventCreateParams extends EventCreateParams {
  /** Optional assertion, not a rebinding operation; must equal the Session binding. */
  scenario_id?: string | null;
}
