/* ============================================================
   APARTADO: PROCEDIMIENTOS JURÍDICOS
   Lee la hoja CONSOLIDADO DE FALTAS (vía Apps Script) y arma:
   KPIs, evolución por año, ubicación, estatus, entes con más
   expedientes y casos con avance judicial.
   La vista se abre con el botón del encabezado y reemplaza a la
   vista de auditorías, por lo que la página no se hace más larga.
============================================================ */

const PJ_HASH = "#procedimientos-juridicos";
const PJ_COLORES = {
  noGrave: "#c8923b", grave: "#a14a3a", penal: "#5c4a4a", guinda: "#6b1f2a",
  buena: "#3f7a4f", neutro: "#7a8693", acento: "#c4a08a"
};
const PJ_COLORES_ESTATUS = ["#6b1f2a", "#3f7a4f", "#c8923b", "#5c4a4a", "#7a8693", "#c4a08a", "#a14a3a"];

let PJ_DATOS = null;          // registros normalizados
let PJ_CARGANDO = false;
let PJ_GRAFICAS = {};
let PJ_SUBTITULO_ORIGINAL = null;

/* ---------- Carga y normalización ---------- */

async function pjCargarHoja() {
  const sep = APPS_SCRIPT_URL.includes("?") ? "&" : "?";
  const url = `${APPS_SCRIPT_URL}${sep}hoja=${encodeURIComponent(HOJA_PROCEDIMIENTOS)}&_=${Date.now()}`;
  const respuesta = await fetch(url, { cache: "no-store" });
  if (!respuesta.ok) throw new Error("No se pudo conectar con Google Sheets.");
  const json = await respuesta.json();
  if (json && json.error) throw new Error(json.mensaje || "El Apps Script devolvió un error.");
  const filas = Array.isArray(json) ? json : (json && json.datos);
  if (!Array.isArray(filas)) throw new Error("La respuesta del Apps Script no contiene datos válidos.");
  // Si el Apps Script aún no acepta el parámetro "hoja", devuelve DATOS AUDITORIAS
  if (filas.length && !("ente_fiscalizable" in filas[0])) {
    const e = new Error("APPS_SCRIPT_SIN_HOJA");
    e.codigo = "APPS_SCRIPT_SIN_HOJA";
    throw e;
  }
  return filas;
}

function pjUnificarEstatus(clave) {
  return ESTATUS_EQUIVALENTES_PROCEDIMIENTOS[clave] || clave;
}

function pjNormalizar(filas) {
  return filas.map(f => ({
    anio: limpiarTexto(obtenerValor(f, ["cuenta_publica"])),
    ente: limpiarTexto(obtenerValor(f, ["ente_fiscalizable"])).replace(/\s+/g, " "),
    tipo: limpiarTexto(obtenerValor(f, ["tipo_de_falta"])),
    articulo: limpiarTexto(obtenerValor(f, ["tipo_de_falta_art_lraembcs"])),
    exp: convertirEntero(obtenerValor(f, ["numero_de_expedientes_radicados"], 0)),
    estatus: pjUnificarEstatus(limpiarTexto(obtenerValor(f, ["estatus_actual"])).toUpperCase()),
    ubicacion: limpiarTexto(obtenerValor(f, ["ubicacion"])),
    detalle: limpiarTexto(obtenerValor(f, ["detalle_breve"]))
  })).filter(r => r.ente && r.anio);
}

/* ---------- Cálculos (funciones puras) ---------- */

function pjSumar(registros, clave) {
  const m = {};
  registros.forEach(r => { const k = clave(r); m[k] = (m[k] || 0) + r.exp; });
  return m;
}

