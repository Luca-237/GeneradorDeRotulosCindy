
window.Rotulos = window.Rotulos || {};

(function (R) {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const up = s => (s || "").trim().toUpperCase();
  // Para comparar/buscar: sin tildes, mayúsculas, sin espacios extremos
  const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  const digitos = s => (s || "").replace(/\D/g, "");
  const esNumero = s => /^[\d\s\-+.]+$/.test(s);

  // Usuario <-> email de login. "Luca" -> "luca@rotulos.cindymayorista.com.ar";
  // si ya escribieron un email completo, se respeta.
  const dominioUsuarios = () => ((window.ROTULOS_CONFIG || {}).dominioUsuarios || "rotulos.local").toLowerCase();
  const aEmail = u => {
    const s = String(u || "").trim().toLowerCase();
    return s.includes("@") ? s : `${s}@${dominioUsuarios()}`;
  };
  const aUsuario = email => {
    const s = String(email || "").toLowerCase(), sufijo = "@" + dominioUsuarios();
    return s.endsWith(sufijo) ? s.slice(0, -sufijo.length) : s;
  };

  let timerToast;
  function toast(mensaje, tipo = "ok", ms = 3500) {
    const el = $("toast");
    el.textContent = mensaje;
    el.classList.toggle("error", tipo === "error");
    el.hidden = false;
    clearTimeout(timerToast);
    timerToast = setTimeout(() => { el.hidden = true; }, ms);
  }

  function descargarJSON(nombreArchivo, datos) {
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombreArchivo;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Íconos de interfaz (Lucide, SVG en línea; nunca emojis)
  const ICONOS = {
    usuarioNuevo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`,
  };

  // Confirmación dentro de la página (no usa confirm() del navegador, que algunos
  // navegadores bloquean). Devuelve una promesa: true = Aceptar, false = Cancelar.
  function confirmar(mensaje, { aceptar = "Aceptar", cancelar = "Cancelar" } = {}) {
    return new Promise(listo => {
      const d = document.createElement("dialog");
      d.className = "dlg dlg-confirmar";
      d.innerHTML = `<div class="dlg-body"><p></p><div class="dlg-botones">
        <button type="button" class="btn-mini" data-r="0"></button>
        <button type="button" class="btn" data-r="1"></button></div></div>`;
      d.querySelector("p").textContent = mensaje;
      d.querySelector('[data-r="0"]').textContent = cancelar;
      d.querySelector('[data-r="1"]').textContent = aceptar;
      let r = false;
      d.addEventListener("click", e => {
        const b = e.target.closest("button[data-r]");
        if (b) { r = b.dataset.r === "1"; d.close(); }
      });
      d.addEventListener("close", () => { d.remove(); listo(r); }); // Esc = cancelar
      document.body.appendChild(d);
      d.showModal();
      d.querySelector('[data-r="1"]').focus();
    });
  }

  R.util = { $, esc, up, norm, digitos, esNumero, aEmail, aUsuario, toast, descargarJSON, confirmar, ICONOS };
})(window.Rotulos);
