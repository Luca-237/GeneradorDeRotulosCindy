# Guía de despliegue — Generador de rótulos en un subdominio de bagsstore.com.ar

**Objetivo:** que la herramienta quede publicada en **`https://rotulos.bagsstore.com.ar`** (o el subdominio que se elija), con HTTPS, y que se actualice sola cada vez que se sube un cambio a GitHub.

Sigue el mismo circuito que ya usan los otros proyectos web de Cindy: Travel Blue, Preventa, Devoluciones y Dashboard. El código va a **GitHub** y **Ferozo (DonWeb)** lo descarga solo. No se sube nada a mano por FTP.

> **Quién lo hace:** necesita acceso al panel de Ferozo (cuenta `td000310`) y a la cuenta de GitHub `mauriciomre`. Hoy eso lo tiene **Mauricio**. Es un cambio en el hosting de producción, el mismo donde corren el catálogo, Preventa y Devoluciones, así que hay que **coordinarlo con él antes de empezar**. La sección 9 resume los riesgos para que los revise.

> **Desde la versión con Supabase (22/10/2026):** Ferozo solo sirve archivos estáticos (HTML/CSS/JS). Los datos y el login están en Supabase. **Los clientes ya no están en el código**: viven en la base, protegidos con login y reglas por rol. Por eso el repo puede ser público sin exponer datos personales, y la contraseña del servidor (paso 6) pasa a ser **opcional**.

---

## Resumen de pasos

| # | Paso | Dónde | Tiempo aprox. |
|---|---|---|---|
| 0 | Tener Supabase configurado y probado en local | Supabase + PC | ver SUPABASE-SETUP.md |
| 1 | Agregar los archivos de publicación (`.htaccess`, `robots.txt`) | PC | 10 min |
| 2 | Crear el repositorio y subirlo a GitHub | PC + GitHub | 10 min |
| 3 | Crear el subdominio | Panel Ferozo | 5 min |
| 4 | Activar el certificado SSL (HTTPS) | Panel Ferozo | 5–30 min |
| 5 | Conectar GitHub → Ferozo (GIT) | Panel Ferozo + GitHub | 10 min |
| 6 | (Opcional) Contraseña extra del servidor | PC + Ferozo | 10 min |
| 7 | Activar el despliegue automático (webhook) | Ferozo + GitHub | 5 min |
| 8 | Probar | Navegador | 15 min |

---

## Paso 0 — Supabase listo antes de publicar

1. Seguir **SUPABASE-SETUP.md** completo: tablas, primer superadmin, función `admin-usuarios`, `js/config.js` completo y clientes importados.
2. Probar en local con `abrir-rotulos.bat` que el login y la impresión funcionan.
3. Confirmar que **`datos-privados/` no se va a subir**: está en `.gitignore`. `js/config.js` sí se sube: tiene solo la URL y la clave pública, que están pensadas para estar en el navegador.

---

## Paso 1 — Archivos de publicación

Crear estos dos archivos en `C:\Users\Usuario\Desktop\Proyectos\impresion de rotulos\`. El `.gitignore` ya existe: excluye `datos-privados/` y cualquier `.json`.

### `robots.txt` (que Google no la indexe)
```
User-agent: *
Disallow: /
```

### `.htaccess` (HTTPS obligatorio, contraseña opcional y archivos internos ocultos)
```apache
# 1) Forzar HTTPS
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteCond %{HTTP:X-Forwarded-Proto} !=https
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# 2) (OPCIONAL, ver paso 6) Pedir usuario y contraseña del servidor.
#    Descomentar las 4 líneas solo si se decide usar esta capa extra.
# AuthType Basic
# AuthName "Rotulos Cindy"
# AuthUserFile /RUTA/ABSOLUTA/A/.htpasswd-rotulos
# Require valid-user

# 3) No servir los archivos internos del proyecto
#    (la carpeta .git la crea el despliegue de Ferozo y tiene el historial completo)
RedirectMatch 404 /\.git
RedirectMatch 404 ^/(supabase|datos-privados)(/|$)
<FilesMatch "(\.md|\.bat|\.json|\.txt|\.gitignore|\.htpasswd.*)$">
  Require all denied