function pjCalcular(registros) {
  const anios = Array.from(new Set(registros.map(r => r.anio))).sort();
  const tipos = ["No Grave", "Grave", "Denuncia Penal"];
  const porAnioTipo = {};
  tipos.forEach(t => { porAnioTipo[t] = anios.map(a => registros.filter(r => r.anio === a && r.tipo === t).reduce((s, r) => s + r.exp, 0)); });

  const ubicaciones = Array.from(new Set(registros.filter(r => r.ubicacion).map(r => r.ubicacion)));
  ubicaciones.sort((a, b) => registros.filter(r => r.ubicacion === b).reduce((s, r) => s + r.exp, 0) - registros.filter(r => r.ubicacion === a).reduce((s, r) => s + r.exp, 0));
  const porUbicacionTipo = {};
  ["No Grave", "Grave"].forEach(t => { porUbicacionTipo[t] = ubicaciones.map(u => registros.filter(r => r.ubicacion === u && r.tipo === t).reduce((s, r) => s + r.exp, 0)); });

  const claves = Array.from(new Set(registros.filter(r => r.estatus).map(r => r.estatus)));
  const totalEst = pjSumar(registros.filter(r => r.estatus), r => r.estatus);
  claves.sort((a, b) => totalEst[b] - totalEst[a]);
  const estatusPorAnio = {};
  claves.forEach(c => { estatusPorAnio[c] = anios.map(a => registros.filter(r => r.anio === a && r.estatus === c).reduce((s, r) => s + r.exp, 0)); });

  const porEnte = {};
  registros.forEach(r => { (porEnte[r.ente] = porEnte[r.ente] || anios.map(() => 0))[anios.indexOf(r.anio)] += r.exp; });
  const topEntes = Object.entries(porEnte).sort((a, b) => b[1].reduce((s, x) => s + x, 0) - a[1].reduce((s, x) => s + x, 0)).slice(0, 12);

  const reAvance = /inhabilita|fiscal[ií]a|juez de control|acredit|inexistencia|apelaci|amparo/i;
  const casos = registros.filter(r => r.detalle && reAvance.test(r.detalle));
  const sinRespuesta = registros.filter(r => /sin respuesta/i.test(r.detalle));

  const total = registros.reduce((s, r) => s + r.exp, 0);
  return {
    anios, tipos, porAnioTipo, ubicaciones, porUbicacionTipo, claves, estatusPorAnio, totalEst,
    topEntes, casos, sinRespuesta, total,
    totNoGrave: porAnioTipo["No Grave"].reduce((s, x) => s + x, 0),
    totGrave: porAnioTipo["Grave"].reduce((s, x) => s + x, 0),
    totPenal: porAnioTipo["Denuncia Penal"].reduce((s, x) => s + x, 0),
    entes: Object.keys(porEnte).length
  };
}

/* ---------- Dibujo ---------- */

const pjEl = id => document.getElementById(id);
const pjEsc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pjFmt = n => new Intl.NumberFormat("es-MX").format(Math.round(n));
const pjNombreEstatus = k => ESTATUS_PROCEDIMIENTOS[k] ? `${k} · ${ESTATUS_PROCEDIMIENTOS[k]}` : `Estatus ${k}`;
const pjNombreUbicacion = k => UBICACIONES_PROCEDIMIENTOS[k] || k;
const pjCorto = s => s.replace(/Organismo Operador (Municipal )?del? Sistema de Agua Potable,? (y )?Alcantarillado( y Saneamiento)?( del Municipio)? de /, "Organismo de agua de ");

function pjDestruirGraficas() {
  Object.values(PJ_GRAFICAS).forEach(g => g && g.destroy());
  PJ_GRAFICAS = {};
}

function pjCrear(id, config) {
  const canvas = pjEl(id);
  if (!canvas) return;
  PJ_GRAFICAS[id] = new Chart(canvas, config);
}

function pjEjes(apilado) {
  return {
    x: { stacked: apilado, grid: { color: "#e6e4dd" } },
    y: { stacked: apilado, grid: { color: "#e6e4dd" }, beginAtZero: true, ticks: { precision: 0 } }
  };
}

