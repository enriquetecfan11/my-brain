#!/usr/bin/env bash
# cbm-dashboard dev launcher
#
# Usage:
#   ./dev.sh            — start API + UI together
#   ./dev.sh api        — start API only  (port 3000)
#   ./dev.sh ui         — start UI only   (port 5173)
#   ./dev.sh install    — npm install in both packages
#   ./dev.sh --help

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR/api"
UI_DIR="$SCRIPT_DIR/ui"

# ── Colours ──────────────────────────────────────────────────────────────────
BOLD="\033[1m"
RESET="\033[0m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"

info()    { echo -e "${BOLD}${BLUE}[cbm]${RESET}  $*"; }
ok()      { echo -e "${BOLD}${GREEN}[cbm]${RESET}  $*"; }
warn()    { echo -e "${BOLD}${YELLOW}[cbm]${RESET}  $*"; }
err()     { echo -e "${BOLD}${RED}[cbm]${RESET}  $*" >&2; }

# ── Prefixed log line for background processes ────────────────────────────────
prefix_api() { while IFS= read -r line; do echo -e "${CYAN}[api]${RESET}  $line"; done; }
prefix_ui()  { while IFS= read -r line; do echo -e "${GREEN}[ui] ${RESET}  $line"; done; }

# ── Helpers ───────────────────────────────────────────────────────────────────
check_node() {
  if ! command -v node &>/dev/null; then
    err "Node.js not found. Install Node 22+ first."
    exit 1
  fi
  local ver
  ver=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
  if (( ver < 18 )); then
    warn "Node $ver detected; Node 22+ recommended."
  fi
}

ensure_deps() {
  local dir="$1"
  local name="$2"
  if [[ ! -d "$dir/node_modules" ]]; then
    warn "$name: node_modules missing — running npm install…"
    npm install --prefix "$dir"
    ok "$name: dependencies installed."
  fi
}

usage() {
  echo -e "
${BOLD}cbm-dashboard dev launcher${RESET}

  ${BOLD}./dev.sh${RESET}              Start API + UI together
  ${BOLD}./dev.sh api${RESET}          Start API only   (default port 3000)
  ${BOLD}./dev.sh ui${RESET}           Start UI only    (default port 5173)
  ${BOLD}./dev.sh install${RESET}      npm install in both api/ and ui/
  ${BOLD}./dev.sh --help${RESET}       Show this help

Environment variables (override defaults):
  CBM_CACHE_DIR     SQLite cache directory  (default: ~/.cache/codebase-memory-mcp)
  CBM_API_PORT      API listen port         (default: 3000)
  CBM_API_HOST      API bind address        (default: 127.0.0.1)
  CBM_PROJECT       Default project name    (default: none)
  CBM_BINARY        Path to MCP CLI         (default: codebase-memory-mcp)
"
}

# ── Install ───────────────────────────────────────────────────────────────────
cmd_install() {
  info "Installing API dependencies…"
  npm install --prefix "$API_DIR"
  ok "API dependencies installed."

  info "Installing UI dependencies…"
  npm install --prefix "$UI_DIR"
  ok "UI dependencies installed."
}

# ── API only ──────────────────────────────────────────────────────────────────
cmd_api() {
  check_node
  ensure_deps "$API_DIR" "api"
  info "Starting API on port ${CBM_API_PORT:-3000}…"
  exec npm --prefix "$API_DIR" run dev
}

# ── UI only ───────────────────────────────────────────────────────────────────
cmd_ui() {
  check_node
  ensure_deps "$UI_DIR" "ui"
  info "Starting UI (Vite) on port 5173…"
  exec npm --prefix "$UI_DIR" run dev
}

# ── Both together ─────────────────────────────────────────────────────────────
cmd_both() {
  check_node
  ensure_deps "$API_DIR" "api"
  ensure_deps "$UI_DIR"  "ui"

  info "Starting API + UI…"
  echo ""
  echo -e "  ${CYAN}API${RESET}  → http://${CBM_API_HOST:-127.0.0.1}:${CBM_API_PORT:-3000}"
  echo -e "  ${GREEN}UI${RESET}   → http://localhost:5173"
  echo ""
  echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop both."
  echo ""

  # Track child PIDs for cleanup
  API_PID=""
  UI_PID=""

  cleanup() {
    echo ""
    info "Shutting down…"
    [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
    [[ -n "$UI_PID"  ]] && kill "$UI_PID"  2>/dev/null || true
    wait "$API_PID" "$UI_PID" 2>/dev/null || true
    ok "Done."
  }
  trap cleanup INT TERM

  # Start API, pipe output through prefix
  npm --prefix "$API_DIR" run dev 2>&1 | prefix_api &
  API_PID=$!

  # Small delay so API port is ready before Vite prints its URL
  sleep 1

  # Start UI, pipe output through prefix
  npm --prefix "$UI_DIR" run dev 2>&1 | prefix_ui &
  UI_PID=$!

  # Wait for either child to exit (shouldn't happen unless one crashes)
  wait -n "$API_PID" "$UI_PID" 2>/dev/null || true

  # If we reach here, one process exited unexpectedly — kill the other
  cleanup
}

# ── Entry point ───────────────────────────────────────────────────────────────
ARG="${1:-both}"

case "$ARG" in
  api)     cmd_api     ;;
  ui)      cmd_ui      ;;
  install) cmd_install ;;
  both|"") cmd_both    ;;
  --help|-h) usage     ;;
  *)
    err "Unknown command: $ARG"
    usage
    exit 1
    ;;
esac
