# Generador de rótulos de envío — Documentación técnica

Herramienta web para imprimir los rótulos de envío de Cindy Mayorista / Bag Store SRL. Reemplaza al Google Sheet donde se duplicaba una pestaña por cliente. El rótulo impreso es **idéntico** al del Sheet.

- **Creado:** 22/10/2026 (Luca Morales, con Claude).
- **Sheet original de referencia:** `https://docs.google.com/spreadsheets/d/1UoVHMevDD_kCXOUCV1O878EZRnzG2rYsuXg4FkNsd9A` (pestaña "Hoja 1" = plantilla).
- **Impresora:** Zebra **GK420t** (térmica, 203 dpi), etiqueta 10 × 6,5 cm que sale acostada. Configuración definitiva en [CONFIGURAR-ZEBRA-GK420t.md](CONFIGURAR-ZEBRA-GK420t.md); historial de pruebas en [IMPRIMIR-EN-ZEBRA.md](IMPRIMIR-EN-ZEBRA.md).
- **Puesta en marcha de la base:** [SUPABASE-SETUP.md](SUPABASE-SETUP.md). **Publicación en un subdominio:** [GUIA-DESPLIEGUE.md](GUIA-DESPLIEGUE.md).

---

## 1. Arquitectura

```
Navegador (HTML + CSS + JS, sin compilar)
  │  clave pública (anon/publishable) + sesión del usuario
  ▼
Supabase
  ├─ Auth ............ login con email y contraseña
  ├─ Postgres + RLS .. clientes, transportes, config, perfiles (rol)
  └─ Edge Function ... admin-usuarios (crear / roles / desactivar / contraseñas)
                       usa la clave service_role, que nunca llega al navegador
```

- **No hay servidor propio.** El front es estático: se puede abrir con doble clic (`abrir-rotulos.bat`) o publicar en cualquier hosting (Ferozo).
- **La seguridad está en la base:** las reglas RLS deciden qué puede leer o escribir cada usuario. Aunque alguien modifique el JavaScript en su navegador, la base rechaza lo que su rol no permite.
- **Roles:**
  - **operador:** imprime, busca, crea y edita clientes, agrega transportes.
  - **superadmin:** lo mismo, y además administra usuarios (crearlos, darles superadmin, desactivarlos, cambiar contraseñas), importa y exporta clientes, borra y cambia el remitente compartido.
- **Siempre queda al menos un superadmin activo:** lo garantiza un trigger en la base.
- **Se necesita internet** para usar la herramienta: los datos están en Supabase.

---

## 2. Archivos

```
impresion de rotulos/
├─ index.html                 Estructura de las pantallas. Sin estilos ni lógica.
├─ img/travelblue-logo.png    Logo de Travel Blue (copia de vault: proyectos/adjuntos/marcas/travel-blue).
├─ abrir-rotulos.bat          Abre index.html en Chrome/Edge.
├─ css/
│  ├─ app.css                 Estilos de la interfaz (identidad Cindy).
│  └─ impresion.css           Qué se imprime (solo los rótulos).
├─ js/
│  ├─ config.js               URL y clave PÚBLICA de Supabase.  ← completar
│  ├─ utils.js                Utilidades sin lógica de negocio ($, esc, norm, toast…).
│  ├─ rotulo.js               LÓGICA: dibujo del rótulo en SVG (geometría del Sheet).
│  ├─ api.js                  DATOS: única parte que habla con Supabase.
│  ├─ vistas/                 PANTALLA: cada archivo maneja una parte de la interfaz.
│  │  ├─ acceso.js            Pantallas de login/carga/config y barra del usuario.
│  │  ├─ rotulos.js           Envío, medida, remitente, vista previa e impresión.
│  │  ├─ clientes.js          Buscador, alta/edición, importar/exportar.
│  │  ├─ transportes.js       Desplegable y "Agregar otro transporte…".
│  │  └─ usuarios.js          Panel de usuarios (superadmin).
│  └─ main.js                 Arranque: conecta todo y decide qué pantalla mostrar.
├─ supabase/
│  ├─ migrations/20261022000000_esquema_inicial.sql   Tablas, RLS, triggers, datos base.
│  ├─ migrations/20261022010000_ajustar_permisos.sql  Quita permisos por defecto innecesarios.
│  ├─ migrations/20261022020000_cuentas_nuevas_desactivadas.sql  Cuentas nuevas nacen inactivas.
│  ├─ migrations/20261026000000_rotulo_travelblue.sql  Config de Travel Blue solo para superadmin.
│  ├─ primer-superadmin.sql   Convierte al primer usuario en superadmin.
│  ├─ crear-superadmin-luca.sql  Crea el superadmin "Luca" en un paso (se pega la contraseña).
│  ├─ functions/admin-usuarios/index.ts               Edge Function (Deno/TypeScript).
│  └─ config.toml             Config de la función (solo si se usa la CLI).
├─ datos-privados/            DATOS PERSONALES. No se sube a GitHub ni al hosting.
│  └─ clientes-iniciales.json Los 38 clientes del Sheet, para importar una vez.
├─ .gitignore
├─ DOCUMENTACION.md / SUPABASE-SETUP.md / GUIA-DESPLIEGUE.md
├─ CONFIGURAR-ZEBRA-GK420t.md (guía definitiva) / IMPRIMIR-EN-ZEBRA.md (historial)
```

