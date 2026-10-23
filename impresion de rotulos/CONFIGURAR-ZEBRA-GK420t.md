# Configurar la Zebra GK420t para los rótulos (10 × 6,5 cm)

Guía definitiva, armada con las pruebas reales del 22 y 23/10/2026. Se hace **una sola vez por computadora**. Si algo de la guía anterior (`IMPRIMIR-EN-ZEBRA.md`) contradice esta, vale esta.

**Datos de la impresora**
- Modelo: **Zebra GK420t**: térmica, **203 dpi**, cabezal de 4" (104 mm).
- Driver en Windows: **ZDesigner GK420t** (ZPL o EPL; ambos de 203 dpi).
- Etiqueta: **100 mm × 65 mm**. Sale de la impresora **acostada**: los **100 mm van a lo ancho del cabezal** y los 65 mm en el sentido en que avanza el papel.

**La idea:** la página que manda la app (10 × 6,5 cm) tiene que llegar a la etiqueta **tal cual**. Chrome **encaja la hoja en el papel que tiene cargado el driver**, así que si el driver tiene otro tamaño cargado, todo sale achicado o agrandado. Por eso lo más importante es que el driver tenga **exactamente 100 × 65 mm**.

> **Comprobado en la impresora (23/10/2026):**
> - **Orientación:** con el driver en **Horizontal / Landscape** y la app en **Sin girar**, el rótulo sale derecho.
> - **Escala:** salía todo al **75%** (1 cm impreso = 7,5 mm) y del tamaño de **3 × 2 pulgadas (76 × 51 mm)**, aun cuando la app mandaba la hoja agrandada. Eso quiere decir que el driver tiene cargado un papel de **3" × 2"**: un tamaño de etiqueta común, pero no el nuestro. Se arregla cambiando el papel del driver (1.2), no en la app.

---

## Parte 1 — Driver de Windows

> **Antes de empezar:** sacale una captura a cada pestaña de las Preferencias de impresión **como están ahora**. Si algo sale mal, o si el Sheet viejo todavía se usa, se puede volver atrás.

### 1.1 Abrir las preferencias
1. Menú Inicio → **Configuración → Bluetooth y dispositivos → Impresoras y escáneres**.
2. Elegir **ZDesigner GK420t**. Fijarse que diga **GK420t** y no otro modelo (por ejemplo GX430t o ZT230-300dpi): un driver de 300 dpi en esta impresora de 203 dpi achica todo al ~68%.
3. **Preferencias de impresión**.

> Hacer los mismos cambios también en **Propiedades de impresora → pestaña Opciones avanzadas → Valores predeterminados de impresión** (*Printing Defaults*). Algunos programas, Chrome entre ellos, leen esos valores y no las preferencias.

### 1.2 Pestaña **Opciones** (*Options*) — papel y orientación
| Campo | Valor |
|---|---|
| Formato de papel / *Paper Format* → Unidades | **mm** (o cm) |
| Tamaño → **Ancho / Width** | **100** mm |
| Tamaño → **Alto / Height** | **65** mm |
| Área no imprimible / *Unprintable area* | **0** en los cuatro lados |
| **Orientación / Orientation** | **Horizontal / Landscape** (comprobado: así sale derecho en esta impresora) |
| Girar 180° / *Rotate 180°* | **destildado** |

**Orientación:** en esta GK420t, con **Horizontal** y la app en "Sin girar", el rótulo sale derecho (prueba del 23/10/2026). Si alguna vez sale de costado, chico y cortado, probar **Vertical** (y nunca girar también desde la app). **Regla:** gira uno solo, el driver o la app.

**Tamaño:** si el papel tiene unidades en **pulgadas**, 100 × 65 mm son **3,94 × 2,56 in**. Ojo con dejar **3,00 × 2,00 in**: es lo que tenía cargado y por eso salía todo al 75%.

Si la pestaña tiene **Papel / Stocks** con una lista: crear uno nuevo llamado `Rotulo 100x65` con 100 × 65 mm y elegirlo.