</FilesMatch>

# 4) Que los buscadores no la indexen
<IfModule mod_headers.c>
  Header set X-Robots-Tag "noindex, nofollow"
</IfModule>
```

- El bloque 2 queda comentado. Solo se activa si se elige la capa extra del paso 6.
- Si después de publicar el navegador muestra **"demasiados redireccionamientos"**, borrar el bloque 1 y usar la opción "Forzar HTTPS" del panel (paso 4).
- La documentación, el `.bat` y la carpeta `supabase/` se suben al repositorio (sirven para mantenerlo), pero el bloque 3 hace que no se puedan abrir desde la web. No tienen secretos; es para no exponer detalles internos.

---

## Paso 2 — Repositorio en GitHub

### 2.1 Crear el repositorio local
En una terminal (Git Bash o PowerShell), dentro de la carpeta del proyecto:
```bash
cd "C:/Users/Usuario/Desktop/Proyectos/impresion de rotulos"
git init -b main
git add .
git status
```
**Revisar la lista que muestra `git status`:** no tiene que aparecer **nada** de `datos-privados/` ni ningún `.json`. Si aparece, frenar y revisar el `.gitignore`. Si está todo bien:
```bash
git commit -m "Generador de rótulos: versión inicial para publicar"
```

### 2.2 Crear el repo en GitHub
1. Entrar a github.com con la cuenta `mauriciomre` → **New repository**.
2. Nombre sugerido: **`rotulos-cindy`**. Sin README, sin .gitignore (ya los tenemos).
3. **¿Público o privado?** Ver la tabla, porque cambia el paso 5:

| Opción | Ventaja | Contra |
|---|---|---|
| **Público + SSH** (como Travel Blue y Preventa) | Se conecta igual que los demás, sin claves extra | El código queda visible para cualquiera. Es aceptable: no tiene datos de clientes ni claves secretas (solo la clave pública de Supabase, que igual está en la página) |
| **Privado + HTTPS con token** (como Dashboard Ventas) | Nadie ve el código | Hay que crear un *Personal Access Token* y renovarlo cuando vence |
| Privado + SSH | — | **No funciona:** la clave SSH de Ferozo ya está usada como *deploy key* en `devoluciones_cindy` y GitHub no permite repetirla ("Key is already in use") |

El código no tiene nada sensible, así que la opción más simple es **público + SSH**.

### 2.3 Subir el código
```bash
git remote add origin git@github.com:mauriciomre/rotulos-cindy.git
git push -u origin main
```
(Si se usa la opción privada con HTTPS: `https://github.com/mauriciomre/rotulos-cindy.git`.)

---

## Paso 3 — Crear el subdominio en Ferozo

1. Entrar al panel de Ferozo (`ferozo.host`) con la cuenta del hosting de bagsstore (`td000310`).
2. Ir a la sección de **Dominios → Subdominios**. El nombre exacto puede variar según la versión del panel.
3. Crear el subdominio **`rotulos`** sobre el dominio `bagsstore.com.ar`.
4. Directorio del subdominio: **`/public_html/rotulos/`**, siguiendo la convención de los demás proyectos. Anotar la ruta exacta que muestra el panel porque se usa en los pasos 5 y 6.
5. **Revisar el DNS.** Si el DNS de `bagsstore.com.ar` lo maneja DonWeb, el registro se crea solo. Si lo maneja otro (por ejemplo Cloudflare), hay que agregar a mano un registro `A` o `CNAME` llamado `rotulos`, que apunte al mismo destino que `bagsstore.com.ar`. Para ver quién lo maneja:
   ```bash
   nslookup -type=NS bagsstore.com.ar
   ```
   Si devuelve servidores de DonWeb/Ferozo, es automático.
6. Esperar a que resuelva. Suele tardar minutos, aunque puede llegar a unas horas:
   ```bash
   nslookup rotulos.bagsstore.com.ar
   ```

---

## Paso 4 — Certificado SSL (HTTPS)

