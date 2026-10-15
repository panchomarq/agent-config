#!/usr/bin/env bash
# Install (or update) this agent configuration on the current machine.
#
#   ./install.sh               install / update
#   ./install.sh --check       report what would change and exit 1 if anything is out of date
#   ./install.sh --no-plugins  skip Claude Code marketplace/plugin installation
#
# Safe to run any number of times. Files it would replace are moved to <file>.bak-<timestamp>.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
STAMP="$(date +%Y%m%d-%H%M%S)"
CHECK=0
PLUGINS=1
DRIFT=0
FAILED_PLUGINS=()
REPO_MARKETPLACE_FRESH=0
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/agent-config"
RECOMMENDED_TOOLS=(rg fd ast-grep shellcheck shfmt actionlint zizmor prek wt trash uv)

usage() { sed -n '2,8s/^# \{0,1\}//p' "${BASH_SOURCE[0]}"; }

log() { printf '%s\n' "$*"; }

die() {
  printf 'install.sh: %s\n' "$*" >&2
  exit 1
}

parse_args() {
  for arg in "$@"; do
    case "$arg" in
      --check) CHECK=1 ;;
      --no-plugins) PLUGINS=0 ;;
      -h | --help)
        usage
        exit 0
        ;;
      *) die "unknown option '$arg' (see --help)" ;;
    esac
  done
}

require() {
  local cmd
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null || die "'$cmd' is required but not installed"
  done
}

# Report a pending change. In --check mode nothing is applied; returns 1 so callers skip work.
pending() {
  DRIFT=1
  if ((CHECK)); then
    log "  ✗ $*"
    return 1
  fi
  log "  → $*"
}

backup() {
  local target="$1"
  mv "$target" "$target.bak-$STAMP"
  log "    (previous version saved as $target.bak-$STAMP)"
}

link() {
  local src="$1" dst="$2"
  [[ -L "$dst" && "$(readlink "$dst")" == "$src" ]] && return 0
  pending "link $dst → $src" || return 0
  mkdir -p "$(dirname "$dst")"
  if [[ -e "$dst" || -L "$dst" ]]; then backup "$dst"; fi
  ln -s "$src" "$dst"
}

