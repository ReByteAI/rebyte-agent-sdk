# Rebyte Agent SDK examples

Start with an API recipe for backend integration, or a complete React template
for a browser application. The official `openai` client handles Agents and
Sessions. `RebyteExtensions` adds Workflow Agents and Schedules.

| Example | Purpose | Entry point |
| --- | --- | --- |
| [Agents API recipes](agents-api/README.md) | Chat, application functions, deferred tools, files and Dynamic Workflow | `pnpm --filter @rebyte/example-agents-api functions` |
| [Workflow lifecycle](agents-api/workflow-agent.mjs) | Preview, test, publish, execute and replay fixed code | `pnpm --filter @rebyte/example-agents-api workflow-agent` |
| [Workflow functions](agents-api/workflow-functions.mjs) | Durable function handoffs, disconnect/reconnect, result submission and cancellation | `pnpm --filter @rebyte/example-agents-api workflow-functions` |
| [Workflow generation](agents-api/workflow-generate.mjs) | Author and execute a Workflow using the Workflow Builder | `pnpm --filter @rebyte/example-agents-api workflow-generate` |
| [Workflow MCP tools](agents-api/workflow-tools.mjs) | Call service MCP from fixed code without a Sandbox | `pnpm --filter @rebyte/example-agents-api workflow-tools` |
| [Schedules](agents-api/schedules.mjs) | Trigger a paused, bounded Schedule and inspect its result | `node examples/agents-api/schedules.mjs` |
| [React chat — Node](react-chat/README.md) | React hooks, chat UI and a Hono application server | `pnpm dev` |
| [React chat — Cloudflare](react-chat-cloudflare/README.md) | The same UI and server adapter running on a Worker | `pnpm dev:cloudflare` |

Run `pnpm install --frozen-lockfile` and `pnpm build` from the repository root
first. API recipes read `REBYTE_API_KEY` and optionally `REBYTE_BASE_URL`; their
default is the production Rebyte endpoint. They create real resources and clean
up only their own fixtures. Application templates retain conversations and need
application authentication and user-to-Session authorization before deployment.

The React templates were previously called AppKit. The Cloudflare template now
lives in `react-chat-cloudflare`; use `pnpm dev:cloudflare` from the repository root.
These are application examples. No example runs the application-side
`@openai/agents` runtime.
