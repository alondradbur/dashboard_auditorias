/* ============================================================
   LÓGICA ORIGINAL DEL DASHBOARD, KPIs, TABLAS Y GRÁFICAS
============================================================ */
let RAW_DATA = [];

// Normalización de typos detectados en la fuente
RAW_DATA.forEach(r => {
  if(r.entidad === "Municipo de Loreto") r.entidad = "Municipio de Loreto";
});

// Chart.js global config
Chart.defaults.font.family = "Arial, Helvetica, sans-serif";
Chart.defaults.font.size = 13;
Chart.defaults.color = "#2c2c2c";
if (window.ChartDataLabels) Chart.register(window.ChartDataLabels);

// Plugin de marca de agua institucional
const watermarkImage = new Image();
watermarkImage.src = "assets/logo.png";
const watermarkPlugin = {
  id: "uecWatermark",
  beforeDraw(chart){
    if(!watermarkImage.complete || watermarkImage.naturalWidth === 0) return;
    const {ctx, chartArea} = chart;
    if(!chartArea) return;
    const {left, top, width, height} = chartArea;
    const size = Math.min(width, height) * 0.55;
    const x = left + (width - size) / 2;
    const y = top + (height - size) / 2;
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.drawImage(watermarkImage, x, y, size, size);
    ctx.restore();
  }
};
Chart.register(watermarkPlugin);
// Re-render charts cuando cargue la imagen
watermarkImage.onload = () => { Object.values(charts || {}).forEach(c => c && c.update && c.update()); };

const PALETTE = {
  primary:"#1e3a5f", primary2:"#2c5282", secondary:"#4a5d75",
  accent:"#8b9dc3", good:"#3f7a4f", warn:"#c8923b", bad:"#a14a3a",
  neutral:"#7a8693", lightBg:"#dde3ec"
};
const TYPE_COLORS = {"CyGF":PALETTE.primary, "OP":PALETTE.warn, "D":PALETTE.good};
const DICTAMEN_COLORS = {"Se Aprueba":PALETTE.good, "No se aprueba":PALETTE.bad, "Desempeño":PALETTE.warn};

// State
let currentFilters = { anios:[], naturaleza:"", tipo:"", dictamen:"", entidad:"" };
let charts = {};
let sortKey = "anio", sortAsc = false;

// Helpers
const fmtN = n => new Intl.NumberFormat('es-MX').format(Math.round(n));
const fmtMillions = n => "$" + new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(n/1e6);
const fmtPct = n => (Math.round(n*10)/10) + "%";


function getFiltered(){
  return RAW_DATA.filter(r=>{
    if(currentFilters.anios.length && !currentFilters.anios.includes(String(r.anio))) return false;
    if(currentFilters.naturaleza && r.naturaleza !== currentFilters.naturaleza) return false;
    if(currentFilters.tipo && !r.tipos_split.includes(currentFilters.tipo)) return false;
    if(currentFilters.dictamen && r.dictamen !== currentFilters.dictamen) return false;
    if(currentFilters.entidad && !(r.entidad||"").toLowerCase().includes(currentFilters.entidad.toLowerCase())) return false;
    return true;
  });
}

function unique(arr){ return [...new Set(arr)]; }


function actualizarBotonAnios(){
  const boton = document.getElementById("f-anio-btn");
  const todos = document.getElementById("f-anio-todos");
  const checks = Array.from(document.querySelectorAll(".year-checkbox"));

  if (!boton || !todos) return;

  if (!currentFilters.anios.length) {
    boton.textContent = "Todos ▾";
    todos.checked = true;
    checks.forEach(ch => ch.checked = false);
    return;
  }

  todos.checked = false;
  checks.forEach(ch => ch.checked = currentFilters.anios.includes(ch.value));
  boton.textContent = `${currentFilters.anios.join(", ")} ▾`;
}

function populateFilters(){
  const anios = unique(RAW_DATA.map(r=>r.anio).filter(x=>x)).sort();
  const naturalezas = unique(RAW_DATA.map(r=>r.naturaleza).filter(x=>x && x!=="NA")).sort();
  const entidades = unique(RAW_DATA.map(r=>r.entidad).filter(x=>x)).sort();
  const contenedorAnios = document.getElementById("f-anio-opciones");

  if (contenedorAnios) {
    contenedorAnios.innerHTML = "";
    anios.forEach(a=>{
      const label = document.createElement("label");
      label.className = "year-option";
      label.innerHTML = `<input type="checkbox" class="year-checkbox" value="${a}"><span>${a}</span>`;
      contenedorAnios.appendChild(label);
    });
  }

  const fN = document.getElementById("f-naturaleza");
  naturalezas.forEach(n=>{ const o=document.createElement("option"); o.value=n; o.textContent=n; fN.appendChild(o); });
  const dl = document.getElementById("entidades-list");
  entidades.forEach(e=>{ const o=document.createElement("option"); o.value=e; dl.appendChild(o); });

  actualizarBotonAnios();
}


