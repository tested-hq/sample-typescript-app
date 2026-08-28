# sample-typescript-app

Reference repo showing how [tested.dev](https://tested.dev) fits into a real
TypeScript project. Clone it, install `@tested/cli`, run `tested diff`.

## What this repo is

- Small, realistic CRUD-style TS app (~10 source files, ~600 LOC)
- Vitest suite that sits above the 90% project floor in `.tested.yaml`
- `.tested.yaml` plus the public GitHub Action: `tested check`, then
  `tested push` with `junit.xml` (flakes / suite time, not coverage-only)

## Install

Node 24+.

```bash
pnpm add -D @tested/cli
```

This repo already has `@tested/cli@0.1.7`. After a clone:

```bash
pnpm install
pnpm test:coverage
pnpm exec tested diff --base origin/main
```

You'll see a per-file table with uncovered line ranges. Same thing in JSON:

```bash
pnpm exec tested diff --base origin/main --json
```

`tested diff` is a report (exit 0). `tested check` is the gate. It exits 1 when
patch or project coverage is under the floors in `.tested.yaml`.

## With Claude Code / MCP

`.mcp.json` runs `npx -y @tested/mcp`. The server resolves `@tested/cli` from
this repo's `node_modules` unless you set `TESTED_BIN`. If `@tested/mcp` is
already a project dep, switch the command to `tested-mcp` and drop `args`.

1. Copy `.mcp.json` into your Claude Code config, or merge it into
   `~/.claude/mcp.json`.
2. Restart Claude Code so it picks up the server.
3. Ask: _"Use the coverage tools to close the remaining gap."_

The agent should call `get_uncovered_diff` over MCP, read the ranges, write a
test, run it, and re-check.

## CI

`.github/workflows/tested-diff.yml` runs on every PR against `main`:

1. installs deps with pnpm
2. typechecks
3. runs `pnpm test:coverage` (Istanbul JSON **and** `junit.xml`)
4. runs [`tested-hq/cli/action@main`](https://github.com/tested-hq/cli/tree/main/action)
   with `version: 0.1.7`, `push: true`, and `junit: junit.xml`

Vitest writes `./junit.xml` (`reporters` + `outputFile` in `vitest.config.ts`).
The Action passes that path into `tested push` so ingest includes flakes and
suite time — not coverage-only. App-posted `tested.dev / patch` and
`tested.dev / project` stay `in_progress` until that push lands.

Mint `TESTED_TOKEN` at `https://app.tested.dev/repos/{owner}/{name}/settings`
and store it as `secrets.TESTED_TOKEN`. Push is `continue-on-error` inside the
Action, so a copied workflow without a token still goes green on `tested check`.

```yaml
- uses: tested-hq/cli/action@main
  with:
    version: 0.1.7
    push: true
    pr-number: ${{ github.event.pull_request.number }}
    token: ${{ secrets.TESTED_TOKEN }}
    junit: junit.xml
```

Or leave `junit.xml` in the working directory and omit `junit:` — `tested push`
auto-detects it.

## Layout

```
src/
├── api/             # createUser / getUser / placeOrder / cancelOrder ...
├── auth/            # session lifecycle + HMAC-signed tokens
├── db/              # generic InMemoryStore
├── util/            # clock + level-filtered logger
└── validation/      # email + zod payload schema
tests/
vitest.config.ts     # coverage JSON + junit.xml for tested push
.tested.yaml         # testRunner: vitest | jest | pytest (not a shell command)
.mcp.json            # npx -y @tested/mcp
```
