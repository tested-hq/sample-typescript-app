# vendor/

A snapshot of the built `@tested/cli` binary so this sample repo can run
`tested diff` in CI without depending on an unpublished npm package.

- `tested.js` — captured from `tested-hq/cli` at commit `dc2661d`
- `tested.js.map` — sourcemap for the above

When the CLI is published to npm, this directory should be deleted and the CI
workflow + README updated to install `@tested/cli` as a regular devDependency.
