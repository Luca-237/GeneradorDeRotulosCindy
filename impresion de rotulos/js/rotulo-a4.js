// =====================================================================
//  Rótulo en hoja A4 (Córdoba - Indarte): 2 rótulos iguales por hoja,
//  uno arriba del otro, con línea de corte. Copia la pestaña ROTULO de la
//  planilla ENVIOS.xlsx de Córdoba (impresora láser, hoja A4 común).
//
//  SVG de 210 × 297 (1 unidad = 1 mm). Las medidas salen de los anchos de
//  columna y altos de fila de la planilla, con sus márgenes (izq. 6,35 mm,
//  arriba 19 mm). No toca js/rotulo.js (el de la Zebra).
// =====================================================================
(function (R) {
  const { esc } = R.util;

  const CALIBRI = "Calibri, Carlito, Arial, sans-serif";
  const MONO = "'Lucida Console', Consolas, 'Courier New', monospace";
  const PT = 0.3528;                       // 1 punto en mm
  const OSCURO = "#262626", GRIS = "#f2f2f2";
  const PASO = 103.45;                     // del primer rótulo al segundo (mm)
  const POR_HOJA = 2;

  // Remitente si la base no tiene uno (config "remitente_cordoba")
  const REMITENTE_CORDOBA_DEFAULT = ["CINDY MAYORISTA", "RIVERA INDARTE 280 - CÓRDOBA", "TEL: 3513923638"];

  function t(x, y, s, o = {}) {
    if (s === undefined || s === null || s === "") return "";
    const pos = o.transform ? ` transform="${o.transform}"` : ` x="${x}" y="${y}"`;
    return `<text${pos} font-family="${o.familia || MONO}" font-size="${((o.pt || 12) * PT).toFixed(2)}" font-weight="${o.peso || 400}"` +
      ` text-anchor="${o.anclar || "start"}" fill="${o.color || "#000"}"${o.max ? ` data-max="${o.max}"` : ""}>${esc(s)}</text>`;
  }
  const rect = (x1, y1, x2, y2, color) =>
    `<rect x="${x1}" y="${y1}" width="${+(x2 - x1).toFixed(2)}" height="${+(y2 - y1).toFixed(2)}" fill="${color}"/>`;

  // Un rótulo. y0: corrimiento vertical (0 el de arriba, PASO el de abajo)
  // d: { nombre, direccion, ciudad, provincia, cp, dni, tel, transporte, orden, remitente[] }
  function rotulo(d, total, y0) {
    const g = [];
    // Marco oscuro, borde blanco, franja del transporte y cuerpo gris (como las celdas de la planilla)
    g.push(rect(6.35, 19.05, 186.5, 121.4, OSCURO));
    g.push(rect(9.5, 24.3, 183.6, 116.1, "#fff"));
    g.push(rect(13.2, 29.6, 34.4, 110.8, OSCURO));
    g.push(rect(34.4, 29.6, 183.6, 75.2, GRIS));
    g.push(rect(34.4, 75.2, 183.6, 80.5, OSCURO));                // barra entre PARA y DE
    g.push(rect(34.4, 80.5, 127.8, 110.8, GRIS));                 // DE (remitente)
    g.push(rect(127.8, 80.5, 132, 110.8, OSCURO));
    g.push(rect(132, 80.5, 155.3, 110.8, GRIS));                  // ORDEN
    g.push(rect(155.3, 80.5, 159.5, 110.8, OSCURO));
    g.push(rect(159.5, 80.5, 183.6, 110.8, GRIS));                // CANT. DE BULTOS

    // Transporte en vertical (de abajo hacia arriba), blanco sobre la franja
    g.push(t(0, 0, d.transporte, { familia: CALIBRI, pt: 26, peso: 700, anclar: "middle", color: "#fff", max: 78, transform: "translate(27 70.2) rotate(-90)" }));

    // PARA
    g.push(t(35.4, 33.2, "PARA", { familia: CALIBRI, pt: 12 }));
    g.push(t(35.4, 40.2, d.nombre, { pt: 24, peso: 700, max: 145 }));
    g.push(t(35.4, 47.0, d.direccion, { pt: 18, max: 145 }));
    const loc = d.cp ? `${d.ciudad}${d.ciudad ? " " : ""}(CP ${d.cp})` : d.ciudad;
    g.push(t(35.4, 54.1, loc, { pt: 18, max: 145 }));
    g.push(t(35.4, 61.1, d.provincia, { pt: 18, max: 145 }));
    g.push(t(35.4, 67.9, "CUIT/DNI", { pt: 20 }));
    g.push(t(72, 67.6, d.dni, { pt: 18, max: 108 }));
    g.push(t(35.4, 74.3, "TE:", { pt: 20 }));
    g.push(t(50.5, 74.0, d.tel, { pt: 18, max: 130 }));

    // DE (remitente, hasta 4 renglones centrados)
    g.push(t(35.4, 84.2, "DE", { familia: CALIBRI, pt: 12 }));
    const rem = (d.remitente || []).filter(Boolean).slice(0, 4);
    const y1 = 98.6 - (rem.length - 1) * 2.6;
    rem.forEach((l, i) => g.push(t(81.1, +(y1 + i * 5.2).toFixed(2), l, { pt: 12, peso: 700, anclar: "middle", max: 90 })));

    // ORDEN y CANT. DE BULTOS
    g.push(t(143.65, 84.3, "ORDEN", { familia: CALIBRI, pt: 12, anclar: "middle", max: 21 }));
    g.push(t(143.65, 102.4, d.orden, { pt: 18, peso: 700, anclar: "middle", max: 21 }));
    g.push(t(171.55, 84.2, "CANT. DE BULTOS", { familia: CALIBRI, pt: 9.5, anclar: "middle", max: 22.5 }));
    g.push(t(171.55, 88.4, "DE ESTE ENVÍO", { familia: CALIBRI, pt: 9.5, anclar: "middle", max: 22.5 }));
    g.push(t(171.55, 105.4, String(total), { pt: 40, peso: 700, anclar: "middle", max: 22.5 }));

    return `<g transform="translate(0 ${y0})">${g.join("")}</g>`;
  }

  // Línea de corte punteada (debajo de cada rótulo, como en la planilla)
  const corte = y => `<line x1="6.35" y1="${y}" x2="186.5" y2="${y}" stroke="#000" stroke-width="0.3" stroke-dasharray="3 1.2 0.6 1.2"/>`;

  // Una hoja A4 con 1 o 2 rótulos
  function hoja(d, total, cuantos) {
    let s = `<svg class="rotulo-a4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" width="210mm" height="297mm" text-rendering="geometricPrecision">`;
    s += `<rect width="210" height="297" fill="#fff"/><g class="contenido">`;
    for (let i = 0; i < cuantos; i++) s += rotulo(d, total, i * PASO) + corte(+(121.95 + i * PASO).toFixed(2));
    return s + `</g></svg>`;
  }

  // cantidad de rótulos -> lista de hojas (SVG), de a 2 por hoja
  function hojas(d, total, cantidad) {
    const out = [];
    for (let i = 0; i < cantidad; i += POR_HOJA) out.push(hoja(d, total, Math.min(POR_HOJA, cantidad - i)));
    return out;
  }

  R.rotuloA4 = { REMITENTE_CORDOBA_DEFAULT, POR_HOJA, hoja, hojas };
})(window.Rotulos);
