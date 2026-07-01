#!/usr/bin/env bash
# License gate for Dashboard UI npm production tree.
#
# Usage: Dashboard/scripts/license-gate-ui.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
POLICY="$REPO_ROOT/MCP/scripts/license-policy.json"

echo "=== License gate: Dashboard UI npm production tree ==="

if command -v npm &>/dev/null && [ -f "$ROOT/ui/package-lock.json" ]; then
    if [ ! -d "$ROOT/ui/node_modules" ]; then
        (cd "$ROOT/ui" && npm ci --ignore-scripts --silent)
    fi
    python3 "$ROOT/scripts/license-gate-check-npm.py" "$ROOT/ui" "$POLICY"
else
    echo "SKIP: Dashboard/ui package-lock.json unavailable — UI tree unchecked"
fi
