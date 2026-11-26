
(function (R) {
  const { $, esc, toast, aEmail, aUsuario, confirmar } = R.util;
  let usuarios = [];
  let sucursales = {}; // perfil_id -> sucursal (perfiles.sucursal)

  // Sucursal de cada usuario: decide su rótulo, su remitente y su remito (js/sucursales.js)
  function selectorSucursal(u) {
    const lista = R.sucursal.lista();
    if (lista.length < 2) return "";
    const v = sucursales[u.id] || "central";
    return `<select data-accion="sucursal" aria-label="Sucursal de ${esc(u.nombre || u.email)}" title="Sucursal">` +
      lista.map(s => `<option value="${esc(s.clave)}" ${s.clave === v ? "selected" : ""}>${esc(s.nombre)}</option>`).join("") + `</select>`;
  }

  function fecha(iso) {
    if (!iso) return "nunca";
    return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function pintar() {
    $("tabla-usuarios").innerHTML = usuarios.map(u => `
      <tr class="${u.activo ? "" : "inactivo"}" data-id="${esc(u.id)}">
        <td>${esc(u.nombre || "(sin nombre)")}${u.soy_yo ? " <small>(vos)</small>" : ""}<small>Usuario: ${esc(aUsuario(u.email))}</small>
          <small>${u.login_propio ? `<span class="chip">Usuario de rótulos</span>` : ""}${u.cuenta_cindy ? `<span class="chip">Cuenta Cindy</span>` : ""}</small></td>
        <td>
          <select data-accion="rol" ${u.soy_yo ? "disabled title=\"No podés cambiar tu propio rol\"" : ""}>
            <option value="operador" ${u.rol === "operador" ? "selected" : ""}>Operador</option>
            <option value="superadmin" ${u.rol === "superadmin" ? "selected" : ""}>Superadmin</option>
          </select>
          ${selectorSucursal(u)}
        </td>
        <td>${u.activo ? "Activo" : "Desactivado"}<small>Último ingreso: ${fecha(u.ultimo_ingreso)}</small></td>
        <td><div class="acciones-fila">
          ${u.login_propio ? `<button type="button" class="link" data-accion="password">Nueva contraseña</button>` : ""}
          ${u.cuenta_cindy && u.login_propio ? `<button type="button" class="link" data-accion="desvincular" title="La cuenta Cindy se separa de este usuario">Desvincular cuenta Cindy</button>` : ""}
          ${u.cuenta_cindy && !u.login_propio ? `<button type="button" class="link" data-accion="unir" title="Si esta persona ya tenía usuario de rótulos">Unir con usuario de rótulos</button>` : ""}
          ${u.soy_yo ? "" : `<button type="button" class="link" data-accion="${u.activo ? "desactivar" : "activar"}">${u.activo ? "Desactivar" : "Activar"}</button>`}
        </div></td>
      </tr>`).join("") || `<tr><td colspan="4">No hay usuarios.</td></tr>`;
  }

  async function cargar() {
    $("tabla-usuarios").innerHTML = `<tr><td colspan="4" class="cargando">Cargando usuarios…</td></tr>`;
    try {
      [usuarios, sucursales] = await Promise.all([R.api.usuarios.listar(), R.api.sucursales.deUsuarios()]);
      pintar();
    }
    catch (e) { $("tabla-usuarios").innerHTML = `<tr><td colspan="4">${esc(e.message)}</td></tr>`; }
  }

  async function ejecutar(promesa, ok) {
    try { await promesa; toast(ok); }
    catch (e) { toast(e.message, "error", 6000); }
    await cargar();
  }

  function abrir() {
    $("form-usuario").reset();
    $("usuario-error").textContent = "";
    $("dlg-usuarios").showModal();
    cargar();
  }

  async function crear(e) {
    e.preventDefault();
    $("usuario-error").textContent = "";
    const d = {
      nombre: $("nu-nombre").value.trim(), email: aEmail($("nu-email").value),
      password: $("nu-password").value, rol: $("nu-rol").value,
    };
    if (d.rol === "superadmin" && !(await confirmar(`${d.nombre} va a poder crear usuarios y darles superadmin. ¿Continuar?`))) return;
    $("nu-crear").disabled = true;
    try {
      await R.api.usuarios.crear(d);
      toast(`Usuario "${aUsuario(d.email)}" creado. Pasale la contraseña por un medio privado.`, "ok", 6000);
      $("form-usuario").reset();
      await cargar();
    } catch (err) {
      $("usuario-error").textContent = err.message;
    } finally { $("nu-crear").disabled = false; }
  }

  function iniciar() {
    $("abrir-usuarios").addEventListener("click", abrir);
    $("cerrar-usuarios").addEventListener("click", () => $("dlg-usuarios").close());
    $("form-usuario").addEventListener("submit", crear);

    $("tabla-usuarios").addEventListener("change", async e => {
      if (e.target.dataset.accion === "sucursal") {
        const id = e.target.closest("tr").dataset.id;
        const u = usuarios.find(x => x.id === id);
        await ejecutar(R.api.sucursales.asignar(id, e.target.value), `Sucursal de ${u.nombre || aUsuario(u.email)}: ${R.sucursal.nombre(e.target.value)}.`);
        if (u.soy_yo) R.sucursal.cargar().catch(() => {}); // la propia: la página cambia de sucursal
        return;
      }
      if (e.target.dataset.accion !== "rol") return;
      const id = e.target.closest("tr").dataset.id;
      const u = usuarios.find(x => x.id === id);
      const rol = e.target.value;
      if (rol === "superadmin" && !(await confirmar(`${u.nombre || u.email} va a poder crear usuarios y darles superadmin. ¿Continuar?`))) {
        e.target.value = u.rol; return;
      }
      ejecutar(R.api.usuarios.cambiarRol(id, rol), "Rol actualizado.");
    });

    $("tabla-usuarios").addEventListener("click", async e => {
      const btn = e.target.closest("button[data-accion]");
      if (!btn) return;
      const id = btn.closest("tr").dataset.id;
      const u = usuarios.find(x => x.id === id);
      const accion = btn.dataset.accion;
      if (accion === "desactivar" && await confirmar(`¿Desactivar a ${u.nombre || u.email}? No va a poder ingresar.`, { aceptar: "Desactivar" })) {
        ejecutar(R.api.usuarios.desactivar(id), "Usuario desactivado.");
      } else if (accion === "activar") {
        ejecutar(R.api.usuarios.activar(id), "Usuario activado.");
      } else if (accion === "password") {
        const p = prompt(`Nueva contraseña para ${aUsuario(u.email)} (mínimo 8 caracteres):`);
        if (p) ejecutar(R.api.usuarios.resetearPassword(id, p), "Contraseña cambiada. Pasala por un medio privado.");
      } else if (accion === "desvincular" && await confirmar(`¿Desvincular la cuenta Cindy de ${u.nombre || u.email}? Va a seguir entrando con su usuario de rótulos; la próxima vez que entre con la cuenta Cindy se vuelve a vincular solo si un admin cargó su "usuario" en Clerk.`, { aceptar: "Desvincular" })) {
        ejecutar(R.api.usuarios.desvincularClerk(id), "Cuenta Cindy desvinculada.");
      } else if (accion === "unir") {
        const destino = (prompt(`¿Con qué usuario de rótulos se une la cuenta Cindy de ${u.nombre || u.email}? (ej: mariela)`) || "").trim().toLowerCase();
        const d = destino && usuarios.find(x => x.login_propio && !x.cuenta_cindy && aUsuario(x.email) === destino);
        if (destino && !d) return toast(`No hay un usuario de rótulos "${destino}" sin cuenta Cindy.`, "error", 6000);
        if (d && await confirmar(`La cuenta Cindy pasa a "${destino}" (con su rol y estado). El registro suelto de la cuenta Cindy se borra. ¿Continuar?`, { aceptar: "Unir" })) {
          ejecutar(R.api.usuarios.unir(id, d.id), "Cuentas unidas.");
        }
      }
    });
  }

  R.vistaUsuarios = { iniciar };
})(window.Rotulos);
