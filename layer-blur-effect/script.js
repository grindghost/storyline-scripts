/*
 * Script: layer-blur-effect
 * Date: 2026-04-23
 * Auteur: grindghost
 */

function applyBlurEffectWithDynamicCSS() {
    // Classe CSS utilisée pour appliquer l'effet de flou.
    const css = `.blurred-layer {
      filter: blur(3px);
      transition: filter 0.5s ease;
    }`;
  
    // Injecter le style une seule fois dans le <head>.
    if (!document.getElementById('blurred-layer-style')) {
      const style = document.createElement('style');
      style.id = 'blurred-layer-style';
      style.type = 'text/css';
      style.appendChild(document.createTextNode(css));
      document.head.appendChild(style);
    }
  
    // Repérer le calque d'interface toujours au-dessus (si présent),
    // afin de l'exclure du tri des calques de contenu.
    const persistentObject = document.querySelector(".slide-object.slide-object-vectorshape[data-model-id='61PEVra1LAv']");
    const globalTopLayer = persistentObject ? persistentObject.closest("[class*='slide-layer']") : null;
    
    // Récupérer uniquement les calques actuellement visibles.
    const allLayers = Array.from(document.querySelectorAll('.slide-layer')).filter(layer => {
      const style = window.getComputedStyle(layer);
      return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;
    });
  
    // Réinitialiser les flous appliqués lors d'une exécution précédente.
    allLayers.forEach(layer => layer.classList.remove('blurred-layer'));
  
    // Exclure le calque global supérieur du tri des calques de contenu.
    const contentLayers = allLayers.filter(layer => layer !== globalTopLayer);
  
    // S'il n'y a pas assez de calques visibles, ne rien faire.
    if (contentLayers.length < 2) return;
  
    // Trier les calques visibles du plus haut z-index au plus bas.
    const sortedByZ = contentLayers.sort((a, b) => {
      const zA = parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
      const zB = parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
      return zB - zA;
    });
  
    // Conserver le calque de contenu le plus haut net, et flouter celui juste en dessous.
    const secondContentLayer = sortedByZ[1];
  
    // Appliquer le flou au deuxième calque de contenu visible.
    secondContentLayer.classList.add('blurred-layer');
  }
  
  // Exécuter immédiatement le script.
  applyBlurEffectWithDynamicCSS();
  