function clearFilters(){
  currentFilters = { anios:[], naturaleza:"", tipo:"", dictamen:"", entidad:"" };
  actualizarBotonAnios();
  document.getElementById("f-naturaleza").value = "";
  document.getElementById("f-tipo").value = "";
  document.getElementById("f-dictamen").value = "";
  document.getElementById("f-entidad").value = "";
  renderAll();
}


function bindFilterEvents(){
  const filtroAnio = document.getElementById("f-anio");
  const botonAnio = document.getElementById("f-anio-btn");
  const todosAnios = document.getElementById("f-anio-todos");

  if (botonAnio && filtroAnio) {
    botonAnio.addEventListener("click", e=>{
      e.stopPropagation();
      filtroAnio.classList.toggle("open");
    });
  }

  if (todosAnios) {
    todosAnios.addEventListener("change", ()=>{
      currentFilters.anios = [];
      actualizarBotonAnios();
      renderAll();
    });
  }

  document.querySelectorAll(".year-checkbox").forEach(ch=>{
    ch.addEventListener("change", ()=>{
      currentFilters.anios = Array.from(document.querySelectorAll(".year-checkbox:checked")).map(x=>x.value);
      actualizarBotonAnios();
      renderAll();
    });
  });

  document.addEventListener("click", e=>{
    if (filtroAnio && !filtroAnio.contains(e.target)) {
      filtroAnio.classList.remove("open");
    }
  });

  ["f-naturaleza","f-tipo","f-dictamen"].forEach(id=>{
    document.getElementById(id).addEventListener("change", e=>{
      const key = id.replace("f-","");
      currentFilters[key] = e.target.value;
      renderAll();
    });
  });
  document.getElementById("f-entidad").addEventListener("input", e=>{
    currentFilters.entidad = e.target.value;
    renderAll();
  });
  document.getElementById("tbl-search").addEventListener("input", e=>{
    renderRanking(e.target.value);
  });
  document.querySelectorAll("#tbl-ranking thead th[data-sort]").forEach(th=>{
    th.addEventListener("click", ()=>{
      const k = th.dataset.sort;
      if(sortKey === k) sortAsc = !sortAsc; else { sortKey = k; sortAsc = true; }
      renderRanking(document.getElementById("tbl-search").value);
    });
  });
}


function renderKPIs(d){
  document.getElementById("kpi-total").textContent = fmtN(d.length);
  document.getElementById("kpi-total-sub").textContent = `de ${RAW_DATA.length} totales`;
  document.getElementById("kpi-entes").textContent = fmtN(unique(d.map(r=>r.entidad)).length);
  const aprob = d.filter(r=>r.dictamen==="Se Aprueba").length;
  const noaprob = d.filter(r=>r.dictamen==="No se aprueba").length;
  const denom = aprob+noaprob;
  const pct = denom>0 ? (aprob/denom*100) : 0;
  document.getElementById("kpi-aprob").textContent = fmtPct(pct);
  document.getElementById("kpi-aprob-sub").textContent = `${aprob} aprobados / ${noaprob} no aprobados`;
  const obs = d.reduce((a,r)=>a+r.obs_no_solv,0);
  document.getElementById("kpi-obs").textContent = fmtN(obs);
  const monto = d.reduce((a,r)=>a+r.egresos_no_solv+r.obra_no_solv+r.ingresos_no_solv+r.presup_no_solv,0);
  document.getElementById("kpi-monto").textContent = fmtMillions(monto);
}

function destroyChart(key){ if(charts[key]){ charts[key].destroy(); delete charts[key]; } }


function renderAnioTipo(d){
  const anios = unique(d.map(r=>r.anio).filter(x=>x)).sort();
  const counts = {CyGF:[], OP:[], D:[]};
  anios.forEach(a=>{
    const sub = d.filter(r=>r.anio===a);
    counts.CyGF.push(sub.reduce((s,r)=>s+(r.cygf||0),0));
    counts.OP.push(sub.reduce((s,r)=>s+(r.obra||0),0));
    counts.D.push(sub.reduce((s,r)=>s+(r.desempeno||0),0));
  });
  destroyChart("anioTipo");
  charts.anioTipo = new Chart(document.getElementById("ch-anio-tipo"), {
    type:"bar",
    data:{labels:anios, datasets:[
      {label:"CyGF", data:counts.CyGF, backgroundColor:TYPE_COLORS.CyGF},
      {label:"Obra Pública", data:counts.OP, backgroundColor:TYPE_COLORS.OP},
      {label:"Desempeño", data:counts.D, backgroundColor:TYPE_COLORS.D},
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:"bottom"},
        tooltip:{callbacks:{label:(ctx)=>{
          const idx = ctx.dataIndex;
          const total = ctx.chart.data.datasets.reduce((s,d)=>s+(d.data[idx]||0),0);
          const v = ctx.parsed.y;
          const p = total>0 ? Math.round(v/total*100) : 0;
          return ctx.dataset.label+": "+v+" auditorías ("+p+"%)";
        }}},
        datalabels:{
          display:(ctx)=>ctx.dataset.data[ctx.dataIndex]>0,
          color:"#fff", font:{weight:"bold", size:11},
          formatter:(v, ctx)=>{
            const idx = ctx.dataIndex;
            const total = ctx.chart.data.datasets.reduce((s,d)=>s+(d.data[idx]||0),0);
            return total>0 && v>0 ? Math.round(v/total*100)+"%" : "";
          }
        }
      },
      scales:{x:{stacked:true}, y:{stacked:true, beginAtZero:true, title:{display:true,text:"Auditorías"}}}}
  });
}


