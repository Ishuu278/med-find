/**
 * app.js — MedFind frontend
 * Modules: utils | api | state | router | components | views
 *
 * Architecture: plain ES6 modules in one file, each section clearly delimited.
 * No build step, no framework, no global variable soup.
 */

'use strict';

/* ============================================================
   UTILS
   ============================================================ */
const utils = (() => {
  /** Safely set text content, prevents XSS. */
  function setText(el, text) {
    if (el) el.textContent = String(text ?? '');
  }

  /** Escape a string for safe HTML insertion (use sparingly; prefer textContent). */
  function escape(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Format minutes into human-readable ago string. */
  function formatAgo(minutes) {
    if (minutes < 1)   return 'Just now';
    if (minutes < 60)  return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)    return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  /** Debounce a function. */
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /** Announce a message to screen readers via the live region. */
  function announce(msg) {
    const el = document.getElementById('aria-announcer');
    if (!el) return;
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = msg; });
  }

  /** Create an element with optional className and textContent. */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /** Format a countdown from total seconds to mm:ss. */
  function formatCountdown(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  return { setText, escape, formatAgo, debounce, announce, el, formatCountdown };
})();


/* ============================================================
   API  — centralised fetch with timeout, credentials, errors
   ============================================================ */
const api = (() => {
  const TIMEOUT_MS = 12000;

  async function request(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const opts = {
      method,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body != null) opts.body = JSON.stringify(body);

    try {
      const res = await fetch(path, opts);
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error('Request timed out. Check your connection.');
      throw err;
    }
  }

  const get  = (path)        => request('GET',  path);
  const post = (path, body)  => request('POST', path, body);

  return {
    search:     (q, lat, lon) => get(`/api/search?q=${encodeURIComponent(q)}&lat=${lat}&lon=${lon}`),
    login:      (body)        => post('/api/login', body),
    logout:     ()            => post('/api/logout'),
    session:    ()            => get('/api/session'),
    inventory:  (id)          => get(`/api/pharmacy/${id}/inventory`),
    updateStock:(id, body)    => post(`/api/pharmacy/${id}/inventory`, body),
    reserve:    (body)        => post('/api/reserve', body),
  };
})();


/* ============================================================
   STATE  — single source of truth
   ============================================================ */
const state = (() => {
  let _state = {
    session:    { logged_in: false, pharmacy_id: null, name: null },
    location:   { lat: 20.2961, lon: 85.8245, isDefault: true },
    search:     { query: '', results: [], filtered: [], status: 'idle' }, // idle | loading | done | error
    filters:    { openOnly: false, hideOutOfStock: false, sort: 'score' },
    inventory:  { items: [], status: 'idle', filter: '', staleOnly: false },
  };

  const listeners = new Set();

  function get() { return _state; }

  function set(partial) {
    _state = deepMerge(_state, partial);
    listeners.forEach(fn => fn(_state));
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function deepMerge(target, source) {
    const out = Object.assign({}, target);
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        out[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        out[key] = source[key];
      }
    }
    return out;
  }

  return { get, set, subscribe };
})();


/* ============================================================
   TOAST
   ============================================================ */
