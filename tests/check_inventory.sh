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
exit "$missing"
