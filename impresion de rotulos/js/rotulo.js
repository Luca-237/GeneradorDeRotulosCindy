
(function (R) {
  const { esc } = R.util;

  const W = 883, H = 558, RATIO = W / H;
  const ARIAL = "Arial, Helvetica, sans-serif";
  const CALIBRI = "Calibri, Carlito, Arial, sans-serif";

  const REMITENTE_DEFAULT = [
    "BAG STORE S.R.L CUIT:30-71455926-1",
    "VILLA MARIA",
    "TEL:3535697189",
    "EMAIL: VENTASVM.CINDY@GMAIL.COM",
  ];

  function texto(x, y, str, { size, font = ARIAL, italic = false, anchor = "start", max, transform = "" }) {
    const t = transform ? ` transform="${transform}"` : ` x="${x}" y="${y}"`;
    return `<text${t} font-family="${font}" font-size="${size}" font-weight="700"` +
      `${italic ? ' font-style="italic"' : ""} text-anchor="${anchor}" data-max="${max}">${esc(str)}</text>`;
  }

  // Intensidad para impresoras térmicas (Zebra): engrosa cada letra con un trazo
  // en una etiqueta de 10 cm, 1 unidad ≈ 0,11 mm y un punto de una Zebra de 203 dpi ≈ 1,1 unidades).
  const TRAZO = { normal: 0, reforzada: 1.2, maxima: 2.2 }; // el trazo va mitad afuera: reforzada ≈ +½ punto por lado, máxima ≈ +1 punto

  function grupo(color, trazo) {
    const t = trazo > 0 ? ` stroke="${color}" stroke-width="${trazo}" stroke-linejoin="round" paint-order="stroke"` : "";
    return `<g fill="${color}"${t} text-rendering="geometricPrecision">`;
  }

  // d: { nombre, direccion, ciudad, provincia, cp, dni, tel, email, transporte, remitente[] }
  // opciones: { intensidad: "normal" | "reforzada" | "maxima" }
  function svg(d, n, total, opciones = {}) {
    const trazo = TRAZO[opciones.intensidad] ?? 0;
    const lineas = [
      ["NOMBRE: " + d.nombre, 73, true],
      ["DIRECCION: " + d.direccion, 115, true],
      ["CIUDAD: " + d.ciudad, 157, true],
      ["PROVINCIA: " + d.provincia, 199, true],
      ["CP: " + d.cp, 241, true],
      ["DNI/CUIT: " + d.dni, 283, false],
      ["TEL: " + d.tel, 325, false],
      ["EMAIL: " + d.email, 368, false],
    ];
    let s = `<svg class="rotulo" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">`;
    // Marco gris exterior + fondo blanco
    s += `<rect width="${W}" height="${H}" fill="#595959"/><rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="#fff"/>`;
    // Franja negra del transporte (C3:C19)
    s += `<rect x="4" y="4" width="90" height="550" fill="#000"/>`;
    // Separadores grises: fila 12 (D:M) y columnas I y L (filas 13-19)
    s += `<rect x="94" y="381" width="785" height="11" fill="#bfbfbf"/>`;
    s += `<rect x="594" y="392" width="12" height="162" fill="#bfbfbf"/>`;
    s += `<rect x="732" y="392" width="8" height="162" fill="#bfbfbf"/>`;

    s += grupo("#fff", trazo) + texto(0, 0, d.transporte, { size: 42.7, anchor: "middle", max: 530, transform: "translate(64.3 279) rotate(-90)" }) + `</g>`;

    s += grupo("#000", trazo);
    s += `<text x="97" y="30" font-family="${CALIBRI}" font-size="24" data-max="776">PARA</text>`;
    for (const [str, y, it] of lineas) s += texto(97, y, str, { size: 32, italic: it, max: 776 });
    d.remitente.forEach((l, i) => { s += texto(344, 441 + i * 28, l, { size: 24, anchor: "middle", max: 494 }); });
    s += texto(609, 416, "BULTO N°", { size: 24, font: CALIBRI, max: 120 });
    s += texto(669, 537, n, { size: 102.7, anchor: "middle", max: 120 });
    s += texto(743, 416, "TOTAL DE", { size: 24, font: CALIBRI, max: 133 });
    s += texto(743, 445, "BULTOS", { size: 24, font: CALIBRI, max: 133 });
    s += texto(809.5, 539, total, { size: 106.7, anchor: "middle", max: 133 });
    s += `</g></svg>`;
    return s;
  }

  // Achica la letra de los textos que no entran en su celda (en la planilla se cortaban).
  // Tiene que correr con los SVG ya insertados en la página (necesita medir).
  function ajustarTextos(root) {
    root.querySelectorAll("text[data-max]").forEach(t => {
      const max = +t.dataset.max, largo = t.getComputedTextLength();
      if (largo > max) t.setAttribute("font-size", (+t.getAttribute("font-size") * max / largo).toFixed(2));
    });
  }

  // "3, 7-9" -> [3,7,8,9]; null si está vacío; lanza Error si no se entiende
  function parseSolo(str, total) {
    str = (str || "").trim();
    if (!str) return null;
    const set = new Set();
    for (const parte of str.split(/[,;\s]+/).filter(Boolean)) {
      const m = parte.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) throw new Error(`No entiendo "${parte}". Usá números o rangos, ej: 3, 7-9`);
      const a = +m[1], b = m[2] ? +m[2] : a;
      if (a < 1 || b > total || a > b) throw new Error(`Los bultos tienen que estar entre 1 y ${total}`);
      for (let i = a; i <= b; i++) set.add(i);
    }
    return [...set].sort((x, y) => x - y);
  }

  // Hoja de prueba de calibración, del tamaño exacto de la página que se manda (en cm).
  // Coordenadas en mm. Reglas cada 1 cm arriba y a la izquierda, borde, esquina marcada
  // y flecha de "arriba": al imprimirla se ve si la impresora gira o achica la hoja.
  function svgPrueba(anchoCm, altoCm, mmPorCm = 10) {
    const Wm = anchoCm * 10, Hm = altoCm * 10, f = Math.min(Wm, Hm) / 65; // f: escala de letra
    let s = `<svg class="prueba" viewBox="0 0 ${Wm} ${Hm}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" font-family="${ARIAL}" font-weight="700">`;
    s += `<rect width="${Wm}" height="${Hm}" fill="#fff"/>`;
    s += `<rect x="0.5" y="0.5" width="${Wm - 1}" height="${Hm - 1}" fill="none" stroke="#000" stroke-width="0.6"/>`;
    for (let x = 0; x <= Wm; x += 5) {
      const cm = x % 10 === 0, l = cm ? 4 : 2;
      s += `<line x1="${x}" y1="0" x2="${x}" y2="${l}" stroke="#000" stroke-width="0.4"/>`;
      if (cm && x > 0 && x < Wm) s += `<text x="${x}" y="${l + 3.2 * f}" font-size="${3 * f}" text-anchor="middle">${x / 10}</text>`;
    }
    for (let y = 0; y <= Hm; y += 5) {
      const cm = y % 10 === 0, l = cm ? 4 : 2;
      s += `<line x1="0" y1="${y}" x2="${l}" y2="${y}" stroke="#000" stroke-width="0.4"/>`;
      if (cm && y > 0 && y < Hm) s += `<text x="${l + 1}" y="${y + 1.1 * f}" font-size="${3 * f}">${y / 10}</text>`;
    }
    const cx = Wm / 2;
    s += `<rect x="14" y="14" width="${6 * f}" height="${6 * f}" fill="#000"/>`;
    s += `<polygon points="${cx},${8} ${cx - 5 * f},${8 + 7 * f} ${cx + 5 * f},${8 + 7 * f}" fill="#000"/>`;
    s += `<text x="${cx}" y="${8 + 11 * f}" font-size="${3.4 * f}" text-anchor="middle">ARRIBA</text>`;
    const lineas = [
      [4.6, "PRUEBA DE IMPRESIÓN"],
      [3.4, `Hoja enviada: ${String(anchoCm).replace(".", ",")} × ${String(altoCm).replace(".", ",")} cm`],
      [3, `Corrección cargada: 1 cm = ${String(mmPorCm).replace(".", ",")} mm`],
      [3, "Los números de los bordes son centímetros."],
      [3, "Medí con una regla si coinciden."],
      [3, "El cuadrado negro es la esquina de arriba a la izquierda."],
    ];
    let y = Hm / 2 - 6 * f;
    for (const [tam, txt] of lineas) { s += `<text x="${cx}" y="${y}" font-size="${tam * f}" text-anchor="middle">${esc(txt)}</text>`; y += (tam + 2.4) * f; }
    s += `</svg>`;
    return s;
  }

  R.rotulo = { W, H, RATIO, REMITENTE_DEFAULT, TRAZO, svg, svgPrueba, ajustarTextos, parseSolo };
})(window.Rotulos);
