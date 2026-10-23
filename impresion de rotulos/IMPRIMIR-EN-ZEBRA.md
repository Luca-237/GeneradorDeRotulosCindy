# Imprimir los rótulos en la Zebra (etiqueta 10 × 6,5 cm)

> **Reemplazada por [CONFIGURAR-ZEBRA-GK420t.md](CONFIGURAR-ZEBRA-GK420t.md)** (23/10/2026), que es la guía definitiva. Esta queda como historial de las pruebas y diagnósticos.

Los rótulos se imprimen en una **impresora térmica Zebra**. Para que cada rótulo salga en su etiqueta, sin cortarse ni ocupar dos etiquetas, hay que configurar dos cosas **una sola vez**: el driver de Windows y el cuadro de impresión de Chrome.

> **Impresora:** Zebra **GK420t** (203 dpi), driver **ZDesigner GK420t**. Falta confirmar en qué PC está conectada; lo más probable es que sea la de Antonella (facturación).

---

> **Importante: cómo sale la etiqueta (foto de la impresora, 23/10/2026).** En la GK420t la etiqueta sale **con los 10 cm a lo ancho del cabezal** y **6,5 cm en el sentido del avance**: sale "acostada". La hoja de la app (10 × 6,5 cm) entra **tal cual, sin girar nada**.
> - **Configuración correcta, sin giros:** app en **"Sin girar"** + driver con papel **100 mm de ancho × 65 mm de alto** y orientación **Vertical / Portrait**, sin rotación de 180°.
> - Si el driver queda en **Horizontal / Landscape**, gira la hoja y el rótulo sale **a lo largo del avance**: de costado, chico y cortado. Pasó en las pruebas del 22 y 23/10, con y sin giro en la app. Las primeras conclusiones de esta guía ("sale de punta", "el driver gira") estaban equivocadas.
> - Los giros de la app ("Girar 90°") quedan solo como recurso si no se puede tocar el driver.
> - Para confirmar, usar **"Imprimir hoja de prueba"** (punto 2): las reglas tienen que medir 1 cm por número y el texto se tiene que leer **a lo ancho de la impresora** (paralelo a la salida).

## 1. Driver de Windows (una sola vez por PC)

1. **Configuración de Windows → Bluetooth y dispositivos → Impresoras y escáneres** → elegir la Zebra (suele llamarse **ZDesigner …**).
2. **Preferencias de impresión** (o "Printing Preferences").
3. Pestaña **Page Setup / Configuración de página** → **Stocks / Papel** → **New / Nuevo**:
   - **Nombre:** `Rotulo 10x6.5`
   - **Ancho (Width): 100 mm · Alto (Height): 65 mm.** El ancho es el lado que va a lo ancho del cabezal. Si ya existe un papel con otra medida (por ejemplo, el que usaba el Sheet), crear este nuevo igual.
   - **Tipo:** etiqueta con separación (*Label with gaps* / *Gap*). Si las etiquetas tienen una marca negra atrás, elegir *Mark*.
4. Elegir ese papel como el predeterminado. **Orientación: Vertical / Portrait** y **sin "Rotate 180°"**. Aunque la etiqueta se vea apaisada, en los drivers Zebra "Vertical" quiere decir **sin rotar**: el ancho del papel va a lo ancho del cabezal. En la app: "Sin girar".
   - **Ojo:** si todavía se imprime algo desde el Sheet viejo, puede que necesite la configuración anterior. Anotar la configuración actual antes de cambiarla.
5. Pestaña **Options / Opciones**: **Darkness / Oscuridad** en un valor medio (por ejemplo 15–20) y **Speed / Velocidad** baja o media. Los grises del rótulo salen mejor a menor velocidad.
6. **Calibrar:** en la pestaña **Tools / Herramientas** → **Calibrate / Calibrar**, o en la impresora con el botón de avance/pausa según el modelo. Así la Zebra detecta dónde empieza y termina cada etiqueta.

