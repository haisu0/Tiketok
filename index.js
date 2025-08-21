export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // API endpoint
    if (url.pathname === '/api') {
      const target = url.searchParams.get('url');
      return handleApi(target);
    }

    // Web UI
    return serveWebUI();
  }
};

// ---------- API ----------

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra
  };
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8', ...headers })
  });
}

async function handleApi(tiktokUrl) {
  if (!tiktokUrl) {
    return json({
      status: false,
      developer: '@Al_Azet',
      message: 'Parameter url wajib diisi'
    }, 400);
  }

  try {
    // Panggil layanan pihak ketiga (TikWM)
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}&hd=1`;
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/javascript, */*;q=0.1',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://www.tikwm.com',
        'Referer': 'https://www.tikwm.com/',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!resp.ok) {
      return json({
        status: false,
        developer: '@Al_Azet',
        message: `Gagal menghubungi layanan upstream (HTTP ${resp.status})`
      }, resp.status);
    }

    const payload = await resp.json().catch(() => null);

    // TikWM sering mengembalikan { code, msg, data }
    if (!payload || (typeof payload !== 'object')) {
      return json({
        status: false,
        developer: '@Al_Azet',
        message: 'Respons upstream tidak valid'
      }, 502);
    }

    if (payload.code && payload.code !== 0) {
      return json({
        status: false,
        developer: '@Al_Azet',
        message: payload.msg || 'Upstream mengembalikan error',
        upstream: payload
      }, 502);
    }

    const r = payload.data || {};
    const video = { jumlah: 0, watermark: null, nowatermark: null, nowatermark_hd: null };
    const foto = { jumlah: 0, links: [] };

    // Deteksi konten foto vs video
    if (!r.size && !r.wm_size && !r.hd_size) {
      // Post foto
      foto.jumlah = Array.isArray(r.images) ? r.images.length : 0;
      foto.links = Array.isArray(r.images) ? r.images : [];
    } else {
      // Post video (bisa ada beberapa varian)
      let count = 0;
      if (r.wmplay) { video.watermark = r.wmplay; count++; }
      if (r.play) { video.nowatermark = r.play; count++; }
      if (r.hdplay) { video.nowatermark_hd = r.hdplay; count++; }
      video.jumlah = count;
    }

    // Gabungkan semua data asli + ringkasan
    return json({
      status: true,
      developer: '@Al_Azet',
      result: {
        video,
        foto,
        ...r
      }
    });
  } catch (e) {
    return json({
      status: false,
      developer: '@Al_Azet',
      message: 'Gagal memproses permintaan',
      error: String(e?.message || e)
    }, 500);
  }
}

// ---------- WEB UI ----------

function serveWebUI() {
  const html = `<!DOCTYPE html>
<html lang="id" data-theme="">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>TikTok Downloader — @Al_Azet</title>
  <meta name="color-scheme" content="light dark" />
  <style>
    :root {
      --bg: #ffffff;
      --fg: #0f172a;
      --muted: #475569;
      --accent: #2563eb;
      --accent-2: #1d4ed8;
      --card: #f8fafc;
      --border: #e2e8f0;
      --success: #10b981;
      --danger: #ef4444;
      --shadow: 0 6px 18px rgba(0,0,0,.08);
    }
    [data-theme="dark"] {
      --bg: #0b1220;
      --fg: #e5eefb;
      --muted: #a3b2c7;
      --accent: #38bdf8;
      --accent-2: #22d3ee;
      --card: #121a2b;
      --border: #22304a;
      --success: #34d399;
      --danger: #f87171;
      --shadow: 0 8px 20px rgba(0,0,0,.35);
    }
    * { box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      line-height: 1.6;
      transition: background .3s ease, color .3s ease;
    }
    .container {
      max-width: 1100px;
      margin: 0 auto;
    }
    header {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      margin-bottom: 18px;
    }
    .brand {
      display: flex; align-items: center; gap: 10px;
    }
    .logo {
      width: 40px; height: 40px; border-radius: 10px;
      background: radial-gradient(120% 120% at 30% 20%, var(--accent) 0%, #8b5cf6 60%, #ef4444 100%);
      box-shadow: var(--shadow);
    }
    h1 { font-size: 22px; margin: 0; }
    .muted { color: var(--muted); }
    .toolbar { display: flex; gap: 10px; align-items: center; }
    .toggle, .btn {
      appearance: none; border: 1px solid var(--border); background: var(--card);
      color: var(--fg); padding: 10px 12px; border-radius: 10px; cursor: pointer;
      transition: transform .08s ease, background .2s ease, border-color .2s ease;
    }
    .btn.primary {
      background: linear-gradient(180deg, var(--accent), var(--accent-2));
      color: #fff; border: none;
      box-shadow: var(--shadow);
    }
    .btn:active, .toggle:active { transform: scale(0.98); }
    .search {
      display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-bottom: 16px;
    }
    input[type="url"] {
      width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border);
      background: var(--card); color: var(--fg); outline: none;
      transition: border-color .2s ease, background .2s ease;
    }
    input[type="url"]:focus { border-color: var(--accent); }
    .cards {
      display: grid; gap: 16px; grid-template-columns: 1fr;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px;
      box-shadow: var(--shadow);
      animation: fadeIn .35s ease both;
    }
    .card h2, .card h3 { margin-top: 0; }
    .profile {
      display: grid; gap: 16px;
      grid-template-columns: 80px 1fr;
      align-items: center;
    }
    .avatar {
      width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border);
    }
    .chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
    .chip {
      background: transparent; border: 1px solid var(--border); color: var(--fg);
      padding: 6px 10px; border-radius: 999px; font-size: 13px;
    }
    .photo-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;
    }
    @media (max-width: 420px) {
      .photo-grid { grid-template-columns: 1fr; }
      .profile { grid-template-columns: 1fr; justify-items: center; text-align: center; }
    }
    .media-card {
      display: flex; flex-direction: column; gap: 8px; align-items: center;
      background: rgba(0,0,0,0.02);
      padding: 12px; border-radius: 12px; border: 1px dashed var(--border);
    }
    .media {
      max-width: 100%; width: 100%; border-radius: 10px; background: #000;
    }
    .controls { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
    .controls .btn { border-radius: 999px; }
    .pill {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 10px; border-radius: 999px; font-size: 12px;
      background: rgba(16, 185, 129, .12); color: var(--success);
      border: 1px solid rgba(16, 185, 129, .3);
    }
    .warn { background: rgba(239, 68, 68, .12); color: var(--danger); border-color: rgba(239, 68, 68, .3); }
    .json { overflow: auto; max-height: 420px; background: rgba(0,0,0,.05); padding: 12px; border-radius: 10px; border: 1px solid var(--border); }
    details summary { cursor: pointer; margin-bottom: 8px; }
    .hr { height: 1px; background: var(--border); margin: 14px 0; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .muted small { font-size: 12px; }
    a.link { color: var(--accent); text-decoration: none; }
    a.link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="logo"></div>
        <div>
          <h1>TikTok Downloader</h1>
          <div class="muted">Developer: @Al_Azet</div>
        </div>
      </div>
      <div class="toolbar">
        <button class="toggle" id="themeToggle" aria-label="Toggle tema">🌙</button>
        <a class="btn" href="#" id="exampleBtn" title="Contoh URL">Contoh URL</a>
      </div>
    </header>

    <section class="search">
      <input type="url" id="inputUrl" placeholder="Tempel URL TikTok di sini (video atau foto)..." />
      <button class="btn primary" id="goBtn">
        <span id="goIcon">🔎</span> <span id="goText">Ambil Data</span>
      </button>
    </section>

    <div id="notice" class="muted" style="margin-bottom:10px;">
      Gunakan URL publik dari TikTok. Hasil akan menampilkan semua data, foto, video, audio, serta info author.
    </div>

    <div id="results" class="cards"></div>
  </div>

<script>
  // ----- Tema (toggle + persist) -----
  const themeKey = 'ttdl-theme';
  const body = document.documentElement;
  const savedTheme = localStorage.getItem(themeKey);
  if (savedTheme) body.setAttribute('data-theme', savedTheme);
  const themeToggle = document.getElementById('themeToggle');
  themeToggle.addEventListener('click', () => {
    const next = body.getAttribute('data-theme') === 'dark' ? '' : 'dark';
    if (next) body.setAttribute('data-theme', next); else body.removeAttribute('data-theme');
    localStorage.setItem(themeKey, next);
  });

  // ----- Helpers -----
  const $ = (s, el=document) => el.querySelector(s);
  const fmt = (n) => isFinite(n) ? Number(n).toLocaleString('id-ID') : '-';
  const fmtDate = (sec) => {
    if (!sec) return '-';
    try { return new Date(Number(sec)*1000).toLocaleString('id-ID'); } catch { return '-'; }
  };
  const makeLink = (href, text) => href ? '<a class="link" href="'+href+'" target="_blank" rel="noopener">'+(text||href)+'</a>' : '-';
  const buildProfileUrl = (author) => author?.unique_id ? ('https://www.tiktok.com/@'+author.unique_id) : (author?.url || '');

  // ----- Example -----
  const exampleBtn = document.getElementById('exampleBtn');
  exampleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const demo = 'https://www.tiktok.com/@scout2015/video/6718335390845095173';
    document.getElementById('inputUrl').value = demo;
  });

  // ----- Fetch handler -----
  const goBtn = document.getElementById('goBtn');
  goBtn.addEventListener('click', () => fetchAndRender());
  document.getElementById('inputUrl').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); fetchAndRender(); }
  });

  async function fetchAndRender() {
    const url = document.getElementById('inputUrl').value.trim();
    const results = document.getElementById('results');
    if (!url) {
      results.innerHTML = '<div class="card warn">URL tidak boleh kosong.</div>';
      return;
    }

    // Loading state
    $('#goText').textContent = 'Memproses...';
    $('#goIcon').textContent = '';
    $('#goIcon').classList.add('spin');
    goBtn.disabled = true;

    try {
      const res = await fetch('/api?url=' + encodeURIComponent(url));
      const json = await res.json();

      if (!json.status) {
        results.innerHTML = '<div class="card warn"><strong>Gagal:</strong> ' + (json.message || 'Tidak diketahui') + '</div>';
      } else {
        results.innerHTML = buildResultCards(json.result);
      }
    } catch (e) {
      results.innerHTML = '<div class="card warn"><strong>Kesalahan:</strong> ' + (e?.message || e) + '</div>';
    } finally {
      $('#goText').textContent = 'Ambil Data';
      $('#goIcon').textContent = '🔎';
      $('#goIcon').classList.remove('spin');
      goBtn.disabled = false;
    }
  }

  // ----- UI builders -----
  function buildResultCards(r) {
    const authorUrl = buildProfileUrl(r.author);

    // Card: Author & Post
    const authorCard = `
      <div class="card">
        <div class="profile">
          <img class="avatar" src="${r.author?.avatar || ''}" alt="Avatar author" />
          <div>
            <h2 style="margin:0 0 6px 0;">${escapeHtml(r.title || '(Tanpa Judul)')}</h2>
            <div class="muted"><strong>${escapeHtml(r.author?.nickname || '-')}</strong> @${escapeHtml(r.author?.unique_id || '-')}</div>
            <div class="chips">
              <span class="chip">Region: ${escapeHtml(r.region || '-')}</span>
              <span class="chip">Durasi: ${fmt(r.duration)}s</span>
              <span class="chip">Dibuat: ${fmtDate(r.create_time)}</span>
              ${r.cover ? '<span class="chip">Ada cover</span>' : ''}
            </div>
            <div style="margin-top:10px;">
              ${authorUrl ? makeLink(authorUrl, 'Buka profil TikTok ↗') : '<span class="muted">Profil tidak tersedia</span>'}
            </div>
          </div>
        </div>
        <div class="hr"></div>
        <div class="chips">
          <span class="chip">Views: ${fmt(r.play_count ?? r.stats?.play_count)}</span>
          <span class="chip">Likes: ${fmt(r.digg_count ?? r.stats?.digg_count)}</span>
          <span class="chip">Comments: ${fmt(r.comment_count ?? r.stats?.comment_count)}</span>
          <span class="chip">Shares: ${fmt(r.share_count ?? r.stats?.share_count)}</span>
          <span class="chip">Downloads: ${fmt(r.download_count ?? r.stats?.download_count)}</span>
        </div>
      </div>
    `;

    // Card: Foto (grid 2 kolom)
    const photos = Array.isArray(r.foto?.links) ? r.foto.links : [];
    const fotoCard = (r.foto?.jumlah > 0) ? `
      <div class="card">
        <h3 style="margin-top:0;">Foto (${photos.length})</h3>
        <div class="photo-grid">
          ${photos.map((link, i) => `
            <div class="media-card">
              <img class="media" src="${link}" alt="Foto ${i+1}" loading="lazy" />
              <div class="controls">
                <a class="btn" href="${link}" download>
                  ${icon('download')} Download Foto ${i+1}
                </a>
                <button class="btn" onclick="copyToClipboard('${escapeAttr(link)}')">
                  ${icon('link')} Salin Link
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    // Card: Video (semua varian playable + download)
    const videoEntries = [];
    if (r.video?.watermark) videoEntries.push(['Watermark', r.video.watermark]);
    if (r.video?.nowatermark) videoEntries.push(['Tanpa Watermark', r.video.nowatermark]);
    if (r.video?.nowatermark_hd) videoEntries.push(['Tanpa Watermark (HD)', r.video.nowatermark_hd]);

    const videoCard = (videoEntries.length > 0) ? `
      <div class="card">
        <h3 style="margin-top:0;">Video (${videoEntries.length} varian)</h3>
        <div class="photo-grid">
          ${videoEntries.map(([label, src], idx) => `
            <div class="media-card">
              <video class="media" src="${src}" controls playsinline preload="metadata"></video>
              <div class="controls">
                <a class="btn" href="${src}" download>
                  ${icon('download')} Download ${escapeHtml(label)}
                </a>
                <button class="btn" onclick="copyToClipboard('${escapeAttr(src)}')">
                  ${icon('link')} Salin Link
                </button>
              </div>
              <div class="pill" title="${escapeHtml(label)}">${icon('play')} ${escapeHtml(label)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    // Card: Audio (play/stop + download)
    const audioUrl = r?.music_info?.play || r?.music || '';
    const audioCard = audioUrl ? `
      <div class="card">
        <h3 style="margin-top:0;">Audio</h3>
        <div class="media-card" style="align-items:center;">
          <audio id="audioPlayer" src="${audioUrl}"></audio>
          <div class="controls">
            <button class="btn" id="audioToggle">${icon('play')} Play</button>
            <a class="btn" href="${audioUrl}" download>
              ${icon('download')} Download Audio
            </a>
            <button class="btn" onclick="copyToClipboard('${escapeAttr(audioUrl)}')">
              ${icon('link')} Salin Link
            </button>
          </div>
          <div id="audioState" class="muted"><small>Tidak memutar</small></div>
        </div>
      </div>
      <script>
        (function(){
          const ap = document.getElementById('audioPlayer');
          const btn = document.getElementById('audioToggle');
          const st = document.getElementById('audioState');
          const setState = () => { st.innerHTML = ap.paused ? '<small>Tidak memutar</small>' : '<small>Sedang memutar...</small>'; btn.innerHTML = ap.paused ? '${escapeHtml(icon('play') + " Play")}' : '${escapeHtml(icon('pause') + " Pause")}'; };
          btn.addEventListener('click', () => { if (ap.paused) ap.play(); else ap.pause(); });
          ap.addEventListener('play', setState); ap.addEventListener('pause', setState); ap.addEventListener('ended', setState);
          setState();
        })();
      </script>
    ` : '';

    // Card: JSON lengkap (collapsible)
    const jsonCard = `
      <div class="card">
        <details>
          <summary><strong>Tampilkan JSON lengkap</strong></summary>
          <div class="json"><pre>${escapeHtml(JSON.stringify({ status:true, developer:'@Al_Azet', result: r }, null, 2))}</pre></div>
        </details>
        <div class="muted"><small>Gunakan data ini untuk integrasi langsung via API.</small></div>
      </div>
    `;

    return authorCard + fotoCard + videoCard + audioCard + jsonCard;
  }

  // ----- Icons (SVG inline) -----
  function icon(name){
    if (name === 'download') return '⬇️';
    if (name === 'link') return '🔗';
    if (name === 'play') return '▶️';
    if (name === 'pause') return '⏸️';
    return '•';
  }

  // ----- Clipboard -----
  async function copyToClipboard(text){
    try {
      await navigator.clipboard.writeText(text);
      toast('Tautan disalin');
    } catch(e) {
      toast('Gagal menyalin', true);
    }
  }
  window.copyToClipboard = copyToClipboard; // expose for inline handlers

  // ----- Toast -----
  let toastTimer = null;
  function toast(msg, danger){
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.position = 'fixed';
      el.style.bottom = '18px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.padding = '10px 14px';
      el.style.borderRadius = '999px';
      el.style.zIndex = '9999';
      el.style.boxShadow = 'var(--shadow)';
      el.style.border = '1px solid var(--border)';
      el.style.background = 'var(--card)';
      el.style.color = 'var(--fg)';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '0';
    el.style.transition = 'opacity .2s ease, transform .2s ease';
    el.style.transform = 'translateX(-50%) translateY(6px)';
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0)';
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(6px)';
    }, 1600);
  }

  // ----- Escape helpers -----
  function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c)); }
  function escapeAttr(s){ return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
</script>
</body>
</html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
