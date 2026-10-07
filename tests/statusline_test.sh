#!/usr/bin/env bash
# Behavior tests for agents/claude/statusline.sh. Each test pipes a session payload into the
# script and checks the rows it prints, with colour escapes stripped unless colour is the point.
# The reading that sessions share lives under a throwaway XDG_CACHE_HOME.
set -euo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)/agents/claude/statusline.sh"
FAILURES=0
WORKDIR="$(mktemp -d)"
trap 'rm -r "$WORKDIR"' EXIT
mkdir "$WORKDIR/myrepo"
export XDG_CACHE_HOME="$WORKDIR/cache"
LIMITS_FILE="$XDG_CACHE_HOME/agent-config/claude-rate-limits.json"
NOW="$(date +%s)"
FULL_LIMITS="5h ████████⣿⣿⣿⣿ 67% ↺ 4h 3m │ 7d ███████████⣿ 92% ↺ 1d 6h"

fail() {
  printf '    FAIL: %s\n' "$*"
  FAILURES=$((FAILURES + 1))
}

assert_eq() {
  [[ "$1" == "$2" ]] || fail "expected '$2', got '$1'"
}

# A complete payload, optionally changed by a jq filter. Filters can use $now (when the tests
# started, in epoch seconds) to place a reset time; the 30 s on top of each default keeps the
# countdowns stable while the tests run.
payload() {
  jq -n --arg dir "$WORKDIR/myrepo" --argjson now "$NOW" '
    {
      workspace: {current_dir: $dir},
      model: {display_name: "Opus 5.5"},
      effort: {level: "xhigh"},
      cost: {total_cost_usd: 0.6252, total_duration_ms: 125591},
      context_window: {
        remaining_percentage: 92,
        current_usage: {input_tokens: 50, cache_read_input_tokens: 950}
      },
      rate_limits: {
        five_hour: {used_percentage: 33, resets_at: ($now + 4 * 3600 + 3 * 60 + 30)},
        seven_day: {used_percentage: 8, resets_at: ($now + 30 * 3600 + 30)}
      }
    } | '"${1:-.}"
}

# Renders a payload as the only session on the machine: nothing shared by other sessions.
render() {
  rm -f "$LIMITS_FILE"
  render_alongside "${1:-.}"
}

# Renders a payload as one more session, after whatever the earlier ones shared.
render_alongside() {
  payload "${1:-.}" | "$SCRIPT"
}

limits_alongside() { # [payload filter]: the limits row of one more session
  render_alongside "${1:-.}" | plain | sed -n 3p
}

plain() {
  sed $'s/\033\\[[0-9;]*m//g'
}

row() { # <row number> [payload filter]
  render "${2:-.}" | plain | sed -n "${1}p"
}

figure_color() { # <row number> <text> <payload filter>: the colour escape right before the text
  render "$3" | sed -n "${1}p" | { grep -o $'\033\\[[0-9;]*m'"$2" || true; } | sed "s/$2\$//"
}

limit_color() { # <percent left in the 5-hour window>
  figure_color 3 "$1%" ".rate_limits.five_hour.used_percentage = $((100 - $1))"
}

test_full_payload_renders_three_rows() {
  local out
  out="$(render | plain)"
  assert_eq "$(sed -n 1p <<<"$out")" "[Opus 5.5 · xhigh] myrepo"
  assert_eq "$(sed -n 2p <<<"$out")" "▉⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿ 8% │ \$0.62 │ 2m 5s ↻95%"
  assert_eq "$(sed -n 3p <<<"$out")" "$FULL_LIMITS"
  assert_eq "$(grep -c '' <<<"$out")" "3"
}

test_branch_follows_the_folder() {
  git init -q -b trunk "$WORKDIR/gitrepo"
  assert_eq "$(row 1 ".workspace.current_dir = \"$WORKDIR/gitrepo\"")" \
    "[Opus 5.5 · xhigh] gitrepo │ trunk"
}

