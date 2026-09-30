"""Behavior tests for bin/vault-write, run as a subprocess against a temporary vault."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parent.parent / "bin" / "vault-write"
NOTE = "2. Areas/Sistema - Test.md"

BASE_NOTE = """---
tags: [area]
date: 2026-01-01
---

# Sistema

## Changelog

### 2026-05-25
- **Sistema**: primera

### 2026-07-25
- **Software**: segunda
"""


@pytest.fixture
def env(tmp_path: Path) -> dict[str, str]:
    vault = tmp_path / "vault"
    (vault / "2. Areas").mkdir(parents=True)
    (vault / NOTE).write_text(BASE_NOTE, encoding="utf-8")
    return {
        "PATH": os.environ["PATH"],
        "HOME": str(tmp_path / "home"),
        "XDG_CONFIG_HOME": str(tmp_path / "config"),
        "XDG_STATE_HOME": str(tmp_path / "state"),
        "VAULT_PATH": str(vault),
        "VAULT_CHANGELOG_NOTE": NOTE,
    }


def run(env: dict[str, str], *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args], env=env, capture_output=True, text=True, check=False
    )


def note_text(env: dict[str, str]) -> str:
    return (Path(env["VAULT_PATH"]) / NOTE).read_text(encoding="utf-8")


def test_appends_to_existing_day(env: dict[str, str]) -> None:
    result = run(env, "-c", "Vault", "--date", "2026-07-25", "tercera")
    assert result.returncode == 0, result.stderr
    assert "- **Software**: segunda\n- **Vault**: tercera\n" in note_text(env)


def test_new_day_goes_last_with_blank_separator(env: dict[str, str]) -> None:
    run(env, "-c", "Hardware", "--date", "2026-09-30", "nueva")
    assert note_text(env).endswith(
        "- **Software**: segunda\n\n### 2026-09-30\n- **Hardware**: nueva\n"
    )


def test_older_day_is_inserted_in_date_order(env: dict[str, str]) -> None:
    run(env, "-c", "Sistema", "--date", "2026-06-01", "intermedia")
    text = note_text(env)
    assert (
        text.index("### 2026-05-25") < text.index("### 2026-06-01") < text.index("### 2026-07-25")
    )
    assert "### 2026-06-01\n- **Sistema**: intermedia\n\n### 2026-07-25" in text


def test_changelog_followed_by_other_section(env: dict[str, str]) -> None:
    path = Path(env["VAULT_PATH"]) / NOTE
    path.write_text(BASE_NOTE + "\n## Otra sección\ntexto\n", encoding="utf-8")
    run(env, "-c", "Vault", "--date", "2026-09-30", "nueva")
    assert "- **Vault**: nueva\n\n## Otra sección" in note_text(env)


def test_empty_changelog_section(env: dict[str, str]) -> None:
    (Path(env["VAULT_PATH"]) / NOTE).write_text("# X\n\n## Changelog\n", encoding="utf-8")
    run(env, "-c", "Vault", "--date", "2026-09-30", "primera")
    assert note_text(env) == "# X\n\n## Changelog\n\n### 2026-09-30\n- **Vault**: primera\n"


def test_note_without_changelog_fails_without_writing(env: dict[str, str]) -> None:
    (Path(env["VAULT_PATH"]) / NOTE).write_text("# Sin changelog\n", encoding="utf-8")
    result = run(env, "-c", "Vault", "algo")
    assert result.returncode == 1
    assert "no '## Changelog' section" in result.stderr
    assert note_text(env) == "# Sin changelog\n"


@pytest.mark.parametrize(
    ("args", "message"),
    [
        (["-c", "Inventada", "algo"], "unknown category"),
        (["-c", "Vault", "--date", "30/09/2026", "algo"], "YYYY-MM-DD"),
        (["-c", "Vault", "  "], "single non-empty line"),
    ],
)
def test_rejects_bad_input(env: dict[str, str], args: list[str], message: str) -> None:
    result = run(env, *args)
    assert result.returncode == 1
    assert message in result.stderr
    assert note_text(env) == BASE_NOTE


def test_missing_arguments_is_usage_error(env: dict[str, str]) -> None:
    assert run(env, "sin categoría").returncode == 2


def test_unreachable_vault_queues_then_flushes(env: dict[str, str]) -> None:
    vault = env.pop("VAULT_PATH")
    env["VAULT_PATH"] = str(Path(vault) / "no-montado")
    queued = run(env, "-c", "Hardware", "--date", "2026-06-01", "desde la laptop")
    assert queued.returncode == 0
    assert "queued" in queued.stdout
    assert note_text({"VAULT_PATH": vault}) == BASE_NOTE

    cannot = run(env, "--flush")
    assert cannot.returncode == 1

    env["VAULT_PATH"] = vault
    assert "queued entries: 1" in run(env, "--where").stdout
    flushed = run(env, "--flush")
    assert flushed.returncode == 0, flushed.stderr
    assert "### 2026-06-01\n- **Hardware**: desde la laptop\n" in note_text(env)
    assert "queued entries: 0" in run(env, "--where").stdout


def test_failed_flush_keeps_unwritten_entries(env: dict[str, str]) -> None:
    vault = env["VAULT_PATH"]
    env["VAULT_PATH"] = str(Path(vault) / "no-montado")
    run(env, "-c", "Vault", "una")
    env["VAULT_CHANGELOG_NOTE"] = "no-existe.md"
    run(env, "-c", "Vault", "dos")
    env["VAULT_PATH"] = vault
    assert run(env, "--flush").returncode == 1
    assert "queued entries: 1" in run(env, "--where").stdout


def test_config_file_is_used_when_env_is_absent(env: dict[str, str]) -> None:
    vault = env.pop("VAULT_PATH")
    config = Path(env["XDG_CONFIG_HOME"]) / "agent-config" / "config.env"
    config.parent.mkdir(parents=True)
    config.write_text(
        f'# comment\nVAULT_PATH="{vault}"\nVAULT_CHANGELOG_NOTE={env.pop("VAULT_CHANGELOG_NOTE")}\n',
        encoding="utf-8",
    )
    result = run(env, "-c", "Vault", "--date", "2026-09-30", "desde config")
    assert result.returncode == 0, result.stderr
    assert "- **Vault**: desde config" in note_text({"VAULT_PATH": vault})


def test_unconfigured_vault_reports_reason(env: dict[str, str]) -> None:
    env.pop("VAULT_PATH")
    assert "no vault configured" in run(env, "--where").stdout
