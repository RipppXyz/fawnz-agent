import readline from "node:readline";
import chalk from "chalk";

const PAGE_SIZE = 10;

/**
 * Tampilkan daftar pilihan yang bisa dinavigasi dengan tombol panah
 * (naik/turun) dan disaring dengan mengetik. Enter untuk pilih,
 * Esc untuk batal (atau untuk mengosongkan pencarian dulu kalau
 * sedang mengetik).
 *
 * Mengembalikan item yang dipilih, atau null kalau dibatalkan.
 */
export function selectFromList(items, { message = "Pick:", current = null, footerNote = null } = {}) {
  return new Promise((resolve) => {
    if (!items || items.length === 0) {
      resolve(null);
      return;
    }

    let query = "";
    let filtered = items;
    let index = Math.max(0, items.indexOf(current));
    let offset = 0;
    let firstRender = true;

    const wasRaw = Boolean(process.stdin.isRaw);
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    // Kalau sebelumnya ada readline.Interface (mis. rl.question di setup.js)
    // yang ditutup dengan rl.close(), Node meninggalkan stdin dalam kondisi
    // "paused" — keypress gak akan pernah masuk lagi walau listener sudah
    // dipasang & raw mode sudah aktif, dan proses bisa exit diam-diam karena
    // event loop dianggap kosong. resume() paksa stream balik ke flowing mode.
    process.stdin.resume();

    function recompute() {
      filtered = query
        ? items.filter((it) => it.toLowerCase().includes(query.toLowerCase()))
        : items;
      index = 0;
      offset = 0;
    }

    function move(delta) {
      if (filtered.length === 0) return;
      index = (index + delta + filtered.length) % filtered.length;
      if (index < offset) offset = index;
      if (index >= offset + PAGE_SIZE) offset = index - PAGE_SIZE + 1;
    }

    function render() {
      const lines = [];
      lines.push(
        `${chalk.gray(message)} ${chalk.hex("#F2A24C")(query)}${chalk.gray("│")}`
      );

      const visible = filtered.slice(offset, offset + PAGE_SIZE);
      for (let i = 0; i < PAGE_SIZE; i++) {
        const item = visible[i];
        if (item === undefined) {
          lines.push("");
          continue;
        }
        const realIndex = offset + i;
        const isSelected = realIndex === index;
        const marker = isSelected ? chalk.hex("#F2A24C")("❯ ") : "  ";
        const label = isSelected ? chalk.bold.white(item) : chalk.gray(item);
        lines.push(marker + label);
      }

      lines.push(
        filtered.length === 0
          ? chalk.red("no matching model")
          : chalk.gray(
              `${index + 1}/${filtered.length} · ↑↓ move · type to search · Enter pick · Esc cancel`
            )
      );
      if (footerNote) lines.push(chalk.gray(`  ${footerNote}`));

      if (!firstRender) {
        process.stdout.write(`\x1B[${lines.length}A`);
      }
      firstRender = false;

      for (const line of lines) {
        process.stdout.write(`\r\x1B[K${line}\n`);
      }
    }

    function cleanup() {
      process.stdin.removeListener("keypress", onKeypress);
      if (!wasRaw && process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdout.write("\x1B[?25h");
    }

    function onKeypress(str, key = {}) {
      if (key.ctrl && key.name === "c") {
        cleanup();
        resolve(null);
        return;
      }
      if (key.name === "return") {
        cleanup();
        resolve(filtered[index] ?? null);
        return;
      }
      if (key.name === "escape") {
        if (query) {
          query = "";
          recompute();
          render();
        } else {
          cleanup();
          resolve(null);
        }
        return;
      }
      if (key.name === "up") {
        move(-1);
        render();
        return;
      }
      if (key.name === "down") {
        move(1);
        render();
        return;
      }
      if (key.name === "backspace") {
        query = query.slice(0, -1);
        recompute();
        render();
        return;
      }
      if (str && !key.ctrl && !key.meta && str.length === 1 && str >= " ") {
        query += str;
        recompute();
        render();
      }
    }

    process.stdin.on("keypress", onKeypress);
    render();
  });
}
