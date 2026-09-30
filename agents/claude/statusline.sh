#!/bin/bash
stdin_data=$(cat)

IFS=$'\t' read -r current_dir model_name cost duration_ms ctx_used cache_pct < <(
    echo "$stdin_data" | jq -r '[
        .workspace.current_dir // "unknown",
        .model.display_name // "Unknown",
        (try (.cost.total_cost_usd // 0 | . * 100 | floor / 100) catch 0),
        (.cost.total_duration_ms // 0),
        (try (
            if (.context_window.remaining_percentage // null) != null then
                100 - (.context_window.remaining_percentage | floor)
            else "null" end
        ) catch "null"),
        (try (
            (.context_window.current_usage // {}) |
            if (.input_tokens // 0) + (.cache_read_input_tokens // 0) > 0 then
                ((.cache_read_input_tokens // 0) * 100 /
                 ((.input_tokens // 0) + (.cache_read_input_tokens // 0))) | floor
            else 0 end
        ) catch 0)
    ] | @tsv'
)

git_branch=""
if cd "$current_dir" 2>/dev/null; then
    git_branch=$(git branch --show-current 2>/dev/null)
fi

folder_name=$(basename "$current_dir")
short_model=$(echo "$model_name" | sed -E 's/Claude [0-9.]+ //; s/^Claude //')

bar_width=12
progress_bar=""
ctx_pct=""
if [ -n "$ctx_used" ] && [ "$ctx_used" != "null" ]; then
    filled=$((ctx_used * bar_width / 100))
    empty=$((bar_width - filled))
    if [ "$ctx_used" -lt 50 ]; then bar_color='\033[32m';
    elif [ "$ctx_used" -lt 80 ]; then bar_color='\033[33m';
    else bar_color='\033[31m'; fi
    progress_bar="${bar_color}"
    for ((i=0; i<filled; i++)); do progress_bar="${progress_bar}█"; done
    progress_bar="${progress_bar}\033[2m"
    for ((i=0; i<empty; i++)); do progress_bar="${progress_bar}⣿"; done
    progress_bar="${progress_bar}\033[0m"
    ctx_pct="${ctx_used}%"
fi

session_time=""
if [ "$duration_ms" -gt 0 ] 2>/dev/null; then
    total_sec=$((duration_ms / 1000))
    hours=$((total_sec / 3600))
    minutes=$(((total_sec % 3600) / 60))
    seconds=$((total_sec % 60))
    if [ "$hours" -gt 0 ]; then session_time="${hours}h ${minutes}m";
    elif [ "$minutes" -gt 0 ]; then session_time="${minutes}m ${seconds}s";
    else session_time="${seconds}s"; fi
fi

SEP='\033[2m│\033[0m'

line1=$(printf '\033[37m[%s]\033[0m \033[94m%s\033[0m' "$short_model" "$folder_name")
[ -n "$git_branch" ] && line1="$line1 $(printf '%b \033[96m%s\033[0m' "$SEP" "$git_branch")"

line2=$(printf '%b %s %b \033[33m$%s\033[0m' "$progress_bar" "$ctx_pct" "$SEP" "$cost")
[ -n "$session_time" ] && line2="$line2 $(printf '%b \033[36m%s\033[0m' "$SEP" "$session_time")"
[ "$cache_pct" -gt 0 ] 2>/dev/null && line2="$line2 $(printf ' \033[2m↻%s%%\033[0m' "$cache_pct")"

printf '%b\n\n%b' "$line1" "$line2"
