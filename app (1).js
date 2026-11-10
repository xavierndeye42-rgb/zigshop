const cfg = window.ZIGSHOP_CONFIG || {};
const cleanUrl = u => { u = String(u || "").trim(); if (!u) return ""; if (!/^https?:\/\//i.test(u)) u = "https://" + u; try { return new URL(u).origin; } catch (e) { return ""; } };
const BASE = cleanUrl(cfg.SUPABASE_URL), KEY = String(cfg.SUPABASE_ANON_KEY || "").trim(), ON = !!(BASE && KEY);
const demo = [
  {id:1,name:"Chemise classique",category:"homme",price_xof:12500,tone:"#9db4c8"},{id:2,name:"Sneakers urbaines",category:"homme",price_xof:22000,tone:"#c5d0d9"},
  {id:3,name:"Robe élégante",category:"femme",price_xof:18500,tone:"#b7c4d0"},{id:4,name:"Sac du quotidien",category:"femme",price_xof:16000,tone:"#d1c9c4"},
  {id:5,name:"Polo essentiel",category:"homme",price_xof:9500,tone:"#9eafbc"},{id:6,name:"Chaussures chic",category:"femme",price_xof:24000,tone:"#c2b8b4"}];
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const grid = $("product-grid"), overlay = $("cart-overlay"), modal = $("modal"), box = $("modal-box");
let products = [], filter = "tous", cart = [], session = null, profile = {}, intent = null;
try { cart = JSON.parse(localStorage.getItem("zigshop-cart") || "[]"); session = JSON.parse(localStorage.getItem("zigshop-session") || "null"); } catch (e) {}

function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("show"),2600);}

/* ---------- Session & API (Supabase Auth + REST) ---------- */
const norm = d => ({access_token:d.access_token,refresh_token:d.refresh_token,expires_at:d.expires_at||Math.floor(Date.now()/1000)+d.expires_in,user:d.user});
function setSession(s){ session = s; s ? localStorage.setItem("zigshop-session", JSON.stringify(s)) : localStorage.removeItem("zigshop-session"); label(); }
async function token(){
  if (!session) return KEY;
  if (session.expires_at * 1000 - Date.now() < 60000) {
    try {
      const r = await fetch(BASE + "/auth/v1/token?grant_type=refresh_token", {method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token})});
      if (!r.ok) throw 0; setSession(norm(await r.json()));
    } catch (e) { setSession(null); return KEY; }
  }
  return session.access_token;
}
async function api(path, opt = {}){
  const t = await token();
  const h = {apikey:KEY,"Content-Type":"application/json",...(opt.headers||{})};
  if (t !== KEY || KEY.startsWith("eyJ")) h.Authorization = "Bearer " + t; // compatible clés « anon » (JWT) et « publishable »
  return fetch(BASE + path, {...opt, headers:h});
}
async function authCall(url, body){
  let r, d;
  try { r = await fetch(BASE + url, {method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify(body)}); d = await r.json(); }
  catch (e) { throw new Error("Connexion à la base impossible, vérifiez config.js"); }
  if (!r.ok) {
    const m = String(d.msg || d.error_description || d.message || d.error || "");
    throw new Error(/invalid login/i.test(m) ? "Email ou mot de passe incorrect"
      : /already|registered/i.test(m) ? "Un compte existe déjà avec cet email"
      : /rate limit|too many|seconds/i.test(m) ? "Trop de demandes ou limite d'emails atteinte, réessayez plus tard"
      : /not allowed|disabled/i.test(m) ? "Les inscriptions sont désactivées dans Supabase"
      : /database error/i.test(m) ? "Erreur de base de données : réexécutez schema.sql dans Supabase"
      : /api key|apikey|jwt/i.test(m) ? "Clé API invalide, vérifiez config.js"
      : /email not confirmed/i.test(m) ? "Confirmez d'abord votre email"
      : /password/i.test(m) ? "Mot de passe refusé (6 caractères minimum)"
      : "Erreur : " + (m.slice(0, 90) || r.status));
  }
  return d;
}
function label(){ $("account-label").textContent = session ? ((profile.full_name || session.user.email || "").split(" ")[0].slice(0, 12) || "Mon compte") : "Se connecter"; }

