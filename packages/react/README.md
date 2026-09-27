# @rebyteai/agent-react

The function-wait state and `submitToolResult` below require version 0.4.0 or later.

Install the versioned package (no repository clone required):

```sh
pnpm add @rebyteai/agent-react
```


Headless React state for native Agents API Sessions. The browser calls your
same-origin application server, never the organization API directly.

```tsx
import { createAgentSessionTransport, useAgentSession } from '@rebyteai/agent-react'
const transport = createAgentSessionTransport({ url: '/api/sessions' })
// Inside a React component:
const chat = useAgentSession({ transport, initialSessionId, onSession })
```

Persist `chat.sessionId` via `onSession`, then pass it as `initialSessionId` on
reload. `send(text)` subscribes before posting input and resolves with a Turn.
`stop()` submits cancellation; the running send consumes the terminal event.
`reset()` starts a new conversation without deleting the old Session.
`upload(file)` creates the Session if needed and writes a file into its environment
(5 MiB maximum in this example). `artifacts` supplies immutable download URLs.

Each assistant message has a `turnId` and a presentation-only `projection`:
`textMessages`, `toolCalls`, `outputText`, and the received native `events`.
Built-in server functions are distinct from client functions. A completed client
result updates its matching call; the actual handoff is Session `requires_action`.

History is restored from persisted Items and Turns. A recovered active or waiting
Session is polled until settled. Live disconnects report an error; reload recovers
output without resending input.

## Application functions

`chat.status === 'requires_action'` is a normal waiting state. Read
`chat.requiredActions`; execute only these authoritative calls, never every
`function_call` Item. The hook leaves execution to your application and continues
observing while an external backend worker supplies results.

An application handler can explicitly return a saved result through the hook:

```tsx
// Called by your application's function handler, not on every React render.
await chat.submitToolResult({
  turn_id: action.turn_id, call_id: action.call_id,
  success: true, output: JSON.stringify(result),
})
// Failure: { turn_id, call_id, success: false, error: 'Lookup failed' }
```

The method submits one result per request and reuses a stable per-call idempotency
key. Persist side effects and results by `call_id` in your application; a reload
or repeated notification is not authorization to execute a side effect twice.
Both ordinary functions and functions inside Dynamic Workflow use this path.
`send()` remains pending through handoffs until the Turn settles. `stop()` cancels
waiting work too. Reload restores the pending actions and observes subsequent
results; it never automatically executes your handler. See the
[Agents API recipes](../../examples/agents-api/README.md) for backend consumers.

Images are uploaded as Session files. The model can use hosted `view_image` to
inspect them; the upload itself is not an inline model image message. No browser
transport includes an organization API key.
