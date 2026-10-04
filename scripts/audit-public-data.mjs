import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const allowedEmailPatterns = [
  /https?:\/\//i,
  /github\.com/i,
  /montecookgames\.com/i,
  /montecookgames\.com/i
];

const suspiciousPatterns = [
  /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|passwd|secret)\s*[:=]\s*["'][^"']+["']/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |PRIVATE) KEY-----/,
  /[A-Z]:\\Users\\[^\\]+\\/i,
  /(?:\/home|\/Users)\/[^/]+\//i,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
];

const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "test-results",
  "playwright-report"
]);

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function isTextBuffer(buffer) {
  return !buffer.includes(0);
}

const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "buffer"
}).toString("utf8").split("\0").filter(Boolean);

const findings = [];

for (const relativePath of tracked) {
  const fullPath = path.join(root, relativePath);
  let buffer;

  try {
    buffer = await fs.readFile(fullPath);
  } catch {
    continue;
  }

  if (!isTextBuffer(buffer)) continue;

  const content = buffer.toString("utf8");
  for (const pattern of suspiciousPatterns) {
    const match = content.match(pattern);
    if (!match) continue;

    if (pattern.source.includes("@") && allowedEmailPatterns.some(
      (allowed) => allowed.test(match[0])
    )) {
      continue;
    }

    findings.push(relativePath + ": suspicious public-data pattern");
    break;
  }
}

if (findings.length) {
  console.error("Public-data audit failed:");
  for (const finding of findings) console.error("- " + finding);
  process.exit(1);
}

console.log("Public-data audit passed: no obvious credentials or personal-data patterns found.");