function renderTopEntes(d){
  // Calcula entes auditados en TODOS los años del periodo filtrado
  const cont = document.getElementById("entes-permanentes");
  if(!cont) return;
  const aniosDisponibles = unique(d.map(r=>r.anio).filter(x=>x)).sort();
  const totalAnios = aniosDisponibles.length;
  const enteAnios = {};
  const enteNat = {};
  d.forEach(r=>{
    if(!enteAnios[r.entidad]) enteAnios[r.entidad] = new Set();
    enteAnios[r.entidad].add(r.anio);
    enteNat[r.entidad] = r.naturaleza || "SIN CLASIFICAR";
  });
  // Permanentes = auditados en todos los años del periodo
  const permanentes = Object.keys(enteAnios).filter(e => enteAnios[e].size === totalAnios && totalAnios>0);
  permanentes.sort();
  const totalEntes = Object.keys(enteAnios).length;
  const pctPerm = totalEntes>0 ? Math.round(permanentes.length/totalEntes*100) : 0;

  // Agrupar por naturaleza jurídica
  const grupos = {};
  permanentes.forEach(e=>{
    const n = enteNat[e];
    if(!grupos[n]) grupos[n] = [];
    grupos[n].push(e);
  });
  const ordenNat = ["EJECUTIVO","LEGISLATIVO","JUDICIAL","AUTÓNOMO","DESCENTRALIZADO","DESCONCENTRADO","PARAESTATAL","MUNICIPAL","ORGANISMO OPERADOR MUNICIPAL"];
  const naturalezasOrdenadas = Object.keys(grupos).sort((a,b)=>{
    const ia = ordenNat.indexOf(a), ib = ordenNat.indexOf(b);
    return (ia<0?99:ia) - (ib<0?99:ib);
  });

  let html = `<div class="perm-intro">
    Son los entes que han sido <b>auditados en cada uno de los ${totalAnios} ejercicios fiscales</b> del periodo. Por su <b>importancia presupuestal, naturaleza jurídica o impacto institucional</b>, ingresan al programa de fiscalización <b>todos los años sin excepción</b>.
  </div>
  <div class="perm-stats">
    <div class="perm-stat"><div class="n">${permanentes.length}</div><div class="l">Entes permanentes</div></div>
    <div class="perm-stat"><div class="n">${pctPerm}%</div><div class="l">del total auditado</div></div>
    <div class="perm-stat"><div class="n">${totalAnios}</div><div class="l">Ejercicios cubiertos</div></div>
  </div>`;

  if(permanentes.length === 0){
    html += `<div style="padding:20px;text-align:center;color:#7a8693;font-style:italic;">No hay entes auditados en todos los años del filtro actual.</div>`;
  } else {
    naturalezasOrdenadas.forEach(n=>{
      html += `<div class="perm-group">
        <div class="perm-group-title">${n} (${grupos[n].length})</div>`;
      grupos[n].forEach(e=>{
        html += `<div class="perm-item">${e}</div>`;
      });
      html += `</div>`;
    });
  }
  cont.innerHTML = html;
}


function renderHeatmap(d){
  const anios = unique(RAW_DATA.map(r=>r.anio).filter(x=>x)).sort();
  const naturalezas = unique(RAW_DATA.map(r=>r.naturaleza).filter(x=>x && x!=="NA")).sort();
  const matrix = {};
  let maxV = 0;
  naturalezas.forEach(n=>{
    matrix[n]={};
    anios.forEach(a=>{
      const v = d.filter(r=>r.naturaleza===n && r.anio===a).length;
      matrix[n][a] = v;
      if(v>maxV) maxV = v;
    });
  });
  const cont = document.getElementById("heatmap-container");
  let html = '<table style="border-collapse:collapse;width:100%;font-size:13px;"><thead><tr><th style="background:#1e3a5f;color:#fff;padding:8px;text-align:left;">Naturaleza Jurídica</th>';
  anios.forEach(a=>{ html += `<th style="background:#1e3a5f;color:#fff;padding:8px;text-align:center;">${a}</th>`; });
  html += '<th style="background:#1e3a5f;color:#fff;padding:8px;text-align:center;">Total</th></tr></thead><tbody>';
  naturalezas.forEach(n=>{
    html += `<tr><td style="padding:7px 10px;border-bottom:1px solid #d8d6cf;font-weight:bold;">${n}</td>`;
    let total = 0;
    anios.forEach(a=>{
      const v = matrix[n][a];
      total += v;
      const intensity = maxV>0 ? v/maxV : 0;
      const r = Math.round(255 - intensity*200);
      const g = Math.round(255 - intensity*170);
      const b = Math.round(255 - intensity*60);
      const txtColor = intensity>0.55 ? "#fff" : "#1f2933";
      html += `<td style="padding:7px;text-align:center;background:rgb(${r},${g},${b});color:${txtColor};font-weight:${v>0?'bold':'normal'};">${v||"-"}</td>`;
    });
    html += `<td style="padding:7px;text-align:center;background:#1e3a5f;color:#fff;font-weight:bold;">${total}</td></tr>`;
  });
  html += '</tbody></table>';
  cont.innerHTML = html;
}