function pjRender() {
  if (!PJ_DATOS) return;
  const sel = pjEl("f-pj-anio");
  const anioSel = sel ? sel.value : "";
  const completos = PJ_DATOS;
  const filtrados = anioSel ? completos.filter(r => r.anio === anioSel) : completos;
  const c = pjCalcular(filtrados);
  const todo = pjCalcular(completos);   // la gráfica por año siempre muestra todos los años
  pjDestruirGraficas();

  const pct = n => c.total ? Math.round(n / c.total * 100) + "% del total" : "sin expedientes";
  pjEl("pj-kpis").innerHTML = `
    <div class="kpi k1"><div class="label">Expedientes radicados</div><div class="value">${pjFmt(c.total)}</div><div class="sub">${anioSel ? "cuenta pública " + anioSel : "todas las cuentas públicas"}</div></div>
    <div class="kpi k4"><div class="label">Faltas no graves</div><div class="value">${pjFmt(c.totNoGrave)}</div><div class="sub">${pct(c.totNoGrave)}</div></div>
    <div class="kpi k5"><div class="label">Faltas graves</div><div class="value">${pjFmt(c.totGrave)}</div><div class="sub">${pct(c.totGrave)}</div></div>
    <div class="kpi k2"><div class="label">Denuncias penales</div><div class="value">${pjFmt(c.totPenal)}</div><div class="sub">${pct(c.totPenal)}</div></div>
    <div class="kpi k3"><div class="label">Entes con expedientes</div><div class="value">${pjFmt(c.entes)}</div><div class="sub">entes únicos</div></div>`;

  const base = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } };

  pjCrear("pj-ch-anio", { type: "bar", data: { labels: todo.anios, datasets: [
    { label: "No grave", data: todo.porAnioTipo["No Grave"], backgroundColor: PJ_COLORES.noGrave },
    { label: "Grave", data: todo.porAnioTipo["Grave"], backgroundColor: PJ_COLORES.grave },
    { label: "Denuncia penal", data: todo.porAnioTipo["Denuncia Penal"], backgroundColor: PJ_COLORES.penal }] },
    options: { ...base, scales: pjEjes(true) } });

  pjCrear("pj-ch-ubicacion", { type: "bar", data: { labels: c.ubicaciones.map(pjNombreUbicacion), datasets: [
    { label: "No grave", data: c.porUbicacionTipo["No Grave"], backgroundColor: PJ_COLORES.noGrave },
    { label: "Grave", data: c.porUbicacionTipo["Grave"], backgroundColor: PJ_COLORES.grave }] },
    options: { ...base, indexAxis: "y", scales: pjEjes(true) } });

  const colorEst = (k, i) => PJ_COLORES_ESTATUS[i % PJ_COLORES_ESTATUS.length];
  pjCrear("pj-ch-estatus", { type: "doughnut", data: { labels: c.claves.map(pjNombreEstatus), datasets: [
    { data: c.claves.map(k => c.totalEst[k]), backgroundColor: c.claves.map(colorEst), borderColor: "#fff", borderWidth: 2 }] },
    options: { ...base, cutout: "58%" } });

  pjCrear("pj-ch-estatus-anio", { type: "bar", data: { labels: c.anios, datasets: c.claves.map((k, i) => (
    { label: pjNombreEstatus(k), data: c.estatusPorAnio[k], backgroundColor: colorEst(k, i) })) },
    options: { ...base, scales: pjEjes(true) } });

  const max = Math.max(1, ...c.topEntes.flatMap(t => t[1]));
  pjEl("pj-heat").innerHTML = `<thead><tr><th>Ente fiscalizable</th>${c.anios.map(a => `<th style="text-align:right">${a}</th>`).join("")}<th style="text-align:right">Total</th></tr></thead><tbody>` +
    c.topEntes.map(([e, v]) => `<tr><td>${pjEsc(pjCorto(e))}</td>${v.map(x => `<td style="text-align:right;background:rgba(107,31,42,${x ? (0.08 + 0.55 * x / max).toFixed(2) : 0})">${x || "·"}</td>`).join("")}<td style="text-align:right;font-weight:bold">${pjFmt(v.reduce((s, x) => s + x, 0))}</td></tr>`).join("") + "</tbody>";

  const claseCaso = d => /no acredit|inexistencia/i.test(d) ? "ok" : /inhabilita/i.test(d) ? "pen" : "jud";
  pjEl("pj-casos").innerHTML = c.casos.length ? c.casos.map(x => `<div class="pj-caso ${claseCaso(x.detalle)}"><div class="y">Cuenta pública ${pjEsc(x.anio)}${x.ubicacion ? " · " + pjEsc(pjNombreUbicacion(x.ubicacion)) : ""}</div><div class="e">${pjEsc(pjCorto(x.ente))}</div><div class="d">${pjEsc(x.detalle)}</div></div>`).join("") : `<p class="pj-vacio">No hay casos con resolución o instancia judicial para esta selección.</p>`;
  pjEl("pj-sinresp").innerHTML = c.sinRespuesta.length ? c.sinRespuesta.map(x => `<span class="pj-chip">${pjEsc(pjCorto(x.ente))} · ${pjEsc(x.anio)}</span>`).join("") : `<p class="pj-vacio">Ningún ente sin respuesta para esta selección.</p>`;
}

