# Work log

## 2026-10-16 — 0.7.0: keyed creation and metadata filters

- `rebyte.agents.create()` / `rebyte.sessions.create()` send an `'Idempotency-Key'`
  parameter as the header; `rebyte.agents.list()` / `rebyte.sessions.list()` take a
  `metadata` filter. New `rebyte.agents` resource. Protocol checks cover header,
  body, `metadata[key]` query encoding and no automatic retry.
- The API side shipped first in relay `1e9f117cd` (cctools run 38850521604).
  Verified against local relay and production with the extension: replay returns
  the same Agent/Session (201 then 200), a changed request is 409, metadata filters
  return only matching resources, and a keyed Session with input runs one Turn.
- Release workflow [38852107325](https://github.com/ReByteAI/rebyte-agent-sdk/actions/runs/38852107325)
  published all five packages at 0.7.0. A fresh npm install verified ESM and CJS
  imports and a production metadata list.

## 2026-10-15 — Complete the 0.6.0 npm release

- Confirmed the user's npm login and completed npm's separate verification for
  publisher configuration. Configured and read back GitHub trusted publishers
  for all five packages: `ReByteAI/rebyte-agent-sdk`, `release.yml`.
- Release workflow [38839804467](https://github.com/ReByteAI/rebyte-agent-sdk/actions/runs/38839804467)
  passed typechecks, tests and builds, published through OIDC, verified npm
  availability and promoted the existing GitHub release from preview to release.
- All five registry versions and `latest` tags are 0.6.0. Downloaded npm archives
  match the original GitHub preview archives byte for byte; tag and assets remain
  unchanged. The previously recorded production example used these same bytes.
- Installed all five packages from npm in a fresh directory without workspace
  overrides. Verified ESM and supported CJS imports, Environment methods, UI
  styles and CLI help. Updated installation and availability documentation.

## 2026-10-15 — Initialization follow-up

- Updated the extension reference, architecture, migration guidance and example
  documentation for independent Environment initialization. Cancellation stops a
  Turn's wait while setup continues for peers; terminal setup failure preserves
  the Sandbox binding. No SDK API or package release change.

## 2026-10-15

- Clarified the shared Environment developer contract in the extension reference,
  architecture, migration notes, example guide and exported type comments. Rebyte
  checks organization ownership; developers coordinate shared files, processes,
  MCP labels/configuration and cleanup. Documented optional inputs, fixed binding,
  same-label broker reuse, HTTP cleanup effects and the initial-setup cancellation
  preview limitation. Runtime semantics are unchanged by this documentation pass.
- Extension typecheck and ESM/CJS/declaration build passed. The public shared-guide
  TypeScript blocks compiled together against the current SDK. Cross-repository
  site build, links and guarded browser validation passed. No npm publication.

## 2026-10-12

- Added shared Environment references to Session creation and Environment
  create/delete methods in `@rebyteai/agent-extensions`.
- Added and ran `examples/agents-api/shared-environment.mjs` against local Relay
  and a real Sandbox. Workspace typecheck, extension build and smoke checks
  passed. No version bump, commit or npm publication.

- Updated SDK architecture, migration guidance, package reference and example
  discovery for shared Environment ownership, cleanup, credential boundaries
  and explicit local-only availability. New public-guide TypeScript examples
  compile against the current extension from the Agents API recipe package;
  cross-repository site build and documentation links also passed.


## 2026-10-15 — Publish 0.6.0 source preview

- Tagged 398f0bc as v0.6.0. All five package versions, typechecks, tests and builds passed. npm workflow 38820381239 failed with ENEEDAUTH; artifact-only workflow 38820591724 published immutable GitHub preview archives. npm remains at 0.3.0.
- Downloaded and checked all five SHA-256 values, installed the archives in a fresh directory, verified imports and CLI execution, and ran the shared Environment example against production with cleanup.
- Backend relay:386 and public HTTP sharing are live. Production checks and the rollout correction are recorded in cctools/docs/releases/2026-10-15-shared-environments.md. Later documentation wording fixes preserve the immutable tag and archives.
