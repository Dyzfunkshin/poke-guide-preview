document.addEventListener("DOMContentLoaded", () => {
  const contentRoot = document.getElementById("content");
  const tocRoot = document.getElementById("toc");

  if (!contentRoot) {
    console.error("No #content element found in the document.");
    return;
  }

  const sectionsToLoad = [
    "content/welcome.html",
    "content/identify.html",
    "content/worth.html",
    "content/tracking.html",
    "content/grading.html"
  ];

  function getNavContainer() {
    if (!tocRoot) return null;
    const nav = tocRoot.querySelector(".nav");
    return nav instanceof HTMLElement ? nav : null;
  }

  function setNavStatus(message, status = "loading") {
    const navContainer = getNavContainer();
    if (!navContainer) return null;

    let el = navContainer.querySelector(".nav-status");
    if (!el) {
      el = document.createElement("div");
      el.className = "nav-status";
      navContainer.prepend(el);
    }
    el.textContent = message;
    el.className = `nav-status nav-status--${status}`;
    return el;
  }

  function clearNavStatus() {
    const navContainer = getNavContainer();
    const statusEl = navContainer?.querySelector(".nav-status");
    if (statusEl) statusEl.remove();
  }

  // How we decide when to switch active headings while scrolling
  // 0.5  → switch when the top of the screen is halfway between headings
  // 0.3  → switch earlier (closer to the previous heading)
  // 0.7  → switch later (closer to the next heading)
  const HEADER_SWITCH_FRACTION = 0.5;

  // Optional: shift the reference line down from the very top of the viewport (in px)
  // e.g. 0 = very top, 80 = 80px below the top.
  const VIEWPORT_REFERENCE_OFFSET = 0;


  // 1) Load all content sections into <main id="content">
  async function loadAllSections() {
    // Insert loaded sections before the contact section if present, otherwise before support
    const contactSection = document.getElementById("contact");
    const supportSection = document.getElementById("support");
    const insertBeforeNode = contactSection || supportSection || null;

    const loadErrors = [];

    for (const file of sectionsToLoad) {
      try {
        const response = await fetch(file);
        if (!response.ok) {
          console.error(`Failed to load ${file}:`, response.status, response.statusText);
          loadErrors.push(file);
          continue;
        }

        const html = await response.text();
        const template = document.createElement("template");
        template.innerHTML = html.trim();
        const sectionEl = template.content.firstElementChild;

        if (sectionEl) {
          if (insertBeforeNode) {
            // Insert each loaded section before the Support section
            contentRoot.insertBefore(sectionEl, insertBeforeNode);
          } else {
            // Fallback: no support section found, just append normally
            contentRoot.appendChild(sectionEl);
          }
        }
      } catch (error) {
        console.error(`Error loading section ${file}:`, error);
        loadErrors.push(file);
      }
    }

    if (loadErrors.length) {
      setNavStatus("Some sections failed to load. Please refresh.", "error");
    }
  }

  // Turn heading text into a safe id if one is missing
  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  // 2) Build the sidebar navigation from <h2>/<h3>/<h4> headings
  // 2) Build the sidebar navigation from <h2>/<h3>/<h4> headings
  function buildTocFromHeadings() {
    if (!tocRoot) return;

    // Find the actual scrollable nav region inside the sidebar.
    const navContainer = getNavContainer();
    if (!navContainer) {
      console.error('No ".nav" container found inside #toc.');
      return;
    }

    // Clear any existing ToC content before rebuilding.
    navContainer.querySelectorAll(".nav-group").forEach((group) => group.remove());

    const headings = contentRoot.querySelectorAll("h2, h3, h4");
    if (!headings.length) return;

    let currentGroup = null;   // current h2 group (nav-group)
    let currentLevel2 = null;  // current h3 entry within that group

    headings.forEach((heading) => {
      if (!(heading instanceof HTMLElement)) return;

      const level = parseInt(heading.tagName[1], 10); // 2, 3, or 4
      if (Number.isNaN(level) || level < 2 || level > 4) return;

      // Ensure every heading has a stable id
      if (!heading.id) {
        heading.id = slugify(heading.textContent || "");
      }

      const id = heading.id;
      const text = (heading.textContent || "").trim();
      if (!id || !text) return;

      if (level === 2) {
        // Top-level sections → <div.nav-group> with a level1 button and one .nav-subnav for children
        const group = document.createElement("div");
        group.className = "nav-group";

        const topButton = document.createElement("button");
        topButton.type = "button";
        topButton.className = "nav-link nav-link--level1";
        topButton.dataset.target = id;
        topButton.textContent = text;
        group.appendChild(topButton);

        const linksContainer = document.createElement("div");
        linksContainer.className = "nav-subnav";
        group.appendChild(linksContainer);

        // IMPORTANT: append to the inner .nav container, not #toc
        navContainer.appendChild(group);

        currentGroup = { group, linksContainer };
        currentLevel2 = null; // reset for this h2
      } else if (level === 3) {
        // h3: level-2 nav item under the current h2
        if (!currentGroup) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "nav-link nav-link--level2";
        btn.dataset.target = id;
        btn.textContent = text;
        currentGroup.linksContainer.appendChild(btn);

        // Create an anchors container that will hold this h3's h4 items
        const anchorsContainer = document.createElement("div");
        anchorsContainer.className = "nav-subnav nav-subnav--anchors";
        currentGroup.linksContainer.appendChild(anchorsContainer);

        currentLevel2 = { anchorsContainer };
      } else if (level === 4) {
        // h4: anchor-level item under the most recent h3 (or directly under the h2 as fallback)
        if (!currentGroup) return;

        let anchorParent =
          currentLevel2 && currentLevel2.anchorsContainer
            ? currentLevel2.anchorsContainer
            : null;

        if (!anchorParent) {
          // Fallback: no h3 before this h4, create a generic anchors container under the current h2
          anchorParent = document.createElement("div");
          anchorParent.className = "nav-subnav nav-subnav--anchors";
          currentGroup.linksContainer.appendChild(anchorParent);
          currentLevel2 = { anchorsContainer: anchorParent };
        }

        const anchorBtn = document.createElement("button");
        anchorBtn.type = "button";
        anchorBtn.className = "nav-anchor";
        anchorBtn.dataset.target = id;
        anchorBtn.textContent = text;

        anchorParent.appendChild(anchorBtn);
      }
    });
  }


  function getAllNavButtons() {
    if (!tocRoot) return [];
    return tocRoot.querySelectorAll(".nav-link, .nav-anchor");
  }

  function clearActiveNav() {
    if (!tocRoot) return;
    tocRoot
      .querySelectorAll(
        ".nav-link--active, .nav-anchor--active, .nav-group--active"
      )
      .forEach((el) => {
        el.classList.remove(
          "nav-link--active",
          "nav-anchor--active",
          "nav-group--active"
        );
        if (el instanceof HTMLElement) {
          el.removeAttribute("aria-current");
        }
      });
  }

  // Ensure the given nav button is nicely visible inside the scrollable ToC
  function ensureNavButtonVisible(button) {
    if (!tocRoot || !(button instanceof HTMLElement)) return;

    // Prefer the dedicated .nav container inside the sidebar
    let navContainer = getNavContainer() || (tocRoot instanceof HTMLElement ? tocRoot : null);
    if (!navContainer) return;

    // Only auto-scroll when the nav area itself is scrollable (desktop)
    const styles = window.getComputedStyle(navContainer);
    const overflowY = styles.overflowY;
    if (overflowY !== "auto" && overflowY !== "scroll") {
      return;
    }

    // --- Compute the button's position relative to the nav container ---

    let offsetTop = button.offsetTop;
    let current = button.offsetParent;

    while (current && current !== navContainer && current instanceof HTMLElement) {
      offsetTop += current.offsetTop;
      current = current.offsetParent;
    }

    const navHeight = navContainer.clientHeight;
    const buttonHeight = button.offsetHeight;

    // Where the button sits in the nav's coordinate space
    const buttonCenter = offsetTop + buttonHeight / 2;

    // We want the active item roughly centered in the visible area
    let desiredScrollTop = buttonCenter - navHeight / 2;

    // Clamp to valid scroll range so we don't overshoot top/bottom
    const maxScroll = navContainer.scrollHeight - navHeight;
    if (desiredScrollTop < 0) desiredScrollTop = 0;
    if (desiredScrollTop > maxScroll) desiredScrollTop = maxScroll;

    // Small deadzone so we don't cause jitter for tiny movements
    if (Math.abs(navContainer.scrollTop - desiredScrollTop) > 2) {
      navContainer.scrollTop = desiredScrollTop;
    }
  }

  // Highlight the nav item that corresponds to a given id
  function setActiveNavForTarget(targetId) {
    if (!targetId || !tocRoot) return;

    const navButtons = Array.from(getAllNavButtons());
    if (!navButtons.length) return;

    clearActiveNav();

    const targetButton = navButtons.find(
      (btn) => btn instanceof HTMLElement && btn.dataset.target === targetId
    );

    if (!targetButton) return;

    const group = targetButton.closest(".nav-group");
    if (group) {
      // Clear previous active group highlight
      tocRoot
        .querySelectorAll(".nav-group--active")
        .forEach((g) => g.classList.remove("nav-group--active"));

      // Mark this group as the active section card
      group.classList.add("nav-group--active");
    }

    // Apply active styling to the exact button (H2/H3/H4)
    if (targetButton.classList.contains("nav-anchor")) {
      targetButton.classList.add("nav-anchor--active");
    } else {
      targetButton.classList.add("nav-link--active");
    }
    targetButton.setAttribute("aria-current", "true");

    // Also highlight the parent top-level button
    if (!targetButton.classList.contains("nav-link--level1") && group) {
      const parentTop = group.querySelector(".nav-link--level1");
      if (parentTop) {
        parentTop.classList.add("nav-link--active");
        parentTop.setAttribute("aria-current", "true");
      }
    }

    // Keep the active nav item visible inside the ToC
    ensureNavButtonVisible(targetButton);
  }

  // Scroll to a heading/section and (optionally) update the URL hash
  function scrollToTarget(targetId, { updateHash = true, smooth = true } = {}) {
    if (!targetId) return;

    const el = document.getElementById(targetId);
    if (!el) {
      console.warn(`No element found with id="${targetId}"`);
      return;
    }

    setActiveNavForTarget(targetId);

    el.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "start"
    });

    if (updateHash) {
      if (typeof history.replaceState === "function") {
        history.replaceState(null, "", `#${targetId}`);
      } else {
        window.location.hash = `#${targetId}`;
      }
    }
  }

  // 3) Handle clicks in the sidebar via event delegation
  function wireTocClicks() {
    if (!tocRoot) return;

    tocRoot.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const btn = target.closest("button[data-target]");
      if (!btn) return;

      const targetId = btn.dataset.target;
      if (!targetId) return;

      // No more collapsing; just scroll to the target
      scrollToTarget(targetId, { updateHash: true, smooth: true });
    });
  }


  function wireInlineAnchorLinks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href) return;

      const id = href.slice(1); // remove leading '#'
      if (!id) return;

      const targetEl = document.getElementById(id);
      if (!targetEl) return; // let browser handle weird cases

      event.preventDefault();
      scrollToTarget(id, { updateHash: true, smooth: true });
    });
  }


  // 4) Scroll spy: keep the correct nav item highlighted as you scroll.
  //
  // Concept:
  // - Take all headings in DOM order: H0, H1, H2, ...
  // - Between each pair Hi and Hi+1, define a boundary at:
  //     boundary = Hi + (Hi+1 - Hi) * HEADER_SWITCH_FRACTION
  // - Look at the "top-of-screen line": scrollY + VIEWPORT_REFERENCE_OFFSET
  // - If that line is:
  //     < boundary(0,1)              → H0 active
  //     between boundary(0,1) & (1,2)→ H1 active
  //     ...
  //     ≥ last boundary              → last heading active
  //
  // Extra rule:
  // - If the user is scrolled all the way to the bottom of the page,
  //   force the LAST heading to be active (e.g. the Support section),
  //   regardless of the midline logic.
  function initScrollSpy() {
    const headings = Array.from(
      contentRoot.querySelectorAll("h2, h3, h4")
    ).filter((h) => h instanceof HTMLElement);

    if (!headings.length) return;

    function computeAbsoluteTop(el) {
      const rect = el.getBoundingClientRect();
      return rect.top + window.scrollY;
    }

    function updateActiveFromScroll() {
      const n = headings.length;
      if (!n) return;

      // Position of our reference line from the top of the *document*.
      const referencePos = window.scrollY + VIEWPORT_REFERENCE_OFFSET;

      // Check if we are effectively at the bottom of the page
      const docEl = document.documentElement;
      const viewportBottom = window.scrollY + window.innerHeight;
      const atPageBottom = viewportBottom >= docEl.scrollHeight - 2; // small fudge factor

      // Get current absolute tops of all headings.
      // (We recompute each time so this stays correct on resize / font changes.)
      const tops = headings.map(computeAbsoluteTop);

      let activeIndex = 0;

      if (n === 1) {
        // Only one heading: always active
        activeIndex = 0;
      } else if (atPageBottom) {
        // Special case: at the very bottom of the page,
        // force the LAST heading to be active (e.g. Support).
        activeIndex = n - 1;
      } else {
        // Normal midline logic between headings
        activeIndex = n - 1; // default to last; may override below

        for (let i = 0; i < n - 1; i++) {
          const topCurrent = tops[i];
          const topNext = tops[i + 1];

          // Boundary between headings i and i+1
          const boundary =
            topCurrent +
            (topNext - topCurrent) * HEADER_SWITCH_FRACTION;

          if (referencePos < boundary) {
            activeIndex = i;
            break;
          }
        }
      }

      const activeHeading = headings[activeIndex];
      if (activeHeading && activeHeading.id) {
        setActiveNavForTarget(activeHeading.id);
      }
    }

    // Throttle scroll handling with requestAnimationFrame
    let ticking = false;
    function onScrollOrResize() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          updateActiveFromScroll();
        });
      }
    }

    document.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    // Initial run
    updateActiveFromScroll();
  }

  // Make the body background scroll proportionally to the page scroll.
  // When at the top of the page, we show the top of the image.
  // When at the bottom of the page, we show the bottom of the image.
  function initBackgroundParallax() {
    const docEl = document.documentElement;
    const body = document.body;

    function updateBackgroundPosition() {
      const scrollTop =
        window.scrollY ||
        window.pageYOffset ||
        docEl.scrollTop ||
        0;

      const scrollHeight = docEl.scrollHeight || body.scrollHeight || 0;
      const viewportHeight = window.innerHeight || docEl.clientHeight || 0;

      const maxScroll = scrollHeight - viewportHeight;

      if (maxScroll <= 0) {
        // No scrollable content; keep background at the top
        body.style.backgroundPosition = "center top";
        return;
      }

      // Scroll progress from 0 (top of page) to 1 (bottom of page)
      const progress = Math.min(Math.max(scrollTop / maxScroll, 0), 1);

      // Map progress -> 0% (top of image) to 100% (bottom of image)
      const bgY = progress * 100;

      // Apply as CSS background-position
      body.style.backgroundPosition = `center ${bgY}%`;
    }

    // Throttle via requestAnimationFrame for smoothness
    let ticking = false;
    function onScrollOrResize() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          updateBackgroundPosition();
        });
      }
    }

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    // Initial position
    updateBackgroundPosition();
  }


  // 5) On first load, either go to the hash or to the first heading
  function applyInitialLocation() {
    const headings = contentRoot.querySelectorAll("h2, h3, h4");
    const firstHeading =
      headings.length && headings[0] instanceof HTMLElement ? headings[0] : null;

    const initialHash = window.location.hash.slice(1);
    const initialTarget = initialHash || (firstHeading ? firstHeading.id : "");

    if (!initialTarget) return;

    if (initialHash) {
      // Jump directly to the hashed section without re-writing the hash
      scrollToTarget(initialTarget, { updateHash: false, smooth: false });
    } else {
      setActiveNavForTarget(initialTarget);
      const el = document.getElementById(initialTarget);
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "start" });
      }
    }
  }

  // Bring it all together
  async function init() {
    await loadAllSections();
    buildTocFromHeadings();
    wireTocClicks();
    wireInlineAnchorLinks();
    applyInitialLocation();
    initScrollSpy();
    initBackgroundParallax();
  }

  init().catch((error) => {
    console.error("Error initializing Poké Guide:", error);
  });
});
