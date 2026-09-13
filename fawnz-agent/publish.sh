#!/usr/bin/env bash
set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required."
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
PACKAGE="$(node -p "require('./package.json').name")"

npm whoami >/dev/null
npm test
npm publish --access public

echo "Published ${PACKAGE}@${VERSION}."
echo "Verify with: npm view ${PACKAGE} version"