/* ---------- Produits ---------- */
async function loadProducts(){
  grid.innerHTML = Array(4).fill('<div class="product-card skeleton"></div>').join("");
  if (ON) {
    try { const r = await api("/products?select=id,name,category,price_xof,image_url,stock,tone&active=eq.true&order=id"); if (!r.ok) throw 0; products = await r.json(); }
    catch (e) { products = demo; toast("Catalogue en mode démonstration"); }
  } else products = demo;
  cart = cart.filter(c => products.some(p => p.id === c.id));
  renderProducts(); renderCart();
}
function renderProducts(){
  const list = products.filter(p => filter === "tous" || p.category === filter);
  if (!list.length) { grid.innerHTML = '<p class="empty-cart">Aucun article pour le moment.</p>'; return; }
  grid.innerHTML = list.map(p => {
    const out = p.stock !== undefined && p.stock <= 0;
    const bg = p.image_url ? `background:url('${esc(encodeURI(p.image_url))}') center/cover` : `background:${esc(p.tone || "#c5d0d9")}`;
    return `<article class="product-card"><div class="product-visual ${p.image_url ? "has-img" : ""}" style="${bg}"><span>${p.category === "homme" ? "HOMME" : "FEMME"}</span>${out ? '<em class="badge">Épuisé</em>' : ""}</div>
      <div class="product-info"><small>${p.category === "homme" ? "Collection homme" : "Collection femme"}</small><h3>${esc(p.name)}</h3>
      <div class="product-meta"><strong>${money(p.price_xof)}</strong><button class="add-button" data-add="${p.id}" ${out ? "disabled" : ""}>${out ? "Indisponible" : "Ajouter +"}</button></div></div></article>`;
  }).join("");
}

/* ---------- Panier (invité → local ; connecté → synchronisé en base) ---------- */
let st;
function sync(){
  if (!session) return; clearTimeout(st);
  st = setTimeout(() => api("/carts?on_conflict=user_id", {method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({user_id:session.user.id,items:cart,updated_at:new Date().toISOString()})}).catch(() => {}), 600);
}
function renderCart(){
  const lines = cart.map(c => ({...products.find(p => p.id === c.id), qty: c.qty})).filter(x => x.id);
  $("cart-count").textContent = lines.reduce((n, x) => n + x.qty, 0);
  $("cart-total").textContent = money(lines.reduce((n, x) => n + x.price_xof * x.qty, 0));
  $("cart-items").innerHTML = lines.length ? lines.map(x => `<div class="cart-row"><span>${esc(x.name)}<br><b>${money(x.price_xof * x.qty)}</b></span>
    <div class="qty"><button data-dec="${x.id}" aria-label="Moins">−</button><i>${x.qty}</i><button data-inc="${x.id}" aria-label="Plus">+</button></div></div>`).join("") : '<p class="empty-cart">Votre panier est vide pour le moment.</p>';
  $("checkout-button").disabled = !lines.length;
  localStorage.setItem("zigshop-cart", JSON.stringify(cart)); sync();
}
function change(id, d){ const c = cart.find(x => x.id === id); if (!c) return; c.qty = Math.min(20, c.qty + d); if (c.qty <= 0) cart = cart.filter(x => x.id !== id); renderCart(); }
async function afterLogin(merge){
  try {
    const [c, p] = await Promise.all([api("/carts?select=items&user_id=eq." + session.user.id), api("/profiles?select=full_name,phone,address&id=eq." + session.user.id)]);
    profile = (await p.json())[0] || {};
    const remote = (await c.json())[0]?.items || [];
    if (merge || !cart.length) for (const it of remote) { const f = cart.find(x => x.id === it.id); f ? f.qty = Math.min(20, f.qty + it.qty) : cart.push({id: it.id, qty: it.qty}); }
  } catch (e) {}
  cart = cart.filter(c => products.some(p => p.id === c.id)); label(); renderCart();
}