function renderDictamenPie(d){
  const aprob = d.filter(r=>r.dictamen==="Se Aprueba").length;
  const noaprob = d.filter(r=>r.dictamen==="No se aprueba").length;
  destroyChart("dictPie");
  charts.dictPie = new Chart(document.getElementById("ch-dictamen-pie"), {
    type:"doughnut",
    data:{labels:["Se Aprueba","No se aprueba"],
          datasets:[{data:[aprob,noaprob], backgroundColor:[PALETTE.good, PALETTE.bad], borderWidth:2, borderColor:"#fff"}]},
    options:{responsive:true, maintainAspectRatio:false, cutout:"55%",
      plugins:{legend:{position:"bottom"},
               datalabels:{color:"#fff", font:{weight:"bold", size:14}, formatter:(v,ctx)=>{
                 const tot = ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);
                 return tot>0 ? Math.round(v/tot*100)+"%\n("+v+")" : "";
               }}}}
  });
}


function renderDictamenAnio(d){
  const anios = unique(d.map(r=>r.anio).filter(x=>x)).sort();
  const aprob = anios.map(a=>d.filter(r=>r.anio===a && r.dictamen==="Se Aprueba").length);
  const noaprob = anios.map(a=>d.filter(r=>r.anio===a && r.dictamen==="No se aprueba").length);
  destroyChart("dictAnio");
  charts.dictAnio = new Chart(document.getElementById("ch-dictamen-anio"), {
    type:"bar",
    data:{labels:anios, datasets:[
      {label:"Se Aprueba", data:aprob, backgroundColor:PALETTE.good},
      {label:"No se aprueba", data:noaprob, backgroundColor:PALETTE.bad}
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:"bottom"}, datalabels:{color:"#fff",font:{weight:"bold"}}},
      scales:{x:{stacked:true}, y:{stacked:true, beginAtZero:true}}}
  });
}


function renderSemaforo(d){
  const naturalezas = unique(d.map(r=>r.naturaleza).filter(x=>x && x!=="NA")).sort();
  const cont = document.getElementById("semaforo-grid");
  cont.innerHTML = "";
  naturalezas.forEach(n=>{
    const sub = d.filter(r=>r.naturaleza===n);
    const aprob = sub.filter(r=>r.dictamen==="Se Aprueba").length;
    const noaprob = sub.filter(r=>r.dictamen==="No se aprueba").length;
    const denom = aprob+noaprob;
    const pct = denom>0 ? aprob/denom*100 : 0;
    const cls = pct>=70 ? "green" : pct>=40 ? "yellow" : "red";
    cont.innerHTML += `<div class="sem-card ${cls}"><div class="name">${n}</div><div class="pct">${fmtPct(pct)}</div><div class="det">${aprob} aprob. / ${denom} con dictamen</div></div>`;
  });
}


function renderTblNoAprobadas(d){
  const rows = d.filter(r=>r.dictamen==="No se aprueba").sort((a,b)=>b.anio-a.anio || b.porc_final_no_solv-a.porc_final_no_solv);
  const tb = document.querySelector("#tbl-no-aprobadas tbody");
  tb.innerHTML = rows.map(r=>`<tr>
    <td>${r.anio}</td><td>${r.entidad}</td><td>${r.naturaleza||""}</td><td>${r.tipo||""}</td>
    <td>${fmtPct(r.porc_final_no_solv*100)}</td>
  </tr>`).join("");
}


function renderFunnel(d){
  const fin = d.reduce((s,r)=>s+r.obs_fincadas,0);
  const solv = d.reduce((s,r)=>s+r.obs_solventadas,0);
  const nosolv = d.reduce((s,r)=>s+r.obs_no_solv,0);
  destroyChart("funnel");
  charts.funnel = new Chart(document.getElementById("ch-funnel"), {
    type:"bar",
    data:{labels:["Fincadas","Solventadas","No Solventadas"],
          datasets:[{label:"Observaciones", data:[fin,solv,nosolv],
            backgroundColor:[PALETTE.primary, PALETTE.good, PALETTE.bad]}]},
    options:{indexAxis:"y", responsive:true, maintainAspectRatio:false,
      layout:{padding:{right:50}},
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:(ctx)=>{
          const v = ctx.parsed.x;
          const max = Math.max(...ctx.dataset.data);
          const p = max>0 ? Math.round(v/max*100) : 0;
          return fmtN(v)+" observaciones ("+p+"% de Fincadas)";
        }}},
        datalabels:{anchor:"end", align:"end", font:{weight:"bold", size:12}, color:PALETTE.ink,
          formatter:(v, ctx)=>{
            const max = Math.max(...ctx.dataset.data);
            const p = max>0 ? Math.round(v/max*100) : 0;
            return fmtN(v)+" ("+p+"%)";
          }}
      },
      scales:{x:{beginAtZero:true, suggestedMax:fin*1.18}}}
  });
}


