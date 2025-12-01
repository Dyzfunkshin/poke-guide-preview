// js/utils.js — DOM and string utilities (line-by-line, 'why' first)

// Provide a tiny helper to query a single element within an optional root. Why: avoids repeating (root||document).
export function $(root, sel){ 
  // Use root if provided, otherwise default to document for global queries.
  return (root || document).querySelector(sel); 
}

// Provide a helper to query multiple elements as a real array. Why: NodeList lacks many Array methods.
export function $$(root, sel){ 
  // Spread-like conversion via Array.from so map/filter/etc. are available.
  return Array.from((root || document).querySelectorAll(sel)); 
}

// Convert human text into a URL/ID-safe slug. Why: stable, readable IDs for headings and anchors.
export function slugify(str){
  // Guarantee a string, lower-case, trimmed to avoid leading/trailing spaces.
  return String(str || '')
    // Lowercase for consistency across platforms.
    .toLowerCase()
    // Trim whitespace to normalize slug.
    .trim()
    // Remove quotes which add noise and can break URLs.
    .replace(/['"]/g,'')
    // Replace any non-alphanumeric sequence with a single hyphen to keep it URL-safe.
    .replace(/[^a-z0-9]+/g,'-')
    // Remove leading/trailing hyphens to avoid empty path segments.
    .replace(/^-+|-+$/g,'');
}

// Generate a unique DOM id based on a suggested base. Why: avoid collisions when headings repeat.
export function uniqueId(base){
  // Ensure a non-empty base; fall back to 'section' so the ID is never blank.
  const safe = base && String(base).trim() ? String(base).trim() : 'section';
  // If no element currently uses this id, return it directly for readability.
  if(!document.getElementById(safe)) return safe;
  // Otherwise, append a numeric suffix until we find an unused ID to guarantee uniqueness.
  let i=2; while(document.getElementById(safe+'-'+i)) i++;
  // Return the first available ID like 'base-2', 'base-3', etc.
  return safe+'-'+i;
}
