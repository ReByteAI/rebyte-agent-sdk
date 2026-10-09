import type { TurnResource } from '../sessions/types';
import type { Feedback } from '../feedback/types';

/** Organization-owned task grouping. Names may repeat; IDs survive renaming. */
export interface Scenario {
  object: 'scenario';
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown>;
  /** Unix seconds. */
  created_at: number;
  /** Unix seconds. */
  updated_at: number;
}

export interface ScenarioCreateParams {
  /** Nonblank text, at most 256 characters. */
  name: string;
  /** At most 4,000 characters. */
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ScenarioUpdateParams {
  name?: string;
  description?: string | null;
  /** Replaces metadata; null clears it. Omit to leave unchanged. */
  metadata?: Record<string, unknown> | null;
}

export interface ScenarioListParams {
  limit?: number;
  order?: 'asc' | 'desc';
  after?: string;
}

export interface ScenarioTurnListParams extends ScenarioListParams { status?: TurnResource['status'] }
/** Review data and the current text-training eligibility of one business Turn. */
export type ScenarioTurnReview = TurnResource & {
  input: Array<Record<string, unknown>>;
  output_text: string | null;
  latest_feedback: Feedback | null;
  training: { eligible: boolean; reason: string | null; target: string | null };
};
export interface ScenarioTurnDeleted { id: string; object: 'agent.session.turn.deleted'; deleted: true }
