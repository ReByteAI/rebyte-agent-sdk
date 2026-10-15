import { APIResource } from 'openai/core/resource';
import { APIPromise } from 'openai/core/api-promise';
import type { EnvironmentInfo } from 'openai/resources/beta/agents/environments/environments';
import type { SessionCreateParamsBase } from 'openai/resources/beta/agents/sessions/sessions';
import { buildHeaders, path, type RequestOptions } from '../../request';

/** Attach at Session creation to an Environment owned by the authenticated
 * organization. The developer coordinates its shared files, processes and MCP
 * names; a reference cannot override setup or create Session-level VM isolation.
 */
export interface EnvironmentReference { type: 'reference'; environment_id: string }
export interface EnvironmentCreateParams {
  environment: Extract<SessionCreateParamsBase['environment'], { type: 'openai_hosted' }>;
  vault_ids?: string[];
}
export interface EnvironmentDeleted { id: string; object: 'agent.environment.deleted'; deleted: true }

/** Shared Rebyte environments use the official transport, without patching the official resource methods. */
export class Environments extends APIResource {
  readonly files = this._client.beta.agents.environments.files;
  create(body: EnvironmentCreateParams, options?: RequestOptions): APIPromise<EnvironmentInfo> {
    return this._client.post('/agents/environments', { maxRetries: 0, ...options, body,
      headers: buildHeaders([{ 'OpenAI-Beta': 'agents=v1' }, options?.headers]), __security: { bearerAuth: true } });
  }
  retrieve(environmentID: string, options?: RequestOptions): APIPromise<EnvironmentInfo> {
    return this._client.beta.agents.environments.retrieve(environmentID, options);
  }
  delete(environmentID: string, options?: RequestOptions): APIPromise<EnvironmentDeleted> {
    return this._client.delete(path`/agents/environments/${environmentID}`, { maxRetries: 0, ...options,
      headers: buildHeaders([{ 'OpenAI-Beta': 'agents=v1' }, options?.headers]), __security: { bearerAuth: true } });
  }
}
export type { EnvironmentInfo };
