#!/usr/bin/env bash
# Fail when a skill, command, tool or plugin in the repo is missing from docs/inventory.md.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

missing=0
names=()
for path in skills/* agents/claude/commands/*.md bin/*; do
  names+=("$(basename "$path" .md)")
done
while read -r id; do names+=("$id"); done < <(jq -r '.enabledPlugins | keys[]' agents/claude/settings.json)

for name in "${names[@]}"; do
  if ! grep -qF "\`$name\`" docs/inventory.md; then
    printf 'docs/inventory.md does not mention "%s"\n' "$name"
    missing=1
  fi
done

# A plugin served by this repo's own marketplace must exist at the path the marketplace names,
# or, when it comes from another repository, be pinned to the full commit that was reviewed.
while read -r id; do
  entry="$(jq -c --arg name "${id%@agent-config}" '.plugins[] | select(.name == $name) | .source' \
    .claude-plugin/marketplace.json)"
  if [[ -z "$entry" ]]; then
    printf '.claude-plugin/marketplace.json has no plugin for %s\n' "$id"
    missing=1
  elif [[ "$(jq -r 'type' <<<"$entry")" == "object" ]]; then
    if ! jq -e '.sha // "" | test("^[0-9a-f]{40}$")' <<<"$entry" >/dev/null; then
      printf '.claude-plugin/marketplace.json does not pin %s to a full commit sha\n' "$id"
      missing=1
    fi
  elif [[ ! -f "$(jq -r . <<<"$entry")/.claude-plugin/plugin.json" ]]; then
    printf '.claude-plugin/marketplace.json has no plugin at %s for %s\n' "$entry" "$id"
    missing=1
  fi
done < <(jq -r '.enabledPlugins | keys[] | select(endswith("@agent-config"))' agents/claude/settings.json)
exit "$missing"