### Reglas de la separación
- **`rotulo.js` no conoce la pantalla ni la base:** recibe datos y devuelve SVG. Si se quiere usar el rótulo en otro lado (por ejemplo, el panel de bagsstore), se copia solo este archivo (más `utils.js`).
- **`api.js` es el único que habla con Supabase.** Si el back cambia, se reescribe este archivo y las vistas quedan igual.
- **Las vistas no hablan entre ellas por variables globales sueltas:** cada una expone unas pocas funciones en `window.Rotulos` (por ejemplo `R.vistaRotulos.render()`).
- **Por qué no se usan módulos ES (`import`/`export`):** al abrir `index.html` con doble clic (`file://`), Chrome bloquea los módulos ES. Con `<script>` comunes y el espacio de nombres `window.Rotulos` funciona igual con doble clic y publicado.
- **Versión de los archivos (`?v=`):** cada CSS/JS se carga como `js/api.js?v=20261022.3`. **Al cambiar cualquier CSS o JS, subir ese número en todas las líneas de `index.html`.** Si no, el navegador puede seguir usando la versión vieja guardada en caché (ya pasó: el menú Usuarios mostraba un mensaje de una versión anterior).
- **Orden de carga** (en `index.html`): librería de Supabase → `config` → `utils` → `rotulo` → `api` → vistas → `main`. Cada archivo usa solo lo que se cargó antes.

---

## 3. El rótulo (la parte que no hay que romper) — `js/rotulo.js`

El rótulo se dibuja como **SVG** con `R.rotulo.svg(datos, n, total)`. Al ser vectorial se ve idéntico a cualquier tamaño.

### Geometría
Medidas en "píxeles del Sheet al 100%", tomadas de los anchos de columna, las uniones de celdas y el alto real de las filas de la pestaña "Hoja 1".

- **Lienzo:** `W = 883`, `H = 558` → **proporción 1,582 : 1** (`RATIO`).
- **Marco:** 2 px gris `#595959` y 2 px blanco por dentro.
- **Franja negra del transporte:** `x 4–94`, `y 4–554` (celda C3:C19).
- **Separador horizontal gris** `#bfbfbf`: `y 381–392` (fila 12, D:M).
- **Separadores verticales grises:** columna I `x 594–606` y L `x 732–740`, filas 13–19.

### Textos
| Texto | Posición (x, línea base y) | Fuente | Tamaño Sheet → SVG |
|---|---|---|---|
| Transporte (vertical, de abajo hacia arriba) | centrado en la franja negra | Arial bold, blanco | 32 pt → 42,7 |
| PARA | 97, 30 | Calibri | 18 pt → 24 |
| NOMBRE / DIRECCION / CIUDAD / PROVINCIA / CP | 97; y = 73, 115, 157, 199, 241 | Arial **bold itálica** | 24 pt → 32 |
| DNI/CUIT / TEL / EMAIL | 97; y = 283, 325, 368 | Arial bold | 24 pt → 32 |
| Remitente (4 líneas, centradas) | 344; y = 441 + 28·i | Arial bold | 18 pt → 24 |
| BULTO N° | 609, 416 | Calibri bold | 18 pt → 24 |
| Número de bulto | 669 (centrado), 537 | Arial bold | **77 pt → 102,7** |
| TOTAL DE / BULTOS | 743; y = 416 / 445 | Calibri bold | 18 pt → 24 |
| Total de bultos | 809,5 (centrado), 539 | Arial bold | **80 pt → 106,7** |