function renderObsTipo(d){
  const cats = ["Cumplimiento","Egresos","Obra Pública","Ingresos","Presupuestales"];
  const fincado = [
    d.reduce((s,r)=>s+r.cumpl_fincado,0),
    d.reduce((s,r)=>s+r.egresos_fincado,0),
    d.reduce((s,r)=>s+r.obra_fincado,0),
    d.reduce((s,r)=>s+r.ingresos_fincado,0),
    d.reduce((s,r)=>s+r.presup_fincado,0)
  ].map(v=>v/1e6);
  const solv = [
    0,
    d.reduce((s,r)=>s+r.egresos_solv,0),
    d.reduce((s,r)=>s+r.obra_solv,0),
    d.reduce((s,r)=>s+r.ingresos_solv,0),
    d.reduce((s,r)=>s+r.presup_solv,0)
  ].map(v=>v/1e6);
  const nosolv = [
    0,
    d.reduce((s,r)=>s+r.egresos_no_solv,0),
    d.reduce((s,r)=>s+r.obra_no_solv,0),
    d.reduce((s,r)=>s+r.ingresos_no_solv,0),
    d.reduce((s,r)=>s+r.presup_no_solv,0)
  ].map(v=>v/1e6);
  destroyChart("obsTipo");
  charts.obsTipo = new Chart(document.getElementById("ch-obs-tipo"), {
    type:"bar",
    data:{labels:cats, datasets:[
      {label:"Fincado (Mill.)", data:fincado, backgroundColor:PALETTE.primary},
      {label:"Solventado (Mill.)", data:solv, backgroundColor:PALETTE.good},
      {label:"No Solventado (Mill.)", data:nosolv, backgroundColor:PALETTE.bad}
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:"bottom"},
        tooltip:{callbacks:{label:(ctx)=>{
          const idx = ctx.dataIndex;
          const finc = ctx.chart.data.datasets[0].data[idx]||0;
          const v = ctx.parsed.y;
          const p = finc>0 ? Math.round(v/finc*100) : 0;
          return ctx.dataset.label+": $"+v.toFixed(1)+" M ("+p+"% del Fincado)";
        }}},
        datalabels:{
          display:(ctx)=>ctx.dataset.data[ctx.dataIndex]>0,
          anchor:"end", align:"top", offset:-2,
          color:PALETTE.ink, font:{weight:"bold", size:10},
          formatter:(v, ctx)=>{
            const idx = ctx.dataIndex;
            const finc = ctx.chart.data.datasets[0].data[idx]||0;
            if(finc<=0 || v<=0) return "";
            return Math.round(v/finc*100)+"%";
          }
        }
      },
      scales:{y:{beginAtZero:true, title:{display:true, text:"Millones $"}}}}
  });
}


function renderSolvTrend(d){
  const anios = unique(d.map(r=>r.anio).filter(x=>x)).sort();
  const pct = anios.map(a=>{
    const sub = d.filter(r=>r.anio===a);
    const fin = sub.reduce((s,r)=>s+r.obs_fincadas,0);
    const sol = sub.reduce((s,r)=>s+r.obs_solventadas,0);
    return fin>0 ? sol/fin*100 : 0;
  });
  destroyChart("solvTrend");
  charts.solvTrend = new Chart(document.getElementById("ch-solv-trend"), {
    type:"line",
    data:{labels:anios, datasets:[{label:"% Solventación", data:pct,
      borderColor:PALETTE.good, backgroundColor:"rgba(63,122,79,.15)", fill:true, tension:.3, borderWidth:3, pointRadius:5}]},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, datalabels:{align:"top", offset:6, formatter:v=>fmtPct(v), font:{weight:"bold"}, color:PALETTE.good}},
      scales:{y:{beginAtZero:true, max:100, title:{display:true, text:"%"}}}}
  });
  // Ratios
  const totalFin = d.reduce((s,r)=>s+r.obs_fincadas,0);
  const totalNoSolv = d.reduce((s,r)=>s+r.obs_no_solv,0);
  const entes = unique(d.map(r=>r.entidad)).length;
  document.getElementById("prom-obs-aud").textContent = d.length>0 ? (totalFin/d.length).toFixed(1) : "0";
  document.getElementById("prom-obs-ente").textContent = entes>0 ? (totalFin/entes).toFixed(1) : "0";
  document.getElementById("tot-fincadas").textContent = fmtN(totalFin);
  document.getElementById("tot-no-solv").textContent = fmtN(totalNoSolv);
}


