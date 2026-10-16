import type OpenAI from 'openai';
import { APIResource } from 'openai/core/resource';
import { APIPromise } from 'openai/core/api-promise';
import { CursorPage, PagePromise } from 'openai/core/pagination';
import { buildHeaders, type RequestOptions } from '../../request';
import type { AgentCreateParams, AgentListParams, AgentResource } from './types';

export type AgentsPage = CursorPage<AgentResource>;

/** Agent creation with a retry key and metadata-filtered listing; other Agent methods are the official client's. */
export class Agents extends APIResource {
  readonly retrieve: OpenAI['beta']['agents']['retrieve'] = this._client.beta.agents.retrieve.bind(this._client.beta.agents);
  readonly update: OpenAI['beta']['agents']['update'] = this._client.beta.agents.update.bind(this._client.beta.agents);
  readonly delete: OpenAI['beta']['agents']['delete'] = this._client.beta.agents.delete.bind(this._client.beta.agents);

  create(params: AgentCreateParams, options?: RequestOptions): APIPromise<AgentResource> {
    const { 'Idempotency-Key': key, ...body } = params;
    return this._client.post('/agents', { maxRetries: 0, ...options, body,
      headers: buildHeaders([{ 'OpenAI-Beta': 'agents=v1', ...(key === undefined ? {} : { 'Idempotency-Key': key }) }, options?.headers]),
      __security: { bearerAuth: true } });
  }
  list(query: AgentListParams = {}, options?: RequestOptions): PagePromise<AgentsPage, AgentResource> {
    return this._client.getAPIList('/agents', CursorPage<AgentResource>, {
      ...options, query, headers: buildHeaders([{ 'OpenAI-Beta': 'agents=v1' }, options?.headers]), __security: { bearerAuth: true },
    });
  }
}
