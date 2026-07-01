#!/usr/bin/env bash
set -euo pipefail

# Layer 6A: Dashboard frontend asset scan.
#
# Usage: Dashboard/scripts/security-ui.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

SEC_TMPDIR=$(mktemp -d)
trap 'rm -rf "$SEC_TMPDIR"' EXIT

echo "=== Layer 6A: Dashboard UI Security Audit ==="

UI_DIRS=()
[[ -d "$ROOT/ui/dist" ]] && UI_DIRS+=("$ROOT/ui/dist")
[[ -d "$ROOT/ui/src" ]] && UI_DIRS+=("$ROOT/ui/src")

if [[ ${#UI_DIRS[@]} -eq 0 ]]; then
    echo "SKIP: No Dashboard UI directory found."
else
    for UI_DIR in "${UI_DIRS[@]}"; do
        echo "Scanning: $UI_DIR"

        is_dist=false
        [[ "$UI_DIR" == *"/dist" || "$UI_DIR" == *"/dist/" ]] && is_dist=true

        if ! $is_dist; then
            echo "  Checking for external domains (source)..."
            if find "$UI_DIR" -type f \( -name '*.js' -o -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) -exec grep -lE 'https?://' {} \; 2>/dev/null | head -20 > "$SEC_TMPDIR/urls"; then
                while IFS= read -r file; do
                    relfile="${file#"$ROOT/"}"
                    grep -onE 'https?://[^\s"'"'"')]+' "$file" 2>/dev/null | while IFS=: read -r lineno url; do
                        case "$url" in
                            http://localhost*|http://127.0.0.1*|https://localhost*|https://127.0.0.1*)
                                ;;
                            *)
                                echo "  BLOCKED: ${relfile}:${lineno}: External URL: $url"
                                touch "$SEC_TMPDIR/fail_flag"
                                ;;
                        esac
                    done
                done < "$SEC_TMPDIR/urls"
            fi
            [[ -f "$SEC_TMPDIR/fail_flag" ]] && FAIL=1 && rm -f "$SEC_TMPDIR/fail_flag"
        else
            echo "  Skipping inline URL scan for dist/ (bundled library strings)."
            echo "  Structural checks (script loads, tracking, eval, iframes) still apply."
        fi

        echo "  Checking for external script/link loads..."
        if find "$UI_DIR" -type f -name '*.html' -exec grep -lE '<script\s+src=|<link\s+href=' {} \; 2>/dev/null > "$SEC_TMPDIR/scripts"; then
            while IFS= read -r file; do
                relfile="${file#"$ROOT/"}"
                if grep -nE '<script\s+src="https?://|<link\s+href="https?://' "$file" 2>/dev/null \
                    | grep -v 'localhost' | grep -v '127.0.0.1' \
                    | grep -v 'fonts.googleapis.com' | grep -v 'fonts.gstatic.com'; then
                    echo "  BLOCKED: ${relfile}: External script/link load detected"
                    FAIL=1
                fi
            done < "$SEC_TMPDIR/scripts"
        fi

        echo "  Checking for tracking/analytics..."
        TRACKING='google-analytics|gtag|mixpanel|segment\.com|hotjar|sentry\.io|plausible|posthog'
        if find "$UI_DIR" -type f \( -name '*.js' -o -name '*.ts' -o -name '*.tsx' -o -name '*.html' \) \
            -exec grep -lE "$TRACKING" {} \; 2>/dev/null > "$SEC_TMPDIR/track"; then
            while IFS= read -r file; do
                relfile="${file#"$ROOT/"}"
                echo "  BLOCKED: ${relfile}: Tracking/analytics reference found"
                grep -nE "$TRACKING" "$file" | head -3
                FAIL=1
            done < "$SEC_TMPDIR/track"
        fi

        echo "  Checking for iframes..."
        if find "$UI_DIR" -type f -name '*.html' -exec grep -li '<iframe' {} \; 2>/dev/null > "$SEC_TMPDIR/iframe"; then
            while IFS= read -r file; do
                relfile="${file#"$ROOT/"}"
                echo "  BLOCKED: ${relfile}: iframe detected"
                FAIL=1
            done < "$SEC_TMPDIR/iframe"
        fi

        echo "  Checking for eval/Function constructor..."
        if find "$UI_DIR" -type f \( -name '*.js' -o -name '*.ts' -o -name '*.tsx' \) \
            -exec grep -nE '\beval\s*\(|new\s+Function\s*\(' {} \; 2>/dev/null | grep -v node_modules | grep -v '\.test\.' > "$SEC_TMPDIR/eval"; then
            while IFS= read -r match; do
                echo "  REVIEW: eval/Function found: $match"
            done < "$SEC_TMPDIR/eval"
        fi

        echo "  Checking for external WebSocket connections..."
        if find "$UI_DIR" -type f \( -name '*.js' -o -name '*.ts' -o -name '*.tsx' \) \
            -exec grep -nE 'wss?://' {} \; 2>/dev/null | grep -v 'localhost' | grep -v '127.0.0.1' > "$SEC_TMPDIR/ws"; then
            while IFS= read -r match; do
                echo "  BLOCKED: External WebSocket: $match"
                FAIL=1
            done < "$SEC_TMPDIR/ws"
        fi
    done
fi

echo ""
if [[ $FAIL -ne 0 ]]; then
    echo "=== Dashboard UI security audit FAILED ==="
    exit 1
fi

echo "=== Dashboard UI security audit passed ==="