1. En el panel de Ferozo, sección **SSL / Certificados**, emitir el certificado gratuito (Let's Encrypt) para **`rotulos.bagsstore.com.ar`**.
2. Si el panel tiene la opción **"Forzar HTTPS"**, activarla. Así se puede prescindir del bloque 1 del `.htaccess` si causa problemas.
3. Comprobar que `https://rotulos.bagsstore.com.ar` muestra el candado. Mientras el certificado no esté emitido, el navegador va a mostrar una advertencia de seguridad.

> El HTTPS es necesario: el login de la app y la sesión viajan con cada pedido. Sin HTTPS, alguien en la misma red podría leerlos.

> **Avisarle a Supabase el dominio nuevo:** en Supabase → **Authentication → URL Configuration**, poner `https://rotulos.bagsstore.com.ar` en **Site URL**. El login con contraseña funciona igual sin esto, pero lo usan los mails de Supabase (por ejemplo, de recuperación).

---

## Paso 5 — Conectar GitHub → Ferozo

Es el mismo mecanismo que usan Travel Blue y Preventa.

1. Panel de Ferozo → **Mi Sitio Web → GIT** → agregar repositorio.
2. Completar:
   - **URL del repositorio:** `git@github.com:mauriciomre/rotulos-cindy.git` (o la HTTPS con token si el repo es privado).
   - **Rama:** `main`
   - **Ruta de destino:** la carpeta del subdominio del paso 3 (por ejemplo `/public_html/rotulos/`).
3. Guardar y hacer el **primer despliegue** con el botón "Desplegar" o "Sincronizar".
4. Verificar en el **Administrador de archivos** de Ferozo que en la carpeta están `index.html`, `.htaccess` y `robots.txt`.

> **Cuidado en la lista de repos GIT de Ferozo:** cada ícono de la fila ejecuta una acción real. Ya pasó una vez que, buscando un log, se apretó sin querer "resincronizar" en `travelblue` y se disparó un despliegue de producción. Antes de hacer clic, pasar el mouse por encima del ícono para ver qué hace.

---

## Paso 6 — (Opcional) Contraseña extra del servidor

**Ya no es necesaria.** La app tiene su propio login (Supabase) y sin login la base no entrega ningún dato. Lo único que alguien de afuera podría ver es la pantalla de ingreso.

Esta capa sirve solo si se quiere que **ni siquiera** se vea la pantalla de ingreso sin una contraseña previa. La contra es que cada usuario tendría que escribir **dos** contraseñas. Recomendación: **no usarla**, salvo que Mauricio prefiera esa capa extra.

Si se decide usarla:

**Opción A — desde el panel (si existe):** si Ferozo tiene la opción **"Directorios protegidos"** (o parecida), usarla sobre la carpeta del subdominio. El panel crea solo el archivo de contraseñas y las líneas del `.htaccess`. En ese caso, dejar comentado el bloque 2 del `.htaccess` del paso 1, para no duplicarlo.

**Opción B — a mano:**
1. Generar la línea de contraseña en Git Bash. Va a pedir la contraseña dos veces y no la muestra:
   ```bash
   printf "cindy:%s\n" "$(openssl passwd -apr1)"
   ```
   Devuelve algo como `cindy:$apr1$....`. Esa línea es la que se guarda, nunca la contraseña en texto.
2. Con el Administrador de archivos de Ferozo, crear el archivo **`.htpasswd-rotulos` FUERA de `public_html`**, en la carpeta raíz de la cuenta, y pegarle esa línea. **No subirlo a GitHub.**
3. Anotar la **ruta absoluta** de ese archivo (el Administrador de archivos la muestra; suele empezar con `/home/...`), descomentar el bloque 2 del `.htaccess` y ponerla en `AuthUserFile`.
4. Hacer commit y push del `.htaccess` corregido.

- La contraseña se guarda en el **gestor de contraseñas**, nunca en el vault, en un mail ni en el repo.
- Se pasa al equipo que imprime rótulos.
- **Probar** que pida la contraseña. Ferozo bloquea el encabezado `Authorization` *hacia PHP*, pero esta autenticación la resuelve el propio servidor web antes de llegar a PHP, así que debería funcionar. Si no pide contraseña o la rechaza siempre, consultar con soporte de DonWeb.

---

## Paso 7 — Despliegue automático (cada push publica solo)

1. En Ferozo → **GIT**, sobre el repo `rotulos-cindy`, botón **"Implementación automática"**. Da una URL del tipo `https://ferozo.host/deploy/git/<token>`.
2. En GitHub → repo `rotulos-cindy` → **Settings → Webhooks → Add webhook**:
   - **Payload URL:** esa URL
   - **Content type:** `application/json`
   - **Evento:** *Just the push event*
   - **Active:** sí
3. GitHub manda un "ping" de prueba. Revisar en **Recent Deliveries** que tenga el tilde verde.

> La URL del webhook funciona como una clave: quien la tenga puede forzar un despliegue (no puede meter código, pero sí disparar un `git pull`). **No anotarla en el vault ni compartirla.** Queda guardada solo en la configuración del webhook de GitHub.

**Desde ese momento, el ciclo de cambios es:**
```bash
git add .
git commit -m "descripción del cambio"
git pull
git push
```
y a los pocos segundos está publicado. Hacer siempre `git pull` antes de `git push` si se trabaja desde más de una PC (regla del equipo).

---

## Paso 8 — Probar

1. Abrir `https://rotulos.bagsstore.com.ar` en **Chrome**:
   - [ ] Tiene el candado (HTTPS) y `http://` redirige a `https://`.
   - [ ] Muestra la pantalla de ingreso con el estilo de Cindy.
   - [ ] Con una contraseña incorrecta no entra; con la correcta, sí.
2. Los clientes ya están en la base (se importaron en SUPABASE-SETUP.md, paso 7). Se ven igual desde cualquier PC y desde el archivo local; no hay que importar nada por computadora.
3. Probar el circuito completo: buscar "ocampo", total 3, debe mostrar 1/3, 2/3 y 3/3 con CREDIFIN, e **imprimir de verdad** con escala 100%.
4. Ingresar con un **operador** y confirmar que no ve Usuarios, Importar ni Exportar.
5. Confirmar que **no** se pueden abrir: `/DOCUMENTACION.md`, `/abrir-rotulos.bat`, `/.git/config`, `/supabase/primer-superadmin.sql`, `/datos-privados/` (deben dar error 403 o 404).

---

## 9. Riesgos y cómo volver atrás

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Exponer datos de clientes | Baja: están en Supabase, detrás del login y de las reglas RLS | Alto (datos personales) | `.gitignore` de `datos-privados/`; nunca poner la clave `service_role` en `js/config.js` |
| Afectar a los otros sitios de bagsstore | Baja: el subdominio usa su propia carpeta | Alto (catálogo, preventa, devoluciones) | No tocar carpetas ni repos GIT de otros proyectos; cuidado con los íconos de la lista GIT (paso 5) |
| Bucle de redirección HTTPS | Media | Bajo (la página no abre) | Quitar el bloque 1 del `.htaccess` y usar "Forzar HTTPS" del panel |
| Supabase pausa el proyecto gratis por inactividad | Baja con uso diario | Medio (no anda hasta reactivarlo) | Reactivar desde el panel; no se pierden datos |
| Perder datos (el plan gratis no tiene backups descargables) | Baja | Alto | Un superadmin hace **Exportar** cada tanto y guarda el `.json` en un lugar privado |

**Cómo volver atrás:**
- **Error en un cambio:** `git revert <commit>` + `git push`, y el webhook publica la versión anterior.
- **Despublicar del todo:** en Ferozo, desconectar el repo en GIT y borrar el subdominio. No afecta a ningún otro sitio. La herramienta local (`abrir-rotulos.bat`) sigue funcionando igual.

---

## 10. Después del despliegue

- Registrar en el vault (nota del proyecto): URL, repo, carpeta en Ferozo, si el repo es público o privado, y la fecha. **Nunca** la contraseña ni la URL del webhook.
- Agregar el proyecto a la tabla de `conocimiento/deploy-hosting.md` (eso lo consolida Mauricio).
- Registrar también el proyecto de Supabase: nombre, región y quién es superadmin. Las claves van al gestor de contraseñas, no al vault.
