# Global Agent Instructions

Global instructions for every coding agent (Claude Code, Codex, Gemini CLI, OpenCode, Pi, …).
Project-level `AGENTS.md` / `CLAUDE.md` files override these defaults.

This file is installed from the `agent-config` repo (see "Maintaining this configuration" below).
Do not edit the installed copy — it is a symlink into that repo.

## How I work with agents

- Talk to me in Spanish unless the conversation starts in another language. Code, commits,
  PR text and code comments stay in English.
- **Git flow is fixed, no exceptions:**
  - Default branch is always `main` (`git init -b main`), never `master`.
  - Never push or merge to `main`. Work on a feature branch, push it, open a PR against
    `main`, then stop and give me the PR link. I review and merge. "Merge it" or "go ahead"
    means "open the PR", not `gh pr merge`.
  - One PR per feature. No stacked PRs: every PR targets `main`.
  - Commit messages: conventional commits (`feat(scope): …`), English, imperative.
- **New project → `git init` + initial commit + README.md immediately**, without being asked.
  Use the `new-project` skill for the standard layout.
- **Tests ship with the feature**, in the same PR. Run tests, linters and type checks locally
  before every commit.
- **UI work → show, don't describe.** Build at least 3 visually distinct mockups, render them
  to images and show them before asking which one to implement. Never ask me to pick a layout
  from a text description.
- **Ask before system-level or resource-heavy actions**: model downloads, deleting files
  outside the repo, restarting services, installing packages. "Bias toward action" below
  applies to reversible code changes only.
- **Clean up background processes** (dev servers, model runs) when the task ends. Check for
  an existing one before starting another (`lsof -ti :<port>`).
- **Verify before reporting a gap.** Before saying "X is missing", check the Obsidian vault,
  the disk and the database. False gaps cost me more time than no answer.
- **Reuse existing primitives.** Before creating a UI control, helper or module, look for an
  existing one and extend it with a parameter instead of writing a parallel version.

## Obsidian vault (source of truth for status and decisions)

My Obsidian vault is the source of truth for project status, roadmaps, findings and system
changes. **Load the `obsidian-vault` skill before reading or writing it.** In short:

- Status questions ("¿cómo vamos?") are answered from the vault first, then the repo.
  If the vault is unreachable, say so — don't guess.
- Record findings (bugs, design decisions, verified data) in the project's vault note as you
  find them, and update roadmap checkboxes when a phase or PR closes.
- Every change to the OS, agent config, installed software or hardware gets a changelog entry
  via `vault-write`, before the session ends. Nobody needs to ask.

## Maintaining this configuration

All agent configuration (this file, skills, Claude settings, statusline, commands, templates,
the `vault-write` tool) lives in the `agent-config` repo, cloned at `$AGENT_CONFIG_DIR`
(see `~/.config/agent-config/config.env`). When I ask to change how agents behave:

1. Edit the file **in the repo**, not in `~/.claude`, `~/.codex`, etc.
2. Keep it free of personal data: no names, paths under a specific home, finances, tokens.
   Personal facts belong in the agent's own memory or in the vault.
3. Update `docs/inventory.md` if a skill, plugin, command or MCP server is added, disabled
   or retired (with date and reason).
4. Add a `CHANGELOG.md` entry, bump `VERSION` (SemVer), run `tests/run.sh`, and open a PR.
5. After merge, every machine updates with `git pull && ./install.sh`.

A rule I state once in a single project stays in that project. A rule that shows up in two or
more projects belongs here.

## Philosophy

- **No speculative features** - Don't add features, flags, or configuration unless users actively need them
- **No premature abstraction** - Don't create utilities until you've written the same code three times
- **Clarity over cleverness** - Prefer explicit, readable code over dense one-liners
- **Justify new dependencies** - Each dependency is attack surface and maintenance burden
- **No phantom features** - Don't document or validate features that aren't implemented
- **Replace, don't deprecate** - When a new implementation replaces an old one, remove the old one entirely. No backward-compatible shims, dual config formats, or migration paths. Proactively flag dead code — it adds maintenance burden and misleads both developers and LLMs.
- **Verify at every level** - Set up automated guardrails (linters, type checkers, pre-commit hooks, tests) as the first step, not an afterthought. Prefer structure-aware tools (ast-grep, LSPs, compilers) over text pattern matching. Review your own output critically. Every layer catches what the others miss.
- **Bias toward action** - Decide and move for anything easily reversed; state your assumption so the reasoning is visible. Ask before committing to interfaces, data models, architecture, or destructive/write operations on external services.
- **Finish the job** - Don't stop at the minimum that technically satisfies the request. Handle the edge cases you can see. Clean up what you touched. If something is broken adjacent to your change, flag it. But don't invent new scope — there's a difference between thoroughness and gold-plating.
- **Agent-native by default** - Design so agents can achieve any outcome users can. Tools are atomic primitives; features are outcomes described in prompts. Prefer file-based state for transparency and portability. When adding UI capability, ask: can an agent achieve this outcome too?

