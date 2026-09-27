# React chat example — Cloudflare

The Worker and [Node React example](../react-chat/README.md) mount the same
`@rebyteai/agent-server`. Both use `useAgentSession`, native Agents events, Session
files and immutable Artifacts. The lifecycle and feature limits are identical. The Worker uses the official
`openai@7.15.0` client with an explicit Rebyte endpoint; the Agent Loop stays in Rebyte.

## Local development

```sh
pnpm --dir ../.. install
pnpm --dir ../.. build
cp .dev.vars.example .dev.vars
# Set REBYTE_API_KEY and REBYTE_AGENT_ID in .dev.vars.
# REBYTE_API_URL is optional and only needed for a custom/local endpoint.
pnpm dev
```

Create the saved Agent with the [CLI](../../packages/cli/README.md) and this
example's `agent.toml`. Use an `agent_...` ID created on the same API endpoint as
the Worker. Vite serves on 4100; Wrangler on 4101. Do not run the Node example on
those same ports concurrently.

## Deployment

Choose your Worker name, and set `REBYTE_AGENT_ID` and the `/v1` API URL in `wrangler.jsonc`; store the key with
`pnpm exec wrangler secret put REBYTE_API_KEY`, then use `pnpm deploy`.
The checked-in Agent ID is intentionally empty and must be configured.

Protect the site with Cloudflare Access or application login before exposing the
organization-backed proxy. Also enforce per-user Session ownership on all routes;
Access alone does not stop one logged-in user accessing another user's Session.

This is a deployable example, not a shared hosted service. Updating the npm
packages or repository does not update your Worker; build and deploy your own
configured application to use the new version.

Run the same SDK `test:live` against a reachable local Worker proxy to verify
SSE, uploads, downloads and Session isolation. Protected hosted environments need
their own authenticated test harness; do not disable Access for a smoke test.
