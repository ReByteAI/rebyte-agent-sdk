# Changelog

## 0.7.0

- `rebyte.agents.create()` and `rebyte.sessions.create()` take an `'Idempotency-Key'`.
  A retry with the same key and request returns the first resource (200) and never
  starts a second Turn; a different request or a deleted resource is 409
  `idempotency_key_in_use`. Creation is not retried automatically.
- `rebyte.agents.list()` and `rebyte.sessions.list()` take an exact-match `metadata`
  filter applied by Rebyte.
- New `rebyte.agents` resource; `retrieve`, `update` and `delete` are the official client's.

## 0.4.0

- Rename the GitHub project to `ReByteAI/rebyte-agent-sdk` and use **Rebyte Agent
  SDK** throughout the guides. npm package names are unchanged.
- Add Workflow application functions, `runs.submitToolResult()`, pending actions,
  execution history, current event types and nullable function-wait deadlines.
- Keep React Sessions in a normal waiting state during function handoffs. Expose
  `requiredActions` and `submitToolResult()`, observe external handler completion,
  restore waiting Sessions, and allow cancellation while waiting.
- Close the observation stream when a newly created Session's component unmounts.
- Accept cached web search in CLI manifests and preserve it through export.
- Update examples to wait for Workflow admission and cancellation to settle; add
  a function-handoff recipe covering resume, retries, conflicts and cancellation.
- Rename the Cloudflare application example to `examples/react-chat-cloudflare`.

Standard Agent calls continue to use the official `openai@7.15.0` API client.
The Rebyte packages do not use the separate `@openai/agents` execution framework.
