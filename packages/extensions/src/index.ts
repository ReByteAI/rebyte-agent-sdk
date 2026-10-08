import type OpenAI from 'openai';
import { WorkflowAgents } from './resources/workflow-agents/index';
import { Schedules } from './resources/schedules/index';
import { Feedbacks } from './resources/feedback/index';

/** Rebyte-only APIs sharing the caller's official OpenAI client and transport settings. */
export class RebyteExtensions {
  readonly workflowAgents: WorkflowAgents;
  readonly schedules: Schedules;
  readonly feedback: Feedbacks;
  constructor(client: OpenAI) {
    this.workflowAgents = new WorkflowAgents(client);
    this.schedules = new Schedules(client);
    this.feedback = new Feedbacks(client);
  }
}
export * from './resources/workflow-agents/index';
export * from './resources/schedules/index';
export * from './resources/feedback/index';
export * from './rebyte-sandbox';
