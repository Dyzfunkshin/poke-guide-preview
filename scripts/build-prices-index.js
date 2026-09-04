#!/usr/bin/env node
// Builds a lightweight index of per-set price summaries (no daily series) so the
// prices page can list all sets without downloading each set's full history file.
// Run manually after the data/prices/sets tree is (re)generated:
//   node scripts/build-prices-index.js
"use strict";

const fs = require("fs");
const path = require("path");

const SETS_DIR = path.join(__dirname, "..", "data", "prices", "sets");
const OUT_FILE = path.join(SETS_DIR, "index.json");

const SUMMARY_FIELDS = [
  "slug",
  "setName",
  "label",
  "setCode",
  "setKind",
  "releaseDate",
  "eraKey",
  "eraLabel",
  "isVintage",
  "totalCents",
  "changeCents",
  "changePct",
  "window",
  "cardCount",
  "priceableCardCount",
  "pricedCount",
  "sealedCount",
  "isFloor",
  "coverageFloorRatio",
  "coverageNote",
  "asOf",
  "totalAsOf",
  "referenceCents",
  "referenceDate",
  "publishedDays"
];

function buildIndex() {
  const files = fs
    .readdirSync(SETS_DIR)
    .filter((name) => name.endsWith(".json") && name !== "index.json");

  const sets = files.map((file) => {
    const raw = fs.readFileSync(path.join(SETS_DIR, file), "utf8");
    const data = JSON.parse(raw);
    const summary = {};
    for (const field of SUMMARY_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        summary[field] = data[field];
      }
    }
    if (!summary.slug) {
      summary.slug = file.replace(/\.json$/, "");
    }
    return summary;
  });

  sets.sort((a, b) => (a.releaseDate || "").localeCompare(b.releaseDate || ""));

  fs.writeFileSync(OUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), sets }));
  console.log(`Wrote ${sets.length} set summaries to ${path.relative(process.cwd(), OUT_FILE)}`);
}

buildIndex();
