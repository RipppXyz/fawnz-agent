#!/usr/bin/env bash
set -euo pipefail

printf '\n== ZCode Codespaces update ==\n\n'

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed."
  exit 1
fi

npm cache verify >/dev/null 2>&1 || true
npm install -g @ripppxyz/zcode@latest --force
hash -r 2>/dev/null || true

echo
echo "Installed binary: $(command -v zcode || echo 'not found')"
echo "Installed version: $(zcode --version)"
