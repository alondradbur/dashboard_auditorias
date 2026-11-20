/* ============================================================
   REPORTE PDF — PROCEDIMIENTOS JURÍDICOS
   Genera en el navegador un reporte institucional (sin logotipos) con
   TODA la hoja CONSOLIDADO DE FALTAS, sin importar el filtro de año.
   Texto y tablas en vectores (nítidos a cualquier zoom) y gráficas
   renderizadas a alta resolución.
============================================================ */

const RPT_LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"
];
const RPT_ESCALA_GRAFICAS = 3;   // 3x → ~2400 px de ancho por gráfica

const RPT_VERDE = [0, 88, 68];
const RPT_GUINDA = [107, 31, 42];
const RPT_TEXTO = [34, 34, 34];
const RPT_SUAVE = [105, 105, 105];
const RPT_LINEA = [208, 206, 198];
const RPT_FONDO = [244, 244, 239];

function rptCargarScript(src) {
  return new Promise((ok, fallo) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => fallo(new Error("No se pudo cargar la librería de PDF. Revisa tu conexión a internet."));
    document.head.appendChild(s);
  });
}

async function rptCargarLibrerias() {
  if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable) return;
  if (!(window.jspdf && window.jspdf.jsPDF)) await rptCargarScript(RPT_LIBS[0]);
  if (!window.jspdf.jsPDF.API.autoTable) await rptCargarScript(RPT_LIBS[1]);
}

/* ---------- Gráficas a alta resolución ---------- */

function rptGrafica(id, config, ancho, alto) {
  const caja = document.createElement("div");
  caja.style.cssText = `position:fixed;left:-10000px;top:0;width:${ancho}px;height:${alto}px;background:#fff;`;
  const canvas = document.createElement("canvas");
  canvas.width = ancho; canvas.height = alto;
  canvas.style.width = ancho + "px"; canvas.style.height = alto + "px";
  caja.appendChild(canvas);
  document.body.appendChild(caja);

  const fondoBlanco = {
    id: "rptFondo",
    beforeDraw(ch) { const x = ch.ctx; x.save(); x.fillStyle = "#ffffff"; x.fillRect(0, 0, ch.width, ch.height); x.restore(); }
  };
  const opciones = {
    ...config.options,
    responsive: false,
    animation: false,
    devicePixelRatio: RPT_ESCALA_GRAFICAS,
    plugins: { ...config.options.plugins, uecWatermark: false }   // sin marca de agua/logotipo
  };
  const grafica = new Chart(canvas, { ...config, options: opciones, plugins: [fondoBlanco] });
  const png = canvas.toDataURL("image/png");
  grafica.destroy();
  caja.remove();
  return { png, ancho, alto };
}

/* ---------- Utilidades ---------- */

const rptPct = (n, t) => t ? (n / t * 100).toFixed(1).replace(/\.0$/, "") + "%" : "0%";
const rptFechaLarga = d => d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
const rptHora = d => d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
const rptSuma = a => a.reduce((s, x) => s + x, 0);

/* ---------- Generación ---------- */

