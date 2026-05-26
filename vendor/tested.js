#!/usr/bin/env node

// src/cli.ts
import { Command as Command7 } from "commander";

// src/commands/diff.ts
import "commander";

// src/config.ts
import { readFile } from "fs/promises";
import { join } from "path";
import { parse as parseYaml } from "yaml";

// src/schemas.ts
import { z } from "zod";
var TestedConfigSchema = z.object({
  ignores: z.array(z.string()).default([]),
  coverage: z.object({
    format: z.literal("istanbul-json").default("istanbul-json"),
    path: z.string().default("coverage/coverage-final.json")
  }).prefault({}),
  base: z.string().default("origin/main"),
  testRunner: z.enum(["vitest", "jest", "pytest"]).nullable().default(null),
  // Patch / project coverage gates. `tested init` writes these so users can
  // tune what counts as "passing" — schema MUST accept them so loadConfig
  // doesn't silently drop the field. Enforcement in `diff` lands in a
  // follow-up; today we just round-trip the values cleanly.
  thresholds: z.object({
    patch: z.number().min(0).max(100),
    project: z.number().min(0).max(100)
  }).optional()
});
var UncoveredRangeSchema = z.object({
  start: z.number().int().positive(),
  end: z.number().int().positive(),
  kind: z.enum(["line", "branch", "function"])
});
var FileCoverageSchema = z.object({
  path: z.string(),
  patchCoverage: z.number().nullable(),
  projectCoverage: z.number(),
  uncoveredRanges: z.array(UncoveredRangeSchema)
});
var CoverageTotalsSchema = z.object({
  executable: z.number().int().nonnegative(),
  covered: z.number().int().nonnegative(),
  pct: z.number().min(0).max(100)
});
var ProjectTotalsSchema = CoverageTotalsSchema.extend({
  delta: z.number().nullable()
});
var DiffOutputSchema = z.object({
  schemaVersion: z.literal(1),
  base: z.string(),
  head: z.string(),
  patch: CoverageTotalsSchema,
  project: ProjectTotalsSchema,
  files: z.array(FileCoverageSchema),
  ignored: z.array(z.string())
});

// src/config.ts
var DEFAULT_IGNORES = [
  "migrations/**",
  "seeds/**",
  "tests/**",
  "test/**",
  "**/*.test.*",
  "**/*.spec.*",
  "mocks/**",
  "__mocks__/**",
  "vitest.setup.*",
  "cypress/**",
  "scripts/**",
  "storybook/**",
  ".storybook/**",
  "**/*.d.ts",
  "stubs/**"
];
async function loadConfig(opts) {
  const file = join(opts.cwd, ".tested.yaml");
  let raw = {};
  try {
    const text = await readFile(file, "utf8");
    raw = parseYaml(text) ?? {};
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  const parsed = TestedConfigSchema.parse(raw);
  const merged = /* @__PURE__ */ new Set([...DEFAULT_IGNORES, ...parsed.ignores]);
  return { ...parsed, ignores: [...merged] };
}

// src/core/computeDiff.ts
import { resolve as resolve3 } from "path";

// src/git.ts
import { simpleGit } from "simple-git";
async function openRepo(cwd) {
  const git = simpleGit({ baseDir: cwd });
  const repoRoot = (await git.revparse(["--show-toplevel"])).trim();
  return { git, repoRoot };
}
async function resolveBase(ctx, base) {
  return (await ctx.git.revparse([base])).trim();
}
async function headSha(ctx) {
  return (await ctx.git.revparse(["HEAD"])).trim();
}
async function unifiedDiff(ctx, base) {
  return ctx.git.diff([`${base}...HEAD`]);
}

// src/core/istanbul.ts
import { readFile as readFile2 } from "fs/promises";
import { relative, resolve } from "path";
async function parseIstanbul(opts) {
  let raw;
  try {
    raw = await readFile2(opts.path, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `coverage-final.json not found at ${opts.path}. Run \`tested run\` first.`
      );
    }
    throw err;
  }
  const data = JSON.parse(raw);
  const root = resolve(opts.repoRoot);
  return Object.values(data).map((entry) => {
    const absPath = resolve(entry.path);
    const relPath = relative(root, absPath).split("\\").join("/");
    const statements = Object.entries(entry.statementMap).map(([id, loc]) => ({
      id,
      startLine: loc.start.line,
      endLine: loc.end.line,
      hits: entry.s[id] ?? 0
    }));
    return { path: relPath, absPath, statements };
  });
}

