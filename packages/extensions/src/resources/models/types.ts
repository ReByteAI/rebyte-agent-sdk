import type { RequestOptions } from '../../request';

export type ModelSource = { kind: 'base'; rank: number; seed: number; trainMlp: boolean; trainAttention: boolean; trainUnembed: boolean }
  | { kind: 'version'; version_id: string };

/** Explicit supervised fine-tuning controls. Values are validated by Rebyte. */
export interface ModelTrainingSettings {
  epochs: number;
  gradientAccumulationSteps: number;
  finalPartialAccumulation: 'flush';
  batchLimits: { maxExamples: number; maxTokens: number; maxSequenceTokens: number };
  lossNormalization: 'sum' | 'weight_mean';
  adam: { learningRate: number; beta1: number; beta2: number; eps: number; weightDecay: number; gradClipNorm: number };
  schedule: { kind: 'constant' | 'linear' | 'cosine'; warmupSteps: number; endLearningRate: number };
  checkpoint: { everyOptimizerSteps: number; ttlSeconds: number };
  execution: {
    maxDurationSeconds: number; rpcTimeoutSeconds: number; pollIntervalSeconds: number;
    heartbeatIntervalSeconds: number; maxAttemptsPerRequest: number;
    retryInitialIntervalSeconds: number; retryMaximumIntervalSeconds: number;
    continueEveryGroups: number; pauseAtStart: boolean;
  };
  budget: { maxOptimizerSteps: number };
}

/** Already tokenized next-token inputs/targets. Prompt loss is masked with zero weights. */
export interface ModelTrainingBatch {
  version: 1;
  data: Array<{ tokens: number[]; lossInputs: {
    target_tokens: { data: number[]; shape: number[]; dtype: 'int64' };
    weights: { data: number[]; shape: number[]; dtype: 'float32' };
  } }>;
}

export interface ManagedModel {
  object: 'model'; id: string; name: string; base_model: 'Qwen/Qwen3.6-35B-A3B';
  scenario_id: string | null; current_version_id: string | null; metadata: Record<string, string>;
  created_at: number; updated_at: number;
}
export interface ModelCreateParams {
  name: string; base_model: ManagedModel['base_model']; scenario_id?: string | null;
  metadata?: Record<string, string>;
}
export interface ModelListParams { limit?: number; order?: 'asc' | 'desc'; after?: string }
export interface ModelVersionCreateParams {
  source: ModelSource; training: ModelTrainingSettings; batches: ModelTrainingBatch[];
  metadata?: Record<string, string>;
}
/** Keep this key unchanged when retrying an ambiguous submission. */
export type ModelVersionCreateOptions = RequestOptions & { idempotencyKey: string };

export type ModelTrainingDataMode = 'all' | 'untrained';
export interface ModelTrainingRunCreateParams {
  /** Omitted selects the published version, or the base when no version is published. Frozen at admission. */
  source?: ModelSource;
  data?: { mode?: ModelTrainingDataMode; turn_ids?: string[] | null };
  /** Supply the complete settings object to override the server's seeded defaults. */
  training?: ModelTrainingSettings;
  metadata?: Record<string, string>;
}
export type ModelTrainingRunCreateOptions = RequestOptions & { idempotencyKey: string };

