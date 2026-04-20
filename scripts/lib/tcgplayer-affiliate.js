const IMPACT_BASE_URL = "https://partner.tcgplayer.com/c/7099234/1830156/21018";
const ALLOWED_HOSTS = new Set([
  "www.tcgplayer.com",
  "tcgplayer.com"
]);

function normalizeInputUrl(input) {
  if (typeof input !== "string" || !input.trim()) {
    throw new Error("A TCGPlayer URL is required.");
  }

  const trimmed = input.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
}

function canonicalizeTcgplayerProductUrl(input) {
  const url = new URL(normalizeInputUrl(input));
  const host = url.hostname.toLowerCase();

  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error("URL must use tcgplayer.com.");
  }

  const pathMatch = url.pathname.match(/^\/product\/(\d+)(?:\/([^/?#]+))?\/?$/i);
  if (!pathMatch) {
    throw new Error("URL must be a TCGPlayer product page (/product/{id}/...).");
  }

  const [, productId, slug] = pathMatch;
  const canonicalPath = slug ? `/product/${productId}/${slug}` : `/product/${productId}`;
  return `https://www.tcgplayer.com${canonicalPath}`;
}

function buildPokeGuideRedirectUrl(input, redirectBase = "https://poke-guide.com/go/tcgplayer") {
  const canonicalProductUrl = canonicalizeTcgplayerProductUrl(input);
  const redirectUrl = new URL(redirectBase);
  redirectUrl.searchParams.set("url", canonicalProductUrl);
  return redirectUrl.toString();
}

function buildImpactAffiliateUrl(input) {
  const canonicalProductUrl = canonicalizeTcgplayerProductUrl(input);
  const affiliateUrl = new URL(IMPACT_BASE_URL);
  affiliateUrl.searchParams.set("u", canonicalProductUrl);
  return affiliateUrl.toString();
}

module.exports = {
  IMPACT_BASE_URL,
  ALLOWED_HOSTS,
  canonicalizeTcgplayerProductUrl,
  buildPokeGuideRedirectUrl,
  buildImpactAffiliateUrl
};
