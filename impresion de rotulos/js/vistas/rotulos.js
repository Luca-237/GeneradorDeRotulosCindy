// =====================================================================
//  Vista: datos del envío, medida, remitente, vista previa e impresión.
// =====================================================================
(function (R) {
  const { $, up, toast } = R.util;
  // Medida y papel: preferencia de cada computadora. (v2: default pasó a la etiqueta de 10 × 6,5 cm)
  const LS_PREFS = "rotulos.prefs.v2";

  function leerDatos() {
    return {
      nombre: up($("nombre").value), direccion: up($("direccion").value), ciudad: up($("ciudad").value),
      provincia: up($("provincia").value), cp: up($("cp").value), dni: up($("dni").value),
      tel: up($("tel").value), email: up($("email").value), transporte: up($("transporte").value),
      remitente: [1, 2, 3, 4].map(i => up($("rem" + i).value)).filter(Boolean),
    };
  }

  // ---------- Medida y papel ----------
  function aplicarMedida() {
    const ancho = +$("ancho").value, alto = +$("alto").value, papel = $("papel").value;
    document.body.classList.toggle("modo-etiqueta", papel === "etiqueta");
    document.body.classList.toggle("modo-a4", papel !== "etiqueta");
    const css = document.documentElement.style;
    css.setProperty("--w", ancho + "cm");
    css.setProperty("--h", alto + "cm");
    css.setProperty("--ar", `${ancho} / ${alto}`);
    // Ajuste fino de impresión (calibración de la impresora de cada PC)
    css.setProperty("--esc", (+$("ajuste-escala").value || 100) / 100);
    css.setProperty("--dx", (+$("ajuste-x").value || 0) + "mm");
    css.setProperty("--dy", (+$("ajuste-y").value || 0) + "mm");

    // Corrección de escala de la impresora: si 1 cm sale impreso como 7,5 mm, todo se
    // manda agrandado ×(10/7,5) para que, después del achique del driver, quede exacto.
    // Solo en modo etiqueta; la vista previa de pantalla no cambia.
    const k = factorImpresora();
    const ep = papel === "etiqueta" ? k : 1;
    css.setProperty("--wp", (ancho * ep).toFixed(3) + "cm");
    css.setProperty("--hp", (alto * ep).toFixed(3) + "cm");
    css.setProperty("--dxp", ((+$("ajuste-x").value || 0) * ep).toFixed(2) + "mm");
    css.setProperty("--dyp", ((+$("ajuste-y").value || 0) * ep).toFixed(2) + "mm");

    // Giro (solo modo etiqueta): la página va parada y el rótulo girado 90° adentro.
    // Con la Zebra GK420t bien configurada NO hace falta (default "no").
    const giro = papel === "etiqueta" ? $("ajuste-giro").value : "no";
    document.body.classList.toggle("girar", giro !== "no");
    document.body.classList.toggle("girar-der", giro === "der");
    document.body.classList.toggle("girar-izq", giro === "izq");
    const [pw, ph] = giro !== "no" ? [alto * ep, ancho * ep] : [ancho * ep, alto * ep];
    const page = papel !== "etiqueta" ? `size: A4 ${papel === "a4h" ? "landscape" : "portrait"}; margin: 8mm;`
      : `size: ${pw.toFixed(3)}cm ${ph.toFixed(3)}cm; margin: 0;`;
    $("page-style").textContent = `@page { ${page} }`;
  }

  // 10 / (mm que mide 1 cm impreso). 10 = sin corrección. Límites por las dudas.
  function factorImpresora() {
    const mm = +$("ajuste-cm").value;
    return mm >= 5 && mm <= 15 ? 10 / mm : 1;
  }

  function setAncho(v) {
    $("ancho").value = (+v).toFixed(1);
    $("alto").value = (v / R.rotulo.RATIO).toFixed(1);
  }

  // Preset "10x6.5" = hoja de medida fija (etiqueta física): el rótulo se dibuja
  // con su proporción original y queda centrado (SVG con preserveAspectRatio="meet").
  // Preset "15" = solo ancho; el alto sale de la proporción del rótulo.
  function setMedida(preset) {
    const [w, h] = String(preset).split("x").map(Number);
    if (h) { $("ancho").value = w.toFixed(1); $("alto").value = h.toFixed(1); }
    else setAncho(w);
  }

  // ---------- Vista previa ----------
  let timer;
  function render() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const d = leerDatos();
      const total = Math.max(1, Math.min(500, parseInt($("total").value, 10) || 1));
      let nums;
      try {
        nums = R.rotulo.parseSolo($("solo").value, total) || Array.from({ length: total }, (_, i) => i + 1);
        $("err-solo").hidden = true;
      } catch (e) {
        $("err-solo").textContent = e.message; $("err-solo").hidden = false;
        nums = [];
      }
      const opciones = { intensidad: $("ajuste-intensidad").value };
      // Cada rótulo va en una "hoja" del tamaño exacto de la etiqueta; adentro se escala/mueve
      // .giro: rota el rótulo 90° solo al imprimir, si la etiqueta sale "de punta"
      $("hojas").innerHTML = nums.map(n => `<div class="hoja"><div class="giro">${R.rotulo.svg(d, n, total, opciones)}</div></div>`).join("");
      R.rotulo.ajustarTextos($("hojas"));
      const cant = nums.length;
      $("preview-head").textContent = cant ? `Vista previa: ${cant} rótulo${cant > 1 ? "s" : ""} (${nums[0]}/${total} a ${nums[cant - 1]}/${total})` : "";
      $("resumen").textContent = cant ? `Se van a imprimir ${cant} rótulo${cant > 1 ? "s" : ""} de ${$("ancho").value} × ${$("alto").value} cm.` : "";
      $("imprimir").disabled = !cant;
      document.title = d.nombre ? `Rotulos ${d.nombre}` : "Generador de rótulos";
      guardarPreferencias();
    }, 120);
  }

  // ---------- Preferencias locales (medida / papel / calibración de la impresora) ----------
  // giro "no": en la Zebra GK420t de Cindy la etiqueta sale con los 10 cm a lo ancho del
  // cabezal (foto del 23/10/2026), así que la hoja de 10 × 6,5 entra tal cual si el driver
  // está en papel 100 × 65 y orientación Vertical. Los giros de la app quedan solo como
  // recurso si no se puede tocar el driver. v: versión del ajuste guardado; con una versión
  // anterior se descarta el giro guardado (venía de las pruebas) y vuelve a "no".
  // cm: cuántos mm mide 1 cm impreso (10 = la impresora no achica)
  const AJUSTE_DEFAULT = { escala: 100, x: 0, y: 0, intensidad: "reforzada", giro: "no", cm: 10, v: 3 };
  const GIROS = ["der", "izq", "no"];

  function guardarPreferencias() {
    try {
      localStorage.setItem(LS_PREFS, JSON.stringify({
        ancho: $("ancho").value, alto: $("alto").value, preset: $("preset").value, papel: $("papel").value,
        ajuste: { escala: $("ajuste-escala").value, x: $("ajuste-x").value, y: $("ajuste-y").value, intensidad: $("ajuste-intensidad").value, giro: $("ajuste-giro").value, cm: $("ajuste-cm").value, v: AJUSTE_DEFAULT.v },
      }));
    } catch (e) {}
  }

  function setAjuste(a) {
    if (a && (a.v || 0) < AJUSTE_DEFAULT.v) a = { ...a, giro: AJUSTE_DEFAULT.giro };
    a = { ...AJUSTE_DEFAULT, ...(a || {}) };
    $("ajuste-escala").value = a.escala;
    $("ajuste-cm").value = a.cm;
    $("ajuste-x").value = a.x;
    $("ajuste-y").value = a.y;
    $("ajuste-intensidad").value = R.rotulo.TRAZO[a.intensidad] !== undefined ? a.intensidad : AJUSTE_DEFAULT.intensidad;
    $("ajuste-giro").value = GIROS.includes(a.giro) ? a.giro : AJUSTE_DEFAULT.giro;
  }
  function cargarPreferencias() {
    let p = {};
    try { p = JSON.parse(localStorage.getItem(LS_PREFS)) || {}; } catch (e) {}
    if (p.preset) $("preset").value = p.preset;
    if (p.ancho) $("ancho").value = p.ancho;
    if (p.alto) $("alto").value = p.alto;
    if (p.papel) $("papel").value = p.papel;
    setAjuste(p.ajuste);
  }

  // ---------- Remitente (compartido en la base; lo cambia un superadmin) ----------
  function setRemitente(lineas) {
    const l = Array.isArray(lineas) && lineas.length ? lineas : R.rotulo.REMITENTE_DEFAULT;
    [1, 2, 3, 4].forEach(i => { $("rem" + i).value = l[i - 1] || ""; });
    render();
  }
  async function guardarRemitente() {
    const lineas = [1, 2, 3, 4].map(i => up($("rem" + i).value));
    try {
      await R.api.config.guardar("remitente", lineas);
      toast("Remitente guardado para todos los usuarios.");
    } catch (e) { toast(e.message, "error"); }
  }

  // Hoja de prueba: una sola página, del tamaño exacto que se manda a la impresora
  // (con giro, parada). No pasa por .giro ni por el ajuste fino: muestra la página tal cual.
  function imprimirPrueba() {
    const ancho = +$("ancho").value, alto = +$("alto").value;
    const parada = $("papel").value === "etiqueta" && $("ajuste-giro").value !== "no";
    const [pw, ph] = parada ? [alto, ancho] : [ancho, alto];
    clearTimeout(timer);
    // Medidas físicas deseadas; la corrección de escala se aplica igual que al rótulo
    $("hojas").innerHTML = `<div class="hoja hoja-prueba">${R.rotulo.svgPrueba(pw, ph, +$("ajuste-cm").value || 10)}</div>`;
    window.addEventListener("afterprint", () => render(), { once: true });
    window.print();
  }

  async function imprimir() {
    // Antes de imprimir, que el cliente quede guardado para la próxima
    await R.vistaClientes.antesDeImprimir();
    window.print();
  }

  function iniciar() {
    $("preset").addEventListener("change", e => {
      if (e.target.value !== "custom") setMedida(e.target.value);
      aplicarMedida(); render();
    });
    $("ancho").addEventListener("input", e => {
      $("preset").value = "custom";
      if (+e.target.value > 0) $("alto").value = (e.target.value / R.rotulo.RATIO).toFixed(1);
      aplicarMedida(); render();
    });
    $("alto").addEventListener("input", e => {
      $("preset").value = "custom";
      if (+e.target.value > 0) $("ancho").value = (e.target.value * R.rotulo.RATIO).toFixed(1);
      aplicarMedida(); render();
    });
    $("papel").addEventListener("change", () => { aplicarMedida(); render(); });
    ["ajuste-escala", "ajuste-x", "ajuste-y", "ajuste-cm"].forEach(id => $(id).addEventListener("input", () => { aplicarMedida(); render(); }));
    $("ajuste-intensidad").addEventListener("change", render);
    $("ajuste-giro").addEventListener("change", () => { aplicarMedida(); render(); });
    $("ajuste-reset").addEventListener("click", () => { setAjuste(); aplicarMedida(); render(); });
    $("imprimir-prueba").addEventListener("click", imprimirPrueba);
    document.querySelectorAll("[data-campo]").forEach(el => el.addEventListener("input", () => {
      render();
      R.vistaClientes.actualizarEstado();
    }));
    $("imprimir").addEventListener("click", imprimir);
    $("guardar-remitente").addEventListener("click", guardarRemitente);

    cargarPreferencias();
    if ($("preset").value !== "custom") setMedida($("preset").value);
    else if (!+$("alto").value) setAncho(+$("ancho").value);
    aplicarMedida();
  }

  R.vistaRotulos = { iniciar, render, setRemitente };
})(window.Rotulos);
