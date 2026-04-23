/*
 * Script: gsap-svg-text-reveal
 * Date: 2026-04-23
 * Auteur: grindghost
 */

// Anime des textes SVG avec GSAP.
// Ce script est prévu pour être utilisé avec le loader `gsap-splittype-loader`.
// Recommandation: le déclencher au début de la timeline de l'objet texte ciblé.
// Les objets à animer doivent porter l'alt-text Storyline: `anim-par-4`.
var player = GetPlayer();

if (player.GetVar('isAnimating') == false) {
  console.log('Applying text animations');

  // Cible tous les objets marqués avec l'alt-text attendu.
  var targetDivs = document.querySelectorAll("[data-acc-text='anim-par-4']");

  // Délai entre les animations de chaque bloc ciblé (en secondes).
  var delayBetweenDivs = 2;

  targetDivs.forEach(function(targetDiv, index) {
    // Rendre l'objet visible juste avant de lancer son animation.
    targetDiv.style.opacity = 1;

    // Sélectionner les lignes de texte (tspan) dans le SVG.
    var tspanElements = targetDiv.querySelectorAll('svg text tspan');

    // Marquer chaque ligne pour appliquer des animations ciblées.
    tspanElements.forEach(function(tspan) {
      tspan.classList.add('line');
    });

    // Permet d'appeler les callbacks seulement au tout début et à la toute fin.
    const isFirstDiv = index === 0;
    const isLastDiv = index === targetDivs.length - 1;

    // Timeline GSAP par objet ciblé.
    const tl = gsap.timeline({
      onStart: () => {
        if (isFirstDiv) {
          startAnimation();
        }
      },
      onComplete: () => {
        if (isLastDiv) {
          completeAnimation();
        }
      },
      delay: index * delayBetweenDivs
    });

    // 1) Animation d'entrée verticale des lignes.
    tl.from(targetDiv.querySelectorAll('.line'), {
      attr: { y: 240 },
      stagger: 0.1,
      duration: 0.5,
      ease: 'power1.out'
    });

    // 2) Fondu d'entrée des lignes (en parallèle de l'animation précédente).
    tl.from(targetDiv.querySelectorAll('.line'), {
      opacity: 0,
      duration: 0.5,
      ease: 'power1.out',
      stagger: 0.2
    }, "<");

    // Cibler les noeuds texte SVG complets.
    const textElements = targetDiv.querySelectorAll('svg text');

    // 3) Animation complémentaire sur les blocs texte (position, rotation, opacité).
    tl.from(textElements, {
      attr: { y: 240 },
      rotation: 5,
      transformOrigin: '0% 50%',
      opacity: 0,
      duration: 0.5,
      ease: 'power1.in',
      stagger: 0.2
    }, "<");
  });
}

// Callback global appelé au démarrage de la première animation.
function startAnimation() {
  console.log('Animation started');
  var player = GetPlayer();
  player.SetVar("isAnimating", true);
}

// Callback global appelé à la fin de la dernière animation.
function completeAnimation() {
  console.log('All animations complete');
  var player = GetPlayer();
  player.SetVar("isAnimating", false);
}