## 2. En la app

- Medida: **Etiqueta 10 × 6,5 cm**, que ya es la que viene por defecto.
- **Hoja de prueba** (Ajuste de impresión (Zebra) → "Imprimir hoja de prueba"): imprime una sola etiqueta con reglas en **centímetros** en el borde de arriba y en el de la izquierda, un cuadrado negro en la esquina de arriba a la izquierda y una flecha de **ARRIBA**. Al mirarla:
  - **Las reglas miden de verdad 1 cm por número** → la escala está bien.
  - **Las reglas miden menos** (por ejemplo, 0,74 cm por número) → algo achica la hoja: escala de Chrome, papel o resolución del driver (punto 6).
  - **La flecha apunta a lo largo de la etiqueta y el texto se lee a lo largo** → la orientación está bien.
  - **El texto queda cruzado (a lo ancho) o falta un pedazo** → hay un giro de más o de menos: cambiar "Giro del rótulo" en la app o la orientación del driver, no las dos cosas.
- Papel: **Un rótulo por página (etiquetera)**.
- Total de bultos: cada bulto sale en **su propia etiqueta**, una atrás de la otra.

## 3. Cuadro de impresión de Chrome (Ctrl+P / botón Imprimir)

En **Más configuraciones**:

| Opción | Valor |
|---|---|
| Destino | la Zebra (**ZDesigner …**) |
| Tamaño del papel | **Rotulo 10x6.5** (el creado en el paso 1, de 100 × 65 mm). Si solo aparece "User defined", revisar que en el driver esté seleccionado ese papel |
| Márgenes | **Ninguno** |
| Escala | **Predeterminada** / **100** (nunca "Ajustar a la página") |
| Encabezados y pies de página | **desactivado** (si no, Chrome imprime la fecha y la dirección en la etiqueta) |
| Gráficos de fondo | activado (no es imprescindible, pero no molesta) |

Chrome recuerda estas opciones para la próxima impresión en esa PC.

## 4. Primera prueba (con 2 etiquetas)

1. Buscar un cliente, poner **Total de bultos = 2** e imprimir.
2. Revisar:
   - [ ] Salen **2 etiquetas**, no 3 ni 4: no tiene que quedar ninguna en blanco en el medio.
   - [ ] El rótulo **no está rotado** ni cortado. Si sale girado 90°, cambiar la **orientación** en el driver (paso 1.4) o en Chrome (Diseño: Horizontal/Vertical).
   - [ ] La franja negra de "VIA CARGO" se ve **negra pareja**, y los grises como trama fina. Si sale muy claro o muy empastado, ajustar **Oscuridad** (paso 1.5).
   - [ ] Los textos chicos (PARA, BULTO N°) se leen bien.
3. Si sale una etiqueta en blanco entre rótulos: **volver a calibrar** (paso 1.6) y revisar que el papel del driver sea 100 × 65 mm y los márgenes de Chrome "Ninguno".

## 5. Ajuste fino en la app ("Ajuste de impresión (Zebra)")

Está en la sección **Medida** y se guarda en cada computadora.

- **Intensidad de la tinta:** la térmica imprime en puntos, y los bordes suavizados de las letras salen como puntos sueltos (letra "punteada"). Para evitarlo, se engrosa cada letra con un trazo del mismo color.
  - **Normal:** sin refuerzo.
  - **Reforzada:** la que viene por defecto; alrededor de medio punto por lado.
  - **Máxima:** alrededor de un punto por lado, para si sale muy claro.

  Primero conviene probar con **Oscuridad** en el driver (paso 1.5) y después con esto.
- **Tamaño (%)** y **Mover → / Mover ↓ (mm):** para encuadrar el rótulo dentro de la etiqueta. Por ejemplo, con **94%** queda un margen blanco parejo como en los rótulos que se imprimían antes.

