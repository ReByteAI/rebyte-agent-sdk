import type OpenAI from 'openai';
import { WorkflowAgents } from './resources/workflow-agents/index';
import { Schedules } from './resources/schedules/index';
import { Feedbacks } from './resources/feedback/index';
import { Scenarios } from './resources/scenarios/index';
import { Sessions } from './resources/sessions/index';
import { Models } from './resources/models/index';

/** Rebyte-only APIs sharing the caller's official OpenAI client and transport settings. */
export class RebyteExtensions {
  readonly workflowAgents: WorkflowAgents;
  readonly schedules: Schedules;
  readonly feedback: Feedbacks;
  readonly scenarios: Scenarios;
  readonly sessions: Sessions;
  readonly models: Models;
  constructor(client: OpenAI) {
    this.workflowAgents = new WorkflowAgents(client);
    this.schedules = new Schedules(client);
    this.feedback = new Feedbacks(client);
    this.scenarios = new Scenarios(client);
    this.sessions = new Sessions(client);
    this.models = new Models(client);
  }
}
export * from './resources/workflow-agents/index';
export * from './resources/schedules/index';
export * from './resources/feedback/index';
export * from './resources/scenarios/index';
export * from './resources/sessions/index';
export * from './resources/models/index';
export * from './rebyte-sandbox';
