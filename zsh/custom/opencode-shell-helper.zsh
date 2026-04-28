ops() {
  if ! command -v opencode &> /dev/null; then
    print -u2 $'\e[31m✗ Error: opencode command not found\e[0m'
    return 1
  fi
  if ! command -v jq &> /dev/null; then
    print -u2 $'\e[31m✗ Error: jq is required (for JSON parsing)\e[0m'
    return 1
  fi

  if [[ $# -eq 0 && -t 0 ]]; then
    print -u2 $'\e[33mUsage:\e[0m ops "your request" [--file file.txt --image img.png ...]'
    return 1
  fi

  local -a request_parts=() opencode_args=()
  for arg in "$@"; do
    if [[ $arg == -* ]]; then
      opencode_args+=("$arg")
    else
      request_parts+=("$arg")
    fi
  done

  local request="${(j: :)request_parts}"

  if ! [[ -t 0 ]]; then
    local input=$(cat)
    request="=== INPUT FROM PIPE ===\n${input}\n\n${request}"
  fi

  # Lighter prompt — tool restrictions are now enforced by the agent itself
  local prompt="Provide a complete zsh script for this request.

Rules:
- Output ONLY the raw script.
- Start directly with a proper shebang.
- No explanations, no markdown, no code fences.

Request: $request"

  local script
  script=$(opencode run "$prompt" \
    --log-level ERROR \
    --format json \
    --agent ask \
    "${opencode_args[@]}" \
    | jq -r 'if .type == "text" then .part.text elif .type == "error" then "opencode error: \(.error.data.message // .error.message // .error.name // "unknown error")" | halt_error(1) else empty end')

  if [[ -z "$script" || "$script" =~ ^[[:space:]]*$ ]]; then
    print -u2 $'\e[31m✗ Error: No script content captured from opencode\e[0m'
    return 1
  fi

  if [[ -t 1 ]]; then
    print -n "$script" | pbcopy
    print -P "\n%F{green}✓ Script copied to clipboard%f"
  else
    print -n "$script"
  fi
}
