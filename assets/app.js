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
  const views = ['dashboard', 'biblioteca', 'progreso', 'quiz', 'flash', 'results'];
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
  }

  /* ---------- biblioteca ---------- */
  let libFilter = 'all', libQuery = '';
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
    paintLibrary();
  }
  function paintLibrary() {
    const q = libQuery.toLowerCase();
    const list = BANK.filter(x =>
      (libFilter === 'all' || x.area === libFilter) &&
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
  }
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
