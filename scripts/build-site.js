const fs = require("node:fs/promises");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
const PRELOADED_SECTIONS_TEMPLATE_ID = "preloaded-sections";

const sectionsToLoad = [
  "content/welcome.html",
  "content/identify.html",
  "content/condition.html",
  "content/card-care.html",
  "content/worth.html",
  "content/tracking.html",
  "content/grading.html",
  "content/errors.html",
  "content/shipping.html",
  "content/contact.html",
  "content/support.html"
];

const INCLUDE_PLACEHOLDER_PATTERN =
  /<([a-z0-9-]+)\b[^>]*\bdata-include="([^"]+)"[^>]*>\s*<\/\1>/gi;
const VERSION_FILE = "version.json";

function toPosix(relPath) {
  return relPath.split(path.sep).join("/");
}

function parseTarget() {
  const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
  const target = targetArg ? targetArg.slice("--target=".length) : "production";
  if (target !== "production" && target !== "preview") {
    throw new Error(`Invalid --target value "${target}". Use "production" or "preview".`);
  }
  return target;
}

function getOutputDir(target) {
  return target === "preview"
    ? path.join(REPO_ROOT, "_site_preview")
    : path.join(REPO_ROOT, "_site_production");
}

function shouldExclude(relPath, target) {
  if (!relPath) return false;
  const normalized = toPosix(relPath);
  const top = normalized.split("/")[0];

  if (
    top === ".git" ||
    top === ".github" ||
    top === "node_modules" ||
    top === "_site" ||
    top === "_site_preview" ||
    top === "_site_production"
  ) {
    return true;
  }
  if (top.startsWith(".git")) return true;
  if (top === "test-results") return true;
  if (target === "preview" && normalized === "CNAME") return true;

  return false;
}

async function copyTree(srcDir, destDir, target) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const relPath = path.relative(REPO_ROOT, srcPath);
    if (shouldExclude(relPath, target)) continue;

    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyTree(srcPath, destPath, target);
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function makeWritableRecursive(targetPath) {
  let stats;
  try {
    stats = await fs.lstat(targetPath);
  } catch {
    return;
  }

  if (stats.isDirectory()) {
    const children = await fs.readdir(targetPath);
    for (const child of children) {
      await makeWritableRecursive(path.join(targetPath, child));
    }
    await fs.chmod(targetPath, 0o777).catch(() => {});
    return;
  }

  await fs.chmod(targetPath, 0o666).catch(() => {});
}

async function resetOutputDir(outputDir) {
  try {
    await fs.rm(outputDir, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "EPERM") {
      throw error;
    }
    await makeWritableRecursive(outputDir);
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (retryError) {
      if (retryError?.code !== "EPERM") {
        throw retryError;
      }
      console.warn(
        `Warning: could not fully clean ${path.basename(outputDir)} due to file locks; reusing directory.`
      );
      await fs.mkdir(outputDir, { recursive: true });
      return;
    }
  }

  await fs.mkdir(outputDir, { recursive: true });
}

function resolveIncludePath(src, currentDir) {
  let candidate;

  if (src.startsWith("./") || src.startsWith("../")) {
    candidate = path.resolve(currentDir, src);
  } else if (src.startsWith("/")) {
    candidate = path.join(REPO_ROOT, src.slice(1));
  } else {
    candidate = path.join(REPO_ROOT, src);
  }

  const normalizedRepo = path.resolve(REPO_ROOT);
  const normalizedCandidate = path.resolve(candidate);
  if (
    normalizedCandidate !== normalizedRepo &&
    !normalizedCandidate.startsWith(`${normalizedRepo}${path.sep}`)
  ) {
    throw new Error(`Include path escapes repository root: ${src}`);
  }

  return normalizedCandidate;
}

