// Protocol checks for boundaries that are easy to lose in generated clients.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import OpenAI, { APIError } from 'openai'
import { RebyteExtensions, WorkflowAgents, WorkflowVersionsPage } from '@rebyteai/agent-extensions'

const require = createRequire(import.meta.url)
assert.equal(typeof WorkflowAgents, 'function')
assert.equal(typeof require('@rebyteai/agent-extensions').WorkflowAgents, 'function')
assert.equal(typeof WorkflowVersionsPage, 'function')

const requests = []
let respond
const officialClient = new OpenAI({ apiKey: 'synthetic-workflow-key', baseURL: 'https://workflow.invalid/v1',
  maxRetries: 5,
  fetch: async (url, init) => {
    const request = { url: new URL(url), ...init, headers: new Headers(init.headers), body: init.body && JSON.parse(init.body) }
    assert.equal(request.headers.get('authorization'), 'Bearer synthetic-workflow-key')
    assert.equal(request.headers.get('openai-beta'), null)
    requests.push(request)
    return respond(request)
  },
})
const client = new RebyteExtensions(officialClient)
const sse = (...events) => new Response(events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''),
  { headers: { 'content-type': 'text/event-stream' } })
const definition = { code: 'async input => input', input_schema: {} }
respond = request => {
  assert.equal(request.headers.get('idempotency-key'), 'stable-request')
  assert.deepEqual(request.body, { ...definition, input: null, stream: true })
  return sse(
    { type: 'workflow.run.tool.failed', error: 'A recoverable tool failure', call_id: 'call_1' },
    { type: 'workflow.run.output', value: { recovered: true } },
    { type: 'workflow.run.completed', run: { status: 'completed', result: 42 } },
  )
}
const events = []
for await (const event of await client.workflowAgents.preview({ ...definition, input: null, stream: true, 'Idempotency-Key': 'stable-request' })) events.push(event)
assert.deepEqual(events.map(e => e.type), ['workflow.run.tool.failed', 'workflow.run.output', 'workflow.run.completed'])
assert.equal(events[2].run.result, 42)

// Transport/API errors still throw, including errors that arrive after HTTP headers.
respond = () => sse({ type: 'error', error: { message: 'authoring unavailable', code: 'authoring_not_configured' } })
await assert.rejects(async () => {
  for await (const _ of await client.workflowAgents.generate({ prompt: 'sum', stream: true })) {}
}, e => e instanceof APIError && e.code === 'authoring_not_configured')
respond = () => new Response('event: workflow.run.output\ndata: {broken\n\n', { headers: { 'content-type': 'text/event-stream' } })
await assert.rejects(async () => {
  for await (const _ of await client.workflowAgents.runs.events.stream('run_1')) {}
}, /malformed workflow event JSON/)

// A failed run is a resource, not a thrown HTTP error.
respond = () => sse({ type: 'workflow.run.failed', run: { status: 'failed', error: 'program error' } })
for await (const event of await client.workflowAgents.test('agent_1', { version: 1, input: {}, stream: true })) {
  assert.equal(event.run.status, 'failed')
}

// Ending a live iterator must abort before waiting for nested body cancellation.
let cancelled = false
respond = () => new Response(new ReadableStream({
  start(controller) { controller.enqueue(new TextEncoder().encode('event: workflow.run.output\ndata: {"type":"workflow.run.output","value":1}\n\n')) },
  cancel() { cancelled = true },
}), { headers: { 'content-type': 'text/event-stream' } })
const live = await client.workflowAgents.runs.events.stream('run_1')
for await (const _ of live) break
assert.equal(live.controller.signal.aborted, true)
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(cancelled, true)

// Version pagination must preserve request headers/options and use before, never after.
respond = request => {
  assert.equal(request.headers.get('x-test'), 'versions')
  assert.equal(request.url.searchParams.get('limit'), '1')
  assert.equal(request.url.searchParams.get('after'), null)
  const before = request.url.searchParams.get('before')
  const version = before === null ? 3 : Number(before) - 1
  return Response.json({ object: 'list', data: [{ version }], has_more: version > 1 })
}
const versions = []
for await (const v of client.workflowAgents.versions.list('agent_1', { limit: 1 }, { headers: { 'X-Test': 'versions' } })) versions.push(v.version)
assert.deepEqual(versions, [3, 2, 1])

respond = request => {
  assert.equal(request.url.searchParams.get('after'), '9223372036854775806')
  return sse({ type: 'workflow.run.completed', run: { status: 'completed' } })
}
for await (const _ of await client.workflowAgents.runs.events.stream('run_1', { after: '9223372036854775806' })) {}
respond = request => { assert.deepEqual(request.body, {}); return Response.json({ status: 'cancelled' }) }
assert.equal((await client.workflowAgents.runs.cancel('run_1')).status, 'cancelled')

// Function results carry JSON directly, preserve false/null, and use the run route.
const functionResult = { call_id: 'call_1', success: true, output: { value: 42, enabled: false, empty: null } }
respond = request => {
  assert.equal(request.url.pathname, '/v1/workflow-agents/runs/run_1/tool-results')
  assert.equal(request.method, 'POST')
  assert.deepEqual(request.body, functionResult)
  return Response.json({ status: 'in_progress', required_actions: [] })
}
assert.equal((await client.workflowAgents.runs.submitToolResult('run_1', functionResult)).status, 'in_progress')
respond = request => {
  assert.equal(request.url.searchParams.get('agent_id'), 'agent_1')
  return Response.json({ object: 'list', data: [], has_more: false })
}
await client.workflowAgents.runs.list({ agent_id: 'agent_1' })

