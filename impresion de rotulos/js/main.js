// =====================================================================
//  Arranque: conecta las vistas, verifica la sesión y carga los datos.
// =====================================================================
(function (R) {
  const { toast } = R.util;
  const A = R.vistaAcceso;

  // Después de un login válido (o de una sesión guardada)
  async function entrar() {
    A.mostrar("pantalla-carga");
    let perfil;
    try { perfil = await R.api.auth.miPerfil(); }
    catch (e) { A.mostrar("pantalla-login"); return A.errorLogin(e.message); }

    if (!perfil || !perfil.activo) {
      await R.api.auth.salir();
      A.mostrar("pantalla-login");
      return A.errorLogin("Tu usuario no está habilitado. Hablá con un superadmin.");
    }
    R.estado.perfil = perfil;
    A.mostrarUsuario(perfil);

    try {
      const [transportes, remitente] = await Promise.all([
        R.api.transportes.listar(),
        R.api.config.obtener("remitente"),
        R.vistaClientes.recargar(),
      ]);
      R.vistaTransportes.cargar(transportes);
      R.vistaRotulos.setRemitente(remitente);
    } catch (e) { toast(e.message, "error", 6000); }

    A.mostrar("app");
    R.vistaRotulos.render();
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
    A.iniciar({ alIngresar: entrar });

    // Si la sesión se cierra o vence (en esta pestaña o en otra), volver al login
    R.api.auth.alCambiar(evento => {
      if (evento === "SIGNED_OUT") A.mostrar("pantalla-login");
    });

    if (await R.api.auth.sesion()) await entrar();
    else A.mostrar("pantalla-login");
  }

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(arrancar);
})(window.Rotulos);
