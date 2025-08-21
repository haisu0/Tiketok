export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
    if (url.pathname === "/api") return handleApi(url.searchParams.get("url"));
    return serveWebUI();
  },
};

// ---------- API ----------
function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra,
  };
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders({ "Content-Type": "application/json; charset=utf-8", ...headers }),
  });
}

async function handleApi(tiktokUrl) {
  if (!tiktokUrl) {
    return json({ status: false, developer: "@Al_Azet", message: "Parameter url wajib diisi" }, 400);
  }
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}&hd=1`;
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json, text/javascript, */*;q=0.1",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": "https://www.tikwm.com",
        "Referer": "https://www.tikwm.com/",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!resp.ok) {
      return json(
        { status: false, developer: "@Al_Azet", message: `Gagal menghubungi layanan upstream (HTTP ${resp.status})` },
        resp.status
      );
    }

    const payload = await resp.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return json({ status: false, developer: "@Al_Azet", message: "Respons upstream tidak valid" }, 502);
    }
    if (payload.code && payload.code !== 0) {
      return json(
        {
          status: false,
          developer: "@Al_Azet",
          message: payload.msg || "Upstream mengembalikan error",
          upstream: payload,
        },
        502
      );
    }

    const r = payload.data || {};
    const video = { jumlah: 0, watermark: null, nowatermark: null, nowatermark_hd: null };
    const foto = { jumlah: 0, links: [] };

    if (!r.size && !r.wm_size && !r.hd_size) {
      foto.jumlah = Array.isArray(r.images) ? r.images.length : 0;
      foto.links = Array.isArray(r.images) ? r.images : [];
    } else {
      let count = 0;
      if (r.wmplay) { video.watermark = r.wmplay; count++; }
      if (r.play) { video.nowatermark = r.play; count++; }
      if (r.hdplay) { video.nowatermark_hd = r.hdplay; count++; }
      video.jumlah = count;
    }

    return json({
      status: true,
      developer: "@Al_Azet",
      result: { video, foto, ...r },
    });
  } catch (e) {
    return json(
      { status: false, developer: "@Al_Azet", message: "Gagal memproses permintaan", error: String(e?.message || e) },
      500
    );
  }
}

// ---------- WEB UI ----------
function serveWebUI() {
  const html =
'<!DOCTYPE html>\n' +
'<html lang="id" data-theme="">\n' +
'<head>\n' +
'  <meta charset="utf-8" />\n' +
'  <meta name="viewport" content="width=device-width,initial-scale=1" />\n' +
'  <meta name="color-scheme" content="light dark" />\n' +
'  <title>TikTok Downloader — @Al_Azet</title>\n' +
'  <style>\n' +
'    :root { --bg:#ffffff; --fg:#0f172a; --muted:#475569; --accent:#2563eb; --accent2:#1d4ed8; --card:#f8fafc; --border:#e2e8f0; --ok:#10b981; --warn:#ef4444; --shadow:0 6px 18px rgba(0,0,0,.08); }\n' +
'    [data-theme="dark"] { --bg:#0b1220; --fg:#e5eefb; --muted:#a3b2c7; --accent:#38bdf8; --accent2:#22d3ee; --card:#121a2b; --border:#22304a; --ok:#34d399; --warn:#f87171; --shadow:0 8px 20px rgba(0,0,0,.35); }\n' +
'    *{box-sizing:border-box}\n' +
'    body{background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,Segoe UI,Inter,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:24px;line-height:1.6;transition:background .3s,color .3s}\n' +
'    .container{max-width:1100px;margin:0 auto}\n' +
'    header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}\n' +
'    .brand{display:flex;align-items:center;gap:10px}\n' +
'    .logo{width:40px;height:40px;border-radius:10px;background:radial-gradient(120% 120% at 30% 20%, var(--accent) 0%, #8b5cf6 60%, #ef4444 100%);box-shadow:var(--shadow)}\n' +
'    h1{font-size:22px;margin:0}\n' +
'    .muted{color:var(--muted)}\n' +
'    .toolbar{display:flex;gap:10px;align-items:center}\n' +
'    .toggle,.btn{appearance:none;border:1px solid var(--border);background:var(--card);color:var(--fg);padding:10px 12px;border-radius:10px;cursor:pointer;transition:transform .08s,background .2s,border-color .2s}\n' +
'    .btn.primary{background:linear-gradient(180deg,var(--accent),var(--accent2));color:#fff;border:none;box-shadow:var(--shadow)}\n' +
'    .btn:active,.toggle:active{transform:scale(.98)}\n' +
'    .search{display:grid;grid-template-columns:1fr auto;gap:10px;margin-bottom:16px}\n' +
'    input[type="url"]{width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--fg);outline:none}\n' +
'    input[type="url"]:focus{border-color:var(--accent)}\n' +
'    .cards{display:grid;gap:16px;grid-template-columns:1fr}\n' +
'    .card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;box-shadow:var(--shadow);animation:fadeIn .35s ease both}\n' +
'    .profile{display:grid;gap:16px;grid-template-columns:80px 1fr;align-items:center}\n' +
'    .avatar{width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid var(--border)}\n' +
'    .chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}\n' +
'    .chip{background:transparent;border:1px solid var(--border);color:var(--fg);padding:6px 10px;border-radius:999px;font-size:13px}\n' +
'    .photo-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}\n' +
'    @media(max-width:420px){.photo-grid{grid-template-columns:1fr}.profile{grid-template-columns:1fr;justify-items:center;text-align:center}}\n' +
'    .media-card{display:flex;flex-direction:column;gap:8px;align-items:center;background:rgba(0,0,0,0.02);padding:12px;border-radius:12px;border:1px dashed var(--border)}\n' +
'    .media{max-width:100%;width:100%;border-radius:10px;background:#000}\n' +
'    .controls{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}\n' +
'    .controls .btn{border-radius:999px}\n' +
'    .pill{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;font-size:12px;background:rgba(16,185,129,.12);color:var(--ok);border:1px solid rgba(16,185,129,.3)}\n' +
'    .warn{background:rgba(239,68,68,.12);color:var(--warn);border-color:rgba(239,68,68,.3)}\n' +
'    .json{overflow:auto;max-height:420px;background:rgba(0,0,0,.05);padding:12px;border-radius:10px;border:1px solid var(--border)}\n' +
'    details summary{cursor:pointer;margin-bottom:8px}\n' +
'    .hr{height:1px;background:var(--border);margin:14px 0}\n' +
'    @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}\n' +
'    .spin{animation:spin 1s linear infinite}\n' +
'    @keyframes spin{to{transform:rotate(360deg)}}\n' +
'    a.link{color:var(--accent);text-decoration:none}\n' +
'    a.link:hover{text-decoration:underline}\n' +
'  </style>\n' +
'</head>\n' +
'<body>\n' +
'  <div class="container">\n' +
'    <header>\n' +
'      <div class="brand"><div class="logo"></div><div><h1>TikTok Downloader</h1><div class="muted">Developer: @Al_Azet</div></div></div>\n' +
'      <div class="toolbar"><button class="toggle" id="themeToggle" aria-label="Toggle tema">🌙</button><a class="btn" href="#" id="exampleBtn" title="Contoh URL">Contoh URL</a></div>\n' +
'    </header>\n' +
'    <section class="search">\n' +
'      <input type="url" id="inputUrl" placeholder="Tempel URL TikTok di sini (video atau foto)..." />\n' +
'      <button class="btn primary" id="goBtn"><span id="goIcon">🔎</span> <span id="goText">Ambil Data</span></button>\n' +
'    </section>\n' +
'    <div id="notice" class="muted" style="margin-bottom:10px;">Gunakan URL publik dari TikTok. Hasil akan menampilkan semua data, foto, video, audio, serta info author.</div>\n' +
'    <div id="results" class="cards"></div>\n' +
'  </div>\n' +
'\n' +
'<script>\n' +
'  // Tema\n' +
'  const themeKey = "ttdl-theme";\n' +
'  const rootEl = document.documentElement;\n' +
'  const savedTheme = localStorage.getItem(themeKey);\n' +
'  if (savedTheme) { if (savedTheme) rootEl.setAttribute("data-theme", savedTheme); }\n' +
'  document.getElementById("themeToggle").addEventListener("click", function(){\n' +
'    const next = rootEl.getAttribute("data-theme") === "dark" ? "" : "dark";\n' +
'    if (next) rootEl.setAttribute("data-theme", next); else rootEl.removeAttribute("data-theme");\n' +
'    localStorage.setItem(themeKey, next);\n' +
'  });\n' +
'\n' +
'  // Helpers\n' +
'  function $(s, el){ return (el||document).querySelector(s); }\n' +
'  function fmt(n){ return isFinite(n) ? Number(n).toLocaleString("id-ID") : "-"; }\n' +
'  function fmtDate(sec){ if(!sec) return "-"; try{return new Date(Number(sec)*1000).toLocaleString("id-ID");}catch{return "-";} }\n' +
'  function makeLink(href,text){ return href ? \'<a class="link" target="_blank" rel="noopener" href="\'+href+\'">\'+(text||href)+\'</a>\' : "-"; }\n' +
'  function buildProfileUrl(author){ return author && author.unique_id ? ("https://www.tiktok.com/@"+author.unique_id) : (author && author.url || ""); }\n' +
'  function escapeHtml(s){ return String(s==null?"":s).replace(/[&<>\"\\\']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\'":"&#39;"}[c] || c; }); }\n' +
'\n' +
'  // Example URL\n' +
'  document.getElementById("exampleBtn").addEventListener("click", function(e){ e.preventDefault(); $("#inputUrl").value = "https://www.tiktok.com/@scout2015/video/6718335390845095173"; });\n' +
'\n' +
'  // Fetch & render\n' +
'  const goBtn = document.getElementById("goBtn");\n' +
'  goBtn.addEventListener("click", fetchAndRender);\n' +
'  document.getElementById("inputUrl").addEventListener("keydown", function(e){ if(e.key==="Enter"){ e.preventDefault(); fetchAndRender(); }});\n' +
'\n' +
'  async function fetchAndRender(){\n' +
'    const url = $("#inputUrl").value.trim();\n' +
'    const results = $("#results");\n' +
'    if(!url){ results.innerHTML = \'<div class="card warn">URL tidak boleh kosong.</div>\'; return; }\n' +
'    $("#goText").textContent = "Memproses..."; $("#goIcon").textContent = ""; $("#goIcon").classList.add("spin"); goBtn.disabled = true;\n' +
'    try{\n' +
'      const res = await fetch("/api?url=" + encodeURIComponent(url));\n' +
'      const j = await res.json();\n' +
'      if(!j.status){ results.innerHTML = \'<div class="card warn"><strong>Gagal:</strong> \'+(j.message||"")+\'.</div>\'; return; }\n' +
'      renderResults(j.result);\n' +
'    }catch(e){ results.innerHTML = \'<div class="card warn"><strong>Kesalahan:</strong> \'+(e && e.message || e)+\'</div>\'; }\n' +
'    finally{ $("#goText").textContent = "Ambil Data"; $("#goIcon").textContent = "🔎"; $("#goIcon").classList.remove("spin"); goBtn.disabled = false; }\n' +
'  }\n' +
'\n' +
'  function renderResults(r){\n' +
'    const results = $("#results");\n' +
'    results.innerHTML = "";\n' +
'\n' +
'    // Card Author & Post\n' +
'    const authorUrl = buildProfileUrl(r.author);\n' +
'    const card1 = document.createElement("div"); card1.className = "card";\n' +
'    card1.innerHTML = \n' +
'      \'<div class="profile">\' +\n' +
'        \'<img class="avatar" src="\'+(r.author && r.author.avatar || "")+\'" alt="Avatar">\' +\n' +
'        \'<div>\' +\n' +
'          \'<h2 style="margin:0 0 6px 0;">\'+escapeHtml(r.title || "(Tanpa Judul)")+\'</h2>\' +\n' +
'          \'<div class="muted"><strong>\'+escapeHtml(r.author && r.author.nickname || "-")+\'</strong> @\'+escapeHtml(r.author && r.author.unique_id || "-")+\'</div>\' +\n' +
'          \'<div class="chips">\' +\n' +
'            \'<span class="chip">Region: \'+escapeHtml(r.region || "-")+\'</span>\' +\n' +
'            \'<span class="chip">Durasi: \'+escapeHtml(r.duration)+\'s</span>\' +\n' +
'            \'<span class="chip">Dibuat: \'+escapeHtml(fmtDate(r.create_time))+\'</span>\' +\n' +
'            (r.cover? \'<span class="chip">Ada cover</span>\' : \'\') +\n' +
'          \'</div>\' +\n' +
'          \'<div style="margin-top:10px;">\'+(authorUrl ? makeLink(authorUrl, "Buka profil TikTok ↗") : \'<span class="muted">Profil tidak tersedia</span>\')+\n' +
'          \'</div>\' +\n' +
'        \'</div>\' +\n' +
'      \'</div>\' +\n' +
'      \'<div class="hr"></div>\' +\n' +
'      \'<div class="chips">\' +\n' +
'        \'<span class="chip">Views: \'+fmt(r.play_count ?? (r.stats && r.stats.play_count))+\'</span>\' +\n' +
'        \'<span class="chip">Likes: \'+fmt(r.digg_count ?? (r.stats && r.stats.digg_count))+\'</span>\' +\n' +
'        \'<span class="chip">Comments: \'+fmt(r.comment_count ?? (r.stats && r.stats.comment_count))+\'</span>\' +\n' +
'        \'<span class="chip">Shares: \'+fmt(r.share_count ?? (r.stats && r.stats.share_count))+\'</span>\' +\n' +
'        \'<span class="chip">Downloads: \'+fmt(r.download_count ?? (r.stats && r.stats.download_count))+\'</span>\' +\n' +
'      \'</div>\';\n' +
'    results.appendChild(card1);\n' +
'\n' +
'    // Card Foto (grid 2 kolom)\n' +
'    var photoLinks = (r.foto && Array.isArray(r.foto.links)) ? r.foto.links : [];\n' +
'    if ((r.foto && r.foto.jumlah > 0) && photoLinks.length > 0){\n' +
'      const card = document.createElement("div"); card.className = "card";\n' +
'      const title = document.createElement("h3"); title.textContent = "Foto ("+photoLinks.length+")"; title.style.marginTop = "0";\n' +
'      const grid = document.createElement("div"); grid.className = "photo-grid";\n' +
'      photoLinks.forEach(function(link, i){\n' +
'        const cell = document.createElement("div"); cell.className = "media-card";\n' +
'        const img = document.createElement("img"); img.className = "media"; img.loading = "lazy"; img.src = link; img.alt = "Foto "+(i+1);\n' +
'        const ctr = document.createElement("div"); ctr.className = "controls";\n' +
'        const a = document.createElement("a"); a.className = "btn"; a.href = link; a.download = ""; a.textContent = "⬇️ Download Foto";\n' +
'        const b = document.createElement("button"); b.className = "btn"; b.textContent = "🔗 Salin Link"; b.addEventListener("click", function(){ copyText(link); });\n' +
'        ctr.appendChild(a); ctr.appendChild(b);\n' +
'        cell.appendChild(img); cell.appendChild(ctr); grid.appendChild(cell);\n' +
'      });\n' +
'      card.appendChild(title); card.appendChild(grid); results.appendChild(card);\n' +
'    }\n' +
'\n' +
'    // Card Video (semua varian)\n' +
'    var videoEntries = [];\n' +
'    if (r.video && r.video.watermark) videoEntries.push(["Watermark", r.video.watermark]);\n' +
'    if (r.video && r.video.nowatermark) videoEntries.push(["Tanpa Watermark", r.video.nowatermark]);\n' +
'    if (r.video && r.video.nowatermark_hd) videoEntries.push(["Tanpa Watermark (HD)", r.video.nowatermark_hd]);\n' +
'    if (videoEntries.length > 0){\n' +
'      const card = document.createElement("div"); card.className = "card";\n' +
'      const title = document.createElement("h3"); title.textContent = "Video ("+videoEntries.length+" varian)"; title.style.marginTop = "0";\n' +
'      const grid = document.createElement("div"); grid.className = "photo-grid";\n' +
'      videoEntries.forEach(function(pair){\n' +
'        const label = pair[0], src = pair[1];\n' +
'        const cell = document.createElement("div"); cell.className = "media-card";\n' +
'        const vid = document.createElement("video"); vid.className = "media"; vid.src = src; vid.controls = true; vid.playsInline = true; vid.preload = "metadata";\n' +
'        const ctr = document.createElement("div"); ctr.className = "controls";\n' +
'        const a = document.createElement("a"); a.className = "btn"; a.href = src; a.download = ""; a.textContent = "⬇️ Download " + label;\n' +
'        const b = document.createElement("button"); b.className = "btn"; b.textContent = "🔗 Salin Link"; b.addEventListener("click", function(){ copyText(src); });\n' +
'        const pill = document.createElement("div"); pill.className = "pill"; pill.textContent = "▶️ " + label;\n' +
'        ctr.appendChild(a); ctr.appendChild(b);\n' +
'        cell.appendChild(vid); cell.appendChild(ctr); cell.appendChild(pill); grid.appendChild(cell);\n' +
'      });\n' +
'      card.appendChild(title); card.appendChild(grid); results.appendChild(card);\n' +
'    }\n' +
'\n' +
'    // Card Audio\n' +
'    var audioUrl = (r.music_info && r.music_info.play) || r.music || "";\n' +
'    if (audioUrl){\n' +
'      const card = document.createElement("div"); card.className = "card";\n' +
'      const title = document.createElement("h3"); title.textContent = "Audio"; title.style.marginTop = "0";\n' +
'      const wrap = document.createElement("div"); wrap.className = "media-card"; wrap.style.alignItems = "center";\n' +
'      const audio = document.createElement("audio"); audio.id = "audioPlayer"; audio.src = audioUrl;\n' +
'      const ctr = document.createElement("div"); ctr.className = "controls";\n' +
'      const playBtn = document.createElement("button"); playBtn.className = "btn"; playBtn.textContent = "▶️ Play";\n' +
'      const dl = document.createElement("a"); dl.className = "btn"; dl.href = audioUrl; dl.download = ""; dl.textContent = "⬇️ Download Audio";\n' +
'      const copyBtn = document.createElement("button"); copyBtn.className = "btn"; copyBtn.textContent = "🔗 Salin Link";\n' +
'      const state = document.createElement("div"); state.className = "muted"; state.innerHTML = "<small>Tidak memutar</small>"; state.id = "audioState";\n' +
'      playBtn.addEventListener("click", function(){ if (audio.paused) audio.play(); else audio.pause(); });\n' +
'      copyBtn.addEventListener("click", function(){ copyText(audioUrl); });\n' +
'      audio.addEventListener("play", function(){ state.innerHTML = "<small>Sedang memutar...</small>"; playBtn.textContent = "⏸️ Pause"; });\n' +
'      audio.addEventListener("pause", function(){ state.innerHTML = "<small>Tidak memutar</small>"; playBtn.textContent = "▶️ Play"; });\n' +
'      audio.addEventListener("ended", function(){ state.innerHTML = "<small>Tidak memutar</small>"; playBtn.textContent = "▶️ Play"; });\n' +
'      ctr.appendChild(playBtn); ctr.appendChild(dl); ctr.appendChild(copyBtn);\n' +
'      wrap.appendChild(audio); wrap.appendChild(ctr); wrap.appendChild(state);\n' +
'      card.appendChild(title); card.appendChild(wrap); results.appendChild(card);\n' +
'    }\n' +
'\n' +
'    // Card JSON lengkap (collapsible)\n' +
'    const cardJson = document.createElement("div"); cardJson.className = "card";\n' +
'    const details = document.createElement("details");\n' +
'    const sum = document.createElement("summary"); sum.innerHTML = "<strong>Tampilkan JSON lengkap</strong>";\n' +
'    const box = document.createElement("div"); box.className = "json";\n' +
'    const pre = document.createElement("pre"); pre.textContent = JSON.stringify({ status:true, developer:"@Al_Azet", result:r }, null, 2);\n' +
'    box.appendChild(pre); details.appendChild(sum); details.appendChild(box); cardJson.appendChild(details);\n' +
'    const hint = document.createElement("div"); hint.className = "muted"; hint.innerHTML = "<small>Gunakan data ini untuk integrasi langsung via API.</small>";\n' +
'    cardJson.appendChild(hint); results.appendChild(cardJson);\n' +
'  }\n' +
'\n' +
'  // Copy helper + Toast\n' +
'  async function copyText(t){ try{ await navigator.clipboard.writeText(t); toast("Tautan disalin"); } catch(e){ toast("Gagal menyalin", true); } }\n' +
'  let toastTimer = null;\n' +
'  function toast(msg, danger){\n' +
'    let el = document.getElementById("toast");\n' +
'    if (!el) {\n' +
'      el = document.createElement("div"); el.id = "toast"; el.style.position = "fixed"; el.style.bottom = "18px"; el.style.left = "50%"; el.style.transform = "translateX(-50%)"; el.style.padding = "10px 14px"; el.style.borderRadius = "999px"; el.style.zIndex = "9999"; el.style.boxShadow = "var(--shadow)"; el.style.border = "1px solid var(--border)"; el.style.background = "var(--card)"; el.style.color = "var(--fg)"; document.body.appendChild(el);\n' +
'    }\n' +
'    el.textContent = msg; el.style.opacity = "0"; el.style.transition = "opacity .2s, transform .2s"; el.style.transform = "translateX(-50%) translateY(6px)";\n' +
'    requestAnimationFrame(function(){ el.style.opacity = "1"; el.style.transform = "translateX(-50%) translateY(0)"; });\n' +
'    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ el.style.opacity = "0"; el.style.transform = "translateX(-50%) translateY(6px)"; }, 1600);\n' +
'  }\n' +
'</script>\n' +
'</body>\n' +
'</html>\n';

  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