const toast = (() => {
  const SVG = {
    success: `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="#0B9F5F" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>`,
    error:   `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="#0F9D8A" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  function show(type, title, desc, duration = 4000) {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.innerHTML = `${SVG[type] || SVG.info}
      <div class="toast__body">
        <div class="toast__title"></div>
        ${desc ? '<div class="toast__desc"></div>' : ''}
      </div>`;
    t.querySelector('.toast__title').textContent = title;
    if (desc) t.querySelector('.toast__desc').textContent = desc;
    container.appendChild(t);

    setTimeout(() => {
      t.classList.add('toast--leaving');
      t.addEventListener('animationend', () => t.remove(), { once: true });
    }, duration);
  }

  return {
    success: (title, desc) => show('success', title, desc),
    error:   (title, desc) => show('error',   title, desc),
    warning: (title, desc) => show('warning', title, desc),
    info:    (title, desc) => show('info',    title, desc),
  };
})();


/* ============================================================
   COMPONENTS — reusable DOM builders
   ============================================================ */
const components = (() => {

  /* ---- Availability badge ---- */
  function availBadge(avail, quantity) {
    const map = {
      in_stock:     { cls: 'badge--green', icon: '●', label: 'In Stock' },
      low_stock:    { cls: 'badge--amber', icon: '●', label: `Only ${quantity} left` },
      out_of_stock: { cls: 'badge--red',   icon: '●', label: 'Out of Stock' },
    };
    const cfg = map[avail] || map.out_of_stock;
    const b = document.createElement('span');
    b.className = `badge ${cfg.cls}`;
    b.setAttribute('aria-label', cfg.label);
    b.textContent = `${cfg.icon} ${cfg.label}`;
    return b;
  }

  /* ---- Open/Closed badge ---- */
  function openBadge(isOpen) {
    const b = document.createElement('span');
    b.className = `badge ${isOpen ? 'badge--green' : 'badge--muted'}`;
    b.textContent = isOpen ? '● Open' : '● Closed';
    return b;
  }

  /* ---- Freshness indicator ---- */
  function freshnessItem(freshness, minutes) {
    const label = utils.formatAgo(minutes);
    const tooltipMap = {
      fresh: 'Stock data is up to date.',
      aging:  'Stock data is a few hours old. May have changed.',
      stale:  'This stock info may be outdated. Call to confirm.',
    };
    const div = document.createElement('div');
    div.className = 'meta-item';
    div.setAttribute('data-tooltip', tooltipMap[freshness] || '');
    div.setAttribute('aria-label', `Updated ${label}, freshness: ${freshness}`);

    const dot = document.createElement('span');
    dot.className = `freshness-dot freshness-dot--${freshness}`;
    dot.setAttribute('aria-hidden', 'true');

    const span = document.createElement('span');
    span.textContent = `Updated ${label}`;

    div.append(dot, span);
    return div;
  }

  /* ---- Score ring ---- */
  function scoreRing(score) {
    const pct = Math.round(score * 100);
    const r = 14; const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    const color = pct >= 70 ? 'var(--clr-green)' : pct >= 40 ? 'var(--clr-amber)' : 'var(--clr-red)';

    const wrapper = document.createElement('div');
    wrapper.className = 'result-card__score-wrapper';
    wrapper.setAttribute('data-tooltip', 'Ranked by availability, data freshness, distance and opening status.');
    wrapper.setAttribute('aria-label', `Match score: ${pct}%`);

    wrapper.innerHTML = `
      <div class="score-ring" aria-hidden="true">
        <svg width="36" height="36" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="${r}" fill="none" stroke="var(--clr-border)" stroke-width="3"/>
          <circle cx="18" cy="18" r="${r}" fill="none" stroke="${color}" stroke-width="3"
            stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
            stroke-linecap="round"/>
        </svg>
        <div class="score-ring__text">${pct}%</div>
      </div>
      <span>Match</span>`;
    return wrapper;
  }

  /* ---- Skeleton card ---- */
  function skeletonCard() {
    const card = document.createElement('div');
    card.className = 'card skeleton-card';
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML = `
      <div class="skeleton skeleton-line skeleton-line--lg skeleton-line--mid"></div>
      <div class="skeleton skeleton-line skeleton-line--short"></div>
      <div class="skeleton skeleton-line" style="height:48px;border-radius:8px;"></div>
      <div style="display:flex;gap:12px;">
        <div class="skeleton skeleton-line" style="width:30%;"></div>
        <div class="skeleton skeleton-line" style="width:25%;"></div>
        <div class="skeleton skeleton-line" style="width:20%;"></div>
      </div>`;
    return card;
  }

  /* ---- Result card ---- */
  function resultCard(item, index) {
    const card = document.createElement('div');
    card.className = `card result-card${index === 0 ? ' result-card--best' : ''}${item.availability === 'out_of_stock' ? ' result-card--out-of-stock' : ''}`;
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', `${item.pharmacy}: ${item.medicine} ${item.strength}`);

    // Header
    const header = document.createElement('div');
    header.className = 'result-card__header';

    const info = document.createElement('div');
    info.className = 'result-card__pharmacy-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'result-card__pharmacy-name';
    nameEl.textContent = item.pharmacy;
    const addrEl = document.createElement('div');
    addrEl.className = 'result-card__address';
    addrEl.textContent = item.address;
    info.append(nameEl, addrEl);

    const badges = document.createElement('div');
    badges.className = 'result-card__badges';
    if (index === 0) {
      const best = document.createElement('span');
      best.className = 'badge badge--primary';
      best.textContent = '★ Best Match';
      badges.append(best);
    }
    badges.append(openBadge(item.is_open));
    header.append(info, badges);

    // Medicine
    const medRow = document.createElement('div');
    medRow.className = 'result-card__medicine';
    const pillIcon = document.createElement('span');
    pillIcon.setAttribute('aria-hidden', 'true');
    pillIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 32 32" fill="none"><rect x="2" y="10" width="28" height="12" rx="6" fill="var(--clr-primary)" opacity=".18"/><line x1="16" y1="10" x2="16" y2="22" stroke="var(--clr-primary)" stroke-width="2.5" stroke-linecap="round"/></svg>`;
    const medName = document.createElement('span');
    medName.className = 'result-card__medicine-name';
    medName.textContent = `${item.medicine} ${item.strength}`;
    const medForm = document.createElement('span');
    medForm.className = 'result-card__medicine-detail';
    medForm.textContent = item.form;
    medRow.append(pillIcon, medName, medForm);

    // Availability
    medRow.append(availBadge(item.availability, item.quantity));

    // Meta
    const meta = document.createElement('div');
    meta.className = 'result-card__meta';

    // Distance
    const distItem = document.createElement('div');
    distItem.className = 'meta-item';
    distItem.setAttribute('aria-label', `${item.distance_km} km away`);
    distItem.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
    const distSpan = document.createElement('span');
    distSpan.textContent = `${item.distance_km} km away`;
    distItem.append(distSpan);

    meta.append(distItem, freshnessItem(item.freshness, item.last_updated_minutes_ago));

    // Footer
    const footer = document.createElement('div');
    footer.className = 'result-card__footer';
    footer.append(scoreRing(item.score));

    const reserveBtn = document.createElement('button');
    reserveBtn.className = 'btn btn--primary btn--sm';
    reserveBtn.disabled = item.availability === 'out_of_stock';
    reserveBtn.setAttribute('aria-label', `Reserve ${item.medicine} at ${item.pharmacy}`);
    reserveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> Reserve`;
    reserveBtn.addEventListener('click', () => {
      if (item.availability !== 'out_of_stock') {
        modal.openReserve(item);
      }
    });
    footer.append(reserveBtn);

    card.append(header, medRow, meta, footer);
    return card;
  }

  return { availBadge, openBadge, freshnessItem, scoreRing, skeletonCard, resultCard };
})();


/* ============================================================
   MODAL — Reserve flow
   ============================================================ */
const modal = (() => {
  const backdrop = document.getElementById('reserve-modal-backdrop');
  const closeBtn  = document.getElementById('reserve-modal-close');
  const content   = document.getElementById('reserve-modal-content');
  let focusBeforeModal = null;
  let countdownTimer = null;

  function open() {
    backdrop.hidden = false;
    focusBeforeModal = document.activeElement;
    requestAnimationFrame(() => {
      const firstFocusable = backdrop.querySelector('button, input, [tabindex="0"]');
      if (firstFocusable) firstFocusable.focus();
    });
    document.addEventListener('keydown', trapFocus);
  }

  function close() {
    backdrop.hidden = true;
    document.removeEventListener('keydown', trapFocus);
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (focusBeforeModal) focusBeforeModal.focus();
  }

  function trapFocus(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const focusable = [...backdrop.querySelectorAll('button:not([disabled]), input, select, textarea, [tabindex="0"]')];
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  function openReserve(item) {
    const maxQty = item.availability === 'low_stock' ? item.quantity : 99;

    content.innerHTML = '';
    const titleEl = utils.el('h2', 'modal__title', 'Reserve Medicine');
    const subtitleEl = utils.el('p', 'modal__subtitle', 'Confirm your reservation details below.');

    // Info card
    const infoCard = document.createElement('div');
    infoCard.className = 'modal-info-card';
    const rows = [
      ['Pharmacy',  item.pharmacy],
      ['Medicine',  `${item.medicine} ${item.strength} ${item.form}`],
      ['Address',   item.address],
      ['Available', item.availability === 'low_stock' ? `Only ${item.quantity} left` : 'In Stock'],
    ];
    rows.forEach(([label, val]) => {
      const row = document.createElement('div');
      row.className = 'modal-info-row';
      const l = utils.el('span', '', label);
      const v = utils.el('strong', '', val);
      row.append(l, v);
      infoCard.append(row);
    });

    // Quantity
    const qtyLabel = utils.el('label', 'form-label', 'Quantity');
    qtyLabel.setAttribute('for', 'reserve-qty-input');

    const stepper = document.createElement('div');
    stepper.className = 'qty-stepper';

    const minusBtn = document.createElement('button');
    minusBtn.className = 'qty-stepper__btn';
    minusBtn.type = 'button';
    minusBtn.textContent = '−';
    minusBtn.setAttribute('aria-label', 'Decrease quantity');

    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'reserve-qty-input';
    input.className = 'qty-stepper__input';
    input.value = 1; input.min = 1; input.max = maxQty;
    input.setAttribute('aria-label', 'Quantity');

    const plusBtn = document.createElement('button');
    plusBtn.className = 'qty-stepper__btn';
    plusBtn.type = 'button';
    plusBtn.textContent = '+';
    plusBtn.setAttribute('aria-label', 'Increase quantity');

    stepper.append(minusBtn, input, plusBtn);

    function updateStepperBtns() {
      const v = parseInt(input.value, 10) || 1;
      minusBtn.disabled = v <= 1;
      plusBtn.disabled  = v >= maxQty;
    }
    updateStepperBtns();

    minusBtn.addEventListener('click', () => {
      const v = parseInt(input.value, 10) || 1;
      if (v > 1) { input.value = v - 1; updateStepperBtns(); }
    });
    plusBtn.addEventListener('click', () => {
      const v = parseInt(input.value, 10) || 1;
      if (v < maxQty) { input.value = v + 1; updateStepperBtns(); }
    });
    input.addEventListener('input', updateStepperBtns);

    // Error area
    const errEl = utils.el('p', 'form-error', '');
    errEl.setAttribute('aria-live', 'polite');

    // Confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn--primary';
    confirmBtn.style.width = '100%';
    confirmBtn.style.marginTop = '20px';
    confirmBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Confirm Reservation`;

    confirmBtn.addEventListener('click', async () => {
      const qty = parseInt(input.value, 10);
      if (!qty || qty < 1) { errEl.textContent = 'Please enter a valid quantity.'; return; }
      if (qty > maxQty)    { errEl.textContent = `Maximum available: ${maxQty}.`; return; }

      confirmBtn.classList.add('btn--loading');
      confirmBtn.disabled = true;
      confirmBtn.querySelector('svg').style.opacity = '0';
      errEl.textContent = '';

      try {
        const result = await api.reserve({ pharmacy_id: item.pharmacy_id, medicine: item.medicine, quantity: qty });
        showSuccess(result);
      } catch (err) {
        errEl.textContent = err.message || 'Reservation failed. Please try again.';
        confirmBtn.classList.remove('btn--loading');
        confirmBtn.disabled = false;
        confirmBtn.querySelector('svg').style.opacity = '';
      }
    });

    content.append(titleEl, subtitleEl, infoCard, qtyLabel, stepper, errEl, confirmBtn);
    open();
  }

  function showSuccess(result) {
    content.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'reserve-success';
    div.innerHTML = `
      <div class="reserve-success__icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h2 class="reserve-success__title">Reservation Placed!</h2>
      <p class="reserve-success__message"></p>
      <div class="reserve-success__id"></div>
      <div class="countdown" aria-live="polite">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Pharmacy has <span class="countdown__time">30:00</span> to confirm
      </div>`;

    div.querySelector('.reserve-success__message').textContent = result.message || '';
    div.querySelector('.reserve-success__id').textContent = result.request_id || '';

    const closeReserveBtn = document.createElement('button');
    closeReserveBtn.className = 'btn btn--secondary';
    closeReserveBtn.style.cssText = 'width:100%;margin-top:20px;';
    closeReserveBtn.textContent = 'Close';
    closeReserveBtn.addEventListener('click', close);
    div.append(closeReserveBtn);

    content.append(div);
    utils.announce(`Reservation placed. Request ID: ${result.request_id}`);

    // Countdown
    let secs = 30 * 60;
    const countEl = content.querySelector('.countdown__time');
    countdownTimer = setInterval(() => {
      secs--;
      if (secs <= 0) { clearInterval(countdownTimer); countEl.textContent = 'Expired'; return; }
      countEl.textContent = utils.formatCountdown(secs);
    }, 1000);
  }

  return { openReserve, close };
})();


