// =====================================================================
//  Conexión a Supabase. Completar con los datos del proyecto:
//  Supabase → Project Settings → API (o "Data API" / "API Keys").
//
//  - supabaseUrl: "Project URL", ej. https://abcdefghijkl.supabase.co
//  - supabaseKey: la clave PÚBLICA ("anon public" o "publishable").
//
//  Esta clave PUEDE estar en el navegador: lo que protege los datos son
//  las reglas RLS de la base (supabase/migrations). NUNCA poner acá la
//  clave "service_role" / "secret": esa da acceso total y vive solo en
//  la Edge Function del servidor.
// =====================================================================
window.ROTULOS_CONFIG = {
  supabaseUrl: "https://snnuxfdwjjqxdnhwouta.supabase.co",
  supabaseKey: "sb_publishable_6zmE4xyY8MOyTyC1se0u6w_GhjDVSEv",

  // Para entrar con un nombre de usuario ("Luca") en vez de un email:
  // Supabase exige email, así que "Luca" se convierte en luca@<este dominio>.
  // No hace falta que el dominio reciba mails (los usuarios se crean ya confirmados).
  // No cambiarlo después de crear usuarios: dejarían de poder entrar.
  dominioUsuarios: "rotulos.cindymayorista.com.ar",

  // Nombre con el que quedó publicada la Edge Function de administración de
  // usuarios (supabase/functions/admin-usuarios). Supabase no permite
  // renombrarlas: si se vuelve a publicar con otro nombre, cambiarlo acá.
  funcionUsuarios: "dynamic-processor",
};
