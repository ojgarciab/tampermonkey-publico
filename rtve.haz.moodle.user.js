// ==UserScript==
// @name         Moodle: Marcar Unidades como Leídas
// @namespace    http://tampermonkey.net/
// @version      2026-02-23.fix2
// @description  Añade un panel para marcar como leída la unidad actual del curso Moodle guardando en localStorage.
// @author       Óscar García
// @match        https://lms.haz.institutortve.com/course/view.php*
// @match        https://lms.haz.institutortve.com/mod/page/view.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=institutortve.com
// @homepageURL  https://ojgarciab.github.io/tampermonkey-publico/
// @supportURL   https://github.com/ojgarciab/tampermonkey-publico/issues
// @downloadURL  https://ojgarciab.github.io/tampermonkey-publico/rtve.haz.moodle.user.js
// @updateURL    https://ojgarciab.github.io/tampermonkey-publico/rtve.haz.moodle.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.location.pathname.includes("/course/view.php")) {
        const styleListado = document.createElement("style");
        styleListado.innerHTML = `
        .estado-lectura-listado {
            position: absolute;
            top: 5px;
            right: 8px;
            font-size: 200%;
            font-weight: bold;
            z-index: 10;
            pointer-events: none;
        }
        .estado-lectura-leido {
            color: #0a8a0a;
        }
        .estado-lectura-noleido {
            color: #b00000;
        }
        `;
        document.head.appendChild(styleListado);

        // Obtener todas las actividades del curso
        const actividades = document.querySelectorAll("li.activity.activity-wrapper");

        actividades.forEach(act => {
            const id = act.getAttribute("data-id");
            if (!id) return;

            const key = "moodleActividadLeida_" + id;
            const leida = localStorage.getItem(key) === "true";

            // Crear icono
            const icon = document.createElement("div");
            icon.classList.add("estado-lectura-listado");
            icon.classList.add(leida ? "estado-lectura-leido" : "estado-lectura-noleido");
            icon.textContent = leida ? "✓" : "✘";

            // Insertarlo dentro del recuadro de la actividad
            const contenedor = act.querySelector(".activity-item");
            contenedor.style.position = "relative";
            contenedor.appendChild(icon);
        });
        return;
    }

    /********************************************
     * 1. Obtener el ID de la actividad: ?id=1234
     ********************************************/
    const params = new URLSearchParams(window.location.search);
    const actividadId = params.get("id");
    if (!actividadId) return;

    const storageKey = "moodleActividadLeida_" + actividadId;
    let estadoLeido = localStorage.getItem(storageKey) === "true";

    /********************************************
     * 2. Obtener información del breadcrumb
     ********************************************/
    const breadcrumbItems = document.querySelectorAll("#page-navbar .breadcrumb-item");

    let nombreCurso = "";
    let nombreUnidad = "";
    let nombreActividad = document.title || window.location.pathname;

    if (breadcrumbItems.length >= 1) {
        nombreCurso = breadcrumbItems[0].innerText.trim();
    }
    if (breadcrumbItems.length >= 2) {
        nombreUnidad = breadcrumbItems[1].innerText.trim();
    }
    if (breadcrumbItems.length >= 3) {
        nombreActividad = breadcrumbItems[2].innerText.trim();
    }

    /********************************************
     * 3. Estilos
     ********************************************/
    const style = document.createElement("style");
    style.innerHTML = `
        #leido-btn {
            position: fixed;
            top: 10px;
            right: 10px;
            border-radius: 50%;
            width: 55px;
            height: 55px;
            cursor: pointer;
            border: none;
            font-size: 26px;
            font-weight: bold;
            z-index: 99999;
            box-shadow: 0 3px 8px rgba(0,0,0,0.30);
            display: flex;
            justify-content: center;
            align-items: center;
            transition: background 0.2s ease;
        }
        #leido-btn.leido {
            background: #0a8a0a; color: white;
        }
        #leido-btn.noleido {
            background: #b00000; color: white;
        }

        #panel-leido {
            position: fixed;
            top: 0;
            right: -260px;
            width: 250px;
            height: 100%;
            background: #fff;
            box-shadow: -3px 0 10px rgba(0,0,0,0.25);
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
            background: #0a8a0a;
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
            background: #b00000;
        }
        hr {
            margin: 10px 0;
        }
    `;
    document.head.appendChild(style);

    /********************************************
     * 4. Botón flotante
     ********************************************/
    const btn = document.createElement("button");
    btn.id = "leido-btn";
    btn.classList.add(estadoLeido ? "leido" : "noleido");
    btn.textContent = estadoLeido ? "✓" : "✘";
    document.body.appendChild(btn);

    /********************************************
     * 5. Panel lateral
     ********************************************/
    const panel = document.createElement("div");
    panel.id = "panel-leido";
    panel.innerHTML = `
        <h2>Actividad actual</h2>
        <p><strong>Curso:</strong><br>${nombreCurso}</p>
        <p><strong>Unidad:</strong><br>${nombreUnidad}</p>
        <p><strong>Actividad:</strong><br>${nombreActividad}</p>

        <hr>

        <p>Estado: <span id="estado-texto">${estadoLeido ? "Leída ✔" : "No leída ✘"}</span></p>

        <button id="btn-marcar" class="${estadoLeido ? "" : "no"}">
            ${estadoLeido ? "Marcar como NO leída" : "Marcar como leída"}
        </button>
    `;
    document.body.appendChild(panel);
    //document.getElementById("region-main").appendChild(panel);

    /********************************************
     * 6. Lógica de interacción
     ********************************************/
    btn.addEventListener("click", () => {
        panel.classList.toggle("open");
    });

    const btnMarcar = panel.querySelector("#btn-marcar");
    const estadoTexto = panel.querySelector("#estado-texto");

    btnMarcar.addEventListener("click", () => {
        estadoLeido = !estadoLeido;
        localStorage.setItem(storageKey, estadoLeido);

        // Panel
        estadoTexto.textContent = estadoLeido ? "Leída ✔" : "No leída ✘";
        btnMarcar.textContent = estadoLeido ? "Marcar como NO leída" : "Marcar como leída";
        btnMarcar.classList.toggle("no");

        // Botón flotante
        btn.textContent = estadoLeido ? "✓" : "✘";
        btn.classList.toggle("leido");
        btn.classList.toggle("noleido");
    });

})();
