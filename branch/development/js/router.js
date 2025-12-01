// js/router.js — in-page navigation & hash syncing (line-by-line, 'why' first)

// Reuse ToC helpers to resolve visible targets and update active states.
// Why: keep routing and ToC highlighting in sync.
import { resolveTocTargetId, setActiveNavForTarget } from './toc.js';

// Scroll to a target id, update ToC, hash, and focus for accessibility.
export function scrollToTarget(contentRoot, tocRoot, id, opts = {}) {

  // Locate the target element by id; abort if it doesn't exist.
  const el = document.getElementById(id);

  if (!el)
    return;

  // Compute absolute scroll position with a small offset so the heading isn't flush with the viewport edge.
  const top = el.getBoundingClientRect().top + window.pageYOffset - 16;

  // Perform the actual scroll; smooth when triggered by user interaction.
  window.scrollTo({ top, behavior: opts.smooth ? 'smooth' : 'auto' });

  // If this id is deeper than the ToC shows, map it to the nearest visible ancestor to highlight properly.
  const visible = resolveTocTargetId(tocRoot, contentRoot, id);

  // Update the ToC visual/ARIA state so navigation reflects the new position.
  setActiveNavForTarget(tocRoot, visible);

  // Push the new hash into the URL without a full page reload so links remain shareable.
  history.pushState(null, '', '#' + id);

  // Move keyboard/screen-reader focus to the heading to announce context after programmatic scroll.
  if (opts.moveFocus) {
    el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true });
    setTimeout(() => el.removeAttribute('tabindex'), 300);
  }
}

// Attach click handlers to ToC buttons to trigger smooth in-page navigation.
export function wireTocClicks(tocRoot, onNavigate) {

  // Delegate clicks from the container to support dynamic ToC rebuilds.
  tocRoot.addEventListener('click', (e) => {

    // Find the closest actionable button; ignore clicks on empty space.
    const btn = e.target instanceof HTMLElement ? e.target.closest('button[data-target]') : null;

    if (!btn)
      return;

    // Prevent default to avoid any unintended focus behavior.
    e.preventDefault();

    // Invoke the provided navigation function (keeps this module decoupled).
    onNavigate(btn.dataset.target, { smooth: true, moveFocus: true });
  });
}

// Intercept inline anchor links in content so they scroll smoothly and update ToC/hash consistently.
export function wireInlineAnchorLinks(contentRoot, tocRoot) {

  // Use a single delegated listener for performance and simplicity.
  contentRoot.addEventListener('click', (e) => {

    // Only handle fragment links; allow external links to behave normally.
    const a = e.target instanceof HTMLElement ? e.target.closest('a[href^="#"]') : null;

    if (!a)
      return;

    // Extract the id without the leading '#'; ignore empty/invalid values.
    const id = a.getAttribute('href').slice(1);

    if (!id)
      return;

    // Prevent default jump so we can animate and sync the ToC/hash ourselves.
    e.preventDefault();

    // Perform a smooth scroll and focus shift for accessibility.
    scrollToTarget(contentRoot, tocRoot, id, { smooth: true, moveFocus: true });
  });
}

// Apply the current location’s hash on load or history navigation so deep links land correctly.
export function applyInitialLocation(contentRoot, tocRoot) {

  // Decode the hash to support non-ASCII ids and trim it to avoid whitespace bugs.
  const id = decodeURIComponent((location.hash || '').replace(/^#/, '').trim());

  // If the element exists, navigate to it without animation for immediate correctness.
  if (id && document.getElementById(id)) {
    scrollToTarget(contentRoot, tocRoot, id, { smooth: false, moveFocus: true });
  }
}
