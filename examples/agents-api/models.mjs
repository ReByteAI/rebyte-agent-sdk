import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import OpenAI from 'openai';
import { RebyteExtensions } from '@rebyteai/agent-extensions';

// Model creation, inspection, evaluation and publication are separate decisions.
// Use training-runs.mjs to select data and start supervised training.
const [command, first, second, third] = process.argv.slice(2);
const supported = ['create', 'get', 'versions', 'status', 'publish', 'evaluate'];
if (!supported.includes(command) || first === undefined || (!['get', 'versions'].includes(command) && second === undefined)) {
  throw new Error('Usage: models.mjs create MODEL.json RETRY_KEY | get|versions MODEL_ID | status|publish MODEL_ID VERSION_ID | evaluate MODEL_ID VERSION_ID EVALUATION.json');
}
if (!process.env.REBYTE_API_KEY) throw new Error('REBYTE_API_KEY is required');
const baseURL = process.env.REBYTE_BASE_URL === undefined ? 'https://api.rebyte.ai/v1' : process.env.REBYTE_BASE_URL;
const client = new OpenAI({ apiKey: process.env.REBYTE_API_KEY, baseURL, maxRetries: 0 });
const rebyte = new RebyteExtensions(client);
const print = value => console.log(JSON.stringify(value, null, 2));
if (command === 'create') {
  const input = JSON.parse(await readFile(first, 'utf8'));
  print(await rebyte.models.create(input, { headers: { 'Idempotency-Key': second } }));
} else if (command === 'get') {
  print(await rebyte.models.retrieve(first));
} else if (command === 'versions') {
  for await (const version of rebyte.models.versions.list(first)) print(version);
} else if (command === 'status') {
  print(await rebyte.models.versions.status(first, second));
} else if (command === 'publish') {
  print(await rebyte.models.publish(first, { version_id: second }));
} else if (command === 'evaluate') {
  if (third === undefined) throw new Error('An evaluation JSON file with prompt and expected fields is required');
  const evaluation = JSON.parse(await readFile(third, 'utf8'));
  if (typeof evaluation.prompt !== 'string' || typeof evaluation.expected !== 'string') throw new Error('Evaluation needs prompt and expected strings');
  const model = await rebyte.models.retrieve(first);
  const version = await rebyte.models.versions.retrieve(first, second);
  assert.equal(version.status, 'ready');
  const session = await rebyte.sessions.create({ agent: { model: version.id,
    instructions: 'Answer with only the requested result.' }, scenario_id: model.scenario_id,
    environment: { type: 'none' }, input: evaluation.prompt });
  print({ session_id: session.id, model_version_id: version.id });
  let turn;
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    turn = (await rebyte.sessions.turns.list(session.id)).data[0];
    if (turn !== undefined && ['completed', 'failed', 'cancelled'].includes(turn.status)) break;
    await delay(1000);
  }
  assert.ok(turn !== undefined && turn.status === 'completed', JSON.stringify(turn));
  assert.equal(turn.model_version_id, version.id);
  const history = await rebyte.sessions.history.list(session.id);
  const entry = history.data.find(value => value.id === turn.id);
  assert.ok(entry !== undefined && entry.output_text !== null, 'Completed Turn has no final answer');
  const matched = entry.output_text.trim() === evaluation.expected.trim();
  const feedback = await rebyte.feedback.create({ turn_id: turn.id, rating: matched ? 'positive' : 'negative',
    comment: 'Exact match against the supplied held-out expected answer.', correction: matched ? null : evaluation.expected,
    source: { type: 'evaluator', id: 'model-recipe-exact-match-v1' } },
  { headers: { 'Idempotency-Key': `model-evaluation:${turn.id}` } });
  assert.equal(feedback.model_version_id, version.id);
  print({ model_id: model.id, model_version_id: version.id, session_id: session.id,
    turn_id: turn.id, answer: entry.output_text, feedback_id: feedback.id, matched,
    note: 'Session and feedback retained for review. Publishing is a separate command.' });
}