function renderUnivMuestra(d){
  const cats = ["Ingresos","Egresos","Obra"];
  const universo = [
    d.reduce((s,r)=>s+r.universo_ing,0),
    d.reduce((s,r)=>s+r.universo_egr,0),
    d.reduce((s,r)=>s+r.universo_obra,0)
  ].map(v=>v/1e6);
  const muestra = [
    d.reduce((s,r)=>s+r.muestra_ing,0),
    d.reduce((s,r)=>s+r.muestra_egr,0),
    d.reduce((s,r)=>s+r.muestra_obra,0)
  ].map(v=>v/1e6);
  destroyChart("univMuestra");
  charts.univMuestra = new Chart(document.getElementById("ch-univ-muestra"), {
    type:"bar",
    data:{labels:cats, datasets:[
      {label:"Universo (Mill.)", data:universo, backgroundColor:PALETTE.secondary},
      {label:"Muestra (Mill.)", data:muestra, backgroundColor:PALETTE.accent}
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:"bottom"},
        tooltip:{callbacks:{label:(ctx)=>{
          const idx = ctx.dataIndex;
          const univ = ctx.chart.data.datasets[0].data[idx]||0;
          const v = ctx.parsed.y;
          const p = univ>0 ? Math.round(v/univ*100) : 0;
          return ctx.dataset.label+": $"+v.toFixed(1)+" M ("+p+"% del Universo)";
        }}},
        datalabels:{
          display:(ctx)=>ctx.dataset.data[ctx.dataIndex]>0,
          anchor:"end", align:"top", offset:-2,
          color:PALETTE.ink, font:{weight:"bold", size:11},
          formatter:(v, ctx)=>{
            const idx = ctx.dataIndex;
            const univ = ctx.chart.data.datasets[0].data[idx]||0;
            if(univ<=0 || v<=0) return "";
            return Math.round(v/univ*100)+"%";
          }
        }
      },
      scales:{y:{beginAtZero:true, title:{display:true, text:"Millones $"}}}}
  });
}


function renderCobertura(d){
  const cats = ["Ingresos","Egresos","Obra"];
  const universo = [
    d.reduce((s,r)=>s+r.universo_ing,0),
    d.reduce((s,r)=>s+r.universo_egr,0),
    d.reduce((s,r)=>s+r.universo_obra,0)
  ];
  const muestra = [
    d.reduce((s,r)=>s+r.muestra_ing,0),
    d.reduce((s,r)=>s+r.muestra_egr,0),
    d.reduce((s,r)=>s+r.muestra_obra,0)
  ];
  const cob = cats.map((_,i)=> universo[i]>0 ? muestra[i]/universo[i]*100 : 0);
  destroyChart("cobertura");
  charts.cobertura = new Chart(document.getElementById("ch-cobertura"), {
    type:"bar",
    data:{labels:cats, datasets:[{label:"% Cobertura", data:cob,
      backgroundColor:cob.map(v=>v>=50?PALETTE.good:v>=20?PALETTE.warn:PALETTE.bad)}]},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, datalabels:{anchor:"end", align:"top", formatter:v=>fmtPct(v), font:{weight:"bold"}, color:PALETTE.ink}},
      scales:{y:{beginAtZero:true, max:100, title:{display:true, text:"%"}}}}
  });
}


function renderTopMonto(d){
  const map = {};
  d.forEach(r=>{
    const m = r.egresos_no_solv + r.obra_no_solv + r.ingresos_no_solv + r.presup_no_solv;
    map[r.entidad] = (map[r.entidad]||0) + m;
  });
  const top = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,10);
  destroyChart("topMonto");
  charts.topMonto = new Chart(document.getElementById("ch-top-monto"), {
    type:"bar",
    data:{labels:top.map(t=>t[0].length>35?t[0].slice(0,33)+"...":t[0]),
          datasets:[{label:"Mill. $", data:top.map(t=>t[1]/1e6), backgroundColor:PALETTE.bad}]},
    options:{indexAxis:"y", responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, datalabels:{anchor:"end", align:"end", formatter:v=>"$"+v.toFixed(1), font:{weight:"bold"}, color:PALETTE.ink}},
      scales:{x:{beginAtZero:true, title:{display:true, text:"Millones $"}}}}
  });
}


function renderMontoCat(d){
  const anios = unique(d.map(r=>r.anio).filter(x=>x)).sort();
  const ds = [
    {label:"Egresos", key:"egresos_no_solv", color:PALETTE.primary},
    {label:"Obra Pública", key:"obra_no_solv", color:PALETTE.warn},
    {label:"Ingresos", key:"ingresos_no_solv", color:PALETTE.good},
    {label:"Presupuestales", key:"presup_no_solv", color:PALETTE.secondary}
  ];
  destroyChart("montoCat");
  charts.montoCat = new Chart(document.getElementById("ch-monto-cat"), {
    type:"line",
    data:{labels:anios, datasets:ds.map(s=>({
      label:s.label,
      data:anios.map(a=>d.filter(r=>r.anio===a).reduce((sum,r)=>sum+r[s.key],0)/1e6),
      borderColor:s.color, backgroundColor:s.color+"55", fill:true, tension:.3
    }))},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:"bottom"}, datalabels:{display:false}},
      scales:{y:{stacked:true, beginAtZero:true, title:{display:true, text:"Millones $"}}}}
  });
}


