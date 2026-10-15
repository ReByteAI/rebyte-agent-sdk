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
                                    optional Environment → Sandbox
                                       ↓
                                files → immutable Artifacts
```

An Agent contains reusable model settings, instructions and explicit tools. A
Session owns its history, Turns, service MCP configuration and Artifacts. An
Environment owns working files, setup configuration, environment credentials and
a stable binding to one lazily created Sandbox. Each Session has at most one
Environment; the shared Environment API permits multiple Sessions to
reference it. Using the same saved Agent does not share compute.
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
Cancellation is an explicit input event. Session deletion removes its Artifacts
and its private Environment. In the shared Environment API, deletion
removes its attachment and Artifacts; the shared Environment requires explicit deletion
after all Sessions detach. Stdio MCP processes can remain alive in shared compute;
initialized HTTP MCP cleanup still runs and can affect reused upstream state.
Starting a new chat preserves the previous Session.

`requires_action` identifies work for application handlers. A public `function_call`
Item alone does not authorize execution: several built-in tools also use that item
shape and are executed by Rebyte. Commerce demonstrates the complete host loop.
The React hook exposes a normal `requires_action` state, authoritative `requiredActions`
and explicit `submitToolResult`. It observes external workers and restores pending
actions on reload; the application owns handler execution and durable deduplication.

Shared Environment references and create/delete methods require the matching
0.6.0 extension source. The HTTP API is available in production; npm publication
of the extension is pending.
The Environment's setup and Vault selection cannot be overridden by a referencing
Session. Files, processes and VM-visible secrets are shared; independent histories
and output directories are not a security boundary. Use `$REBYTE_OUTPUT_DIR` for
Session-owned deliverables. Sharing does not add native parent/child orchestration.
Rebyte enforces organization ownership from the authenticated key. Developers
coordinate shared resources and cleanup. Environment-origin MCP brokers share
server labels within the Sandbox; different Session configurations do not force
separate processes or replace the first live broker's configuration. Initialization
uses the Environment ID and continues independently of a cancelled waiting Turn.
Terminal setup failure preserves the Sandbox binding; there is no reset API.
See the [extension contract](../packages/extensions/README.md#shared-environments).

The product UI and API use distinct Agent and environment ownership rules. Nothing
in this SDK changes product UI Agent Profiles, Workspaces or their tools.