# Deep-merge a JSON file from the repo over the local one: repo keys win, local-only keys stay.
merge_json() {
  local src="$1" dst="$2" merged
  if [[ -L "$dst" ]]; then
    pending "replace symlink $dst with a merged copy of $src" || return 0
    backup "$dst"
  fi
  if [[ ! -e "$dst" ]]; then
    pending "create $dst" || return 0
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    return 0
  fi
  jq empty "$dst" 2>/dev/null || die "$dst is not valid JSON; fix or move it, then re-run"
  # Repo keys win, except the permission lists: those are united, the machine's rules first,
  # so a shared rule never erases one that only this machine has.
  merged="$(jq -S -s '
    . as [$local, $repo]
    | reduce ("allow", "ask", "deny") as $list ($local * $repo;
        (($local.permissions[$list]? // []) as $mine
         | ($repo.permissions[$list]? // []) as $shared
         | $mine + ($shared - $mine)) as $rules
        | if ($rules | length) > 0 then .permissions[$list] = $rules else . end)
  ' "$dst" "$src")"
  [[ "$merged" == "$(jq -S . "$dst")" ]] && return 0
  pending "merge $src into $dst" || return 0
  cp "$dst" "$dst.bak-$STAMP"
  printf '%s\n' "$merged" >"$dst"
}

# Remove symlinks in $dir that point into this repo at files that no longer exist
# (a skill, command or script that was retired from the repo).
prune() {
  local dir="$1" entry target
  [[ -d "$dir" ]] || return 0
  for entry in "$dir"/*; do
    [[ -L "$entry" ]] || continue
    target="$(readlink "$entry")"
    [[ "$target" == "$REPO_DIR"/* && ! -e "$target" ]] || continue
    pending "remove retired $entry" || continue
    rm "$entry"
  done
}

link_each() {
  local src_dir="$1" dst_dir="$2" item
  for item in "$src_dir"/*; do
    [[ -e "$item" ]] && link "$item" "$dst_dir/$(basename "$item")"
  done
  prune "$dst_dir"
}

# An agent counts as present when its CLI is on PATH or its config dir already exists.
has_agent() { command -v "$1" >/dev/null || [[ -d "$2" ]]; }

install_shared() {
  log "Shared (every agent)"
  link "$REPO_DIR/global/AGENTS.md" "$HOME/.agents/AGENTS.md"
  link_each "$REPO_DIR/skills" "$HOME/.agents/skills"
  link_each "$REPO_DIR/bin" "$HOME/.local/bin"
}

install_claude() {
  log "Claude Code"
  link "$REPO_DIR/agents/claude/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
  link "$REPO_DIR/agents/claude/statusline.sh" "$HOME/.claude/statusline.sh"
  link_each "$REPO_DIR/agents/claude/commands" "$HOME/.claude/commands"
  link_each "$REPO_DIR/skills" "$HOME/.claude/skills"
  merge_json "$REPO_DIR/agents/claude/settings.json" "$HOME/.claude/settings.json"
}

install_other_agents() {
  local agents_md="$REPO_DIR/global/AGENTS.md"
  if has_agent codex "$HOME/.codex"; then
    log "Codex"
    link "$agents_md" "$HOME/.codex/AGENTS.md"
  fi
  if has_agent gemini "$HOME/.gemini"; then
    log "Gemini CLI"
    link "$agents_md" "$HOME/.gemini/GEMINI.md"
  fi
  if has_agent opencode "$HOME/.config/opencode"; then
    log "OpenCode"
    link "$agents_md" "$HOME/.config/opencode/AGENTS.md"
    merge_json "$REPO_DIR/agents/opencode/opencode.json" "$HOME/.config/opencode/opencode.json"
  fi
  if has_agent pi "$HOME/.pi"; then
    log "Pi"
    link "$agents_md" "$HOME/.pi/agent/AGENTS.md"
    link_each "$REPO_DIR/skills" "$HOME/.pi/agent/skills"
  fi
}

install_machine_config() {
  local config="$CONFIG_DIR/config.env" current
  log "Machine config ($config)"
  if [[ ! -e "$config" ]]; then
    pending "create $config from config.env.example — fill in the vault settings" || return 0
    mkdir -p "$CONFIG_DIR"
    sed "s|^AGENT_CONFIG_DIR=.*|AGENT_CONFIG_DIR=$REPO_DIR|" "$REPO_DIR/config.env.example" >"$config"
    return 0
  fi
  current="$(sed -n 's/^AGENT_CONFIG_DIR=//p' "$config")"
  [[ "$current" == "$REPO_DIR" ]] && return 0
  pending "set AGENT_CONFIG_DIR=$REPO_DIR in $config" || return 0
  if grep -q '^AGENT_CONFIG_DIR=' "$config"; then
    sed -i.bak-"$STAMP" "s|^AGENT_CONFIG_DIR=.*|AGENT_CONFIG_DIR=$REPO_DIR|" "$config"
  else
    printf 'AGENT_CONFIG_DIR=%s\n' "$REPO_DIR" >>"$config"
  fi
}

install_plugins() {
  local settings="$REPO_DIR/agents/claude/settings.json" known installed name repo id
  ((PLUGINS)) || return 0
  if ! command -v claude >/dev/null; then
    log "Claude Code plugins: skipped ('claude' is not on PATH)"
    return 0
  fi
  log "Claude Code plugins"
  known="$(claude plugin marketplace list --json | jq -r '.[].name')"
  while IFS=$'\t' read -r name repo; do
    grep -qxF "$name" <<<"$known" && continue
    pending "add marketplace $name ($repo)" || continue
    claude plugin marketplace add "$repo"
  done < <(jq -r '.extraKnownMarketplaces // {} | to_entries[] |
    select(.value.source.source == "github") | [.key, .value.source.repo] | @tsv' "$settings")

  installed="$(claude plugin list --json | jq -r '.[].id')"
  while read -r id; do
    if grep -qxF "$id" <<<"$installed"; then
      [[ "$id" == *@agent-config ]] && update_repo_plugin "$id"
      continue
    fi
    pending "install plugin $id" || continue
    claude plugin install --scope user "$id" || FAILED_PLUGINS+=("$id")
  done < <(jq -r '.enabledPlugins // {} | to_entries[] | select(.value) | .key' "$settings")
}

plugin_version() {
  claude plugin list --json | jq -r --arg id "$1" '.[] | select(.id == $id) | .version'
}

# This repo's own mods move with the repo: an installed one is brought up to the commit the
# marketplace now serves. --check can't tell without fetching, so it leaves them alone.
update_repo_plugin() {
  local id="$1" before after
  ((CHECK)) && return 0
  if ((!REPO_MARKETPLACE_FRESH)); then
    claude plugin marketplace update agent-config >/dev/null || FAILED_PLUGINS+=("agent-config")
    REPO_MARKETPLACE_FRESH=1
  fi
  before="$(plugin_version "$id")"
  if ! claude plugin update "$id" >/dev/null; then
    FAILED_PLUGINS+=("$id")
    return 0
  fi
  after="$(plugin_version "$id")"
  [[ "$before" == "$after" ]] && return 0
  DRIFT=1
  log "  → update plugin $id ($before → $after)"
}

report_tools() {
  local tool missing=()
  for tool in "${RECOMMENDED_TOOLS[@]}"; do
    command -v "$tool" >/dev/null || missing+=("$tool")
  done
  ((${#missing[@]} == 0)) && return 0
  log ""
  log "Recommended CLI tools not installed (see global/AGENTS.md): ${missing[*]}"
}

main() {
  parse_args "$@"
  require git jq
  log "agent-config $(cat "$REPO_DIR/VERSION") from $REPO_DIR"
  ((CHECK)) && log "(check mode: nothing will be changed)"
  install_shared
  install_claude
  install_other_agents
  install_machine_config
  install_plugins
  report_tools
  log ""
  if ((${#FAILED_PLUGINS[@]})); then
    log "Claude Code plugins that failed (see the errors above): ${FAILED_PLUGINS[*]}"
    exit 1
  fi
  if ((CHECK && DRIFT)); then
    log "Out of date: run ./install.sh to apply."
    exit 1
  fi
  if ((DRIFT)); then log "Done."; else log "Everything already up to date."; fi
}

main "$@"
