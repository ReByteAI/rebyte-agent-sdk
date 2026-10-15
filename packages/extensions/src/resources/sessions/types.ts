import type { EnvironmentReference } from '../environments/index';
import type { AgentSession, AgentSessionEvent } from 'openai/resources/beta/agents/agents';
import type * as OfficialSessions from 'openai/resources/beta/agents/sessions/sessions';
import type { EventCreateParams } from 'openai/resources/beta/agents/sessions/events';
import type { Turn } from 'openai/resources/beta/agents/sessions/turns';

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
}
export interface SessionCreateParamsNonStreaming extends SessionCreateParamsBase { stream?: false }
export interface SessionCreateParamsStreaming extends SessionCreateParamsBase { stream: true }
export type SessionCreateParams = SessionCreateParamsNonStreaming | SessionCreateParamsStreaming;
export type SessionUpdateParams = OfficialSessions.SessionUpdateParams;
export interface SessionListParams extends OfficialSessions.SessionListParams { scenario_id?: string }
export interface SessionEventCreateParams extends EventCreateParams {
  /** Optional assertion, not a rebinding operation; must equal the Session binding. */
  scenario_id?: string | null;
}