grid.addEventListener("click", e => {
  const b = e.target.closest("[data-add]"); if (!b) return;
  const id = Number(b.dataset.add), f = cart.find(x => x.id === id);
  f ? f.qty = Math.min(20, f.qty + 1) : cart.push({id, qty: 1});
  renderCart(); toast("Ajouté au panier ✓");
  b.classList.add("done"); b.textContent = "Ajouté ✓"; setTimeout(() => { b.classList.remove("done"); b.textContent = "Ajouter +"; }, 1200);
});
$("cart-items").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.inc) change(Number(b.dataset.inc), 1); if (b.dataset.dec) change(Number(b.dataset.dec), -1); });
document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => { document.querySelectorAll(".filter").forEach(x => x.classList.remove("active")); btn.classList.add("active"); filter = btn.dataset.filter; renderProducts(); }));
const openCart = () => { overlay.classList.add("open"); document.body.classList.add("lock"); };
const closeCart = () => { overlay.classList.remove("open"); document.body.classList.remove("lock"); };
$("cart-toggle").addEventListener("click", openCart);
$("cart-close").addEventListener("click", closeCart);
overlay.addEventListener("click", e => { if (e.target === overlay) closeCart(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeCart(); closeModal(); } });
window.addEventListener("scroll", () => document.querySelector(".site-header").classList.toggle("scrolled", scrollY > 10));

/* ---------- Fenêtres compte ---------- */
const closeModal = () => { modal.classList.remove("open"); };
modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("[data-close]")) closeModal(); });
function openAuth(mode = "login", why = ""){
  const up = mode === "signup";
  box.innerHTML = `<button class="x" data-close aria-label="Fermer">✕</button><h2>${up ? "Créer mon compte" : "Connexion"}</h2>
    ${why ? `<p class="hint">${esc(why)}</p>` : ""}
    <div class="tabs"><button data-tab="login" class="${up ? "" : "on"}">Connexion</button><button data-tab="signup" class="${up ? "on" : ""}">Inscription</button></div>
    <form id="auth-form">${up ? '<input name="full_name" placeholder="Nom complet" required minlength="2" maxlength="100" autocomplete="name"><input name="phone" type="tel" placeholder="Téléphone" required minlength="8" maxlength="20" autocomplete="tel">' : ""}
    <input name="email" type="email" placeholder="Email" required autocomplete="email"><input name="password" type="password" placeholder="Mot de passe (6 caractères min.)" required minlength="6" autocomplete="${up ? "new-password" : "current-password"}">
    <button class="primary-button checkout-button" type="submit">${up ? "Créer mon compte" : "Me connecter"}</button></form>`;
  modal.classList.add("open");
  box.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => openAuth(b.dataset.tab, why));
  $("auth-form").onsubmit = async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector("button"); btn.disabled = true;
    try {
      const em = f.email.value.trim(), pw = f.password.value; let d;
      if (up) { d = await authCall("/auth/v1/signup", {email: em, password: pw, data: {full_name: f.full_name.value.trim(), phone: f.phone.value.trim()}}); if (!d.access_token) { box.innerHTML = '<button class="x" data-close>✕</button><div class="success"><div class="check">✉</div><h3>Vérifiez votre email</h3><p>Cliquez sur le lien de confirmation reçu, puis connectez-vous. Votre panier est conservé.</p></div>'; return; } }
      else d = await authCall("/auth/v1/token?grant_type=password", {email: em, password: pw});
      setSession(norm(d)); await afterLogin(true); closeModal(); toast("Bienvenue ✓");
      if (intent === "checkout") { intent = null; startCheckout(); }
    } catch (err) { toast(err.message); btn.disabled = false; }
  };
}
const STATUS = {pending:"En attente",confirmed:"Confirmée",processing:"En préparation",shipped:"Expédiée",delivered:"Livrée",cancelled:"Annulée"};
async function openAccount(){
  box.innerHTML = `<button class="x" data-close aria-label="Fermer">✕</button><h2>Mon compte</h2><p class="hint">${esc(profile.full_name || "")}<br>${esc(session.user.email)}</p><h3 class="sub">Mes commandes</h3><div id="orders" class="orders"><p class="empty-cart">Chargement…</p></div><button class="ghost-button" id="logout">Se déconnecter</button>`;
  modal.classList.add("open");
  $("logout").onclick = async () => { try { await api("/auth/v1/logout".replace("/auth", "/auth"), {method:"POST"}); } catch (e) {} setSession(null); profile = {}; closeModal(); toast("Déconnecté"); };
  try {
    const r = await api("/orders?select=id,total_xof,status,created_at&order=created_at.desc&limit=10"), rows = await r.json();
    $("orders").innerHTML = rows.length ? rows.map(o => `<div class="order"><span><b>#${esc(o.id.slice(0, 8).toUpperCase())}</b><br><small>${new Date(o.created_at).toLocaleDateString("fr-FR")}</small></span><span>${money(o.total_xof)}<br><small class="st">${STATUS[o.status] || o.status}</small></span></div>`).join("") : '<p class="empty-cart">Aucune commande pour le moment.</p>';
  } catch (e) { $("orders").innerHTML = '<p class="empty-cart">Impossible de charger vos commandes.</p>'; }
}
$("account-toggle").addEventListener("click", () => { if (!ON) return toast("Base de données non configurée (voir README)"); session ? openAccount() : openAuth("login"); });

