
(function (R) {
  const CAMPOS_CLIENTE = ["nombre", "direccion", "ciudad", "provincia", "cp", "dni", "tel", "email", "transporte"];
  // Dos conexiones a la misma base, una por tipo de login:
  //   sbPropio -> usuario y contraseña de rótulos (Auth de Supabase)
  //   sbClerk  -> cuenta Cindy (token de Clerk; ahí supabase.auth no se usa)
  let sbPropio = null, sbClerk = null, sb = null;
  let via = null; // "clerk" | "propio" | null

  function configurado() {
    const c = window.ROTULOS_CONFIG || {};
    return /^https:\/\/\S+$/.test(c.supabaseUrl || "") && (c.supabaseKey || "").length > 20;
  }

  function iniciar() {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("No se pudo cargar la librería de Supabase. Revisá la conexión a internet.");
    }
    const c = window.ROTULOS_CONFIG;
    const url = c.supabaseUrl.replace(/\/+$/, "");
    sbPropio = window.supabase.createClient(url, c.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "rotulos.sesion" },
    });
    sbClerk = window.supabase.createClient(url, c.supabaseKey, { accessToken: () => R.clerk.token() });
    sb = sbPropio;
  }

  function usar(v) { via = v; sb = v === "clerk" ? sbClerk : sbPropio; }

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
    via: () => via,
    // Login propio. usuario: "Luca" o un email completo
    async ingresar(usuario, password) {
      chequear(await sbPropio.auth.signInWithPassword({ email: R.util.aEmail(usuario), password }));
      usar("propio");
    },
    // Cierra la sesión de esta página. La cuenta Cindy se cierra solo si se pide,
    // porque es la misma sesión en todas las apps de bagsstore.com.ar.
    async salir({ cuentaCindy = false } = {}) {
      await sbPropio.auth.signOut();
      if (cuentaCindy) await R.clerk.salir();
      usar(null);
    },
    // ¿Hay sesión? Prefiere la cuenta Cindy, salvo que se pida ignorarla.
    async sesion({ ignorarClerk = false } = {}) {
      if (!ignorarClerk && R.clerk.conSesion()) { usar("clerk"); return true; }
      const { data } = await sbPropio.auth.getSession();
      if (data.session) { usar("propio"); return true; }
      usar(null);
      return false;
    },
    alCambiar(cb) { sbPropio.auth.onAuthStateChange((evento, sesion) => cb(evento, sesion)); },
    // Rol en Facturación y despacho (misma base, tablas fac_). null si no tiene acceso
    // o si la base todavía no tiene Facturación instalada.
    async facRol() {
      if (!via) return null;
      const { data, error } = await sb.rpc("fac_rol");
      return error ? null : data || null;
    },
    // Perfil de esta app. Con cuenta Cindy, la primera vez la vincula (ver migración login_clerk).
    async miPerfil() {
      if (!via) return null;
      const r = await sb.rpc("mi_perfil");
      // Base todavía sin la migración login_clerk: el login propio sigue como antes
      if (r.error && r.error.code === "PGRST202" && via === "propio") {
        const { data } = await sbPropio.auth.getSession();
        const p = chequear(await sb.from("perfiles").select("id, email, nombre, rol, activo").eq("id", data.session.user.id).maybeSingle());
        return p && { ...p, via: "propio", tiene_login_propio: true };
      }
      const filas = chequear(r);
      return (filas && filas[0]) || null;
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

  // ---------- Sucursales (migración 20261126200000_sucursal_rotulos.sql) ----------
  // Si la base todavía no tiene la migración, todo sigue como Casa Central.
  const sucursales = {
    async listar() {
      const { data, error } = await sb.rpc("sucursales_rotulos");
      return error ? [] : data || [];
    },
    async mia() {
      const { data, error } = await sb.rpc("mi_sucursal");
      return error ? null : data || null;
    },
    // { perfil_id: sucursal } de todos los usuarios (solo superadmin: lo deja la regla de perfiles)
    async deUsuarios() {
      const { data, error } = await sb.from("perfiles").select("id, sucursal");
      return error ? {} : Object.fromEntries((data || []).map(f => [f.id, f.sucursal]));
    },
    async asignar(perfilId, sucursal) {
      chequear(await sb.rpc("asignar_sucursal", { p_perfil: perfilId, p_sucursal: sucursal }));
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
    desvincularClerk: id => usuarios.llamar("desvincular_clerk", { id }),
    unir: (origen, destino) => usuarios.llamar("unir_cuentas", { origen, destino }),
  };

  R.api = { CAMPOS_CLIENTE, configurado, iniciar, auth, clientes, transportes, config, sucursales, usuarios };
})(window.Rotulos);
