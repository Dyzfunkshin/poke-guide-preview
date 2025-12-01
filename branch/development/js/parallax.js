// js/parallax.js — subtle background parallax with reduced-motion support (line-by-line, 'why' first)

// Initialize the background parallax effect.
export function initBackgroundParallax() {

  // Respect user preference to reduce motion; skip effect for accessibility.
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (media.matches)
    return;

  // Find the background element; if not present, quietly noop to keep code resilient.
  const bg = document.querySelector('.bg-parallax');

  if (!bg)
    return;

  // On scroll, translate the background at a slower rate to create depth.
  function onScroll() {

    // Current vertical offset; default to 0 if unavailable.
    const y = window.pageYOffset || 0;

    // Apply a small translate to avoid distraction; 0.2 gives a subtle effect.
    bg.style.transform = 'translateY(' + (y * 0.2) + 'px)';
  }
  // Passive listener keeps scrolling smooth by telling the browser we won't call preventDefault().
  window.addEventListener('scroll', onScroll, { passive: true });

  // Apply initial transform so the effect matches the initial scroll position.
  onScroll();
}
