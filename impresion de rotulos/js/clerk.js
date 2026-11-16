// =====================================================================
//  Cuenta Cindy (Clerk): carga el SDK solo si hay clave en js/config.js.
//  Si falta la clave o Clerk no responde, la página sigue con el login
//  propio de rótulos (los dos conviven).
// =====================================================================
(function (R) {
  const ESPERA_MS = 6000; // si Clerk no responde, a los 6 s sigue solo con el login propio
  // Traducción de las pantallas de Clerk (versión fija)
  const TRADUCCION = "https://cdn.jsdelivr.net/npm/@clerk/localizations@4.24.4/dist/es-UY.mjs";
  let clerk = null;

  function clave() { return ((window.ROTULOS_CONFIG || {}).clerkPublishableKey || "").trim(); }
  function configurado() { return /^pk_(test|live)_/.test(clave()); }

  function cargarScript(src, atributos = {}) {
    return new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = src; s.async = true; s.crossOrigin = "anonymous";
      Object.entries(atributos).forEach(([k, v]) => s.setAttribute(k, v));
      s.onload = ok;
      s.onerror = () => mal(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }

  function conLimite(promesa) {
    return Promise.race([promesa, new Promise((_, mal) => setTimeout(() => mal(new Error("Clerk no respondió a tiempo")), ESPERA_MS))]);
  }

  // Devuelve la instancia de Clerk o null si no está configurado / no cargó
  async function cargar() {
    if (clerk) return clerk;
    if (!configurado()) return null;
    try {
      const pk = clave();
      const host = atob(pk.split("_")[2]).slice(0, -1); // Frontend API, sale de la clave
      const [traduccion] = await conLimite(Promise.all([
        import(TRADUCCION).then(m => m.esUY).catch(() => undefined),
        cargarScript(`https://${host}/npm/@clerk/ui@1/dist/ui.browser.js`),
        cargarScript(`https://${host}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, { "data-clerk-publishable-key": pk }),
      ]));
      // Textos que la traducción deja en inglés
      const localization = traduccion && {
        ...traduccion,
        formFieldInputPlaceholder__username: "Tu usuario (ej: luca)",
        formFieldInputPlaceholder__password: "Tu contraseña",
      };
      await conLimite(window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor }, localization }));
      clerk = window.Clerk;
    } catch (e) {
      console.warn("Cuenta Cindy no disponible:", e);
      clerk = null;
    }
    return clerk;
  }

  const hayClerk = () => !!clerk;
  const conSesion = () => !!(clerk && clerk.session && clerk.user);
  const token = async () => (conSesion() ? await clerk.session.getToken() : null);

  function abrirIngreso() {
    clerk.openSignIn({ forceRedirectUrl: location.href, signUpForceRedirectUrl: location.href });
  }

  async function salir() { if (conSesion()) await clerk.signOut(); }

  function alCambiar(cb) { if (clerk) clerk.addListener(cb); }

  R.clerk = { configurado, cargar, hayClerk, conSesion, token, abrirIngreso, salir, alCambiar };
})(window.Rotulos);
