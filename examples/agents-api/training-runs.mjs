import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import OpenAI from 'openai';
import { RebyteExtensions } from '@rebyteai/agent-extensions';

// Run inputs contain selection/settings, never token tensors. Preserve the JSON
// and retry key: an ambiguous submission must reconcile the admitted snapshot.
const [command, modelID, value, retryKey] = process.argv.slice(2);
if (!['create', 'list', 'get', 'status', 'examples', 'wait', 'pause', 'resume', 'cancel'].includes(command)
    || modelID === undefined || (command !== 'list' && value === undefined)) {
  throw new Error('Usage: training-runs.mjs create MODEL_ID INPUT.json RETRY_KEY | list MODEL_ID | get|status|examples|wait|pause|resume|cancel MODEL_ID RUN_ID');
}
if (!process.env.REBYTE_API_KEY) throw new Error('REBYTE_API_KEY is required');
const baseURL = process.env.REBYTE_BASE_URL === undefined ? 'https://api.rebyte.ai/v1' : process.env.REBYTE_BASE_URL;
const rebyte = new RebyteExtensions(new OpenAI({ apiKey: process.env.REBYTE_API_KEY, baseURL, maxRetries: 0 }));
const runs = rebyte.models.trainingRuns;
const print = result => console.log(JSON.stringify(result, null, 2));
if (command === 'create') {
  if (retryKey === undefined) throw new Error('A stable retry key is required');
  const input = JSON.parse(await readFile(value, 'utf8'));
  print(await runs.create(modelID, input, { idempotencyKey: retryKey }));
} else if (command === 'list') {
  for await (const run of runs.list(modelID)) print(run);
} else if (command === 'get') {
  print(await runs.retrieve(modelID, value));
} else if (command === 'status') {
  print(await runs.status(modelID, value));
} else if (command === 'examples') {
  for await (const example of runs.examples(modelID, value, { order: 'asc' })) print(example);
} else if (['pause', 'resume', 'cancel'].includes(command)) {
  print(await runs.control(modelID, value, { action: command }));
} else if (command === 'wait') {
  let run = await runs.retrieve(modelID, value);
  const deadline = Date.now() + (run.training.execution.maxDurationSeconds + 600) * 1000;
  while (!['ready', 'failed', 'cancelled'].includes(run.status) && Date.now() < deadline) {
    await delay(2000);
    run = await runs.retrieve(modelID, value);
  }
  print(run);
  if (run.status !== 'ready') throw new Error(`Run status is ${run.status}; its durable record remains queryable`);
  print({ version_id: run.version_id, note: 'Evaluate this immutable version. Publication is a separate explicit operation.' });
}
