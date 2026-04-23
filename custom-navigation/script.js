/*
 * Script: custom-navigation
 * Date: 2026-04-23
 * Auteur: grindghost
 */

  (function () {
  function startRefreshInterval(refreshFn) {
    if (window.__storylineSliderNavInterval) {
      clearInterval(window.__storylineSliderNavInterval);
    }
    var ticks = 0;
    var maxTicks = 32;  // ~8s fixe, sans arret anticipe
    window.__storylineSliderNavInterval = setInterval(function () {
      ticks += 1;
      refreshFn();
      if (ticks >= maxTicks) {
        clearInterval(window.__storylineSliderNavInterval);
        window.__storylineSliderNavInterval = null;
      }
    }, 250);
  }

  // Evite de reinjecter le tout plusieurs fois sur la meme slide
  if (window.__storylineSliderNavInit) {
    if (typeof window.__storylineSliderNavRefresh === "function") {
      startRefreshInterval(window.__storylineSliderNavRefresh);
    }
    return;
  }
  window.__storylineSliderNavInit = true;

  var CONFIG = {
    sideOffset: 16,
    buttonSize: 64,
    iconSize: 36,
    radius: 12,
    bg: "#2b6346",
    bgHover: "#235239",
    iconColor: "#ffffff",
    zIndex: 99999,
    shadow: "0 6px 16px rgba(0,0,0,0.20)"
  };

  function injectStyles() {
    if (document.getElementById("custom-storyline-nav-style")) return;

    var style = document.createElement("style");
    style.id = "custom-storyline-nav-style";
    style.innerHTML = `
      #nav-controls.custom-slider-nav {
        pointer-events: auto !important;
      }

      #custom-storyline-nav-overlay {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        pointer-events: none !important;
        z-index: ${CONFIG.zIndex} !important;
      }

      #prev.custom-slider-nav-btn,
      #next.custom-slider-nav-btn {
        position: fixed !important;
        top: 50% !important;
        width: ${CONFIG.buttonSize}px !important;
        height: ${CONFIG.buttonSize}px !important;
        margin: 0 !important;
        padding: 0 !important;
        transform: translateY(-50%) scale(var(--nav-scale, 1)) !important;
        border: none !important;
        border-radius: ${CONFIG.radius}px !important;
        background: ${CONFIG.bg} !important;
        box-shadow: ${CONFIG.shadow} !important;
        overflow: hidden !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        display: block !important;
        transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.22s ease, box-shadow 0.28s ease !important;
        will-change: transform !important;
      }

      #prev.custom-slider-nav-btn {
        left: ${CONFIG.sideOffset}px !important;
      }

      #next.custom-slider-nav-btn {
        right: ${CONFIG.sideOffset}px !important;
        left: auto !important;
      }

      #prev.custom-slider-nav-btn:hover,
      #next.custom-slider-nav-btn:hover,
      #prev.custom-slider-nav-btn:focus,
      #next.custom-slider-nav-btn:focus {
        --nav-scale: 1.08;
        background: ${CONFIG.bgHover} !important;
        outline: none !important;
        box-shadow: 0 10px 20px rgba(0,0,0,0.28) !important;
      }

      #prev.custom-slider-nav-btn.cs-disabled,
      #next.custom-slider-nav-btn.cs-disabled,
      #prev.custom-slider-nav-btn[aria-disabled="true"],
      #next.custom-slider-nav-btn[aria-disabled="true"] {
        opacity: 0.45 !important;
        cursor: default !important;
      }

      #prev.custom-slider-nav-btn .text,
      #next.custom-slider-nav-btn .text {
        display: none !important;
      }

      #prev.custom-slider-nav-btn .view-content,
      #next.custom-slider-nav-btn .view-content {
        position: relative !important;
        width: 100% !important;
        height: 100% !important;
        top: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      #prev.custom-slider-nav-btn .btn-icon,
      #next.custom-slider-nav-btn .btn-icon {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
        height: 100% !important;
      }

      #prev.custom-slider-nav-btn svg,
      #next.custom-slider-nav-btn svg {
        width: 36px !important;
        height: 36px !important;
      }

      #prev.custom-slider-nav-btn svg polyline,
      #next.custom-slider-nav-btn svg polyline {
        fill: none !important;
        stroke: ${CONFIG.iconColor} !important;
        stroke-width: 4 !important;
        stroke-linecap: round !important;
        stroke-linejoin: round !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureArrowOnly(buttonId) {
    var btn = document.getElementById(buttonId);
    if (!btn) return;

    var view = btn.querySelector(".view-content");
    if (!view) return;
    if (view.getAttribute("data-custom-arrow") === "true") return;

    view.setAttribute("data-custom-arrow", "true");
    var points = buttonId === "prev" ? "18.84,24.57 9.99,16.50 17.86,7.44" : "13.16,24.57 22.01,16.50 14.14,7.44";
    view.innerHTML = '<span class="btn-icon" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false" aria-hidden="true"><polyline points="' + points + '"></polyline></svg></span>';
  }

  function ensureOverlayRoot() {
    var host =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement ||
      document.body;
    var root = document.getElementById("custom-storyline-nav-overlay");
    if (!root) {
      root = document.createElement("div");
      root.id = "custom-storyline-nav-overlay";
    }
    if (root.parentNode !== host) {
      host.appendChild(root);
    }
    return root;
  }

  function fixPlayerBarLayout() {
    var nav = document.getElementById("nav-controls");
    if (!nav) return;

    ["prev", "next"].forEach(function (id) {
      var btn = nav.querySelector("#" + id);
      if (!btn) return;
      btn.style.setProperty("display", "none", "important");
      btn.style.setProperty("width", "0", "important");
      btn.style.setProperty("min-width", "0", "important");
      btn.style.setProperty("margin", "0", "important");
      btn.style.setProperty("padding", "0", "important");
    });
  }

  function getTranslateXY(transformValue) {
    var t = transformValue || "";
    var m = t.match(/translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/);
    if (!m) return { x: 0, y: 0 };
    return { x: parseFloat(m[1]) || 0, y: parseFloat(m[2]) || 0 };
  }

  function setTranslateXY(el, x, y) {
    if (!el) return;
    el.style.setProperty("transform", "translate(" + Math.round(x) + "px, " + Math.round(y) + "px)", "important");
  }

  function tightenNavControlsLayout() {
    var bottomBar = document.getElementById("bottom-bar");
    var nav = document.getElementById("nav-controls");
    if (!bottomBar || !nav) return;

    var controls = Array.from(nav.children).filter(function (el) {
      if (!el || !el.getBoundingClientRect) return false;
      var style = window.getComputedStyle(el);
      return style && style.display !== "none" && style.visibility !== "hidden";
    });
    if (!controls.length) return;

    var minX = Infinity;
    var maxX = 0;
    controls.forEach(function (el) {
      var t = el.style.transform || "";
      var m = t.match(/translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/);
      var tx = m ? parseFloat(m[1]) : (parseFloat(el.style.left) || 0);
      var w = el.getBoundingClientRect().width || parseFloat(el.style.width) || 0;
      if (tx < minX) minX = tx;
      if (tx + w > maxX) maxX = tx + w;
    });

    if (!isFinite(minX) || maxX <= 0) return;

    var innerPadding = 10;
    var neededWidth = Math.ceil(Math.max(0, maxX - minX) + (innerPadding * 2));
    var bottomW = bottomBar.getBoundingClientRect().width || parseFloat(bottomBar.style.width) || 0;
    if (bottomW <= 0) return;

    var navTransform = nav.style.transform || "";
    var navMatch = navTransform.match(/translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/);
    var navY = navMatch ? parseFloat(navMatch[2]) : 0;
    var rightMargin = 10;
    var nextX = Math.max(0, Math.round(bottomW - rightMargin - neededWidth));

    nav.style.setProperty("width", neededWidth + "px", "important");
    nav.style.setProperty("overflow", "visible", "important");
    nav.style.setProperty("transform", "translate(" + nextX + "px, " + navY + "px)", "important");
  }

  function rebalanceBottomBarControls() {
    var bottomBar = document.getElementById("bottom-bar");
    var playback = document.getElementById("playback-controls");
    var misc = document.getElementById("misc-controls");
    var nav = document.getElementById("nav-controls");
    var seek = document.getElementById("seek");
    var reset = document.getElementById("reset");
    if (!bottomBar || !playback || !misc || !nav || !seek || !reset) return;

    var bottomW = bottomBar.getBoundingClientRect().width || parseFloat(bottomBar.style.width) || 0;
    if (bottomW <= 0) return;

    var gap = 10;
    var controlGap = 4;
    var rightPadding = 10;
    var miscW = misc.getBoundingClientRect().width || parseFloat(misc.style.width) || 40;
    var navW = nav.getBoundingClientRect().width || parseFloat(nav.style.width) || 60;

    var playbackTr = getTranslateXY(playback.style.transform);
    var miscTr = getTranslateXY(misc.style.transform);
    var navTr = getTranslateXY(nav.style.transform);
    var seekTr = getTranslateXY(seek.style.transform);
    var resetTr = getTranslateXY(reset.style.transform);

    var navX = Math.max(0, Math.round(bottomW - rightPadding - navW));
    var miscX = Math.max(0, Math.round(navX - gap - miscW));
    var playbackX = Math.max(0, Math.round(playbackTr.x || 10));
    var playbackW = Math.max(220, Math.round(miscX - controlGap - playbackX));

    playback.style.setProperty("width", playbackW + "px", "important");
    setTranslateXY(playback, playbackX, playbackTr.y);
    setTranslateXY(misc, miscX, miscTr.y);
    setTranslateXY(nav, navX, navTr.y);

    var play = document.getElementById("play-pause");
    var playW = play ? (play.getBoundingClientRect().width || parseFloat(play.style.width) || 34) : 34;
    var resetW = reset.getBoundingClientRect().width || parseFloat(reset.style.width) || 30;
    var seekLeft = Math.round(playW + 10);
    var resetX = Math.max(seekLeft + 80, Math.round(playbackW - controlGap - resetW));
    var seekW = Math.max(120, Math.round(resetX - gap - seekLeft));

    setTranslateXY(reset, resetX, resetTr.y);
    seek.style.setProperty("width", seekW + "px", "important");
    setTranslateXY(seek, seekLeft, seekTr.y);
  }

  function getSlideRect() {
    var candidates = [];
    var byId = ["slide-container", "slide", "presentation", "content"];

    byId.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) candidates.push(el);
    });

    document.querySelectorAll(".slide-layer, [class*='slide-layer']").forEach(function (el) {
      candidates.push(el);
    });

    var bestRect = null;
    var bestArea = 0;
    candidates.forEach(function (el) {
      if (!el || !el.getBoundingClientRect) return;
      var rect = el.getBoundingClientRect();
      if (!rect || rect.width < 100 || rect.height < 100) return;
      var style = window.getComputedStyle(el);
      if (!style || style.display === "none" || style.visibility === "hidden") return;
      var area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        bestRect = rect;
      }
    });
    return bestRect;
  }

  function applyNavSkin() {
    var nav = document.getElementById("nav-controls");
    var prev = document.getElementById("prev");
    var next = document.getElementById("next");
    if (!nav || !prev || !next) return false;

    nav.classList.add("custom-slider-nav");
    prev.classList.add("custom-slider-nav-btn");
    next.classList.add("custom-slider-nav-btn");

    var slideRect = getSlideRect();
    var overlay = ensureOverlayRoot();
    if (slideRect && !window.__storylineSliderNavBaseWidth) {
      window.__storylineSliderNavBaseWidth = slideRect.width;
    }

    var baseWidth = window.__storylineSliderNavBaseWidth || (slideRect ? slideRect.width : 954);
    var ratio = slideRect ? (slideRect.width / baseWidth) : 1;
    var responsiveScale = Math.min(1, ratio);
    var currentButtonSize = Math.round(CONFIG.buttonSize * responsiveScale);
    var currentIconSize = Math.round(CONFIG.iconSize * responsiveScale);
    var currentOffset = Math.round(CONFIG.sideOffset * responsiveScale);
    var currentRadius = Math.min(
      Math.round(CONFIG.radius * responsiveScale),
      Math.floor(currentButtonSize / 2)
    );

    var centerY = slideRect ? (slideRect.top + (slideRect.height / 2)) : (window.innerHeight / 2);
    var leftInViewport = slideRect ? (slideRect.left + currentOffset) : currentOffset;
    var nextLeftInViewport = slideRect
      ? (slideRect.right - currentButtonSize - currentOffset)
      : (window.innerWidth - currentButtonSize - currentOffset);

    if (prev.parentNode !== overlay) overlay.appendChild(prev);
    if (next.parentNode !== overlay) overlay.appendChild(next);

    prev.style.setProperty("position", "fixed", "important");
    prev.style.setProperty("transform", "translateY(-50%) scale(var(--nav-scale, 1))", "important");
    prev.style.setProperty("top", centerY + "px", "important");
    prev.style.setProperty("left", leftInViewport + "px", "important");
    prev.style.setProperty("right", "auto", "important");
    prev.style.setProperty("z-index", String(CONFIG.zIndex + 1), "important");
    prev.style.setProperty("border-radius", currentRadius + "px", "important");
    prev.style.setProperty("width", currentButtonSize + "px", "important");
    prev.style.setProperty("height", currentButtonSize + "px", "important");

    next.style.setProperty("position", "fixed", "important");
    next.style.setProperty("transform", "translateY(-50%) scale(var(--nav-scale, 1))", "important");
    next.style.setProperty("top", centerY + "px", "important");
    next.style.setProperty("left", nextLeftInViewport + "px", "important");
    next.style.setProperty("right", "auto", "important");
    next.style.setProperty("z-index", String(CONFIG.zIndex + 1), "important");
    next.style.setProperty("border-radius", currentRadius + "px", "important");
    next.style.setProperty("width", currentButtonSize + "px", "important");
    next.style.setProperty("height", currentButtonSize + "px", "important");

    ensureArrowOnly("prev");
    ensureArrowOnly("next");

    [prev, next].forEach(function (btn) {
      var svg = btn.querySelector("svg");
      if (!svg) return;
      svg.style.setProperty("width", currentIconSize + "px", "important");
      svg.style.setProperty("height", currentIconSize + "px", "important");
    });

    return true;
  }

  function refresh() {
    injectStyles();
    applyNavSkin();
    fixPlayerBarLayout();
    tightenNavControlsLayout();
    rebalanceBottomBarControls();
    return true;
  }

  window.__storylineSliderNavRefresh = refresh;

  injectStyles();
  refresh();
  window.addEventListener("resize", refresh);
  window.addEventListener("orientationchange", refresh);
  startRefreshInterval(refresh);
})();