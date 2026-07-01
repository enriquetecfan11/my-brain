#!/bin/bash
# clean.sh — Remove Dashboard build artifacts and caches.
#
# Usage: Dashboard/scripts/clean.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Cleaning Dashboard artifacts ==="

rm -rf "$ROOT/ui/dist"
rm -rf "$ROOT/ui/.vite"
rm -rf "$ROOT/ui/node_modules"
rm -rf "$ROOT/api/node_modules"
rm -rf "$ROOT/api/dist"

echo "=== Dashboard clean complete ==="
