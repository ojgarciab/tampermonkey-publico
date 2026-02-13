// ==UserScript==
// @name         Reductor de la altura de la barra de subtítulos de Teams
// @namespace    https://github.com/ojgarciab
// @version      0.2
// @description  try to take over the world!
// @author       Óscar García
// @match        https://teams.microsoft.com/v2/*
// @match        https://teams.microsoft.com/l/meetup-join/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=microsoft.com
// @homepageURL  https://ojgarciab.github.io/tampermonkey-publico/
// @supportURL   https://github.com/ojgarciab/tampermonkey-publico/issues
// @downloadURL  https://ojgarciab.github.io/tampermonkey-publico/teams.reductor-altura-subtitulos.user.js
// @updateURL    https://ojgarciab.github.io/tampermonkey-publico/teams.reductor-altura-subtitulos.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const subtítulosTamaño = "20%";
    /* Hacemos una comprobación cada segundo y medio hasta que se realice el cambio */
    const temporizador = setInterval(
        () => {
            // document.querySelector('[data-tid="closed-caption-renderer-wrapper"]').style.height = "20%";
            const subtítulos = document.querySelector('[data-tid="closed-caption-renderer-wrapper"]');
            if (subtítulos) {
                subtítulos.style.height = subtítulosTamaño;
                clearInterval(temporizador);
            }
        },
        1_500
    );
})();
