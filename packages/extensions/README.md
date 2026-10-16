# Rebyte API extensions

Rebyte-only Workflow, Schedule, Scenario, managed model and Turn feedback resources for an existing official `openai`
client. Standard Agents APIs remain on `client.beta.agents`. This package has no
copy of the OpenAI client and does not modify it.

Version 0.7.0 adds keyed Agent and Session creation and metadata list filters to the
Rebyte Loop methods and shared Environments of 0.6.0. Install it with the verified official client:

```sh
pnpm add openai@7.15.0 @rebyteai/agent-extensions@0.7.0
```

The following examples use version 0.7.0. You can also use the
[HTTP quickstart](https://rebyte.ai/docs/rebyte-loop/quickstart#http) directly.

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

## Keyed creation and metadata filters

`rebyte.agents.create()` and `rebyte.sessions.create()` accept an
`'Idempotency-Key'` (1 to 256 characters, scoped to your organization). The key
names the resource: when a response is lost, send the same request with the same
key and Rebyte returns the resource the first attempt created (HTTP 200 instead of
201). A Session retry never starts a second Turn for its `input`. Derive the key
from the record the resource serves, not from a random value per attempt.

```ts
const session = await rebyte.sessions.create({
  agent_id: agent.id,
  input: 'Summarize this week',
  metadata: { app: 'my-app', user: user.id },
  'Idempotency-Key': `weekly-summary/${summary.id}`,
})
```

A retry must send the same request. A different request under a used key, or a
key whose resource was deleted, fails with 409 `idempotency_key_in_use`; treat it
as a definite rejection. These calls are never retried automatically; the client
decides when to retry. Requests without a key always create a new resource.

`rebyte.agents.list()` and `rebyte.sessions.list()` accept an exact-match
`metadata` filter of 1 to 16 entries. Rebyte filters within your organization, so
you never page through unrelated resources to find your own:

```ts
for await (const owned of rebyte.sessions.list({ metadata: { app: 'my-app', user: user.id } }))
  await rebyte.sessions.delete(owned.id)
```

## Reading one Turn

Submitting a message returns the Turn it created. Read that Turn and its Items
directly instead of listing the whole Session:

```ts
const { turn_id } = await rebyte.sessions.events.create(session.id, {
  events: [{ type: 'agent.session.input.message', input: [{ role: 'user', content: [{ type: 'input_text', text: 'Summarize.' }] }] }],
  'Idempotency-Key': `summary/${request.id}`,
});
const turn = await rebyte.sessions.turns.retrieve(turn_id!, { session_id: session.id });
for await (const item of rebyte.sessions.items.list(session.id, { turn_id: turn_id!, order: 'asc' })) render(item);
```

A retry with the same key and events returns the same `turn_id`. Live events
resume after an earlier event while Rebyte retains it (about ten minutes):
`rebyte.sessions.events.stream(session.id, { lastEventId })`. An expired cursor
ends the stream with a `replay_unavailable` error event; reload Turns and Items.

## Feedback — Rebyte Loop (Preview)

Use `rebyte.feedback` to assess existing Turns. See the
[Feedback API](https://rebyte.ai/docs/rebyte-loop/feedback) and
[Loop quickstart](https://rebyte.ai/docs/rebyte-loop/quickstart).

```ts
const feedback = await rebyte.feedback.create({
  turn_id: 'turn_123',
  rating: 'negative',
  comment: 'The report omitted refunded orders.',
  correction: '{"order_id":"A-102","refund_total":19.50}',
  source: { type: 'user', id: 'customer-123' },
}, { headers: { 'Idempotency-Key': 'review-001' } })

await rebyte.feedback.retrieve(feedback.id)
for await (const entry of rebyte.feedback.list({ turn_id: feedback.turn_id, limit: 20 })) {
  console.log(entry.rating, entry.comment)
}
```

Only `turn_id` and `rating` (`positive` or `negative`) are required. Optional
`comment` and `correction` accept `null` or nonblank text up to 16,000 characters.
`source` defaults to `{type: 'application', id: null}`; its type may also be
`user` or `evaluator`, with an optional 1–256 character ID. Attribution is
caller-supplied. Session and Agent identities are resolved by the server.

Feedback is immutable and multiple assessments can refer to one Turn. Reuse
one organization's `Idempotency-Key` for retries of the same submission;
different content under the same key returns 409. Without a key, each accepted
request creates a new record. Creation defaults to no automatic retries.
List pagination requires `turn_id` or `scenario_id` (or both), and accepts
`limit`, `order` and `after`. Feedback includes a required nullable `scenario_id`,
inherited from the Turn's Session. An optional `scenario_id` on create asserts
that binding; it cannot change it.
Reads require `tasks:read`; creation requires `tasks:write`. Deleted Sessions'
feedback is inaccessible. Submitting feedback does not start execution or learning.

## Scenarios and bound Sessions — Rebyte Loop (Preview)

Use `rebyte.scenarios` and `rebyte.sessions` with the same authenticated client.
This iteration supports direct Session creation; saved Agent defaults and
Schedule targets do not accept a Scenario setting.
A Scenario is an organization-owned grouping for
comparing tasks and feedback across Sessions and Agent revisions. Names may
repeat; renaming preserves the `scn_…` ID. There is no delete endpoint.

```ts
const scenario = await rebyte.scenarios.create({
  name: 'Sales report checks', description: 'Review refund coverage.', metadata: { suite: 'reports-v1' },
}, { headers: { 'Idempotency-Key': 'sales-report-scenario-v1' } })
const session = await rebyte.sessions.create({
  agent_id: agentId, scenario_id: scenario.id,
})
// Subscribe before submitting input; GET streams do not replay earlier events.
const stream = await rebyte.sessions.events.stream(session.id)
await rebyte.sessions.events.create(session.id, {
  scenario_id: scenario.id, 'Idempotency-Key': crypto.randomUUID(),
  events: [{ type: 'agent.session.input.message', input: [
    { role: 'user', content: [{ type: 'input_text', text: 'Summarize last month’s sales.' }] },
  ] }],
})
for await (const event of stream) {
  if (event.type === 'agent.session.turn.completed' || event.type === 'agent.session.turn.failed'
    || event.type === 'agent.session.turn.cancelled') {
    console.log(event.turn.id, event.turn.scenario_id)
    stream.controller.abort()
    break
  }
}
for await (const entry of rebyte.sessions.list({ scenario_id: scenario.id })) console.log(entry.id)
for await (const entry of rebyte.feedback.list({ scenario_id: scenario.id })) console.log(entry.rating)
```

Use `try/finally` to abort streams when your handler exits. Reconcile with `rebyte.sessions.turns.list` after a
disconnect or a late subscription. The [complete recipe](../../examples/agents-api/scenarios.mjs)
uses polling and creates the Scenario, Agent, Session, Turn and feedback.

`scenarios.create`, `.retrieve`, `.list` and `.update` share the official client.
Create accepts a nonblank name up to 256 characters, an optional nullable
description up to 4,000 characters and optional object metadata. Update replaces
supplied fields; `metadata: null` clears metadata. A creation retry with the
same `Idempotency-Key` and body returns the original Scenario (200 instead of
201); different content under that key returns 409. Session creation itself is
not idempotent.

`rebyte.sessions` provides typed create/retrieve/update/list/delete, `turns`,
`events`, and delegates `items`, `artifacts`, `subagents` to the official client.
The delegated `subagents` object does not imply server support: Rebyte still
rejects enabled native multi-agent execution and does not implement those endpoints.
`SessionResource`, `TurnResource`, `Feedback` and embedded lifecycle event
resources expose `scenario_id: string | null`. Omitted/null at Session creation
means unbound. The binding is immutable; it is not a saved Agent setting.
`events.create` accepts an optional nullable `scenario_id` assertion that must
match the Session; omit it to inherit. Standard official-client calls still work,
but their upstream types do not describe these Rebyte fields.

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

## Models and training runs — Rebyte Loop (Preview)

Create an organization-owned model family bound to a Scenario, then explicitly
train from reviewed Turns. The server prepares text examples; your application
does not need to tokenize them.

```ts
const model = await rebyte.models.create({ name: 'Order extraction',
  base_model: 'Qwen/Qwen3.6-35B-A3B', scenario_id: scenario.id },
{ headers: { 'Idempotency-Key': 'orders-model-001' } });
const run = await rebyte.models.trainingRuns.create(model.id, {
  data: { mode: 'all', turn_ids: [turnID] },
}, { idempotencyKey: 'orders-training-001' });
console.log(run.id, run.version_id, run.source, run.training, run.dataset_sha256);
for await (const example of rebyte.models.trainingRuns.examples(model.id, run.id)) {
  console.log(example.messages, example.target);
}
console.log(await rebyte.models.trainingRuns.status(model.id, run.id));
// Once ready, evaluate the exact version before publishing it.
await rebyte.models.publish(model.id, { version_id: run.version_id });
```

`trainingRuns` also provides `.list`, `.retrieve` and `.control` with `pause`,
`resume` or `cancel`. Persist the input and retry key before submission. Reusing
both returns the same run, original source and immutable snapshot. Changing the
input under the same key returns a conflict. Terminal runs never restart.

Omitted source selects the published version or base model. Omitted settings
are seeded once and returned in full. `all` selects current eligible data;
`untrained` excludes sample revisions present in the chosen source's successful
ancestry. Failed/cancelled experiments and unrelated branches do not consume data.
Only positive or corrected answers enter SFT; negative-only assessments stay
available for review. This release does not implement reinforcement learning.

`rebyte.scenarios.turns.list` and `.retrieve` expose input, output, current
feedback and training eligibility. `rebyte.feedback.delete`,
`rebyte.scenarios.turns.clearFeedback` and `.delete` remove current data without
rewriting admitted snapshots. Deleting a Turn makes later Turns in that Session
ineligible for future training because their context may include the deleted text.

`models.versions.retrieve`, `.list` and `.status` expose immutable versions and
numerical progress. Model family IDs (`ftm_`) resolve to the published version
when a new Session is created; existing Sessions stay pinned to their version
(`ftv_`). Turns, feedback, history and traces retain `model_version_id`.

`ready` confirms serving works, not task quality. Check `expires_at` before use;
publication does not extend lifetime. `stop_requested_at` records a stop request
while work and cleanup settle. Poll for a terminal state.

See the [training-run guide](https://rebyte.ai/docs/rebyte-loop/training-runs),
[versions and publishing](https://rebyte.ai/docs/rebyte-loop/model-versions),
and [command recipes](../../examples/agents-api/README.md).

## Shared environments

These methods are included in the 0.6.0 npm package. The public HTTP API
also supports sharing. The extension uses the official transport without modifying
the official client types.

This is a developer API: Rebyte enforces authenticated organization ownership
and API scopes. Your application owns end-user authorization, shared-file/process
coordination, MCP names/configuration and resource cleanup. The organization comes
from the validated API key; an Environment ID from another organization returns
404 on reference, read, file access or deletion.

| Session `environment` input | Behavior |
| --- | --- |
| Omitted, `null`, or `{ type: 'none' }` | No Sandbox; supply initial `input`. |
| `{ type: 'openai_hosted', ... }` | New private Environment; no prior ID needed. |
| `{ type: 'reference', environment_id }` | Explicitly attach to an existing Environment in the key's organization. |

```typescript
const rebyte = new RebyteExtensions(client); // client uses https://api.rebyte.ai/v1
const main = await rebyte.sessions.create({
  agent: { model: 'gpt-6-luna' },
  environment: { type: 'openai_hosted' },
});
if (main.environment.type !== 'openai_hosted') throw new Error('Expected Environment');
const environmentId = main.environment.id;
const helper = await rebyte.sessions.create({
  agent: { model: 'gpt-6-luna' },
  environment: { type: 'reference', environment_id: environmentId },
});
```

The response resolves the hosted Environment. Histories, Turns, model settings,
service MCP configuration and Artifacts remain Session-owned. Files, processes
and VM-visible credentials are shared. This creates independent Sessions, not a
parent/child relationship or native subagent result channel.

Environment-origin MCP brokers share `server_label` within the Sandbox. A later
Session with the same label uses the live broker's original command, environment
or HTTP endpoint/headers, even if it submits a different configuration. Rebyte
does not compare or reject these conflicts; simultaneous first launches have no
guaranteed winner. The developer decides whether to reuse a label or use distinct
labels/Environments. Service-origin HTTP MCP does not use this shared namespace.

| Method | Contract |
| --- | --- |
| `rebyte.environments.create({ environment: { type: 'openai_hosted', ... }, vault_ids? })` | Allocates standalone identity/configuration; returns a pending Environment. Does not start compute. |
| `rebyte.environments.retrieve(id)` | Uses the existing official Environment endpoint. |
| `rebyte.environments.files.create/list` | Uses official Environment file operations; first filesystem use initializes compute. |
| `rebyte.environments.delete(id)` | Deletes an unattached Environment and its fixed Sandbox. Returns `{ id, object: 'agent.environment.deleted', deleted: true }`. |

The Environment's files, packages, setup, Skills, network policy and Vault
selection are fixed by its creation configuration. A reference cannot override
these fields, and a referencing Session's Vault selection does not replace them.
The Session attachment is fixed at creation. Workflow Agent and Schedule inputs
retain their existing owned-environment types. No Environment listing is added.

Inline Environments retain private lifetime until first referenced. The first
reference permanently promotes an Environment to shared lifetime; standalone
Environments are shared from creation. Deleting any Session then preserves the
Sandbox, even after the last Session detaches. Clean up explicitly:

```typescript
await rebyte.sessions.delete(main.id);
await rebyte.sessions.delete(helper.id);
await rebyte.environments.delete(environmentId);
```

Stdio MCP and other background processes can outlive Session deletion in a shared
Environment and retain their launch-time credentials. Stop services explicitly
when needed. Session deletion still attempts initialized HTTP MCP termination;
that can affect peers using a reused environment-origin connection. Coordinate
cleanup in your application. A dead broker is not automatically restarted.

Missing, deleted or foreign references return 404; configuration overrides return
400. Failed, initializing or deleting Environments reject new references with
409. Pending Environments accept references and concurrent first use joins one
initialization. Explicit deletion rejects attached or initializing Environments
with 409. Creation is not idempotent; resolve ambiguous timeouts before retrying.

Turn cancellation does not delete the Sandbox, undo side effects or guarantee
termination of background processes from earlier calls. Initialization belongs
to the Environment, keyed by its ID allocated at creation. Cancelling a waiting
Turn leaves initialization running, even before provisioning starts. Other
Sessions and file requests join the same initialization; the cancelled Session
can submit another Turn against the same Environment. A terminal initialization
failure is recorded without clearing or replacing the Sandbox binding.
There is no reset/rebind API; recovery can require explicitly deleting attached
Sessions and the unused Environment, then creating new resources.

Use `$REBYTE_OUTPUT_DIR` for deliverables. The original inline owner keeps
`/workspace/outputs`; reference Sessions and all Sessions on standalone
Environments use `/workspace/outputs/sessions/<session_id>`. Once shared, the
original owner's collector excludes the reserved `sessions/` subtree. Existing
private output collection remains unchanged. Live file IDs belong to the
Environment, while immutable Artifacts remain Session/Turn-scoped.

Output directories are not security isolation: every Session sharing compute can
access that Sandbox's files, processes and visible secrets. Enforce end-user
access before making requests with an organization key.

See [the complete example](../../examples/agents-api/shared-environment.mjs)
for file sharing and cleanup. Build the source, then run it with an explicit
API URL as described in the [recipe guide](../../examples/agents-api/README.md#shared-environment).