function renderEficiencia(d){
  const muestra = d.reduce((s,r)=>s+r.muestra_total,0);
  const noSolv = d.reduce((s,r)=>s+r.egresos_no_solv+r.obra_no_solv+r.ingresos_no_solv+r.presup_no_solv,0);
  const dif = muestra - noSolv;
  document.getElementById("ef-muestra").textContent = fmtMillions(muestra);
  document.getElementById("ef-no-solv").textContent = fmtMillions(noSolv);
  document.getElementById("ef-dif").textContent = fmtMillions(dif);
  document.getElementById("ef-dif-sub").textContent = muestra>0 ? `${fmtPct(dif/muestra*100)} de la muestra fiscalizada` : "";
}


function renderRanking(searchTerm){
  let d = getFiltered();
  if(searchTerm){
    const t = searchTerm.toLowerCase();
    d = d.filter(r => (r.entidad||"").toLowerCase().includes(t) || (r.tipo||"").toLowerCase().includes(t) || (r.dictamen||"").toLowerCase().includes(t));
  }
  d.sort((a,b)=>{
    let av = a[sortKey], bv = b[sortKey];
    if(typeof av === "string") av = av.toLowerCase();
    if(typeof bv === "string") bv = bv.toLowerCase();
    if(av < bv) return sortAsc ? -1 : 1;
    if(av > bv) return sortAsc ? 1 : -1;
    return 0;
  });
  const tb = document.querySelector("#tbl-ranking tbody");
  tb.innerHTML = d.map((r,idx)=>{
    const monto = r.egresos_no_solv + r.obra_no_solv + r.ingresos_no_solv + r.presup_no_solv;
    const dictColor = r.dictamen==="Se Aprueba"?"green":r.dictamen==="No se aprueba"?"red":"gray";
    return `<tr class="row-main" data-idx="${idx}">
      <td>${r.anio}</td>
      <td>${r.entidad}</td>
      <td>${r.tipo||""}</td>
      <td><span class="badge ${dictColor}">${r.dictamen||"-"}</span></td>
      <td>${fmtPct(r.porc_final_no_solv*100)}</td>
      <td>${fmtMillions(monto)}</td>
      <td><button class="expand-btn" onclick="toggleDetail(${idx})">▸</button></td>
    </tr>
    <tr class="row-detail-row" id="detail-${idx}" style="display:none;"><td colspan="7" class="row-detail">
      <div class="grid">
        <div><b>Naturaleza:</b> ${r.naturaleza||"-"}</div>
        <div><b>Cuenta Pública:</b> ${r.cuenta_publica||"-"}</div>
        <div><b>Cumplimiento LGCG:</b> ${r.cumplimiento_lgcg||"-"}</div>
        <div><b>Obs. Fincadas:</b> ${fmtN(r.obs_fincadas)}</div>
        <div><b>Obs. Solventadas:</b> ${fmtN(r.obs_solventadas)}</div>
        <div><b>Obs. No Solventadas:</b> ${fmtN(r.obs_no_solv)}</div>
        <div><b>Total Fincado:</b> ${fmtMillions(r.egresos_fincado+r.obra_fincado+r.ingresos_fincado+r.presup_fincado)}</div>
        <div><b>Total Solventado:</b> ${fmtMillions(r.egresos_solv+r.obra_solv+r.ingresos_solv+r.presup_solv)}</div>
        <div><b>Egresos No Solv.:</b> ${fmtMillions(r.egresos_no_solv)}</div>
        <div><b>Obra No Solv.:</b> ${fmtMillions(r.obra_no_solv)}</div>
        <div><b>Ingresos No Solv.:</b> ${fmtMillions(r.ingresos_no_solv)}</div>
        <div><b>Presupuestales No Solv.:</b> ${fmtMillions(r.presup_no_solv)}</div>
        <div><b>Universo Ingresos:</b> ${fmtMillions(r.universo_ing)}</div>
        <div><b>Muestra Ingresos:</b> ${fmtMillions(r.muestra_ing)}</div>
        <div><b>Universo Egresos:</b> ${fmtMillions(r.universo_egr)}</div>
        <div><b>Muestra Egresos:</b> ${fmtMillions(r.muestra_egr)}</div>
        <div><b>Universo Obra:</b> ${fmtMillions(r.universo_obra)}</div>
        <div><b>Muestra Obra:</b> ${fmtMillions(r.muestra_obra)}</div>
      </div>
    </td></tr>`;
  }).join("");
}


function toggleDetail(idx){
  const el = document.getElementById("detail-"+idx);
  el.style.display = el.style.display==="none" ? "table-row" : "none";
}


