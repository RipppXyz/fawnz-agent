import readline from "node:readline";
import { COMMANDS } from "./ui.js";

const MAX_MENU_ITEMS = 8;

function chars(value) {
  return Array.from(value ?? "");
}

function insertAt(value, cursor, text) {
  const list = chars(value);
  const addition = chars(text);
  list.splice(cursor, 0, ...addition);
  return { value: list.join(""), cursor: cursor + addition.length };
}

function deleteBefore(value, cursor) {
  const list = chars(value);
  if (cursor <= 0) return { value, cursor };
  list.splice(cursor - 1, 1);
  return { value: list.join(""), cursor: cursor - 1 };
}

function deleteAt(value, cursor) {
  const list = chars(value);
  if (cursor >= list.length) return { value, cursor };
  list.splice(cursor, 1);
  return { value: list.join(""), cursor };
}

export function promptInput({
  promptLabel,
  history = [],
  renderFrame = null,
  statusText = "Enter to send · ↑↓ history · / commands · Ctrl+C quit",
}) {
  return new Promise((resolve) => {
    let line = "";
    let cursor = 0;
    let histIndex = history.length;
    let draft = "";
    let menuOpen = false;
    let menuIndex = 0;
    let filtered = [];
    let closed = false;

    const wasRaw = Boolean(process.stdin.isRaw);
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    function computeMenu() {
      const commandPrefix = line.startsWith("/") && !line.includes(" ") && !line.includes("\t");
      if (!commandPrefix) {
        filtered = [];
        menuOpen = false;
        menuIndex = 0;
        return;
      }

      const query = line.slice(1).toLowerCase();
      filtered = COMMANDS.filter((command) => command.name.slice(1).toLowerCase().startsWith(query));
      menuOpen = filtered.length > 0;
      if (menuIndex >= filtered.length) menuIndex = Math.max(0, filtered.length - 1);
    }

    function cleanup() {
      if (closed) return;
      closed = true;
      process.stdin.removeListener("keypress", onKeypress);
      process.removeListener("SIGWINCH", onResize);
      if (!wasRaw && process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdout.write("\x1b[?25h");
    }

    function render() {
      if (closed) return;
      renderFrame?.({
        input: line,
        cursor,
        promptLabel,
        menuOpen,
        menuIndex,
        filtered,
        maxMenuItems: MAX_MENU_ITEMS,
        statusText,
      });
    }

    function chooseCommand() {
      const picked = filtered[menuIndex];
      if (!picked) return;
      line = `${picked.name} `;
      cursor = chars(line).length;
      menuOpen = false;
      filtered = [];
      menuIndex = 0;
      render();
    }

    function submit() {
      const value = line;
      cleanup();
      resolve(value);
    }

    function historyUp() {
      if (histIndex === history.length) draft = line;
      if (histIndex > 0) histIndex -= 1;
      line = history[histIndex] ?? "";
      cursor = chars(line).length;
      computeMenu();
      render();
    }

    function historyDown() {
      if (histIndex < history.length) histIndex += 1;
      line = histIndex === history.length ? draft : history[histIndex] ?? "";
      cursor = chars(line).length;
      computeMenu();
      render();
    }

    function onResize() {
      render();
    }

    function onKeypress(str, key = {}) {
      if (closed) return;

      if (key.ctrl && key.name === "c") {
        cleanup();
        resolve(null);
        return;
      }

      if (key.ctrl && key.name === "d") {
        cleanup();
        resolve(null);
        return;
      }

      if (key.name === "return") {
        if (menuOpen && filtered[menuIndex] && line.trim() !== filtered[menuIndex].name) {
          chooseCommand();
        } else {
          submit();
        }
        return;
      }

      if (key.name === "tab") {
        if (menuOpen) chooseCommand();
        return;
      }

      if (key.name === "escape") {
        if (menuOpen) {
          menuOpen = false;
          render();
        }
        return;
      }

      if (key.name === "up") {
        if (menuOpen) {
          menuIndex = (menuIndex - 1 + filtered.length) % filtered.length;
          render();
        } else {
          historyUp();
        }
        return;
      }

      if (key.name === "down") {
        if (menuOpen) {
          menuIndex = (menuIndex + 1) % filtered.length;
          render();
        } else {
          historyDown();
        }
        return;
      }

      if (key.name === "left") {
        cursor = Math.max(0, cursor - 1);
        render();
        return;
      }

      if (key.name === "right") {
        cursor = Math.min(chars(line).length, cursor + 1);
        render();
        return;
      }

      if (key.name === "home") {
        cursor = 0;
        render();
        return;
      }

      if (key.name === "end") {
        cursor = chars(line).length;
        render();
        return;
      }

      if (key.name === "backspace") {
        ({ value: line, cursor } = deleteBefore(line, cursor));
        computeMenu();
        render();
        return;
      }

      if (key.name === "delete") {
        ({ value: line, cursor } = deleteAt(line, cursor));
        computeMenu();
        render();
        return;
      }

      // Ctrl+L: redraw without changing the input state.
      if (key.ctrl && key.name === "l") {
        render();
        return;
      }

      if (str && !key.ctrl && !key.meta && str >= " ") {
        ({ value: line, cursor } = insertAt(line, cursor, str));
        computeMenu();
        render();
      }
    }

    process.stdin.on("keypress", onKeypress);
    process.on("SIGWINCH", onResize);
    computeMenu();
    render();

  });
}
