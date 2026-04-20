#!/usr/bin/env node
const { buildPokeGuideRedirectUrl } = require("./lib/tcgplayer-affiliate");

const input = process.argv[2];

if (!input) {
  console.error("Usage: node scripts/tcgplayer-build-redirect.js '<tcgplayer-url>'");
  process.exit(1);
}

try {
  console.log(buildPokeGuideRedirectUrl(input));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
