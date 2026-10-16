import { APIResource } from 'openai/core/resource';
import { APIPromise } from 'openai/core/api-promise';
import { CursorPage, PagePromise } from 'openai/core/pagination';
import { Stream } from 'openai/core/streaming';
import type { AgentSessionDeleted } from 'openai/resources/beta/agents/agents';
import type { TurnListParams, TurnRetrieveParams } from 'openai/resources/beta/agents/sessions/turns';
import { buildHeaders, path, type RequestOptions } from '../../request';
import type { SessionResource, TurnResource, SessionEvent, SessionCreateParamsBase,
  SessionCreateParamsNonStreaming, SessionCreateParamsStreaming, SessionUpdateParams,
  SessionListParams, SessionEventCreateParams, SessionHistoryEntry, SessionHistoryListParams, SessionTrace, SessionTraceListParams,
  SessionEventsAccepted, SessionItemListParams, SessionEventStreamParams } from './types';
import type { AgentSessionItem as SessionItem } from 'openai/resources/beta/agents/agents';

const headers = (options?: RequestOptions) => buildHeaders([{ 'OpenAI-Beta': 'agents=v1' }, options?.headers]);
export type SessionsPage = CursorPage<SessionResource>;
export type SessionTurnsPage = CursorPage<TurnResource>;
export type SessionHistoryPage = CursorPage<SessionHistoryEntry>;
export type SessionTracesPage = CursorPage<SessionTrace>;
export type SessionItemsPage = CursorPage<SessionItem>;

/** Items with a Rebyte `turn_id` filter: read one Turn's Items without listing the Session. */
export class SessionItems extends APIResource {
  list(sessionID: string, query: SessionItemListParams = {}, options?: RequestOptions): PagePromise<SessionItemsPage, SessionItem> {
    return this._client.getAPIList(path`/agents/sessions/${sessionID}/items`, CursorPage<SessionItem>, {
      ...options, query, headers: headers(options), __security: { bearerAuth: true },
    });
  }
}

export class SessionHistory extends APIResource {
  list(sessionID: string, query: SessionHistoryListParams = {}, options?: RequestOptions): PagePromise<SessionHistoryPage, SessionHistoryEntry> {
    const { full, ...page } = query;
    return this._client.getAPIList(path`/agents/sessions/${sessionID}/history`, CursorPage<SessionHistoryEntry>, {
      ...options, query: { ...page, ...(full === undefined ? {} : { full: String(full) }) }, headers: headers(options), __security: { bearerAuth: true },
    });
  }
}
export class SessionTraces extends APIResource {
  list(sessionID: string, query: SessionTraceListParams = {}, options?: RequestOptions): PagePromise<SessionTracesPage, SessionTrace> {
    return this._client.getAPIList(path`/agents/sessions/${sessionID}/traces`, CursorPage<SessionTrace>, {
      ...options, query, headers: headers(options), __security: { bearerAuth: true },
    });
  }
}

export class SessionEvents extends APIResource {
  /** Submit input. The response names the Turn a message created (Rebyte extension). */
  create(sessionID: string, params: SessionEventCreateParams, options?: RequestOptions): APIPromise<SessionEventsAccepted> {
    const { 'Idempotency-Key': key, ...body } = params;
    return this._client.post(path`/agents/sessions/${sessionID}/events`, {
      maxRetries: 0, ...options, body,
      headers: buildHeaders([{ 'OpenAI-Beta': 'agents=v1', Accept: '*/*',
        ...(key === undefined ? {} : { 'Idempotency-Key': key }) }, options?.headers]),
      __security: { bearerAuth: true },
    });
  }
  /** Live events from now, or after `lastEventId` while it is retained (about ten minutes). */
  stream(sessionID: string, params: SessionEventStreamParams = {}, options?: RequestOptions): APIPromise<Stream<SessionEvent>> {
    return this._client.get(path`/agents/sessions/${sessionID}/events`, {
      ...options, headers: buildHeaders([{ 'OpenAI-Beta': 'agents=v1', Accept: 'text/event-stream',
        ...(params.lastEventId === undefined ? {} : { 'Last-Event-ID': params.lastEventId }) }, options?.headers]),
      stream: true, __security: { bearerAuth: true },
    });
  }
}

export class SessionTurns extends APIResource {
  retrieve(turnID: string, params: TurnRetrieveParams, options?: RequestOptions): APIPromise<TurnResource> {
    return this._client.get(path`/agents/sessions/${params.session_id}/turns/${turnID}`, {
      ...options, headers: headers(options), __security: { bearerAuth: true },
    });
  }
  list(sessionID: string, query: TurnListParams = {}, options?: RequestOptions): PagePromise<SessionTurnsPage, TurnResource> {
    return this._client.getAPIList(path`/agents/sessions/${sessionID}/turns`, CursorPage<TurnResource>, {
      ...options, query, headers: headers(options), __security: { bearerAuth: true },
    });
  }
}

/** Thin Scenario-aware Session APIs; the official client owns HTTP, pagination and SSE. */
export class Sessions extends APIResource {
  readonly events = new SessionEvents(this._client);
  readonly turns = new SessionTurns(this._client);
  readonly history = new SessionHistory(this._client);
  readonly traces = new SessionTraces(this._client);
  readonly items = new SessionItems(this._client);
  readonly artifacts = this._client.beta.agents.sessions.artifacts;
  readonly subagents = this._client.beta.agents.sessions.subagents;

  create(body: SessionCreateParamsNonStreaming, options?: RequestOptions): APIPromise<SessionResource>;
  create(body: SessionCreateParamsStreaming, options?: RequestOptions): APIPromise<Stream<SessionEvent>>;
  create(body: SessionCreateParamsBase, options?: RequestOptions): APIPromise<SessionResource | Stream<SessionEvent>>;
  create(params: SessionCreateParamsBase, options?: RequestOptions): APIPromise<SessionResource | Stream<SessionEvent>> {
    const { 'Idempotency-Key': key, ...body } = params;
    return this._client.post('/agents/sessions', { maxRetries: 0, ...options, body,
      headers: buildHeaders([{ 'OpenAI-Beta': 'agents=v1', ...(key === undefined ? {} : { 'Idempotency-Key': key }) }, options?.headers]),
      stream: body.stream ?? false, __security: { bearerAuth: true } });
  }
  retrieve(sessionID: string, options?: RequestOptions): APIPromise<SessionResource> {
    return this._client.get(path`/agents/sessions/${sessionID}`, { ...options, headers: headers(options), __security: { bearerAuth: true } });
  }
  /** Scenario binding is immutable. */
  update(sessionID: string, body: SessionUpdateParams = {}, options?: RequestOptions): APIPromise<SessionResource> {
    return this._client.post(path`/agents/sessions/${sessionID}`, { maxRetries: 0, ...options, body,
      headers: headers(options), __security: { bearerAuth: true } });
  }
  list(query: SessionListParams = {}, options?: RequestOptions): PagePromise<SessionsPage, SessionResource> {
    return this._client.getAPIList('/agents/sessions', CursorPage<SessionResource>, {
      ...options, query, headers: headers(options), __security: { bearerAuth: true },
    });
  }
  delete(sessionID: string, options?: RequestOptions): APIPromise<AgentSessionDeleted> {
    return this._client.delete(path`/agents/sessions/${sessionID}`, { ...options, headers: headers(options), __security: { bearerAuth: true } });
  }
}
