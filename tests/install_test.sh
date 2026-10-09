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

test_settings_merge_unites_the_permission_lists() {
  mkdir -p "$SANDBOX/home/.claude"
  echo '{"permissions":{"allow":["Bash(ls)","Bash(git push *)"],"deny":["Bash(rm *)"]}}' \
    >"$SANDBOX/home/.claude/settings.json"
  run_install >/dev/null
  local s="$SANDBOX/home/.claude/settings.json" repo="$REPO/agents/claude/settings.json" rule
  assert_eq "$(jq -c '.permissions.allow' "$s")" '["Bash(ls)","Bash(git push *)"]'
  assert_eq "$(jq -r '.permissions.deny[0]' "$s")" "Bash(rm *)"
  while IFS= read -r rule; do
    jq -e --arg rule "$rule" '.permissions.deny | index($rule)' "$s" >/dev/null ||
      fail "the shared deny rule $rule should reach the machine's settings"
  done < <(jq -r '.permissions.deny[]' "$repo")
  assert_eq "$(jq '.permissions.deny | length' "$s")" \
    "$(($(jq '.permissions.deny | length' "$repo") + 1))"
  local before
  before="$(cat "$s")"
  run_install >/dev/null
  assert_eq "$(cat "$s")" "$before"
}

# Whether a permission rule matches a command, as the Claude Code docs describe it: `*`
# stands for any run of characters, and a rule that ends in ` *` also matches the command
# without arguments. An approximation, good for the plain commands checked below.
rule_matches() {
  local pattern="${1#Bash(}" command="$2"
  pattern="${pattern%)}"
  # shellcheck disable=SC2053  # the rule is a glob on purpose
  [[ $command == $pattern ]] && return 0
  [[ $pattern == *" *" && $command == "${pattern% \*}" ]]
}

# Prints what the shared rules do with a command: deny beats allow, as in Claude Code.
push_verdict() {
  local settings="$REPO/agents/claude/settings.json" rule verdict="unmatched"
  while IFS= read -r rule; do
    if rule_matches "$rule" "$1"; then verdict="allowed"; fi
  done < <(jq -r '.permissions.allow[]' "$settings")
  while IFS= read -r rule; do
    if rule_matches "$rule" "$1"; then verdict="denied"; fi
  done < <(jq -r '.permissions.deny[]' "$settings")
  printf '%s\n' "$verdict"
}

test_shared_rules_let_a_named_feature_branch_through() {
  local command
  for command in \
    "git push origin feat/native-surface" \
    "git push -u origin feat/native-surface" \
    "git push --set-upstream origin docs/agents-md" \
    "git push origin feat/main-menu" \
    "git push origin HEAD:feat/x" \
    "git push origin v1.3.0"; do
    assert_eq "$(push_verdict "$command")" "allowed"
  done
}

test_shared_rules_refuse_main_forced_and_unnamed_pushes() {
  local command
  for command in \
    "git push origin main" \
    "git push -u origin main" \
    "git push origin HEAD:main" \
    "git push origin feat/x:main" \
    "git push origin :main" \
    "git push origin refs/heads/main" \
    "git push origin HEAD:refs/heads/main" \
    "git push --force origin feat/x" \
    "git push origin feat/x --force" \
    "git push --force-with-lease origin feat/x" \
    "git push origin feat/x --force-with-lease" \
    "git push -f origin feat/x" \
    "git push origin feat/x -f" \
    "git push origin +feat/x" \
    "git push --mirror" \
    "git push origin --mirror" \
    "git push --all" \
    "git push origin --all" \
    "git push" \
    "git push origin" \
    "git push -u origin" \
    "git push origin HEAD" \
    "git push -u origin HEAD"; do
    assert_eq "$(push_verdict "$command")" "denied"
  done
  # Outside the rules altogether, so Claude Code's own review still sees it.
  assert_eq "$(push_verdict "git -C . push origin main")" "unmatched"
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
