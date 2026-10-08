import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import OpenAI from 'openai';
import { RebyteExtensions } from '@rebyteai/agent-extensions';

const client = new OpenAI({ apiKey: process.env.REBYTE_API_KEY, baseURL: process.env.REBYTE_BASE_URL ?? 'https://api.rebyte.ai/v1', maxRetries: 0 });
const rebyte = new RebyteExtensions(client);
const marker = `FEEDBACK_${randomUUID()}`;
let agent, session;
try {
  agent = await client.beta.agents.create({ name: 'Turn feedback recipe',
    model: process.env.REBYTE_MODEL ?? 'gpt-6-luna', instructions: 'Follow the requested output exactly.' });
  session = await client.beta.agents.sessions.create({ agent_id: agent.id, input: `Reply exactly ${marker}` });
  let turn;
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    const turns = await client.beta.agents.sessions.turns.list(session.id);
    turn = turns.data[0];
    if (turn !== undefined && ['completed', 'failed', 'cancelled'].includes(turn.status)) break;
    await delay(500);
  }
  assert.equal(turn?.status, 'completed', JSON.stringify(turn?.error));
  const items = [];
  for await (const item of client.beta.agents.sessions.items.list(session.id)) items.push(item);
  const answer = items.filter(item => item.type === 'message' && item.role === 'assistant')
    .flatMap(item => item.content.filter(part => part.type === 'output_text').map(part => part.text)).join('\n');
  assert.equal(answer.trim(), marker);

  const input = { turn_id: turn.id, rating: 'positive', comment: 'Output exactly matched the requested marker.',
    source: { type: 'evaluator', id: 'exact-match-v1' } };
  const options = { headers: { 'Idempotency-Key': randomUUID() } };
  const first = await rebyte.feedback.create(input, options);
  assert.deepEqual(await rebyte.feedback.create(input, options), first);
  assert.deepEqual(await rebyte.feedback.retrieve(first.id), first);
  assert.equal(first.agent_id, agent.id); assert.equal(first.session_id, session.id);
  const second = await rebyte.feedback.create({ turn_id: turn.id, rating: 'positive', source: { type: 'application' } });
  const all = [];
  for await (const assessment of rebyte.feedback.list({ turn_id: turn.id, limit: 1, order: 'asc' })) all.push(assessment);
  assert.deepEqual(all, [first, second]);
  await assert.rejects(() => rebyte.feedback.create({ ...input, rating: 'negative' }, options), error => error.status === 409);
  console.log(JSON.stringify({ passed: true, turn_id: turn.id, feedback_ids: all.map(value => value.id),
    checks: ['real model output', 'create', 'retry', 'retrieve', 'automatic pagination', 'conflicting retry'] }));
} finally {
  if (session !== undefined) await client.beta.agents.sessions.delete(session.id);
  if (agent !== undefined) await client.beta.agents.delete(agent.id);
}