Conversión: **px = pt × 4/3**, así se mantienen las proporciones del Sheet.

- **Textos que no entran:** cada `<text>` tiene `data-max` (ancho de su celda). `ajustarTextos()` achica la letra lo justo para que entre.
- **`parseSolo("3, 7-9", total)`:** interpreta "Reimprimir solo".
- **Remitente por defecto:** `REMITENTE_DEFAULT`, que solo se usa si la base no tiene uno. El real está en la tabla `config`, clave `remitente`, y lo cambia un superadmin con **"Guardar para todos"**.

---

## 4. Base de datos (Supabase) — `supabase/migrations/…sql`

| Tabla | Columnas principales | Quién lee | Quién escribe |
|---|---|---|---|
| `perfiles` | `id` (= usuario de Auth), `email`, `nombre`, `rol` (`superadmin`/`operador`), `activo` | cada uno el suyo; superadmin todos | solo la Edge Function |
| `clientes` | `nombre`, `direccion`, `ciudad`, `provincia`, `cp`, `dni`, `tel`, `email`, `transporte`, `creado_por/en`, `actualizado_por/en` | usuarios activos | crear/editar: activos; borrar: superadmin |
| `transportes` | `nombre` (único), `orden`, `activo` | usuarios activos | agregar: activos; editar/borrar: superadmin |
| `config` | `clave`, `valor` (jsonb): `remitente` (Cindy) y `remitente_travelblue` | usuarios activos; las claves que contienen `travelblue` **solo superadmin** | superadmin |

Funciones y triggers:
- `es_superadmin()` / `es_usuario_activo()`: las usan las reglas RLS.
- `crear_perfil_nuevo_usuario()`: al crear un usuario en Auth le crea su perfil como `operador` y **desactivado**. Lo activan la Edge Function, al crear desde la app, o `primer-superadmin.sql`. Así, una cuenta creada por fuera de la app (registro público o panel) no ve nada hasta que un superadmin la active.
- `proteger_ultimo_superadmin()`: impide quitar o desactivar el último superadmin activo.
- `marcar_actualizacion()`: completa `actualizado_en` y `actualizado_por` (auditoría básica: se sabe quién tocó cada cliente por última vez).

**Cambios en la base:** crear un archivo **nuevo** en `supabase/migrations/` con fecha en el nombre (por ejemplo `20261105000000_agregar_campo_x.sql`) y correrlo en el SQL Editor. No editar el inicial una vez corrido.

---

## 5. Edge Function `admin-usuarios` — `supabase/functions/admin-usuarios/index.ts`

> Publicada en este proyecto con el nombre **`dynamic-processor`**. La app la llama por el nombre que diga `funcionUsuarios` en `js/config.js`.

En cada pedido:
1. Valida el token de sesión de quien llama.
2. Verifica en `perfiles` que sea **superadmin activo** (si no, responde 403).
3. Ejecuta `body.accion`:

| Acción | Datos | Qué hace |
|---|---|---|
| `listar` | — | Perfiles + último ingreso |
| `crear` | `email`, `password` (≥ 8), `nombre`, `rol` | Crea el usuario ya confirmado y le asigna el rol. Si falla el perfil, borra el usuario |
| `cambiar_rol` | `id`, `rol` | La base impide dejar sin superadmins |
| `desactivar` / `activar` | `id` | Marca el perfil y además bloquea o desbloquea el login en Auth. No permite desactivarse a sí mismo |
| `resetear_password` | `id`, `password` | Cambia la contraseña |
| `editar_nombre` | `id`, `nombre` | — |

Los errores vuelven como `{ error: "mensaje en castellano" }`.

---

## 6. Front: qué hace cada vista

- **`acceso.js`:** muestra una de cuatro pantallas (`pantalla-config`, `pantalla-carga`, `pantalla-login`, `app`). Pinta nombre y rol, y muestra u oculta los elementos marcados con `data-solo-superadmin`. Ojo: ocultarlos es solo comodidad visual; la seguridad real es la de la base.
- **`main.js`:** sin configuración muestra `pantalla-config`. Con sesión guardada entra directo; si no, pide login. Al entrar verifica que el perfil esté activo y carga en paralelo transportes, remitente y clientes. Si la sesión se cierra (también desde otra pestaña), vuelve al login.
- **`clientes.js`:**
  - Trae todos los clientes a memoria (de a 1000) para buscar al instante mientras se escribe.
  - Al buscar, si la copia tiene más de 1 minuto, la vuelve a traer para ver lo que cargaron otros.
  - Guardar crea o actualiza en la base y avisa si hay duplicados (mismo DNI o nombre).
  - Al imprimir guarda solo un cliente nuevo, y si se modificó uno existente pregunta antes.
  - **Importar** (superadmin) acepta el `.json` de exportación o `clientes-iniciales.json`: actualiza los que coinciden por DNI/CUIT o nombre y crea el resto.
