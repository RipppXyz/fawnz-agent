<div align="center">

# ZCode Agent

**Agen AI yang jalan di terminal kamu — tanpa lock-in ke satu model apapun.**

[![npm version](https://img.shields.io/npm/v/@ripppxyz/zcode.svg)](https://www.npmjs.com/package/@ripppxyz/zcode)
[![node](https://img.shields.io/node/v/@ripppxyz/zcode.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@ripppxyz/zcode.svg)](./LICENSE)

</div>

ZCode tidak punya model bawaan. Semua request diteruskan ke instance [9router](https://github.com/decocua/9router) milikmu, dan daftar model yang bisa dipakai selalu ditarik langsung dari router itu — bukan daftar hardcode di dalam kode ZCode. Ganti model kapan saja lewat `/model`, tanpa install ulang, tanpa restart, tanpa ubah satu baris kode pun.

```
╭──────────────────────────────────────────────────────────────────────────╮
│                          ZCode Agent  v2.0.2                             │
│                agen AI di terminal kamu, ditenagai 9router               │
├──────────────────────────────────────────────────────────────────────────┤
│  model   claude-sonnet-4-6                                               │
│  router  http://localhost:20128/v1                                      │
│  dir     ~/project                                                       │
╰──────────────────────────────────────────────────────────────────────────╯
  ketik pesan lalu Enter · / untuk daftar perintah
```

## Kenapa ZCode

- **Model-agnostic beneran** — ZCode gak nebak, gak ngunci, dan gak nyimpen daftar model apapun di kodenya. Semua ditarik live dari `/v1/models` router kamu.
- **Langsung masuk chat** — gak ada form Base URL/API key/model yang wajib diisi sebelum bisa ngobrol. Jalankan `zcode`, langsung kepakai. Belum ada model? Ketik pesan aja, menu pilihnya kebuka otomatis di tempat.
- **Ganti model tanpa turun mesin** — `/model` buka menu pilih, `/model <nama>` langsung pindah. Gak ada restart, gak ada reinstall.
- **Satu binary, semua platform** — Linux, macOS, dan Termux (Android) tanpa modifikasi kode.
- **Command palette ala Claude Code** — ketik `/` dan daftar perintah muncul, tersaring otomatis sambil kamu ngetik. Navigasi panah ↑↓, pilih dengan Tab/Enter.
- **Streaming asli** — balasan muncul token demi token, bukan nunggu selesai baru nongol.
- **Ringan** — cuma satu dependency (`chalk`). Gak ada bloat.

## Kenapa 9router jadi otak-nya

ZCode sendiri tidak menyimpan atau membatasi model apapun. Semua permintaan chat diteruskan ke instance 9router milikmu, yang mengurus provider mana yang dipakai, fallback saat rate limit, sampai model apa saja yang tersedia. ZCode fokus di sisi antarmuka terminal — urusan routing model diserahkan sepenuhnya ke 9router.

Belum punya instance 9router? Lihat [repo 9router](https://github.com/decocua/9router) — bisa di-self-host dan mendukung endpoint API kompatibel format OpenAI (`/v1/models`, `/v1/chat/completions`).

## Instalasi

### Lewat npm (paling gampang)

```bash
npm install -g @ripppxyz/zcode@latest
```

### Termux

```bash
pkg update && pkg install nodejs git -y
git clone https://github.com/RipppXyz/zcode-agent.git
cd zcode-agent
bash install.sh
```

### Linux / macOS (dari source)

Butuh Node.js 18 ke atas.

```bash
git clone https://github.com/RipppXyz/zcode-agent.git
cd zcode-agent
npm install
npm link
zcode
```

## Pemakaian

ZCode **tidak** menyuruh kamu isi form apapun sebelum bisa ngobrol. Jalankan `zcode`, dan kamu langsung masuk ke layar chat — sama saja baik ini run pertama kali atau yang ke-seratus.

Model **tidak** ditebak atau dihardcode. Kalau belum ada model diset, banner bakal nunjukin `belum diset — ketik /model`, dan begitu kamu ketik pesan pertama, ZCode otomatis buka menu pilih model dari 9router di tempat — pesan kamu langsung lanjut terkirim setelah model dipilih. Gak ada layar terpisah, gak ada jeda.

Base URL & API key router pakai default (`http://localhost:20128/v1`, tanpa API key) kalau kamu belum pernah atur. Mau ganti, pakai `/config` kapan saja di dalam chat, atau `zcode --config` dari terminal.

Hasil konfigurasi (base url, api key, model) disimpan di `~/.zcode/config.json`.

### Setup non-interaktif (automation / CI / Docker)

Isi tiga environment variable ini **sebelum** menjalankan `zcode` pertama kali:

```bash
export ZCODE_BASE_URL="https://router.punyaku.com"
export ZCODE_API_KEY="sk-xxxxxxxx"
export ZCODE_MODEL="nama-model-yang-valid-di-router-kamu"
zcode
```

Kalau `ZCODE_MODEL` tidak diisi, ZCode tetap membuka wizard interaktif — karena ZCode sengaja tidak punya nilai default untuk model.

### Perintah di dalam chat

Ketik `/` sendirian buat lihat menu semua perintah, tersaring otomatis sambil kamu ngetik lebih lanjut.

| Perintah | Fungsi |
|---|---|
| `/help` | tampilkan daftar perintah |
| `/model` | buka menu pilih model — navigasi panah ↑↓, atau ketik untuk menyaring |
| `/model <nama>` | langsung ganti ke model tertentu tanpa buka menu |
| `/models` | lihat daftar model dari router sebagai teks biasa |
| `/clear` | kosongkan riwayat percakapan saat ini |
| `/config` | ulangi setup (ganti api key / base url / model) |
| `/exit` atau `/quit` | keluar |

Kontrol lain saat mengetik:

- **↑ / ↓** — navigasi menu perintah (kalau lagi ketik `/...`), atau riwayat input sebelumnya (kalau baris kosong)
- **Tab / Enter** — pilih perintah yang di-highlight
- **Esc** — tutup menu perintah tanpa memilih

### Flag CLI

```bash
zcode --config     # buka wizard setup manual
zcode --version    # cek versi
zcode --help       # bantuan singkat
```

## Struktur proyek

```
zcode-agent/
├── bin/
│   └── zcode.js         # entry point
├── src/
│   ├── api.js            # komunikasi ke 9router (list model + streaming chat)
│   ├── chat.js           # loop chat utama
│   ├── config.js         # baca/tulis konfigurasi (tanpa model default)
│   ├── promptInput.js    # input baris + command palette "/" ala Claude Code
│   ├── select.js         # menu pilih model (panah + cari)
│   ├── setup.js          # wizard setup (dipakai first-run & /config)
│   ├── spinner.js        # animasi "berpikir"
│   └── ui.js             # banner, daftar perintah, styling terminal
├── install.sh
├── update.sh
└── package.json
```

## Update ke versi terbaru

Kalau kamu install lewat npm:

```bash
npm install -g @ripppxyz/zcode@latest
```

Kalau install dari git clone, **jangan** `git clone` ulang ke folder yang sama — bakal gagal dengan `destination path already exists` dan diam-diam tetap makai kode lama. Pakai `git pull`, atau jalankan `update.sh`:

```bash
cd zcode-agent
bash update.sh
```

`update.sh` otomatis: stash perubahan lokal (kalau ada) → `git pull` → `npm install` → `npm link` ulang → kembalikan stash tadi.

Clean install dari nol:

```bash
rm -rf zcode-agent
git clone https://github.com/RipppXyz/zcode-agent.git
cd zcode-agent
npm install
npm link
```

## Publish (buat maintainer)

```bash
npm login
cd zcode-agent
npm version patch   # atau minor/major — otomatis update package.json + git tag
npm publish --access public
```

`files` di `package.json` sudah membatasi apa saja yang ikut kepublish (`bin`, `src`, `install.sh`, `update.sh`, `README.md`, `LICENSE`) — jadi file kerja seperti arsip zip, catatan, atau folder percobaan gak akan pernah ikut ke tarball, apapun isi `.gitignore` kamu.

## Kontribusi

Pull request terbuka buat siapa saja. Beberapa ide yang masih terbuka:

- Multi-turn dengan riwayat percakapan yang bisa disimpan & dilanjutkan lewat file (`~/.zcode/history.json` sudah ada fungsi baca/tulisnya, tinggal disambungkan ke `chat.js`)
- Mode "agent" yang bisa eksekusi perintah shell dengan konfirmasi
- Tema warna yang bisa dikustomisasi lewat config

Kalau nemu bug atau ada ide fitur, buka issue saja.

## Lisensi

MIT — bebas dipakai, dimodifikasi, dan disebarluaskan.
