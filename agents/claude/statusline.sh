#!/bin/bash
# Claude Code status line. Reads the session JSON on stdin and prints up to three rows:
# model, effort and location; context window, cost and session time; subscription limits.
set -euo pipefail

RESET=$'\033[0m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
WHITE=$'\033[37m'
YELLOW=$'\033[33m'
CYAN=$'\033[36m'
BRIGHT_BLUE=$'\033[94m'
BRIGHT_CYAN=$'\033[96m'
SEP="${DIM}│${RESET}"

# Levels use 24-bit colours because a terminal theme can remap the 16-colour palette (a
# monochrome theme renders red, yellow and green as greys), which would hide what they mean.
GREEN=$'\033[38;2;74;222;128m'
AMBER=$'\033[38;2;250;204;21m'
RED=$'\033[38;2;248;113;113m'

BAR_WIDTH=12
PARTIAL_BLOCKS=('' '▏' '▎' '▍' '▌' '▋' '▊' '▉')

# <fill percent> <percent left>: a bar filled to the first value and that figure next to it,
# both coloured by how much is left.
gauge() {
    local fill=$1 left=$2 color=$RED
    if ((left >= 50)); then color=$GREEN; elif ((left >= 20)); then color=$AMBER; fi
    local eighths=$((fill * BAR_WIDTH * 8 / 100)) bar=$color i
    local cells=$((eighths / 8))
    for ((i = 0; i < cells; i++)); do bar+='█'; done
    if ((eighths % 8)); then
        bar+=${PARTIAL_BLOCKS[eighths % 8]}
        cells=$((cells + 1))
    fi
    bar+=$DIM
    for ((i = cells; i < BAR_WIDTH; i++)); do bar+='⣿'; done
    printf '%s%s %s%d%%%s' "$bar" "$RESET" "$color" "$fill" "$RESET"
}

countdown() {
    local days=$(($1 / 86400)) hours=$(($1 % 86400 / 3600)) minutes=$(($1 % 3600 / 60))
    if ((days > 0)); then
        printf '%dd %dh' "$days" "$hours"
    elif ((hours > 0)); then
        printf '%dh %dm' "$hours" "$minutes"
    elif ((minutes > 0)); then
        printf '%dm' "$minutes"
    else
        printf '<1m'
    fi
}

# <label> <percent left> <seconds until the window resets>; prints nothing without data.
limit_meter() {
    if [ -z "$2" ]; then return; fi
    printf '%s%s%s %s %s↺ %s%s' \
        "$BOLD" "$1" "$RESET" "$(gauge "$2" "$2")" "$DIM" "$(countdown "$3")" "$RESET"
}

join_segments() {
    local joined="" segment
    for segment in "$@"; do
        if [ -n "$segment" ]; then joined+="${joined:+ $SEP }$segment"; fi
    done
    printf '%s' "$joined"
}

# Fields are joined with the unit separator, not a tab: read collapses consecutive whitespace
# delimiters, so an absent value would shift every field after it.
if ! fields=$(jq -r '
    def limit_window($w):
        if ($w.used_percentage | type) == "number" and ($w.resets_at | type) == "number"
            and $w.resets_at > now
        then [
            (100 - $w.used_percentage | floor | if . < 0 then 0 else . end),
            ($w.resets_at - now | floor)
        ]
        else [null, null] end;
    [
        .workspace.current_dir // "unknown",
        .model.display_name // "Unknown",
        (try (.cost.total_cost_usd // 0 | . * 100 | floor / 100) catch 0),
        (.cost.total_duration_ms // 0 | floor),
        (try (
            if (.context_window.remaining_percentage // null) != null then
                100 - (.context_window.remaining_percentage | floor)
            else null end
        ) catch null),
        (try (
            (.context_window.current_usage // {}) |
            if (.input_tokens // 0) + (.cache_read_input_tokens // 0) > 0 then
                ((.cache_read_input_tokens // 0) * 100 /
                 ((.input_tokens // 0) + (.cache_read_input_tokens // 0))) | floor
            else 0 end
        ) catch 0),
        .effort.level,
        limit_window(.rate_limits.five_hour)[],
        limit_window(.rate_limits.seven_day)[]
    ] | join("\u001f")') || [ -z "$fields" ]; then
    echo "statusline: expected the Claude Code session JSON on stdin" >&2
    exit 1
fi
IFS=$'\037' read -r current_dir model_name cost duration_ms ctx_used cache_pct effort \
    five_left five_secs week_left week_secs <<<"$fields"

folder_name=$(basename "$current_dir")
short_model=$(sed -E 's/Claude [0-9.]+ //; s/^Claude //' <<<"$model_name")
git_branch=$(git -C "$current_dir" branch --show-current 2>/dev/null) || git_branch=""

model_tag="${WHITE}[${short_model}"
if [ -n "$effort" ]; then
    case "$effort" in
        low) effort_color=$'\033[38;2;103;232;249m' ;;
        medium) effort_color=$'\033[38;2;96;165;250m' ;;
        high) effort_color=$'\033[38;2;129;140;248m' ;;
        xhigh) effort_color=$'\033[38;2;192;132;252m' ;;
        max) effort_color=$'\033[38;2;232;121;249m' ;;
        *) effort_color=$WHITE ;;
    esac
    model_tag+=" ${DIM}·${RESET} ${effort_color}${effort}${RESET}${WHITE}"
fi
model_tag+="]${RESET}"

context_gauge=""
if [ -n "$ctx_used" ]; then context_gauge=$(gauge "$ctx_used" "$((100 - ctx_used))"); fi

session_tag=""
if ((duration_ms > 0)); then
    total_sec=$((duration_ms / 1000))
    hours=$((total_sec / 3600))
    minutes=$(((total_sec % 3600) / 60))
    seconds=$((total_sec % 60))
    if ((hours > 0)); then
        session_tag="${hours}h ${minutes}m"
    elif ((minutes > 0)); then
        session_tag="${minutes}m ${seconds}s"
    else
        session_tag="${seconds}s"
    fi
    session_tag="${CYAN}${session_tag}${RESET}"
fi
if ((cache_pct > 0)); then session_tag+="${session_tag:+ }${DIM}↻${cache_pct}%${RESET}"; fi

row1=$(join_segments "${model_tag} ${BRIGHT_BLUE}${folder_name}${RESET}" \
    "${git_branch:+${BRIGHT_CYAN}${git_branch}${RESET}}")
row2=$(join_segments "$context_gauge" "${YELLOW}\$${cost}${RESET}" "$session_tag")
row3=$(join_segments "$(limit_meter 5h "$five_left" "$five_secs")" \
    "$(limit_meter 7d "$week_left" "$week_secs")")

printf '%s\n' "$row1" "$row2"
if [ -n "$row3" ]; then printf '%s\n' "$row3"; fi
