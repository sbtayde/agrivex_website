!function () {
  "use strict";

  var prefersReducedMotion = false;
  try {
    prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (err) {
    prefersReducedMotion = false;
  }

  // RAF throttle helper for scroll handlers (prevents jank)
  function rafThrottle(fn) {
    var ticking = false;
    return function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        fn();
        ticking = false;
      });
    };
  }

  // Scroll progress - uses transform scaleX (compositor-only, no layout thrash)
  var progressBar = document.getElementById("scroll-progress-bar");
  function updateProgress() {
    if (!progressBar) return;
    var scrollY = window.scrollY;
    var scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    var progress = scrollHeight > 0 ? scrollY / scrollHeight : 0;
    // clamp 0-1
    if (progress < 0) progress = 0;
    if (progress > 1) progress = 1;
    progressBar.style.transform = "scaleX(" + progress + ")";
  }
  var throttledProgress = rafThrottle(updateProgress);
  updateProgress();
  window.addEventListener("scroll", throttledProgress, { passive: true });
  window.addEventListener("resize", throttledProgress, { passive: true });

  // Navbar scrolled state + hamburger menu (mobile responsive)
  var navbar = document.getElementById("navbar");
  var navbarToggle = document.getElementById("navbar-toggle");
  var primaryNav = document.getElementById("primary-navigation");
  var isMenuOpen = false;
  var lastFocusedEl = null;
  var backdropEl = null;

  // Create backdrop overlay once
  function ensureBackdrop() {
    if (backdropEl) return backdropEl;
    backdropEl = document.getElementById("navbar-backdrop");
    if (!backdropEl && navbar) {
      backdropEl = document.createElement("div");
      backdropEl.id = "navbar-backdrop";
      backdropEl.className = "navbar__backdrop";
      backdropEl.setAttribute("aria-hidden", "true");
      // Insert right after navbar for correct stacking
      if (navbar.parentNode) navbar.parentNode.insertBefore(backdropEl, navbar.nextSibling);
      else document.body.appendChild(backdropEl);
      backdropEl.addEventListener("click", function () { setMenuOpen(false); });
    }
    return backdropEl;
  }
  ensureBackdrop();

  function getFocusable() {
    if (!primaryNav) return [];
    var nodes = primaryNav.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    return Array.prototype.slice.call(nodes).filter(function (el) {
      return el.offsetParent !== null || el.getClientRects().length > 0;
    });
  }

  function supportsInert() {
    return "inert" in HTMLElement.prototype;
  }

  function updateNavbarScrolled() {
    if (navbar) navbar.classList.toggle("navbar--scrolled", window.scrollY > 40);
  }
  var throttledNavbar = rafThrottle(updateNavbarScrolled);

  var previousBodyPaddingRight = "";
  var previousNavbarPaddingRight = "";

  function getScrollbarWidth() {
    return window.innerWidth - document.documentElement.clientWidth;
  }

  function lockScroll() {
    var sbWidth = getScrollbarWidth();
    if (sbWidth > 0) {
      previousBodyPaddingRight = document.body.style.paddingRight;
      previousNavbarPaddingRight = navbar ? navbar.style.paddingRight : "";
      document.body.style.paddingRight = sbWidth + "px";
      if (navbar) navbar.style.paddingRight = sbWidth + "px";
    }
    // Lock scroll via class on html+body (CSS: overflow:hidden) + inline fallback
    document.documentElement.classList.add("navbar--menu-open");
    document.body.classList.add("navbar--menu-open");
    document.body.style.overflow = "hidden";
  }

  function unlockScroll() {
    document.body.style.paddingRight = previousBodyPaddingRight;
    if (navbar) navbar.style.paddingRight = previousNavbarPaddingRight;
    document.documentElement.classList.remove("navbar--menu-open");
    document.body.classList.remove("navbar--menu-open");
    document.body.style.overflow = "";
  }

  function setMenuOpen(open) {
    if (open === isMenuOpen) return;
    isMenuOpen = open;
    var bd = ensureBackdrop();
    if (navbarToggle) {
      navbarToggle.classList.toggle("navbar__toggle--open", open);
      navbarToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navbarToggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    }
    if (primaryNav) {
      primaryNav.classList.toggle("navbar__nav--open", open);
      primaryNav.setAttribute("aria-hidden", open ? "false" : "true");
      // inert is progressive enhancement; set attribute regardless but feature-detect removal
      if (open) {
        if (supportsInert()) primaryNav.removeAttribute("inert");
        else primaryNav.removeAttribute("inert");
      } else {
        primaryNav.setAttribute("inert", "");
      }
    }
    if (bd) bd.classList.toggle("navbar__backdrop--visible", open);
    if (open) {
      lockScroll();
      lastFocusedEl = document.activeElement;
      window.setTimeout(function () {
        var f = getFocusable()[0];
        if (f) f.focus();
      }, 80);
    } else {
      unlockScroll();
      if (lastFocusedEl && lastFocusedEl.focus) {
        try { lastFocusedEl.focus(); } catch(e) {}
      } else if (navbarToggle) {
        try { navbarToggle.focus(); } catch(e) {}
      }
    }
  }
  updateNavbarScrolled();
  window.addEventListener("scroll", throttledNavbar, { passive: true });
  if (navbarToggle) {
    navbarToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      setMenuOpen(!isMenuOpen);
    });
  }
  // Toggle inert/aria-hidden initially (hidden on mobile until opened)
  if (primaryNav) {
    if (window.innerWidth <= 920) {
      primaryNav.setAttribute("aria-hidden", "true");
      primaryNav.setAttribute("inert", "");
    } else {
      primaryNav.setAttribute("aria-hidden", "false");
      if (supportsInert()) primaryNav.removeAttribute("inert");
      else primaryNav.removeAttribute("inert");
    }
  }

  document.addEventListener("keydown", function (evt) {
    if (evt.key === "Escape" && isMenuOpen) {
      evt.preventDefault();
      setMenuOpen(false);
    }
    // Focus trap when menu open
    if (evt.key === "Tab" && isMenuOpen) {
      var focusable = getFocusable();
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (evt.shiftKey && document.activeElement === first) {
        evt.preventDefault();
        last.focus();
      } else if (!evt.shiftKey && document.activeElement === last) {
        evt.preventDefault();
        first.focus();
      }
    }
  });
  // Close menu when clicking outside navbar on mobile (backdrop handles most, this is fallback)
  document.addEventListener("click", function (evt) {
    if (!isMenuOpen) return;
    if (!navbar || !primaryNav || !navbarToggle) return;
    if (window.innerWidth > 920) return;
    var target = evt.target;
    if (navbar.contains(target)) return;
    if (backdropEl && backdropEl.contains(target)) return;
    setMenuOpen(false);
  });
  // Close on resize to desktop (debounced)
  var resizeTimerNav = null;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimerNav);
    resizeTimerNav = window.setTimeout(function () {
      if (window.innerWidth > 920 && isMenuOpen) setMenuOpen(false);
      // Toggle inert/aria-hidden for desktop vs mobile
      if (primaryNav) {
        if (window.innerWidth > 920) {
          primaryNav.removeAttribute("inert");
          primaryNav.setAttribute("aria-hidden", "false");
        } else if (!isMenuOpen) {
          primaryNav.setAttribute("aria-hidden", "true");
          primaryNav.setAttribute("inert", "");
        }
      }
    }, 120);
  });

  // Active nav link via IntersectionObserver
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".navbar__link"));
  var navTargets = navLinks
    .map(function (link) {
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) !== "#") return null;
      try {
        return document.querySelector(href);
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);

  if (navTargets.length > 0 && "IntersectionObserver" in window) {
    var activeObserver = new IntersectionObserver(
      function (entries) {
        var visible = entries.filter(function (entry) { return entry.isIntersecting; });
        if (visible.length === 0) return;
        visible.sort(function (a, b) {
          return Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top);
        });
        var targetId = "#" + visible[0].target.id;
        navLinks.forEach(function (link) {
          var isActive = link.getAttribute("href") === targetId;
          link.classList.toggle("navbar__link--active", isActive);
          if (isActive) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0 }
    );
    navTargets.forEach(function (el) { activeObserver.observe(el); });
  }

  Array.prototype.slice.call(document.querySelectorAll(".navbar__nav a")).forEach(function (link) {
    link.addEventListener("click", function () { setMenuOpen(false); });
  });

  // Back to top - throttled
  var backToTop = document.getElementById("back-to-top");
  function updateBackToTop() {
    if (backToTop) backToTop.classList.toggle("back-to-top--visible", window.scrollY > 600);
  }
  var throttledBackToTop = rafThrottle(updateBackToTop);
  updateBackToTop();
  window.addEventListener("scroll", throttledBackToTop, { passive: true });
  if (backToTop) {
    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  }

  // Reveal on scroll - with staggered delay to avoid jank
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("reveal--visible"); });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal--visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  // Pause ecosystem orbit when offscreen (saves CPU/GPU)
  var ecosystemSection = document.querySelector(".agrivex-ecosystem");
  var orbitEls = document.querySelectorAll(".agrivex-ecosystem__orbit");
  if (ecosystemSection && "IntersectionObserver" in window && orbitEls.length) {
    var orbitObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var state = entry.isIntersecting ? "running" : "paused";
          orbitEls.forEach(function (el) { el.style.animationPlayState = state; });
        });
      },
      { threshold: 0 }
    );
    orbitObserver.observe(ecosystemSection);
    // Respect reduced motion
    if (prefersReducedMotion) {
      orbitEls.forEach(function (el) { el.style.animation = "none"; });
    }
  }

  // Flip cards (agriculture vision)
  Array.prototype.slice.call(document.querySelectorAll("[data-flip-card]")).forEach(function (card) {
    function toggleFlip() {
      var isFlipped = card.classList.toggle("agriculture-vision__pillar--flipped");
      card.setAttribute("aria-pressed", isFlipped ? "true" : "false");
    }
    card.setAttribute("role", "button");
    if (!card.hasAttribute("aria-pressed")) card.setAttribute("aria-pressed", "false");
    card.addEventListener("click", toggleFlip);
    card.addEventListener("keydown", function (evt) {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        toggleFlip();
      }
    });
  });

  // Strategic capabilities: interactive cards
  var capabilityCards = Array.prototype.slice.call(document.querySelectorAll("[data-capability-index]"));
  var capabilityContainer = document.getElementById("capability-cards");
  var capabilityCounter = document.getElementById("capability-counter-current");
  var capabilityCount = capabilityCards.length;
  var hoveredIndex = null;
  var isContainerHovered = false;
  var activeIndex = 2;

  function updateCapabilityActive() {
    var current = hoveredIndex !== null ? hoveredIndex : activeIndex;
    capabilityCards.forEach(function (card, idx) {
      var isActive = idx === current;
      card.classList.toggle("strategic-capabilities__card--active", isActive);
      card.setAttribute("aria-selected", isActive ? "true" : "false");
      if (isActive) card.setAttribute("tabindex", "0");
      else card.setAttribute("tabindex", "-1");
    });
    if (capabilityCounter) {
      capabilityCounter.textContent = String(current + 1).padStart(2, "0");
    }
  }
  if (capabilityCount > 0) {
    capabilityCards.forEach(function (card, idx) {
      card.setAttribute("role", "tab");
      card.setAttribute("aria-label", "Capability " + (idx + 1) + " of " + capabilityCount);
    });
    if (capabilityContainer) capabilityContainer.setAttribute("role", "tablist");
    updateCapabilityActive();

    var rotateInterval = null;
    if (!prefersReducedMotion) {
      rotateInterval = window.setInterval(function () {
        if (isContainerHovered || hoveredIndex !== null) return;
        if (document.hidden) return;
        activeIndex = (activeIndex + 1) % capabilityCount;
        updateCapabilityActive();
      }, 5000);
      document.addEventListener("visibilitychange", function () {
        if (document.hidden && rotateInterval) {
          window.clearInterval(rotateInterval);
          rotateInterval = null;
        } else if (!document.hidden && !rotateInterval) {
          rotateInterval = window.setInterval(function () {
            if (isContainerHovered || hoveredIndex !== null) return;
            activeIndex = (activeIndex + 1) % capabilityCount;
            updateCapabilityActive();
          }, 5000);
        }
      });
      // Pause auto-rotate when section offscreen
      if ("IntersectionObserver" in window && capabilityContainer) {
        var capObserver = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting && rotateInterval) {
                window.clearInterval(rotateInterval);
                rotateInterval = null;
              } else if (entry.isIntersecting && !rotateInterval && !prefersReducedMotion) {
                rotateInterval = window.setInterval(function () {
                  if (isContainerHovered || hoveredIndex !== null) return;
                  if (document.hidden) return;
                  activeIndex = (activeIndex + 1) % capabilityCount;
                  updateCapabilityActive();
                }, 5000);
              }
            });
          },
          { threshold: 0.1 }
        );
        capObserver.observe(capabilityContainer);
      }
    }

    if (capabilityContainer) {
      capabilityContainer.addEventListener("mouseenter", function () { isContainerHovered = true; });
      capabilityContainer.addEventListener("mouseleave", function () {
        isContainerHovered = false;
        hoveredIndex = null;
        updateCapabilityActive();
      });
      capabilityContainer.addEventListener("focusin", function () { isContainerHovered = true; });
      capabilityContainer.addEventListener("focusout", function () {
        window.setTimeout(function () {
          if (!capabilityContainer.contains(document.activeElement)) {
            isContainerHovered = false;
            hoveredIndex = null;
            updateCapabilityActive();
          }
        }, 100);
      });
    }
    capabilityCards.forEach(function (card, idx) {
      card.addEventListener("mouseenter", function () {
        hoveredIndex = idx;
        updateCapabilityActive();
      });
      card.addEventListener("focus", function () {
        hoveredIndex = idx;
        updateCapabilityActive();
      });
      card.addEventListener("click", function () {
        activeIndex = idx;
        hoveredIndex = idx;
        updateCapabilityActive();
      });
      card.addEventListener("keydown", function (evt) {
        if (evt.key === "ArrowRight" || evt.key === "ArrowDown") {
          evt.preventDefault();
          var next = (idx + 1) % capabilityCount;
          capabilityCards[next].focus();
        } else if (evt.key === "ArrowLeft" || evt.key === "ArrowUp") {
          evt.preventDefault();
          var prev = (idx - 1 + capabilityCount) % capabilityCount;
          capabilityCards[prev].focus();
        } else if (evt.key === "Home") {
          evt.preventDefault();
          capabilityCards[0].focus();
        } else if (evt.key === "End") {
          evt.preventDefault();
          capabilityCards[capabilityCount - 1].focus();
        }
      });
    });
  }

  // Current year
  var yearEl = document.getElementById("current-year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

}();
