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
async function _tryLogin(){
  const pwd = document.getElementById("loginPwd").value;
  const errEl = document.getElementById("loginError");
  errEl.textContent = "";
  if(!pwd){ errEl.textContent = "Por favor ingresa la contraseña."; return; }
  const h = await _sha256(pwd);
  if(h === PWD_HASH){
    document.body.classList.remove("locked");
    document.getElementById("loginOverlay").style.display = "none";
    // Re-render charts después de mostrar el contenido para que tomen tamaño correcto
    setTimeout(()=>{ if(typeof charts==="object"){ Object.values(charts).forEach(c=>c && c.resize && c.resize()); } }, 50);
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
  if(inp){
    inp.addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); _tryLogin(); } });
    inp.focus();
  }
});
