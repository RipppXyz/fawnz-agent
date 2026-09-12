#!/usr/bin/env bash
set -e

echo "== ZCode Agent installer =="

if command -v termux-info >/dev/null 2>&1 || [ -n "$TERMUX_VERSION" ]; then
  echo "Termux terdeteksi, update paket dan pasang Node.js..."
  pkg update -y
  pkg install -y nodejs git
else
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js belum terpasang. Pasang Node.js 18+ dulu, lalu jalankan ulang script ini."
    exit 1
  fi
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Butuh Node.js versi 18 ke atas. Versi terpasang: $(node -v)"
  exit 1
fi

echo "Memasang dependency..."
npm install

echo "Memasang zcode secara global..."
npm link

echo
echo "Selesai. Jalankan dengan mengetik: zcode"
