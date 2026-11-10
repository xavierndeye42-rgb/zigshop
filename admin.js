const cfg = window.ZIGSHOP_CONFIG || {};
const BASE = (cfg.SUPABASE_URL || "").replace(/\/$/, ""), KEY = cfg.SUPABASE_ANON_KEY || "";
const $ = id => document.getElementById(id);
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
let session = null, products = [], blob = null, editing = null, removeImg = false;
try { session = JSON.parse(localStorage.getItem("zigshop-session") || "null"); } catch (e) {}

function toast(m){const t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("show"),2800);}
const norm = d => ({access_token:d.access_token,refresh_token:d.refresh_token,expires_at:d.expires_at||Math.floor(Date.now()/1000)+d.expires_in,user:d.user});
function setSession(s){ session = s; s ? localStorage.setItem("zigshop-session", JSON.stringify(s)) : localStorage.removeItem("zigshop-session"); }
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
  const t = await token(), h = {apikey:KEY,"Content-Type":"application/json",...(opt.headers||{})};
  if (t !== KEY || KEY.startsWith("eyJ")) h.Authorization = "Bearer " + t;
  return fetch(BASE + path, {...opt, headers:h});
}
function show(id){ ["login","denied","panel"].forEach(x => $(x).hidden = x !== id); $("logout").hidden = id === "login"; }

async function init(){
  if (!BASE || !KEY) { $("denied-msg").textContent = "Base de données non configurée (voir config.js)."; return show("denied"); }
  if (!session) return show("login");
  try {
    const r = await api("/admins?select=user_id"), rows = r.ok ? await r.json() : [];
    if (!session) return show("login");
    if (!rows.length) return show("denied");
  } catch (e) { return show("denied"); }
  show("panel"); loadProducts();
}
$("login-form").addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target, b = f.querySelector("button"); b.disabled = true;
  try {
    const r = await fetch(BASE + "/auth/v1/token?grant_type=password", {method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify({email:f.email.value.trim(),password:f.password.value})});
    const d = await r.json(); if (!r.ok) throw 0;
    setSession(norm(d)); f.reset(); init();
  } catch (err) { toast("Email ou mot de passe incorrect"); }
  b.disabled = false;
});
$("logout").addEventListener("click", async () => { try { await api("/auth/v1/logout", {method:"POST"}); } catch (e) {} setSession(null); show("login"); });
document.querySelectorAll(".tabs2 button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tabs2 button").forEach(x => x.classList.toggle("on", x === b));
  $("tab-products").hidden = b.dataset.t !== "products"; $("tab-orders").hidden = b.dataset.t !== "orders";
  if (b.dataset.t === "orders") loadOrders();
}));

