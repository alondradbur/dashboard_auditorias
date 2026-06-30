/* ============================================================
   INICIALIZACIÓN DEL DASHBOARD
============================================================ */

function mostrarErrorCarga(mensaje) {
  const main = document.querySelector("main");

  if (!main) {
    alert(mensaje);
    return;
  }

  main.innerHTML = `
    <section class="block">
      <h2>⚠️ Error de conexión</h2>
      <p>${mensaje}</p>
      <button class="btn" onclick="location.reload()">Reintentar</button>
    </section>
  `;
}


function formatearFechaActualizacion(valor) {
  if (!valor) {
    return "--";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return String(valor);
  }

  const fechaTexto = fecha.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  const horaTexto = fecha.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit"
  });

  return `${fechaTexto} · ${horaTexto} h`;
}

function actualizarFooterMeta() {
  const footerMeta = document.getElementById("footerMeta");

  if (!footerMeta) {
    return;
  }

  footerMeta.textContent = `Sistema de Análisis de Cuenta Pública · Fuente: DASHBOARD RESUMEN DE AUDITORIAS, hoja DATOS AUDITORIAS · ${RAW_DATA.length} registros · Datos cargados desde Google Sheets · Última actualización: ${formatearFechaActualizacion(ULTIMA_ACTUALIZACION)}`;
}


function inicializarDashboardAuditorias() {
  populateFilters();
  bindFilterEvents();
  renderAll();
  renderMultianual();
  actualizarFooterMeta();

  setHeaderOffset();
  window.addEventListener("resize", setHeaderOffset);
  window.addEventListener("load", setHeaderOffset);
}

async function iniciarAplicacion() {
  try {
    const datos = await cargarDatosDesdeAppsScript();
    RAW_DATA = normalizarDatosFuente(datos);
    inicializarDashboardAuditorias();
  } catch (error) {
    console.error("Error al cargar datos:", error);
    mostrarErrorCarga("No se pudo conectar con Google Sheets. Verifica el Apps Script y que la implementación esté publicada para cualquier persona.");
  }
}

document.addEventListener("DOMContentLoaded", iniciarAplicacion);
