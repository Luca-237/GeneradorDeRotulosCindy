// =====================================================================
//  Utilidades compartidas (sin lógica de negocio ni de pantalla).
//  Todos los módulos cuelgan de window.Rotulos para funcionar también
//  abriendo index.html directo (file://), donde los módulos ES no cargan.
// =====================================================================
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

  R.util = { $, esc, up, norm, digitos, esNumero, aEmail, aUsuario, toast, descargarJSON, ICONOS };
})(window.Rotulos);
