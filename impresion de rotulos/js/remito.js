// =====================================================================
//  Remito: dibujo en SVG de una hoja A4 (210 x 297 mm, 1 unidad = 1 mm).
//  Copia el talonario "R" de Cindy (imprenta Impregraf). Las medidas salen de
//  la foto del remito 0104-00001285 (hoja entera, 4,3 px por mm): márgenes,
//  recuadros, encabezados y la posición de cada dato.
//  - completo: formulario + datos (hoja A4 en blanco)
//  - datos: solo los datos (para imprimir encima del talonario preimpreso)
//  Cada dato va en un <g data-campo="..."> que se puede correr (o.pos, en mm):
//  la vista (js/vistas/remitos.js) los deja arrastrar con el mouse.
// =====================================================================
(function (R) {
  const esc = R.util.esc;

  // Datos fijos del formulario (lo que viene impreso en el talonario)
  const FORMULARIO = {
    empresa: {
      direccion: ["Buenos Aires 2120", "Villa María", "C.P. 5900 - Córdoba", "Tel.: 351 3923638"],
      email: "E-mail: marroquineriacindy@gmail.com",
      iva: "IVA RESPONSABLE INSCRIPTO",
      fiscal: "CUIT: 30-71455926-1 / Ing. Brutos: CM. 904-204030-3 / Inicio de Activ.: 01/07/2015",
    },
    letra: "R",
    codigo: "CÓDIGO N°: 91",
    imprenta: {
      nombre: "impregraf",
      datos: ["de Pablo Daniel Barrio", "Vélez Sársfield 56 - Loc. 60", "Tel. 351 2444047 - Cba."],
      fiscal: ["C.U.I.T. Nº 20-25457867-4", "Ingresos Brutos: 270228682", "Inicio de Activ.: 07-2018"],
      cai: "52331219960147",
      vencimiento: "2027-08-13",
      copias: ["ORIGINAL: Blanco", "DUPLICADO: Color", "TRIPLICADO: Color"],
      fechaImpresion: "08/2026",
      puntoVenta: "0104",
      desde: 1151,
      hasta: 1650,
    },
  };

  // Letras: formulario en Arial; datos en Calibri negrita, como la planilla
  const F_FORM = "Arial, Helvetica, sans-serif";
  const F_DATO = "Calibri, Carlito, Arial, sans-serif";
  const F_MARCA = "'Times New Roman', Times, Georgia, serif";
  const PT = 0.3528; // 1 punto en mm
  const DATO = 11 * PT; // Calibri 11 negrita, igual que la planilla

  // Bordes del formulario (mm), medidos en la foto
  const B = {
    izq: 7.8, der: 202,
    cab: { y1: 9, y2: 49.7, corte: 122, der: 123.6, barra: 13.2 },
    cli: { y1: 51.3, y2: 76.8, corte: 144.5, der: 146.1 },
    fila: { y1: 78.7, y2: 85.8, corte: 89.4, der: 91.1 },
    barra: { y1: 88.2, y2: 91.2 },
    cuerpo: { y1: 92.1, yIzq: 226.8, yDer: 245.9, xDiag1: 107.8, xDiag2: 135.9, col1: 20.2, col2: 154.5, col3: 178.6 },
    pie: { y1: 248.7, y2: 270.8, corte: 130.3, der: 132.6 },
    imprenta: { y1: 272.9, y2: 288.2 },
  };

  // Renglones del cuerpo: arriba (bultos y detalle) y abajo (transporte y leyendas)
  const CUERPO = { arriba: 106.7, abajo: 188.2, alto: 5.3, cant: 14, desc: 91, descAncho: 126 };

  // Campos que se pueden mover, con el nombre que se muestra al elegirlos
  const CAMPOS = {
    numero: "Número", fecha: "Fecha", nombre: "Señor/es", direccion: "Domicilio", localidad: "Localidad y CP",
    iva: "Condición de IVA", cuit: "CUIT", iibb: "Ingresos brutos", factura: "Nº de factura", venta: "Condición de venta",
    cuerpo: "Bultos y detalle", pie: "Transporte y leyendas", valor: "Valor declarado",
    empTransp: "Empresa de transporte", cuitTransp: "C.U.I.T. del transporte", obs: "Observaciones",
    // Córdoba
    provincia: "Provincia", transp: "Transporte y depósito",
  };
  // En Córdoba algunos datos se llaman distinto
  const CAMPOS_CORDOBA = { ...CAMPOS, nombre: "Razón social", localidad: "Localidad", venta: "Forma de pago", cuerpo: "Bultos, detalle y leyendas" };

  // ---------- Utilidades ----------
  // Texto SVG. max (mm): si el texto mide más, se comprime (lo hace ajustar()).
  function t(x, y, txt, o = {}) {
    if (txt === undefined || txt === null || txt === "") return "";
    const a = [
      `x="${x}"`, `y="${y}"`,
      `font-family="${o.familia || F_FORM}"`, `font-size="${(o.tam || 2.4).toFixed(2)}"`,
      o.peso ? `font-weight="${o.peso}"` : "", o.estilo ? `font-style="${o.estilo}"` : "",
      o.anclar ? `text-anchor="${o.anclar}"` : "", `fill="${o.color || "#000"}"`,
      o.largo ? `textLength="${o.largo}" lengthAdjust="${o.ajuste || "spacing"}"` : "",
      o.max ? `data-max="${o.max}"` : "",
    ].filter(Boolean).join(" ");
    return `<text ${a}>${esc(txt)}</text>`;
  }
  const dato = (x, y, txt, o = {}) => t(x, y, txt, { familia: F_DATO, tam: DATO, peso: 700, ...o });
  const caja = (x1, y1, x2, y2, o = {}) =>
    `<rect x="${x1}" y="${y1}" width="${+(x2 - x1).toFixed(2)}" height="${+(y2 - y1).toFixed(2)}" rx="${o.rx ?? 2}" fill="${o.relleno || "none"}" stroke="#000" stroke-width="${o.trazo || 0.3}"/>`;
  const linea = (x1, y1, x2, y2, o = {}) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${o.trazo || 0.25}"${o.puntos ? ` stroke-dasharray="0.35 0.7"` : ""}/>`;

  const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
    "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte",
    "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
  const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

  // 3 -> "Tres"; 1 -> "Un" (como la planilla: "( Un ) Bulto Cerrado")
  function enLetras(n) {
    n = Math.floor(+n);
    if (!(n > 0 && n < 1000)) return String(n);
    let s;
    if (n === 1) s = "un";
    else if (n === 100) s = "cien";
    else {
      const c = Math.floor(n / 100), r = n % 100;
      let resto = "";
      if (r === 1) resto = "un";
      else if (r < 30) resto = UNIDADES[r];
      else resto = DECENAS[Math.floor(r / 10)] + (r % 10 ? " y " + (r % 10 === 1 ? "un" : UNIDADES[r % 10]) : "");
      s = [CENTENAS[c], resto].filter(Boolean).join(" ");
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // "873790" o "873.790,00" -> 873790 ; vacío -> null ; inválido -> NaN
  function leerPlata(s) {
    s = String(s ?? "").replace(/[$\s]/g, "");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  const plata = n => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  // "2026-11-20" -> "20/11/2026"
  const fechaTexto = iso => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? iso.split("-").reverse().join("/") : "");

  // 20295090902 -> 20-29509090-2 (DNI y lo demás quedan como están)
  function cuitTexto(s) {
    const d = String(s || "").replace(/\D/g, "");
    return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : String(s || "").trim();
  }

  const corrimiento = (pos, k) => ({ x: +((pos && pos[k] && pos[k].x) || 0), y: +((pos && pos[k] && pos[k].y) || 0) });

  // ---------- Renglones del cuerpo ----------
  // Arriba: los bultos y el detalle. Abajo (a la altura del transporte en el talonario):
  // el transporte y las leyendas; si el detalle llega hasta ahí, el bloque de abajo baja solo.
  // Detalle con cantidad: "2; CARTERA 13270" -> cantidad 2, descripción "CARTERA 13270".
  function armarCuerpo(d, pos) {
    const arriba = [];
    const bultos = Math.floor(+d.bultos || 0);
    if (bultos > 0) {
      const txt = bultos === 1 ? "BULTO CERRADO" : "BULTOS CERRADOS";
      arriba.push({ cant: String(bultos), desc: d.letras ? `( ${enLetras(bultos).toUpperCase()} ) ${txt}` : txt });
    }
    for (const l of d.detalle || []) {
      const m = /^\s*(\d+(?:[.,]\d+)?)\s*[;|]\s*(.*)$/.exec(l);
      arriba.push(m ? { cant: m[1], desc: m[2].trim() } : { cant: "", desc: l });
    }
    const abajo = [];
    if (d.transporte) abajo.push({ cant: "", desc: d.transporte });
    for (const l of d.leyendas || []) abajo.push({ cant: "", desc: l });

    const cA = corrimiento(pos, "cuerpo"), cB = corrimiento(pos, "pie");
    const ultimoArriba = arriba.length ? CUERPO.arriba + cA.y + (arriba.length - 1) * CUERPO.alto : -Infinity;
    // y real del primer renglón de abajo (lo empuja el detalle si hace falta)
    const inicioAbajo = Math.max(CUERPO.abajo + cB.y, ultimoArriba + CUERPO.alto);
    const ultimo = abajo.length ? inicioAbajo + (abajo.length - 1) * CUERPO.alto : ultimoArriba;
    return { arriba, abajo, inicioAbajo, bajado: +(inicioAbajo - CUERPO.abajo).toFixed(2), ultimo };
  }

  // Avisos sobre el dibujo (para la vista)
  function revisar(d, pos) {
    const c = armarCuerpo(d, pos);
    const a = [];
    if (c.ultimo > B.cuerpo.yIzq - 1.5) a.push("El detalle y las leyendas pasan el borde de abajo del cuerpo: sacá renglones o subí el bloque.");
    return a;
  }

  // ---------- Formulario (lo que trae impreso el talonario) ----------
  function formulario() {
    const E = FORMULARIO.empresa, I = FORMULARIO.imprenta;
    const g = [], c = B.cab;
    // Encabezado
    g.push(caja(B.izq, c.y1, c.corte, c.y2), caja(c.der, c.y1, B.der, c.y2));
    g.push(`<path d="M${c.der} ${c.barra} V${c.y1 + 2} a2 2 0 0 1 2 -2 H${B.der - 2} a2 2 0 0 1 2 2 V${c.barra} Z" fill="#262626"/>`);
    g.push(t(194.7, 12.4, "REMITO", { tam: 3.9, peso: 700, anclar: "end", color: "#fff", largo: 22.3 }));
    g.push(t(15.1, 26.2, "CINDY", { familia: F_MARCA, tam: 16.5, largo: 58 }));
    g.push(t(18.6, 32.7, "MAYORISTA", { tam: 3.3, largo: 52 }));
    g.push(t(28.6, 38.7, "de Bag Store S.R.L.", { tam: 3.3, estilo: "italic", largo: 35.3, ajuste: "spacingAndGlyphs" }));
    g.push(t(11.1, 47.1, E.iva, { tam: 2.7, largo: 36.1, ajuste: "spacingAndGlyphs" }));
    E.direccion.forEach((l, i) => g.push(t(110.3, 32 + i * 3.7, l, { tam: 2.8, anclar: "end" })));
    g.push(t(110.3, 47.1, E.email, { tam: 2.8, anclar: "end", max: 46 }));
    // Letra del comprobante
    g.push(`<rect x="113.4" y="25.5" width="18.5" height="12.8" rx="2" fill="#262626"/>`);
    g.push(t(122.65, 33.6, FORMULARIO.letra, { tam: 9.5, peso: 700, anclar: "middle", color: "#fff" }));
    g.push(t(122.65, 37.2, FORMULARIO.codigo, { tam: 1.8, peso: 700, anclar: "middle", color: "#fff", max: 17 }));
    g.push(t(140.1, 34.1, "Fecha:", { tam: 2.4 }));
    g.push(t(126.6, 47.9, E.fiscal, { tam: 1.75, largo: 73.2, ajuste: "spacingAndGlyphs" }));

    // Cliente
    const k = B.cli;
    g.push(caja(B.izq, k.y1, k.corte, k.y2), caja(k.der, k.y1, B.der, k.y2));
    g.push(t(10.5, 56.8, "Señor/es:", { tam: 2.1 }));
    g.push(t(148.9, 56.8, "Cond. IVA:", { tam: 2.1 }));
    g.push(t(149.4, 65.9, "CUIT:", { tam: 2.1 }));
    g.push(t(149.4, 70.1, "I. Brutos:", { tam: 2.1 }));
    const f = B.fila;
    g.push(caja(B.izq, f.y1, f.corte, f.y2, { rx: 1.5 }), caja(f.der, f.y1, B.der, f.y2, { rx: 1.5 }));
    g.push(t(94.1, 83.6, "Cond. de venta:", { tam: 2 }));

    // Encabezado de columnas
    const b = B.barra, q = B.cuerpo;
    g.push(`<rect x="${B.izq}" y="${b.y1}" width="${B.der - B.izq}" height="${+(b.y2 - b.y1).toFixed(2)}" fill="#262626"/>`);
    const cab = { tam: 2.1, peso: 700, color: "#fff" };
    g.push(t(10.3, 90.6, "CANTIDAD", { ...cab, largo: 11.5, ajuste: "spacingAndGlyphs" }), t(82, 90.6, "DESCRIPCIÓN", { ...cab, anclar: "middle" }),
      t(167, 90.6, "P. UNIT.", { ...cab, anclar: "middle" }), t(191.8, 90.6, "IMPORTE", { ...cab, anclar: "middle" }));
    // Cuerpo: abajo a la izquierda se corta en diagonal (ahí va el valor declarado)
    g.push(`<path d="M${B.izq} ${q.y1} H${B.der} V${q.yDer} H${q.xDiag2} L${q.xDiag1} ${q.yIzq} H${B.izq} Z" fill="none" stroke="#000" stroke-width="0.3" stroke-linejoin="round"/>`);
    g.push(linea(q.col1, q.y1, q.col1, q.yIzq), linea(q.col2, q.y1, q.col2, q.yDer), linea(q.col3, q.y1, q.col3, q.yDer));

    // Recuadros de abajo
    const p = B.pie;
    g.push(caja(B.izq, p.y1, p.corte, p.y2), caja(p.der, p.y1, B.der, p.y2, { relleno: "#eeeeee" }));
    g.push(t(11.4, 253.6, "La Mercadería viaja por cuenta y orden del Comprador.", { tam: 2.2, peso: 700 }));
    g.push(t(11.4, 258, "Empresa de Transporte:", { tam: 2 }));
    g.push(t(11.4, 262.2, "C.U.I.T.:", { tam: 2 }));
    g.push(t(11.4, 266.6, "Observaciones:", { tam: 2 }));
    g.push(t(135.4, 253.4, "Recibí Conforme", { tam: 2.3, peso: 700 }));
    g.push(t(135.4, 263.8, "Firma:", { tam: 2 }), linea(142.9, 264.1, 200.5, 264.1, { puntos: true }));
    g.push(t(135.4, 268.4, "D.N.I. Nº:", { tam: 2 }), linea(145.2, 268.7, 200.5, 268.7, { puntos: true }));

    // Datos de la imprenta y del C.A.I.
    const m = B.imprenta;
    g.push(caja(B.izq, m.y1, B.der, m.y2));
    g.push(t(9.3, 282, I.nombre, { tam: 5.3, peso: 700, estilo: "italic", largo: 24.4, ajuste: "spacingAndGlyphs" }));
    I.datos.forEach((l, i) => g.push(t(37.2, 278 + i * 2.8, l, { tam: 2.5, peso: 700, estilo: "italic", max: 33 })));
    I.fiscal.forEach((l, i) => g.push(t(72.6, 278 + i * 2.8, l, { tam: 2.7, estilo: "italic", max: 34 })));
    g.push(t(108.7, 278.9, `C.A.I.:${I.cai}`, { tam: 2.9, peso: 700, max: 34 }));
    g.push(t(108.7, 283.4, `Fecha de Vto. ${fechaTexto(I.vencimiento)}`, { tam: 2.75, peso: 700, max: 34 }));
    I.copias.forEach((l, i) => g.push(t(144.3, 277.7 + i * 2.6, l, { tam: 1.95 })));
    g.push(t(199.8, 277.8, `Fecha de Impresión: ${I.fechaImpresion}`, { tam: 2.7, anclar: "end" }));
    g.push(t(199.8, 280.8, `Imp. del Nº ${I.puntoVenta}-${String(I.desde).padStart(8, "0")}`, { tam: 2.7, anclar: "end" }));
    g.push(t(199.8, 283.8, `al Nº ${I.puntoVenta}-${String(I.hasta).padStart(8, "0")}`, { tam: 2.7, anclar: "end" }));
    return g.join("");
  }

  // ---------- Datos (lo que se completaba en la planilla) ----------
  // Cada campo en su grupo, corrido según pos[campo] = {x, y} en mm
  function datos(d, pos) {
    const g = [];
    const grupo = (k, contenido, extraY = 0) => {
      if (!contenido) return;
      const c = corrimiento(pos, k);
      g.push(`<g data-campo="${k}" transform="translate(${+c.x.toFixed(2)} ${+(c.y + extraY).toFixed(2)})">${contenido}</g>`);
    };
    if (d.numero) grupo("numero", t(138.9, 23.9, `N° ${d.numero.replace("-", "- ")}`, { tam: 5.65, max: 62 }));
    grupo("fecha", dato(137, 45.5, R.remito.fechaTexto(d.fecha), { tam: 10 * PT }));
    // Cliente
    grupo("nombre", dato(27.2, 58.7, d.nombre, { max: 116 }));
    grupo("direccion", dato(27.2, 67.7, d.direccion, { max: 116 }));
    const loc = [d.ciudad, d.provincia].filter(Boolean).join("-");
    if (loc || d.cp) {
      grupo("localidad", `<text x="27.2" y="74.2" font-family="${F_DATO}" font-size="${DATO.toFixed(2)}" font-weight="700" data-max="116">${esc(loc)}` +
        (d.cp ? `<tspan dx="${loc ? 9 : 0}">${esc("CP:" + d.cp)}</tspan>` : "") + `</text>`);
    }
    grupo("iva", dato(160, 56.4, d.iva, { max: 40 }));
    grupo("cuit", dato(195.6, 65.4, cuitTexto(d.dni), { anclar: "end", max: 44 }));
    grupo("iibb", dato(195.6, 70.4, d.iibb, { anclar: "end", tam: 3.5, max: 44 }));
    grupo("factura", dato(37.6, 84.2, d.factura ? `Nro De Factura: ${d.factura}` : "", { max: 80 }));
    grupo("venta", dato(110.5, 83.8, d.venta, { max: 88 }));
    // Cuerpo
    const c = armarCuerpo(d, pos);
    const renglones = (lista, y0) => lista.map((l, i) => {
      const y = +(y0 + i * CUERPO.alto).toFixed(2);
      return dato(CUERPO.cant, y, l.cant, { anclar: "middle", max: 11 }) + dato(CUERPO.desc, y, l.desc, { anclar: "middle", max: CUERPO.descAncho });
    }).join("");
    grupo("cuerpo", renglones(c.arriba, CUERPO.arriba));
    // El bloque de abajo usa su y real (puede venir empujado por el detalle)
    if (c.abajo.length) {
      const cB = corrimiento(pos, "pie");
      g.push(`<g data-campo="pie" transform="translate(${+cB.x.toFixed(2)} ${c.bajado})">${renglones(c.abajo, CUERPO.abajo)}</g>`);
    }
    const valor = leerPlata(d.valor);
    if (valor !== null && Number.isFinite(valor)) {
      grupo("valor", dato(39, 229.2, "Valor Declarado:") + dato(84, 229.2, "$") + dato(115.4, 229.2, plata(valor), { anclar: "end" }));
    }
    // Recuadro de abajo
    grupo("empTransp", dato(35.5, 258, d.empresaTransporte, { tam: 3.4, max: 92 }));
    grupo("cuitTransp", dato(20, 262.2, d.cuitTransporte, { tam: 3.4, max: 108 }));
    grupo("obs", dato(30.5, 266.6, d.observaciones, { tam: 3.4, max: 98 }));
    return g.join("");
  }

  // =====================================================================
  //  Córdoba (Indarte): su propio talonario preimpreso.
  //  Posiciones de la pestaña "REMITO R" de la planilla ENVIOS.xlsx de Córdoba
  //  (Calibri 11 negrita; margen izq. 0 y sup. 1,9 cm; filas ocultas descontadas):
  //  lo que hoy imprimen ellos con esa planilla. Todavía no hay foto del talonario,
  //  así que la guía gris es aproximada (solo nombres de los datos).
  // =====================================================================
  const CBA = { der: 179.4, cant: 12.6, desc: 20.6, arriba: 106.2, alto: 5.29, limite: 174 };

  // Renglones del cuerpo: bultos, detalle y leyendas (el transporte va en el recuadro de abajo)
  function cuerpoCordoba(d, pos) {
    const lista = [];
    const bultos = Math.floor(+d.bultos || 0);
    if (bultos > 0) {
      const txt = bultos === 1 ? "BULTO CERRADO" : "BULTOS CERRADOS";
      lista.push({ cant: String(bultos), desc: d.letras ? `( ${enLetras(bultos).toUpperCase()} ) ${txt}` : txt });
    }
    for (const l of d.detalle || []) {
      const m = /^\s*(\d+(?:[.,]\d+)?)\s*[;|]\s*(.*)$/.exec(l);
      lista.push(m ? { cant: m[1], desc: m[2].trim() } : { cant: "", desc: l });
    }
    for (const l of d.leyendas || []) lista.push({ cant: "", desc: l });
    const c = corrimiento(pos, "cuerpo");
    const ultimo = lista.length ? CBA.arriba + c.y + (lista.length - 1) * CBA.alto : -Infinity;
    return { lista, ultimo };
  }

  function formularioCordoba() {
    const g = [];
    const guia = (x, y, txt, o = {}) => t(x, y, txt, { tam: 2.3, color: "#555", ...o });
    g.push(`<rect x="3" y="3" width="204" height="291" rx="3" fill="none" stroke="#999" stroke-width="0.3" stroke-dasharray="2 1.5"/>`);
    g.push(t(105, 12, "Talonario de Córdoba (Indarte): guía aproximada", { tam: 3.4, peso: 700, anclar: "middle", color: "#555" }));
    g.push(t(105, 17, "Sin foto del talonario: los datos están donde los pone hoy la planilla ENVIOS.xlsx", { tam: 2.6, anclar: "middle", color: "#555" }));
    g.push(guia(141.8, 34.4, "Fecha (día / mes / año)"));
    g.push(guia(20.6, 53.4, "Razón social"), guia(CBA.der, 53.4, "Condición de IVA", { anclar: "end" }));
    g.push(guia(20.6, 62.7, "Domicilio"), guia(CBA.der, 62.7, "CUIT", { anclar: "end" }));
    g.push(guia(20.6, 77.2, "Localidad"), guia(65.3, 77.2, "Provincia"), guia(CBA.der, 77.2, "Ingresos brutos", { anclar: "end" }));
    g.push(guia(119.6, 80.6, "Forma de pago", { anclar: "middle" }));
    g.push(guia(CBA.cant, 100.6, "Cant.", { anclar: "middle" }), guia(CBA.desc, 100.6, "Descripción"));
    g.push(`<line x1="8" y1="${CBA.limite + 2}" x2="202" y2="${CBA.limite + 2}" stroke="#999" stroke-width="0.25" stroke-dasharray="1.5 1"/>`);
    g.push(guia(37.8, 260.4, "Transporte · C.U.I.T. · Domicilio del depósito"));
    return g.join("");
  }

  function datosCordoba(d, pos) {
    const g = [];
    const grupo = (k, contenido) => {
      if (!contenido) return;
      const c = corrimiento(pos, k);
      g.push(`<g data-campo="${k}" transform="translate(${+c.x.toFixed(2)} ${+c.y.toFixed(2)})">${contenido}</g>`);
    };
    // Fecha: día, mes y año separados, como la planilla (Calibri 14 negrita)
    const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.fecha || "");
    if (f) {
      const o = { tam: 14 * PT };
      grupo("fecha", dato(142.3, 39.8, String(+f[3]), o) + dato(150.5, 39.8, "/", o) + dato(158.2, 39.8, String(+f[2]), { ...o, anclar: "middle" }) +
        dato(164.7, 39.8, "/", { ...o, anclar: "middle" }) + dato(167.5, 39.8, f[1], o));
    }
    grupo("nombre", dato(20.6, 57.8, d.nombre, { max: 84 }));
    grupo("iva", dato(CBA.der, 57.8, d.iva, { anclar: "end", max: 70 }));
    grupo("direccion", dato(20.6, 67.1, d.direccion, { max: 84 }));
    grupo("cuit", dato(CBA.der, 67.1, cuitTexto(d.dni), { anclar: "end", max: 70 }));
    grupo("localidad", dato(20.6, 73.1, d.cp ? `${d.ciudad} (CP ${d.cp})`.trim() : d.ciudad, { max: 43 }));
    grupo("provincia", dato(65.3, 73.1, d.provincia, { max: 40 }));
    grupo("iibb", dato(CBA.der, 73.1, d.iibb, { anclar: "end", max: 70 }));
    if (d.factura) grupo("factura", dato(10.6, 85.1, "Factura N°:") + dato(29.9, 85.1, d.factura, { max: 66 }));
    grupo("venta", dato(119.6, 85.1, d.venta, { anclar: "middle", max: 44 }));
    const c = cuerpoCordoba(d, pos);
    grupo("cuerpo", c.lista.map((l, i) => {
      const y = +(CBA.arriba + i * CBA.alto).toFixed(2);
      return dato(CBA.cant, y, l.cant, { anclar: "middle", max: 9 }) + dato(CBA.desc, y, l.desc, { max: 150 });
    }).join(""));
    const valor = leerPlata(d.valor);
    if (valor !== null && Number.isFinite(valor)) {
      grupo("valor", dato(47.1, 196.7, "Valor declarado:", { anclar: "middle" }) + dato(65.3, 196.7, `$ ${plata(valor)}`));
    }
    // Recuadro de abajo: transporte, C.U.I.T. y domicilio del depósito
    const tr = [d.transporte, d.cuitTransporte, d.deposito];
    grupo("transp", tr.map((s, i) => dato(37.8, +(265.2 + i * 5.29).toFixed(2), s, { max: 120 })).join(""));
    return g.join("");
  }

  // Talonario de cada sucursal (js/sucursales.js -> remito)
  const MODELOS = {
    villamaria: { formulario, datos, campos: CAMPOS },
    cordoba: { formulario: formularioCordoba, datos: datosCordoba, campos: CAMPOS_CORDOBA },
  };
  const modelo = m => MODELOS[m] || MODELOS.villamaria;
  const campos = m => modelo(m).campos;

  // Avisos sobre el dibujo, según el talonario
  function revisarModelo(d, pos, m) {
    if (m !== "cordoba") return revisar(d, pos);
    const c = cuerpoCordoba(d, pos);
    return c.ultimo > CBA.limite ? ["El detalle y las leyendas llegan al valor declarado: sacá renglones o subí el bloque."] : [];
  }

  // Hoja entera. o.completo: con el formulario; o.dx/o.dy: corrimiento de toda la hoja (mm);
  // o.pos: corrimiento de cada dato { campo: {x, y} } (mm); o.modelo: talonario ("villamaria" | "cordoba").
  function svg(d, o = {}) {
    const M = modelo(o.modelo);
    const mover = o.dx || o.dy ? ` transform="translate(${+o.dx || 0} ${+o.dy || 0})"` : "";
    return `<svg class="remito" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" width="210mm" height="297mm" role="img" aria-label="Remito">` +
      `<rect width="210" height="297" fill="#fff"/>` +
      `<g${mover}>${o.completo !== false ? `<g class="formulario">${M.formulario()}</g>` : ""}<g class="datos">${M.datos(d, o.pos || {})}</g></g></svg>`;
  }

  // Comprime los textos que no entran en su lugar (data-max, en mm). La hoja tiene que estar en pantalla.
  function ajustar(cont) {
    cont.querySelectorAll("text[data-max]").forEach(el => {
      el.removeAttribute("textLength");
      const max = +el.dataset.max;
      try {
        if (el.getComputedTextLength() > max) {
          el.setAttribute("textLength", max);
          el.setAttribute("lengthAdjust", "spacingAndGlyphs");
        }
      } catch (e) { /* oculto: se ajusta cuando se vuelva a dibujar */ }
    });
  }

  R.remito = { FORMULARIO, CAMPOS, campos, svg, ajustar, armarCuerpo, revisar: revisarModelo, enLetras, leerPlata, plata, fechaTexto, cuitTexto };
})(window.Rotulos);
