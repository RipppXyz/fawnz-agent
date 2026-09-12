#!/usr/bin/env bash
# Refresh ZCode ke versi terbaru.
# Jalankan dari dalam folder repo (cd zcodex-agent) sebelum eksekusi.
set -e

echo "== ZCode Agent updater =="

if [ ! -d ".git" ]; then
  echo "Bukan folder git repo. Jalankan script ini dari dalam folder hasil git clone."
  exit 1
fi

echo "Nyimpen perubahan lokal (kalau ada)..."
git stash push -u -m "auto-stash sebelum update" >/dev/null 2>&1 || true

echo "Narik perubahan terbaru dari origin..."
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git pull origin "$BRANCH"

echo "Update dependency..."
npm install

echo "Sambungin ulang perintah global 'zcode'..."
npm link

if git stash list | grep -q "auto-stash sebelum update"; then
  echo "Mengembalikan perubahan lokal tadi..."
  git stash pop || echo "Ada konflik saat stash pop, cek manual dengan 'git status'."
fi

echo
NEW_VERSION=$(node -p "require('./package.json').version")
echo "Selesai. ZCode sekarang di versi $NEW_VERSION."
echo "Jalankan dengan mengetik: zcode"
