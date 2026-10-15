#!/usr/bin/env bash
# Fail when a skill does not follow the Agent Skills standard every agent relies on: a SKILL.md
# whose frontmatter has a `name` equal to its directory and a non-empty `description`.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Print the value of a frontmatter key, joining a folded or literal block into one line.
frontmatter_value() {
  local file="$1" key="$2"
  awk -v key="$key" '
    NR == 1 { if ($0 != "---") exit; next }
    $0 == "---" { exit }
    in_block && /^[[:space:]]/ { sub(/^[[:space:]]+/, ""); printf "%s ", $0; next }
    { in_block = 0 }
    index($0, key ":") == 1 {
      value = substr($0, length(key) + 2)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      if (value ~ /^[>|][+-]?$/) { in_block = 1; next }
      gsub(/^["\047]|["\047]$/, "", value)
      print value
    }
  ' "$file"
}

failed=0
for dir in skills/*; do
  file="$dir/SKILL.md"
  if [[ ! -f "$file" ]]; then
    printf '%s has no SKILL.md\n' "$dir"
    failed=1
    continue
  fi
  name="$(frontmatter_value "$file" name)"
  if [[ "$name" != "$(basename "$dir")" ]]; then
    printf '%s declares name "%s"; it must match its directory\n' "$file" "$name"
    failed=1
  fi
  if [[ -z "$(frontmatter_value "$file" description)" ]]; then
    printf '%s has no description in its frontmatter\n' "$file"
    failed=1
  fi
done
exit "$failed"
