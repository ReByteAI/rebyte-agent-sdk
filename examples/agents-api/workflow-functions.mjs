import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { workflowExample } from './workflow-helpers.mjs'

// Real Workflow API, without a model or Sandbox. Functions execute in this application.
const { client, rememberRun, waitForRun, cleanup } = workflowExample()
const runs = client.workflowAgents.runs
const definition = {
  input_schema: { type: 'object', additionalProperties: false },
  tools: [{ type: 'function', name: 'lookup_value', description: 'Return a value for this part.',
    parameters: { type: 'object', properties: { part: { type: 'string' } }, required: ['part'], additionalProperties: false } }],
  code: `async (input, emit) => {
    const stamp = await codemode.step('timestamp', () => Date.now());
    const first = await tools.lookup_value({ part: 'first' });
    await emit({ part: 'first', stamp });
    const second = await tools.lookup_value({ part: 'second' });
    await emit({ part: 'second', stamp });
    return { total: first.value + second.value, stamp };
  }`,
}
async function waiting(id, previousCall) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const run = await runs.retrieve(id)
    if (run.status === 'requires_action' && run.required_actions[0].call_id !== previousCall) return run
    if (['completed', 'failed', 'cancelled'].includes(run.status)) throw new Error(`Unexpected ${run.status}: ${run.error}`)
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`No new function request: ${id}`)
}
try {
  let paused
  let cursor
  const stream = await client.workflowAgents.preview({ ...definition, input: {}, stream: true, 'Idempotency-Key': randomUUID() })
  for await (const event of stream) {
    if ('run' in event) rememberRun(event.run)
    if (event.type === 'workflow.run.requires_action') {
      paused = event.run
      cursor = event.sequence
      break // Disconnect the original request; execution stays durably paused.
    }
    if (event.type === 'workflow.run.failed') throw new Error(event.run.error)
  }
  assert(paused && cursor, 'Expected an application function handoff')
  assert.equal((await runs.retrieve(paused.id)).status, 'requires_action')
  assert(paused.expires_at > Date.now())
  const first = paused.required_actions[0]
  assert.equal(first.name, 'lookup_value')
  assert.deepEqual(first.arguments, { part: 'first' })
  await assert.rejects(runs.submitToolResult(paused.id, { call_id: 'unknown', success: true, output: {} }), error => error.status === 409)
  const result = { call_id: first.call_id, success: true, output: { value: 20 } }
  await runs.submitToolResult(paused.id, result)
  const next = await waiting(paused.id, first.call_id)
  assert.deepEqual(next.required_actions[0].arguments, { part: 'second' })
  await runs.submitToolResult(paused.id, result) // Retry the saved output, not the application operation.
  await assert.rejects(runs.submitToolResult(paused.id, { ...result, output: { value: 999 } }), error => error.status === 409)
  await runs.submitToolResult(paused.id, { call_id: next.required_actions[0].call_id, success: true, output: { value: 22 } })
  const completed = await waitForRun(await runs.retrieve(paused.id))
  assert.equal(completed.result.total, 42)
  assert.equal(completed.expires_at, null)
  assert.deepEqual(completed.required_actions, [])
  assert.equal(completed.outputs.length, 2)
  assert(completed.outputs.every(output => output.stamp === completed.result.stamp))
  assert(completed.calls.length >= 2)
  const replay = []
  for await (const event of await runs.events.stream(paused.id, { after: cursor })) replay.push(event)
  assert.equal(replay.filter(event => event.type === 'workflow.run.output').length, 2)
  assert.equal(replay.at(-1).type, 'workflow.run.completed')

  const recover = rememberRun(await client.workflowAgents.preview({ ...definition, input: {},
    code: `async () => { try { await tools.lookup_value({ part: 'failure' }); } catch (error) { return { caught: true }; } throw new Error('Expected a function failure'); }`,
    'Idempotency-Key': randomUUID() }))
  const failedCall = (await waiting(recover.id)).required_actions[0]
  await runs.submitToolResult(recover.id, { call_id: failedCall.call_id, success: false, error: 'Application lookup failed' })
  assert.deepEqual((await waitForRun(await runs.retrieve(recover.id))).result, { caught: true })

  const cancelled = rememberRun(await client.workflowAgents.preview({ ...definition, input: {}, 'Idempotency-Key': randomUUID() }))
  const abandoned = (await waiting(cancelled.id)).required_actions[0]
  await runs.cancel(cancelled.id)
  let terminal
  for await (const event of await runs.events.stream(cancelled.id)) {
    if (event.type === 'workflow.run.cancelled') terminal = event.run
  }
  assert.equal(terminal?.status, 'cancelled')
  assert.deepEqual(terminal.required_actions, [])
  await assert.rejects(runs.submitToolResult(cancelled.id, { call_id: abandoned.call_id, success: true, output: {} }), error => error.status === 409)
  console.log('Workflow functions passed: disconnect/resume, two handoffs, JSON results, deduplication, conflicts, replay, caught failure and cancellation.')
} finally {
  await cleanup()
}