// src/core/diff.ts
var FILE_HEADER = /^diff --git a\/(.+?) b\/(.+?)$/;
var HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
function parseUnifiedDiff(text) {
  const result = /* @__PURE__ */ new Map();
  const lines = text.split("\n");
  let currentFile = null;
  let currentLine = 0;
  let inHunk = false;
  for (const line of lines) {
    const fileMatch = line.match(FILE_HEADER);
    if (fileMatch) {
      currentFile = fileMatch[2] ?? null;
      inHunk = false;
      continue;
    }
    if (!currentFile) continue;
    const hunkMatch = line.match(HUNK_HEADER);
    if (hunkMatch) {
      currentLine = Number(hunkMatch[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (!result.has(currentFile)) result.set(currentFile, /* @__PURE__ */ new Set());
      result.get(currentFile).add(currentLine);
      currentLine += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
    } else if (line.startsWith(" ") || line === "") {
      currentLine += 1;
    }
  }
  return result;
}

// src/core/ignores.ts
import { minimatch } from "minimatch";
function isIgnored(path, patterns) {
  return patterns.some((p) => {
    return minimatch(path, p, { dot: true, matchBase: true }) || minimatch(path, `**/${p}`, { dot: true, matchBase: true });
  });
}
function splitByIgnore(paths, patterns) {
  const kept = [];
  const ignored = [];
  for (const p of paths) {
    if (isIgnored(p, patterns)) ignored.push(p);
    else kept.push(p);
  }
  return { kept, ignored };
}

// src/core/assert-within-root.ts
import { resolve as resolve2, sep } from "path";
function assertWithinRoot(root, resolvedPath) {
  const safeRoot = resolve2(root) + sep;
  const safePath = resolve2(resolvedPath);
  if (!safePath.startsWith(safeRoot)) {
    throw new Error(
      `Path traversal rejected: ${safePath} is outside repository root ${safeRoot}`
    );
  }
}

// src/core/patch.ts
function pct(covered, executable) {
  if (executable === 0) return 0;
  return Math.round(covered / executable * 1e3) / 10;
}
function computePatchCoverage(files, addedByFile) {
  const byFile = /* @__PURE__ */ new Map();
  let execTotal = 0;
  let covTotal = 0;
  for (const file of files) {
    const added = addedByFile.get(file.path);
    if (!added || added.size === 0) continue;
    let exec = 0;
    let cov = 0;
    for (const stmt of file.statements) {
      const touched = lineRangeOverlaps(stmt.startLine, stmt.endLine, added);
      if (!touched) continue;
      exec += 1;
      if (stmt.hits > 0) cov += 1;
    }
    if (exec === 0) continue;
    byFile.set(file.path, { executable: exec, covered: cov, pct: pct(cov, exec) });
    execTotal += exec;
    covTotal += cov;
  }
  return {
    totals: { executable: execTotal, covered: covTotal, pct: pct(covTotal, execTotal) },
    byFile
  };
}
function lineRangeOverlaps(start, end, added) {
  for (let line = start; line <= end; line += 1) {
    if (added.has(line)) return true;
  }
  return false;
}

// src/core/project.ts
function pct2(covered, executable) {
  if (executable === 0) return 0;
  return Math.round(covered / executable * 1e3) / 10;
}
function computeProjectCoverage(files) {
  const byFile = /* @__PURE__ */ new Map();
  let execTotal = 0;
  let covTotal = 0;
  for (const file of files) {
    let exec = 0;
    let cov = 0;
    for (const stmt of file.statements) {
      exec += 1;
      if (stmt.hits > 0) cov += 1;
    }
    byFile.set(file.path, { executable: exec, covered: cov, pct: pct2(cov, exec) });
    execTotal += exec;
    covTotal += cov;
  }
  return {
    totals: { executable: execTotal, covered: covTotal, pct: pct2(covTotal, execTotal) },
    byFile
  };
}

// src/core/uncovered.ts
function uncoveredRanges(file) {
  const lines = /* @__PURE__ */ new Set();
  for (const stmt of file.statements) {
    if (stmt.hits > 0) continue;
    for (let line = stmt.startLine; line <= stmt.endLine; line += 1) {
      lines.add(line);
    }
  }
  const sorted = [...lines].sort((a, b) => a - b);
  const ranges = [];
  let start = null;
  let prev = null;
  for (const line of sorted) {
    if (start === null) {
      start = line;
      prev = line;
      continue;
    }
    if (prev !== null && line === prev + 1) {
      prev = line;
      continue;
    }
    ranges.push({ start, end: prev, kind: "line" });
    start = line;
    prev = line;
  }
  if (start !== null && prev !== null) {
    ranges.push({ start, end: prev, kind: "line" });
  }
  return ranges;
}

// src/output/json.ts
function buildDiffOutput(args) {
  const patch = computePatchCoverage(args.files, args.addedByFile);
  const project = computeProjectCoverage(args.files);
  const fileNames = /* @__PURE__ */ new Set([
    ...patch.byFile.keys(),
    ...project.byFile.keys()
  ]);
  const files = [];
  for (const name of fileNames) {
    const file = args.files.find((f) => f.path === name);
    if (!file) continue;
    files.push({
      path: name,
      patchCoverage: patch.byFile.get(name)?.pct ?? null,
      projectCoverage: project.byFile.get(name)?.pct ?? 0,
      uncoveredRanges: uncoveredRanges(file)
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return {
    schemaVersion: 1,
    base: args.base,
    head: args.head,
    patch: patch.totals,
    project: { ...project.totals, delta: args.projectDelta ?? null },
    files,
    ignored: [...args.ignored]
  };
}

// src/core/computeDiff.ts
async function computeDiff(opts) {
  const { cwd, config } = opts;
  const ctx = opts.ctx ?? await openRepo(cwd);
  const baseRef = opts.baseRef ?? config.base;
  const base = await resolveBase(ctx, baseRef);
  const head = await headSha(ctx);
  const diffText = await unifiedDiff(ctx, base);
  const addedByFile = parseUnifiedDiff(diffText);
  const coveragePath = resolve3(cwd, config.coverage.path);
  assertWithinRoot(ctx.repoRoot, coveragePath);
  const allFiles = await parseIstanbul({ path: coveragePath, repoRoot: ctx.repoRoot });
  const { kept, ignored } = splitByIgnore(
    allFiles.map((f) => f.path),
    config.ignores
  );
  const keptSet = new Set(kept);
  const files = allFiles.filter((f) => keptSet.has(f.path));
  let projectDelta = null;
  if (opts.withBaseCoverage) {
    const baseCoveragePath = resolve3(cwd, opts.withBaseCoverage);
    assertWithinRoot(ctx.repoRoot, baseCoveragePath);
    const baseFiles = await parseIstanbul({
      path: baseCoveragePath,
      repoRoot: ctx.repoRoot
    });
    const baseKept = baseFiles.filter((f) => !ignored.includes(f.path));
    const baseExec = baseKept.reduce((n, f) => n + f.statements.length, 0);
    const baseCov = baseKept.reduce(
      (n, f) => n + f.statements.filter((s) => s.hits > 0).length,
      0
    );
    const basePct = baseExec === 0 ? 0 : Math.round(baseCov / baseExec * 1e3) / 10;
    const headPct = (() => {
      const exec = files.reduce((n, f) => n + f.statements.length, 0);
      const cov = files.reduce(
        (n, f) => n + f.statements.filter((s) => s.hits > 0).length,
        0
      );
      return exec === 0 ? 0 : Math.round(cov / exec * 1e3) / 10;
    })();
    projectDelta = Math.round((headPct - basePct) * 10) / 10;
  }
  return buildDiffOutput({
    base: baseRef,
    head,
    files,
    addedByFile,
    ignored,
    projectDelta
  });
}

// src/output/human.ts
import pc from "picocolors";
function formatRange(r) {
  return r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`;
}
function colorPct(pct3) {
  if (pct3 >= 80) return pc.green(`${pct3}%`);
  if (pct3 >= 50) return pc.yellow(`${pct3}%`);
  return pc.red(`${pct3}%`);
}
function formatHuman(out) {
  const lines = [];
  lines.push(pc.bold(`tested.dev \u2014 coverage report`));
  lines.push(`Base: ${out.base}  Head: ${out.head.slice(0, 7)}`);
  lines.push("");
  lines.push(
    `Patch coverage:   ${colorPct(out.patch.pct)} (${out.patch.covered}/${out.patch.executable})`
  );
  lines.push(
    `Project coverage: ${colorPct(out.project.pct)} (${out.project.covered}/${out.project.executable})`
  );
  if (out.files.length > 0) {
    lines.push("");
    lines.push(pc.bold("Files in diff:"));
    for (const f of out.files) {
      const patchStr = f.patchCoverage === null ? "   -  " : `${colorPct(f.patchCoverage)}`;
      const ranges = f.uncoveredRanges.map(formatRange).join(", ");
      lines.push(
        `  ${patchStr.padEnd(6)}  ${f.path}${ranges ? pc.dim(`  uncovered: ${ranges}`) : ""}`
      );
    }
  }
  if (out.ignored.length > 0) {
    lines.push("");
    lines.push(pc.dim(`Ignored: ${out.ignored.length} patterns`));
  }
  return lines.join("\n");
}

// src/commands/diff.ts
function registerDiffCommand(program2) {
  program2.command("diff").description("Compute patch + project coverage against a base ref").option("--base <ref>", "Git base ref to diff against", void 0).option("--with-base-coverage <path>", "Compare project coverage against a baseline JSON", void 0).option("--json", "Emit schema-v1 JSON instead of human text", false).action(async (opts) => {
    const cwd = process.cwd();
    const config = await loadConfig({ cwd });
    const output = await computeDiff({
      cwd,
      config,
      ...opts.base !== void 0 ? { baseRef: opts.base } : {},
      ...opts.withBaseCoverage !== void 0 ? { withBaseCoverage: opts.withBaseCoverage } : {}
    });
    if (opts.json) {
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    } else {
      process.stdout.write(formatHuman(output) + "\n");
    }
  });
}

// src/commands/run.ts
import { spawn } from "child_process";
import "commander";
function resolveRunCommand(opts) {
  const runner = opts.runner ?? "vitest";
  switch (runner) {
    case "vitest":
      return {
        command: "npx",
        args: ["vitest", "run", "--coverage", ...opts.extraArgs]
      };
    case "jest":
      return {
        command: "npx",
        args: ["jest", "--coverage", ...opts.extraArgs]
      };
    case "pytest":
      return {
        command: "python",
        args: ["-m", "pytest", "--cov", ...opts.extraArgs]
      };
    default: {
      const _exhaustive = runner;
      void _exhaustive;
      throw new Error(
        `Unsupported runner: ${String(runner)}. Supported: vitest, jest, pytest`
      );
    }
  }
}
function registerRunCommand(program2) {
  program2.command("run").description("Run the user's test suite with coverage enabled (runner read from .tested.yaml; defaults to vitest)").allowUnknownOption(true).argument("[args...]", "Extra arguments forwarded to the runner").action(async (extraArgs) => {
    const config = await loadConfig({ cwd: process.cwd() });
    const { command, args } = resolveRunCommand({
      runner: config.testRunner,
      extraArgs
    });
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) => {
      process.exit(code ?? 1);
    });
  });
}

// src/commands/explain.ts
import { readFile as readFile3 } from "fs/promises";
import { resolve as resolve4 } from "path";
import "commander";
function parseLocation(input) {
  const idx = input.lastIndexOf(":");
  if (idx < 0) throw new Error(`expected <file>:<line>, got ${input}`);
  const path = input.slice(0, idx);
  const line = Number(input.slice(idx + 1));
  if (!Number.isInteger(line) || line <= 0) {
    throw new Error(`expected <file>:<line>, got ${input}`);
  }
  return { path, line };
}
function explainAt(file, line, sourceLines) {
  const stmt = file.statements.find((s) => line >= s.startLine && line <= s.endLine);
  const excerptStart = Math.max(1, line - 2);
  const excerptEnd = Math.min(sourceLines.length, line + 2);
  const excerpt = sourceLines.slice(excerptStart - 1, excerptEnd + 1).map((text, i) => `${excerptStart + i}  ${text}`).join("\n");
  if (!stmt) {
    return {
      path: file.path,
      line,
      uncovered: false,
      reason: `no executable statement on line ${line}`,
      codeExcerpt: excerpt
    };
  }
  if (stmt.hits === 0) {
    return {
      path: file.path,
      line,
      uncovered: true,
      reason: `no test exercises line ${line}`,
      codeExcerpt: excerpt
    };
  }
  return {
    path: file.path,
    line,
    uncovered: false,
    reason: `hit ${stmt.hits} time${stmt.hits === 1 ? "" : "s"}`,
    codeExcerpt: excerpt
  };
}
function registerExplainCommand(program2) {
  program2.command("explain").description("Explain coverage at <file>:<line>").argument("<location>", "Location in the form path/to/file.ts:42").option("--json", "Emit JSON instead of human text", false).action(async (location, opts) => {
    const cwd = process.cwd();
    const { path: relPath, line } = parseLocation(location);
    const config = await loadConfig({ cwd });
    const ctx = await openRepo(cwd);
    const coveragePath = resolve4(cwd, config.coverage.path);
    assertWithinRoot(ctx.repoRoot, coveragePath);
    const files = await parseIstanbul({ path: coveragePath, repoRoot: ctx.repoRoot });
    const file = files.find((f) => f.path === relPath);
    if (!file) {
      process.stderr.write(`No coverage data for ${relPath}
`);
      process.exit(2);
    }
    const resolvedSource = resolve4(ctx.repoRoot, relPath);
    assertWithinRoot(ctx.repoRoot, resolvedSource);
    const source = await readFile3(resolvedSource, "utf8");
    const sourceLines = source.split("\n");
    const result = explainAt(file, line, sourceLines);
    if (opts.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } else {
      process.stdout.write(
        `${result.path}:${result.line} \u2014 ${result.uncovered ? "UNCOVERED" : "covered"}
${result.reason}

${result.codeExcerpt}
`
      );
    }
  });
}

// src/commands/ignores.ts
import "commander";
function formatIgnoresList(patterns, asJson) {
  if (asJson) return JSON.stringify({ ignores: [...patterns] });
  return patterns.join("\n");
}
function registerIgnoresCommand(program2) {
  const cmd = program2.command("ignores").description("Inspect the canonical ignore list");
  cmd.command("list").description("Print all ignore patterns (defaults + user)").option("--json", "Emit JSON", false).action(async (opts) => {
    const config = await loadConfig({ cwd: process.cwd() });
    process.stdout.write(formatIgnoresList(config.ignores, opts.json) + "\n");
  });
}

// src/commands/init.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "fs";
import { join as join2 } from "path";
import "commander";
import pc2 from "picocolors";
import { simpleGit as simpleGit2 } from "simple-git";
var INIT_YAML_HEADER = "# Config schema \u2014 see https://tested.dev/docs/config\n";
var DEFAULT_INIT_IGNORES = [
  "**/*.test.ts",
  "**/*.spec.ts",
  "**/node_modules/**",
  "**/dist/**",
  "**/coverage/**"
];
function detectTestRunner(cwd) {
  const vitestCandidates = ["vitest.config.ts", "vitest.config.js", "vitest.config.mjs", "vitest.config.cjs"];
  for (const f of vitestCandidates) {
    if (existsSync(join2(cwd, f))) return "vitest";
  }
  const jestCandidates = ["jest.config.ts", "jest.config.js", "jest.config.mjs", "jest.config.cjs", "jest.config.json"];
  for (const f of jestCandidates) {
    if (existsSync(join2(cwd, f))) return "jest";
  }
  if (existsSync(join2(cwd, "pyproject.toml"))) return "pytest";
  return null;
}
async function detectDefaultBranch(cwd) {
  try {
    const git = simpleGit2({ baseDir: cwd });
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return "main";
    try {
      const ref = (await git.raw(["symbolic-ref", "refs/remotes/origin/HEAD"])).trim();
      const branch = ref.replace(/^refs\/remotes\/origin\//, "");
      if (branch) return branch;
    } catch {
    }
    return "main";
  } catch {
    return "main";
  }
}
async function detectProject(cwd) {
  const hasPackageJson = existsSync(join2(cwd, "package.json"));
  const testRunner = detectTestRunner(cwd);
  const defaultBranch = await detectDefaultBranch(cwd);
  return { hasPackageJson, testRunner, defaultBranch };
}
function buildInitYaml(args) {
  const lines = [];
  lines.push(INIT_YAML_HEADER.trimEnd());
  lines.push(`base: ${args.base}`);
  if (args.testRunner) {
    lines.push(`testRunner: ${args.testRunner}`);
  }
  lines.push("thresholds:");
  lines.push("  patch: 80");
  lines.push("  project: 60");
  lines.push("ignores:");
  for (const pattern of DEFAULT_INIT_IGNORES) {
    lines.push(`  - "${pattern}"`);
  }
  return lines.join("\n") + "\n";
}
function hasHuskyDevDep(pkgJsonPath) {
  try {
    const raw = readFileSync(pkgJsonPath, "utf8");
    const pkg = JSON.parse(raw);
    return Boolean(pkg.devDependencies?.husky || pkg.dependencies?.husky);
  } catch {
    return false;
  }
}
var PRE_PUSH_HOOK_BODY = `#!/usr/bin/env sh
# Installed by \`tested init\`. Skip with \`git push --no-verify\`.
tested diff
`;
async function runInit(opts) {
  const { cwd, force, hooks } = opts;
  const pkgJsonPath = join2(cwd, "package.json");
  if (!existsSync(pkgJsonPath)) {
    throw new Error(
      `No package.json found at ${cwd}. Run \`tested init\` from the root of a Node.js project.`
    );
  }
  const configPath = join2(cwd, ".tested.yaml");
  if (existsSync(configPath) && !force) {
    throw new Error(
      `.tested.yaml already exists at ${configPath}. Pass --force to overwrite.`
    );
  }
  const detected = await detectProject(cwd);
  const yamlText = buildInitYaml({ base: detected.defaultBranch, testRunner: detected.testRunner });
  writeFileSync(configPath, yamlText, "utf8");
  const warnings = [];
  let hookInstalled = false;
  let hookPath = null;
  if (hooks) {
    if (!hasHuskyDevDep(pkgJsonPath)) {
      warnings.push("husky is not a devDependency; skipped pre-push hook install. Run `pnpm add -D husky` then re-run `tested init --force`.");
    } else {
      const huskyDir = join2(cwd, ".husky");
      const huskyHook = join2(huskyDir, "pre-push");
      if (existsSync(huskyHook)) {
        warnings.push(`.husky/pre-push already exists; left untouched. Add \`tested diff\` to it manually if desired.`);
      } else {
        if (!existsSync(huskyDir)) mkdirSync(huskyDir, { recursive: true });
        writeFileSync(huskyHook, PRE_PUSH_HOOK_BODY, "utf8");
        try {
          chmodSync(huskyHook, 493);
        } catch {
        }
        hookInstalled = true;
        hookPath = huskyHook;
      }
    }
  }
  const nextSteps = [
    "1. commit .tested.yaml",
    `2. run \`tested diff --base ${detected.defaultBranch}\` to see your patch coverage`,
    "3. wire to CI: gh workflow add tested.dev/workflows/coverage.yml"
  ];
  return {
    configPath,
    configWritten: true,
    hookInstalled,
    hookPath,
    detected,
    nextSteps,
    warnings
  };
}
function buildInitJsonOutput(result) {
  return { schemaVersion: 1, ...result };
}
function formatInitResultHuman(result) {
  const lines = [];
  lines.push(pc2.bold("tested.dev \u2014 init"));
  lines.push("");
  if (result.configWritten) {
    lines.push(`${pc2.green("\u2713")} wrote ${pc2.cyan(result.configPath)}`);
  }
  const runnerLabel = result.detected.testRunner ?? "none detected";
  lines.push(`  test runner: ${pc2.cyan(runnerLabel)}`);
  lines.push(`  base branch: ${pc2.cyan(result.detected.defaultBranch)}`);
  if (result.hookInstalled && result.hookPath) {
    lines.push(`${pc2.green("\u2713")} installed pre-push hook at ${pc2.cyan(result.hookPath)}`);
  }
  if (result.warnings.length > 0) {
    lines.push("");
    for (const w of result.warnings) {
      lines.push(`${pc2.yellow("!")} ${w}`);
    }
  }
  if (result.nextSteps.length > 0) {
    lines.push("");
    lines.push(pc2.bold("Next steps:"));
    for (const step of result.nextSteps) {
      lines.push(`  ${step}`);
    }
  }
  return lines.join("\n");
}
function registerInitCommand(program2) {
  program2.command("init").description("Initialize tested.dev in the current project (writes .tested.yaml)").option("--force", "Overwrite an existing .tested.yaml", false).option("--no-hooks", "Skip installing the husky pre-push hook").option("--json", "Emit JSON instead of human text", false).action(async (opts) => {
    try {
      if (opts.hooks && !process.stdin.isTTY && !opts.force) {
        process.stderr.write(
          "error: --hooks in a non-TTY environment requires --force to confirm (would install a git hook unattended)\n"
        );
        process.exit(1);
      }
      const result = await runInit({
        cwd: process.cwd(),
        force: opts.force,
        hooks: opts.hooks
      });
      if (opts.json) {
        process.stdout.write(JSON.stringify(buildInitJsonOutput(result), null, 2) + "\n");
      } else {
        process.stdout.write(formatInitResultHuman(result) + "\n");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (opts.json) {
        process.stderr.write(
          JSON.stringify({ schemaVersion: 1, error: message }, null, 2) + "\n"
        );
      } else {
        process.stderr.write(`${pc2.red("error")}: ${message}
`);
      }
      process.exit(1);
    }
  });
}

// src/commands/check.ts
import "commander";
function runCheck(input) {
  const { config, diff, json } = input;
  if (!config.thresholds) {
    return {
      skipped: true,
      patchPass: true,
      projectPass: true,
      overall: "pass",
      stdout: "",
      stderr: "no thresholds configured in .tested.yaml \u2014 skipping gate check\n",
      exitCode: 0
    };
  }
  const patchPct = diff.patch.pct;
  const projectPct = diff.project.pct;
  const patchThreshold = config.thresholds.patch;
  const projectThreshold = config.thresholds.project;
  const patchPass = patchPct >= patchThreshold;
  const projectPass = projectPct >= projectThreshold;
  const overall = patchPass && projectPass ? "pass" : "fail";
  const exitCode = overall === "pass" ? 0 : 1;
  if (json) {
    const payload = {
      patch: { pct: patchPct, threshold: patchThreshold, pass: patchPass },
      project: { pct: projectPct, threshold: projectThreshold, pass: projectPass },
      overall
    };
    return {
      skipped: false,
      patchPass,
      projectPass,
      overall,
      stdout: JSON.stringify(payload) + "\n",
      stderr: "",
      exitCode
    };
  }
  const patchIcon = patchPass ? "\u2705" : "\u274C";
  const projectIcon = projectPass ? "\u2705" : "\u274C";
  const patchLabel = patchPass ? "pass" : "fail";
  const projectLabel = projectPass ? "pass" : "fail";
  const patchPctStr = patchPct.toFixed(1);
  const projectPctStr = projectPct.toFixed(1);
  const stderr = `${patchIcon} patch coverage ${patchPctStr}% (threshold ${patchThreshold}) \u2014 ${patchLabel}
${projectIcon} project coverage ${projectPctStr}% (threshold ${projectThreshold}) \u2014 ${projectLabel}
`;
  const stdout = `PATCH: ${patchPctStr}% / ${patchThreshold}% \u2014 ${patchLabel.toUpperCase()}
PROJECT: ${projectPctStr}% / ${projectThreshold}% \u2014 ${projectLabel.toUpperCase()}
`;
  return {
    skipped: false,
    patchPass,
    projectPass,
    overall,
    stdout,
    stderr,
    exitCode
  };
}
function registerCheckCommand(program2) {
  program2.command("check").description(
    "Exit non-zero if patch or project coverage falls below configured thresholds."
  ).option("--json", "Emit machine-readable JSON to stdout (exit code unchanged).", false).option("--base <ref>", "Git base ref to diff against", void 0).action(async (opts) => {
    const cwd = process.cwd();
    const config = await loadConfig({ cwd });
    if (!config.thresholds) {
      const result2 = runCheck({
        config,
        // diff value is unused in the skip path; pass a stub.
        diff: {
          schemaVersion: 1,
          base: "",
          head: "",
          patch: { executable: 0, covered: 0, pct: 0 },
          project: { executable: 0, covered: 0, pct: 0, delta: null },
          files: [],
          ignored: []
        },
        json: opts.json
      });
      if (result2.stderr) process.stderr.write(result2.stderr);
      if (result2.stdout) process.stdout.write(result2.stdout);
      process.exitCode = result2.exitCode;
      return;
    }
    const diff = await computeDiff({
      cwd,
      config,
      ...opts.base !== void 0 ? { baseRef: opts.base } : {}
    });
    const result = runCheck({ config, diff, json: opts.json });
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.stdout) process.stdout.write(result.stdout);
    process.exitCode = result.exitCode;
  });
}

// src/cli.ts
function createProgram() {
  const program2 = new Command7();
  program2.name("tested").description("Coverage your agent can use.").version("0.0.1");
  registerInitCommand(program2);
  registerDiffCommand(program2);
  registerCheckCommand(program2);
  registerRunCommand(program2);
  registerExplainCommand(program2);
  registerIgnoresCommand(program2);
  return program2;
}

// bin/tested.ts
var program = createProgram();
await program.parseAsync(process.argv);
