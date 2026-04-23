/*
 * Script: storyline-svg-pause-sync
 * Date: 2026-04-23
 * Auteur: grindghost
 */

// Synchronise l'etat Play/Pause du player Storyline avec des animations SVG.
// Cas d'usage initial: mettre en pause l'animation d'une waveform SVG quand l'audio Storyline se termine.
(function () {
    // Evite d'installer plusieurs fois les memes listeners sur la meme page.
    if (window.__pauseFreezeInstalled) return;
    window.__pauseFreezeInstalled = true;
  
    console.log("[PauseFreeze] init");
  
    const STYLE_ID = "pause-freeze-css";
  
    // Injecte le style qui fige les animations CSS cibles quand Storyline est en pause.
    function ensureFreezeStyle() {
      if (document.getElementById(STYLE_ID)) return;
  
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        /* Quand Storyline est en pause, on fige les animations CSS SVG cibles */
        [class*="bar"] {
          animation-play-state: paused !important;
        }
      `;
      document.head.appendChild(style);
      console.log("[PauseFreeze] style added");
    }
  
    function removeFreezeStyle() {
      const style = document.getElementById(STYLE_ID);
      if (!style) return;
      style.remove();
      console.log("[PauseFreeze] style removed");
    }
  
    // Derive l'etat pause/play a partir du bouton natif Storyline.
    function deriveIsPaused(btn) {
      const label = (btn.getAttribute("aria-label") || "").toLowerCase();
      // Quand Storyline est en pause, le bouton montre "Play"
      if (label.includes("play")) return true;
      if (label.includes("pause")) return false;
  
      // fallback icône
      if (btn.querySelector("#icon-play")) return true;
      if (btn.querySelector("#icon-pause")) return false;
  
      return false;
    }
  
    let last = null;
  
    // Applique l'etat seulement s'il a change pour eviter les operations inutiles.
    function applyPaused(paused) {
      if (paused === last) return;
      last = paused;
  
      if (paused) ensureFreezeStyle();
      else removeFreezeStyle();
  
      console.log("[PauseFreeze] paused =", paused);
    }
  
    // Branche les ecoutes sur le bouton Play/Pause.
    function hook(btn) {
      // Initialisation immediate de l'etat au moment du hook.
      applyPaused(deriveIsPaused(btn));
  
      // Au clic, relit l'etat au prochain frame (apres mise a jour du DOM Storyline).
      btn.addEventListener(
        "click",
        () => requestAnimationFrame(() => applyPaused(deriveIsPaused(btn))),
        { passive: true }
      );
  
      // Couvre aussi les changements externes (raccourci clavier, API, etc.).
      const mo = new MutationObserver(() => applyPaused(deriveIsPaused(btn)));
      mo.observe(btn, {
        attributes: true,
        attributeFilter: ["aria-label", "aria-pressed"],
        childList: true,
        subtree: true,
      });
  
      console.log("[PauseFreeze] hooked");
    }
  
    // Attend que Storyline rende le bouton Play/Pause avant de brancher le script.
    const interval = setInterval(() => {
      const btn = document.getElementById("play-pause");
      if (!btn) return;
      clearInterval(interval);
      hook(btn);
    }, 250);
  })();
  