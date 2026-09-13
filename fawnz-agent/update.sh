#!/usr/bin/env bash
# Update FawnZ Agent to the latest version.
# Run this from inside the cloned repo folder before executing.
set -e

echo "== FawnZ Agent updater =="

if [ ! -d ".git" ]; then
  echo "This isn't a git repo folder. Run this script from inside your git clone."
  exit 1
fi

echo "Stashing local changes (if any)..."
git stash push -u -m "auto-stash before update" >/dev/null 2>&1 || true

echo "Pulling the latest changes from origin..."
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git pull origin "$BRANCH"

echo "Updating dependencies..."
npm install

echo "Re-linking the global 'fawnz' command..."
npm link

if git stash list | grep -q "auto-stash before update"; then
  echo "Restoring your local changes..."
  git stash pop || echo "There was a conflict restoring the stash — check 'git status' manually."
fi

echo
NEW_VERSION=$(node -p "require('./package.json').version")
echo "Done. FawnZ is now on version $NEW_VERSION."
echo "Run it by typing: fawnz"
