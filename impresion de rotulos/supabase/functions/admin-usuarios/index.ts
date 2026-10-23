// =====================================================================
//  Edge Function "admin-usuarios" — administración de usuarios.
//
//  Por qué existe: crear usuarios, cambiar contraseñas o bloquear cuentas
//  requiere la clave "service_role" de Supabase, que saltea toda la
//  seguridad. Esa clave NUNCA puede estar en el navegador; vive solo acá,
//  en el servidor de Supabase (variable SUPABASE_SERVICE_ROLE_KEY, que
//  Supabase inyecta sola).
//
//  Cada pedido:
//    1. Verifica la sesión de quien llama (token del navegador).
//    2. Verifica que sea superadmin activo (tabla perfiles).
//    3. Ejecuta la acción pedida en body.accion.
//
//  Acciones: listar | crear | cambiar_rol | activar | desactivar |
//            resetear_password | editar_nombre
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ROLES = ["superadmin", "operador"];
const BLOQUEO = "876000h"; // ~100 años = cuenta desactivada

function respuesta(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

class ErrorUsuario extends Error {
  constructor(mensaje: string, public status = 400) { super(mensaje); }
}

function exigir(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new ErrorUsuario(mensaje);
}

function validarEmail(email: unknown): string {
  const e = String(email ?? "").trim().toLowerCase();
  exigir(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), "El email no es válido");
  return e;
}

function validarPassword(password: unknown): string {
  const p = String(password ?? "");
  exigir(p.length >= 8, "La contraseña tiene que tener al menos 8 caracteres");
  return p;
}

function validarRol(rol: unknown): string {
  exigir(ROLES.includes(String(rol)), "Rol inválido (superadmin u operador)");
  return String(rol);
}

// Traduce errores de Postgres/Auth a algo entendible
function traducir(mensaje: string): string {
  if (/último superadmin/i.test(mensaje)) return "No se puede quitar el último superadmin activo";
  if (/already been registered|already exists/i.test(mensaje)) return "Ya existe un usuario con ese nombre de usuario o email";
  if (/password/i.test(mensaje) && /weak|short|characters/i.test(mensaje)) return "La contraseña es demasiado débil";
  return mensaje;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return respuesta({ error: "Método no permitido" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) ¿Quién llama?
    const comoUsuario = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: errSesion } = await comoUsuario.auth.getUser();
    if (errSesion || !user) return respuesta({ error: "Sesión inválida o vencida. Volvé a ingresar." }, 401);

    // 2) ¿Es superadmin activo?
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: yo } = await admin.from("perfiles").select("rol, activo").eq("id", user.id).maybeSingle();
    if (!yo || yo.rol !== "superadmin" || !yo.activo) {
      return respuesta({ error: "Solo un superadmin puede administrar usuarios" }, 403);
    }

    // 3) Acción
    const body = await req.json().catch(() => ({}));
    const id = body.id ? String(body.id) : "";

    switch (body.accion) {
      case "listar": {
        const { data: perfiles, error } = await admin
          .from("perfiles").select("id, email, nombre, rol, activo, creado_en").order("nombre");
        if (error) throw error;
        // Último ingreso (viene de Auth, no de perfiles)
        const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const ultimo = new Map((lista?.users ?? []).map((u) => [u.id, u.last_sign_in_at]));
        return respuesta({
          usuarios: (perfiles ?? []).map((p) => ({ ...p, ultimo_ingreso: ultimo.get(p.id) ?? null, soy_yo: p.id === user.id })),
        });
      }

      case "crear": {
        const email = validarEmail(body.email);
        const password = validarPassword(body.password);
        const rol = validarRol(body.rol ?? "operador");
        const nombre = String(body.nombre ?? "").trim();
        exigir(nombre, "Falta el nombre");

        const { data, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true, user_metadata: { nombre },
        });
        if (error) throw error;
        // El trigger ya creó el perfil como operador; le ponemos rol y nombre
        const { error: errPerfil } = await admin.from("perfiles")
          .upsert({ id: data.user.id, email, nombre, rol, activo: true });
        if (errPerfil) {
          await admin.auth.admin.deleteUser(data.user.id); // no dejar usuarios a medias
          throw errPerfil;
        }
        return respuesta({ ok: true, id: data.user.id });
      }

      case "cambiar_rol": {
        exigir(id, "Falta el usuario");
        const rol = validarRol(body.rol);
        const { error } = await admin.from("perfiles").update({ rol }).eq("id", id);
        if (error) throw error;
        return respuesta({ ok: true });
      }

      case "activar":
      case "desactivar": {
        exigir(id, "Falta el usuario");
        const activo = body.accion === "activar";
        exigir(activo || id !== user.id, "No podés desactivar tu propia cuenta");
        const { error } = await admin.from("perfiles").update({ activo }).eq("id", id);
        if (error) throw error;
        // Además se bloquea el login en Auth (y se corta al renovar la sesión)
        const { error: errAuth } = await admin.auth.admin.updateUserById(id, { ban_duration: activo ? "none" : BLOQUEO });
        if (errAuth) throw errAuth;
        return respuesta({ ok: true });
      }

      case "resetear_password": {
        exigir(id, "Falta el usuario");
        const password = validarPassword(body.password);
        const { error } = await admin.auth.admin.updateUserById(id, { password });
        if (error) throw error;
        return respuesta({ ok: true });
      }

      case "editar_nombre": {
        exigir(id, "Falta el usuario");
        const nombre = String(body.nombre ?? "").trim();
        exigir(nombre, "Falta el nombre");
        const { error } = await admin.from("perfiles").update({ nombre }).eq("id", id);
        if (error) throw error;
        await admin.auth.admin.updateUserById(id, { user_metadata: { nombre } });
        return respuesta({ ok: true });
      }

      default:
        return respuesta({ error: "Acción desconocida" }, 400);
    }
  } catch (e) {
    const status = e instanceof ErrorUsuario ? e.status : 400;
    const mensaje = traducir(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
    return respuesta({ error: mensaje }, status);
  }
});