/* ---------- Commande (compte obligatoire) ---------- */
function startCheckout(){
  const f = $("checkout-form"); openCart();
  f.name.value = profile.full_name || ""; f.phone.value = profile.phone || ""; f.address.value = profile.address || "";
  f.hidden = false; $("checkout-button").hidden = true; (f.address.value ? f.querySelector("button") : f.address).focus();
}
$("checkout-button").addEventListener("click", () => {
  if (!ON) return toast("Base de données non configurée (voir README)");
  if (!session) { intent = "checkout"; closeCart(); return openAuth("signup", "Créez un compte (ou connectez-vous) pour valider votre commande. Votre panier est conservé."); }
  startCheckout();
});
$("checkout-form").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, btn = $("submit-order"); btn.disabled = true; btn.textContent = "Envoi…";
  try {
    const r = await api("/rpc/create_order", {method:"POST",body:JSON.stringify({p_name:f.name.value.trim(),p_phone:f.phone.value.trim(),p_address:f.address.value.trim(),p_method:f.method.value,p_items:cart.map(c => ({product_id:c.id,qty:c.qty}))})});
    const data = await r.json(); if (!r.ok) throw new Error(data.message || "Erreur");
    api("/profiles?id=eq." + session.user.id, {method:"PATCH",body:JSON.stringify({phone:f.phone.value.trim(),address:f.address.value.trim()})}).catch(() => {});
    profile.phone = f.phone.value.trim(); profile.address = f.address.value.trim();
    cart = []; renderCart(); f.hidden = true; $("checkout-button").hidden = false;
    $("cart-items").innerHTML = `<div class="success"><div class="check">✓</div><h3>Commande enregistrée</h3><p>Référence <b>${esc(String(data).slice(0, 8).toUpperCase())}</b></p><p>Retrouvez-la dans « Mon compte ». Nous vous contactons très vite pour confirmer la livraison et le paiement.</p></div>`;
    loadProducts();
  } catch (err) { toast(/stock/.test(err.message) ? "Stock insuffisant pour un article" : /connexion/i.test(err.message) ? "Session expirée, reconnectez-vous" : "Échec de l'envoi, réessayez"); }
  btn.disabled = false; btn.textContent = "Envoyer ma commande";
});

label();
loadProducts().then(() => { if (ON && session) afterLogin(false); });

/* ---------- Photos du site : hero / homme / femme (.jpg .jpeg .png .webp, dossier images ou image) ---------- */
const tryImg = (el, list, i = 0) => {
  if (!el || i >= list.length) return;
  const img = new Image();
  img.onload = () => { el.style.backgroundImage = `url('${list[i]}')`; el.classList.add("has-photo"); };
  img.onerror = () => tryImg(el, list, i + 1);
  img.src = list[i]; // si aucun fichier n'existe, le design par défaut reste affiché
};
const candidates = n => ["images", "image"].flatMap(d => ["jpg", "jpeg", "png", "webp"].map(e => `${d}/${n}.${e}`));
[[".hero-art", "hero"], [".category-men", "homme"], [".category-women", "femme"]].forEach(([sel, n]) => tryImg(document.querySelector(sel), candidates(n)));
