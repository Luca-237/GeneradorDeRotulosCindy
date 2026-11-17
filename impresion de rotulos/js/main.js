// =====================================================================
//  Arranque: conecta las vistas, verifica la sesión y carga los datos.
// =====================================================================
(function (R) {
  const { toast } = R.util;
  const A = R.vistaAcceso;
  let adentro = false;

  // Después de un login válido (o de una sesión guardada)
  async function entrar() {
    A.mostrar("pantalla-carga");
    let perfil;
    try { perfil = await R.api.auth.miPerfil(); }
    catch (e) { A.mostrarCindy(); A.mostrar("pantalla-login"); return A.errorLogin(e.message); }

    if (!perfil || !perfil.activo) {
      const cindy = R.api.auth.via() === "clerk";
      // Cuenta Cindy sin habilitar acá pero con sesión del login propio: usar esa
      if (cindy && await R.api.auth.sesion({ ignorarClerk: true })) return entrar();
      // La cuenta Cindy no se cierra: le sirve en las otras apps
      if (!cindy) await R.api.auth.salir();
      A.mostrarCindy();
      A.mostrar("pantalla-login");
      return A.errorLogin(cindy
        ? "Tu cuenta Cindy todavía no está habilitada en rótulos. Hablá con un superadmin o entrá con tu usuario de rótulos."
        : "Tu usuario no está habilitado. Hablá con un superadmin.");
    }
    adentro = true;
    R.estado.perfil = perfil;
    A.mostrarUsuario(perfil);
    mostrarPestanas();

    try {
      const esSuper = perfil.rol === "superadmin";
      const [transportes, remitente, remitenteTB] = await Promise.all([
        R.api.transportes.listar(),
        R.api.config.obtener("remitente"),
        // Travel Blue: solo superadmin (la base igual se lo niega a un operador)
        esSuper ? R.api.config.obtener("remitente_travelblue") : null,
        R.vistaClientes.recargar(),
      ]);
      R.vistaTransportes.cargar(transportes);
      R.vistaRotulos.setRemitentes({ cindy: remitente, travelblue: remitenteTB });
    } catch (e) { toast(e.message, "error", 6000); }

    A.mostrar("app");
    R.vistaRotulos.render();
  }

  // Pestaña "Facturación y despacho": solo para quien tiene acceso allá (no frena la entrada a rótulos)
  async function mostrarPestanas() {
    const c = window.ROTULOS_CONFIG || {};
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    const url = (local && c.facturacionUrlLocal) || c.facturacionUrl;
    const nav = document.getElementById("pestanas-apps");
    nav.hidden = true;
    if (!url) return;
    try {
      if (!(await R.api.auth.facRol())) return;
      document.getElementById("ir-facturacion").href = url;
      nav.hidden = false;
    } catch (e) { /* sin acceso o sin conexión: rótulos sigue igual */ }
  }

  async function entrarConCindy() {
    if (await R.api.auth.sesion()) await entrar();
  }

  async function arrancar() {
    R.estado = { perfil: null };
    if (!R.api.configurado()) return A.mostrar("pantalla-config");

    try { R.api.iniciar(); }
    catch (e) { A.mostrar("pantalla-login"); return A.errorLogin(e.message); }

    R.vistaRotulos.iniciar();
    R.vistaTransportes.iniciar();
    R.vistaClientes.iniciar();
    R.vistaUsuarios.iniciar();
    A.iniciar({ alIngresar: entrar, alIngresarCindy: entrarConCindy });

    // Cuenta Cindy: si no está configurada o no carga, sigue solo el login propio
    await R.clerk.cargar();
    A.mostrarCindy();

    // Si la sesión se cierra o vence (en esta pestaña o en otra), volver al login
    R.api.auth.alCambiar(evento => {
      if (evento === "SIGNED_OUT" && R.api.auth.via() === "propio") { adentro = false; A.mostrar("pantalla-login"); }
    });
    R.clerk.alCambiar(({ session }) => {
      A.mostrarCindy();
      if (R.api.auth.via() === "clerk" && !session && adentro) { // se cerró desde otra app
        adentro = false;
        R.vistaClientes.limpiar();
        A.mostrar("pantalla-login");
      }
    });

    if (await R.api.auth.sesion()) await entrar();
    else A.mostrar("pantalla-login");
  }

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(arrancar);
})(window.Rotulos);
