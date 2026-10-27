/* ============================================================
   AUTENTICACIÓN / LOGIN
============================================================ */
// Pantalla de login - SHA-256 de la contraseña institucional
const PWD_HASH = "56e3e01ec8cec83251ac303f64ff4d203dabbd13b13e6ab4703b544dcc3ff978";
async function _sha256(text){
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
// La sesión se guarda en sessionStorage: sobrevive a "Actualizar datos" / recargas
// y se borra sola al cerrar la pestaña o el navegador.
const SESSION_KEY = "uec_dashboard_sesion";
function _sesionActiva(){
  try { return sessionStorage.getItem(SESSION_KEY) === PWD_HASH; } catch(e){ return false; }
}
function _guardarSesion(){
  try { sessionStorage.setItem(SESSION_KEY, PWD_HASH); } catch(e){}
}
function _desbloquear(){
  document.body.classList.remove("locked");
  const ov = document.getElementById("loginOverlay");
  if(ov) ov.style.display = "none";
  setTimeout(()=>{ if(typeof charts==="object"){ Object.values(charts).forEach(c=>c && c.resize && c.resize()); } }, 50);
}
// Se desbloquea de inmediato (el script va al final del body) para evitar el parpadeo del login
if(_sesionActiva()){ document.body.classList.remove("locked"); }
async function _tryLogin(){
  const pwd = document.getElementById("loginPwd").value;
  const errEl = document.getElementById("loginError");
  errEl.textContent = "";
  if(!pwd){ errEl.textContent = "Por favor ingresa la contraseña."; return; }
  const h = await _sha256(pwd);
  if(h === PWD_HASH){
    _guardarSesion();
    _desbloquear();
  } else {
    errEl.textContent = "Contraseña incorrecta. Intenta de nuevo.";
    document.getElementById("loginPwd").value = "";
    document.getElementById("loginPwd").focus();
  }
}
document.addEventListener("DOMContentLoaded", ()=>{
  const btn = document.getElementById("loginBtn");
  const inp = document.getElementById("loginPwd");
  if(btn) btn.addEventListener("click", _tryLogin);
  if(_sesionActiva()){ _desbloquear(); return; }
  if(inp){
    inp.addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); _tryLogin(); } });
    inp.focus();
  }
});
