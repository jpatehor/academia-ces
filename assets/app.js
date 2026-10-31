/* ============ Academia CES · app ============ */
(() => {
  'use strict';

  const STORE_KEY = 'academia-ces.v1';
  const AREAS = {
    'ciencias-basicas': { label: 'Ciencias básicas', emoji: '🧬' },
    'clinicas':         { label: 'Clínicas', emoji: '🩺' },
    'cultura-general':  { label: 'Cultura general', emoji: '🖼️' },
  };

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fmtPct = n => isFinite(n) ? Math.round(n * 100) + '%' : '—';
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- estado ---------- */
  const defaultState = () => ({
    cards: {},          // id -> { seen, ok, bad, box, last }
    streak: 0,
    lastDay: null,
    history: [],        // últimos eventos
    theme: null,
  });

  let state = load();
  let BANK = [];
  let byId = new Map();

  function load() {
    try { return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); }
    catch { return defaultState(); }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function touchStreak() {
    const t = todayKey();
    if (state.lastDay === t) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    state.streak = state.lastDay === yesterday ? (state.streak || 0) + 1 : 1;
    state.lastDay = t;
    save();
  }

  const meta = id => state.cards[id] || { seen: 0, ok: 0, bad: 0, box: 0, last: 0 };
  function record(id, correct) {
    const m = meta(id);
    m.seen += 1;
    m.last = Date.now();
    if (correct) { m.ok += 1; m.box = clamp(m.box + 1, 0, 5); } else { m.bad += 1; m.box = 0; }
    state.cards[id] = m;
    state.history.unshift({ id, correct, t: Date.now() });
    state.history = state.history.slice(0, 60);
    touchStreak();
    save();
  }

  const mastered = () => BANK.filter(q => meta(q.id).box >= 4).length;
  const answered = () => BANK.filter(q => meta(q.id).seen > 0).length;
  const dueIds   = () => BANK.filter(q => meta(q.id).seen > 0 && meta(q.id).box < 3).map(q => q.id);

  /* ---------- navegación ---------- */
  const views = ['dashboard', 'biblioteca', 'apuntes', 'galeria', 'progreso', 'quiz', 'flash', 'results'];
  function show(name) {
    views.forEach(v => $('#view-' + v).classList.toggle('hidden', v !== name));
    $$('.topnav .ghost').forEach(b => b.removeAttribute('aria-current'));
    const nav = $('.topnav .ghost[data-nav="' + name + '"]');
    if (nav) nav.setAttribute('aria-current', 'page');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }
  $$('.topnav .ghost').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.nav;
    if (v === 'biblioteca') renderLibrary();
    if (v === 'apuntes') renderApuntes();
    if (v === 'galeria') renderGallery();
    if (v === 'progreso') renderProgress();
    show(v);
  }));

  /* ---------- tema ---------- */
  function applyTheme() {
    const t = state.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = t;
  }
  $('#themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    state.theme = cur; save(); applyTheme();
  });

  /* ---------- voz ---------- */
  let speaking = false;
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    if (speaking) { speechSynthesis.cancel(); speaking = false; return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES'; u.rate = 1.02;
    u.onend = () => { speaking = false; };
    speaking = true;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  /* ---------- dashboard ---------- */
  function renderDashboard() {
    const h = new Date().getHours();
    $('#greeting').textContent = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const a = answered(), m = mastered(), due = dueIds().length;
    const total = BANK.length || 1;
    const okTotal = Object.values(state.cards).reduce((s, c) => s + c.ok, 0);
    const badTotal = Object.values(state.cards).reduce((s, c) => s + c.bad, 0);
    const acc = okTotal + badTotal ? okTotal / (okTotal + badTotal) : NaN;

    $('#kpiAnswered').textContent = a;
    $('#kpiAccuracy').textContent = fmtPct(acc);
    $('#kpiMastered').textContent = m;
    $('#kpiDue').textContent = due;
    $('#streakTop').textContent = state.streak || 0;
    $('#ringPct').textContent = Math.round((m / total) * 100) + '%';
    const ring = $('#ringFill');
    const len = 2 * Math.PI * 52;
    ring.style.strokeDasharray = len;
    ring.style.strokeDashoffset = len * (1 - m / total);

    $('#bankInfo').textContent = `${BANK.length} preguntas · ${Object.keys(AREAS).length} áreas · ${due} por repasar`;

    // progreso por modo
    $$('.mode-card[data-area]').forEach(card => {
      const area = card.dataset.area;
      const pool = area === 'all' ? BANK : BANK.filter(q => q.area === area);
      const done = pool.filter(q => meta(q.id).box >= 4).length;
      const bar = card.querySelector('.mode-progress i');
      if (bar) bar.style.setProperty('--p', (pool.length ? (done / pool.length) * 100 : 0) + '%');
    });

    $('#footStats').textContent = `${BANK.length} preguntas · avance local`;

    // simulacros por convocatoria (excluye el banco propio marcado como 2026)
    const years = [...new Set(BANK.map(q => q.anio))].filter(y => y && y <= 2025).sort((a, b) => b - a);
    const grid = $('#yearGrid');
    grid.innerHTML = years.length ? years.map(y => {
      const pool = BANK.filter(q => q.anio === y);
      const done = pool.filter(q => meta(q.id).box >= 4).length;
      return `<button class="year-card" data-year="${y}">
        <span class="year-badge">${y}</span>
        <span class="year-info"><b>${pool.length}</b> preguntas <em>${done} dominadas</em></span>
        <span class="year-cta">Simulacro →</span>
      </button>`;
    }).join('') : '<p class="muted">Aún no hay convocatorias cargadas.</p>';
  }

  $('#yearGrid').addEventListener('click', e => {
    const card = e.target.closest('.year-card');
    if (!card) return;
    const year = Number(card.dataset.year);
    const pool = BANK.filter(q => q.anio === year);
    if (!pool.length) return;
    startSession(shuffle(pool), { mode: 'simulacro', minutes: Math.max(10, Math.round(pool.length * 0.8)) });
  });

  /* ---------- biblioteca ---------- */
  let libFilter = 'all', libQuery = '', libYear = 'all';
  function renderLibrary() {
    const chips = $('#areaChips');
    if (!chips.dataset.ready) {
      chips.innerHTML = ['all', ...Object.keys(AREAS)]
        .map(k => `<button class="chip${k === 'all' ? ' on' : ''}" data-area="${k}">${k === 'all' ? 'Todas' : AREAS[k].emoji + ' ' + AREAS[k].label}</button>`)
        .join('');
      chips.dataset.ready = '1';
      chips.addEventListener('click', e => {
        const b = e.target.closest('.chip'); if (!b) return;
        libFilter = b.dataset.area;
        $$('.chip', chips).forEach(c => c.classList.toggle('on', c === b));
        paintLibrary();
      });
    }
    const ychips = $('#yearChips');
    if (!ychips.dataset.ready) {
      const years = [...new Set(BANK.map(q => q.anio))].filter(Boolean).sort((a, b) => b - a);
      ychips.innerHTML = ['all', ...years]
        .map(y => `<button class="chip${y === 'all' ? ' on' : ''}" data-year="${y}">${y === 'all' ? 'Todos los años' : y}</button>`)
        .join('');
      ychips.dataset.ready = '1';
      ychips.addEventListener('click', e => {
        const b = e.target.closest('.chip'); if (!b) return;
        libYear = b.dataset.year === 'all' ? 'all' : Number(b.dataset.year);
        $$('.chip', ychips).forEach(c => c.classList.toggle('on', c === b));
        paintLibrary();
      });
    }
    paintLibrary();
  }
  function paintLibrary() {
    const q = libQuery.toLowerCase();
    const list = BANK.filter(x =>
      (libFilter === 'all' || x.area === libFilter) &&
      (libYear === 'all' || x.anio === libYear) &&
      (!q || (x.enunciado + ' ' + x.tema + ' ' + x.fuente).toLowerCase().includes(q))
    );
    $('#libraryList').innerHTML = list.length ? list.map(x => `
      <article class="lib-item" data-id="${x.id}" tabindex="0">
        <div class="lib-meta">
          <span>${AREAS[x.area]?.emoji || ''} ${AREAS[x.area]?.label || x.area}</span>
          <span>·</span><span>${esc(x.tema)}</span>
        </div>
        <p>${esc(x.enunciado)}</p>
        <div class="lib-meta">
          <span>${esc(x.fuente || '')}</span>
          <span>·</span><span>${meta(x.id).seen ? 'vista ' + meta(x.id).seen + '×' : 'nueva'}</span>
          ${x.verificado === false ? '<span>·</span><span>⚠ por verificar</span>' : ''}
        </div>
      </article>`).join('')
      : `<p class="muted">Sin resultados para “${esc(libQuery)}”.</p>`;
  }
  $('#searchInput').addEventListener('input', e => { libQuery = e.target.value; paintLibrary(); });
  $('#libraryList').addEventListener('click', e => {
    const it = e.target.closest('.lib-item'); if (!it) return;
    startSession([byId.get(it.dataset.id)], { mode: 'quiz', single: true });
  });

  /* ---------- apuntes ---------- */
  let APUNTES = null;
  const TOPIC_MODULE = [
    [/hemoglobinopat|anemia|c[eé]lulas rojas|hem[oó]lisis|linfohistiocit/i, '28'],
    [/leucemia|c[eé]lulas blancas|linfoma/i, '29'],
    [/plaqueta|trombocitop/i, '30'],
    [/mieloma|plasm[aá]tic|amiloidosis/i, '31'],
    [/hematolog|coagulaci|trombosis|trombofilia|hemofilia/i, '27'],
    [/tiroides/i, '35'],
    [/diabetes|insulina/i, '36'],
    [/hip[oó]fisis/i, '33'],
    [/suprarrenal/i, '34'],
    [/endocrino/i, '32'],
    [/cefalea/i, '41'],
    [/epilepsia|convuls/i, '42'],
    [/demencia/i, '43'],
    [/neuromuscular/i, '44'],
    [/movimiento|parkinson|diston/i, '45'],
    [/desmielin/i, '46'],
    [/neuro|acv|seno cavernoso|m[eé]dula espinal/i, '41'],
    [/ictericia neonatal/i, '47'],
    [/torch|tos ferina|fiebre sin foco|infectolog[ií]a pedi/i, '48'],
    [/dificultad respiratoria|sdr/i, '49'],
    [/valoraci[oó]n del rn|neonat|desarrollo/i, '50'],
    [/pediatr/i, '47'],
    [/vasculitis/i, '51'],
    [/reumatoide|sim[eé]tric|poliarticular/i, '40'],
    [/cristales|gota/i, '38'],
    [/seronegativ/i, '39'],
    [/osteoartritis/i, '37.1'],
    [/reuma/i, '37'],
    [/hepatobiliar|pancrea|v[ií]a biliar|\bhcc\b|portal|bilirrubina|hepatitis/i, '24'],
    [/intestinal|colon|p[oó]lipos|h\. pylori|\bpaf\b/i, '25'],
    [/es[oó]fag|erge|acalasia|\bhda\b/i, '26'],
    [/gastro|cirrosis/i, '24'],
    [/falla cardiaca/i, '20'],
    [/endocarditis/i, '21'],
    [/coronaria|\biam\b|infarto|l[ií]pidos/i, '22'],
    [/cardio/i, '19'],
    [/\bsnc\b|meningitis/i, '15'],
    [/respiratori/i, '16'],
    [/vih|hiv/i, '17'],
    [/\bits\b|s[ií]filis/i, '18'],
    [/infectolog|microbio|parasitolog/i, '13'],
    [/inmunolog/i, '12'],
    [/gen[eé]tica|citogen|herencia/i, '5'],
    [/embriolog/i, '8'],
    [/vitamina/i, '3'],
    [/bioqu|metabol|enzima|amino/i, '2'],
    [/histolog|fisiolog|anatom|biolog[ií]a celular/i, '1'],
  ];

  function moduleForQuestion(q) {
    if (!APUNTES || !q) return null;
    const t = q.tema || '';
    for (const [re, n] of TOPIC_MODULE) {
      if (re.test(t)) return APUNTES.find(a => a.n === n) || null;
    }
    return null;
  }

  async function renderApuntes() {
    if (APUNTES === null) {
      try {
        const res = await fetch('data/apuntes.json', { cache: 'force-cache' });
        APUNTES = await res.json();
      } catch (e) {
        $('#apList').innerHTML = '<p class="muted">No se pudieron cargar los apuntes.</p>';
        return;
      }
    }
    paintApuntes('');
  }

  function paintApuntes(query) {
    const q = query.toLowerCase();
    const list = APUNTES.filter(a => !q || (a.titulo + ' ' + a.n).toLowerCase().includes(q));
    $('#apList').innerHTML = list.length ? list.map(a => `
      <button class="ap-card" data-file="${a.archivo}" data-title="${esc(a.n + '. ' + a.titulo)}" data-n="${a.n}">
        <span class="ap-num">${esc(a.n)}</span>
        <span class="ap-info"><b>${esc(a.titulo)}</b><em>${(a.chars / 1000).toFixed(1)}k caracteres</em></span>
      </button>`).join('') : '<p class="muted">Sin resultados.</p>';
  }

  function questionsForModule(n) {
    return BANK.filter(q => {
      const m = moduleForQuestion(q);
      return m && m.n === n;
    });
  }

  async function openApunte(file, title, n) {
    const body = $('#apBody');
    $('#apTitle').textContent = title;
    body.innerHTML = '<p class="muted">Cargando…</p>';
    $('#apList').classList.add('hidden');
    $('#apReader').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const res = await fetch('apuntes/' + file, { cache: 'force-cache' });
      body.innerHTML = await res.text();
    } catch (e) {
      body.innerHTML = '<p class="muted">No se pudo abrir el módulo.</p>';
    }
    renderRelated(n);
  }

  function renderRelated(n) {
    const box = $('#apRelated');
    if (!box) return;
    const qs = n ? questionsForModule(n) : [];
    if (!qs.length) {
      box.innerHTML = '<p class="muted">Este módulo aún no tiene preguntas asociadas.</p>';
      return;
    }
    const preview = qs.slice(0, 6).map((q, i) => `
      <li><button class="ap-q" data-idx="${i}">${esc(q.enunciado.slice(0, 90))}${q.enunciado.length > 90 ? '…' : ''}</button></li>`).join('');
    box.innerHTML = `
      <h3>Preguntas de este tema <span class="ap-count">${qs.length}</span></h3>
      <ul class="ap-qlist">${preview}</ul>
      <button class="btn primary" id="apPractice">Practicar este tema (${qs.length})</button>`;
    $('#apPractice').addEventListener('click', () => {
      startSession(shuffle(qs).slice(0, 20), { mode: 'quiz' });
    });
    box.querySelectorAll('.ap-q').forEach((b, i) => {
      b.addEventListener('click', () => startSession([qs[Number(b.dataset.idx)]], { mode: 'quiz' }));
    });
  }

  $('#apSearch').addEventListener('input', e => paintApuntes(e.target.value));
  $('#apList').addEventListener('click', e => {
    const b = e.target.closest('.ap-card');
    if (b) openApunte(b.dataset.file, b.dataset.title, b.dataset.n);
  });
  $('#apBack').addEventListener('click', () => {
    $('#apReader').classList.add('hidden');
    $('#apList').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#fbNote').addEventListener('click', () => {
    if (!S) return;
    const mod = moduleForQuestion(S.qs[S.i]);
    show('apuntes');
    renderApuntes();
    if (mod) openApunte(mod.archivo, mod.n + '. ' + mod.titulo, mod.n);
  });

  /* ---------- galería ---------- */
  let IMGS = null, galFilter = 'all', galShown = 0;
  const GAL_STEP = 60;

  async function renderGallery() {
    const grid = $('#galGrid');
    if (IMGS === null) {
      grid.innerHTML = '<p class="muted">Cargando imágenes…</p>';
      try {
        const res = await fetch('data/images.json', { cache: 'force-cache' });
        IMGS = await res.json();
      } catch (e) {
        grid.innerHTML = '<p class="muted">No se pudieron cargar las imágenes.</p>';
        return;
      }
    }
    const chips = $('#galChips');
    if (!chips.dataset.ready) {
      const docs = [...new Map(IMGS.map(i => [i.s, i])).keys()].sort((a, b) => a.localeCompare(b));
      chips.innerHTML = ['all', ...docs]
        .map(d => `<button class="chip${d === 'all' ? ' on' : ''}" data-doc="${esc(d)}" title="${esc(d)}">${d === 'all' ? 'Todos los documentos' : esc(d.replace(/\.(pdf|docx)$/i, '').slice(0, 34))}</button>`)
        .join('');
      chips.dataset.ready = '1';
      chips.addEventListener('click', e => {
        const b = e.target.closest('.chip'); if (!b) return;
        galFilter = b.dataset.doc;
        $$('.chip', chips).forEach(c => c.classList.toggle('on', c === b));
        galShown = 0;
        paintGallery();
      });
    }
    galShown = 0;
    paintGallery();
  }

  function galList() {
    return galFilter === 'all' ? IMGS : IMGS.filter(i => i.s === galFilter);
  }

  function paintGallery() {
    const all = galList();
    const start = galShown;
    const firstBatch = start === 0;
    const visible = all.slice(0, start + GAL_STEP);
    galShown = visible.length;
    $('#galCount').textContent = `${all.length} imágenes · mostrando ${visible.length}`;
    $('#galGrid').innerHTML = visible.map((im, idx) => `
      <figure class="gal-item" data-idx="${idx}" tabindex="0">
        <img src="assets/img/${encodeURIComponent(im.f)}" alt="" loading="${firstBatch ? 'eager' : 'lazy'}" decoding="async" width="${im.w || 600}" height="${im.h || 800}" />
        <figcaption>${esc(im.s.replace(/\.(pdf|docx)$/i, ''))}${im.p ? ' · pág. ' + im.p : ''}</figcaption>
      </figure>`).join('');
    $('#galMore').classList.toggle('hidden', visible.length >= all.length);
  }

  $('#galMore').addEventListener('click', paintGallery);

  function openLightbox(idx) {
    const all = galList();
    const im = all[idx];
    if (!im) return;
    $('#lbImg').src = 'assets/img/' + encodeURIComponent(im.f);
    $('#lbCap').textContent = im.s.replace(/\.(pdf|docx)$/i, '') + (im.p ? ' · página ' + im.p : '');
    $('#lightbox').classList.remove('hidden');
  }
  const closeLightbox = () => { $('#lightbox').classList.add('hidden'); $('#lbImg').src = ''; };
  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
  $('#galGrid').addEventListener('click', e => {
    const fig = e.target.closest('.gal-item');
    if (fig) openLightbox(Number(fig.dataset.idx));
  });
  $('#galGrid').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const fig = e.target.closest('.gal-item');
    if (fig) { e.preventDefault(); openLightbox(Number(fig.dataset.idx)); }
  });

  /* ---------- progreso ---------- */
  function renderProgress() {
    $('#areaBars').innerHTML = Object.entries(AREAS).map(([k, v]) => {
      const pool = BANK.filter(q => q.area === k);
      const done = pool.filter(q => meta(q.id).box >= 4).length;
      const pct = pool.length ? (done / pool.length) * 100 : 0;
      return `<div class="bar-row"><span>${v.emoji} ${v.label}</span><span>${done}/${pool.length}</span>
        <div class="bar-track"><i style="width:${pct}%"></i></div></div>`;
    }).join('');

    $('#historyList').innerHTML = state.history.slice(0, 20).map(h => {
      const q = byId.get(h.id);
      return `<li><span class="dot ${h.correct ? 'ok' : 'bad'}"></span><span>${esc((q?.enunciado || h.id).slice(0, 70))}…</span></li>`;
    }).join('') || '<li class="muted">Aún no hay respuestas registradas.</li>';

    $('#dueCount').textContent = dueIds().length;
    renderWeak();
    renderPlan();
  }

  /* ---------- estadísticas por tema ---------- */
  function topicOf(q) {
    const t = (q.tema || 'Sin tema').split('·')[0].trim();
    return t || 'Sin tema';
  }

  function topicStats() {
    const map = new Map();
    for (const q of BANK) {
      const m = meta(q.id);
      if (!m.seen) continue;
      const t = topicOf(q);
      const row = map.get(t) || { topic: t, seen: 0, ok: 0, bad: 0 };
      row.seen += m.seen;
      row.ok += m.ok;
      row.bad += m.bad;
      map.set(t, row);
    }
    return [...map.values()].map(r => ({ ...r, acc: r.ok + r.bad ? r.ok / (r.ok + r.bad) : 0 }));
  }

  function renderWeak() {
    const box = $('#weakList');
    const rows = topicStats().sort((a, b) => a.acc - b.acc || b.seen - a.seen).slice(0, 8);
    if (!rows.length) {
      box.innerHTML = '<p class="muted">Aún no hay datos. Responde algunas preguntas.</p>';
      return;
    }
    box.innerHTML = rows.map(r => `
      <div class="bar-row">
        <span>${esc(r.topic)}</span>
        <span>${Math.round(r.acc * 100)}% <em class="muted">(${r.seen})</em></span>
        <div class="bar-track"><i class="weak" style="width:${Math.round(r.acc * 100)}%"></i></div>
      </div>`).join('');
  }

  /* ---------- plan semanal ---------- */
  function weekKey() {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    return monday.toISOString().slice(0, 10);
  }

  function ensurePlan(force) {
    const week = weekKey();
    if (!force && state.plan && state.plan.week === week) return state.plan;

    const stats = topicStats();
    let topics;
    if (stats.length) {
      topics = stats.sort((a, b) => a.acc - b.acc || b.seen - a.seen).slice(0, 5).map(s => s.topic);
    } else {
      // sin historial: arranca por los temas con más preguntas
      const count = new Map();
      for (const q of BANK) {
        const t = topicOf(q);
        count.set(t, (count.get(t) || 0) + 1);
      }
      topics = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
    }

    const days = topics.map((topic, i) => ({ day: i + 1, kind: 'topic', topic }));
    days.push({ day: 6, kind: 'review', topic: 'Repaso de tus errores' });
    days.push({ day: 7, kind: 'simulacro', topic: 'Simulacro libre' });

    state.plan = { week, days, created: Date.now() };
    save();
    return state.plan;
  }

  function idsForPlanDay(d) {
    if (d.kind === 'review') return dueIds().slice(0, 15);
    if (d.kind === 'simulacro') return shuffle(BANK.map(q => q.id)).slice(0, 20);
    return BANK.filter(q => topicOf(q) === d.topic).map(q => q.id).slice(0, 15);
  }

  function renderPlan() {
    const plan = ensurePlan(false);
    const box = $('#planList');
    box.innerHTML = plan.days.map(d => {
      const ids = idsForPlanDay(d);
      return `<div class="plan-row">
        <span class="plan-day">D${d.day}</span>
        <span class="plan-topic">${esc(d.topic)}<em>${ids.length} preguntas</em></span>
        <button class="btn subtle small" data-day="${d.day}" ${ids.length ? '' : 'disabled'}>Practicar</button>
      </div>`;
    }).join('');
    box.querySelectorAll('button[data-day]').forEach(b => {
      b.addEventListener('click', () => {
        const d = plan.days.find(x => String(x.day) === b.dataset.day);
        const ids = idsForPlanDay(d);
        const qs = ids.map(id => byId.get(id)).filter(Boolean);
        if (qs.length) startSession(d.kind === 'simulacro' ? shuffle(qs) : qs, { mode: d.kind === 'simulacro' ? 'simulacro' : 'quiz', minutes: 20 });
      });
    });
  }

  $('#planRegen').addEventListener('click', () => {
    ensurePlan(true);
    renderPlan();
  });

  /* ---------- exportar / importar ---------- */
  $('#exportBtn').addEventListener('click', () => {
    const payload = { app: 'academia-ces', version: 1, exported: new Date().toISOString(), state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academia-ces-progreso-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = data.state && data.state.cards ? data.state : data;
      if (!incoming.cards || typeof incoming.cards !== 'object') throw new Error('formato');
      const n = Object.keys(incoming.cards).length;
      if (!confirm(`Importar ${n} preguntas con avance. Esto reemplaza tu progreso actual. ¿Continuar?`)) return;
      state = Object.assign(defaultState(), incoming);
      save();
      renderDashboard();
      renderProgress();
      alert('Progreso importado.');
    } catch (err) {
      alert('No se pudo importar: el archivo no tiene el formato esperado.');
    } finally {
      e.target.value = '';
    }
  });
  $('#reviewBtn').addEventListener('click', () => {
    const ids = new Set(dueIds());
    const qs = BANK.filter(q => ids.has(q.id));
    if (!qs.length) return alert('No tienes preguntas pendientes. ¡Sigue avanzando!');
    startSession(shuffle(qs), { mode: 'quiz' });
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('¿Borrar todo tu avance local?')) return;
    state = defaultState(); save(); renderDashboard(); renderProgress();
    alert('Avance reiniciado.');
  });

  /* ---------- motor de sesión ---------- */
  let S = null;

  function startSession(questions, opt = {}) {
    if (!questions.length) return;
    const mode = opt.mode || 'quiz';
    S = {
      mode,
      qs: questions,
      i: 0,
      answered: 0,
      correct: 0,
      wrongIds: [],
      selected: null,
      locked: false,
      t0: Date.now(),
      timerId: null,
      exam: mode === 'simulacro',
      endAt: mode === 'simulacro' ? Date.now() + (opt.minutes || 12) * 60000 : null,
    };
    if (mode === 'flash') { show('flash'); renderFlash(); return; }
    show('quiz');
    $('#quizTimer').classList.toggle('hidden', !S.exam);
    $('#quizCount').textContent = `1/${questions.length}`;
    if (S.exam) startTimer();
    renderQuestion();
  }

  function startTimer() {
    const tick = () => {
      if (!S || !S.exam) return;
      const left = Math.max(0, S.endAt - Date.now());
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      $('#quizTimer').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (left <= 0) { finish(); return; }
      S.timerId = requestAnimationFrame(tick);
    };
    tick();
  }
  function stopTimer() { if (S?.timerId) cancelAnimationFrame(S.timerId); }

  function renderQuestion() {
    const q = S.qs[S.i];
    S.selected = null; S.locked = false;
    $('#qArea').textContent = (AREAS[q.area]?.emoji || '') + ' ' + (AREAS[q.area]?.label || q.area);
    $('#qYear').textContent = q.fuente || '—';
    $('#qTema').textContent = q.tema || '';
    const v = $('#qVerif');
    v.textContent = q.verificado === false ? '⚠ Por verificar' : '✓ Verificada';
    v.className = 'pill ' + (q.verificado === false ? 'warn' : 'ok');
    $('#qStem').textContent = q.enunciado;
    $('#qHint').textContent = q.pista ? '💡 ' + q.pista : '';
    $('#qHint').classList.add('hidden');
    $('#hintBtn').textContent = '💡 Ver pista';
    $('#feedback').classList.add('hidden');
    $('#checkBtn').classList.remove('hidden');
    $('#checkBtn').disabled = true;
    $('#nextBtn').classList.add('hidden');
    $('#quizBar').style.width = ((S.i) / S.qs.length) * 100 + '%';
    $('#quizCount').textContent = `${S.i + 1}/${S.qs.length}`;

    $('#qOptions').innerHTML = q.opciones.map((o, idx) =>
      `<button class="opt" data-idx="${idx}"><span class="key">${'ABCD'[idx]}</span><span>${esc(o)}</span></button>`
    ).join('');
    if (q.img) {
      const img = document.createElement('img');
      img.className = 'q-image';
      img.src = q.img;
      img.alt = 'Imagen de referencia de la pregunta';
      img.loading = 'eager';
      img.decoding = 'async';
      $('#qOptions').before(img);
    } else {
      $$('.q-image', $('#qCard')).forEach(n => n.remove());
    }
  }

  $('#qOptions').addEventListener('click', e => {
    const b = e.target.closest('.opt');
    if (!b || S.locked) return;
    S.selected = Number(b.dataset.idx);
    $$('.opt', $('#qOptions')).forEach(o => o.classList.toggle('sel', o === b));
    $('#checkBtn').disabled = false;
  });

  $('#hintBtn').addEventListener('click', () => {
    const h = $('#qHint');
    h.classList.toggle('hidden');
    $('#hintBtn').textContent = h.classList.contains('hidden') ? '💡 Ver pista' : '💡 Ocultar pista';
  });

  $('#speakBtn').addEventListener('click', () => {
    const q = S.qs[S.i];
    speak(`${q.enunciado}. Opciones: ${q.opciones.map((o, i) => `${'ABCD'[i]}, ${o}`).join('. ')}`);
  });
  $('#fbSpeak').addEventListener('click', () => {
    const q = S.qs[S.i];
    speak(`Respuesta correcta: ${'ABCD'[q.correcta]}. ${q.opciones[q.correcta]}. ${q.explicacion || ''}`);
  });

  $('#checkBtn').addEventListener('click', () => {
    if (S.selected == null || S.locked) return;
    const q = S.qs[S.i];
    const ok = S.selected === q.correcta;
    S.locked = true;
    S.answered += 1;
    if (ok) S.correct += 1; else S.wrongIds.push(q.id);
    record(q.id, ok);

    $$('.opt', $('#qOptions')).forEach(o => {
      const idx = Number(o.dataset.idx);
      o.disabled = true;
      if (idx === q.correcta) o.classList.add('correct');
      else if (idx === S.selected) o.classList.add('wrong');
      o.classList.remove('sel');
    });

    const fb = $('#feedback');
    fb.classList.remove('hidden');
    fb.classList.toggle('ok', ok);
    fb.classList.toggle('bad', !ok);
    $('#fbIcon').textContent = ok ? '✓' : '✕';
    $('#fbTitle').textContent = ok ? 'Correcto' : 'Casi — la clave es ' + 'ABCD'[q.correcta];
    $('#fbText').textContent = q.explicacion || 'Sin explicación registrada para esta pregunta.';
    $('#checkBtn').classList.add('hidden');
    $('#nextBtn').classList.remove('hidden');
    $('#quizBar').style.width = ((S.i + 1) / S.qs.length) * 100 + '%';

    if (S.exam) {
      // en simulacro no mostramos corrección hasta el final
      fb.classList.add('hidden');
      setTimeout(() => { if (S && S.exam) nextQuestion(); }, 120);
    }
  });

  $('#nextBtn').addEventListener('click', nextQuestion);
  function nextQuestion() {
    if (!S) return;
    S.i += 1;
    if (S.i >= S.qs.length) return finish();
    renderQuestion();
  }

  $('#quitBtn').addEventListener('click', () => {
    if (S && S.answered && !confirm('¿Salir de la sesión? Tu avance parcial queda guardado.')) return;
    stopTimer(); S = null; renderDashboard(); show('dashboard');
  });

  /* ---------- resultados ---------- */
  function finish() {
    if (!S) return;
    stopTimer();
    const total = S.answered || 0;
    const acc = total ? S.correct / total : 0;
    $('#resTitle').textContent = acc >= 0.8 ? '¡Excelente trabajo!' : acc >= 0.5 ? 'Buen ritmo, sigue así' : 'Esto es parte del proceso';
    $('#resCorrect').textContent = S.correct;
    $('#resWrong').textContent = S.wrongIds.length;
    $('#resScore').textContent = fmtPct(acc);
    const secs = Math.round((Date.now() - S.t0) / 1000);
    $('#resTime').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    $('#resReview').disabled = !S.wrongIds.length;
    const wrong = S.wrongIds.slice();
    $('#resReview').onclick = () => {
      const qs = wrong.map(id => byId.get(id)).filter(Boolean);
      if (qs.length) startSession(shuffle(qs), { mode: 'quiz' });
    };
    S = null;
    renderDashboard();
    show('results');
  }
  $('#resHome').addEventListener('click', () => { renderDashboard(); show('dashboard'); });

  /* ---------- flashcards ---------- */
  let F = null;
  function startFlash(questions) {
    if (!questions.length) return;
    F = { qs: shuffle(questions), i: 0, again: 0, good: 0 };
    show('flash');
    renderFlash();
  }
  function renderFlash() {
    const q = F.qs[F.i];
    const card = $('#flashcard');
    card.classList.remove('flipped');
    $('#flashArea').textContent = (AREAS[q.area]?.emoji || '') + ' ' + (AREAS[q.area]?.label || q.area);
    $('#flashQ').textContent = q.enunciado;
    $('#flashAnswer').textContent = 'Clave: ' + 'ABCD'[q.correcta] + ' · ' + q.opciones[q.correcta];
    $('#flashWhy').textContent = q.explicacion || '';
    $('#flashCount').textContent = `${F.i + 1}/${F.qs.length}`;
    $('#flashBar').style.width = (F.i / F.qs.length) * 100 + '%';
  }
  const flip = () => { const c = $('#flashcard'); c.classList.toggle('flipped'); };
  $('#flashcard').addEventListener('click', flip);
  $('#flashcard').addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
  });
  $('#flashSpeak').addEventListener('click', e => {
    e.stopPropagation();
    const q = F.qs[F.i];
    speak(q.opciones[q.correcta] + '. ' + (q.explicacion || ''));
  });
  function flashNext(known) {
    const q = F.qs[F.i];
    record(q.id, known);
    if (known) F.good++; else F.again++;
    F.i++;
    if (F.i >= F.qs.length) {
      const total = F.good + F.again;
      $('#resTitle').textContent = 'Repaso completado';
      $('#resCorrect').textContent = F.good;
      $('#resWrong').textContent = F.again;
      $('#resScore').textContent = fmtPct(total ? F.good / total : 0);
      $('#resTime').textContent = '—';
      $('#resReview').disabled = true;
      F = null; renderDashboard(); show('results');
      return;
    }
    renderFlash();
  }
  $('#flashGood').addEventListener('click', () => flashNext(true));
  $('#flashAgain').addEventListener('click', () => flashNext(false));
  $('#quitFlash').addEventListener('click', () => { F = null; renderDashboard(); show('dashboard'); });

  /* ---------- arranques desde el dashboard ---------- */
  $$('.mode-card').forEach(card => card.addEventListener('click', () => {
    const mode = card.dataset.start;
    const area = card.dataset.area;
    let pool = area === 'all' ? BANK.slice() : BANK.filter(q => q.area === area);
    if (!pool.length) return alert('Aún no hay preguntas en esta área.');
    if (mode === 'flashcards') return startFlash(pool);
    if (mode === 'simulacro') {
      const qs = shuffle(pool).slice(0, Math.min(20, pool.length));
      return startSession(qs, { mode: 'simulacro', minutes: Math.max(5, Math.round(qs.length * 0.6)) });
    }
    startSession(shuffle(pool).slice(0, Math.min(10, pool.length)), { mode: 'quiz' });
  }));

  $('#continueBtn').addEventListener('click', () => {
    const due = dueIds().map(id => byId.get(id)).filter(Boolean);
    const pool = due.length ? due : BANK;
    startSession(shuffle(pool).slice(0, 10), { mode: 'quiz' });
  });
  $('#randomBtn').addEventListener('click', () => startSession(shuffle(BANK).slice(0, 10), { mode: 'quiz' }));

  /* ---------- atajos globales ---------- */
  document.addEventListener('keydown', e => {
    if (!S || S.mode === 'flash') return;
    if ($('#view-quiz').classList.contains('hidden')) return;
    if (['1', '2', '3', '4'].includes(e.key)) {
      const b = $$('.opt', $('#qOptions'))[Number(e.key) - 1];
      if (b && !S.locked) b.click();
    } else if (e.key === 'Enter') {
      if (!$('#checkBtn').classList.contains('hidden') && !$('#checkBtn').disabled) $('#checkBtn').click();
      else if (!$('#nextBtn').classList.contains('hidden')) $('#nextBtn').click();
    } else if (e.key.toLowerCase() === 'h') $('#hintBtn').click();
    else if (e.key.toLowerCase() === 's' && !$('#nextBtn').classList.contains('hidden')) $('#nextBtn').click();
  });

  /* ---------- boot ---------- */
  async function boot() {
    applyTheme();
    try {
      const res = await fetch('data/questions.json', { cache: 'no-cache' });
      BANK = await res.json();
    } catch (err) {
      console.error(err);
      $('#bankInfo').textContent = 'No se pudo cargar el banco de preguntas.';
      return;
    }
    byId = new Map(BANK.map(q => [q.id, q]));
    renderDashboard();
    renderLibrary();
    show('dashboard');
  }

  boot();
})();
