#!/usr/bin/env bash
set -euo pipefail

# Layer 6B-D: Embedded MCP HTTP UI server security audit.
#
# Usage: MCP/scripts/security-ui.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

echo "=== Layer 6B-D: Embedded MCP UI Security Audit ==="

echo ""
echo "--- B. HTTP server binding check ---"

HTTPD="$ROOT/src/ui/httpd.c"
HTTP_SERVER="$ROOT/src/ui/http_server.c"
for f in "$HTTPD" "$HTTP_SERVER"; do
    if [[ ! -f "$f" ]]; then
        echo "BLOCKED: expected UI server source missing: $f"
        FAIL=1
    fi
done

if [[ -f "$HTTPD" ]]; then
    if grep -q '127\.0\.0\.1' "$HTTPD"; then
        echo "OK: Server binds to 127.0.0.1"
    else
        echo "BLOCKED: No 127.0.0.1 binding found in httpd.c"
        FAIL=1
    fi

    if cat "$HTTPD" "$HTTP_SERVER" 2>/dev/null | grep -E '0\.0\.0\.0|INADDR_ANY|in6addr_any' | grep -v '^\s*//' | grep -v '^\s*\*' > /dev/null 2>&1; then
        echo "BLOCKED: Server may bind to all interfaces (0.0.0.0/INADDR_ANY found)"
        FAIL=1
    else
        echo "OK: No 0.0.0.0/INADDR_ANY binding"
    fi
fi

echo ""
echo "--- C. RPC proxy scope check ---"

if [[ -f "$HTTP_SERVER" ]]; then
    if cat "$HTTPD" "$HTTP_SERVER" 2>/dev/null | grep -n 'system(' | grep -v '^\s*//' | grep -v '^\s*\*' > /dev/null 2>&1; then
        echo "BLOCKED: system() call found in HTTP server (use subprocess instead)"
        FAIL=1
    else
        echo "OK: No system() calls in HTTP handler"
    fi
fi

echo ""
echo "--- D. CORS check ---"

if [[ -f "$HTTP_SERVER" ]]; then
    if cat "$HTTPD" "$HTTP_SERVER" 2>/dev/null | grep -E 'Allow-Origin:\s*\*' | grep -v '^\s*//' | grep -v '^\s*\*' > /dev/null 2>&1; then
        echo "BLOCKED: CORS wildcard (Access-Control-Allow-Origin: *) found"
        echo "  This allows any website to access the local server."
        FAIL=1
    else
        echo "OK: No CORS wildcard found"
    fi

    if grep -q 'localhost' "$HTTP_SERVER" && grep -q 'update_cors\|Access-Control-Allow-Origin' "$HTTP_SERVER"; then
        echo "OK: CORS appears to validate localhost origins"
    fi
fi

echo ""
if [[ $FAIL -ne 0 ]]; then
    echo "=== Embedded MCP UI security audit FAILED ==="
    exit 1
fi

echo "=== Embedded MCP UI security audit passed ==="
