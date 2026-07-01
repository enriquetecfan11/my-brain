#!/usr/bin/env bash
# My Brain — launch the full local stack (Dashboard API + UI).
#
# Usage (Git Bash / WSL / macOS / Linux):
#   ./dev.sh              Start API (:3000) + UI (:5173)
#   ./dev.sh --open       Same, then open http://localhost:5173 in the browser
#   ./dev.sh install      npm install in api/ and ui/
#   ./dev.sh api          API only
#   ./dev.sh ui           UI only
#   ./dev.sh --help
#
# Windows PowerShell: use .\dev.ps1 (same options, -Open instead of --open)
#
# Environment:
#   CBM_CACHE_DIR         SQLite cache (default: ~/.cache/codebase-memory-mcp)
#   CBM_API_PORT          API port (default: 3000)
#   CBM_API_HOST          API bind address (default: 127.0.0.1)
#   CBM_PROJECT           Default project name in the API
#   CBM_OLLAMA_URL        Ollama base URL for chat (default: http://localhost:11434)
#   CBM_BINARY            Path to codebase-memory-mcp CLI (default: on PATH)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_DEV="$ROOT/Dashboard/dev.sh"

BOLD="\033[1m"
RESET="\033[0m"
YELLOW="\033[0;33m"
MAGENTA="\033[0;35m"

info()  { echo -e "${BOLD}${MAGENTA}[my-brain]${RESET}  $*"; }
warn()  { echo -e "${BOLD}${YELLOW}[my-brain]${RESET}  $*"; }

usage() {
  cat <<EOF

${BOLD}My Brain dev launcher${RESET}

  ${BOLD}./dev.sh${RESET}              Start dashboard API + UI
  ${BOLD}./dev.sh --open${RESET}       Start and open http://localhost:5173
  ${BOLD}./dev.sh install${RESET}      Install npm dependencies
  ${BOLD}./dev.sh api${RESET}          API only  (port \${CBM_API_PORT:-3000})
  ${BOLD}./dev.sh ui${RESET}           UI only   (port 5173)
  ${BOLD}./dev.sh --help${RESET}       Show this help

Services:
  API   http://\${CBM_API_HOST:-127.0.0.1}:\${CBM_API_PORT:-3000}
  UI    http://localhost:5173
  Chat  uses Ollama at \${CBM_OLLAMA_URL:-http://localhost:11434}

Press Ctrl+C to stop API + UI together.

EOF
}

check_dashboard() {
  if [[ ! -x "$DASHBOARD_DEV" ]]; then
    if [[ -f "$DASHBOARD_DEV" ]]; then
      chmod +x "$DASHBOARD_DEV"
    else
      echo "error: missing $DASHBOARD_DEV" >&2
      exit 1
    fi
  fi
}

check_ollama() {
  local url="${CBM_OLLAMA_URL:-http://localhost:11434}"
  url="${url%/}"
  if curl -sf "${url}/api/tags" >/dev/null 2>&1; then
    info "Ollama reachable at ${url} (Chat tab ready)"
  else
    warn "Ollama not reachable at ${url} — start it for Chat (e.g. ollama serve)"
  fi
}

maybe_open_browser() {
  [[ "${1:-}" == "--open" ]] || return 0
  if command -v open &>/dev/null; then
    (sleep 2 && open "http://localhost:5173") &
  elif command -v xdg-open &>/dev/null; then
    (sleep 2 && xdg-open "http://localhost:5173") &
  else
    warn "No open/xdg-open — visit http://localhost:5173 manually"
  fi
}

cmd_start() {
  local open_flag=""
  [[ "${1:-}" == "--open" ]] && open_flag="--open"

  check_dashboard
  check_ollama
  maybe_open_browser "$open_flag"

  echo ""
  info "Starting Dashboard (API + UI)…"
  echo ""
  exec "$DASHBOARD_DEV" both
}

# ── Entry point ────────────────────────────────────────────────────────────────

check_dashboard

ARG="${1:-}"

case "$ARG" in
  ""|both)
    cmd_start
    ;;
  --open)
    cmd_start --open
    ;;
  install|api|ui)
    exec "$DASHBOARD_DEV" "$ARG"
    ;;
  --help|-h|help)
    usage
    ;;
  *)
    echo "error: unknown command: $ARG" >&2
    usage
    exit 1
    ;;
esac
