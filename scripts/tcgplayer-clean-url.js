#!/usr/bin/env node
const { canonicalizeTcgplayerProductUrl } = require("./lib/tcgplayer-affiliate");

const input = process.argv[2];

if (!input) {
  console.error("Usage: node scripts/tcgplayer-clean-url.js '<tcgplayer-url>'");
  process.exit(1);
}

try {
  console.log(canonicalizeTcgplayerProductUrl(input));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