/** The exact text context and assistant target retained independently of live Turn/feedback records. */
export interface ModelTrainingExample {
  object: 'model.training_example'; id: string; run_id: string; turn_id: string;
  feedback_id: string; session_id: string; model_version_id: string | null;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  target: string; sha256: string;
}
export interface ModelTrainingRun {
  object: 'model.training_run'; id: string; model_id: string; scenario_id: string;
  base_model: ManagedModel['base_model']; source: ModelSource;
  /** null means every eligible Turn in the Scenario. An empty selection is rejected. */
  data: { mode: ModelTrainingDataMode; turn_ids: string[] | null };
  training: ModelTrainingSettings; metadata: Record<string, string>;
  status: 'queued' | 'preparing' | 'training' | 'ready' | 'failed' | 'cancelled';
  version_id: string; example_count: number; dataset_sha256: string;
  /** Monotonic stop request; work already started may still be settling. */
  stop_requested_at: number | null;
  created_at: number; updated_at: number; error: { code: string } | null;
  preparation: ModelTrainingPreparation | null;
}
/** Exact tokenizer identity and resulting batch sizes from immutable text preparation. */
export interface ModelTrainingPreparation {
  tokenizer: {
    model: ManagedModel['base_model']; revision: string;
    renderer: 'qwen36-chat-target-v1'; enableThinking: false;
    transformersVersion: string; tokenizersVersion: string; jinjaVersion: string;
    tokenizerSha256: string; tokenizerConfigSha256: string; chatTemplateSha256: string; eosTokenId: number;
  };
  stats: { examples: number; batches: number; inputTokens: number; supervisedTokens: number; maxSequenceTokens: number };
}
export interface ModelTrainingRunWorkflow {
  runId: string; phase: ModelTrainingRun['status']; versionId: string | null;
  paused: boolean; controlRevision: number; appliedControlRevision: number;
  controlStatus: 'none' | 'pending' | 'applied' | 'finished'; prepared: boolean;
  startedAt: number; deadlineAt: number; polls: number; failureCode: string | null; cleanupFailureCode: string | null;
}
export interface ModelTrainingRunStatus {
  run: ModelTrainingRun;
  workflow: ModelTrainingRunWorkflow | null;
  model: ModelVersionStatus['workflow'] | null;
}
export interface ModelVersion {
  object: 'model.version'; id: string; model_id: string; base_model: ManagedModel['base_model'];
  scenario_id: string | null;
  status: 'queued' | 'training' | 'verifying' | 'ready' | 'failed' | 'cancelled';
  source: ModelSource; training: ModelTrainingSettings; batch_count: number; metadata: Record<string, string>;
  context_window: number; max_output_tokens: number;
  pricing: { inputPerToken: number; outputPerToken: number; cacheReadPerToken: number; inputIncludesCacheRead: true };
  optimizer_steps: number;
  /** Opaque chk_ and art_ identifiers. They cannot be used as execution paths. */
  training_checkpoint: string | null; sampler_checkpoint: string | null;
  /** Confirms serving works; this is not a task-quality evaluation. */
  verification: { status: 'passed' } | null;
  error: { code: string } | null; created_at: number; updated_at: number; expires_at: number | null;
}
export interface ModelVersionStatus {
  version: ModelVersion;
  workflow: {
    phase: 'preparing' | 'training' | 'staging' | 'registering' | 'verifying' | 'completing' | 'ready' | 'failed' | 'cancelled';
    failureCode: string | null; cleanupFailureCode: string | null;
    /** Null before the training child exists, or once its Temporal history is unavailable. */
    sft: ModelSftProgress | null;
  };
}
export type ModelControlAction = 'pause' | 'resume' | 'cancel';
export interface ModelControlReceipt { id: string; action: ModelControlAction }

export interface ModelSftGroupStats { examples: number; tokens: number; supervisedTokens: number; weightSum: number }
export interface ModelSftCompletedGroup extends ModelSftGroupStats {
  index: number; epochIndex: number; microbatches: number; learningRate: number;
}
/** Public numerical training progress. Infrastructure identities and raw state locations are not exposed. */
export interface ModelSftProgress {
  status: 'preparing' | 'initializing' | 'paused' | 'training' | 'checkpointing' | 'completed' | 'failed' | 'cancelled';
  paused: boolean;
  completedGroups: number; completedMicrobatches: number; trainedExamples: number;
  trainedInputTokens: number; trainedSupervisedTokens: number; trainedWeight: number;
  reservedOptimizerSteps: number; totalOptimizerSteps: number; rpcCalls: number;
  startedAtEpochMs: number; deadlineEpochMs: number | null; finishedAtEpochMs: number | null;
  /** Opaque recovery-state ID; not a path or a download URL. */
  latestCheckpoint: string | null; checkpointStep: number;
  latestGroup: ModelSftCompletedGroup | null;
  lastFailure: { code: string } | null; cleanupFailure: { code: string } | null;
}
