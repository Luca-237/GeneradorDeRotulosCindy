# Cuenta Cindy (Clerk) en rótulos: puesta en marcha

Rótulos acepta dos formas de entrar, que conviven:

- **Cuenta Cindy** (Clerk): la misma para todas las apps de `bagsstore.com.ar`.
- **Usuario de rótulos** (el login de siempre, Supabase Auth). No se apaga.

Mientras `clerkPublishableKey` esté vacía en `js/config.js`, la página funciona exactamente como antes.
Los nombres de menús de Clerk y Supabase pueden cambiar: si algo no aparece donde dice, buscarlo por el nombre.

## 1. Clerk: crear la aplicación (una sola vez para toda la empresa)

1. Crear cuenta en clerk.com y una aplicación "Cindy".
2. Forma de entrar: **Username** + **Password**. Email opcional. Sin Google ni otros.
3. Registro: modo **Restricted** (solo un admin crea cuentas).
4. Para probar en la PC alcanza con la instancia **Development** (`pk_test_...`, funciona en `localhost`).
   Para producción hay que crear la instancia **Production** con el dominio `bagsstore.com.ar`
   y cargar en el DNS de Ferozo los registros CNAME que pide Clerk.
   Con eso la sesión sirve en todos los subdominios (`panel.`, `rotulos.`, `compras.`...).

## 2. Clerk: datos que viajan en el token

En **Sessions → Customize session token**, cargar:

```json
{
  "usuario": "{{user.public_metadata.usuario}}",
  "nombre": "{{user.first_name}}",
  "apellido": "{{user.last_name}}",
  "apps": "{{user.public_metadata.apps}}"
}
```

- `usuario`: el usuario que la persona ya tiene en rótulos (por ejemplo `luca`). Sirve para vincular las dos cuentas.
  Se toma de `public_metadata` (solo lo cambia un admin) y no del username de Clerk, porque cada uno puede cambiar su username.
- `apps`: para la fase 3 (limitar accesos). Por ahora no se usa.

## 3. Conectar Clerk con Supabase

1. Clerk → **Integrations → Supabase** → activar. Copiar el dominio de Clerk que muestra.
2. Supabase (proyecto `snnuxfdwjjqxdnhwouta`) → **Authentication → Sign In / Providers → Third Party Auth → Add provider → Clerk** → pegar el dominio.
   El login propio de Supabase sigue andando (no se puede apagar y no hace falta).

## 4. Base de datos

SQL Editor → correr `supabase/migrations/20261116000000_login_clerk.sql` (después de las anteriores; se puede correr dos veces).

Qué hace:
- `perfiles` suma `auth_id` (usuario de rótulos) y `clerk_id` (cuenta Cindy). El `id` del perfil no cambia.
- Las reglas de seguridad usan `mi_perfil_id()`, que reconoce los dos tipos de token.
- `mi_perfil()`: la página lo llama al entrar. Con cuenta Cindy, la primera vez vincula por `usuario`;
  si no hay coincidencia crea un perfil de **operador activo** (para que entren desactivadas:
  `update config set valor = 'false' where clave = 'clerk_alta_activa';`).

Control rápido después de correrla:

```sql
select count(*) total, count(auth_id) con_login_propio, count(clerk_id) con_cuenta_cindy from perfiles;
```

`total` y `con_login_propio` tienen que dar igual (todavía nadie tiene cuenta Cindy).

## 5. Función de usuarios

Volver a publicar `supabase/functions/admin-usuarios/index.ts` en la función que usa la página
(`funcionUsuarios` en `js/config.js`, hoy `dynamic-processor`) con **Verify JWT apagado**.
La función verifica la sesión por su cuenta con `mi_perfil()`, para los dos tipos de login.

Orden: primero la migración (paso 4), después la función. La página nueva funciona con la base vieja
(el login propio tiene un respaldo), pero la función nueva necesita `mi_perfil()`.

## 6. Página

1. `js/config.js` → `clerkPublishableKey: "pk_test_..."` (o `pk_live_...` en producción). No es secreta.
2. Probar en local (`http://localhost:5560`), después subir y "Desplegar" en Ferozo (Ctrl+F5).

## 7. Crear las cuentas Cindy

Clerk → **Users → Create user**: username, contraseña, nombre y apellido.
En el usuario → **Metadata → Public**:

```json
{ "usuario": "luca", "apps": { "rotulos": true } }
```

## 8. Pruebas

1. Entrar con usuario de rótulos: igual que antes.
2. Entrar con cuenta Cindy de alguien que tiene `usuario`: entra con su rol de siempre;
   en Usuarios aparece con "Usuario de rótulos" y "Cuenta Cindy".
3. Cuenta Cindy sin `usuario`: entra como operador nuevo. Si ya tenía usuario de rótulos,
   en Usuarios → "Unir con usuario de rótulos".
4. Desactivar a alguien en Usuarios: no entra por ninguno de los dos caminos.
5. "Salir" con cuenta Cindy pregunta antes, porque cierra la sesión en todas las apps.

## Volver atrás

Vaciar `clerkPublishableKey` y subir `js/config.js`: queda solo el login propio. La migración puede quedar
(el login propio funciona igual con ella).