test_model_without_effort_support_shows_only_the_model() {
  assert_eq "$(row 1 'del(.effort)')" "[Opus 5.5] myrepo"
}

test_unknown_effort_level_is_still_shown() {
  assert_eq "$(row 1 '.effort.level = "ultra"')" "[Opus 5.5 · ultra] myrepo"
}

test_each_effort_level_has_its_own_colour() {
  local level colors=""
  for level in low medium high xhigh max; do
    colors+="$(figure_color 1 "$level" ".effort.level = \"$level\"")"$'\n'
  done
  assert_eq "$(sort -u <<<"$colors" | grep -c .)" "5"
}

test_without_rate_limits_there_is_no_third_row() {
  local out
  out="$(render 'del(.rate_limits)')"
  assert_eq "$(grep -c '' <<<"$out")" "2"
}

test_single_window_is_shown_alone() {
  assert_eq "$(row 3 'del(.rate_limits.five_hour)')" "7d ███████████⣿ 92% ↺ 1d 6h"
  assert_eq "$(row 3 'del(.rate_limits.seven_day)')" "5h ████████⣿⣿⣿⣿ 67% ↺ 4h 3m"
}

test_window_past_its_reset_is_hidden() {
  assert_eq "$(row 3 ".rate_limits.five_hour.resets_at = \$now - 5")" \
    "7d ███████████⣿ 92% ↺ 1d 6h"
}

test_fractional_usage_rounds_what_is_left_down() {
  local filter='del(.rate_limits.seven_day) | .rate_limits.five_hour.used_percentage = 23.5'
  assert_eq "$(row 3 "$filter")" "5h █████████⣿⣿⣿ 76% ↺ 4h 3m"
}

test_usage_at_or_over_the_limit_shows_an_empty_bar() {
  local filter='del(.rate_limits.seven_day) | .rate_limits.five_hour.used_percentage = '
  assert_eq "$(row 3 "$filter 100")" "5h ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿ 0% ↺ 4h 3m"
  assert_eq "$(row 3 "$filter 104.2")" "5h ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿ 0% ↺ 4h 3m"
}

test_untouched_window_shows_a_full_bar() {
  local filter='del(.rate_limits.seven_day) | .rate_limits.five_hour.used_percentage = 0'
  assert_eq "$(row 3 "$filter")" "5h ████████████ 100% ↺ 4h 3m"
}

test_countdown_drops_to_minutes_then_to_under_a_minute() {
  local filter='del(.rate_limits.seven_day) | .rate_limits.five_hour.used_percentage = 94'
  assert_eq "$(row 3 "$filter | .rate_limits.five_hour.resets_at = \$now + 750")" \
    "5h ▋⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿ 6% ↺ 12m"
  assert_eq "$(row 3 "$filter | .rate_limits.five_hour.resets_at = \$now + 40")" \
    "5h ▋⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿ 6% ↺ <1m"
}

test_limit_colour_changes_at_half_and_at_a_fifth_left() {
  local plenty low critical
  plenty="$(limit_color 100)"
  low="$(limit_color 35)"
  critical="$(limit_color 0)"
  [[ -n "$plenty" && "$plenty" != "$low" && "$low" != "$critical" && "$plenty" != "$critical" ]] ||
    fail "plenty, low and critical need three distinct colours"
  assert_eq "$(limit_color 50)" "$plenty"
  assert_eq "$(limit_color 49)" "$low"
  assert_eq "$(limit_color 20)" "$low"
  assert_eq "$(limit_color 19)" "$critical"
}

test_context_bar_shares_the_limit_colours() {
  assert_eq "$(figure_color 2 8% '.')" "$(limit_color 100)"
  assert_eq "$(figure_color 2 65% '.context_window.remaining_percentage = 35')" "$(limit_color 35)"
  assert_eq "$(figure_color 2 90% '.context_window.remaining_percentage = 10')" "$(limit_color 0)"
}

