#!/usr/bin/env bash
set -e

echo "== FawnZ Agent installer =="

if command -v termux-info >/dev/null 2>&1 || [ -n "$TERMUX_VERSION" ]; then
  echo "Termux detected, updating packages and installing Node.js..."
  pkg update -y
  pkg install -y nodejs git
else
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is not installed. Install Node.js 18+ first, then re-run this script."
    exit 1
  fi
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js 18 or newer is required. Installed version: $(node -v)"
  exit 1
fi

echo "Installing dependencies..."
npm install

echo "Linking the 'fawnz' command globally..."
npm link

echo
echo "Done. Run it by typing: fawnz"