/* ---------- Produits ---------- */
async function loadProducts(){
  const r = await api("/products?select=*&order=id.desc");
  products = r.ok ? await r.json() : [];
  $("pcount").textContent = "(" + products.length + ")";
  $("plist").innerHTML = products.length ? products.map(p => `<div class="p ${p.active ? "" : "off"}">
    ${p.image_url ? `<img src="${esc(/^https?:/.test(p.image_url) ? p.image_url : p.image_url)}" alt="">` : '<div class="ph"></div>'}
    <div class="info"><b>${esc(p.name)}</b><br>${money(p.price_xof)} · <small>${p.category === "homme" ? "Homme" : "Femme"} · stock ${p.stock}${p.active ? "" : " · masqué"}</small></div>
    <div class="btns"><button class="mini" data-edit="${p.id}">Modifier</button><button class="mini" data-toggle="${p.id}">${p.active ? "Masquer" : "Afficher"}</button><button class="mini del" data-del="${p.id}">Supprimer</button></div></div>`).join("") : '<p style="font-size:13px;color:#8193a3">Aucun produit pour le moment.</p>';
}
function resetForm(){
  editing = null; blob = null; removeImg = false; $("pform").reset(); $("file").value = "";
  $("preview").hidden = true; $("rmimg").hidden = true; $("ptitle").textContent = "Ajouter un produit";
  $("psave").textContent = "Enregistrer le produit"; $("pcancel").hidden = true;
}
function setPreview(src){ $("preview").src = src || ""; $("preview").hidden = !src; $("rmimg").hidden = !src; }
$("pcancel").addEventListener("click", resetForm);
$("rmimg").addEventListener("click", () => { blob = null; removeImg = true; $("file").value = ""; setPreview(""); });
$("file").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  try { blob = await compress(f); removeImg = false; setPreview(URL.createObjectURL(blob)); }
  catch (err) { toast("Image illisible, essayez un autre fichier"); e.target.value = ""; }
});
function compress(file){
  return new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 1000 / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u); c.toBlob(b => b ? res(b) : rej(), "image/jpeg", .82);
    };
    img.onerror = rej; img.src = u;
  });
}
async function upload(b, name){
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "produit";
  const file = Date.now() + "-" + slug + ".jpg";
  const r = await fetch(BASE + "/storage/v1/object/products/" + file, {method:"POST",headers:{apikey:KEY,Authorization:"Bearer " + await token(),"Content-Type":"image/jpeg"},body:b});
  if (!r.ok) throw new Error("Envoi de la photo impossible");
  return BASE + "/storage/v1/object/public/products/" + file;
}
$("pform").addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target, btn = $("psave"); btn.disabled = true; btn.textContent = "Enregistrement…";
  try {
    let image_url = editing ? editing.image_url : null;
    if (removeImg) image_url = null;
    if (blob) image_url = await upload(blob, f.name.value);
    const body = {name:f.name.value.trim(),description:f.description.value.trim() || null,category:f.category.value,price_xof:parseInt(f.price.value, 10),stock:parseInt(f.stock.value, 10),active:f.active.checked,image_url};
    const r = editing ? await api("/products?id=eq." + editing.id, {method:"PATCH",body:JSON.stringify(body)}) : await api("/products", {method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(body)});
    if (!r.ok) throw new Error((await r.json()).message || "Erreur");
    toast("Produit enregistré ✓"); resetForm(); loadProducts();
  } catch (err) { toast(err.message || "Échec de l'enregistrement"); btn.textContent = editing ? "Mettre à jour" : "Enregistrer le produit"; }
  btn.disabled = false;
});
$("plist").addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.edit) {
    const p = products.find(x => x.id === Number(b.dataset.edit)), f = $("pform"); if (!p) return;
    editing = p; blob = null; removeImg = false;
    f.name.value = p.name; f.description.value = p.description || ""; f.category.value = p.category; f.price.value = p.price_xof; f.stock.value = p.stock; f.active.checked = p.active;
    setPreview(p.image_url || ""); $("ptitle").textContent = "Modifier : " + p.name; $("psave").textContent = "Mettre à jour"; $("pcancel").hidden = false;
    scrollTo({top:0,behavior:"smooth"});
  }
  if (b.dataset.toggle) {
    const p = products.find(x => x.id === Number(b.dataset.toggle));
    const r = await api("/products?id=eq." + p.id, {method:"PATCH",body:JSON.stringify({active:!p.active})});
    toast(r.ok ? (p.active ? "Produit masqué" : "Produit visible") : "Échec"); loadProducts();
  }
  if (b.dataset.del) {
    const p = products.find(x => x.id === Number(b.dataset.del));
    if (!confirm("Supprimer définitivement « " + p.name + " » ?")) return;
    const r = await api("/products?id=eq." + p.id, {method:"DELETE"});
    toast(r.ok ? "Produit supprimé" : "Impossible : déjà commandé. Utilisez « Masquer »."); loadProducts();
  }
});

/* ---------- Commandes ---------- */
const ST = {pending:"En attente",confirmed:"Confirmée",processing:"En préparation",shipped:"Expédiée",delivered:"Livrée",cancelled:"Annulée"};
const PS = {unpaid:"Non payé",pending:"Paiement en cours",paid:"Payé",failed:"Échec"};
const opts = (o, v) => Object.entries(o).map(([k, l]) => `<option value="${k}" ${k === v ? "selected" : ""}>${l}</option>`).join("");
async function loadOrders(){
  $("olist").innerHTML = '<div class="card">Chargement…</div>';
  const r = await api("/orders?select=*,order_items(product_name,qty,unit_price_xof)&order=created_at.desc&limit=100");
  const rows = r.ok ? await r.json() : [];
  $("olist").innerHTML = rows.length ? rows.map(o => `<div class="o"><div class="top"><b>#${esc(o.id.slice(0, 8).toUpperCase())}</b><span>${new Date(o.created_at).toLocaleString("fr-FR")}</span></div>
    <div>${esc(o.customer_name)} · <a href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a><br>${esc(o.delivery_address)}<br><small>Paiement choisi : ${o.payment_method === "wave" ? "Wave" : "Orange Money"}</small></div>
    <ul>${(o.order_items || []).map(i => `<li>${esc(i.product_name)} × ${i.qty} — ${money(i.unit_price_xof * i.qty)}</li>`).join("")}</ul>
    <div class="top"><b>${money(o.total_xof)}</b><span><select data-o="${o.id}" data-f="status">${opts(ST, o.status)}</select><select data-o="${o.id}" data-f="payment_status">${opts(PS, o.payment_status)}</select></span></div></div>`).join("") : '<div class="card">Aucune commande pour le moment.</div>';
}
$("olist").addEventListener("change", async e => {
  const s = e.target.closest("select"); if (!s) return;
  const r = await api("/orders?id=eq." + s.dataset.o, {method:"PATCH",body:JSON.stringify({[s.dataset.f]:s.value})});
  toast(r.ok ? "Mis à jour ✓" : "Échec de la mise à jour");
});
init();