test_context_not_measured_yet_leaves_the_gauge_out() {
  assert_eq "$(row 2 '.context_window.remaining_percentage = null')" "\$0.62 │ 2m 5s ↻95%"
}

test_idle_session_shows_what_a_busier_one_shared() {
  render '.rate_limits.five_hour.used_percentage = 60' >/dev/null
  assert_eq "$(limits_alongside)" "5h ████▊⣿⣿⣿⣿⣿⣿⣿ 40% ↺ 4h 3m │ 7d ███████████⣿ 92% ↺ 1d 6h"
}

test_busier_session_replaces_what_an_idle_one_shared() {
  local busier="5h ████▊⣿⣿⣿⣿⣿⣿⣿ 40% ↺ 4h 3m │ 7d ███████████⣿ 92% ↺ 1d 6h"
  render >/dev/null
  assert_eq "$(limits_alongside '.rate_limits.five_hour.used_percentage = 60')" "$busier"
  assert_eq "$(limits_alongside)" "$busier"
}

test_new_window_replaces_a_fuller_one_about_to_reset() {
  local old='.rate_limits.five_hour.used_percentage = 90'
  local new=".rate_limits.five_hour = {used_percentage: 2, resets_at: (\$now + 5 * 3600 + 90)}"
  local fresh="5h ███████████▊ 98% ↺ 5h 1m │ 7d ███████████⣿ 92% ↺ 1d 6h"
  render "$old" >/dev/null
  assert_eq "$(limits_alongside "$new")" "$fresh"
  assert_eq "$(limits_alongside "$old")" "$fresh"
}

test_window_this_session_lost_comes_from_the_shared_reading() {
  render >/dev/null
  assert_eq "$(limits_alongside 'del(.rate_limits.five_hour)')" "$FULL_LIMITS"
}

test_session_without_limits_ignores_the_shared_reading() {
  render >/dev/null
  assert_eq "$(render_alongside 'del(.rate_limits)' | grep -c '')" "2"
}

test_shared_reading_past_its_reset_is_ignored() {
  mkdir -p "${LIMITS_FILE%/*}"
  printf '{"five_hour":{"used_percentage":99,"resets_at":%d}}\n' "$((NOW - 60))" >"$LIMITS_FILE"
  assert_eq "$(limits_alongside 'del(.rate_limits.five_hour)')" "7d ███████████⣿ 92% ↺ 1d 6h"
}

test_unreadable_shared_reading_is_replaced() {
  mkdir -p "${LIMITS_FILE%/*}"
  printf 'not json' >"$LIMITS_FILE"
  assert_eq "$(limits_alongside)" "$FULL_LIMITS"
  assert_eq "$(limits_alongside 'del(.rate_limits.five_hour)')" "$FULL_LIMITS"
}

test_unwritable_cache_still_shows_this_session() {
  local out
  : >"$WORKDIR/not-a-directory"
  out="$(payload | XDG_CACHE_HOME="$WORKDIR/not-a-directory" "$SCRIPT" 2>"$WORKDIR/stderr" | plain)"
  assert_eq "$(sed -n 3p <<<"$out")" "$FULL_LIMITS"
  grep -q "cannot write" "$WORKDIR/stderr" || fail "a failed write should be reported on stderr"
}

test_invalid_input_fails_with_no_output() {
  local out
  if out="$(printf 'not json' | "$SCRIPT" 2>/dev/null)"; then fail "invalid JSON should fail"; fi
  assert_eq "$out" ""
  if out="$("$SCRIPT" </dev/null 2>/dev/null)"; then fail "empty input should fail"; fi
  assert_eq "$out" ""
}

for test in $(declare -F | awk '$3 ~ /^test_/ {print $3}'); do
  printf '%s\n' "$test"
  "$test"
done

if ((FAILURES)); then
  printf '\n%d assertion(s) failed\n' "$FAILURES"
  exit 1
fi
printf '\nall statusline tests passed\n'
