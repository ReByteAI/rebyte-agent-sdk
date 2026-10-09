import { APIResource } from 'openai/core/resource';
import { APIPromise } from 'openai/core/api-promise';
import { CursorPage, PagePromise } from 'openai/core/pagination';
import { path, type RequestOptions } from '../../request';
import type { Scenario, ScenarioCreateParams, ScenarioListParams, ScenarioUpdateParams,
  ScenarioTurnListParams, ScenarioTurnReview, ScenarioTurnDeleted } from './types';

export type ScenariosPage = CursorPage<Scenario>;
export type ScenarioTurnsPage = CursorPage<ScenarioTurnReview>;

/** Review and remove current Scenario data without rewriting admitted training snapshots. */
export class ScenarioTurns extends APIResource {
  list(scenarioID: string, query: ScenarioTurnListParams = {}, options?: RequestOptions): PagePromise<ScenarioTurnsPage, ScenarioTurnReview> {
    return this._client.getAPIList(path`/scenarios/${scenarioID}/turns`, CursorPage<ScenarioTurnReview>, { ...options, query, __security: { bearerAuth: true } });
  }
  retrieve(scenarioID: string, turnID: string, options?: RequestOptions): APIPromise<ScenarioTurnReview> {
    return this._client.get(path`/scenarios/${scenarioID}/turns/${turnID}`, { ...options, __security: { bearerAuth: true } });
  }
  /** Clear active feedback for future selection. Existing training snapshots retain their evidence. */
  clearFeedback(scenarioID: string, turnID: string, options?: RequestOptions): APIPromise<void> {
    return this._client.delete(path`/scenarios/${scenarioID}/turns/${turnID}/feedback`, { maxRetries: 0, ...options, __security: { bearerAuth: true } });
  }
  /** Soft-delete a terminal Turn; later Turns in its Session become ineligible for future training. An unfinished Turn returns 409. */
  delete(scenarioID: string, turnID: string, options?: RequestOptions): APIPromise<ScenarioTurnDeleted> {
    return this._client.delete(path`/scenarios/${scenarioID}/turns/${turnID}`, { maxRetries: 0, ...options, __security: { bearerAuth: true } });
  }
}

/** Organization-owned Scenarios; no delete operation. */
export class Scenarios extends APIResource {
  readonly turns = new ScenarioTurns(this._client);
  /** Supply a stable Idempotency-Key in options.headers to deduplicate creation retries. */
  create(body: ScenarioCreateParams, options?: RequestOptions): APIPromise<Scenario> {
    return this._client.post('/scenarios', { maxRetries: 0, ...options, body, __security: { bearerAuth: true } });
  }
  retrieve(scenarioID: string, options?: RequestOptions): APIPromise<Scenario> {
    return this._client.get(path`/scenarios/${scenarioID}`, { ...options, __security: { bearerAuth: true } });
  }
  list(query: ScenarioListParams = {}, options?: RequestOptions): PagePromise<ScenariosPage, Scenario> {
    return this._client.getAPIList('/scenarios', CursorPage<Scenario>, { ...options, query, __security: { bearerAuth: true } });
  }
  update(scenarioID: string, body: ScenarioUpdateParams, options?: RequestOptions): APIPromise<Scenario> {
    return this._client.post(path`/scenarios/${scenarioID}`, { maxRetries: 0, ...options, body, __security: { bearerAuth: true } });
  }
}