- **`transportes.js`:** desplegable desde la tabla `transportes`. "Agregar otro transporte…" lo guarda en la base y queda para todos.
- **`rotulos.js`:** igual que antes (medida, papel, `@page`, vista previa). La **medida y el papel** se recuerdan en cada computadora (`localStorage`, clave `rotulos.prefs`). El remitente viene de la base, se puede cambiar para una impresión y un superadmin lo guarda para todos.
- **`usuarios.js`:** tabla de usuarios con cambio de rol, activar/desactivar y nueva contraseña, más el formulario de alta. Pide confirmación antes de dar superadmin.

**Nombre de usuario en lugar de email:** Supabase Auth exige un email. Para que se pueda entrar como `Luca`, `R.util.aEmail()` convierte lo escrito en `luca@<dominioUsuarios>` (`js/config.js`, hoy `rotulos.cindymayorista.com.ar`). Si se escribe un email completo, se respeta. `aUsuario()` hace la conversión inversa para mostrarlo. El alta de usuarios en el panel funciona igual. **No cambiar `dominioUsuarios`** con usuarios ya creados.

**Corrección de escala de la impresora:** campo "1 cm impreso mide (mm)" (`ajuste-cm`, default 10). En modo etiqueta, `k = 10 / mm`: la `@page`, las hojas (`--wp`/`--hp`) y el corrimiento (`--dxp`/`--dyp`) se mandan ×k, para compensar diferencias chicas de escala. **No corrige un papel equivocado en el driver:** Chrome encaja la hoja en el papel del driver (comprobado el 23/10: con 7,5 cargado salió igual de chico, porque el driver tenía 3" × 2"). Default y recomendado: 10. La vista previa en pantalla no cambia. Se guarda en `rotulos.prefs.v2` → `ajuste.cm`.

**Giro del rótulo:** `ajuste-giro` (`no` por defecto desde el 23/10/2026 / `der` / `izq`); la GK420t saca la etiqueta con los 10 cm a lo ancho del cabezal, así que con el driver en 100 × 65 y Vertical no hace falta girar (los giros quedan como recurso). Las preferencias guardadas con versión de ajuste < 3 vuelven a `no`. **Hoja de prueba:** `R.rotulo.svgPrueba(anchoCm, altoCm)` dibuja reglas en cm, la esquina y una flecha de arriba, con el tamaño de la página enviada; se imprime con "Imprimir hoja de prueba" y la vista vuelve sola con `afterprint`. Con giro, la `@page` es alto × ancho (6,5 × 10 cm) y en la impresión `.hoja > .giro` se rota 90° (`css/impresion.css`, clases `girar-der`/`girar-izq` en `<body>`); en pantalla no se gira. Motivo: en la Zebra de Cindy la etiqueta avanza por el lado corto (prueba real 22/10/2026).

**Ajuste de impresión (Zebra):** cada rótulo va dentro de una `.hoja` del tamaño exacto de la etiqueta. Adentro, el SVG se escala y mueve con `--esc`, `--dx` y `--dy`, desde los campos "Tamaño (%)" y "Mover (mm)". La **intensidad** (`normal`/`reforzada`/`maxima`) agrega a cada texto un trazo del mismo color (`R.rotulo.TRAZO`: 0 / 1,2 / 2,2 unidades del lienzo). Se guarda en `rotulos.prefs.v2` → `ajuste`. Default: 100%, sin corrimiento, Reforzada. Detalle de uso en IMPRIMIR-EN-ZEBRA.md.

**Medida por defecto:** "Etiqueta 10 × 6,5 cm" (valor `10x6.5` del selector). La hoja mide exactamente eso; el rótulo conserva su proporción (1,582) y queda centrado, con 10 × 6,32 cm y 0,9 mm libres arriba y abajo. Los presets con un solo número (`15`, `20`, `27.7`) fijan el ancho y calculan el alto. Las preferencias se guardan en `rotulos.prefs.v2`.