### 1.3 Pestaña **Configuración avanzada** (*Advanced Setup*) — tipo de etiqueta
| Campo | Valor |
|---|---|
| Tipo de impresión / *Media type* | **Transferencia térmica** si hay **ribbon** (cinta) colocado; **Térmica directa** si no hay cinta. La GK420t usa ribbon, pero hay que mirar la impresora |
| Seguimiento / *Media tracking* | **Con separación / Web sensing** (etiquetas con espacio entre una y otra). Si atrás tienen una marca negra: *Mark sensing* |
| Manejo / *Media handling* | **Tear off** (cortar a mano) |
| Desplazamiento / *Offset* | 0 |

### 1.4 Pestaña **Opciones** — calidad
| Campo | Valor |
|---|---|
| Oscuridad / *Darkness* | **15–20** para empezar. Subir si sale gris, bajar si se empasta |
| Velocidad / *Speed* | **2–3 pulgadas/seg** (más lento = más nítido) |

### 1.5 Calibrar
Pestaña **Herramientas** (*Tools*) → **Acción → Calibrar** (*Calibrate*) → **Enviar**. También se puede desde la impresora: con la tapa cerrada, mantener apretado el botón **Feed** hasta que la luz parpadee 2 veces y soltar. La impresora avanza unas etiquetas y aprende dónde empieza cada una.

Aceptar y cerrar.

---

## Parte 2 — Chrome (cuadro de impresión)

Al tocar **Imprimir rótulos** en la app, en **Más opciones de configuración**:

| Opción | Valor |
|---|---|
| Destino | **ZDesigner GK420t** |
| Tamaño del papel | el de **100 × 65** (o "User defined" si es lo único que aparece y el driver ya quedó en 100 × 65) |
| Márgenes | **Ninguno** |
| Escala | **Predeterminada** o **Personalizada 100**. **Nunca** "Ajustar al área imprimible" |
| Gráficos en segundo plano | indistinto |

Arriba tiene que decir **"1 hoja de papel"** por bulto.

---

## Parte 3 — Qué tocar en el programa (Generador de rótulos)

En la columna izquierda, sección **Medida**:

| Opción | Valor | Para qué |
|---|---|---|
| Tamaño del rótulo | **Etiqueta 10 × 6,5 cm** | Es la medida de la etiqueta |
| Papel | **Un rótulo por página (etiquetera)** | Un bulto por etiqueta |

Abrir **Ajuste de impresión (Zebra)**:

| Opción | Valor | Para qué |
|---|---|---|
| **Giro del rótulo** | **Sin girar** | La orientación la resuelve el driver (Horizontal). **Si acá se elige "Girar 90°", el rótulo sale de costado.** |
| **1 cm impreso mide (mm)** | **10** | Con el papel del driver bien cargado no hace falta. **No sirve para corregir un papel equivocado en el driver**, porque Chrome igual encaja la hoja en ese papel. Solo es un recurso si quedara una diferencia chica (ej. 9,8 mm) con el papel ya correcto |
| Tamaño (%) | **100**, o 94–96 si se quiere un margen blanco alrededor como el de los rótulos viejos | Margen |
| Mover → / Mover ↓ (mm) | **0**; solo si queda corrido para un lado | Centrar |
| Intensidad de la tinta | **Reforzada** | Letra firme en térmica |

Todo esto se guarda en esa computadora (y en ese navegador). Si se cambia algo y no se ve, recargar con **Ctrl+F5**.

**Para que el rótulo no se deforme:** la app nunca lo estira. Siempre mantiene la proporción original del Sheet y, si la hoja es más chica, lo achica parejo. Si aparece deformado o girado, el problema está en el driver (orientación u otro tamaño de papel) o en Chrome (escala "Ajustar"), no en la app.

---

## Parte 4 — Verificar con la hoja de prueba

