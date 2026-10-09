/** Caller-supplied attribution, not a verified user identity or authorization boundary. */
export interface FeedbackSource {
  type: 'user' | 'application' | 'evaluator';
  id: string | null;
}

export interface FeedbackDeleted { object: 'feedback.deleted'; id: string; deleted: true }

/** Immutable assessment of one Agents API Turn. Timestamps are Unix seconds. */
export interface Feedback {
  object: 'feedback';
  id: string;
  agent_id: string;
  session_id: string;
  turn_id: string;
  scenario_id: string | null;
  /** Actual immutable model version used by the Turn; null for catalog models. */
  model_version_id: string | null;
  rating: 'positive' | 'negative';
  comment: string | null;
  correction: string | null;
  source: FeedbackSource;
  created_at: number;
}

export interface FeedbackCreateParams {
  turn_id: string;
  /** Optional assertion; omitted inherits the Turn's immutable Session binding. */
  scenario_id?: string | null;
  rating: 'positive' | 'negative';
  /** Nonblank text, at most 16,000 characters. */
  comment?: string | null;
  /** Optional corrected answer or desired behavior; at most 16,000 characters. */
  correction?: string | null;
  /** Defaults to { type: 'application', id: null } at creation. */
  source?: { type: FeedbackSource['type']; id?: string | null };
}

export type FeedbackListParams = ({ turn_id: string; scenario_id?: string } | { turn_id?: string; scenario_id: string }) & {
  /** 1–100, default 20. */
  limit?: number;
  /** Insertion order, default descending. */
  order?: 'asc' | 'desc';
  after?: string;
};