async function pjGenerarReportePDF() {
  const boton = document.getElementById("btn-pj-pdf");
  const etiqueta = boton ? boton.querySelector(".txt") : null;
  const textoOriginal = etiqueta ? etiqueta.textContent : "";
  const estado = t => { if (etiqueta) etiqueta.textContent = t; };

  if (!PJ_DATOS || !PJ_DATOS.length) {
    alert("Espera a que terminen de cargar los procedimientos jurídicos y vuelve a intentarlo.");
    return;
  }

  try {
    if (boton) boton.disabled = true;
    estado("Generando…");
    await rptCargarLibrerias();
    await new Promise(r => setTimeout(r, 30));   // deja pintar el estado del botón

    const { jsPDF } = window.jspdf;
    const datos = PJ_DATOS;                 // toda la hoja
    const c = pjCalcular(datos);
    const cfg = pjConfigs(c, c);
    const ahora = new Date();

    const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait", compress: true });
    doc.setProperties({
      title: "Procedimientos Jurídicos — Consolidado de Faltas",
      subject: "Reporte institucional",
      author: "Sistema de Análisis de Cuenta Pública",
      creator: "Sistema de Análisis de Cuenta Pública"
    });

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 16;                 // margen lateral
    const TOP = 22;               // inicio del contenido en páginas interiores
    const BOT = 18;               // reserva para el pie
    const ANCHO = W - 2 * M;
    let y = 0;

    const texto = (rgb, tam, estilo) => { doc.setTextColor(...rgb); doc.setFontSize(tam); doc.setFont("helvetica", estilo || "normal"); };
    const asegurar = alto => { if (y + alto > H - BOT) { doc.addPage(); y = TOP; } };

    const titulo = (num, txt, bloque) => {
      asegurar(bloque || 16);
      doc.setFillColor(...RPT_GUINDA); doc.rect(M, y, 1.6, 6.2, "F");
      texto(RPT_VERDE, 13, "bold"); doc.text(`${num}. ${txt}`, M + 4.5, y + 4.8);
      y += 10;
    };
    const subtitulo = txt => { asegurar(8); texto(RPT_TEXTO, 10, "bold"); doc.text(txt, M, y + 3); y += 6; };
    const parrafo = (txt, tam, rgb, ancho) => {
      texto(rgb || RPT_TEXTO, tam || 10); const l = doc.splitTextToSize(txt, ancho || ANCHO);
      const alto = l.length * (tam || 10) * 0.42;
      asegurar(alto + 2); doc.text(l, M, y + 3.5, { lineHeightFactor: 1.35 }); y += alto + 4;
    };
    const imagen = (g, x, ancho) => {
      const alto = ancho * g.alto / g.ancho;
      asegurar(alto + 2);
      doc.addImage(g.png, "PNG", x, y, ancho, alto, undefined, "FAST");
      doc.setDrawColor(...RPT_LINEA); doc.setLineWidth(0.2); doc.rect(x, y, ancho, alto);
      y += alto + 5;
      return alto;
    };

    const estiloTabla = {
      theme: "grid",
      margin: { top: TOP, left: M, right: M, bottom: BOT },
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.5, textColor: RPT_TEXTO, lineColor: RPT_LINEA, lineWidth: 0.15, overflow: "linebreak", valign: "middle" },
      headStyles: { fillColor: RPT_VERDE, textColor: 255, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: [250, 250, 247] },
      footStyles: { fillColor: RPT_FONDO, textColor: RPT_TEXTO, fontStyle: "bold" }
    };
    const tabla = opc => {
      asegurar(20);
      doc.autoTable({ ...estiloTabla, startY: y, ...opc,
        styles: { ...estiloTabla.styles, ...(opc.styles || {}) },
        headStyles: { ...estiloTabla.headStyles, ...(opc.headStyles || {}) },
        didParseCell: d => {
          // La fila de totales usa la misma alineación que su columna (números a la derecha)
          const col = (opc.columnStyles || {})[d.column.index];
          if (d.section === "foot" && col && col.halign) d.cell.styles.halign = col.halign;
          if (opc.didParseCell) opc.didParseCell(d);
        } });
      y = doc.lastAutoTable.finalY + 6;
    };
    const num = { halign: "right" };

    /* ===== Encabezado de la primera página (sin logotipos) ===== */
    doc.setFillColor(...RPT_VERDE); doc.rect(0, 0, W, 28, "F");
    doc.setFillColor(...RPT_GUINDA); doc.rect(0, 28, W, 1.6, "F");
    texto([255, 255, 255], 22, "bold"); doc.text("Procedimientos Jurídicos", M, 14);
    texto([226, 232, 228], 11); doc.text("Reporte del Consolidado de Faltas", M, 22);
    y = 37;

    texto(RPT_SUAVE, 8.5);
    doc.text(`Generado el ${rptFechaLarga(ahora)}, ${rptHora(ahora)} h`, M, y);
    doc.text(`Fuente: hoja CONSOLIDADO DE FALTAS · ${pjFmt(datos.length)} registros`, W - M, y, { align: "right" });
    doc.text(`Alcance: todas las cuentas públicas (${c.anios[0]} a ${c.anios[c.anios.length - 1]})`, M, y + 4.6);
    doc.setDrawColor(...RPT_LINEA); doc.setLineWidth(0.3); doc.line(M, y + 7.2, W - M, y + 7.2);
    y += 13;

    /* ===== Indicadores ===== */
    const kpis = [
      ["EXPEDIENTES RADICADOS", pjFmt(c.total), "todas las cuentas públicas", RPT_VERDE],
      ["FALTAS NO GRAVES", pjFmt(c.totNoGrave), rptPct(c.totNoGrave, c.total) + " del total", [196, 143, 40]],
      ["FALTAS GRAVES", pjFmt(c.totGrave), rptPct(c.totGrave, c.total) + " del total", [180, 90, 72]],
      ["DENUNCIAS PENALES", pjFmt(c.totPenal), rptPct(c.totPenal, c.total) + " del total", [120, 110, 110]],
      ["ENTES CON EXPEDIENTES", pjFmt(c.entes), "entes únicos", RPT_GUINDA]
    ];
    const gap = 2.5, kw = (ANCHO - gap * 4) / 5, kh = 24;
    kpis.forEach((k, i) => {
      const x = M + i * (kw + gap);
      doc.setFillColor(252, 252, 250); doc.setDrawColor(...RPT_LINEA); doc.setLineWidth(0.2); doc.rect(x, y, kw, kh, "FD");
      doc.setFillColor(...k[3]); doc.rect(x, y, kw, 1.4, "F");
      texto(RPT_SUAVE, 6.3, "bold"); doc.text(doc.splitTextToSize(k[0], kw - 3), x + 2.2, y + 5.6);
      texto(RPT_TEXTO, 17, "bold"); doc.text(k[1], x + 2.2, y + 15);
      texto(RPT_SUAVE, 6.8); doc.text(k[2], x + 2.2, y + 20.5);
    });
    y += kh + 8;

    /* ===== Nota sobre registros incompletos ===== */
    const sinNum = datos.filter(r => !r.exp).length, sinEst = datos.filter(r => !r.estatus).length;
    if (sinNum || sinEst) parrafo(`Nota: ${sinNum} registros de la hoja no tienen número de expedientes capturado y ${sinEst} no tienen estatus; no suman en las cifras.`, 8.5, RPT_SUAVE);

    /* ===== Evolución ===== */
    titulo("1", "Evolución por cuenta pública y gravedad", 118);
    imagen(rptGrafica("pj-ch-anio", cfg["pj-ch-anio"], 820, 270), M, ANCHO);
    tabla({
      head: [["Cuenta pública", "No grave", "Grave", "Denuncia penal", "Total"]],
      body: c.anios.map((a, i) => {
        const v = [c.porAnioTipo["No Grave"][i], c.porAnioTipo["Grave"][i], c.porAnioTipo["Denuncia Penal"][i]];
        return [a, ...v.map(pjFmt), pjFmt(rptSuma(v))];
      }),
      foot: [["Total", pjFmt(c.totNoGrave), pjFmt(c.totGrave), pjFmt(c.totPenal), pjFmt(c.total)]],
      showFoot: "lastPage",
      columnStyles: { 0: { halign: "center" }, 1: num, 2: num, 3: num, 4: { ...num, fontStyle: "bold" } }
    });

    /* ===== Ubicación ===== */
    titulo("2", "Ubicación del expediente", 118);
    imagen(rptGrafica("pj-ch-ubicacion", cfg["pj-ch-ubicacion"], 820, 300), M, ANCHO);
    const porUbic = (u, t) => datos.filter(r => r.ubicacion === u && r.tipo === t).reduce((s, r) => s + r.exp, 0);
    const filasUbic = c.ubicaciones.map(u => {
      const v = ["No Grave", "Grave", "Denuncia Penal"].map(t => porUbic(u, t));
      return [pjNombreUbicacion(u), ...v.map(pjFmt), pjFmt(rptSuma(v))];
    });
    tabla({
      head: [["Ubicación", "No grave", "Grave", "Denuncia penal", "Total"]],
      body: filasUbic,
      columnStyles: { 1: num, 2: num, 3: num, 4: { ...num, fontStyle: "bold" } }
    });

    /* ===== Entes ===== */
    titulo("3", "Entes con más expedientes", 100);
    parrafo(`Se muestran los 10 entes con más expedientes de un total de ${c.entes}.`, 8.5, RPT_SUAVE);
    const porEnte = {};
    datos.forEach(r => { (porEnte[r.ente] = porEnte[r.ente] || c.anios.map(() => 0))[c.anios.indexOf(r.anio)] += r.exp; });
    const entes = Object.entries(porEnte).sort((a, b) => rptSuma(b[1]) - rptSuma(a[1]) || a[0].localeCompare(b[0])).slice(0, 10);
    const maxCelda = Math.max(1, ...entes.flatMap(e => e[1]));
    tabla({
      head: [["Ente fiscalizable", ...c.anios, "Total"]],
      body: entes.map(([e, v]) => [e, ...v.map(x => x || "·"), pjFmt(rptSuma(v))]),
      columnStyles: Object.fromEntries([...c.anios.map((_, i) => [i + 1, { halign: "right", cellWidth: 17 }]), [c.anios.length + 1, { halign: "right", fontStyle: "bold", cellWidth: 18 }]]),
      didParseCell: d => {
        if (d.section === "body" && d.column.index >= 1 && d.column.index <= c.anios.length) {
          const v = entes[d.row.index][1][d.column.index - 1];
          if (v) { const a = 0.08 + 0.55 * v / maxCelda; d.cell.styles.fillColor = [255 - Math.round((255 - 107) * a), 255 - Math.round((255 - 31) * a), 255 - Math.round((255 - 42) * a)]; if (a > 0.45) d.cell.styles.textColor = 255; }
        }
      }
    });

    /* ===== Estatus ===== */
    titulo("4", "Estatus actual de los expedientes", 135);
    const g1 = rptGrafica("pj-ch-estatus", cfg["pj-ch-estatus"], 430, 340);
    const g2 = rptGrafica("pj-ch-estatus-anio", cfg["pj-ch-estatus-anio"], 430, 340);
    const mitad = (ANCHO - 4) / 2;
    const altoG = mitad * g1.alto / g1.ancho;
    asegurar(altoG + 2);
    doc.addImage(g1.png, "PNG", M, y, mitad, altoG, undefined, "FAST");
    doc.addImage(g2.png, "PNG", M + mitad + 4, y, mitad, altoG, undefined, "FAST");
    doc.setDrawColor(...RPT_LINEA); doc.setLineWidth(0.2);
    doc.rect(M, y, mitad, altoG); doc.rect(M + mitad + 4, y, mitad, altoG);
    y += altoG + 5;
    const totEst = rptSuma(c.claves.map(k => c.totalEst[k]));
    tabla({
      head: [["Clave", "Significado", ...c.anios, "Total", "%"]],
      body: c.claves.map(k => [k, ESTATUS_PROCEDIMIENTOS[k] || `Estatus ${k}`, ...c.estatusPorAnio[k].map(pjFmt), pjFmt(c.totalEst[k]), rptPct(c.totalEst[k], totEst)]),
      foot: [["", "Total con estatus", ...c.anios.map((a, i) => pjFmt(rptSuma(c.claves.map(k => c.estatusPorAnio[k][i])))), pjFmt(totEst), "100%"]],
      showFoot: "lastPage",
      columnStyles: Object.fromEntries([[0, { halign: "center", fontStyle: "bold", cellWidth: 14 }],
        ...c.anios.map((_, i) => [i + 2, num]), [c.anios.length + 2, { ...num, fontStyle: "bold" }], [c.anios.length + 3, num]])
    });

    /* ===== Casos con avance ===== */
    titulo("5", "Casos con resolución o instancia judicial");
    if (c.casos.length) {
      tabla({
        head: [["Cuenta pública", "Ente fiscalizable", "Ubicación", "Detalle"]],
        body: c.casos.map(x => [x.anio, x.ente, x.ubicacion ? pjNombreUbicacion(x.ubicacion) : "", x.detalle]),
        styles: { fontSize: 8 },
        columnStyles: { 0: { halign: "center", cellWidth: 20 }, 1: { cellWidth: 50 }, 2: { cellWidth: 34 } }
      });
    } else parrafo("No hay casos con resolución o instancia judicial registrados.", 9.5, RPT_SUAVE);

    /* ===== Sin respuesta ===== */
    titulo("6", "Entes sin respuesta");
    if (c.sinRespuesta.length) {
      tabla({
        head: [["Cuenta pública", "Ente fiscalizable", "Ubicación"]],
        body: c.sinRespuesta.map(x => [x.anio, x.ente, x.ubicacion ? pjNombreUbicacion(x.ubicacion) : ""]),
        styles: { fontSize: 8 },
        columnStyles: { 0: { halign: "center", cellWidth: 24 }, 2: { cellWidth: 48 } }
      });
    } else parrafo("Ningún ente aparece como \"sin respuesta\".", 9.5, RPT_SUAVE);

    /* ===== Encabezado y pie de cada página ===== */
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
      const mg = w > h ? 12 : M;
      if (i > 1) {
        texto(RPT_SUAVE, 7.5, "bold"); doc.text("PROCEDIMIENTOS JURÍDICOS · CONSOLIDADO DE FALTAS", mg, 11);
        doc.setDrawColor(...RPT_VERDE); doc.setLineWidth(0.5); doc.line(mg, 13.2, w - mg, 13.2);
      }
      doc.setDrawColor(...RPT_LINEA); doc.setLineWidth(0.2); doc.line(mg, h - 12, w - mg, h - 12);
      texto(RPT_SUAVE, 7.5);
      doc.text(`Generado el ${rptFechaLarga(ahora)}`, mg, h - 7.5);
      doc.text(`Página ${i} de ${total}`, w - mg, h - 7.5, { align: "right" });
    }

    const nombre = `Reporte_Procedimientos_Juridicos_${ahora.toISOString().slice(0, 10)}.pdf`;
    doc.save(nombre);
  } catch (error) {
    console.error("Reporte PDF:", error);
    alert("No se pudo generar el reporte PDF: " + error.message);
  } finally {
    if (boton) boton.disabled = false;
    estado(textoOriginal);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("btn-pj-pdf");
  if (b) b.addEventListener("click", pjGenerarReportePDF);
});
