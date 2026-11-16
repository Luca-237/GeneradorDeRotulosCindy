// =====================================================================
//  Vista: pantallas de acceso (falta configurar / login / cargando) y
//  barra del usuario logueado. Decide qué se muestra según la sesión.
//  Dos formas de entrar: cuenta Cindy (Clerk) o usuario propio de rótulos.
// =====================================================================
(function (R) {
  const { $ } = R.util;
  const PANTALLAS = ["pantalla-config", "pantalla-carga", "pantalla-login", "app"];

  function mostrar(id) {
    PANTALLAS.forEach(p => { $(p).hidden = p !== id; });
  }

  function mostrarUsuario(perfil) {
    const esSuper = perfil.rol === "superadmin";
    $("usuario-nombre").textContent = perfil.nombre || R.util.aUsuario(perfil.email);
    $("usuario-rol").textContent = esSuper ? "Superadmin" : "Operador";
    $("usuario-rol").classList.toggle("superadmin", esSuper);
    $("usuario-via").hidden = perfil.via !== "clerk";
    $("salir").title = perfil.via === "clerk" ? "Cierra la cuenta Cindy en todas las apps" : "";
    // Lo que solo ve un superadmin (la base igual lo vuelve a verificar)
    document.querySelectorAll("[data-solo-superadmin]").forEach(el => { el.hidden = !esSuper; });
  }

  function errorLogin(mensaje) { $("login-error").textContent = mensaje || ""; }

  // Muestra u oculta el botón de cuenta Cindy según si Clerk cargó
  function mostrarCindy() {
    const hay = R.clerk.hayClerk();
    $("login-cindy").hidden = !hay;
    $("form-login").classList.toggle("con-cindy", hay);
    $("salir-cindy").hidden = !R.clerk.conSesion();
  }

  function iniciar({ alIngresar, alIngresarCindy }) {
    $("form-login").addEventListener("submit", async e => {
      e.preventDefault();
      errorLogin("");
      $("login-btn").disabled = true;
      try {
        await R.api.auth.ingresar($("login-email").value, $("login-password").value);
        $("login-password").value = "";
        await alIngresar();
      } catch (err) {
        errorLogin(err.message);
      } finally { $("login-btn").disabled = false; }
    });
    $("login-clerk").addEventListener("click", () => {
      errorLogin("");
      if (R.clerk.conSesion()) alIngresarCindy(); // ya hay sesión (por ej. de otra app)
      else R.clerk.abrirIngreso();
    });
    $("salir-cindy").addEventListener("click", async () => {
      await R.clerk.salir();
      errorLogin("");
      mostrarCindy();
    });
    $("salir").addEventListener("click", async () => {
      const cindy = R.api.auth.via() === "clerk";
      if (cindy && !(await R.util.confirmar("Se va a cerrar tu cuenta Cindy en todas las apps (Panel, rótulos y las demás). ¿Continuar?", { aceptar: "Salir" }))) return;
      await R.api.auth.salir({ cuentaCindy: cindy });
      R.vistaClientes.limpiar();
      mostrarCindy();
      mostrar("pantalla-login");
    });
  }

  R.vistaAcceso = { iniciar, mostrar, mostrarUsuario, errorLogin, mostrarCindy };
})(window.Rotulos);
