// =====================================================================
//  Capa de DATOS: única parte del front que habla con Supabase.
//  Las vistas nunca llaman a Supabase directo; usan R.api.*.
//  Si mañana el back cambia (ej. api.php de bagsstore), se cambia este
//  archivo y el resto queda igual.
// =====================================================================
(function (R) {
  const CAMPOS_CLIENTE = ["nombre", "direccion", "ciudad", "provincia", "cp", "dni", "tel", "email", "transporte"];
  let sb = null;

  function configurado() {
    const c = window.ROTULOS_CONFIG || {};
    return /^https:\/\/\S+$/.test(c.supabaseUrl || "") && (c.supabaseKey || "").length > 20;
  }

  function iniciar() {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("No se pudo cargar la librería de Supabase. Revisá la conexión a internet.");
    }
    const c = window.ROTULOS_CONFIG;
    sb = window.supabase.createClient(c.supabaseUrl.replace(/\/+$/, ""), c.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "rotulos.sesion" },
    });
  }

  // Errores de Supabase -> mensajes para el usuario
  function mensaje(error) {
    const m = (error && (error.message || error.error_description)) || String(error);
    if (/Invalid login credentials/i.test(m)) return "Usuario o contraseña incorrectos.";
    if (/banned/i.test(m)) return "Tu usuario está desactivado. Hablá con un superadmin.";
    if (/Email not confirmed/i.test(m)) return "El usuario todavía no está confirmado.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "No hay conexión con la base de datos. Revisá internet.";
    if (/row-level security|permission denied/i.test(m)) return "No tenés permiso para hacer esto.";
    if (/JWT expired/i.test(m)) return "La sesión venció. Volvé a ingresar.";
    return m;
  }

  function chequear({ data, error }) {
    if (error) throw new Error(mensaje(error));
    return data;
  }

  // Deja solo las columnas de la tabla, en mayúsculas
  function limpiarCliente(d) {
    const out = {};
    CAMPOS_CLIENTE.forEach(k => { if (d[k] !== undefined) out[k] = String(d[k] ?? "").trim().toUpperCase(); });
    return out;
  }

  // ---------- Sesión ----------
  const auth = {
    // usuario: "Luca" o un email completo
    async ingresar(usuario, password) {
      chequear(await sb.auth.signInWithPassword({ email: R.util.aEmail(usuario), password }));
    },
    async salir() { await sb.auth.signOut(); },
    async sesion() { const { data } = await sb.auth.getSession(); return data.session; },
    alCambiar(cb) { sb.auth.onAuthStateChange((evento, sesion) => cb(evento, sesion)); },
    async miPerfil() {
      const s = await auth.sesion();
      if (!s) return null;
      return chequear(await sb.from("perfiles").select("id, email, nombre, rol, activo").eq("id", s.user.id).maybeSingle());
    },
  };

  // ---------- Clientes ----------
  const clientes = {
    async listar() {
      const todos = [], LOTE = 1000;
      for (let desde = 0; ; desde += LOTE) {
        const lote = chequear(await sb.from("clientes")
          .select("id, " + CAMPOS_CLIENTE.join(", "))
          .order("nombre").range(desde, desde + LOTE - 1));
        todos.push(...lote);
        if (lote.length < LOTE) return todos;
      }
    },
    async crear(d) {
      return chequear(await sb.from("clientes").insert(limpiarCliente(d)).select().single());
    },
    async crearVarios(lista) {
      if (!lista.length) return [];
      return chequear(await sb.from("clientes").insert(lista.map(limpiarCliente)).select());
    },
    async actualizar(id, d) {
      return chequear(await sb.from("clientes").update(limpiarCliente(d)).eq("id", id).select().single());
    },
    async eliminar(id) {
      chequear(await sb.from("clientes").delete().eq("id", id));
    },
  };

  // ---------- Transportes ----------
  const transportes = {
    async listar() {
      const filas = chequear(await sb.from("transportes").select("nombre").eq("activo", true).order("orden").order("nombre"));
      return filas.map(f => f.nombre);
    },
    async agregar(nombre) {
      const { error } = await sb.from("transportes").insert({ nombre: nombre.trim().toUpperCase() });
      if (error && error.code !== "23505") throw new Error(mensaje(error)); // 23505 = ya existía
    },
  };

  // ---------- Configuración compartida ----------
  const config = {
    async obtener(clave) {
      const fila = chequear(await sb.from("config").select("valor").eq("clave", clave).maybeSingle());
      return fila ? fila.valor : null;
    },
    async guardar(clave, valor) {
      chequear(await sb.from("config").upsert({ clave, valor }));
    },
  };

  // ---------- Usuarios (Edge Function, solo superadmin) ----------
  const usuarios = {
    async llamar(accion, datos = {}) {
      const nombre = (window.ROTULOS_CONFIG || {}).funcionUsuarios || "admin-usuarios";
      const { data, error } = await sb.functions.invoke(nombre, { body: { accion, ...datos } });
      if (error) {
        let m = error.message;
        try { const j = await error.context.json(); if (j && j.error) m = j.error; } catch (e) {}
        if (/Failed to send a request/i.test(m)) m = `No se pudo contactar la función "${nombre}". ¿Está publicada con ese nombre? (js/config.js → funcionUsuarios)`;
        if (/Invalid JWT|UNAUTHORIZED/i.test(m)) m = "La función rechazó la sesión. En Supabase → Edge Functions → la función → desactivar \"Verify JWT\" (la función igual verifica la sesión por su cuenta).";
        throw new Error(mensaje({ message: m }));
      }
      if (data && data.error) throw new Error(data.error);
      return data;
    },
    listar: () => usuarios.llamar("listar").then(r => r.usuarios),
    crear: d => usuarios.llamar("crear", d),
    cambiarRol: (id, rol) => usuarios.llamar("cambiar_rol", { id, rol }),
    activar: id => usuarios.llamar("activar", { id }),
    desactivar: id => usuarios.llamar("desactivar", { id }),
    resetearPassword: (id, password) => usuarios.llamar("resetear_password", { id, password }),
    editarNombre: (id, nombre) => usuarios.llamar("editar_nombre", { id, nombre }),
  };

  R.api = { CAMPOS_CLIENTE, configurado, iniciar, auth, clientes, transportes, config, usuarios };
})(window.Rotulos);