## Code Quality

### Hard limits

1. ≤100 lines/function, cyclomatic complexity ≤8
2. ≤5 positional params
3. 100-char line length
4. Absolute imports only — no relative (`..`) paths
5. Google-style docstrings on non-trivial public APIs

### Zero warnings policy

Fix every warning from every tool — linters, type checkers, compilers, tests. If a warning truly can't be fixed, add an inline ignore with a justification comment. Never leave warnings unaddressed; a clean output is the baseline, not the goal.

### Comments

Code should be self-documenting. No commented-out code—delete it. If you need a comment to explain WHAT the code does, refactor the code instead.

### Error handling

- Fail fast with clear, actionable messages
- Never swallow exceptions silently
- Include context (what operation, what input, suggested fix)

### Reviewing code

Evaluate in order: architecture → code quality → tests → performance. Before reviewing, sync to latest remote (`git fetch origin`).

For each issue: describe concretely with file:line references, present options with tradeoffs when the fix isn't obvious, recommend one, and ask before proceeding.

### Testing

**Test behavior, not implementation.** Tests should verify what code does, not how. If a refactor breaks your tests but not your code, the tests were wrong.

**Test edges and errors, not just the happy path.** Empty inputs, boundaries, malformed data, missing files, network failures — bugs live in edges. Every error path the code handles should have a test that triggers it.

**Mock boundaries, not logic.** Only mock things that are slow (network, filesystem), non-deterministic (time, randomness), or external services you don't control.

**Verify tests catch failures.** Break the code, confirm the test fails, then fix. Use mutation testing (`cargo-mutants`, `mutmut`) to verify systematically. Use property-based testing (`proptest`, `hypothesis`) for parsers, serialization, and algorithms.

## Development

When adding dependencies, CI actions, or tool versions, always look up the current stable version — never assume from memory unless the user provides one.

Prefer the Exa AI search tool for web searches when it is available.

### CLI tools

Use these when installed; `./install.sh --check` in the agent-config repo lists which are missing.

| tool | replaces | usage |
|------|----------|-------|
| `rg` (ripgrep) | grep | `rg "pattern"` - 10x faster regex search |
| `fd` | find | `fd "*.py"` - fast file finder (respects `.gitignore`: use `fd -I` for ignored paths) |
| `ast-grep` | - | `ast-grep --pattern '$FUNC($$$)' --lang py` - AST-based code search |
| `shellcheck` | - | `shellcheck script.sh` - shell script linter |
| `shfmt` | - | `shfmt -i 2 -w script.sh` - shell formatter |
| `actionlint` | - | `actionlint .github/workflows/` - GitHub Actions linter |
| `zizmor` | - | `zizmor .github/workflows/` - Actions security audit |
| `prek` | pre-commit | `prek run` - fast git hooks (Rust, no Python) |
| `wt` | git worktree | `wt switch branch` - manage parallel worktrees |
| `trash` | rm | `trash file` - recoverable delete (`trash-cli` on Linux). **Never use `rm -rf`** |

Prefer `ast-grep` over ripgrep when searching for code structure (function calls, class definitions, imports, pattern matching across arguments). Use ripgrep for literal strings and log messages.

### Python

**Runtime:** 3.13 with `uv venv`

| purpose | tool |
|---------|------|
| deps & venv | `uv` |
| lint & format | `ruff check` · `ruff format` |
| static types | `ty check` |
| tests | `pytest -q` |

**Always use uv, ruff, and ty** over pip/poetry, black/pylint/flake8, and mypy/pyright — they're faster and stricter. Configure `ty` strictness via `[tool.ty.rules]` in pyproject.toml. Use `uv_build` for pure Python, `hatchling` for extensions.

Tests in `tests/` directory mirroring package structure. Supply chain: `pip-audit` before deploying, pin exact versions (`==` not `>=`), verify hashes with `uv pip install --require-hashes`.

### Node/TypeScript

**Runtime:** Node 22 LTS, ESM only (`"type": "module"`)

| purpose | tool |
|---------|------|
| lint | `oxlint` |
| format | `oxfmt` |
| test | `vitest` |
| types | `tsc --noEmit` |

**Always use oxlint and oxfmt** over eslint/prettier — they're faster and stricter. Enable `typescript`, `import`, `unicorn` plugins.

