// ==UserScript==
// @name         Moodle: gestión de unidades leídas
// @namespace    haz.institutortve.linaresdigital.com
// @version      2026-02-24.r2
// @description  Añade un panel para marcar como leída la unidad actual del curso Moodle guardando en almacenamiento de la extensión.
// @author       Óscar García
// @match        https://lms.haz.institutortve.com/course/view.php*
// @match        https://lms.haz.institutortve.com/course/section.php*
// @match        https://lms.haz.institutortve.com/mod/page/view.php*
// @match        https://lms.haz.institutortve.com/mod/resource/view.php*
// @match        https://lms.haz.institutortve.com/mod/scorm/view.php*
// @match        https://kaf.haz.institutortve.com/browseandembed/*

// @icon         https://www.google.com/s2/favicons?sz=64&domain=institutortve.com
// @homepageURL  https://ojgarciab.github.io/tampermonkey-publico/
// @supportURL   https://github.com/ojgarciab/tampermonkey-publico/issues
// @downloadURL  https://ojgarciab.github.io/tampermonkey-publico/rtve.haz.moodle.user.js
// @updateURL    https://ojgarciab.github.io/tampermonkey-publico/rtve.haz.moodle.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    /* Tratamos accesos al reproductor de vídeo */
    if (
        [
            "kaf.haz.institutortve.com",
        ].includes(window.location.hostname)
    ) {
        gestionarReproductor();
    } else if (
        [
            "lms.haz.institutortve.com",
        ].includes(window.location.hostname)
    ) {
        if (
            [
                "/course/view.php",
                "/course/section.php",
            ].includes(window.location.pathname)
        ) {
            gestionarListadoDeActividades();
        } else if (
            [
                "/mod/page/view.php",
                "/mod/quiz/view.php",
                "/mod/resource/view.php",
                "/mod/scorm/view.php",
            ].includes(window.location.pathname)
        ) {
            gestionarActividad();
        }
    }

    function gestionarReproductor() {
        /* global kalturaPlayer */
        // Esperamos a que el reproductor esté listo
        kalturaPlayer.ready().then(() => {
            // Al cargar los metadatos del vídeo comunicamos su duración y, en respuesta, posiblemente nos envíen de vuelta
            // la posición por la que tenemos que proseguir la reproducción
            const comprobarTotal = (ev) => {
                clearInterval(temporizadorTotal);
                try {
                    const total = typeof kalturaPlayer.duration === "function"
                    ? kalturaPlayer.duration()
                    : kalturaPlayer.duration || 0;
                    console.log("[Kaltura] Duración total (s):", total, "=>", formatTime(total));
                    window.parent.postMessage({
                        tipo: "reproductor_duracion",
                        duración: total
                    }, "*");
                } catch (err) {
                    console.error("[Kaltura] Error en LOADED_METADATA:", err);
                }
            };

            const temporizadorTotal = setTimeout(comprobarTotal, 500);
            kalturaPlayer.addEventListener(
                kalturaPlayer.Event.LOADED_METADATA,
                comprobarTotal
            );
            // Si nos llega un mensaje para cambiar el tiempo de la reproducción, lo procesamos
            window.addEventListener("message", (event) => {
                console.log("Recibido mensaje:", );
                const data = event.data;
                if (data && data.tipo === "reproductor_actual") {
                    const posición = Math.round(data.posición);
                    if (!isNaN(posición)) {
                        console.log("[Hijo] Cambiando posición a:", posición);
                        kalturaPlayer.currentTime = posición;
                    }
                }
            });
            let tiempoAnterior = 0;
            // Cuando se actualiza el tiempo de reproducción lo comunicamos al marco padre
            kalturaPlayer.addEventListener(
                kalturaPlayer.Event.TIME_UPDATE,
                (ev) => {
                    try {
                        const now = (typeof kalturaPlayer.currentTime === "function")
                        ? kalturaPlayer.currentTime()
                        : kalturaPlayer.currentTime || 0;
                        if (typeof now !== "number" || isNaN(now)) return;
                        // Enviamos el tiempo reproducido al padre, un máximo de una vez cada 2 segundos
                        const redondeo = Math.floor(now / 2) * 2;
                        if (redondeo != tiempoAnterior) {
                            tiempoAnterior = redondeo;
                            console.log("[Kaltura] Tiempo actual (s):", redondeo, "=>", formatTime(redondeo));
                            window.parent.postMessage({
                                tipo: "reproductor_actual",
                                posición: redondeo
                            }, "*");
                        }
                    } catch (err) {
                        console.error("[Kaltura] Error en TIME_UPDATE:", err);
                    }
                }
            );
            // Por si acaso, comunicamos la duración si ésta cambia
            kalturaPlayer.addEventListener(
                kalturaPlayer.Event.DURATION_CHANGED,
                () => {
                    try {
                        const total = typeof kalturaPlayer.duration === "function"
                        ? kalturaPlayer.duration()
                        : kalturaPlayer.duration || 0;
                        console.log("[Kaltura] Duración (actualizada) (s):", total, "=>", formatTime(total));
                        window.parent.postMessage({
                            tipo: "reproductor_duracion",
                            duración: total
                        }, "*");
                    } catch (err) {
                        console.error("[Kaltura] Error en DURATION_CHANGED:", err);
                    }
                }
            );
        });
    }

    function gestionarListadoDeActividades() {
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
        // Si navegamos hacia atrás o cambiamos de pestaña forzamos una actualización
        window.addEventListener("pageshow", dibujarListadoDeActividades);
        document.addEventListener("visibilitychange", dibujarListadoDeActividades);
        window.addEventListener("popstate", dibujarListadoDeActividades);
        dibujarListadoDeActividades();
    }

    function dibujarListadoDeActividades() {
        // Obtener todas las actividades del curso
        const actividades = document.querySelectorAll("li.activity.activity-wrapper");

        actividades.forEach(act => {
            const id = act.getAttribute("data-id");
            if (!id) return;

            const key = "moodleActividadLeida_" + id;
            const leida = GM_getValue(key, false);

            // Dentro del contenedor donde posicionamos el icono
            const contenedor = act.querySelector(".activity-item");
            if (!contenedor) return;
            contenedor.style.position = "relative";

            // Buscamos si ya hay un icono; si no, lo creamos
            let icon = contenedor.querySelector(".estado-lectura-listado");
            if (!icon) {
                icon = document.createElement("div");
                icon.classList.add("estado-lectura-listado");
                contenedor.appendChild(icon);
            }

            // Actualizamos clases y contenido (idempotente)
            icon.classList.toggle("estado-lectura-leido", leida);
            icon.classList.toggle("estado-lectura-noleido", !leida);
            icon.textContent = leida ? "✓" : "✘";
        });
    }

    function gestionarActividad() {
        // 1. Obtenemos el ID de la actividad: ?id=1234
        const params = new URLSearchParams(window.location.search);
        const actividadId = params.get("id");
        if (!actividadId) return;

        const storageKey = "moodleActividadLeida_" + actividadId;
        let estadoLeido = GM_getValue(storageKey, false);

        //2 Obtener información del breadcrumb
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

        // Estilos
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
            /* --- Reproducción --- */
            #rep-titulo {
                margin-top: 12px;
                font-size: 16px;
            }
            #rep-tiempo {
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
                background: #f6f7f9;
                border: 1px solid #e3e6ea;
                border-radius: 4px;
                padding: 6px 8px;
            }
            #rep-barra {
                position: relative;
                height: 8px;
                background: #eee;
                border-radius: 4px;
                overflow: hidden;
                margin-top: 8px;
            }
            #rep-progreso {
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #0a8a0a, #31b331);
                transition: width .2s linear;
            }
            #rep-reanudar {
                background: #0b5ed7;
                color: white;
                border: none;
                padding: 8px 10px;
                width: 100%;
                cursor: pointer;
                border-radius: 6px;
                font-size: 14px;
                margin-top: 10px;
            }
            #rep-reanudar:disabled {
                opacity: .5;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);

        // Botón flotante
        const btn = document.createElement("button");
        btn.id = "leido-btn";
        btn.classList.add(estadoLeido ? "leido" : "noleido");
        btn.textContent = estadoLeido ? "✓" : "✘";
        document.body.appendChild(btn);

        // Panel lateral
        const panel = document.createElement("div");
        panel.id = "panel-leido";
        panel.innerHTML = `
            <h2>Actividad actual</h2>
            <p><strong>Curso:</strong><br>${nombreCurso}</p>
            <p><strong>Unidad:</strong><br>${nombreUnidad}</p>
            <p><strong>Actividad:</strong><br>${nombreActividad}</p>
            <hr/>
            <p>Estado: <span id="estado-texto">${estadoLeido ? "Leída ✔" : "No leída ✘"}</span></p>
            <button id="btn-marcar" class="${estadoLeido ? "" : "no"}">
                ${estadoLeido ? "Marcar como NO leída" : "Marcar como leída"}
            </button>
            <hr/>
            <h3 id="rep-titulo">Reproducción</h3>
            <div id="rep-tiempo">00:00 / 00:00 (0%)</div>
            <div id="rep-barra"><div id="rep-progreso"></div></div>
        `;
        document.body.appendChild(panel);
        //document.getElementById("region-main").appendChild(panel);

        // Lógica de interacción
        btn.addEventListener("click", () => {
            panel.classList.toggle("open");
        });

        const btnMarcar = panel.querySelector("#btn-marcar");
        const estadoTexto = panel.querySelector("#estado-texto");

        // TODO: llamar a agregar/actualizar una representación del porcentaje de reproducción del vídeo (si hay datos almacenados)
        // TODO: esperar eventos del navegador para refrescar la representación cuando se navega por páginas o cambia de pestaña

        // Claves de almacenamiento para reproducción (por actividad) impidiendo colisión con las claves por URL
        const durKey = `~dur_${actividadId}`;
        const posKey = `~pos_${actividadId}`;

        // Elementos de UI de reproducción
        const repTiempo = panel.querySelector("#rep-tiempo");
        const repProgreso = panel.querySelector("#rep-progreso");

        // Helpers de almacenamiento
        const leerDuracion = () => parseInt(GM_getValue(durKey) || "0", 10);
        const leerPosicion = () => parseInt(GM_getValue(posKey) || "0", 10);
        const guardarDuracion = (total) => GM_setValue(durKey, String(Math.max(0, Math.round(total || 0))));
        const guardarPosicion = (pos) => GM_setValue(posKey, String(Math.max(0, Math.round(pos || 0))));

        // Refresca la representación del estado de reproducción en el panel
        function refrescarReproduccion() {
            const d = leerDuracion();
            // Nunca muestres posición > duración
            const p = Math.min(leerPosicion(), d || Number.MAX_SAFE_INTEGER);
            const porcentaje = d > 0 ? Math.floor((p / d) * 100) : 0;

            repTiempo.textContent = `${formatTime(p)} / ${formatTime(d)} (${porcentaje}%)`;
            repProgreso.style.width = d > 0 ? `${Math.min(100, (p / d) * 100)}%` : "0%";
        }
        document.addEventListener("visibilitychange", refrescarReproduccion);
        window.addEventListener("pageshow", refrescarReproduccion);
        window.addEventListener("popstate", refrescarReproduccion);

        // Pinta estado inicial
        refrescarReproduccion();

        btnMarcar.addEventListener("click", () => {
            estadoLeido = !estadoLeido;
            GM_setValue(storageKey, estadoLeido);

            // Panel
            estadoTexto.textContent = estadoLeido ? "Leída ✔" : "No leída ✘";
            btnMarcar.textContent = estadoLeido ? "Marcar como NO leída" : "Marcar como leída";
            btnMarcar.classList.toggle("no");

            // Botón flotante
            btn.textContent = estadoLeido ? "✓" : "✘";
            btn.classList.toggle("leido");
            btn.classList.toggle("noleido");
        });

        window.addEventListener("message", (event) => {
            const data = event.data;
            // Salida prematura si no se entrega el tipo
            if (data.tipo === null) return;
            if (data.tipo === "reproductor_duracion") {
                console.log("Recibida duración:", data.duración);
                // Guardar en localStorage la duración total
                const total = Math.round(Number(data.duración) || 0);
                if (total > 0) {
                    guardarDuracion(total);
                    refrescarReproduccion();
                }

                // Enviar al marco hijo la posición almacenada (para continuar donde lo dejó)
                const pos = leerPosicion();
                console.log("Enviando al hijo posición:", pos);
                if (pos > 0) {
                    event.source.postMessage({
                        tipo: "reproductor_actual",
                        posición: pos
                    }, "*");
                }
            } else if (data.tipo === "reproductor_actual") {
                // Guardar posición actual y refrescar UI
                const pos = Math.round(Number(data.posición) || 0);
                guardarPosicion(pos);
                refrescarReproduccion();
            }
        });
    }

    // Damos formato al tiempo: formato mm:ss o hh:mm:ss
    function formatTime(seconds) {
        const dosCifras = (n) => String(n).padStart(2, "0");
        if (isNaN(seconds) || seconds == null || seconds === 0) return "00:00";
        seconds = Math.max(0, Math.floor(seconds));
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return h > 0 ? `${h}:${dosCifras(m)}:${dosCifras(s)}` : `${dosCifras(m)}:${dosCifras(s)}`;
    }
})();
