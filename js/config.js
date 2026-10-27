/* ============================================================
   CONFIGURACIÓN GENERAL
============================================================ */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzVss03dOLdvACKeyzn7kJdR2xloADkEuagAmT-7QmVL3FGWLFVqtfqmsdBc6XChP6HBQ/exec";

const LOGO_URL = "assets/logo.png";

// Entes que se muestran siempre en la tarjeta "Entes auditados de manera permanente",
// aunque no cumplan la regla automática (auditados en todos los años).
// Escribe el nombre tal como aparece en la columna ENTIDAD de la hoja.
// Para quitar o agregar entes, edita esta lista.
const ENTES_PERMANENTES_MANUALES = [
  "Municipo de Loreto",
  "Municipio de Loreto"   // por si se corrige la ortografía en la hoja
];

// Entes que NO se muestran en la tarjeta "Entes auditados de manera permanente",
// aunque cumplan la regla automática (auditados en todos los años).
// Escribe el nombre tal como aparece en la columna ENTIDAD de la hoja.
const ENTES_PERMANENTES_EXCLUIDOS = [
  "Instituto Estatal Electoral de Baja California Sur"
];

// Notas que se muestran junto al nombre del ente en la tarjeta de entes permanentes.
// El ente aparece con un * y la nota debajo. Escribe el nombre tal como está en la hoja.
const ENTES_PERMANENTES_NOTAS = {
  "Municipo de Loreto": "*Excepto 2022",
  "Municipio de Loreto": "*Excepto 2022"
};
