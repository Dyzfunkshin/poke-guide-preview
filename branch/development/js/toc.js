// js/toc.js — ToC builder + active state management; restores auto-centering scroll and the “old” visual structure.

// Import light DOM helpers and id utilities.
// Why: keep this module focused on ToC behavior rather than boilerplate.
import { $$, slugify, uniqueId } from './utils.js';

// Return the element that should actually scroll (the inner .nav).
// Why: the aside container itself should not scroll; only the ToC list should.
function getNavContainer(tocRoot) {
  // Prefer the .nav inside #toc; fallback to the tocRoot for safety.
  return tocRoot.querySelector('.nav') || tocRoot;
}

// Map deep heading ids (e.g., hidden H5) to the nearest visible id according to data-toc-depth.
// Why: when H5 is hidden from the ToC, ScrollSpy still needs to highlight its visible ancestor.
export function resolveTocTargetId(tocRoot, contentRoot, id) {
  // Read the configured depth (defaults to 4 = show H2..H4).
  let depth = Number(tocRoot?.dataset?.tocDepth || 4);

  // Guard against invalid values (avoid NaN).
  if (Number.isNaN(depth)) depth = 4;

  // Clamp to a valid range (2..5).
  depth = Math.min(5, Math.max(2, depth));

  // Track the most recent H2/H3/H4 ancestors while walking the DOM.
  let lastH2 = '';
  let lastH3 = '';
  let lastH4 = '';

  // Map from actual id → visible id.
  const map = new Map();

  // Visit headings in reading order to maintain correct ancestry.
  $$(contentRoot, 'h2, h3, h4, h5').forEach(h => {
    // Numeric level from tag name.
    const lvl = Number(h.tagName.slice(1));

    // Update ancestor trackers.
    if (lvl === 2) { lastH2 = h.id; lastH3 = ''; lastH4 = ''; }
    else if (lvl === 3) { lastH3 = h.id; lastH4 = ''; }
    else if (lvl === 4) { lastH4 = h.id; }

    // Default visible target is the heading itself.
    let vis = h.id;

    // If the level is deeper than what we show, resolve to the nearest visible ancestor.
    if (lvl > depth) {
      if (depth === 4) vis = lastH4 || lastH3 || lastH2 || h.id;
      else if (depth === 3) vis = lastH3 || lastH2 || h.id;
      else vis = lastH2 || h.id;
    }

    // Record mapping for this heading.
    map.set(h.id, vis);
  });

  // Return the resolved id (or the original if not found).
  return map.get(id) || id;
}

// Ensure headings have stable, human-readable, collision-free ids.
// Why: repeated text like “Grading Standards” appears multiple times and needs unique ids.
export function ensureHeadingIds(contentRoot) {
  // Track ids we assign in this pass to avoid duplicates.
  const seen = new Set();

  // Cache latest H2/H3 text slugs to build hierarchical ids for deeper headings.
  let lastH2 = '';
  let lastH3 = '';

  // Walk headings in document order so parents are assigned before children.
  $$(contentRoot, 'h2, h3, h4, h5').forEach(h => {
    // Determine heading level.
    const lvl = Number(h.tagName.slice(1));

    // Create a clean slug from the visible text for readability.
    const textSlug = slugify(h.textContent || '') || 'section';

    // Update ancestor breadcrumb.
    if (lvl === 2) { lastH2 = textSlug; lastH3 = ''; }
    else if (lvl === 3) { lastH3 = textSlug; }

    // Choose a base id that encodes hierarchy (H2 / H2--H3 / H2--H3--H4+).
    let base;

    // Use existing id if it’s not already present elsewhere.
    if (h.id && !document.getElementById(h.id)) base = h.id;
    else if (lvl === 2) base = textSlug;
    else if (lvl === 3) base = (lastH2 || 'section') + '--' + textSlug;
    else base = (lastH2 || 'section') + '--' + (lastH3 || 'sub') + '--' + textSlug;

    // Mint a unique id if needed by appending a numeric suffix.
    let id = base;
    if (seen.has(id) || document.getElementById(id)) id = uniqueId(base);

    // Apply and mark the id.
    h.id = id;
    seen.add(id);
  });
}

