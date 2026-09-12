import chalk from "chalk";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function startSpinner(label = "berpikir") {
  let i = 0;
  process.stdout.write("\x1B[?25l"); // sembunyikan cursor
  const timer = setInterval(() => {
    const frame = chalk.hex("#F2A24C")(FRAMES[i]);
    process.stdout.write(`\r\x1B[K${frame} ${chalk.gray(label + "...")}`);
    i = (i + 1) % FRAMES.length;
  }, 80);
  return timer;
}

export function stopSpinner(timer) {
  clearInterval(timer);
  process.stdout.write("\r\x1B[K"); // bersihkan baris spinner
  process.stdout.write("\x1B[?25h"); // tampilkan lagi cursor
}
