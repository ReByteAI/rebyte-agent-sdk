import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import OpenAI from 'openai';
import { RebyteExtensions } from '@rebyteai/agent-extensions';

const client = new OpenAI({ apiKey: process.env.REBYTE_API_KEY,
  baseURL: process.env.REBYTE_BASE_URL ?? 'https://api.rebyte.ai/v1', maxRetries: 0 });
const rebyte = new RebyteExtensions(client);
const scenario = await rebyte.scenarios.create({ name: 'Arithmetic answer checks',
  description: 'Compare exact answers across Agent revisions.', metadata: { suite: 'arithmetic-v1' } },
{ headers: { 'Idempotency-Key': randomUUID() } });
let agent, session;
try {
  agent = await client.beta.agents.create({ name: 'Scenario recipe',
    model: process.env.REBYTE_MODEL ?? 'gpt-6-luna', instructions: 'Answer arithmetic questions with just the number.' });
  session = await rebyte.sessions.create({ agent_id: agent.id, scenario_id: scenario.id,
    environment: { type: 'none' }, input: 'What is 19 + 23?' });
  assert.equal(session.scenario_id, scenario.id);
  let turn;
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    turn = (await rebyte.sessions.turns.list(session.id)).data[0];
    if (turn !== undefined && ['completed', 'failed', 'cancelled'].includes(turn.status)) break;
    await delay(500);
  }
  assert.equal(turn?.status, 'completed', JSON.stringify(turn?.error));
  assert.equal(turn.scenario_id, scenario.id);
  const text = [];
  for await (const item of rebyte.sessions.items.list(session.id, { order: 'asc' })) {
    if (item.type === 'message' && item.role === 'assistant') {
      for (const part of item.content) if (part.type === 'output_text') text.push(part.text);
    }
  }
  const answer = text.join('\n').trim();
  // The server inherits scenario_id from the Turn. No repeated assertion is needed.
  const feedback = await rebyte.feedback.create({ turn_id: turn.id,
    rating: answer === '42' ? 'positive' : 'negative', comment: `Expected 42; received ${answer}`,
    source: { type: 'evaluator', id: 'arithmetic-exact-match-v1' } },
  { headers: { 'Idempotency-Key': randomUUID() } });
  assert.equal(feedback.scenario_id, scenario.id);
  await rebyte.scenarios.update(scenario.id, { name: 'Arithmetic regression checks' });
  assert.equal((await rebyte.scenarios.retrieve(scenario.id)).id, scenario.id);
  for await (const assessment of rebyte.feedback.list({ scenario_id: scenario.id })) {
    console.log({ scenario_id: assessment.scenario_id, turn_id: assessment.turn_id, rating: assessment.rating });
  }
  console.log(JSON.stringify({ scenario_id: scenario.id, session_id: session.id, turn_id: turn.id, answer,
    feedback_id: feedback.id, note: 'Scenario retained; this recipe deletes its Session and Agent.' }));
} finally {
  if (session !== undefined) await rebyte.sessions.delete(session.id);
  if (agent !== undefined) await client.beta.agents.delete(agent.id);
}