// Build the ToC list with the following structure:
//   H2 → level-1 button (group header)
//   H3 → level-2 button (shows a bullet via CSS)
//   H4 → anchor (no bullet) nested under the nearest H3 (or under H2 if no H3 yet)
export function buildTocFromHeadings(tocRoot, contentRoot) {
  // The container we populate (the inner <nav> inside the sidebar).
  const nav = tocRoot;

  // Clear existing content so rebuilds are idempotent.
  nav.innerHTML = '';

  // Read the configured heading depth; default to 4 (H2..H4).
  const depth = Number(tocRoot?.dataset?.tocDepth || 4);

  // Choose which headings to include based on depth.
  const selector = depth >= 5 ? 'h2, h3, h4, h5' : (depth >= 4 ? 'h2, h3, h4' : 'h2, h3');

  // Collect headings in reading order.
  const heads = $$(contentRoot, selector);

  // Track the current H2 group and the most recent H3 anchors container.
  let currentGroup = null;
  let lastH3Anchors = null;

  // Build ToC entries in a single pass.
  heads.forEach(h => {
    // Numeric level from the tag name.
    const lvl = Number(h.tagName.slice(1));

    // H2 → start a new group.
    if (lvl === 2) {
      // Group container.
      const group = document.createElement('div');
      group.className = 'nav-group';

      // H2 row button.
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-link nav-link--level1';
      btn.dataset.target = h.id;
      btn.textContent = h.textContent || '';
      group.appendChild(btn);

      // Subnav for H3/H4 items under this H2.
      const sub = document.createElement('div');
      sub.className = 'nav-subnav';
      group.appendChild(sub);

      // Append the complete group.
      nav.appendChild(group);

      // Reset trackers for this group.
      currentGroup = group;
      lastH3Anchors = null;
    }

    // H3 → level-2 row (bulleted) + create an anchors container for H4s.
    else if (lvl === 3 && currentGroup) {
      // H3 row button.
      const l2 = document.createElement('button');
      l2.type = 'button';
      l2.className = 'nav-link nav-link--level2';
      l2.dataset.target = h.id;
      l2.textContent = h.textContent || '';
      currentGroup.querySelector('.nav-subnav').appendChild(l2);

      // Anchors container for H4 entries under this H3.
      const anchors = document.createElement('div');
      anchors.className = 'nav-subnav--anchors';
      currentGroup.querySelector('.nav-subnav').appendChild(anchors);

      // Remember for subsequent H4s.
      lastH3Anchors = anchors;
    }

    // H4 → anchor row (no bullet), nested under the nearest H3 (or directly under the H2 group).
    else if (lvl === 4 && currentGroup) {
      // Choose an anchors container; fallback to the H2’s subnav if we haven’t seen an H3 yet.
      const parent = lastH3Anchors || currentGroup.querySelector('.nav-subnav');

      // H4 anchor button.
      const a = document.createElement('button');
      a.type = 'button';
      a.className = 'nav-anchor';
      a.dataset.target = h.id;
      a.textContent = h.textContent || '';
      parent.appendChild(a);
    }

    // H5 intentionally omitted from the ToC at depth=4; still tracked for hashes.
  });

  // Provide navigation semantics for assistive technologies.
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Page sections');
}

// Update the ToC’s active state and keep the active item centered inside the scrollable ToC.
export function setActiveNavForTarget(tocRoot, targetId) {
  // Gather all ToC buttons once.
  const buttons = Array.from(tocRoot.querySelectorAll('button[data-target]'));

  // Toggle classes and aria-current to reflect the active target.
  buttons.forEach(b => {
    // Is this the currently active item?
    const active = b.dataset.target === targetId;

    // Differentiate standard links vs anchor rows for styling hooks.
    if (b.classList.contains('nav-anchor')) {
      b.classList.toggle('nav-anchor--active', active);
    } else {
      b.classList.toggle('nav-link--active', active);
    }

    // Keep a generic “active” class for legacy CSS that might still rely on it.
    b.classList.toggle('active', active);

    // Announce the current location to screen readers.
    if (active) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });

  // Highlight the H2 group if any of its descendants are active.
  Array.from(tocRoot.querySelectorAll('.nav-group')).forEach(g => {
    const has = !!g.querySelector('button[aria-current="true"]');
    g.classList.toggle('nav-group--active', has);
  });

  // Find the scrolling container and the active button.
  const scroller = getNavContainer(tocRoot);
  const activeBtn = buttons.find(b => b.dataset.target === targetId);

  // If nothing is active (or not found), nothing to scroll. */
  if (!activeBtn) return;

  // Only attempt to scroll if content exceeds the container height.
  const styles = window.getComputedStyle(scroller);
  const scrollable = /(auto|scroll)/.test(styles.overflowY) || scroller.scrollHeight > scroller.clientHeight;
  if (!scrollable) return;

  // Compute geometry for container and active button.
  const nr = scroller.getBoundingClientRect();
  const br = activeBtn.getBoundingClientRect();

  // Check if the active button is above or below the viewport of the ToC scroller.
  const overTop = br.top < nr.top + 24;
  const underBottom = br.bottom > nr.bottom - 24;

  // If it’s outside the comfortable band, center it to keep context around it.
  if (overTop || underBottom) {
    scroller.scrollTop += (br.top - nr.top) - (scroller.clientHeight / 2) + (br.height / 2);
  }
}
