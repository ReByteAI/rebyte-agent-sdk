# Rebyte Agent SDK

Use the official **`openai`** TypeScript package to call Rebyte's Agents API.
Configure the Rebyte URL and API key explicitly. Rebyte runs the Agent Loop and
owns Sessions, Sandboxes and Artifacts. The Rebyte Agent SDK combines that official
API client with Rebyte extensions, React hooks, UI components, a server adapter,
the CLI and runnable examples. Install only the parts your application needs.

AppKit was the earlier name for the React application templates. Those templates
are examples within this SDK. The GitHub repository is now `ReByteAI/rebyte-agent-sdk`.
Existing npm package names are unchanged; the retired `@rebyteai/agent-sdk` client
fork remains retired.

```sh
pnpm add openai@7.15.0
export REBYTE_API_KEY="rbk_..."
```

```ts
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.REBYTE_API_KEY,
  baseURL: 'https://api.rebyte.ai/v1',
  maxRetries: 0,
})
const agent = await client.beta.agents.create({
  name: 'My assistant', model: 'gpt-5.6-luna', instructions: 'Answer clearly.',
})
const session = await client.beta.agents.sessions.create({
  agent_id: agent.id, environment: { type: 'openai_hosted' },
})
```

The `openai_hosted` wire value selects Rebyte compute at this endpoint. Omit the
environment for chat and service tools without a Sandbox. The official client adds
the Agents beta header and handles streaming, pagination and API errors.
The checked dependency is `openai@7.15.0`; compatibility with newer releases must
be verified before changing the pin. See the [API guide](https://rebyte.ai/docs/agents-api/overview)
for supported features. Using the official package does not enable unsupported endpoints.

## React applications

The React packages connect React to the same Agents API through an application server:

```text
React UI → application server → official openai client → Rebyte Agents API
```

The server holds the organization key and forwards native Session events. React
uses the official event types and SSE parser to maintain UI state. The Agent Loop
runs in Rebyte; the SDK does not need the separate `@openai/agents` execution library.

| Package | Purpose |
| --- | --- |
| `openai` | Official API client, installed directly from npm. |
| `@rebyteai/agent-server` | Shared Hono proxy for Node and Cloudflare. |
| `@rebyteai/agent-react` | Session transport and React state. |
| `@rebyteai/agent-ui` | Optional chat interface and styles. |
| `@rebyteai/cli` | Manage saved Agents from `agent.toml` using the official client. |
| `@rebyteai/agent-extensions` | Workflow and Schedule resources using an existing official client. |

Version 0.3.0 uses the official client. Existing 0.2.x releases still contain the
old fork. See [migration](docs/migration.md).

Version 0.4.0 adds Workflow function results and React function-wait support.
Its npm publication is currently pending registry authorization; use the source
setup below until it becomes available. The current npm release is 0.3.0.

Install the SDK components your application uses:

```sh
pnpm add @rebyteai/agent-react@0.3.0 @rebyteai/agent-ui@0.3.0 @rebyteai/agent-server@0.3.0
pnpm add -D @rebyteai/cli@0.3.0
```

To run the complete source templates:

```sh
# Node.js 22+, pnpm 10
pnpm install --frozen-lockfile
pnpm build
cp examples/react-chat/.env.example examples/react-chat/.env.local
# Fill in REBYTE_API_KEY and REBYTE_AGENT_ID, then:
pnpm dev
```

Create the saved Agent once with the [Node setup script](examples/react-chat/README.md)
or [CLI](packages/cli/README.md). Use the [Cloudflare template](examples/react-chat-cloudflare/README.md)
for a Worker. Keep API keys on the server and enforce user-to-Session ownership
on every route before deploying the example to users.

## Rebyte extensions

Workflow Agents and Schedules are Rebyte-specific resources. They use a small
extension package composed with your official client:

```sh
pnpm add openai@7.15.0 @rebyteai/agent-extensions@0.3.0
```

```ts
import { RebyteExtensions } from '@rebyteai/agent-extensions'

const rebyte = new RebyteExtensions(client)
const schedules = await rebyte.schedules.list()
// Standard APIs remain on client.beta.agents.
```

The extension neither replaces nor patches `OpenAI`. Its requests reuse your
client's authentication, URL, fetch implementation, timeouts and API errors.
Mutations that could start work default to no automatic retry. See
[extension documentation](packages/extensions/README.md).

## Examples and checks

| Example | Coverage |
| --- | --- |
| [All examples](examples/README.md) | Choose between API recipes and complete application templates. |
| [Agents API recipes](examples/agents-api/README.md) | Official-client chat, host functions, Sandbox files, and Rebyte extensions. |
| [React chat — Node](examples/react-chat/README.md) | Streaming, uploads, downloads, cancellation and reload. |
| [React chat — Cloudflare](examples/react-chat-cloudflare/README.md) | Same server adapter in a Worker. |
| [Commerce](https://github.com/ReByteAI/commerce-agent-starter/tree/main/rebyte) | Python host executes catalog/cart/presentation functions through the same API. |

```sh
pnpm typecheck
pnpm test
pnpm build
SDK_EXAMPLE_URL=http://127.0.0.1:4101 pnpm test:live
```

See [architecture](docs/architecture.md), [0.3.0 verification](docs/official-client-verification.md),
[current source verification](docs/sdk-protocol-verification-20260927.md)
and [release procedure](docs/releases.md).
