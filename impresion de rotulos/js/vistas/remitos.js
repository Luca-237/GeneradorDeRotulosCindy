// =====================================================================
//  Vista: pestaña "Remitos". Arma el remito A4 (js/remito.js) con los
//  clientes y transportes de la base de rótulos; los datos se pueden
//  editar antes de imprimir y, si se quiere, guardar en la ficha del cliente.
//  También maneja las pestañas Rótulos | Remitos.
// =====================================================================
(function (R) {
  const { $, esc, up, norm, digitos, esNumero, toast, confirmar, ICONOS } = R.util;
  const LS_PREFS = "remitos.prefs.v1";   // modo, corrimiento, letras, próximo número
  const LS_IVA = "remitos.iva.v1";       // condición de IVA usada con cada cliente (por PC)
  const LS_VISTA = "rotulos.vista";      // última pestaña abierta
  // Cada sucursal tiene su talonario (js/sucursales.js): "villamaria" o "cordoba", y sus posiciones:
  //  - por PC: dónde quedó cada dato después de arrastrarlo (remitos.posiciones.v1, ...cordoba.v1)
  //  - para todos: config de la base, la guarda un superadmin (remito_posiciones, ..._cordoba)
  // Travel Blue (solo superadmin, selector "Tipo de remito"): su talonario y sus posiciones, aparte.
  // La base solo deja leer las claves de config con "travelblue" a un superadmin.
  const TRAVELBLUE = { remito: "travelblue", posLocal: "remitos.posiciones.travelblue.v1", posiciones: "remito_posiciones_travelblue" };
  const esSuper = () => !!(R.estado && R.estado.perfil && R.estado.perfil.rol === "superadmin");
  const esTravelBlue = () => esSuper() && $("rm-tipo").value === "travelblue";
  const cfg = () => (esTravelBlue() ? TRAVELBLUE : R.sucursal.config());
  const modeloActual = () => cfg().remito;
  const lsPos = () => cfg().posLocal;
  const clavePos = () => cfg().posiciones;
  const nombreCampo = k => R.remito.campos(modeloActual())[k] || "";
  const CAMPOS_CLIENTE = ["nombre", "direccion", "ciudad", "provincia", "cp", "dni", "tel"];
  const SIN_TRANSPORTE = "";
  const SVGNS = "http://www.w3.org/2000/svg";

  let actual = null;       // cliente elegido (fila de la base)
  let resultados = [], activo = 0;
  let vista = "rotulos";
  let pos = {};            // { campo: {x, y} } en mm
  let posComun = null;     // las guardadas para todos (null = las del talonario)
  let posComunCargada = null; // clave de config de las ya pedidas a la base
  let elegido = null;      // campo elegido en la hoja (se mueve con las flechas)
  let arrastre = null;

  // ---------- Pestañas ----------
  function mostrarVista(v) {
    vista = v === "remitos" ? "remitos" : "rotulos";
    const rem = vista === "remitos";
    document.body.classList.toggle("vista-remitos", rem);
    $("seccion-rotulos").hidden = rem;
    $("seccion-remitos").hidden = !rem;
    $("hojas").hidden = rem;
    $("preview-head").hidden = rem;
    $("remito-vista").hidden = !rem;
    document.querySelectorAll("[data-vista]").forEach(a => {
      const on = a.dataset.vista === vista;
      a.classList.toggle("activa", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    // Remito: A4 sin márgenes (va después de la regla de los rótulos, así gana)
    $("page-style-remito").textContent = rem ? "@page { size: A4 portrait; margin: 0; }" : "";
    try { localStorage.setItem(LS_VISTA, vista); } catch (e) {}
    if (rem) { armarTransportes(); render(); cargarPosComun(); }
    else R.vistaRotulos.render();
  }
  function restaurarVista() {
    let v = "rotulos";
    try { v = localStorage.getItem(LS_VISTA) || v; } catch (e) {}
    mostrarVista(v);
  }

  // ---------- Datos del formulario ----------
  const lineas = id => $(id).value.split("\n").map(up).filter(Boolean);

  function leerDatos() {
    const transporte = up($("rm-transporte").value);
    return {
      fecha: $("rm-fecha").value,
      nombre: up($("rm-nombre").value), direccion: up($("rm-direccion").value),
      ciudad: up($("rm-ciudad").value), provincia: up($("rm-provincia").value),
      cp: up($("rm-cp").value), dni: up($("rm-dni").value), tel: up($("rm-tel").value),
      transporteNombre: transporte, // Travel Blue: solo el nombre
      iva: $("rm-iva").value, iibb: up($("rm-iibb").value),
      factura: up($("rm-factura").value), venta: $("rm-venta").value,
      bultos: +$("rm-bultos").value || 0, letras: $("rm-letras").checked,
      detalle: lineas("rm-detalle"),
      transporte: transporte ? ($("rm-transporte-prefijo").checked && !/^TRANSPORTE\b/.test(transporte) ? "TRANSPORTE " + transporte : transporte) : "",
      leyendas: lineas("rm-leyendas"),
      valor: $("rm-valor").value,
      empresaTransporte: up($("rm-emp-transp").value), cuitTransporte: up($("rm-cuit-transp").value),
      observaciones: up($("rm-obs").value),
    };
  }

  // Lo que cambia con la sucursal o el tipo de remito: el talonario, los campos y las posiciones
  // guardadas (Córdoba usa el mismo talonario que Villa María, en otra impresora)
  function aplicarModelo() {
    const tb = esTravelBlue();
    $("rm-tel-wrap").hidden = !tb;          // Travel Blue lleva el teléfono del cliente
    $("rm-prefijo-wrap").hidden = tb;       // y el transporte solo con su nombre
    elegido = null;
    cargarPos();
    posComun = null;
    posComunCargada = null;
    if (vista === "remitos") { render(); cargarPosComun(); }
  }

  const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // ---------- Avisos (renglones de más, valor inválido) ----------
  // El número y el C.A.I. vienen en la hoja preimpresa: no se controlan acá.
  function avisos(d) {
    const a = [...R.remito.revisar(d, pos, modeloActual())];
    if (Number.isNaN(R.remito.leerPlata(d.valor))) a.push("El valor declarado no es un número (ej: 873790 o 873.790,00).");
    if (!d.nombre) a.push("Falta el nombre del cliente.");
    return a;
  }

  // ---------- Vista previa ----------
  let timer;
  function render() {
    if (vista !== "remitos") return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const d = leerDatos();
      dibujar(d);
      $("remito-head").textContent = modeloActual() === "travelblue"
        ? "Vista previa · Travel Blue: en gris, el talonario de Travel Blue (no se imprime); en negro, los datos que salen en papel."
        : modeloActual() === "cordoba"
        ? `Vista previa · ${R.sucursal.nombre()}: en gris, la hoja preimpresa con los datos de Córdoba (no se imprime); en negro, los datos que salen en papel.`
        : "Vista previa: en gris, la hoja preimpresa (no se imprime); en negro, los datos que salen en papel.";
      const lista = avisos(d);
      $("rm-avisos").innerHTML = lista.map(m => `<li>${esc(m)}</li>`).join("");
      $("rm-avisos").hidden = !lista.length;
      $("rm-imprimir").disabled = !d.nombre;
      document.title = d.nombre ? `Remito ${d.nombre}` : "Remito";
      guardarPreferencias();
    }, 100);
  }

  // La hoja: en pantalla, el talonario en gris (guía, no se imprime) y los datos en negro.
  // Al imprimir sale solo lo negro, sobre la hoja preimpresa de Greisy.
  // "Mover → / ↓" corrige la impresora: se aplica solo al imprimir (css/remito.css),
  // así la vista previa sigue mostrando dónde cae cada dato en el talonario.
  function dibujar(d) {
    const cont = $("remito-hojas");
    // en el SVG 1 unidad = 1 mm; en CSS, "px" dentro del SVG son unidades del dibujo
    cont.style.setProperty("--rm-dx", (+$("rm-x").value || 0) + "px");
    cont.style.setProperty("--rm-dy", (+$("rm-y").value || 0) + "px");
    cont.innerHTML = `<div class="remito-hoja${$("rm-zoom").value === "real" ? " real" : ""}">` +
      R.remito.svg(d, { completo: true, pos, modelo: modeloActual() }) + `</div>`;
    R.remito.ajustar(cont);
    marcarZonas();
  }

  // ---------- Mover los datos (arrastrar con el mouse o flechas) ----------
  // A cada dato se le pone atrás un rectángulo invisible (.zona) que se marca al pasar el mouse.
  function marcarZonas() {
    $("remito-hojas").querySelectorAll("g[data-campo]").forEach(g => {
      let bb;
      try { bb = g.getBBox(); } catch (e) { return; }
      if (!bb.width) return;
      const r = document.createElementNS(SVGNS, "rect");
      r.setAttribute("class", "zona");
      r.setAttribute("x", (bb.x - 1).toFixed(2)); r.setAttribute("y", (bb.y - 0.8).toFixed(2));
      r.setAttribute("width", (bb.width + 2).toFixed(2)); r.setAttribute("height", (bb.height + 1.6).toFixed(2));
      r.setAttribute("rx", "0.8");
      g.insertBefore(r, g.firstChild);
      const t = document.createElementNS(SVGNS, "title");
      t.textContent = `${nombreCampo(g.dataset.campo)}: arrastrá para moverlo`;
      g.insertBefore(t, g.firstChild);
      g.classList.toggle("elegido", g.dataset.campo === elegido);
    });
    mostrarEstadoPos();
  }

  const redondear = v => Math.round(v * 10) / 10;
  const mm = v => `${String(Math.abs(redondear(v))).replace(".", ",")} mm`;
  // "2 mm a la derecha y 5,5 mm más arriba" / "en su lugar"
  function describir(x, y) {
    const partes = [];
    if (redondear(x)) partes.push(`${mm(x)} ${x > 0 ? "a la derecha" : "a la izquierda"}`);
    if (redondear(y)) partes.push(`${mm(y)} ${y > 0 ? "más abajo" : "más arriba"}`);
    return partes.length ? partes.join(" y ") : "en su lugar";
  }
  function leerTraslado(g) {
    const m = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/.exec(g.getAttribute("transform") || "");
    return m ? { x: +m[1], y: +m[2] } : { x: 0, y: 0 };
  }

  function mostrarEstadoPos() {
    const hay = elegido && $("remito-hojas").querySelector(`g[data-campo="${elegido}"]`);
    $("rm-pos-uno").hidden = !hay;
    if (!hay) {
      $("rm-pos-estado").textContent = "Arrastrá cualquier dato con el mouse para moverlo. Al elegir uno, las flechas lo mueven de a 0,5 mm (con Shift, de a 2 mm).";
      return;
    }
    const p = pos[elegido] || { x: 0, y: 0 };
    $("rm-pos-estado").textContent = `${nombreCampo(elegido)}: ${describir(p.x, p.y)}. Flechas: 0,5 mm (Shift: 2 mm). Esc: soltar.`;
  }

  function elegirCampo(campo) {
    elegido = campo;
    $("remito-hojas").querySelectorAll("g[data-campo]").forEach(g => g.classList.toggle("elegido", g.dataset.campo === campo));
    mostrarEstadoPos();
  }

  function fijarPos(campo, x, y) {
    x = redondear(x); y = redondear(y);
    if (!x && !y) delete pos[campo]; else pos[campo] = { x, y };
    guardarPos();
    render();
  }

  function guardarPos() {
    try { localStorage.setItem(lsPos(), JSON.stringify(pos)); } catch (e) {}
  }

  function cargarPos() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(lsPos())); } catch (e) {}
    pos = p && typeof p === "object" ? p : {};
  }

  // Posiciones guardadas para todos: se usan si en esta PC nunca se movió nada
  async function cargarPosComun() {
    const clave = clavePos();
    if (posComunCargada === clave) return;
    posComunCargada = clave;
    try {
      const v = await R.api.config.obtener(clave);
      if (clave !== clavePos()) return; // se cambió de sucursal mientras tanto
      posComun = v && typeof v === "object" && !Array.isArray(v) ? v : null;
      let local = null;
      try { local = localStorage.getItem(lsPos()); } catch (e) {}
      if (posComun && !local) { pos = JSON.parse(JSON.stringify(posComun)); render(); }
    } catch (e) { /* sin conexión: quedan las de esta PC */ }
  }

  async function datosASuLugar() {
    const destino = posComun ? "a las posiciones guardadas para todos" : "a su lugar del talonario";
    if (!(await confirmar(`¿Volver todos los datos ${destino}? Se pierden los cambios hechos en esta computadora.`, { aceptar: "Volver" }))) return;
    pos = posComun ? JSON.parse(JSON.stringify(posComun)) : {};
    try { localStorage.removeItem(lsPos()); } catch (e) {}
    elegido = null;
    render();
  }

  async function guardarPosComun() {
    if (!(await confirmar("¿Guardar estas posiciones para todos? Las computadoras que nunca movieron un dato van a usar estas.", { aceptar: "Guardar para todos" }))) return;
    try {
      await R.api.config.guardar(clavePos(), pos);
      posComun = JSON.parse(JSON.stringify(pos));
      toast("Posiciones guardadas para todos los usuarios.");
    } catch (e) { toast(e.message, "error"); }
  }

  function iniciarArrastre() {
    const cont = $("remito-hojas");
    cont.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      const g = e.target.closest("g[data-campo]");
      if (!g) { elegirCampo(null); return; }
      e.preventDefault();
      const escala = g.ownerSVGElement.getScreenCTM().a; // px de pantalla por mm
      arrastre = { g, campo: g.dataset.campo, x0: e.clientX, y0: e.clientY, escala, base: leerTraslado(g), dx: 0, dy: 0 };
      try { g.setPointerCapture(e.pointerId); } catch (err) { /* sin captura igual funciona dentro de la hoja */ }
      g.classList.add("arrastrando");
      elegirCampo(g.dataset.campo);
    });
    cont.addEventListener("pointermove", e => {
      if (!arrastre) return;
      arrastre.dx = (e.clientX - arrastre.x0) / arrastre.escala;
      arrastre.dy = (e.clientY - arrastre.y0) / arrastre.escala;
      arrastre.g.setAttribute("transform", `translate(${(arrastre.base.x + arrastre.dx).toFixed(2)} ${(arrastre.base.y + arrastre.dy).toFixed(2)})`);
      const actualPos = pos[arrastre.campo] || { x: 0, y: 0 };
      $("rm-pos-estado").textContent = `${nombreCampo(arrastre.campo)}: ${describir(actualPos.x + arrastre.dx, actualPos.y + arrastre.dy)}.`;
    });
    const soltar = () => {
      if (!arrastre) return;
      const a = arrastre;
      arrastre = null;
      a.g.classList.remove("arrastrando");
      if (Math.abs(a.dx) + Math.abs(a.dy) < 0.2) return mostrarEstadoPos(); // fue un clic: solo lo elige
      const p = pos[a.campo] || { x: 0, y: 0 };
      // "pie" puede venir empujado por el detalle: su base real es la del dibujo
      const baseY = a.campo === "pie" ? a.base.y : p.y;
      fijarPos(a.campo, p.x + a.dx, baseY + a.dy);
    };
    cont.addEventListener("pointerup", soltar);
    cont.addEventListener("pointercancel", soltar);

    document.addEventListener("keydown", e => {
      if (vista !== "remitos" || !elegido) return;
      // Escribiendo en un campo, las flechas son del campo
      if (e.target && e.target.closest && e.target.closest("input, textarea, select, dialog")) return;
      const paso = e.shiftKey ? 2 : 0.5;
      const mov = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
      if (e.key === "Escape") return elegirCampo(null);
      if (!mov) return;
      e.preventDefault();
      const g = $("remito-hojas").querySelector(`g[data-campo="${elegido}"]`);
      const p = pos[elegido] || { x: 0, y: 0 };
      const baseY = elegido === "pie" && g ? leerTraslado(g).y : p.y;
      fijarPos(elegido, p.x + mov[0], baseY + mov[1]);
    });
  }

  // ---------- Preferencias de esta PC ----------
  function guardarPreferencias() {
    try {
      localStorage.setItem(LS_PREFS, JSON.stringify({
        x: $("rm-x").value, y: $("rm-y").value, zoom: $("rm-zoom").value,
        letras: $("rm-letras").checked, prefijo: $("rm-transporte-prefijo").checked,
      }));
    } catch (e) {}
  }
  function cargarPreferencias() {
    let p = {};
    try { p = JSON.parse(localStorage.getItem(LS_PREFS)) || {}; } catch (e) {}
    $("rm-zoom").value = p.zoom === "real" ? "real" : "ajustar";
    cargarPos();
    $("rm-x").value = p.x || 0;
    $("rm-y").value = p.y || 0;
    $("rm-letras").checked = !!p.letras;
    $("rm-transporte-prefijo").checked = p.prefijo !== false;
    $("rm-fecha").value = hoyISO();
  }
  function ivaGuardado(c) {
    try { return (JSON.parse(localStorage.getItem(LS_IVA)) || {})[c.id] || ""; } catch (e) { return ""; }
  }
  function recordarIva() {
    if (!actual || !$("rm-iva").value) return;
    try {
      const m = JSON.parse(localStorage.getItem(LS_IVA)) || {};
      m[actual.id] = $("rm-iva").value;
      localStorage.setItem(LS_IVA, JSON.stringify(m));
    } catch (e) {}
  }

  // ---------- Transportes (misma lista que los rótulos) ----------
  function armarTransportes(seleccion) {
    const sel = $("rm-transporte");
    const valor = seleccion !== undefined ? up(seleccion) : sel.value;
    const lista = R.vistaTransportes.lista();
    const opciones = [...lista];
    if (valor && !opciones.includes(valor)) opciones.push(valor);
    sel.innerHTML = `<option value="${SIN_TRANSPORTE}">(sin transporte)</option>` +
      opciones.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
    sel.value = valor || SIN_TRANSPORTE;
  }

  // ---------- Clientes (misma base que los rótulos) ----------
  function mostrarResultados() {
    const q = $("rm-buscar").value.trim();
    resultados = R.vistaClientes.buscar(q);
    activo = 0;
    const items = resultados.map((c, i) =>
      `<li role="option" data-i="${i}">${esc(c.nombre)}<small>${esc([c.ciudad, c.provincia].filter(Boolean).join(", "))}${c.dni ? " · " + esc(c.dni) : ""}</small></li>`);
    if (q && !resultados.length) items.push(`<li class="vacio">No hay clientes que coincidan.</li>`);
    items.push(`<li class="nuevo" role="option" data-i="nuevo">${ICONOS.usuarioNuevo}<span>Cargar a mano${q && !esNumero(q) ? ` "${esc(up(q))}"` : ""}</span></li>`);
    $("rm-resultados").innerHTML = items.join("");
    $("rm-resultados").hidden = false;
    $("rm-buscar").setAttribute("aria-expanded", "true");
    marcarActivo();
  }
  function marcarActivo() {
    const op = [...$("rm-resultados").querySelectorAll("li[data-i]")];
    op.forEach((li, i) => li.classList.toggle("activo", i === activo));
    if (op[activo]) op[activo].scrollIntoView({ block: "nearest" });
  }
  function cerrarResultados() { $("rm-resultados").hidden = true; $("rm-buscar").setAttribute("aria-expanded", "false"); }
  function elegir(i) {
    if (i === "nuevo" || i === resultados.length) aMano($("rm-buscar").value.trim());
    else if (resultados[i]) seleccionar(resultados[i]);
  }

  // Condición de IVA sugerida: la última usada con ese cliente en esta PC; DNI -> Consumidor Final
  function sugerirIva(c) {
    const g = ivaGuardado(c);
    if (g) return g;
    const n = digitos(c.dni).length;
    return n >= 7 && n <= 8 ? "Consumidor Final" : "";
  }

  function seleccionar(c) {
    actual = c;
    CAMPOS_CLIENTE.forEach(k => { $("rm-" + k).value = c[k] || ""; });
    $("rm-iva").value = sugerirIva(c);
    $("rm-iibb").value = "";
    if (c.transporte) armarTransportes(c.transporte);
    $("rm-buscar").value = ""; cerrarResultados();
    render(); actualizarEstado();
    if (!$("rm-iva").value) $("rm-iva").focus();
  }

  function aMano(prefill) {
    actual = null;
    CAMPOS_CLIENTE.forEach(k => { $("rm-" + k).value = ""; });
    $("rm-iva").value = ""; $("rm-iibb").value = "";
    const conNombre = prefill && !esNumero(prefill);
    if (conNombre) $("rm-nombre").value = up(prefill);
    $("rm-buscar").value = ""; cerrarResultados();
    render(); actualizarEstado();
    $(conNombre ? "rm-direccion" : "rm-nombre").focus();
  }

  const datosCliente = () => Object.fromEntries(CAMPOS_CLIENTE.map(k => [k, up($("rm-" + k).value)]));
  const modificado = () => !!actual && CAMPOS_CLIENTE.some(k => up($("rm-" + k).value) !== up(actual[k]));

  function actualizarEstado() {
    const box = $("rm-cliente-estado"), btn = $("rm-guardar-cliente");
    const hayDatos = CAMPOS_CLIENTE.some(k => $("rm-" + k).value.trim());
    box.classList.remove("nuevo", "modificado");
    if (actual) {
      const mod = modificado();
      box.hidden = false;
      box.classList.toggle("modificado", mod);
      $("rm-cliente-estado-txt").textContent = mod ? `${actual.nombre}: datos editados (solo en este remito)` : `Cliente: ${actual.nombre}`;
      btn.hidden = !mod;
      $("rm-guardar-cliente-txt").textContent = "Guardar los cambios en la ficha del cliente";
    } else if (hayDatos) {
      box.hidden = false;
      box.classList.add("nuevo");
      $("rm-cliente-estado-txt").textContent = "Cargado a mano (no está en la lista de clientes)";
      btn.hidden = !$("rm-nombre").value.trim();
      $("rm-guardar-cliente-txt").textContent = "Guardar como cliente nuevo";
    } else {
      box.hidden = true; btn.hidden = true;
    }
  }

  async function guardarCliente() {
    const d = datosCliente();
    if (!d.nombre) return $("rm-nombre").focus();
    let destino = actual;
    if (!destino) {
      const dup = R.vistaClientes.lista().find(c => (digitos(d.dni) && digitos(c.dni) === digitos(d.dni)) || norm(c.nombre) === norm(d.nombre));
      if (dup && await confirmar(`Ya existe "${dup.nombre}"${dup.dni ? ` (${dup.dni})` : ""}. ¿Actualizar ese cliente con estos datos?`, { aceptar: "Actualizar", cancelar: "Crear otro" })) destino = dup;
    }
    $("rm-guardar-cliente").disabled = true;
    try {
      if (!destino && $("rm-transporte").value) d.transporte = up($("rm-transporte").value);
      const fila = destino ? await R.api.clientes.actualizar(destino.id, d) : await R.api.clientes.crear(d);
      await R.vistaClientes.recargar();
      actual = R.vistaClientes.lista().find(c => c.id === fila.id) || fila;
      recordarIva();
      toast(destino ? "Ficha del cliente actualizada." : "Cliente guardado.");
    } catch (e) { toast(e.message, "error"); }
    finally { $("rm-guardar-cliente").disabled = false; actualizarEstado(); }
  }

  // ---------- Imprimir ----------
  async function imprimir() {
    const d = leerDatos();
    if (!d.nombre) return $("rm-nombre").focus();
    const lista = avisos(d);
    if (lista.length && !(await confirmar(`Ojo: ${lista.join(" ")} ¿Imprimir igual?`, { aceptar: "Imprimir igual", cancelar: "Revisar" }))) return;
    recordarIva();
    render(); clearTimeout(timer);
    // dibujo inmediato (sin esperar el render diferido). En papel sale solo lo negro (css/remito.css)
    dibujar(d);
    window.print();
  }

  function limpiarRemito() {
    actual = null;
    ["rm-nombre", "rm-direccion", "rm-ciudad", "rm-provincia", "rm-cp", "rm-dni", "rm-iibb", "rm-factura",
      "rm-detalle", "rm-leyendas", "rm-valor", "rm-emp-transp", "rm-cuit-transp", "rm-obs", "rm-tel"].forEach(id => { $(id).value = ""; });
    $("rm-iva").value = ""; $("rm-venta").value = "";
    $("rm-bultos").value = 1; $("rm-fecha").value = hoyISO();
    armarTransportes("");
    render(); actualizarEstado();
    $("rm-buscar").focus();
  }

  function iniciar() {
    document.querySelectorAll("[data-vista]").forEach(a => a.addEventListener("click", e => {
      e.preventDefault(); mostrarVista(a.dataset.vista);
    }));
    $("rm-buscar").addEventListener("input", mostrarResultados);
    $("rm-buscar").addEventListener("focus", mostrarResultados);
    $("rm-buscar").addEventListener("blur", () => setTimeout(cerrarResultados, 150));
    $("rm-buscar").addEventListener("keydown", e => {
      const total = $("rm-resultados").querySelectorAll("li[data-i]").length;
      if (e.key === "ArrowDown") { e.preventDefault(); if ($("rm-resultados").hidden) return mostrarResultados(); activo = (activo + 1) % total; marcarActivo(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); activo = (activo - 1 + total) % total; marcarActivo(); }
      else if (e.key === "Enter") { e.preventDefault(); elegir(activo); }
      else if (e.key === "Escape") cerrarResultados();
    });
    $("rm-resultados").addEventListener("mousedown", e => e.preventDefault());
    $("rm-resultados").addEventListener("click", e => {
      const li = e.target.closest("li[data-i]");
      if (li) elegir(li.dataset.i === "nuevo" ? "nuevo" : +li.dataset.i);
    });
    $("rm-cambiar-cliente").addEventListener("click", () => { aMano(""); $("rm-buscar").focus(); });
    $("rm-guardar-cliente").addEventListener("click", guardarCliente);

    $("seccion-remitos").addEventListener("input", e => {
      if (e.target.id === "rm-buscar") return;
      render();
      if (CAMPOS_CLIENTE.includes(e.target.id.replace(/^rm-/, ""))) actualizarEstado();
    });
    $("seccion-remitos").addEventListener("change", e => { if (e.target.id !== "rm-buscar") render(); });
    $("rm-leyenda-rapida").addEventListener("click", e => {
      const b = e.target.closest("button[data-leyenda]");
      if (!b) return;
      const ta = $("rm-leyendas"), ya = lineas("rm-leyendas");
      if (!ya.includes(b.dataset.leyenda)) ta.value = [...ya, b.dataset.leyenda].join("\n");
      render();
    });
    $("rm-ajuste-reset").addEventListener("click", () => { $("rm-x").value = 0; $("rm-y").value = 0; render(); });
    $("rm-limpiar").addEventListener("click", limpiarRemito);
    $("rm-imprimir").addEventListener("click", imprimir);
    $("rm-zoom").addEventListener("change", render);
    $("rm-pos-reset").addEventListener("click", datosASuLugar);
    $("rm-pos-comun").addEventListener("click", guardarPosComun);
    $("rm-pos-uno").addEventListener("click", () => { if (elegido) fijarPos(elegido, 0, 0); });
    iniciarArrastre();
    cargarPreferencias();
    R.sucursal.alCambiar(() => { $("rm-tipo").value = "cindy"; aplicarModelo(); });
    $("rm-tipo").addEventListener("change", aplicarModelo);
  }

  R.vistaRemitos = { iniciar, render, restaurarVista, mostrarVista };
})(window.Rotulos);
