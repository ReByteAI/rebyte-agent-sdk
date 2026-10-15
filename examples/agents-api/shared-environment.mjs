import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { RebyteExtensions } from '@rebyteai/agent-extensions';

const apiKey = process.env.REBYTE_API_KEY;
const baseURL = process.env.REBYTE_BASE_URL;
const model = process.env.REBYTE_MODEL;
if (!apiKey || !baseURL || !model) throw new Error('Set REBYTE_API_KEY, REBYTE_BASE_URL and REBYTE_MODEL');
const client = new OpenAI({ apiKey, baseURL, maxRetries: 0 });
const rebyte = new RebyteExtensions(client);
const sessions = [];
let environmentId;
let shared = false;
try {
  const main = await rebyte.sessions.create({
    agent: { model, instructions: 'Coordinate the assigned work.' },
    environment: { type: 'openai_hosted' },
  });
  sessions.push(main.id);
  assert.equal(main.environment.type, 'openai_hosted');
  environmentId = main.environment.id;
  const helper = await rebyte.sessions.create({
    agent: { model, instructions: 'Investigate the assigned question.' },
    environment: { type: 'reference', environment_id: environmentId },
  });
  sessions.push(helper.id);
  shared = true;
  assert.notEqual(main.id, helper.id);
  assert.equal(main.environment.id, helper.environment.id);

  // First file operation provisions the one shared Sandbox.
  const file = await rebyte.environments.files.create(environmentId, {
    type: 'inline', path: '/workspace/shared-input.txt',
    data: Buffer.from('Available to both independent Sessions.').toString('base64'),
  });
  for (const id of sessions) {
    const session = await rebyte.sessions.retrieve(id);
    assert(session.environment.files.some(value => value.id === file.id));
  }
  console.log({ main: main.id, helper: helper.id, environment: environmentId, sharedFile: file.path });
  console.log('Submit work through sessions.events.create. Use $REBYTE_OUTPUT_DIR for Session-owned deliverables.');

  await rebyte.sessions.delete(main.id);
  sessions.splice(sessions.indexOf(main.id), 1);
  assert.equal((await rebyte.sessions.retrieve(helper.id)).environment.id, environmentId);
  console.log('The helper still has the same Environment after deleting the main Session.');
} finally {
  // Each successful deletion is recorded before trying the next resource.
  while (sessions.length > 0) {
    const id = sessions[sessions.length - 1];
    await rebyte.sessions.delete(id);
    sessions.pop();
  }
  if (shared && environmentId !== undefined) await rebyte.environments.delete(environmentId);
}
