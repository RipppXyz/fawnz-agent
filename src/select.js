import readline from "node:readline";
import chalk from "chalk";
import { ANSI, terminalSize, clipLine } from "./tui.js";

function codePoints(value) {
  return Array.from(value || "");
}

export function selectFromList(items, { message = "Select:", current = null, footerNote = null } = {}) {
  return new Promise((resolve) => {
    const values = [...new Set((items || []).map(String))];
    if (!values.length) return resolve(null);

    let query = "";
    let filtered = values;
    let index = Math.max(0, values.indexOf(current));
    let offset = 0;
    let done = false;

    const wasRaw = Boolean(process.stdin.isRaw);
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    function pageSize() {
      const { rows } = terminalSize();
      return Math.max(3, Math.min(10, rows - 8));
    }

    function recompute(resetSelection = false) {
      const q = query.toLowerCase();
      filtered = q ? values.filter((item) => item.toLowerCase().includes(q)) : values;
      if (resetSelection) index = 0;
      else if (filtered.length) index = Math.min(index, filtered.length - 1);
      else index = 0;
      const size = pageSize();
      offset = Math.max(0, Math.min(offset, Math.max(0, filtered.length - size)));
      if (index < offset) offset = index;
      if (index >= offset + size) offset = index - size + 1;
    }

    function move(delta) {
      if (!filtered.length) return;
      index = (index + delta + filtered.length) % filtered.length;
      const size = pageSize();
      if (index < offset) offset = index;
      if (index >= offset + size) offset = index - size + 1;
    }

    function cleanup() {
      if (done) return;
      done = true;
      process.stdin.removeListener("keypress", onKeypress);
      process.removeListener("SIGWINCH", onResize);
      if (!wasRaw && process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdout.write(ANSI.showCursor);
    }

    function finish(value) {
      cleanup();
      resolve(value ?? null);
    }

    function render() {
      if (done) return;
      const { cols, rows } = terminalSize();
      const size = pageSize();
      if (index >= filtered.length && filtered.length) index = filtered.length - 1;
      offset = Math.min(offset, Math.max(0, filtered.length - size));

      const visible = filtered.slice(offset, offset + size);
      const lines = [
        chalk.bold.hex("#F2A24C")("FawnZ") + chalk.gray(" · model picker"),
        "",
        chalk.white(message) + " " + chalk.hex("#F2A24C")(query) + chalk.gray("▏"),
        "",
      ];

      for (let i = 0; i < size; i += 1) {
        const item = visible[i];
        if (item === undefined) {
          lines.push("");
          continue;
        }
        const realIndex = offset + i;
        const selected = realIndex === index;
        const marker = selected ? chalk.hex("#F2A24C")("❯ ") : "  ";
        const name = selected ? chalk.bold.white(item) : chalk.gray(item);
        lines.push(`${marker}${name}`);
      }

      lines.push("");
      if (filtered.length) {
        lines.push(chalk.gray(`${index + 1}/${filtered.length} · ↑↓ move · type to search · Enter select · Esc cancel`));
      } else {
        lines.push(chalk.red("No matching models · Esc cancel"));
      }
      if (footerNote) lines.push(chalk.gray(footerNote));

      const frameRows = rows - 1;
      let out = ANSI.syncBegin + ANSI.clear;
      for (let row = 0; row < frameRows; row += 1) {
        out += `\x1b[${row + 1};1H${clipLine(lines[row] || "", cols)}${ANSI.eraseLine}`;
      }
      out += `\x1b[${rows};1H${clipLine(chalk.gray("Esc cancel · Enter select · ↑↓ navigate"), cols)}`;
      out += ANSI.hideCursor + ANSI.syncEnd;
      process.stdout.write(out);
    }

    function onResize() {
      recompute();
      render();
    }

    function onKeypress(str, key = {}) {
      if (done) return;
      if (key.ctrl && key.name === "c") return finish(null);
      if (key.name === "return") return finish(filtered[index] ?? null);
      if (key.name === "escape") {
        if (query) {
          query = "";
          recompute(true);
          render();
        } else finish(null);
        return;
      }
      if (key.name === "up") return (move(-1), render());
      if (key.name === "down") return (move(1), render());
      if (key.name === "pageup") return (move(-pageSize()), render());
      if (key.name === "pagedown") return (move(pageSize()), render());
      if (key.name === "home") {
        index = 0;
        offset = 0;
        return render();
      }
      if (key.name === "end") {
        index = Math.max(0, filtered.length - 1);
        offset = Math.max(0, index - pageSize() + 1);
        return render();
      }
      if (key.name === "backspace") {
        query = codePoints(query).slice(0, -1).join("");
        recompute(true);
        return render();
      }
      if (str && !key.ctrl && !key.meta && str >= " ") {
        query += str;
        recompute(true);
        render();
      }
    }

    process.stdin.on("keypress", onKeypress);
    process.on("SIGWINCH", onResize);
    render();
  });
}
