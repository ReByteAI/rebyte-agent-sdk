# Changelog

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
