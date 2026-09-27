# Rebyte API extensions

Rebyte-only Workflow and Schedule resources for an existing official `openai`
client. Standard Agents APIs remain on `client.beta.agents`. This package has no
copy of the OpenAI client and does not modify it.

The function-handoff methods and updated run types below require version 0.4.0
or later.

```sh
pnpm add openai@7.15.0 @rebyteai/agent-extensions@0.4.0
```

```ts
import OpenAI from 'openai'
import { RebyteExtensions } from '@rebyteai/agent-extensions'

const client = new OpenAI({
  apiKey: process.env.REBYTE_API_KEY,
  baseURL: 'https://api.rebyte.ai/v1',
  maxRetries: 0,
})
const rebyte = new RebyteExtensions(client)
```

The peer dependency pins the verified `openai@7.15.0` transport. Requests share the
same credentials, URL, custom fetch, timeout and errors as the official client.
The resource implementation imports only exported OpenAI modules. Workflow SSE
needs a dedicated parser because a caught tool failure is data, not an API error.

## Workflow Agents

A Workflow Agent runs saved JavaScript directly with JSON input. There is no outer
model selecting steps. Use `generate()` when you want Rebyte's shared Workflow
Builder to author a draft; authoring and execution are separate operations.

```ts
const agent = await rebyte.workflowAgents.create({
  name: 'Order total',
  code: 'async input => ({ total: input.quantity * input.price })',
  input_schema: {
    type: 'object',
    properties: { quantity: { type: 'number' }, price: { type: 'number' } },
    required: ['quantity', 'price'], additionalProperties: false,
  },
})
let tested = await rebyte.workflowAgents.test(agent.id, {
  version: 1, input: { quantity: 3, price: 7 },
  'Idempotency-Key': crypto.randomUUID(),
})
// HTTP 201 acknowledges admission. Poll until this no-function test settles.
while (tested.status === 'preparing' || tested.status === 'in_progress') {
  await new Promise(resolve => setTimeout(resolve, 250))
  tested = await rebyte.workflowAgents.runs.retrieve(tested.id)
}
if (tested.status !== 'completed') throw new Error(tested.error ?? tested.status)
await rebyte.workflowAgents.publish(agent.id, { version: 1, test_run_id: tested.id })

const events = await rebyte.workflowAgents.runs.create(agent.id, {
  input: { quantity: 4, price: 7 }, stream: true,
  'Idempotency-Key': crypto.randomUUID(),
})
let completed = false
for await (const event of events) {
  if (event.type === 'workflow.run.output') console.log(event.value)
  if (event.type === 'workflow.run.failed' || event.type === 'workflow.run.cancelled') {
    throw new Error(event.run.error ?? event.run.status)
  }
  if (event.type === 'workflow.run.completed') {
    completed = true
    console.log(event.run.result) // { total: 28 }
  }
}
if (!completed) throw new Error('Execution stream ended before completion')
```

