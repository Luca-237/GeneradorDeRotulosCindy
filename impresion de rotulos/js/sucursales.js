// =====================================================================
//  Sucursal: cada usuario de rótulos pertenece a una (perfiles.sucursal,
//  la asigna un superadmin en Usuarios). La sucursal decide el rótulo, el
//  remitente y el remito que se usan. Un superadmin puede cambiarla con el
//  selector de arriba (no se recuerda: siempre arranca en la suya).
// =====================================================================
(function (R) {
  const { $, esc } = R.util;

  // Lo propio de cada sucursal. Una sucursal que no esté acá usa lo de Casa Central.
  //  rotulo: "zebra" (etiqueta 10 × 6,5, js/rotulo.js) | "a4doble" (2 por hoja A4, js/rotulo-a4.js)
  //  remito: "villamaria" | "cordoba" (talonario de cada una, js/remito.js)
  //  remitente / posiciones: claves de la tabla config (las guarda un superadmin)
  const CONFIG = {
    central: {
      rotulo: "zebra", remito: "villamaria",
      remitente: "remitente", posiciones: "remito_posiciones", posLocal: "remitos.posiciones.v1",
    },
    cordoba: {
      rotulo: "a4doble", remito: "cordoba",
      remitente: "remitente_cordoba", posiciones: "remito_posiciones_cordoba", posLocal: "remitos.posiciones.cordoba.v1",
    },
  };
  const CENTRAL = { clave: "central", nombre: "Casa Central (Villa María)" };

  let lista = [CENTRAL], mia = "central", actual = "central";
  const oyentes = [];

  const esSuper = () => !!(R.estado && R.estado.perfil && R.estado.perfil.rol === "superadmin");
  const config = (clave = actual) => CONFIG[clave] || CONFIG.central;
  const nombre = (clave = actual) => (lista.find(s => s.clave === clave) || { nombre: clave }).nombre;

  // Después de entrar: la sucursal del usuario y la lista (sin la migración, todo queda en Central)
  async function cargar() {
    const [l, m] = await Promise.all([R.api.sucursales.listar(), R.api.sucursales.mia()]);
    lista = l.length ? l : [CENTRAL];
    mia = m && lista.some(s => s.clave === m) ? m : lista[0].clave;
    const antes = actual;
    actual = mia;
    pintar();
    if (antes !== actual) oyentes.forEach(f => f(actual));
  }

  function pintar() {
    const bar = $("sucursal-bar"), sel = $("sucursal-sel");
    const elegir = esSuper() && lista.length > 1;
    bar.hidden = lista.length < 2;
    sel.hidden = !elegir;
    $("sucursal-txt").hidden = elegir;
    $("sucursal-txt").textContent = nombre();
    if (elegir) {
      sel.innerHTML = lista.map(s => `<option value="${esc(s.clave)}">${esc(s.nombre)}${s.clave === mia ? " (la tuya)" : ""}</option>`).join("");
      sel.value = actual;
    }
    document.body.dataset.sucursal = actual;
  }

  function elegir(clave) {
    if (!esSuper() || !lista.some(s => s.clave === clave) || clave === actual) return;
    actual = clave;
    pintar();
    oyentes.forEach(f => f(actual));
  }

  function iniciar() {
    $("sucursal-sel").addEventListener("change", e => elegir(e.target.value));
  }

  R.sucursal = {
    CONFIG, iniciar, cargar, config, nombre,
    actual: () => actual, lista: () => lista,
    alCambiar: f => oyentes.push(f),
  };
})(window.Rotulos);
