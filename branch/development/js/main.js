// js/main.js — bootstrap wiring for ToC, routing, scroll spy, and parallax (line-by-line, 'why' first)

// Import the functions responsible for building and maintaining the ToC.
import { ensureHeadingIds, buildTocFromHeadings } from './toc.js';

// Import navigation helpers that handle clicks, inline anchors, and initial deep-linking.
import { applyInitialLocation, wireInlineAnchorLinks, wireTocClicks, scrollToTarget } from './router.js';

// Import the scroll spy to keep ToC state in sync with scroll position.
import { initScrollSpy } from './scrollSpy.js';

// Import the parallax effect initializer (reduced-motion aware).
import { initBackgroundParallax } from './parallax.js';

// Wait until the DOM is parsed so all anchors and headings are present before wiring events.
document.addEventListener('DOMContentLoaded', () => {

  // Cache references to the main content and ToC containers for clarity and reuse.
  const contentRoot = document.getElementById('content');
  const tocRoot = document.getElementById('toc');

  // If either container is missing, log an error and bail to avoid null dereferences.
  if (!contentRoot || !tocRoot) {
    console.error('Missing #content or #toc'); return;
  }

  // Ensure all headings have stable, hierarchical IDs before ToC generation.
  ensureHeadingIds(contentRoot);

  // Build the ToC reflecting H2→H3→H4 structure (H5 hidden by default via data-toc-depth).
  buildTocFromHeadings(tocRoot, contentRoot);

  // Wire ToC button clicks to smooth scroll + focus updates via router.
  wireTocClicks(tocRoot, (id, opts) => scrollToTarget(contentRoot, tocRoot, id, opts));

  // Intercept inline anchor links in the content and route them through the same logic.
  wireInlineAnchorLinks(contentRoot, tocRoot);

  // If the page loads with a hash, navigate there immediately (no animation) for deep-link correctness.
  applyInitialLocation(contentRoot, tocRoot);

  // Start the ScrollSpy to update ToC as the user scrolls (30% threshold).
  initScrollSpy(contentRoot, tocRoot);

  // Initialize parallax effect; will no-op under prefers-reduced-motion.
  initBackgroundParallax();
});
