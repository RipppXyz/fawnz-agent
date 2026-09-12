import readline from "node:readline";
import chalk from "chalk";
import { COMMANDS, ACCENT } from "./ui.js";

const MAX_MENU_ITEMS = 8;

/**
 * Input baris tunggal custom (raw mode) dengan:
 *  - riwayat pesan sebelumnya (panah ↑↓, kayak shell)
 *  - menu autocomplete perintah "/" yang muncul otomatis begitu baris
 *    diawali "/" dan belum ada spasi — mirip command palette Claude Code
 *
 * Enter / Tab saat menu terbuka & belum persis cocok -> lengkapi baris
 * dengan perintah yang di-highlight (tidak langsung submit).
 * Enter saat menu tertutup atau sudah persis cocok -> submit baris.
 */
export function promptInput({ promptLabel, history = [] }) {
  return new Promise((resolve) => {
    let line = "";
    let cursor = 0;
    let histIndex = history.length;
    let draft = "";

    let menuOpen = false;
    let menuIndex = 0;
    let filtered = [];
    let prevMenuLines = 0;

    const wasRaw = Boolean(process.stdin.isRaw);
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    // Sama seperti di select.js: paksa stdin balik ke flowing mode kalau
    // sebelumnya sempat di-pause oleh readline.Interface yang ditutup
    // (rl.close() di setup.js) — tanpa ini, prompt bisa diam-diam gak
    // pernah nerima input dan proses keluar sendiri.
    process.stdin.resume();

    function computeMenu() {
      if (line.startsWith("/") && !line.includes(" ")) {
        const q = line.slice(1).toLowerCase();
        filtered = COMMANDS.filter((c) => c.name.slice(1).toLowerCase().startsWith(q));
        menuOpen = filtered.length > 0;
        if (menuIndex >= filtered.length) menuIndex = 0;
      } else {
        menuOpen = false;
        filtered = [];
        menuIndex = 0;
      }
    }

    function formatRow(cmd, isSelected) {
      const marker = isSelected ? chalk.hex(ACCENT)("❯ ") : "  ";
      const name = isSelected ? chalk.bold.white(cmd.name) : chalk.cyan(cmd.name);
      const padded = name + " ".repeat(Math.max(1, 20 - cmd.name.length));
      return marker + padded + chalk.gray(cmd.desc);
    }

    function render() {
      process.stdout.write(`\r\x1B[K${promptLabel} ${line}`);
      process.stdout.write("\x1B[s"); // simpan posisi cursor (akhir teks input)

      let menuLines = 0;
      if (menuOpen) {
        const visible = filtered.slice(0, MAX_MENU_ITEMS);
        for (let i = 0; i < visible.length; i++) {
          process.stdout.write("\n\r\x1B[K" + formatRow(visible[i], i === menuIndex));
          menuLines++;
        }
        if (filtered.length > MAX_MENU_ITEMS) {
          process.stdout.write(
            "\n\r\x1B[K" + chalk.gray(`  … ${filtered.length - MAX_MENU_ITEMS} lagi, terus ngetik untuk nyaring`)
          );
          menuLines++;
        }
      }

      const linesToClear = Math.max(0, prevMenuLines - menuLines);
      for (let i = 0; i < linesToClear; i++) {
        process.stdout.write("\n\r\x1B[K");
      }
      prevMenuLines = menuLines;

      process.stdout.write("\x1B[u"); // balik ke akhir teks input
      const back = line.length - cursor;
      if (back > 0) process.stdout.write(`\x1B[${back}D`);
    }

    function finishLine(extraLinesBelow) {
      // pindah ke bawah semua baris menu supaya output berikutnya tidak menimpa
      if (extraLinesBelow > 0) {
        process.stdout.write(`\x1B[${extraLinesBelow}B`);
      }
      process.stdout.write("\n");
    }

    function cleanup() {
      process.stdin.removeListener("keypress", onKeypress);
      if (!wasRaw && process.stdin.isTTY) process.stdin.setRawMode(false);
    }

    function acceptHighlighted() {
      const picked = filtered[menuIndex];
      if (!picked) return;
      line = picked.name + " ";
      cursor = line.length;
      computeMenu();
      render();
    }

    function onKeypress(str, key = {}) {
      if (key.ctrl && key.name === "c") {
        cleanup();
        finishLine(prevMenuLines);
        console.log(chalk.gray("Sampai jumpa.\n"));
        process.exit(0);
      }

      if (key.name === "return") {
        if (menuOpen && filtered[menuIndex] && line.trim() !== filtered[menuIndex].name) {
          acceptHighlighted();
          return;
        }
        const linesBelow = prevMenuLines;
        menuOpen = false;
        filtered = [];
        prevMenuLines = 0;
        cleanup();
        finishLine(linesBelow);
        resolve(line);
        return;
      }

      if (key.name === "tab") {
        if (menuOpen) acceptHighlighted();
        return;
      }

      if (key.name === "escape") {
        if (menuOpen) {
          menuOpen = false;
          filtered = [];
          render();
        }
        return;
      }

      if (key.name === "up") {
        if (menuOpen) {
          menuIndex = (menuIndex - 1 + filtered.length) % filtered.length;
        } else if (histIndex > 0) {
          if (histIndex === history.length) draft = line;
          histIndex--;
          line = history[histIndex] ?? "";
          cursor = line.length;
        }
        render();
        return;
      }

      if (key.name === "down") {
        if (menuOpen) {
          menuIndex = (menuIndex + 1) % filtered.length;
        } else if (histIndex < history.length) {
          histIndex++;
          line = histIndex === history.length ? draft : history[histIndex];
          cursor = line.length;
        }
        render();
        return;
      }

      if (key.name === "left") {
        if (cursor > 0) cursor--;
        render();
        return;
      }

      if (key.name === "right") {
        if (cursor < line.length) cursor++;
        render();
        return;
      }

      if (key.name === "home") {
        cursor = 0;
        render();
        return;
      }

      if (key.name === "end") {
        cursor = line.length;
        render();
        return;
      }

      if (key.name === "backspace") {
        if (cursor > 0) {
          line = line.slice(0, cursor - 1) + line.slice(cursor);
          cursor--;
        }
        computeMenu();
        render();
        return;
      }

      if (key.name === "delete") {
        line = line.slice(0, cursor) + line.slice(cursor + 1);
        computeMenu();
        render();
        return;
      }

      if (str && !key.ctrl && !key.meta && str.length >= 1 && str >= " ") {
        line = line.slice(0, cursor) + str + line.slice(cursor);
        cursor += str.length;
        computeMenu();
        render();
      }
    }

    process.stdin.on("keypress", onKeypress);
    render();
  });
}