function pjPrepararFiltro() {
  const sel = pjEl("f-pj-anio");
  if (!sel || sel.dataset.listo) return;
  const anios = Array.from(new Set(PJ_DATOS.map(r => r.anio))).sort();
  sel.innerHTML = `<option value="">Todas</option>` + anios.map(a => `<option value="${pjEsc(a)}">${pjEsc(a)}</option>`).join("");
  sel.addEventListener("change", pjRender);
  sel.dataset.listo = "1";
}

/* ---------- Apertura y cierre de la vista ---------- */

function pjMensaje(texto, conReintento) {
  const m = pjEl("pj-mensaje");
  m.hidden = !texto;
  m.innerHTML = texto ? `<p>${texto}</p>${conReintento ? '<button type="button" class="btn-clear" id="pj-reintentar" style="width:auto;margin-top:8px">Reintentar</button>' : ""}` : "";
  const b = pjEl("pj-reintentar");
  if (b) b.addEventListener("click", pjCargarYMostrar);
  pjEl("pj-contenido").hidden = !!texto;
}

async function pjCargarYMostrar() {
  if (PJ_DATOS) { pjMensaje(""); pjRender(); return; }
  if (PJ_CARGANDO) return;
  PJ_CARGANDO = true;
  pjMensaje("Cargando procedimientos jurídicos…", false);
  try {
    PJ_DATOS = pjNormalizar(await pjCargarHoja());
    pjMensaje("");
    pjPrepararFiltro();
    pjEl("pj-fuente").textContent = `Fuente: hoja ${HOJA_PROCEDIMIENTOS} · ${PJ_DATOS.length} registros`;
    pjRender();
  } catch (error) {
    console.error("Procedimientos jurídicos:", error);
    if (error.codigo === "APPS_SCRIPT_SIN_HOJA") {
      pjMensaje("El Apps Script todavía no entrega la hoja " + pjEsc(HOJA_PROCEDIMIENTOS) + ". Actualiza el script y vuelve a publicar la implementación.", true);
    } else {
      pjMensaje("No se pudieron cargar los procedimientos jurídicos: " + pjEsc(error.message), true);
    }
  } finally {
    PJ_CARGANDO = false;
  }
}

function pjAbrir() {
  const aud = pjEl("vista-auditorias"), pj = pjEl("vista-pj"), btn = pjEl("btn-pj");
  if (!pj) return;
  aud.hidden = true; pj.hidden = false;
  btn.querySelector(".ico").textContent = "◀";
  btn.querySelector(".txt").textContent = "Resumen de Auditorías";
  const sub = pjEl("hdr-periodo");
  if (sub) { if (PJ_SUBTITULO_ORIGINAL === null) PJ_SUBTITULO_ORIGINAL = sub.textContent; sub.textContent = "Procedimientos Jurídicos"; }
  if (location.hash !== PJ_HASH) history.pushState(null, "", PJ_HASH);
  window.scrollTo(0, 0);
  pjCargarYMostrar();
}

function pjCerrar() {
  const aud = pjEl("vista-auditorias"), pj = pjEl("vista-pj"), btn = pjEl("btn-pj");
  if (!pj) return;
  pj.hidden = true; aud.hidden = false;
  btn.querySelector(".ico").textContent = "⚖";
  btn.querySelector(".txt").textContent = "Procedimientos Jurídicos";
  const sub = pjEl("hdr-periodo");
  if (sub && PJ_SUBTITULO_ORIGINAL !== null) sub.textContent = PJ_SUBTITULO_ORIGINAL;
  if (location.hash === PJ_HASH) history.pushState(null, "", location.pathname + location.search);
  window.scrollTo(0, 0);
  // Las gráficas de auditorías se dibujaron con la vista oculta: se ajustan al volver
  if (typeof charts === "object") Object.values(charts).forEach(g => g && g.resize && g.resize());
}

function pjAlternar() { pjEl("vista-pj").hidden ? pjAbrir() : pjCerrar(); }

document.addEventListener("DOMContentLoaded", () => {
  const btn = pjEl("btn-pj");
  if (btn) btn.addEventListener("click", pjAlternar);
  window.addEventListener("popstate", () => { location.hash === PJ_HASH ? pjAbrir() : pjCerrar(); });
  if (location.hash === PJ_HASH) pjAbrir();
});
