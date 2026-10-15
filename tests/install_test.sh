#!/usr/bin/env bash
# Behavior tests for install.sh. Each test runs against a copy of the repo and a throwaway
# HOME, with a PATH that hides every agent CLI, so nothing on the real machine is touched.
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
FAILURES=0
SANDBOX=""

cleanup() { if [[ -n "$SANDBOX" ]]; then rm -r "$SANDBOX"; fi; }
trap cleanup EXIT

setup() {
  cleanup
  SANDBOX="$(mktemp -d)"
  REPO="$SANDBOX/repo"
  mkdir -p "$REPO" "$SANDBOX/home"
  (cd "$SOURCE_DIR" && tar --exclude=.git -cf - .) | (cd "$REPO" && tar -xf -)
  REPO="$(cd "$REPO" && pwd -P)"
}

run_install() {
  env -i HOME="$SANDBOX/home" PATH="/usr/bin:/bin" "$REPO/install.sh" --no-plugins "$@"
}

fail() {
  printf '    FAIL: %s\n' "$*"
  FAILURES=$((FAILURES + 1))
}

assert_link() {
  [[ -L "$1" && "$(readlink "$1")" == "$2" ]] || fail "$1 should link to $2"
}

assert_eq() {
  [[ "$1" == "$2" ]] || fail "expected '$2', got '$1'"
}

test_fresh_install_links_everything() {
  run_install >/dev/null
  local h="$SANDBOX/home"
  assert_link "$h/.agents/AGENTS.md" "$REPO/global/AGENTS.md"
  assert_link "$h/.claude/CLAUDE.md" "$REPO/agents/claude/CLAUDE.md"
  assert_link "$h/.claude/statusline.sh" "$REPO/agents/claude/statusline.sh"
  assert_link "$h/.claude/commands/review-pr.md" "$REPO/agents/claude/commands/review-pr.md"
  assert_link "$h/.claude/skills/obsidian-vault" "$REPO/skills/obsidian-vault"
  assert_link "$h/.agents/skills/new-project" "$REPO/skills/new-project"
  assert_link "$h/.local/bin/vault-write" "$REPO/bin/vault-write"
  assert_eq "$(jq -r .model "$h/.claude/settings.json")" "$(jq -r .model "$REPO/agents/claude/settings.json")"
  grep -qx "AGENT_CONFIG_DIR=$REPO" "$h/.config/agent-config/config.env" ||
    fail "config.env should record AGENT_CONFIG_DIR"
  [[ ! -e "$h/.codex/AGENTS.md" ]] || fail "codex is absent, its AGENTS.md should not be linked"
}

test_second_run_is_a_no_op() {
  run_install >/dev/null
  run_install | grep -q "Everything already up to date" || fail "second run should change nothing"
  run_install --check >/dev/null || fail "--check should pass right after install"
}

test_existing_file_is_backed_up() {
  mkdir -p "$SANDBOX/home/.claude"
  echo "mine" >"$SANDBOX/home/.claude/CLAUDE.md"
  run_install >/dev/null
  assert_link "$SANDBOX/home/.claude/CLAUDE.md" "$REPO/agents/claude/CLAUDE.md"
  assert_eq "$(cat "$SANDBOX"/home/.claude/CLAUDE.md.bak-*)" "mine"
}

test_settings_merge_keeps_local_keys_and_repo_wins() {
  mkdir -p "$SANDBOX/home/.claude"
  echo '{"model":"local-model","localOnly":1,"permissions":{"allow":["Bash(ls)"]}}' \
    >"$SANDBOX/home/.claude/settings.json"
  run_install >/dev/null
  local s="$SANDBOX/home/.claude/settings.json"
  assert_eq "$(jq -r .model "$s")" "$(jq -r .model "$REPO/agents/claude/settings.json")"
  assert_eq "$(jq -r .localOnly "$s")" "1"
  assert_eq "$(jq -r '.permissions.allow[0]' "$s")" "Bash(ls)"
  assert_eq "$(jq -r .permissions.defaultMode "$s")" "auto"
  compgen -G "$s.bak-*" >/dev/null || fail "merged settings should keep a backup"
}

test_settings_merge_keeps_machine_browser_path_and_repo_env_wins() {
  mkdir -p "$SANDBOX/home/.claude"
  cat >"$SANDBOX/home/.claude/settings.json" <<'JSON'
{
  "env": {
    "PLAYWRIGHT_MCP_EXECUTABLE_PATH": "/opt/browser",
    "PLAYWRIGHT_MCP_HEADLESS": "false"
  }
}
JSON
  run_install >/dev/null
  local s="$SANDBOX/home/.claude/settings.json"
  assert_eq "$(jq -r .env.PLAYWRIGHT_MCP_EXECUTABLE_PATH "$s")" "/opt/browser"
  assert_eq "$(jq -r .env.PLAYWRIGHT_MCP_HEADLESS "$s")" "true"
  assert_eq "$(jq -r .env.PLAYWRIGHT_MCP_ISOLATED "$s")" "true"
}

test_invalid_settings_json_aborts_untouched() {
  mkdir -p "$SANDBOX/home/.claude"
  echo '{broken' >"$SANDBOX/home/.claude/settings.json"
  if run_install >/dev/null 2>&1; then fail "invalid settings.json should abort"; fi
  assert_eq "$(cat "$SANDBOX/home/.claude/settings.json")" "{broken"
}

test_present_agent_gets_linked() {
  mkdir -p "$SANDBOX/home/.codex" "$SANDBOX/home/.gemini"
  run_install >/dev/null
  assert_link "$SANDBOX/home/.codex/AGENTS.md" "$REPO/global/AGENTS.md"
  assert_link "$SANDBOX/home/.gemini/GEMINI.md" "$REPO/global/AGENTS.md"
}

test_retired_skill_is_pruned() {
  run_install >/dev/null
  rm -r "$REPO/skills/new-project"
  run_install >/dev/null
  [[ ! -L "$SANDBOX/home/.claude/skills/new-project" ]] || fail "retired skill link should be removed"
  [[ ! -L "$SANDBOX/home/.agents/skills/new-project" ]] || fail "retired skill link should be removed"
}

test_foreign_links_are_left_alone() {
  mkdir -p "$SANDBOX/home/.claude/skills"
  ln -s /nonexistent/omarchy-skill "$SANDBOX/home/.claude/skills/omarchy"
  run_install >/dev/null
  [[ -L "$SANDBOX/home/.claude/skills/omarchy" ]] || fail "links not owned by the repo must stay"
}

test_check_reports_drift_without_fixing() {
  run_install >/dev/null
  rm "$SANDBOX/home/.claude/CLAUDE.md"
  if run_install --check >/dev/null; then fail "--check should exit 1 on drift"; fi
  [[ ! -e "$SANDBOX/home/.claude/CLAUDE.md" ]] || fail "--check must not change anything"
}

test_unknown_option_fails() {
  if run_install --bogus >/dev/null 2>&1; then fail "unknown option should fail"; fi
}

for test in $(declare -F | awk '$3 ~ /^test_/ {print $3}'); do
  printf '%s\n' "$test"
  setup
  "$test"
done

if ((FAILURES)); then
  printf '\n%d assertion(s) failed\n' "$FAILURES"
  exit 1
fi
printf '\nall install tests passed\n'
