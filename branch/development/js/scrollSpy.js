// js/scrollSpy.js — watch scroll position and update ToC/hash (line-by-line, 'why' first)

// Reuse DOM helper and ToC functions to compute active section and reflect it in navigation.
import { $$ } from './utils.js';
import { setActiveNavForTarget, resolveTocTargetId } from './toc.js';

// Initialize the ScrollSpy that activates when headings cross 30% from the top of the viewport.
export function initScrollSpy(contentRoot, tocRoot) {

  // Collect target headings in reading order; include H5 for URL hash updates even if not shown in ToC.
  const headings = $$(contentRoot, 'h2, h3, h4, h5');

  // If there are no headings, bail early to avoid attaching listeners unnecessarily.
  if (!headings.length)
    return;

  // Use rAF throttling to avoid doing work on every single scroll event; improves performance.
  let ticking = false;

  // Define the calculation step that picks the currently active heading.
  function update() {

    // Compute viewport height once; support fallback to documentElement for older engines.
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;

    // Use the top 30% as the activation threshold, per product requirement.
    const threshold = vh * 0.30;

    // Default to the first heading; we'll advance while items are above threshold.
    let bestIdx = 0;

    // Iterate headings until one is below the threshold (list is in DOM order).
    for (let i = 0; i < headings.length; i++) {

      // Measure distance from top; smaller than threshold means it's "current" or above it.
      const top = headings[i].getBoundingClientRect().top;

      // Keep promoting bestIdx while the heading is above or at the threshold.
      if (top <= threshold)
        bestIdx = i;
      else
        break;
    }

    // Pick the best candidate; safe even if there is only one item.
    const best = headings[bestIdx];

    // If a candidate exists and has an id, sync both ToC and URL.
    if (best && best.id) {

      // Map deep targets to visible ToC items to ensure correct highlighting.
      const tocId = resolveTocTargetId(tocRoot, contentRoot, best.id);

      // Update visual and ARIA states in the ToC to reflect the new position.
      setActiveNavForTarget(tocRoot, tocId);

      // Update hash without growing history to keep the back button sane while scrolling.
      history.replaceState(null, '', '#' + best.id);
    }
  }

  // Throttled scroll handler that defers heavy work to the next animation frame.
  function onScroll() {

    // Only schedule one update per frame for smooth performance under fast scrolling.
    if (!ticking) {
      ticking = true; requestAnimationFrame(() => {
        update(); ticking = false;
      });
    }
  }

  // Listen to scroll and resize; mark listeners passive to avoid blocking scrolling.
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  // Run once on init so the ToC is correct even before the user scrolls.
  update();
}
