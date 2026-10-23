// =====================================================================
//  Vista: desplegable de transporte con "Agregar otro transporte…".
//  La lista vive en la base (tabla transportes) y es compartida.
// =====================================================================
(function (R) {
  const { $, esc, up, toast } = R.util;
  const NUEVO = "__nuevo__";
  let lista = [];

  function armar(seleccion) {
    const sel = $("transporte"), valor = seleccion || sel.value || lista[0];
    sel.innerHTML = lista.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("") +
      `<option value="${NUEVO}">Agregar otro transporte…</option>`;
    sel.value = lista.includes(valor) ? valor : (lista[0] || "");
    sel.dataset.prev = sel.value;
  }

  function cargar(nombres) { lista = [...nombres]; armar(); }

  // Elige un transporte; si no está en la lista lo suma (y lo guarda en la base)
  function set(t) {
    t = up(t);
    if (t && !lista.includes(t)) {
      lista.push(t);
      R.api.transportes.agregar(t).catch(e => toast(e.message, "error"));
    }
    armar(t);
  }

  async function confirmarNuevo() {
    const t = up($("nuevo-transporte-txt").value);
    if (!t) return $("nuevo-transporte-txt").focus();
    try {
      await R.api.transportes.agregar(t);
      if (!lista.includes(t)) lista.push(t);
      armar(t);
      $("nuevo-transporte").hidden = true;
      R.vistaRotulos.render(); R.vistaClientes.actualizarEstado();
    } catch (e) { toast(e.message, "error"); }
  }

  function iniciar() {
    $("transporte").addEventListener("change", e => {
      const sel = e.target;
      if (sel.value === NUEVO) {
        sel.value = sel.dataset.prev;
        $("nuevo-transporte").hidden = false;
        $("nuevo-transporte-txt").value = "";
        $("nuevo-transporte-txt").focus();
      } else sel.dataset.prev = sel.value;
    });
    $("nuevo-transporte-ok").addEventListener("click", confirmarNuevo);
    $("nuevo-transporte-cancel").addEventListener("click", () => { $("nuevo-transporte").hidden = true; });
    $("nuevo-transporte-txt").addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); confirmarNuevo(); }
      if (e.key === "Escape") $("nuevo-transporte").hidden = true;
    });
  }

  R.vistaTransportes = { iniciar, cargar, set, lista: () => lista };
})(window.Rotulos);
