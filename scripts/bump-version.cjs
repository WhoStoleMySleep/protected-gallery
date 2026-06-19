const fs = require("fs");
const { execSync } = require("child_process");

const msgFile = process.argv[2];

if (!msgFile || !fs.existsSync(msgFile)) {
  process.exit(0);
}

const message = fs.readFileSync(msgFile, "utf8");
const firstLine = message.split("\n")[0].trim();

// Игнорируем merge-коммиты, ревёрты без формата, пустые сообщения и т.д.
const match = firstLine.match(/^(\w+)(\(.+\))?(!)?:/);
if (!match) {
  process.exit(0);
}

const type = match[1];
const isBreakingBang = !!match[3];
const isBreakingBody = /BREAKING CHANGE:/.test(message);
const isBreaking = isBreakingBang || isBreakingBody;

let bump = null;
if (isBreaking) bump = "major";
else if (type === "feat") bump = "minor";
else if (type === "fix" || type === "perf") bump = "patch";

if (!bump) {
  process.exit(0);
}

try {
  execSync(`npm version ${bump} --no-git-tag-version --no-commit-hooks`, {
    stdio: "inherit",
  });
} catch (err) {
  console.error("✗ Не удалось бампнуть версию:", err.message);
  process.exit(1);
}

const filesToAdd = [
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
].filter((f) => fs.existsSync(f));

if (filesToAdd.length) {
  execSync(`git add ${filesToAdd.join(" ")}`, { stdio: "inherit" });
}

console.log(`✓ Версия бампнута: ${bump}`);
