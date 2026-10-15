#!/usr/bin/env bash
# Run every check the repo has: shell lint, Python lint, and both test suites.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

scripts=(install.sh tests/*.sh agents/claude/statusline.sh)
uvx --from shellcheck-py==0.11.0.1 shellcheck "${scripts[@]}"
uvx ruff@0.14.0 check --line-length 100 bin/vault-write tests/test_vault_write.py
uvx ruff@0.14.0 format --check --line-length 100 bin/vault-write tests/test_vault_write.py
for f in agents/claude/settings.json agents/opencode/opencode.json; do jq empty "$f"; done
tests/check_inventory.sh
bash tests/install_test.sh
bash tests/statusline_test.sh
if command -v claude >/dev/null; then
  claude plugin validate .
  for mod in agents/claude/mods/*/; do
    claude plugin validate "$mod"
    claude plugin test "$mod"
  done
else
  echo "claude is not on PATH: skipping the mod validation and tests"
fi
uv run --no-project --with pytest==8.4.2 pytest -q tests/test_vault_write.py
