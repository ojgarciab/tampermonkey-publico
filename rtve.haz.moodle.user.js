// ==UserScript==
// @name         Moodle: Marcar Unidades como Leídas
// @namespace    http://tampermonkey.net/
// @version      2026-02-23
// @description  Añade un panel para marcar como leída la unidad actual del curso Moodle guardando en localStorage.
// @author       Óscar García
// @match        https://lms.haz.institutortve.com/course/view.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=institutortve.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    /*********************************
     * 1. Identificar la unidad
     *********************************/
    const unidadId = window.location.pathname; // Usamos la URL completa como ID única
    const storageKey = "moodleLeido_" + unidadId;

    // Cargar estado
    let estadoLeido = localStorage.getItem(storageKey) === "true";

    /*********************************
     * 2. Estilos básicos
     *********************************/
    const style = document.createElement("style");
    style.innerHTML = `
        #leido-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #0055aa;
            color: white;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            cursor: pointer;
            border: none;
            font-size: 22px;
            z-index: 99999;
            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
        }
        #panel-leido {
            position: fixed;
            top: 0;
            right: -260px;
            width: 250px;
            height: 100%;
            background: white;
            box-shadow: -3px 0 10px rgba(0,0,0,0.3);
            padding: 20px;
            transition: right 0.25s ease;
            z-index: 99998;
            font-family: Arial, sans-serif;
        }
        #panel-leido.open {
            right: 0;
        }
        #panel-leido h2 {
            font-size: 18px;
            margin-top: 0;
        }
        #btn-marcar {
            background: #007700;
            color: white;
            border: none;
            padding: 10px;
            width: 100%;
            cursor: pointer;
            border-radius: 6px;
            font-size: 15px;
            margin-top: 15px;
        }
        #btn-marcar.no {
            background: #aa0000;
        }
    `;
    document.head.appendChild(style);

    /*********************************
     * 3. Crear botón flotante
     *********************************/
    const btn = document.createElement("button");
    btn.id = "leido-btn";
    btn.innerHTML = "✓";
    document.body.appendChild(btn);

    /*********************************
     * 4. Crear panel lateral
     *********************************/
    const panel = document.createElement("div");
    panel.id = "panel-leido";
    panel.innerHTML = `
        <h2>Unidad actual</h2>
        <p><strong>${unidadId}</strong></p>
        <hr>
        <p>Estado: <span id="estado-texto">${estadoLeido ? "Leída ✔" : "No leída ✘"}</span></p>
        <button id="btn-marcar" class="${estadoLeido ? "" : "no"}">
            ${estadoLeido ? "Marcar como NO leída" : "Marcar como leída"}
        </button>
    `;
    document.body.appendChild(panel);

    /*********************************
     * 5. Comportamiento
     *********************************/

    // Abrir/cerrar el panel
    btn.addEventListener("click", () => {
        panel.classList.toggle("open");
    });

    // Marcar como leído
    const btnMarcar = panel.querySelector("#btn-marcar");
    const estadoTexto = panel.querySelector("#estado-texto");

    btnMarcar.addEventListener("click", () => {
        estadoLeido = !estadoLeido;
        localStorage.setItem(storageKey, estadoLeido);

        estadoTexto.textContent = estadoLeido ? "Leída ✔" : "No leída ✘";
        btnMarcar.textContent = estadoLeido ? "Marcar como NO leída" : "Marcar como leída";
        btnMarcar.classList.toggle("no");
    });

})();