function renderMultianual(){
  // ignora filtros - siempre muestra los 5 años completos
  const anios = unique(RAW_DATA.map(r=>r.anio).filter(x=>x)).sort();
  const auds = anios.map(a=>RAW_DATA.filter(r=>r.anio===a).length);
  const aprobs = anios.map(a=>RAW_DATA.filter(r=>r.anio===a && r.dictamen==="Se Aprueba").length);
  const pctNoSolv = anios.map(a=>{
    const sub = RAW_DATA.filter(r=>r.anio===a);
    const fin = sub.reduce((s,r)=>s+r.obs_fincadas,0);
    const ns = sub.reduce((s,r)=>s+r.obs_no_solv,0);
    return fin>0 ? ns/fin*100 : 0;
  });
  destroyChart("multi");
  charts.multi = new Chart(document.getElementById("ch-multianual"), {
    type:"line",
    data:{labels:anios, datasets:[
      {label:"# Auditorías", data:auds, borderColor:PALETTE.primary, backgroundColor:"transparent", yAxisID:"y", tension:.3, borderWidth:3, pointRadius:5},
      {label:"# Dictámenes Aprobados", data:aprobs, borderColor:PALETTE.good, backgroundColor:"transparent", yAxisID:"y", tension:.3, borderWidth:3, pointRadius:5},
      {label:"% Obs. No Solventadas", data:pctNoSolv, borderColor:PALETTE.bad, backgroundColor:"transparent", yAxisID:"y1", tension:.3, borderWidth:3, pointRadius:5, borderDash:[6,3]}
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:"bottom"}, datalabels:{display:false}},
      scales:{
        y:{beginAtZero:true, position:"left", title:{display:true, text:"Cantidad"}},
        y1:{beginAtZero:true, position:"right", max:100, grid:{drawOnChartArea:false}, title:{display:true, text:"%"}}
      }}
  });
  // Tabla
  const tb = document.querySelector("#tbl-multianual tbody");
  let prev = null;
  const rows = anios.map(a=>{
    const sub = RAW_DATA.filter(r=>r.anio===a);
    const total = sub.length;
    const aprob = sub.filter(r=>r.dictamen==="Se Aprueba").length;
    const noaprob = sub.filter(r=>r.dictamen==="No se aprueba").length;
    const denom = aprob+noaprob;
    const pctAp = denom>0 ? aprob/denom*100 : 0;
    const fin = sub.reduce((s,r)=>s+r.obs_fincadas,0);
    const ns = sub.reduce((s,r)=>s+r.obs_no_solv,0);
    const sol = sub.reduce((s,r)=>s+r.obs_solventadas,0);
    const pctSol = fin>0 ? sol/fin*100 : 0;
    const monto = sub.reduce((s,r)=>s+r.egresos_no_solv+r.obra_no_solv+r.ingresos_no_solv+r.presup_no_solv,0);
    return {a,total,aprob,pctAp,fin,ns,pctSol,monto};
  });
  tb.innerHTML = rows.map((r,i)=>{
    const arrow = (curr, prev) => {
      if(prev===null) return '<span class="arrow flat">―</span>';
      if(curr>prev) return '<span class="arrow up">▲</span>';
      if(curr<prev) return '<span class="arrow down">▼</span>';
      return '<span class="arrow flat">―</span>';
    };
    const p = i>0 ? rows[i-1] : null;
    return `<tr>
      <td><b>${r.a}</b></td>
      <td>${r.total}</td>
      <td>${arrow(r.total, p?p.total:null)}</td>
      <td>${r.aprob}</td>
      <td>${fmtPct(r.pctAp)}</td>
      <td>${arrow(r.pctAp, p?p.pctAp:null)}</td>
      <td>${fmtN(r.fin)}</td>
      <td>${fmtN(r.ns)}</td>
      <td>${fmtPct(r.pctSol)}</td>
      <td>${arrow(r.pctSol, p?p.pctSol:null)}</td>
      <td>${fmtMillions(r.monto)}</td>
    </tr>`;
  }).join("");
}


function renderAll(){
  const d = getFiltered();
  renderKPIs(d);
  renderAnioTipo(d);
  renderTopEntes(d);
  renderHeatmap(d);
  renderDictamenPie(d);
  renderDictamenAnio(d);
  renderSemaforo(d);
  renderTblNoAprobadas(d);
  renderFunnel(d);
  renderObsTipo(d);
  renderSolvTrend(d);
  renderUnivMuestra(d);
  renderCobertura(d);
  renderTopMonto(d);
  renderMontoCat(d);
  renderEficiencia(d);
  renderRanking(document.getElementById("tbl-search").value);
}

// Init movido a js/app.js

// Ajusta dinámicamente el offset de los filtros en función de la altura real del header

function setHeaderOffset(){
  const h = document.querySelector("header");
  if(h){
    document.documentElement.style.setProperty("--header-h", h.offsetHeight + "px");
  }
}
// Eventos de header movidos a js/app.js
