import { APIResource } from 'openai/core/resource';
import { APIPromise } from 'openai/core/api-promise';
import { CursorPage, PagePromise } from 'openai/core/pagination';
import { path, type RequestOptions } from '../../request';
import type { Feedback, FeedbackCreateParams, FeedbackListParams } from './types';

export type FeedbackPage = CursorPage<Feedback>;

/** Rebyte Turn feedback, using the caller's official OpenAI transport and organization key. */
export class Feedbacks extends APIResource {
  /** Append feedback. Supply a stable Idempotency-Key in options.headers when retrying a submission. */
  create(body: FeedbackCreateParams, options?: RequestOptions): APIPromise<Feedback> {
    return this._client.post('/feedback', { maxRetries: 0, ...options, body, __security: { bearerAuth: true } });
  }

  retrieve(feedbackID: string, options?: RequestOptions): APIPromise<Feedback> {
    return this._client.get(path`/feedback/${feedbackID}`, { ...options, __security: { bearerAuth: true } });
  }

  /** Iterate feedback for one Turn; the Turn's Session must remain accessible. */
  list(query: FeedbackListParams, options?: RequestOptions): PagePromise<FeedbackPage, Feedback> {
    return this._client.getAPIList('/feedback', CursorPage<Feedback>, { ...options, query, __security: { bearerAuth: true } });
  }
}
