import { APIResource } from 'openai/core/resource';
import { APIPromise } from 'openai/core/api-promise';
import { CursorPage, PagePromise } from 'openai/core/pagination';
import { buildHeaders, path, type RequestOptions } from '../../request';
import type { ManagedModel, ModelCreateParams, ModelListParams, ModelVersion, ModelVersionCreateParams,
  ModelVersionCreateOptions, ModelVersionStatus, ModelControlAction, ModelControlReceipt } from './types';
import { ModelTrainingRuns } from './training-runs';

export type ModelsPage = CursorPage<ManagedModel>;
export type ModelVersionsPage = CursorPage<ModelVersion>;

/** Immutable training versions. Creation never publishes the family alias. */
export class ModelVersions extends APIResource {
  create(modelID: string, body: ModelVersionCreateParams, options: ModelVersionCreateOptions): APIPromise<ModelVersion> {
    const { idempotencyKey, ...request } = options;
    if (idempotencyKey.trim().length === 0 || idempotencyKey.length > 256) throw new Error('A nonblank idempotencyKey of at most 256 characters is required');
    return this._client.post(path`/models/${modelID}/versions`, {
      maxRetries: 0, ...request, body,
      headers: buildHeaders([request.headers, { 'Idempotency-Key': idempotencyKey }]), __security: { bearerAuth: true },
    });
  }
  retrieve(modelID: string, versionID: string, options?: RequestOptions): APIPromise<ModelVersion> {
    return this._client.get(path`/models/${modelID}/versions/${versionID}`, { ...options, __security: { bearerAuth: true } });
  }
  list(modelID: string, query: ModelListParams = {}, options?: RequestOptions): PagePromise<ModelVersionsPage, ModelVersion> {
    return this._client.getAPIList(path`/models/${modelID}/versions`, CursorPage<ModelVersion>, { ...options, query, __security: { bearerAuth: true } });
  }
  status(modelID: string, versionID: string, options?: RequestOptions): APIPromise<ModelVersionStatus> {
    return this._client.get(path`/models/${modelID}/versions/${versionID}/status`, { ...options, __security: { bearerAuth: true } });
  }
  /** Accepted asynchronously. Pause/resume require an active training child; queued GPU work can finish after cancel. */
  control(modelID: string, versionID: string, body: { action: ModelControlAction }, options?: RequestOptions): APIPromise<ModelControlReceipt> {
    return this._client.post(path`/models/${modelID}/versions/${versionID}/control`, { maxRetries: 0, ...options, body, __security: { bearerAuth: true } });
  }
}

/** Organization-owned model families, for Rebyte Loop (Preview). */
export class Models extends APIResource {
  readonly versions = new ModelVersions(this._client);
  readonly trainingRuns = new ModelTrainingRuns(this._client);
  create(body: ModelCreateParams, options?: RequestOptions): APIPromise<ManagedModel> {
    return this._client.post('/models', { maxRetries: 0, ...options, body, __security: { bearerAuth: true } });
  }
  retrieve(modelID: string, options?: RequestOptions): APIPromise<ManagedModel> {
    return this._client.get(path`/models/${modelID}`, { ...options, __security: { bearerAuth: true } });
  }
  list(query: ModelListParams = {}, options?: RequestOptions): PagePromise<ModelsPage, ManagedModel> {
    return this._client.getAPIList('/models', CursorPage<ManagedModel>, { ...options, query, __security: { bearerAuth: true } });
  }
  /** Explicitly point the family alias at a ready, unexpired version owned by this family. */
  publish(modelID: string, body: { version_id: string }, options?: RequestOptions): APIPromise<ManagedModel> {
    return this._client.post(path`/models/${modelID}/publish`, { maxRetries: 0, ...options, body, __security: { bearerAuth: true } });
  }
}
