#!/usr/bin/env bash
set -euo pipefail

# Uccide i browser Playwright rimasti orfani dopo un run interrotto (Ctrl-C,
# crash, OOM). Su hardware limitato i browser zombie occupano RAM preziosa e
# causano blocchi alla suite successiva.
# Non tocca il server Next in esecuzione.

for pattern in \
  'chromium.*chrome-linux' \
  'WebKit' \
  'firefox' \
  'playwright' \
  '__playwright' \
  ; do
  pkill -f "$pattern" 2>/dev/null && echo "killed: $pattern" || true
done

echo "cleanup done"