1. App → **Ajuste de impresión (Zebra)** → **Imprimir hoja de prueba**.
2. Mirar la etiqueta:
   - **Orientación:** el texto "PRUEBA DE IMPRESIÓN" tiene que leerse **a lo largo de la etiqueta**, en el lado de 10 cm, con la flecha ARRIBA hacia el borde superior. "Hoja enviada" tiene que decir **10 × 6,5 cm**. Si dice 6,5 × 10, en la app está elegido un giro: pasarlo a "Sin girar".
   - **Escala:** apoyar una regla sobre la regla impresa y medir cuántos **mm hay entre dos números seguidos**.
     - **10 mm:** perfecto. En la app, "1 cm impreso mide" = **10**.
     - **Menos de 10** (por ejemplo **7,5**) y la hoja sale de unos **7,6 × 5 cm**: el driver tiene cargado otro papel (típicamente 3 × 2 pulgadas). Corregir el papel en 1.2 y en "Valores predeterminados de impresión", cerrar y volver a abrir el cuadro de impresión de Chrome, y reimprimir. Con la app en 10, tiene que dar 10 mm.
     - **Si con el papel correcto queda una diferencia chica** (ej. 9,8 mm), recién ahí cargar ese número en "1 cm impreso mide".
3. Imprimir **un rótulo real con 2 bultos**: tienen que salir 2 etiquetas, cada rótulo entero, derecho y del tamaño de la etiqueta.

---

## Problemas y soluciones rápidas

| Qué se ve | Qué tocar |
|---|---|
| Rótulo de costado (texto a lo largo de los 6,5 cm), chico y cortado | Gira uno de más o de menos. App: **Sin girar**; driver: **Horizontal** (lo comprobado). Si sigue, probar driver Vertical |
| Cabeza abajo | Driver: destildar **Rotate 180°** |
| Todo más chico, pero derecho (1 cm = 7,5 mm, la hoja de ~7,6 × 5 cm) | El driver tiene un papel de **3" × 2"**: cambiarlo a **100 × 65 mm** (3,94 × 2,56 in), área no imprimible 0, también en Valores predeterminados. App: "1 cm impreso mide" = **10** |
| 2 hojas por bulto / una etiqueta en blanco en el medio | Calibrar (1.5); driver 100 × 65; Chrome márgenes Ninguno. Recargar la app con Ctrl+F5 |
| Corrido para un lado | App: Mover → / Mover ↓ en mm |
| Letra clara o punteada | Driver: subir Oscuridad o bajar Velocidad; app: Intensidad Reforzada/Máxima |
| Letra empastada | Bajar Oscuridad; app: Intensidad Normal |
| Aparecen fecha o URL impresas | Chrome: desactivar "Encabezados y pies de página" |

---

## Anexo — Si sale al 80% (1 cm impreso = 8 mm), comprobado el 23/10/2026

Con el driver ya en 10 × 6 cm, Horizontal y área no imprimible 0, la hoja de prueba salió **derecha pero al 80%**, parejo en los dos sentidos. La GK420t imprime **8 puntos por mm** (203 dpi) y 8/10 = 0,8: en algún paso, la hoja se arma como si la impresora tuviera 10 puntos por mm.

Probar en este orden y quedarse con el primero que dé **10 mm** en la hoja de prueba:
1. Driver: **Altura 6,50** (estaba en 6,00) y **Velocidad 5,1 cm/s** (estaba en 12,7, la máxima). También en "Valores predeterminados de impresión".
2. App: **"1 cm impreso mide" = 8**. Ahora que el papel del driver es el correcto, la corrección de la app sí debería tener efecto. Antes no lo tenía porque Chrome encajaba todo en el papel de 3" × 2".
3. Si no: app en **10** y en el cuadro de impresión **de Chrome** (no "Imprimir mediante el sistema de diálogo") → **Escala → Personalizada → 125**.

Usar siempre el cuadro de impresión de Chrome: tiene la escala y recuerda la configuración.

**Orientación en el cuadro gris de Chrome:** no aparece la opción "Diseño" (Vertical/Horizontal) porque la app fija la medida de la hoja (10 × 6,5 = horizontal) y Chrome toma la orientación de ahí. El cuadro gris usa los **Valores predeterminados de impresión** del driver: dejar ahí **Horizontal, 10 × 6,5, área no imprimible 0**, igual que en Preferencias. Si aun así sale de costado: en la app usar "Girar 90°", o imprimir con el cuadro de Windows (Ctrl+Shift+P) en Horizontal y compensar la escala desde la app ("1 cm impreso mide" = 8).
