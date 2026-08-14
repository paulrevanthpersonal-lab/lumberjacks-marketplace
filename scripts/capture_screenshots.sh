#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; CHROME="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"; OUT="$ROOT/docs/screenshots"; PROFILE="$(mktemp -d)"; trap 'rm -rf "$PROFILE"' EXIT; mkdir -p "$OUT"; URL="file://$ROOT/index.html"
"$CHROME" --headless=new --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROFILE/d" --window-size=1440,1100 --screenshot="$OUT/editorial-home.png" "$URL#home"
"$CHROME" --headless=new --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROFILE/m" --window-size=430,930 --screenshot="$OUT/editorial-mobile.png" "$URL#home"