**Sesión:** Supabase la guarda en el navegador (`localStorage`, clave `rotulos.sesion`) y la renueva sola. "Salir" la borra.

---

## 7. Interfaz (identidad Cindy) — `css/app.css`

- Colores del manual: naranja `#e84e1b`, negro, blanco (variables en `:root`).
- Tipografías: Lora (títulos) y Jost (interfaz), desde Google Fonts.
- Encabezado con el **isotipo** (círculo naranja con "C"). No se reconstruye el logo "CINDY" porque el manual prohíbe otra tipografía.
- Íconos SVG (Lucide). **Nunca emojis como íconos.**
- El rótulo no usa nada de este CSS.

---

## 8. Cómo probar después de un cambio

1. Abrir con `abrir-rotulos.bat` (o recargar con F5).
2. Ingresar como superadmin. Buscar un cliente, poner **Total de bultos = 3** → tienen que aparecer 1/3, 2/3, 3/3.
3. Cambiar un dato → aparece "cambios sin guardar" → **Guardar cambios del cliente** → recargar la página y ver que el cambio sigue ahí (quedó en la base).
4. Probar "Reimprimir solo" con `2`, cambiar medida y papel, y abrir la vista previa de impresión (Ctrl+P) con escala 100%.
5. Ingresar con un **operador**: no tiene que ver Usuarios, Importar, Exportar ni "Guardar para todos".
6. Errores de código: F12 → **Console**. Errores de la función: Supabase → Edge Functions → `admin-usuarios` → **Logs**.

---

## 8 bis. Tipo de rótulo: Cindy Mayorista / Travel Blue (26/10/2026)

- **Quién lo ve:** el selector **"Tipo de rótulo"** (sección Envío) tiene `data-solo-superadmin`. Para un operador, `disenoActual()` en `js/vistas/rotulos.js` siempre devuelve `"cindy"`, aunque alguien fuerce el selector desde la página.
- **Seguridad en la base:** el remitente de Travel Blue está en `config` con la clave `remitente_travelblue`. La política `config_select` solo deja leer claves que contienen `travelblue` a un superadmin (migración `20261026000000_rotulo_travelblue.sql`). `main.js` solo pide esa clave si el perfil es superadmin.
- **Diseño** (`R.rotulo.svg(..., { diseno: "travelblue" })`): misma grilla, franja, campos y cajas que el de Cindy. Cambia el bloque del remitente:
  - 4 líneas de 16 unidades, con línea base en `410 + 19,5·i`, centradas en x = 344. Las que empiezan con "(" van sin negrita.
  - Debajo, el logo `img/travelblue-logo.png` en `x 235, y 477, 219 × 75`.
  - Medidas tomadas de la plantilla de Travel Blue (captura del Sheet, 26/10/2026).
- **Remitente por defecto:** `R.rotulo.REMITENTE_TRAVELBLUE_DEFAULT`:
  - BAG STORE S.R.L CUIT:30-71455926-1
  - TEL: 3534 06-2150
  - EMAIL: INFO@TRAVELBLUE.COM.AR
  - (CON ENTREGA EN DOMICILIO)
- **Remitente por tipo:** cada tipo guarda el suyo. "Guardar para todos" guarda el remitente del tipo elegido.
- **Clientes y transportes:** son los mismos para los dos tipos. En la plantilla de Travel Blue el transporte aparece como "ENTREGA"; si hace falta ese texto exacto, agregarlo con "Agregar otro transporte…".
- El tipo elegido **no se recuerda** entre sesiones: siempre arranca en Cindy, para no imprimir uno de Travel Blue por error.
- La vista previa agrega "· Travel Blue" al título cuando corresponde.

## 9. Limitaciones y próximos pasos

- **Remitente de Travel Blue:** hecho el 26/10/2026 (ver 8 bis). La variante vieja con "CANT. DE BULTOS DE ESTE ENVIO" no se implementó: la plantilla nueva dice "TOTAL DE BULTOS".
- **Borrar clientes:** la base lo permite al superadmin, pero todavía no hay botón en la pantalla.
- **Integración con bagsstore:** si en algún momento se prefiere la base MySQL de bagsstore en lugar de Supabase, alcanza con reescribir `js/api.js`.
- **Hasta 500 bultos por tanda** (`max` del input `#total` y `render()`).
