// =====================================================================
//  Vista: administración de usuarios (solo superadmin).
//  Todo pasa por la Edge Function "admin-usuarios" (R.api.usuarios);
//  la base vuelve a verificar que quien llama sea superadmin.
// =====================================================================
(function (R) {
  const { $, esc, toast, aEmail, aUsuario } = R.util;
  let usuarios = [];

  function fecha(iso) {
    if (!iso) return "nunca";
    return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function pintar() {
    $("tabla-usuarios").innerHTML = usuarios.map(u => `
      <tr class="${u.activo ? "" : "inactivo"}" data-id="${esc(u.id)}">
        <td>${esc(u.nombre || "(sin nombre)")}${u.soy_yo ? " <small>(vos)</small>" : ""}<small>Usuario: ${esc(aUsuario(u.email))}</small></td>
        <td>
          <select data-accion="rol" ${u.soy_yo ? "disabled title=\"No podés cambiar tu propio rol\"" : ""}>
            <option value="operador" ${u.rol === "operador" ? "selected" : ""}>Operador</option>
            <option value="superadmin" ${u.rol === "superadmin" ? "selected" : ""}>Superadmin</option>
          </select>
        </td>
        <td>${u.activo ? "Activo" : "Desactivado"}<small>Último ingreso: ${fecha(u.ultimo_ingreso)}</small></td>
        <td><div class="acciones-fila">
          <button type="button" class="link" data-accion="password">Nueva contraseña</button>
          ${u.soy_yo ? "" : `<button type="button" class="link" data-accion="${u.activo ? "desactivar" : "activar"}">${u.activo ? "Desactivar" : "Activar"}</button>`}
        </div></td>
      </tr>`).join("") || `<tr><td colspan="4">No hay usuarios.</td></tr>`;
  }

  async function cargar() {
    $("tabla-usuarios").innerHTML = `<tr><td colspan="4" class="cargando">Cargando usuarios…</td></tr>`;
    try { usuarios = await R.api.usuarios.listar(); pintar(); }
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
    if (d.rol === "superadmin" && !confirm(`${d.nombre} va a poder crear usuarios y darles superadmin. ¿Continuar?`)) return;
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

    $("tabla-usuarios").addEventListener("change", e => {
      if (e.target.dataset.accion !== "rol") return;
      const id = e.target.closest("tr").dataset.id;
      const u = usuarios.find(x => x.id === id);
      const rol = e.target.value;
      if (rol === "superadmin" && !confirm(`${u.nombre || u.email} va a poder crear usuarios y darles superadmin. ¿Continuar?`)) {
        e.target.value = u.rol; return;
      }
      ejecutar(R.api.usuarios.cambiarRol(id, rol), "Rol actualizado.");
    });

    $("tabla-usuarios").addEventListener("click", e => {
      const btn = e.target.closest("button[data-accion]");
      if (!btn) return;
      const id = btn.closest("tr").dataset.id;
      const u = usuarios.find(x => x.id === id);
      const accion = btn.dataset.accion;
      if (accion === "desactivar" && confirm(`¿Desactivar a ${u.nombre || u.email}? No va a poder ingresar.`)) {
        ejecutar(R.api.usuarios.desactivar(id), "Usuario desactivado.");
      } else if (accion === "activar") {
        ejecutar(R.api.usuarios.activar(id), "Usuario activado.");
      } else if (accion === "password") {
        const p = prompt(`Nueva contraseña para ${aUsuario(u.email)} (mínimo 8 caracteres):`);
        if (p) ejecutar(R.api.usuarios.resetearPassword(id, p), "Contraseña cambiada. Pasala por un medio privado.");
      }
    });
  }

  R.vistaUsuarios = { iniciar };
})(window.Rotulos);
