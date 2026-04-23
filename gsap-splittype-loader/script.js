/*
 * Script: gsap-splittype-loader
 * Date: 2026-04-23
 * Auteur: grindghost
 */

// Chargement des librairies externes utilisées pour les animations
// Récupérer le <head> du document pour y injecter les scripts
var head = document.getElementsByTagName('head')[0];

// Ajouter SplitType (utile pour découper le texte avant animation)
var splitTypeScript = document.createElement('script');
splitTypeScript.type = 'text/javascript';
splitTypeScript.src = "https://unpkg.com/split-type";
head.appendChild(splitTypeScript);

// Ajouter GSAP (moteur d'animation)
var gsapScript = document.createElement('script');
gsapScript.type = 'text/javascript';
gsapScript.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.11.4/gsap.min.js";
head.appendChild(gsapScript);

// Masquer au chargement les éléments balisés avec l'alt-text "anim-par"
// Ces éléments seront affichés ensuite par les animations GSAP
var elements = document.querySelectorAll("[data-acc-text='anim-par']");
elements.forEach(function(element) {
    element.style.opacity = 0;
});