> **Ojo:** el ajuste fino **no sirve para corregir un rótulo que sale chico** (ver el punto 6). Solo puede achicar o mover dentro de la etiqueta, no agrandar más allá de ella.

## 6. Diagnóstico de la primera prueba real (22/10/2026)

Se comparó un rótulo de la app (MOYANO, 1 de 2) con uno de los que se imprimían antes (ROMERO, 1 de 1):

| | Antes (Sheet) | App, primera prueba |
|---|---|---|
| Cuánto ocupa de la etiqueta | ~90% del ancho, centrado, margen parejo | **~74%**, pegado arriba a la izquierda, mucho blanco abajo y a la derecha |
| Letras | firmes, negras | finas y "punteadas" (sobre todo el remitente y "PARA") |
| Separadores gris claro | no se imprimen | no se imprimen (normal en térmica) |

**Letras finas:** resuelto con la **Intensidad** (punto 5), que viene en Reforzada.

**Rótulo al 74%:** la app ya manda una página de exactamente 10 × 6,5 cm con el rótulo ocupándola entera. Que salga más chico y pegado a una esquina quiere decir que algo **en el camino de impresión** lo achica. En orden de probabilidad:
1. **Papel de Chrome distinto a 100 × 65 mm**, o **Escala "Ajustar"**. Revisar el punto 3: tamaño "Rotulo 10x6.5" y escala 100.
2. **Resolución del driver distinta a la de la impresora.** Si el driver está en 300 dpi y la Zebra es de 203 dpi, todo sale al ~68%. En **Preferencias de impresión → Options/Opciones → Resolution**, poner la resolución real del modelo (la mayoría de las Zebra de escritorio son de **203 dpi**). Este caso coincide bastante con lo que se vio.
3. **Driver equivocado** (por ejemplo, uno genérico en lugar de *ZDesigner* del modelo exacto).

Cuando salga del tamaño completo, usar **Tamaño 94%** en el ajuste fino para dejar el margen como antes.

## 7. Problemas comunes

| Qué pasa | Causa probable | Solución |
|---|---|---|
| Chrome dice "2 hojas de papel" con 1 solo bulto (la 2ª casi vacía) | Versión vieja de la app (antes del 23/10/2026): la hoja medía exactamente lo mismo que la página y el redondeo la pasaba por 0,001 cm | Recargar con Ctrl+F5 (corregido: cada rótulo se adapta al papel real y deja 2 mm de holgura). Si sigue: revisar que el papel del driver mida 100 mm de largo (paso 1.3) |
| Sale una etiqueta en blanco entre cada rótulo | Papel del driver distinto a 100 × 65 mm, o Zebra sin calibrar | Paso 1.3 y 1.6 |
| El rótulo sale chico, en un rincón | Escala "Ajustar" o papel equivocado en Chrome, o resolución del driver distinta a la de la impresora | Escala 100, papel "Rotulo 10x6.5", resolución real (punto 6) |
| Letras finas o punteadas | Térmica + bordes suavizados | Intensidad "Reforzada" o "Máxima" (punto 5) y Oscuridad en el driver |
| Letras empastadas | Demasiada intensidad u oscuridad | Bajar a "Reforzada"/"Normal" o bajar Oscuridad |
| Sale de costado (texto a lo largo del avance), chico y cortado | El driver está en Horizontal/Landscape y gira la hoja | Driver: papel 100 × 65, orientación **Vertical/Portrait**; app: "Sin girar". Confirmar con la hoja de prueba |
| Sale cabeza abajo | Giro para el lado contrario | App: elegir "girar 90° ←" |
| Sale cabeza abajo con "Girar 90°" | Giro para el lado contrario | App: el otro sentido (←/→) |
| Aparece la fecha o la URL impresa | Encabezados y pies activados | Desactivarlos en Chrome |
| Muy claro / manchado | Oscuridad o velocidad | Paso 1.5 |
| Se corta el borde | Márgenes de Chrome distintos a "Ninguno" | Márgenes: Ninguno |