/* ============================================================
   VIEWS — render each page into #app-root
   ============================================================ */
const views = (() => {
  const root = document.getElementById('app-root');

  function render(html) {
    root.innerHTML = html;
    root.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  /* ----------------------------------------------------------
     HOME VIEW
     ---------------------------------------------------------- */
  function home() {
    const s = state.get();
    root.innerHTML = '';

    /* Hero */
    const hero = document.createElement('section');
    hero.className = 'hero';
    hero.setAttribute('aria-label', 'Search for medicine');
    hero.innerHTML = `
      <div class="hero__layout">
        <div class="hero__inner">
          <div class="hero__eyebrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 32 32" fill="none"><rect x="2" y="10" width="28" height="12" rx="6" fill="currentColor"/><line x1="16" y1="10" x2="16" y2="22" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>
            Real-time medicine availability
          </div>
          <h1 class="hero__title">Find your medicine<br/><span>in minutes, not hours</span></h1>
          <p class="hero__subtitle">Search 6 pharmacies near Bhubaneswar — see live stock, freshness, and distance.</p>

          <form class="search-bar" id="search-form" role="search" aria-label="Search medicines">
            <div class="search-bar__icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <input type="search" id="search-input" class="search-bar__input"
              placeholder="e.g. Paracetamol, Amoxicillin…" autocomplete="off"
              aria-label="Search medicine name" aria-autocomplete="list"
              value="${utils.escape(s.search.query)}" />
            <button type="submit" class="search-bar__btn" id="search-submit-btn" aria-label="Search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span class="btn-label">Search</span>
            </button>
          </form>

          <div class="location-row">
            <button class="use-location-btn" id="use-location-btn" type="button" aria-label="Use my current location">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              Use my location
            </button>
            <span class="location-note" id="location-note" aria-live="polite">
              ${s.location.isDefault ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Using default location: Bhubaneswar' : ''}
            </span>
          </div>

          <div class="suggestion-chips" role="list" aria-label="Quick medicine suggestions">
            ${['Paracetamol', 'Amoxicillin', 'Metformin', 'Cetirizine', 'Ibuprofen', 'Omeprazole']
              .map(n => `<button class="chip" role="listitem" type="button" data-chip="${utils.escape(n)}" aria-label="Search for ${utils.escape(n)}">${utils.escape(n)}</button>`)
              .join('')}
          </div>
        </div>
      </div>
    `;

    /* Results section */
    const resultsSection = document.createElement('section');
    resultsSection.className = 'results-section';
    resultsSection.setAttribute('aria-label', 'Search results');

    /* Filter bar */
    const filterBar = document.createElement('aside');
    filterBar.className = 'filter-bar';
    filterBar.setAttribute('aria-label', 'Filter and sort results');
    filterBar.innerHTML = `
      <div class="filter-bar__label" aria-hidden="true">Filters & Sort</div>
      <button class="filter-toggle${s.filters.openOnly ? ' active' : ''}" id="filter-open" type="button"
        aria-pressed="${s.filters.openOnly}" aria-label="Show only open pharmacies">
        <span class="toggle-dot" aria-hidden="true"></span> Open now
      </button>
      <button class="filter-toggle${s.filters.hideOutOfStock ? ' active' : ''}" id="filter-stock" type="button"
        aria-pressed="${s.filters.hideOutOfStock}" aria-label="Hide out of stock results">
        <span class="toggle-dot" aria-hidden="true"></span> In stock only
      </button>
      <div style="border-top:1px solid var(--clr-border);padding-top:10px;margin-top:2px;">
        <label for="sort-select" class="form-label" style="font-size:var(--text-xs);">Sort by</label>
        <select id="sort-select" class="sort-select" aria-label="Sort results by">
          <option value="score"    ${s.filters.sort === 'score'    ? 'selected' : ''}>Best Match</option>
          <option value="distance" ${s.filters.sort === 'distance' ? 'selected' : ''}>Nearest</option>
          <option value="freshness"${s.filters.sort === 'freshness'? 'selected' : ''}>Most Recent</option>
        </select>
      </div>`;

    /* Results main */
    const resultsMain = document.createElement('div');
    resultsMain.className = 'results-main';
    resultsMain.id = 'results-main';

    resultsSection.append(filterBar, resultsMain);
    root.append(hero, resultsSection);

    /* Attach events */
    bindSearchEvents();
    bindFilterEvents();
    renderResults();
  }

  function bindSearchEvents() {
    const form   = document.getElementById('search-form');
    const input  = document.getElementById('search-input');
    const locBtn = document.getElementById('use-location-btn');

    if (!form || !input) return;

    const doSearch = (q) => {
      q = q.trim();
      if (!q) return;
      state.set({ search: { query: q, status: 'loading', results: [], filtered: [] } });
      renderResults();
      const { lat, lon } = state.get().location;
      api.search(q, lat, lon)
        .then(data => {
          state.set({ search: { results: data, status: 'done' } });
          applyFilters();
          renderResults();
          utils.announce(`${data.length} result${data.length !== 1 ? 's' : ''} found for ${q}`);
        })
        .catch(err => {
          state.set({ search: { status: 'error', results: [], filtered: [] } });
          renderResults();
          utils.announce('Search failed. Please try again.');
        });
    };

    const debouncedSearch = utils.debounce((q) => {
      if (q.length >= 2) doSearch(q);
    }, 400);

    form.addEventListener('submit', e => { e.preventDefault(); doSearch(input.value); });
    input.addEventListener('input', () => debouncedSearch(input.value));

    // If there was a previous query, re-search
    const prevQ = state.get().search.query;
    if (prevQ) input.value = prevQ;

    // Chip clicks
    document.querySelectorAll('[data-chip]').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.dataset.chip;
        input.value = q;
        doSearch(q);
        chip.blur();
      });
    });

    // Geolocation
    if (locBtn) {
      locBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
          toast.warning('Geolocation unavailable', 'Using default location: Bhubaneswar.');
          return;
        }
        locBtn.disabled = true;
        locBtn.textContent = 'Getting location…';
        navigator.geolocation.getCurrentPosition(
          pos => {
            state.set({ location: { lat: pos.coords.latitude, lon: pos.coords.longitude, isDefault: false } });
            locBtn.disabled = false;
            locBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Location set`;
            const note = document.getElementById('location-note');
            if (note) note.textContent = '';
            toast.success('Location updated', 'Results will use your current position.');
            if (input.value.trim().length >= 2) doSearch(input.value.trim());
          },
          () => {
            locBtn.disabled = false;
            locBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Use my location`;
            toast.warning('Location denied', 'Using default location: Bhubaneswar.');
          }
        );
      });
    }
  }

  function bindFilterEvents() {
    const openToggle  = document.getElementById('filter-open');
    const stockToggle = document.getElementById('filter-stock');
    const sortSelect  = document.getElementById('sort-select');

    openToggle?.addEventListener('click', () => {
      const cur = state.get().filters.openOnly;
      state.set({ filters: { openOnly: !cur } });
      openToggle.classList.toggle('active', !cur);
      openToggle.setAttribute('aria-pressed', String(!cur));
      applyFilters(); renderResults();
    });

    stockToggle?.addEventListener('click', () => {
      const cur = state.get().filters.hideOutOfStock;
      state.set({ filters: { hideOutOfStock: !cur } });
      stockToggle.classList.toggle('active', !cur);
      stockToggle.setAttribute('aria-pressed', String(!cur));
      applyFilters(); renderResults();
    });

    sortSelect?.addEventListener('change', () => {
      state.set({ filters: { sort: sortSelect.value } });
      applyFilters(); renderResults();
    });
  }

  function applyFilters() {
    const { search, filters } = state.get();
    let arr = [...search.results];

    if (filters.openOnly)      arr = arr.filter(r => r.is_open);
    if (filters.hideOutOfStock)arr = arr.filter(r => r.availability !== 'out_of_stock');

    if (filters.sort === 'distance') arr.sort((a, b) => a.distance_km - b.distance_km);
    else if (filters.sort === 'freshness') arr.sort((a, b) => a.last_updated_minutes_ago - b.last_updated_minutes_ago);
    else arr.sort((a, b) => b.score - a.score);

    state.set({ search: { filtered: arr } });
  }

  function renderResults() {
    const main = document.getElementById('results-main');
    if (!main) return;
    main.innerHTML = '';

    const { search } = state.get();

    if (search.status === 'idle') {
      main.append(buildInitialState());
      return;
    }

    if (search.status === 'loading') {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 4; i++) frag.append(components.skeletonCard());
      main.append(frag);
      return;
    }

    if (search.status === 'error') {
      main.append(buildErrorState());
      return;
    }

    const results = search.filtered;

    if (results.length === 0 && search.status === 'done') {
      main.append(buildEmptyState(search.query));
      return;
    }

    // Results count header
    const hdr = document.createElement('div');
    hdr.className = 'results-header';
    hdr.setAttribute('aria-live', 'polite');
    hdr.setAttribute('aria-atomic', 'true');
    const countEl = document.createElement('p');
    countEl.className = 'results-count';
    countEl.innerHTML = `<strong>${results.length}</strong> ${results.length === 1 ? 'pharmacy' : 'pharmacies'} found for <strong>'${utils.escape(search.query)}'</strong>`;
    hdr.append(countEl);
    main.append(hdr);

    const grid = document.createElement('div');
    grid.className = 'results-grid';
    grid.setAttribute('role', 'list');
    results.forEach((item, i) => grid.append(components.resultCard(item, i)));
    main.append(grid);
  }

  function buildInitialState() {
    const div = document.createElement('div');
    div.className = 'initial-state';
    div.innerHTML = `
      <div class="empty-state__icon" aria-hidden="true" style="background:var(--clr-accent-light);color:var(--clr-accent-dark);margin:0 auto 20px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <h2 class="initial-state__title">Search for any medicine</h2>
      <p class="initial-state__desc">Type a medicine name above or pick a quick suggestion to see nearby pharmacy availability, stock levels, and data freshness.</p>`;
    return div;
  }

  function buildEmptyState(query) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.setAttribute('role', 'status');
    div.innerHTML = `
      <div class="empty-state__icon" aria-hidden="true" style="background:var(--clr-yellow-bg);color:var(--clr-yellow-text);margin:0 auto 20px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <h2 class="empty-state__title">No results found</h2>
      <p class="empty-state__desc">No pharmacy has <strong></strong> listed. Try a different spelling, a generic name, or remove active filters.</p>`;
    div.querySelector('strong').textContent = query;
    return div;
  }

  function buildErrorState() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.setAttribute('role', 'alert');
    div.innerHTML = `
      <div class="empty-state__icon" aria-hidden="true" style="background:var(--clr-red-bg);color:var(--clr-red)">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <h2 class="empty-state__title">Something went wrong</h2>
      <p class="empty-state__desc">Could not reach the server. Check your connection and try again.</p>`;
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn--primary';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => {
      const q = state.get().search.query;
      if (q) {
        state.set({ search: { status: 'loading' } });
        renderResults();
        const { lat, lon } = state.get().location;
        api.search(q, lat, lon)
          .then(data => { state.set({ search: { results: data, status: 'done' } }); applyFilters(); renderResults(); })
          .catch(() => { state.set({ search: { status: 'error' } }); renderResults(); });
      }
    });
    div.append(retryBtn);
    return div;
  }

  /* ----------------------------------------------------------
     LOGIN VIEW
     ---------------------------------------------------------- */
  function login() {
    root.innerHTML = '';
    const page = document.createElement('div');
    page.className = 'login-page page';

    const card = document.createElement('div');
    card.className = 'card login-card';

    card.innerHTML = `
      <div class="login-card__header">
        <div class="login-card__icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <h1 class="login-card__title">Pharmacy Login</h1>
        <p class="login-card__subtitle">Access your inventory dashboard</p>
      </div>

      <form class="login-form" id="login-form" novalidate>
        <div class="form-group">
          <label class="form-label" for="pharmacy-select">Pharmacy Name</label>
          <select class="form-select" id="pharmacy-select" name="pharmacy_name" required aria-required="true">
            <option value="" disabled selected>Select your pharmacy…</option>
            <option>MedPlus Pharmacy</option>
            <option>Apollo Pharmacy</option>
            <option>LifeCare Pharmacy</option>
            <option>Sunrise Medical</option>
            <option>City Chemist</option>
            <option>Wellness Pharmacy</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="pharmacy-password">Password</label>
          <div class="password-wrapper">
            <input class="form-input" type="password" id="pharmacy-password" name="password"
              autocomplete="current-password" required aria-required="true"
              placeholder="Enter password" />
            <button type="button" class="password-toggle" id="pw-toggle" aria-label="Show password" aria-pressed="false">
              <svg class="eye-show" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg class="eye-hide" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:none">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="demo-note" role="note" aria-label="Demo information">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Demo mode — all pharmacies use the same password. Ask the administrator for credentials.</span>
        </div>

        <div id="login-error" class="form-error" role="alert" aria-live="polite" style="display:none;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span id="login-error-text"></span>
        </div>

        <button type="submit" class="btn btn--primary" id="login-btn" style="width:100%">
          <span class="btn-text">Sign In</span>
        </button>
      </form>`;

    page.append(card);
    root.append(page);

    // Password toggle
    const pwToggle = document.getElementById('pw-toggle');
    const pwInput  = document.getElementById('pharmacy-password');
    pwToggle?.addEventListener('click', () => {
      const show = pwInput.type === 'password';
      pwInput.type = show ? 'text' : 'password';
      pwToggle.setAttribute('aria-pressed', String(show));
      pwToggle.querySelector('.eye-show').style.display = show ? 'none' : '';
      pwToggle.querySelector('.eye-hide').style.display = show ? '' : 'none';
    });

    // Form submit
    const form = document.getElementById('login-form');
    const errEl = document.getElementById('login-error');
    const errText = document.getElementById('login-error-text');
    const loginBtn = document.getElementById('login-btn');

    form?.addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('pharmacy-select').value;
      const pw   = pwInput.value;

      errEl.style.display = 'none';
      if (!name) { showErr('Please select your pharmacy.'); return; }
      if (!pw)   { showErr('Please enter your password.'); return; }

      loginBtn.classList.add('btn--loading');
      loginBtn.disabled = true;

      try {
        const data = await api.login({ pharmacy_name: name, password: pw });
        state.set({ session: { logged_in: true, pharmacy_id: data.pharmacy_id, name: data.name } });
        nav.updateAuth(true, data.name);
        toast.success('Logged in', `Welcome, ${data.name}!`);
        router.navigate('#/dashboard');
      } catch (err) {
        showErr(err.message || 'Login failed. Check your credentials.');
        loginBtn.classList.remove('btn--loading');
        loginBtn.disabled = false;
      }
    });

    function showErr(msg) {
      errText.textContent = msg;
      errEl.style.display = 'flex';
      utils.announce(msg);
    }
  }

  /* ----------------------------------------------------------
     DASHBOARD VIEW
     ---------------------------------------------------------- */
  async function dashboard() {
    root.innerHTML = '';

    const { session } = state.get();
    if (!session.logged_in) { router.navigate('#/login'); return; }

    const page = document.createElement('div');
    page.className = 'dashboard-page page';

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'dashboard-header';
    const titleEl = document.createElement('h1');
    titleEl.className = 'dashboard-title';
    titleEl.innerHTML = `Welcome, <span></span>`;
    titleEl.querySelector('span').textContent = session.name;
    hdr.append(titleEl);
    page.append(hdr);

    // Stat grid placeholder
    const statGrid = document.createElement('div');
    statGrid.className = 'stat-grid';
    statGrid.id = 'stat-grid';
    page.append(statGrid);

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'inventory-toolbar';
    toolbar.innerHTML = `
      <div class="inventory-search">
        <div class="inventory-search__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <input type="search" id="inv-search" class="inventory-search__input" placeholder="Filter medicines…" aria-label="Filter inventory by medicine name" />
      </div>
      <button class="filter-toggle" id="stale-only-btn" type="button" aria-pressed="false" aria-label="Show only stale inventory">
        <span class="toggle-dot" aria-hidden="true"></span> Needs update only
      </button>`;
    page.append(toolbar);

    // Inventory grid
    const invGrid = document.createElement('div');
    invGrid.className = 'inventory-grid';
    invGrid.id = 'inv-grid';
    invGrid.setAttribute('aria-live', 'polite');
    invGrid.innerHTML = `<div class="spinner" aria-label="Loading inventory…"></div>`;
    page.append(invGrid);

    root.append(page);

    // Fetch inventory
    try {
      const items = await api.inventory(session.pharmacy_id);
      state.set({ inventory: { items, status: 'done', filter: '', staleOnly: false } });
      renderStats(items);
      renderInventory();
    } catch (err) {
      if (err.status === 401) { router.navigate('#/login'); return; }
      invGrid.innerHTML = `<div class="empty-state"><h2 class="empty-state__title">Failed to load inventory</h2><p class="empty-state__desc">${utils.escape(err.message)}</p></div>`;
    }

    // Bind toolbar events
    const invSearch = document.getElementById('inv-search');
    const staleBtn  = document.getElementById('stale-only-btn');

    invSearch?.addEventListener('input', () => {
      state.set({ inventory: { filter: invSearch.value } });
      renderInventory();
    });

    staleBtn?.addEventListener('click', () => {
      const cur = state.get().inventory.staleOnly;
      state.set({ inventory: { staleOnly: !cur } });
      staleBtn.classList.toggle('active', !cur);
      staleBtn.setAttribute('aria-pressed', String(!cur));
      renderInventory();
    });
  }

  function renderStats(items) {
    const grid = document.getElementById('stat-grid');
    if (!grid) return;
    const total   = items.length;
    const inStock = items.filter(i => i.quantity > 10).length;
    const low     = items.filter(i => i.quantity > 0 && i.quantity <= 10).length;
    const out     = items.filter(i => i.quantity === 0).length;
    const stale   = items.filter(i => i.freshness === 'stale').length;

    const stats = [
      { label: 'Total Medicines', value: total, cls: '' },
      { label: 'In Stock',        value: inStock, cls: 'stat-card__value--green' },
      { label: 'Low Stock',       value: low,     cls: 'stat-card__value--amber' },
      { label: 'Out of Stock',    value: out,     cls: 'stat-card__value--red' },
      { label: 'Stale Data',      value: stale,   cls: 'stat-card__value--red' },
    ];

    grid.innerHTML = stats.map(s => `
      <div class="stat-card" role="figure" aria-label="${s.label}: ${s.value}">
        <div class="stat-card__value ${s.cls}">${s.value}</div>
        <div class="stat-card__label">${s.label}</div>
      </div>`).join('');
  }

  function renderInventory() {
    const grid = document.getElementById('inv-grid');
    if (!grid) return;
    const { inventory } = state.get();
    let items = [...inventory.items];

    if (inventory.filter) {
      const q = inventory.filter.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q));
    }
    if (inventory.staleOnly) {
      items = items.filter(i => i.freshness === 'stale');
    }

    if (items.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="padding:40px 20px;"><p class="empty-state__desc">No medicines match your filter.</p></div>`;
      return;
    }

    grid.innerHTML = '';
    items.forEach(item => grid.append(buildInvCard(item)));
  }

  function buildInvCard(item) {
    const stale = item.freshness === 'stale';
    const avail = item.quantity === 0 ? 'out_of_stock' : item.quantity <= 10 ? 'low_stock' : 'in_stock';
    const { session } = state.get();

    const card = document.createElement('div');
    card.className = `inv-card${stale ? ' inv-card--stale' : ''}`;
    card.id = `inv-card-${item.medicine_id}`;
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', `${item.name} ${item.strength} inventory`);

    // Header row
    const hdr = document.createElement('div');
    hdr.className = 'inv-card__header';

    const nameGroup = document.createElement('div');
    const nameEl = utils.el('div', 'inv-card__medicine', `${item.name} ${item.strength}`);
    const detailEl = utils.el('div', 'inv-card__detail', item.form);
    nameGroup.append(nameEl, detailEl);

    const badgeGroup = document.createElement('div');
    badgeGroup.style.display = 'flex'; badgeGroup.style.gap = '6px'; badgeGroup.style.flexWrap = 'wrap';

    const availBadgeEl = document.createElement('span');
    const availMap = { in_stock: ['badge--green','In Stock'], low_stock: ['badge--amber',`Only ${item.quantity} left`], out_of_stock: ['badge--red','Out of Stock'] };
    const [ac, al] = availMap[avail];
    availBadgeEl.className = `badge ${ac}`;
    availBadgeEl.textContent = `● ${al}`;
    badgeGroup.append(availBadgeEl);

    if (stale) {
      const nudge = utils.el('span', 'stale-nudge', '⚠ Needs update');
      badgeGroup.append(nudge);
    }
    hdr.append(nameGroup, badgeGroup);

    // Meta
    const meta = document.createElement('div');
    meta.className = 'inv-card__meta';

    const freshDot = document.createElement('span');
    freshDot.className = `freshness-dot freshness-dot--${item.freshness}`;
    freshDot.setAttribute('aria-hidden', 'true');

    const freshLabel = utils.el('span', '', utils.formatAgo(item.last_updated_minutes_ago));
    const qtyLabel   = utils.el('span', '', `Qty: ${item.quantity}`);
    meta.append(freshDot, freshLabel, utils.el('span','','·'), qtyLabel);

    // Edit row
    const editRow = document.createElement('div');
    editRow.className = 'inv-card__edit';

    const qtyGroup = document.createElement('div');
    qtyGroup.className = 'qty-input-group';

    const minusBtn = document.createElement('button');
    minusBtn.className = 'qty-input-group__btn';
    minusBtn.type = 'button';
    minusBtn.textContent = '−';
    minusBtn.setAttribute('aria-label', 'Decrease quantity');

    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'qty-input-group__input';
    qtyInput.value = item.quantity;
    qtyInput.min = 0;
    qtyInput.setAttribute('aria-label', `Quantity for ${item.name}`);

    const plusBtn = document.createElement('button');
    plusBtn.className = 'qty-input-group__btn';
    plusBtn.type = 'button';
    plusBtn.textContent = '+';
    plusBtn.setAttribute('aria-label', 'Increase quantity');

    function updateBtns() {
      const v = parseInt(qtyInput.value, 10);
      minusBtn.disabled = isNaN(v) || v <= 0;
    }
    updateBtns();

    minusBtn.addEventListener('click', () => {
      const v = parseInt(qtyInput.value, 10) || 0;
      if (v > 0) { qtyInput.value = v - 1; updateBtns(); }
    });
    plusBtn.addEventListener('click', () => {
      const v = parseInt(qtyInput.value, 10) || 0;
      qtyInput.value = v + 1; updateBtns();
    });
    qtyInput.addEventListener('input', updateBtns);

    qtyGroup.append(minusBtn, qtyInput, plusBtn);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn--primary btn--sm';
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.setAttribute('aria-label', `Save quantity for ${item.name}`);

    const statusEl = utils.el('span', '', '');
    statusEl.style.cssText = 'font-size:var(--text-sm);color:var(--clr-text-500);';
    statusEl.setAttribute('aria-live', 'polite');

    saveBtn.addEventListener('click', async () => {
      const newQty = parseInt(qtyInput.value, 10);
      if (isNaN(newQty) || newQty < 0 || !Number.isInteger(newQty)) {
        toast.error('Invalid quantity', 'Enter a non-negative whole number.');
        return;
      }

      const oldQty = item.quantity;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      // Optimistic update
      item.quantity = newQty;
      item.freshness = 'fresh';
      item.last_updated_minutes_ago = 0;
      updateCardBadge(card, newQty);
      updateCardMeta(meta, item);

      try {
        await api.updateStock(session.pharmacy_id, { medicine_id: item.medicine_id, quantity: newQty });
        saveBtn.textContent = 'Saved ✓';
        saveBtn.disabled = false;
        setTimeout(() => { saveBtn.textContent = 'Save'; }, 2000);
        toast.success('Stock updated', `${item.name} ${item.strength} → ${newQty}`);

        // Refresh stat cards
        const invItems = state.get().inventory.items;
        renderStats(invItems);
      } catch (err) {
        // Rollback
        item.quantity = oldQty;
        item.freshness = stale ? 'stale' : item.freshness;
        qtyInput.value = oldQty;
        updateCardBadge(card, oldQty);
        updateCardMeta(meta, item);
        saveBtn.textContent = 'Save';
        saveBtn.disabled = false;
        toast.error('Update failed', err.message || 'Could not save. Try again.');
      }
    });

    editRow.append(qtyGroup, saveBtn, statusEl);

    card.append(hdr, meta, editRow);
    return card;
  }

  function updateCardBadge(card, qty) {
    const badgeEl = card.querySelector('.badge');
    if (!badgeEl) return;
    if (qty === 0) { badgeEl.className = 'badge badge--red'; badgeEl.textContent = '● Out of Stock'; }
    else if (qty <= 10) { badgeEl.className = 'badge badge--amber'; badgeEl.textContent = `● Only ${qty} left`; }
    else { badgeEl.className = 'badge badge--green'; badgeEl.textContent = '● In Stock'; }
  }

  function updateCardMeta(metaEl, item) {
    if (!metaEl) return;
    const spans = metaEl.querySelectorAll('span');
    if (spans.length >= 4) {
      // dot
      spans[0].className = `freshness-dot freshness-dot--${item.freshness}`;
      spans[1].textContent = utils.formatAgo(item.last_updated_minutes_ago);
      spans[3].textContent = `Qty: ${item.quantity}`;
    }
  }

  /* ----------------------------------------------------------
     404 VIEW
     ---------------------------------------------------------- */
  function notFound() {
    root.innerHTML = `
      <div class="empty-state page" style="padding:80px 20px;">
        <div class="empty-state__icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </div>
        <h1 class="empty-state__title">Page not found</h1>
        <p class="empty-state__desc">This page doesn't exist. Head back to the search page.</p>
        <a href="#/" class="btn btn--primary" style="margin-top:8px;">Go Home</a>
      </div>`;
  }

  return { home, login, dashboard, notFound, applyFilters };
})();


/* ============================================================
   NAV — update navbar state based on auth
   ============================================================ */
const nav = (() => {
  function updateAuth(loggedIn, name) {
    const loginLink    = document.getElementById('nav-login');
    const dashLink     = document.getElementById('nav-dashboard');
    const pharmacyName = document.getElementById('nav-pharmacy-name');
    const logoutBtn    = document.getElementById('nav-logout-btn');
    const mobLogin     = document.getElementById('mob-nav-login');
    const mobDash      = document.getElementById('mob-nav-dashboard');
    const mobLogout    = document.getElementById('mob-logout-btn');

    if (loggedIn) {
      loginLink?.setAttribute('hidden', '');
      dashLink?.removeAttribute('hidden');
      pharmacyName?.removeAttribute('hidden');
      if (pharmacyName) pharmacyName.textContent = name;
      logoutBtn?.removeAttribute('hidden');
      mobLogin?.setAttribute('hidden', '');
      mobDash?.removeAttribute('hidden');
      mobLogout?.removeAttribute('hidden');
    } else {
      loginLink?.removeAttribute('hidden');
      dashLink?.setAttribute('hidden', '');
      pharmacyName?.setAttribute('hidden', '');
      logoutBtn?.setAttribute('hidden', '');
      mobLogin?.removeAttribute('hidden');
      mobDash?.setAttribute('hidden', '');
      mobLogout?.setAttribute('hidden', '');
    }
  }

  function setActiveLink(route) {
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });
  }

  return { updateAuth, setActiveLink };
})();


/* ============================================================
   ROUTER — hash-based SPA routing
   ============================================================ */
const router = (() => {
  const routes = {
    '#/'          : 'home',
    '#/login'     : 'login',
    '#/dashboard' : 'dashboard',
  };

  function resolve() {
    const hash = window.location.hash || '#/';
    const routeName = routes[hash];

    // Close mobile menu
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) mobileMenu.hidden = true;
    const hamburger = document.getElementById('hamburger-btn');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');

    nav.setActiveLink(routeName || '');

    if (routeName === 'home')      views.home();
    else if (routeName === 'login')     views.login();
    else if (routeName === 'dashboard') views.dashboard();
    else views.notFound();
  }

  function navigate(hash) {
    window.location.hash = hash;
  }

  window.addEventListener('hashchange', resolve);

  return { resolve, navigate };
})();


/* ============================================================
   THEME TOGGLE
   ============================================================ */
function initTheme() {
  const html = document.documentElement;
  const btn  = document.getElementById('theme-toggle');

  const saved = localStorage.getItem('medfind-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = saved || (prefersDark ? 'dark' : 'light');
  html.setAttribute('data-theme', initialTheme);

  btn?.addEventListener('click', () => {
    const cur = html.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('medfind-theme', next);
    utils.announce(`Switched to ${next} mode`);
  });
}


/* ============================================================
   HAMBURGER MENU
   ============================================================ */
function initHamburger() {
  const btn  = document.getElementById('hamburger-btn');
  const menu = document.getElementById('mobile-menu');

  btn?.addEventListener('click', () => {
    const isOpen = menu.hidden;
    menu.hidden = !isOpen;
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!btn?.contains(e.target) && !menu?.contains(e.target)) {
      menu.hidden = true;
      btn?.setAttribute('aria-expanded', 'false');
    }
  });
}


/* ============================================================
   LOGOUT
   ============================================================ */
function initLogout() {
  const handler = async () => {
    try {
      await api.logout();
    } catch (_) { /* ignore */ }
    state.set({ session: { logged_in: false, pharmacy_id: null, name: null }, inventory: { items: [], status: 'idle' } });
    nav.updateAuth(false, '');
    toast.info('Signed out', 'You have been logged out.');
    router.navigate('#/');
  };

  document.getElementById('nav-logout-btn')?.addEventListener('click', handler);
  document.getElementById('mob-logout-btn')?.addEventListener('click', handler);
}


/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  initTheme();
  initHamburger();
  initLogout();

  // Restore session
  try {
    const sess = await api.session();
    if (sess.logged_in) {
      state.set({ session: { logged_in: true, pharmacy_id: sess.pharmacy_id, name: sess.name } });
      nav.updateAuth(true, sess.name);
    }
  } catch (_) { /* session check failing is non-fatal */ }

  // Initial route
  router.resolve();
}

document.addEventListener('DOMContentLoaded', boot);
