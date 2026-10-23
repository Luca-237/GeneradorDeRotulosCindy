// =====================================================================
//  Vista: buscador de clientes, alta/edición y lista (importar/exportar).
//  Los clientes viven en la base (tabla clientes); acá se mantiene una
//  copia en memoria para buscar rápido mientras se escribe.
// =====================================================================
(function (R) {
  const { $, esc, up, norm, digitos, esNumero, toast, descargarJSON, ICONOS } = R.util;
  const CAMPOS = ["nombre", "direccion", "ciudad", "provincia", "cp", "dni", "tel", "email"];
  const REFRESCO_MS = 60 * 1000; // al buscar, si la lista tiene más de 1 minuto se vuelve a traer

  let clientes = [];     // copia local de la tabla
  let cargadoEn = 0;
  let actual = null;     // cliente elegido
  let nuevo = false;     // se está cargando uno nuevo
  let guardando = false;
  let resultados = [], activo = 0;

  // ---------- Datos ----------
  async function recargar(silencioso = true) {
    try {
      clientes = await R.api.clientes.listar();
      cargadoEn = Date.now();
      // Si el cliente elegido cambió en otra PC, tomar la versión nueva
      if (actual) actual = clientes.find(c => c.id === actual.id) || actual;
      $("clientes-count").textContent = `${clientes.length} clientes en la base.`;
      if (!silencioso) toast("Lista de clientes actualizada.");
    } catch (e) { toast(e.message, "error"); }
  }

  // ---------- Búsqueda ----------
  function buscar(q) {
    const tokens = norm(q).split(/\s+/).filter(Boolean);
    const lista = clientes.filter(c => {
      const texto = norm([c.nombre, c.ciudad, c.provincia, c.dni, c.tel, c.email].join(" ")) + " " + digitos(c.dni) + " " + digitos(c.tel);
      // "2966-243780" también encuentra "2966243780"
      return tokens.every(t => texto.includes(t) || (digitos(t).length >= 3 && texto.includes(digitos(t))));
    });
    const nq = norm(q);
    lista.sort((a, b) => (norm(b.nombre).startsWith(nq) - norm(a.nombre).startsWith(nq)) || norm(a.nombre).localeCompare(norm(b.nombre)));
    return lista.slice(0, 8);
  }

  function mostrarResultados() {
    if (Date.now() - cargadoEn > REFRESCO_MS) recargar().then(() => { if (!$("resultados").hidden) pintarResultados(); });
    pintarResultados();
  }
  function pintarResultados() {
    const q = $("buscar").value.trim();
    resultados = buscar(q);
    activo = 0; // sin resultados, la primera opción es "Crear cliente nuevo"
    const items = resultados.map((c, i) =>
      `<li role="option" data-i="${i}">${esc(c.nombre)}<small>${esc([c.ciudad, c.provincia].filter(Boolean).join(", "))}${c.dni ? " · " + esc(c.dni) : ""}</small></li>`);
    if (q && !resultados.length) items.push(`<li class="vacio">No hay clientes que coincidan.</li>`);
    items.push(`<li class="nuevo" role="option" data-i="nuevo">${ICONOS.usuarioNuevo}<span>Crear cliente nuevo${q && !esNumero(q) ? ` "${esc(up(q))}"` : ""}</span></li>`);
    $("resultados").innerHTML = items.join("");
    $("resultados").hidden = false;
    $("buscar").setAttribute("aria-expanded", "true");
    marcarActivo();
  }
  function marcarActivo() {
    const opciones = [...$("resultados").querySelectorAll("li[data-i]")];
    opciones.forEach((li, i) => li.classList.toggle("activo", i === activo));
    if (opciones[activo]) opciones[activo].scrollIntoView({ block: "nearest" });
  }
  function cerrarResultados() { $("resultados").hidden = true; $("buscar").setAttribute("aria-expanded", "false"); }
  function elegir(i) {
    if (i === "nuevo" || i === resultados.length) crearNuevo($("buscar").value.trim());
    else if (resultados[i]) seleccionar(resultados[i]);
  }

  // ---------- Formulario ----------
  function llenarCampos(c) { CAMPOS.forEach(k => { $(k).value = c ? (c[k] || "") : ""; }); }

  function datosFormulario() {
    const d = {};
    CAMPOS.forEach(k => { d[k] = up($(k).value); });
    return d;
  }

  function seleccionar(c) {
    actual = c; nuevo = false;
    llenarCampos(c);
    if (c.transporte) R.vistaTransportes.set(c.transporte);
    $("buscar").value = ""; cerrarResultados();
    R.vistaRotulos.render(); actualizarEstado();
  }

  function crearNuevo(prefill) {
    actual = null; nuevo = true;
    llenarCampos(null);
    // Si se buscó por nombre, se usa como nombre del cliente nuevo
    const conNombre = prefill && !esNumero(prefill);
    if (conNombre) $("nombre").value = up(prefill);
    $("buscar").value = ""; cerrarResultados();
    R.vistaRotulos.render(); actualizarEstado();
    $(conNombre ? "direccion" : "nombre").focus();
  }

  function limpiar() {
    actual = null; nuevo = false;
    llenarCampos(null); R.vistaRotulos.render(); actualizarEstado();
  }

  function modificado() {
    if (!actual) return false;
    const d = datosFormulario();
    return CAMPOS.some(k => d[k] !== up(actual[k])) ||
      ($("guardar-transporte").checked && up($("transporte").value) !== up(actual.transporte));
  }

  function actualizarEstado() {
    const box = $("cliente-estado"), btn = $("guardar-cliente");
    const hayDatos = CAMPOS.some(k => $(k).value.trim());
    box.classList.remove("nuevo", "modificado");
    if (actual) {
      const mod = modificado();
      box.hidden = false;
      box.classList.toggle("modificado", mod);
      $("cliente-estado-txt").textContent = mod ? `${actual.nombre}: cambios sin guardar` : `Cliente: ${actual.nombre}`;
      btn.disabled = !mod || guardando;
      $("guardar-cliente-txt").textContent = "Guardar cambios del cliente";
    } else if (nuevo || hayDatos) {
      box.hidden = false;
      box.classList.add("nuevo");
      $("cliente-estado-txt").textContent = "Cliente nuevo, todavía sin guardar";
      btn.disabled = !$("nombre").value.trim() || guardando;
      $("guardar-cliente-txt").textContent = "Guardar cliente nuevo";
    } else {
      box.hidden = true;
      btn.disabled = true;
      $("guardar-cliente-txt").textContent = "Guardar cliente";
    }
  }

  async function guardar() {
    const d = datosFormulario();
    if (!d.nombre) { $("nombre").focus(); return false; }
    if ($("guardar-transporte").checked || !actual) d.transporte = up($("transporte").value);
    let destino = actual;
    if (!destino) {
      // Evitar duplicados: mismo DNI/CUIT o mismo nombre
      const dup = clientes.find(c => (digitos(d.dni) && digitos(c.dni) === digitos(d.dni)) || norm(c.nombre) === norm(d.nombre));
      if (dup && confirm(`Ya existe "${dup.nombre}"${dup.dni ? ` (${dup.dni})` : ""}.\n\nAceptar: actualizar ese cliente con estos datos.\nCancelar: guardarlo como cliente nuevo.`)) destino = dup;
    }
    guardando = true; actualizarEstado();
    try {
      const fila = destino ? await R.api.clientes.actualizar(destino.id, d) : await R.api.clientes.crear(d);
      const i = clientes.findIndex(c => c.id === fila.id);
      if (i >= 0) clientes[i] = fila; else clientes.push(fila);
      actual = fila; nuevo = false;
      $("clientes-count").textContent = `${clientes.length} clientes en la base.`;
      toast(destino ? "Cliente actualizado." : "Cliente guardado.");
      return true;
    } catch (e) {
      toast(e.message, "error");
      return false;
    } finally {
      guardando = false; actualizarEstado();
    }
  }

  async function antesDeImprimir() {
    if (!actual && $("nombre").value.trim()) await guardar();
    else if (actual && modificado() && confirm(`¿Guardar los cambios en la ficha de ${actual.nombre}?`)) await guardar();
  }

  // ---------- Importar / exportar (solo superadmin) ----------
  function exportar() {
    descargarJSON(`clientes-rotulos-${new Date().toISOString().slice(0, 10)}.json`, {
      exportado: new Date().toISOString(),
      clientes: clientes.map(({ id, ...resto }) => resto),
      transportes: R.vistaTransportes.lista(),
    });
  }

  async function importar(file) {
    let data;
    try { data = JSON.parse(await file.text()); }
    catch (e) { return toast("No se pudo leer el archivo. Tiene que ser un .json de clientes.", "error"); }
    const entrantes = (data.clientes || []).filter(c => c && c.nombre);
    if (!entrantes.length) return toast("El archivo no tiene clientes.", "error");
    if (!confirm(`Se van a importar ${entrantes.length} clientes a la base compartida.\nLos que ya existan (mismo DNI/CUIT o nombre) se actualizan.\n\n¿Continuar?`)) return;

    await recargar();
    const nuevos = [], cambios = [];
    for (const c of entrantes) {
      const existe = clientes.find(x => (digitos(c.dni) && digitos(x.dni) === digitos(c.dni)) || norm(x.nombre) === norm(c.nombre));
      if (existe) cambios.push([existe.id, c]); else nuevos.push(c);
    }
    try {
      toast(`Importando ${entrantes.length} clientes…`, "ok", 60000);
      await R.api.clientes.crearVarios(nuevos);
      for (const [id, c] of cambios) await R.api.clientes.actualizar(id, c);
      for (const t of data.transportes || []) await R.api.transportes.agregar(t);
      await recargar();
      R.vistaTransportes.cargar(await R.api.transportes.listar());
      toast(`Importación lista: ${nuevos.length} nuevos, ${cambios.length} actualizados.`);
    } catch (e) {
      await recargar();
      toast("La importación se cortó: " + e.message, "error", 8000);
    }
  }

  function iniciar() {
    $("buscar").addEventListener("input", mostrarResultados);
    $("buscar").addEventListener("focus", mostrarResultados);
    $("buscar").addEventListener("blur", () => setTimeout(cerrarResultados, 150));
    $("buscar").addEventListener("keydown", e => {
      const total = $("resultados").querySelectorAll("li[data-i]").length;
      if (e.key === "ArrowDown") { e.preventDefault(); if ($("resultados").hidden) return mostrarResultados(); activo = (activo + 1) % total; marcarActivo(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); activo = (activo - 1 + total) % total; marcarActivo(); }
      else if (e.key === "Enter") { e.preventDefault(); if (activo >= 0) elegir(activo); }
      else if (e.key === "Escape") cerrarResultados();
    });
    $("resultados").addEventListener("mousedown", e => e.preventDefault());
    $("resultados").addEventListener("click", e => {
      const li = e.target.closest("li[data-i]");
      if (li) elegir(li.dataset.i === "nuevo" ? "nuevo" : +li.dataset.i);
    });
    $("cambiar-cliente").addEventListener("click", () => { limpiar(); $("buscar").focus(); });
    $("guardar-transporte").addEventListener("change", actualizarEstado);
    $("guardar-cliente").addEventListener("click", guardar);
    $("actualizar-clientes").addEventListener("click", () => recargar(false));
    $("exportar").addEventListener("click", exportar);
    $("importar").addEventListener("change", e => {
      const f = e.target.files[0];
      e.target.value = "";
      if (f) importar(f);
    });
  }

  R.vistaClientes = { iniciar, recargar, limpiar, actualizarEstado, antesDeImprimir };
})(window.Rotulos);
