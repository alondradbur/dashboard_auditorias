/* ============================================================
   CARGA DE DATOS DESDE GOOGLE APPS SCRIPT
   Este módulo recibe los datos de Google Sheets y los adapta
   a los nombres que usa el dashboard.
============================================================ */

let ULTIMA_ACTUALIZACION = null;

async function cargarDatosDesdeAppsScript() {
  const respuesta = await fetch(APPS_SCRIPT_URL);

  if (!respuesta.ok) {
    throw new Error("No se pudo conectar con Google Sheets.");
  }

  const json = await respuesta.json();

  if (Array.isArray(json)) {
    ULTIMA_ACTUALIZACION = new Date().toISOString();
    return json;
  }

  if (json && Array.isArray(json.datos)) {
    ULTIMA_ACTUALIZACION = json.actualizado || new Date().toISOString();
    return json.datos;
  }

  throw new Error("La respuesta del Apps Script no contiene un arreglo de datos válido.");
}

function limpiarTexto(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function normalizarNombreCampo(texto) {
  return limpiarTexto(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function obtenerValor(registro, posiblesClaves, valorDefault = "") {
  const mapa = {};

  Object.keys(registro || {}).forEach(clave => {
    mapa[normalizarNombreCampo(clave)] = registro[clave];
  });

  for (const clave of posiblesClaves) {
    const claveNormalizada = normalizarNombreCampo(clave);

    if (Object.prototype.hasOwnProperty.call(mapa, claveNormalizada)) {
      const valor = mapa[claveNormalizada];

      if (valor !== null && valor !== undefined && valor !== "") {
        return valor;
      }
    }
  }

  return valorDefault;
}

function convertirNumero(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return 0;
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  let texto = String(valor)
    .trim()
    .replace(/\$/g, "")
    .replace(/%/g, "")
    .replace(/\s/g, "");

  if (!texto) {
    return 0;
  }

  const tieneComa = texto.includes(",");
  const tienePunto = texto.includes(".");

  if (tieneComa && tienePunto) {
    texto = texto.replace(/,/g, "");
  } else if (tieneComa && !tienePunto) {
    texto = texto.replace(/,/g, ".");
  }

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function convertirEntero(valor) {
  return Math.round(convertirNumero(valor));
}

function convertirTexto(valor) {
  const texto = limpiarTexto(valor);
  return texto === "" ? null : texto;
}

function normalizarTipoAuditoria(tipo) {
  const texto = limpiarTexto(tipo);

  if (!texto) {
    return "";
  }

  return texto
    .replace(/contable/gi, "CyGF")
    .replace(/gasto financiero/gi, "CyGF")
    .replace(/cuenta publica/gi, "CyGF")
    .replace(/obra publica/gi, "OP")
    .replace(/obra pública/gi, "OP")
    .replace(/desempeno/gi, "D")
    .replace(/desempeño/gi, "D")
    .replace(/\s+y\s+/gi, ", ")
    .replace(/;/g, ",")
    .replace(/\|/g, ",")
    .trim();
}

function separarTipos(tipo) {
  const texto = normalizarTipoAuditoria(tipo);

  if (!texto) {
    return [];
  }

  const partes = texto
    .split(",")
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => {
      const n = normalizarNombreCampo(x);

      if (n === "cygf" || n.includes("cuenta") || n.includes("financ")) {
        return "CyGF";
      }

      if (n === "op" || n.includes("obra")) {
        return "OP";
      }

      if (n === "d" || n.includes("desempeno")) {
        return "D";
      }

      return x;
    });

  return [...new Set(partes)];
}

function normalizarDatosFuente(datos) {
  return (datos || [])
    .map(registro => {
      const tipoBase = obtenerValor(registro, [
        "tipo",
        "tipo_auditoria",
        "tipo_de_auditoria",
        "tipo_de_auditoría",
        "tipos_de_auditoria",
        "tipo_de_revision",
        "tipo_de_revisión"
      ], "");

      const tipos = separarTipos(tipoBase);

      const r = {
        anio: convertirEntero(obtenerValor(registro, [
          "anio",
          "año",
          "ano",
          "ejercicio",
          "ejercicio_fiscal",
          "ejercicio fiscal"
        ], 0)),

        no: convertirEntero(obtenerValor(registro, [
          "no",
          "n",
          "numero",
          "número",
          "num",
          "consecutivo"
        ], 0)),

        entidad: convertirTexto(obtenerValor(registro, [
          "entidad",
          "ente",
          "ente_auditado",
          "ente fiscalizado",
          "ente_fiscalizado",
          "entidad_fiscalizada",
          "nombre_del_ente",
          "sujeto_fiscalizado"
        ], "")),

        naturaleza: convertirTexto(obtenerValor(registro, [
          "naturaleza",
          "naturaleza_juridica",
          "naturaleza_jurídica",
          "naturaleza jurídica",
          "clasificacion",
          "clasificación",
          "tipo_de_ente"
        ], "")),

        tipo: normalizarTipoAuditoria(tipoBase),
        tipos_split: tipos,

        cygf: convertirNumero(obtenerValor(registro, ["cygf", "c_y_gf", "cuenta_publica_y_gasto_financiero"], tipos.includes("CyGF") ? 1 : 0)),
        obra: convertirNumero(obtenerValor(registro, ["obra", "op", "obra_publica", "obra_pública", "obra0publica", "obra0pública", "obra_0_publica"], tipos.includes("OP") ? 1 : 0)),
        desempeno: convertirNumero(obtenerValor(registro, ["desempeno", "desempeño", "d"], tipos.includes("D") ? 1 : 0)),

        cuenta_publica: convertirTexto(obtenerValor(registro, [
          "cuenta_publica",
          "cuenta pública",
          "presentacion_cuenta_publica",
          "presentación cuenta pública"
        ], "")),

        dictamen: convertirTexto(obtenerValor(registro, [
          "dictamen",
          "resultado_dictamen",
          "resultado_del_dictamen",
          "estado_dictamen"
        ], "")),

        obs_fincadas: convertirNumero(obtenerValor(registro, [
          "obs_fincadas",
          "num_de_observ_fincado",
          "num_de_observaciones_fincadas",
          "numero_de_observaciones_fincadas",
          "observaciones_fincadas",
          "observaciones fincadas",
          "total_observaciones_fincadas"
        ], 0)),

        cumpl_fincado: convertirNumero(obtenerValor(registro, ["cumpl_fincado", "cumplimiento_fincado"], 0)),
        egresos_fincado: convertirNumero(obtenerValor(registro, ["egresos_fincado", "egresos_fincados"], 0)),
        obra_fincado: convertirNumero(obtenerValor(registro, ["obra_fincado", "obra_fincada", "obra_publica_fincado", "obra_pública_fincado"], 0)),
        ingresos_fincado: convertirNumero(obtenerValor(registro, ["ingresos_fincado", "ingresos_fincados"], 0)),
        presup_fincado: convertirNumero(obtenerValor(registro, ["presup_fincado", "presupuestal_fincado", "presupuestales_fincado"], 0)),
        total_fincado: convertirNumero(obtenerValor(registro, ["total_fincado", "monto_total_fincado"], 0)),

        obs_solventadas: convertirNumero(obtenerValor(registro, [
          "obs_solventadas",
          "num_de_observ_solventados",
          "num_de_observ_solventadas",
          "num_de_observaciones_solventadas",
          "numero_de_observaciones_solventadas",
          "observaciones_solventadas",
          "observaciones solventadas",
          "total_observaciones_solventadas"
        ], 0)),

        egresos_solv: convertirNumero(obtenerValor(registro, ["egresos_solv", "egresos_solventado", "egresos_solventados"], 0)),
        obra_solv: convertirNumero(obtenerValor(registro, ["obra_solv", "obra_solventada", "obra_publica_solventada", "obra_publica_solventados", "obra_pública_solventados"], 0)),
        ingresos_solv: convertirNumero(obtenerValor(registro, ["ingresos_solv", "ingresos_solventado", "ingresos_solventados"], 0)),
        presup_solv: convertirNumero(obtenerValor(registro, ["presup_solv", "presupuestal_solventado", "presupuestales_solventado"], 0)),
        total_solv: convertirNumero(obtenerValor(registro, ["total_solv", "total_solventado", "total_solventados", "monto_total_solventado"], 0)),

        obs_no_solv: convertirNumero(obtenerValor(registro, [
          "obs_no_solv",
          "num_de_observ_no_solventados",
          "num_de_observ_no_solventadas",
          "num_de_observaciones_no_solventadas",
          "numero_de_observaciones_no_solventadas",
          "observaciones_no_solventadas",
          "observaciones no solventadas",
          "obs_no_solventadas",
          "total_observaciones_no_solventadas"
        ], 0)),

        egresos_no_solv: convertirNumero(obtenerValor(registro, ["egresos_no_solv", "egresos_no_solventado", "egresos_no_solventados"], 0)),
        obra_no_solv: convertirNumero(obtenerValor(registro, ["obra_no_solv", "obra_no_solventada", "obra_publica_no_solventada", "obra_publica_no_solventados", "obra_pública_no_solventados"], 0)),
        ingresos_no_solv: convertirNumero(obtenerValor(registro, ["ingresos_no_solv", "ingresos_no_solventado", "ingresos_no_solventados"], 0)),
        presup_no_solv: convertirNumero(obtenerValor(registro, ["presup_no_solv", "presupuestal_no_solventado", "presupuestales_no_solventado", "presupuestales_no_solventados"], 0)),
        total_no_solv: convertirNumero(obtenerValor(registro, ["total_no_solv", "total_no_solventado", "total_no_solventados", "monto_total_no_solventado"], 0)),

        presup_mod_ing: convertirNumero(obtenerValor(registro, ["presup_mod_ing", "presupuesto_modificado_ingresos", "presupuesto_modificado_ing"], 0)),
        universo_ing: convertirNumero(obtenerValor(registro, ["universo_ing", "universo_ingresos", "universo_de_ingresos"], 0)),
        muestra_ing: convertirNumero(obtenerValor(registro, ["muestra_ing", "muestra_ingresos", "muestra_seleccionada_ingresos", "muestra_de_ingresos"], 0)),
        presup_mod_egr: convertirNumero(obtenerValor(registro, ["presup_mod_egr", "presupuesto_modificado_egresos", "presupuesto_modificado_egr"], 0)),
        universo_egr: convertirNumero(obtenerValor(registro, ["universo_egr", "universo_egresos", "universo_de_egresos"], 0)),
        muestra_egr: convertirNumero(obtenerValor(registro, ["muestra_egr", "muestra_egresos", "muestra_seleccionada_egresos", "muestra_de_egresos"], 0)),
        universo_obra: convertirNumero(obtenerValor(registro, ["universo_obra", "universo_obra_publica", "universo_de_obra"], 0)),
        muestra_obra: convertirNumero(obtenerValor(registro, ["muestra_obra", "muestra_obra_publica", "muestra_seleccionada_obra", "muestra_de_obra"], 0)),
        muestra_total: convertirNumero(obtenerValor(registro, ["muestra_total", "total_muestra", "muestra_total_seleccionada_por_ente"], 0)),
        dif_muestra_no_solv: convertirNumero(obtenerValor(registro, ["dif_muestra_no_solv", "diferencia_muestra_no_solventado", "dif_muestra_y_no_solv"], 0)),
        porc_final_no_solv: convertirNumero(obtenerValor(registro, ["porc_final_no_solv", "porcentaje_final_no_solventado", "porcentaje_no_solventado"], 0)),
        suma_total_presup: convertirNumero(obtenerValor(registro, ["suma_total_presup", "suma_total_presupuesto", "total_presupuesto"], 0)),

        cumplimiento_lgcg: convertirTexto(obtenerValor(registro, [
          "cumplimiento_lgcg",
          "cumplimiento_a_lgcg",
          "lgcg",
          "cumplimiento",
          "cumple_lgcg"
        ], ""))
      };

      if (!r.tipo && r.tipos_split.length) {
        r.tipo = r.tipos_split.join(", ");
      }

      if (!r.cygf && r.tipos_split.includes("CyGF")) {
        r.cygf = 1;
      }

      if (!r.obra && r.tipos_split.includes("OP")) {
        r.obra = 1;
      }

      if (!r.desempeno && r.tipos_split.includes("D")) {
        r.desempeno = 1;
      }

      if (!r.total_fincado) {
        r.total_fincado = r.egresos_fincado + r.obra_fincado + r.ingresos_fincado + r.presup_fincado;
      }

      if (!r.total_solv) {
        r.total_solv = r.egresos_solv + r.obra_solv + r.ingresos_solv + r.presup_solv;
      }

      if (!r.total_no_solv) {
        r.total_no_solv = r.egresos_no_solv + r.obra_no_solv + r.ingresos_no_solv + r.presup_no_solv;
      }

      if (r.entidad === "Municipo de Loreto") {
        r.entidad = "Municipio de Loreto";
      }

      if (!r.dictamen) {
        r.dictamen = null;
      } else {
        const dictamenNormalizado = normalizarNombreCampo(r.dictamen);

        if (dictamenNormalizado.includes("no") && (dictamenNormalizado.includes("aprueba") || dictamenNormalizado.includes("aprobado"))) {
          r.dictamen = "No se aprueba";
        } else if (dictamenNormalizado.includes("aprueba") || dictamenNormalizado.includes("aprobado")) {
          r.dictamen = "Se Aprueba";
        }
      }

      if (!r.cuenta_publica) {
        r.cuenta_publica = null;
      }

      if (!r.cumplimiento_lgcg) {
        r.cumplimiento_lgcg = null;
      }

      return r;
    })
    .filter(r => r.anio || r.entidad);
}
