const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const packageJson = require("../package.json");

function getEnvCommit() {
  const sha = process.env.GITHUB_SHA || process.env.COMMIT_SHA;
  if (!sha || typeof sha !== "string") return null;
  return sha.slice(0, 7);
}

function getCommit() {
  const envCommit = getEnvCommit();
  if (envCommit) return envCommit;

  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"]
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

const payload = {
  version: packageJson.version,
  commit: getCommit(),
  generatedAt: new Date().toISOString()
};

const outputPath = path.join(__dirname, "..", "version.json");
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
console.log(`Wrote version info to ${outputPath}`);
