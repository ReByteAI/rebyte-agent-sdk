import { APIResource } from 'openai/core/resource';
import { APIPromise } from 'openai/core/api-promise';
import { CursorPage, PagePromise } from 'openai/core/pagination';
import { buildHeaders, path, type RequestOptions } from '../../request';
import type { ModelListParams, ModelControlAction, ModelControlReceipt, ModelTrainingRun,
  ModelTrainingRunCreateParams, ModelTrainingRunCreateOptions, ModelTrainingRunStatus,
  ModelTrainingExample } from './types';

export type ModelTrainingRunsPage = CursorPage<ModelTrainingRun>;
export type ModelTrainingExamplesPage = CursorPage<ModelTrainingExample>;

/** Immutable Scenario-data snapshots and managed tokenization/training. Creation never publishes. */
export class ModelTrainingRuns extends APIResource {
  /** Persist this key before submission; retries return the same frozen source, settings and examples. */
  create(modelID: string, body: ModelTrainingRunCreateParams, options: ModelTrainingRunCreateOptions): APIPromise<ModelTrainingRun> {
    const { idempotencyKey, ...request } = options;
    if (idempotencyKey.trim().length === 0 || idempotencyKey.length > 256) throw new Error('A nonblank idempotencyKey of at most 256 characters is required');
    return this._client.post(path`/models/${modelID}/training-runs`, {
      maxRetries: 0, ...request, body,
      headers: buildHeaders([request.headers, { 'Idempotency-Key': idempotencyKey }]), __security: { bearerAuth: true },
    });
  }
  retrieve(modelID: string, runID: string, options?: RequestOptions): APIPromise<ModelTrainingRun> {
    return this._client.get(path`/models/${modelID}/training-runs/${runID}`, { ...options, __security: { bearerAuth: true } });
  }
  list(modelID: string, query: ModelListParams = {}, options?: RequestOptions): PagePromise<ModelTrainingRunsPage, ModelTrainingRun> {
    return this._client.getAPIList(path`/models/${modelID}/training-runs`, CursorPage<ModelTrainingRun>, { ...options, query, __security: { bearerAuth: true } });
  }
  status(modelID: string, runID: string, options?: RequestOptions): APIPromise<ModelTrainingRunStatus> {
    return this._client.get(path`/models/${modelID}/training-runs/${runID}/status`, { ...options, __security: { bearerAuth: true } });
  }
  /** Read the admitted snapshot; later feedback changes or Turn deletion cannot alter these examples. */
  examples(modelID: string, runID: string, query: ModelListParams = {}, options?: RequestOptions): PagePromise<ModelTrainingExamplesPage, ModelTrainingExample> {
    return this._client.getAPIList(path`/models/${modelID}/training-runs/${runID}/examples`, CursorPage<ModelTrainingExample>, { ...options, query, __security: { bearerAuth: true } });
  }
  /** Accepted asynchronously. Read status to observe the resulting training state. */
  control(modelID: string, runID: string, body: { action: ModelControlAction }, options?: RequestOptions): APIPromise<ModelControlReceipt> {
    return this._client.post(path`/models/${modelID}/training-runs/${runID}/control`, { maxRetries: 0, ...options, body, __security: { bearerAuth: true } });
  }
}