async function resolveIncludesInHtml(html, currentDir, stack = []) {
  const includeRegex = new RegExp(INCLUDE_PLACEHOLDER_PATTERN.source, "gi");
  let result = "";
  let cursor = 0;
  let match;

  while ((match = includeRegex.exec(html)) !== null) {
    result += html.slice(cursor, match.index);
    cursor = includeRegex.lastIndex;

    const includeSrc = match[2].trim();
    const includePath = resolveIncludePath(includeSrc, currentDir);

    if (stack.includes(includePath)) {
      const loop = [...stack, includePath].map((entry) => path.relative(REPO_ROOT, entry));
      throw new Error(`Circular data-include chain detected: ${loop.join(" -> ")}`);
    }

    let includeHtml;
    try {
      includeHtml = await fs.readFile(includePath, "utf8");
    } catch (error) {
      throw new Error(`Failed to read data-include "${includeSrc}": ${error.message}`);
    }

    const resolvedInclude = await resolveIncludesInHtml(includeHtml, path.dirname(includePath), [
      ...stack,
      includePath
    ]);

    result += resolvedInclude.trim();
  }

  result += html.slice(cursor);
  return result;
}

async function buildSectionsHtml() {
  const renderedSections = [];

  for (const sectionFile of sectionsToLoad) {
    const sectionPath = path.join(REPO_ROOT, sectionFile);
    const sectionHtml = await fs.readFile(sectionPath, "utf8");
    const resolved = await resolveIncludesInHtml(sectionHtml, path.dirname(sectionPath), [sectionPath]);
    renderedSections.push(resolved.trim());
  }

  return renderedSections.join("\n\n");
}

async function injectPreloadedSections(sectionsHtml, outputDir) {
  const indexPath = path.join(outputDir, "index.html");
  const templateBlock =
    `\n  <template id="${PRELOADED_SECTIONS_TEMPLATE_ID}">\n${sectionsHtml}\n  </template>\n\n`;

  let indexHtml = await fs.readFile(indexPath, "utf8");
  indexHtml = indexHtml.replace(
    new RegExp(`<template id="${PRELOADED_SECTIONS_TEMPLATE_ID}">[\\s\\S]*?<\\/template>\\s*`, "g"),
    ""
  );

  if (indexHtml.includes('<script src="script.js"></script>')) {
    indexHtml = indexHtml.replace('<script src="script.js"></script>', `${templateBlock}  <script src="script.js"></script>`);
  } else if (indexHtml.includes("</body>")) {
    indexHtml = indexHtml.replace("</body>", `${templateBlock}</body>`);
  } else {
    throw new Error("Could not find insertion point for preloaded sections in index.html");
  }

  await fs.writeFile(indexPath, indexHtml, "utf8");
}

async function getAssetVersionToken(outputDir) {
  try {
    const versionPath = path.join(outputDir, VERSION_FILE);
    const raw = await fs.readFile(versionPath, "utf8");
    const data = JSON.parse(raw);

    const parts = [];
    if (typeof data.version === "string" && data.version) {
      parts.push(data.version.trim());
    }
    if (typeof data.commit === "string" && data.commit) {
      parts.push(data.commit.trim());
    }

    if (!parts.length && typeof data.generatedAt === "string" && data.generatedAt) {
      parts.push(data.generatedAt.replace(/[^0-9]/g, "").slice(0, 14));
    }

    return parts.filter(Boolean).join("-");
  } catch {
    return "";
  }
}

async function injectAssetVersioning(outputDir) {
  const versionToken = await getAssetVersionToken(outputDir);
  if (!versionToken) return;

  const indexPath = path.join(outputDir, "index.html");
  let indexHtml = await fs.readFile(indexPath, "utf8");

  const versionedAssets = [
    "styles/base.css",
    "styles/nav.css",
    "styles/layout.css",
    "script.js"
  ];

  for (const assetPath of versionedAssets) {
    const escapedPath = assetPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(["'])(${escapedPath})(\\?[^"']*)?\\1`, "g");
    indexHtml = indexHtml.replace(pattern, `$1${assetPath}?v=${versionToken}$1`);
  }

  await fs.writeFile(indexPath, indexHtml, "utf8");
}

async function main() {
  const target = parseTarget();
  const outputDir = getOutputDir(target);

  await resetOutputDir(outputDir);
  await copyTree(REPO_ROOT, outputDir, target);

  const sectionsHtml = await buildSectionsHtml();
  await injectPreloadedSections(sectionsHtml, outputDir);
  await injectAssetVersioning(outputDir);

  console.log(`Built ${path.basename(outputDir)} for ${target} with preloaded sections.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