// These POSTs must not duplicate generation, draft creation or code execution on ambiguous 5xxs.
respond = () => Response.json({ error: { message: 'temporary failure' } }, { status: 503 })
for (const operation of [
  () => client.workflowAgents.create({ name: 'test', ...definition }),
  () => client.workflowAgents.versions.create('agent_1', definition),
  () => client.workflowAgents.generate({ prompt: 'test' }),
  () => client.workflowAgents.preview({ ...definition, input: {} }),
  () => client.workflowAgents.test('agent_1', { version: 1, input: {} }),
  () => client.workflowAgents.runs.create('agent_1', { input: {} }),
  () => client.workflowAgents.runs.submitToolResult('run_1', functionResult),
]) {
  const before = requests.length
  await assert.rejects(operation, APIError)
  assert.equal(requests.length, before + 1)
}

// Keyed creation: the key travels as Idempotency-Key, never in the body, and is never retried automatically.
const agentsRequests = []
let agentsRespond
const agentsClient = new RebyteExtensions(new OpenAI({ apiKey: 'synthetic-agents-key', baseURL: 'https://agents.invalid/v1', maxRetries: 5,
  fetch: async (url, init) => {
    const request = { url: new URL(url), ...init, headers: new Headers(init.headers), body: init.body && JSON.parse(init.body) }
    agentsRequests.push(request)
    return agentsRespond(request)
  } }))
const sessionBody = { agent_id: 'agent_1', input: 'hello', metadata: { app: 'impo' } }
agentsRespond = request => {
  assert.equal(request.headers.get('openai-beta'), 'agents=v1')
  if (request.url.pathname === '/v1/agents/sessions' && request.method === 'POST') {
    assert.equal(request.headers.get('idempotency-key'), 'session-key')
    assert.deepEqual(request.body, sessionBody)
    return Response.json({ id: 'sess_1', object: 'agent.session', metadata: sessionBody.metadata })
  }
  if (request.url.pathname === '/v1/agents' && request.method === 'POST') {
    assert.equal(request.headers.get('idempotency-key'), 'agent-key')
    assert.deepEqual(request.body, { model: 'gpt-6-luna', metadata: { app: 'impo' } })
    return Response.json({ id: 'agent_2', object: 'agent', metadata: { app: 'impo' } })
  }
  assert.equal(request.method, 'GET')
  assert.equal(request.url.searchParams.get('metadata[app]'), 'impo')
  assert.equal(request.url.searchParams.get('metadata[user]'), 'u 1')
  return Response.json({ object: 'list', data: [], has_more: false, first_id: null, last_id: null })
}
assert.equal((await agentsClient.sessions.create({ ...sessionBody, 'Idempotency-Key': 'session-key' })).id, 'sess_1')
assert.equal((await agentsClient.agents.create({ model: 'gpt-6-luna', metadata: { app: 'impo' }, 'Idempotency-Key': 'agent-key' })).id, 'agent_2')
for (const page of [agentsClient.sessions.list({ metadata: { app: 'impo', user: 'u 1' } }), agentsClient.agents.list({ metadata: { app: 'impo', user: 'u 1' } })])
  assert.deepEqual((await page).data, [])
agentsRespond = () => Response.json({ error: { message: 'temporary failure' } }, { status: 503 })
for (const operation of [
  () => agentsClient.sessions.create({ ...sessionBody, 'Idempotency-Key': 'session-key' }),
  () => agentsClient.agents.create({ model: 'gpt-6-luna', 'Idempotency-Key': 'agent-key' }),
]) {
  const before = agentsRequests.length
  await assert.rejects(operation, APIError)
  assert.equal(agentsRequests.length, before + 1)
}
// Turn-scoped reads: submission names the created Turn, Items filter by Turn, streams resume after an event.
agentsRespond = request => {
  if (request.method === 'POST' && request.url.pathname === '/v1/agents/sessions/sess_1/events') {
    assert.equal(request.headers.get('idempotency-key'), 'input-key')
    return Response.json({ turn_id: 'turn_1' })
  }
  if (request.url.pathname === '/v1/agents/sessions/sess_1/items') {
    assert.equal(request.url.searchParams.get('turn_id'), 'turn_1')
    return Response.json({ object: 'list', data: [{ id: 'msg_1', type: 'message', turn_id: 'turn_1' }], has_more: false, first_id: 'msg_1', last_id: 'msg_1' })
  }
  assert.equal(request.url.pathname, '/v1/agents/sessions/sess_1/events')
  assert.equal(request.headers.get('last-event-id'), '1-0')
  return new Response('id: 1-1\nevent: agent.session.idle\ndata: {"type":"agent.session.idle"}\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
}
const accepted = await agentsClient.sessions.events.create('sess_1', { events: [{ type: 'agent.session.input.message', input: [{ role: 'user', content: [{ type: 'input_text', text: 'hi' }] }] }], 'Idempotency-Key': 'input-key' })
assert.equal(accepted.turn_id, 'turn_1')
const turnItems = []
for await (const item of agentsClient.sessions.items.list('sess_1', { turn_id: 'turn_1' })) turnItems.push(item)
assert.deepEqual(turnItems.map(item => item.id), ['msg_1'])
const resumed = []
for await (const event of await agentsClient.sessions.events.stream('sess_1', { lastEventId: '1-0' })) resumed.push(event.type)
assert.deepEqual(resumed, ['agent.session.idle'])
console.log('Workflow SDK checks passed: exports, headers, streaming tool failures/API errors, abort, numeric pagination, 64-bit replay cursor, cancellation, JSON function results, run filters and retry policy; keyed Agent/Session creation and metadata list filters; turn_id on submission, Turn-filtered Items and Last-Event-ID resume.')
