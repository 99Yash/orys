#!/bin/bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
final_result='select(.type == "result").result // empty'

for ((i=1; i<=$1; i++)); do
  tmpfile=$(mktemp)
  trap 'rm -f "$tmpfile"' EXIT

  echo "━━━ Iteration $i/$1 ━━━"

  claude --permission-mode bypassPermissions \
    --print \
    --output-format stream-json --verbose \
    "@review-prompt.md @plan.md @progress.txt \
1. Read the review prompt, plan, and progress file. \
2. Find the next incomplete task in plan.md. \
3. Inspect relevant diffs and full file context. \
4. Apply the review checklist and fix issues directly when in scope. \
5. Run bun run check-types to verify no regressions. \
6. Mark the task complete in plan.md. \
7. Append findings to progress.txt. \
8. Commit your changes. \
Work on one task only. If all tasks are complete, output <promise>COMPLETE</promise>." \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "Loop complete after $i iterations."
    exit 0
  fi
done