This snippet keeps the Agent and run records. The
[complete recipes](../../examples/agents-api/README.md#workflow-agents) clean up
the resources they create. All methods use the organization API key; read/write
operations require `tasks:read` / `tasks:write`. No beta header is needed.

| SDK method | Purpose |
| --- | --- |
| `workflowAgents.create`, `.retrieve`, `.list`, `.delete` | Manage independent Workflow Agents |
| `.generate({ prompt, ... })` | Generate a draft; optionally supply `draft` and `preview_error` to revise it |
| `.preview({ code, input_schema, input, ... })` | Execute unsaved code |
| `.versions.create(agentId, definition)` | Append a full definition or `{ base_version, code, input_schema }` |
| `.versions.retrieve(agentId, version)`, `.versions.list(agentId)` | Read immutable versions; list newest first |
| `.test(agentId, { version, input })` | Test an explicit version with real tools |
| `.publish(agentId, { version, test_run_id })` | Publish after a successful test of the same Agent/version |
| `.runs.create(agentId, { input, version? })` | Run the published default or an explicitly published version |
| `.runs.retrieve`, `.runs.list`, `.runs.cancel`, `.runs.delete` | Read, list across the organization, cancel and clean up runs |
| `.runs.events.stream(runId, { after? })` | Replay and follow persisted events |
| `.runs.submitToolResult(runId, { call_id, success, output?, error? })` | Answer one pending application function |

`generate`, `preview`, `test` and `runs.create` accept `stream: true` and return
an async iterable. Literal `true`/`false` selects the corresponding TypeScript
return type. All list methods auto-paginate with `for await`; version lists use
numeric `before`, while Agent/run lists use `after` IDs. Run lists also accept
`agent_id` to select one saved Agent. Event replay takes a
**string** sequence to preserve 64-bit precision.

Non-streaming HTTP 201 acknowledges an admitted run; it can still be preparing,
running or waiting for a function. Retrieve the run or follow its events until a
terminal status. A function failure can be caught by the program without failing
the run. API failures, including SSE `event: error`, throw SDK errors.

Disconnecting either the original execution stream or an event-only subscription
leaves the run executing. An interrupted stream is not proof of completion. Resume
with `.runs.events.stream(runId, { after: sequence })` or retrieve its state. Use
`.runs.cancel(runId)` to cancel explicitly, then wait for a terminal status before
deleting the run. Cancellation does not undo completed external effects.

Create, version creation, generation, preview, test, execution, result submission and publication
default to zero automatic retries, even if the client has a higher default.
Pass a per-request `{ maxRetries: ... }` to opt in deliberately. For preview,
test and execution, retain the same `'Idempotency-Key'` across retries of one
logical request; changing the input requires a new key. Create, version creation
and generation have no idempotency-key guarantee.

Returned versions/runs redact private configuration. Use `base_version` when
editing code to preserve it, or submit a complete new definition. Configured tools
include MCP connections, web search and directly available application functions;
`{ type: 'openai_hosted' }` adds environment tools. Workflow functions cannot use
`defer_loading: true`; nested `run_code` is unavailable. `web_search.mode: 'cached'`
is accepted and executes live queries.

Await tools and `emit` sequentially. Each active code segment has a 60-second
limit, while each application-function wait allows up to 24 hours. There is no
fixed total program deadline; a Schedule can impose its own shorter limit. Code
replays after a wait, so put time/random reads inside `codemode.step('stable-name', () => ...)`.
Completed tool calls and emitted outputs are retained across replay.

### Application function handoff

A run in `requires_action` exposes `required_actions`. Execute only those calls
in your application, then submit the result:

```ts
const run = await rebyte.workflowAgents.runs.retrieve(runId)
for (const action of run.required_actions) {
  // Validate/authenticate the operation and persist its result by call_id.
  const result = await executeApplicationFunction(action.name, action.arguments, action.call_id)
  await rebyte.workflowAgents.runs.submitToolResult(run.id, {
    call_id: action.call_id, success: true, output: result,
  })
}
```

`executeApplicationFunction` is your application's handler. `output` is a JSON
value, not a JSON-encoded string. Report failure with `{ call_id, success: false,
error: '...' }`. Each request submits exactly one result. Retrying the identical
accepted result while the run is open is safe; conflicting, expired or closed-run
submissions return 409. This does not deduplicate your handler's external effects.
The returned snapshot acknowledges acceptance; continue observing the run.

`expires_at` is the current wait deadline in Unix milliseconds, or `null` outside
a wait. Run snapshots also contain `calls` and ordered `outputs`. Current events
include `.created`, `.started`, `.output`, `.requires_action`, `.tool_result` and
terminal `.completed`/`.failed`/`.cancelled` under `workflow.run`. The SDK retains
older tool-event types for replaying existing histories. See the runnable
[function handoff recipe](../../examples/agents-api/workflow-functions.mjs).

Public types are exported from `@rebyteai/agent-extensions`, including `WorkflowAgent`,
`WorkflowVersion`, `WorkflowRun`, `WorkflowDefinition`, `WorkflowDraft`,
`WorkflowRunEvent` and `WorkflowGenerationEvent`.
See [the API guide](https://rebyte.ai/docs/agents-api/workflow-agents).


### Schedules

`rebyte.schedules` manages independent API schedules targeting an ordinary Agent
or an explicit published Workflow version. Ordinary Agent targets require
`session_mode: 'continuous' | 'isolated'`. Each trigger has its own run record;
continuous schedules retain one Session across Turns.

```ts
const schedule = await rebyte.schedules.create({
  name: 'Daily review',
  target: { type: 'agent', agent_id: 'agent_...', session_mode: 'continuous', input: 'Review progress since the last run.' },
  timing: { type: 'cron', expression: '0 9 * * *', timezone: 'Asia/Shanghai' },
  paused: true,
});
const trigger = await rebyte.schedules.trigger(schedule.id, { 'Idempotency-Key': 'review-1' });
console.log(trigger.run_id); // Accepted asynchronously; poll runs until terminal.
for await (const run of rebyte.schedules.runs.list(schedule.id)) console.log(run.status, run.result);
```

Use `retrieve`, `update`, `pause`, `resume`, `resetSession`, and `delete` for the
schedule, and `runs.retrieve`, `runs.list`, `runs.cancel` for executions. Targets
are immutable. Reset preserves the old Session and files. Deletion preserves run
history. Mutating calls that could create work do not automatically retry by
default; reuse `Idempotency-Key` when retrying a manual trigger.

Schedules allow at most **100 total admitted runs** (default `max_runs: 100`) and
recurring clock times at least **5 minutes apart**. Manual and failed runs consume
the cap; skipped triggers do not. Resetting a Session never resets the run count.
See [Schedules](https://rebyte.ai/docs/agents-api/schedules) for timing and lifetime semantics.