**tsconfig.json strictness** — enable all of these:
```jsonc
"strict": true,
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true,
"noImplicitOverride": true,
"noPropertyAccessFromIndexSignature": true,
"verbatimModuleSyntax": true,
"isolatedModules": true
```

Colocated `*.test.ts` files. Supply chain: `pnpm audit --audit-level=moderate` before installing, pin exact versions (no `^` or `~`), enforce 24-hour publish delay (`pnpm config set minimumReleaseAge 1440`), block postinstall scripts (`pnpm config set ignore-scripts true`).

### Rust

**Runtime:** Latest stable via `rustup`

| purpose | tool |
|---------|------|
| build & deps | `cargo` |
| lint | `cargo clippy --all-targets --all-features -- -D warnings` |
| format | `cargo fmt` |
| test | `cargo test` |
| supply chain | `cargo deny check` (advisories, licenses, bans) |
| safety check | `cargo careful test` (stdlib debug assertions + UB checks) |

**Style:**
- Prefer `for` loops with mutable accumulators over iterator chains
- Shadow variables through transformations (no `raw_x`/`parsed_x` prefixes)
- No wildcard matches; avoid `matches!` macro—explicit destructuring catches field changes
- Use `let...else` for early returns; keep happy path unindented

**Type design:**
- Newtypes over primitives (`UserId(u64)` not `u64`)
- Enums for state machines, not boolean flags
- `thiserror` for libraries, `anyhow` for applications
- `tracing` for logging (`error!`/`warn!`/`info!`/`debug!`), not println

**Optimization:**
- Write efficient code by default — correct algorithm, appropriate data structures, no unnecessary allocations
- Profile before micro-optimizing; measure after

**Cargo.toml lints:**
```toml
[lints.clippy]
pedantic = { level = "warn", priority = -1 }
# Panic prevention
unwrap_used = "deny"
expect_used = "warn"
panic = "deny"
panic_in_result_fn = "deny"
unimplemented = "deny"
# No cheating
allow_attributes = "deny"
# Code hygiene
dbg_macro = "deny"
todo = "deny"
print_stdout = "deny"
print_stderr = "deny"
# Safety
await_holding_lock = "deny"
large_futures = "deny"
exit = "deny"
mem_forget = "deny"
# Pedantic relaxations (too noisy)
module_name_repetitions = "allow"
similar_names = "allow"
```

### Bash

All scripts must start with `set -euo pipefail`. Lint: `shellcheck script.sh && shfmt -d script.sh`

### GitHub Actions

Pin actions to SHA hashes with version comments: `actions/checkout@<full-sha>  # vX.Y.Z` (use `persist-credentials: false`). Scan workflows with `zizmor` before committing. Configure Dependabot with 7-day cooldowns and grouped updates. Use `uv` ecosystem (not `pip`) for Python projects so Dependabot updates `uv.lock`.

## Workflow

**Before committing:**
1. Re-read your changes for unnecessary complexity, redundant code, and unclear naming
2. Run relevant tests — not the full suite
3. Run linters and type checker — fix everything before committing

**Commits:**
- Imperative mood, ≤72 char subject line, one logical change per commit
- Never amend/rebase commits already pushed to shared branches
- Never push directly to main — use feature branches and PRs
- Never commit secrets, API keys, or credentials — use `.env` files (gitignored) and environment variables

**Hooks and worktrees:**
- Install prek in every repo (`prek install`). Run `prek run` before committing. Configure auto-updates: `prek auto-update --cooldown-days 7`
- Parallel subagents require worktrees. Each subagent MUST work in its own worktree (`wt switch <branch>`), not the main repo. Never share working directories.

**Pull requests:**
Describe what the code does now — not discarded approaches, prior iterations, or alternatives. Only describe what's in the diff.

Use plain, factual language. A bug fix is a bug fix, not a "critical stability improvement." Avoid: critical, crucial, essential, significant, comprehensive, robust, elegant.

## Project layout conventions

Every repo I own follows the `new-project` skill layout:

- `AGENTS.md` — the project's agent instructions (single source). `CLAUDE.md` contains only
  `@AGENTS.md` so Claude Code reads the same file.
- Keep `AGENTS.md` to what an agent cannot derive in two tool calls: invariants, domain rules,
  traps, where the docs are. No command lists copied from `package.json`.
- `README.md` — what it is, architecture, prerequisites, setup, how to run, usage.
- `docs/brainstorms/` — requirements explorations. `docs/plans/` — implementation plans named
  `YYYY-MM-DD-NNN-<type>-<slug>-plan.md`, so a fresh session can execute a plan cold.
  `docs/design/<section>/` — UI mockups.
