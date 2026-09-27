# SDK protocol verification — 2026-09-27

These checks cover the source prepared for SDK 0.4.0. The release record below
tracks publication separately from source verification.

## Changes

- Name the project **Rebyte Agent SDK**. The official `openai` API client supplies
  standard Agents resources; Rebyte packages add Workflow/Schedule resources,
  React state, UI, a server adapter and CLI. Node and Cloudflare applications are
  examples. This project does not use the separate `@openai/agents` runtime.
- Add Workflow function declarations, pending actions, JSON result submission,
  execution history, current event shapes, nullable wait deadlines and Agent run
  filtering to the extension. Accept cached web search in the CLI manifest.
- Keep React function waits observable, expose pending actions and explicit result
  submission, retain Stop while waiting, and recover external handler completion.
  Close a newly created Session's observation stream when its component unmounts.
- Wait for asynchronous Workflow admission/cancellation to settle in examples.
  Add a runnable function-handoff recipe and an examples catalog.
- Rename the public guide to `/docs/agents-api/sdk`, redirect both old AppKit
  paths, and align the public SDK/component/example terminology. Correct older
  timeout, release-status and test-coverage statements in the API source docs.

## Checks that passed

`pnpm typecheck`, `pnpm test`, and `pnpm build` passed. The existing JavaScript
protocol checks now cover JSON function-result serialization, run filtering,
zero automatic retries for result submission, and cached-mode TOML round trips.
Both application templates were rebuilt after their title changes.

The following recipes ran against the local Relay and managed Dev database with
real Temporal execution. Their fixtures were owned by each invocation and deleted
in cleanup. The Schedule was paused with a one-run cap and was archived afterward.

| Recipe | Verified behavior |
| --- | --- |
| `examples/agents-api/workflow-functions.mjs` | Two durable function waits; disconnect/resume; JSON result submission; identical-result retry; conflicting/unknown results rejected; deterministic step replay; outputs and event replay; caught failure; cancellation and late-result rejection |
| `examples/agents-api/workflow-agent.mjs` | Preview, draft, test, publish, execution, idempotent retry, event replay, version pagination, new version and pinned old version |
| `examples/agents-api/schedules.mjs` | Published Workflow target, paused manual trigger, idempotency, final result, run retrieval and one-run cap |

Mounted React verification used the built hook, the real Hono server adapter,
the official client, local Relay and the real `gpt-5.6-luna` model. The application
lookup returned deterministic test data; API and runtime traffic was not mocked.
It verified live waiting without a Session error, invalid-result rejection followed
by a successful retry, output projection, restored waiting state, completion by an
external worker, and Stop during a function wait. A separate mount/unmount check
verified that disconnecting observation preserves the waiting Session and that
remounting can submit a result and observe completion. All three Sessions and both
saved Agents were deleted; subsequent Session retrieval returned 404.
The temporary Dev API key was revoked, verified to return 401, and removed from disk.

The website build prerendered 53 routes. The SDK page, both legacy redirects and
internal links in the Agents guide were checked. Unrelated existing branding
edits in the website and product repositories were left untouched.

## Limits

Browser interaction/visual verification was not run: the installed browser runner
connects to a visible browser, while this workspace permits only windowless
automation. React mounting and real API execution do not replace that check.
Image handling was outside this change. The checks above ran before publication.
This release contains no new backend implementation.
