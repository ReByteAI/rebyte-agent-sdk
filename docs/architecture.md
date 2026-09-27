# Architecture

The official `openai` package is the wire client. Rebyte owns execution and durable state.
The React templates and CLI configure the Rebyte endpoint explicitly. The optional
`@rebyteai/agent-extensions` package adds Workflow and Schedule resources using
the same client, without subclassing or vendoring it.

```text
agent.toml → CLI → saved Agent
                       ↓ snapshot
Browser → application server → Agents API Session → model / service MCP
             ↑ host functions          ↓
                                    optional Session Sandbox
                                       ↓
                                files → immutable Artifacts
```

An Agent contains reusable model settings, instructions and explicit tools. A
Session owns its history, Turns, environment, credentials and Artifacts. A hosted
Environment is configuration plus a stable binding to one lazily created Sandbox.
Each message submission starts a Turn; active-Turn input queues for sequential execution.

Node and Cloudflare mount the same `@rebyteai/agent-server` Hono routes. The React
transport talks only to this same-origin proxy. Organization keys stay on the
server. A production application must persist user-to-Session ownership and check
it on every route, including event streams, uploads and Artifact downloads. Checking
that a Session uses the configured Agent only limits which Agent can be accessed.
Cloudflare Access supplies login but does not establish per-user Session ownership.

The browser subscribes before posting input because SSE is live-only. Each logical
input has an idempotency key; retries of the same input reuse it. Reload restores
persisted Items and Turns. A disconnected stream does not cancel execution.
Cancellation is an explicit input event; Session deletion releases its Sandbox and
Artifacts. Starting a new chat preserves the previous Session.

`requires_action` identifies work for application handlers. A public `function_call`
Item alone does not authorize execution: several built-in tools also use that item
shape and are executed by Rebyte. Commerce demonstrates the complete host loop.
The React hook exposes a normal `requires_action` state, authoritative `requiredActions`
and explicit `submitToolResult`. It observes external workers and restores pending
actions on reload; the application owns handler execution and durable deduplication.

The product UI and API use distinct Agent and environment ownership rules. Nothing
in this SDK changes product UI Agent Profiles, Workspaces or their tools.
