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

  const MOCK_PHARMACIES = [
    { id: 1,  name: "MedPlus Pharmacy — Master Canteen",    address: "Janpath, Master Canteen Square, Bhubaneswar, Odisha",            lat: 20.2680, lon: 85.8400, is_open: 1, phone: "+91 98765 43210" },
    { id: 2,  name: "Apollo Pharmacy — Saheed Nagar",       address: "Near BMC Bhawani Mall, Saheed Nagar, Bhubaneswar, Odisha",       lat: 20.2895, lon: 85.8370, is_open: 1, phone: "+91 98765 43211" },
    { id: 3,  name: "LifeCare Pharmacy — Kharvel Nagar",    address: "Near Ram Mandir, Kharvel Nagar, Bhubaneswar, Odisha",            lat: 20.2780, lon: 85.8290, is_open: 1, phone: "+91 98765 43212" },
    { id: 4,  name: "Sunrise Medical & Chemist",            address: "Unit-4, Near Capital Hospital, Bhubaneswar, Odisha",             lat: 20.2610, lon: 85.8180, is_open: 1, phone: "+91 98765 43213" },
    { id: 5,  name: "City Chemist & Druggist",              address: "Near ISKCON Temple, Nayapalli, Bhubaneswar, Odisha",             lat: 20.2945, lon: 85.8012, is_open: 0, phone: "+91 98765 43214" },
    { id: 6,  name: "Wellness Pharmacy — KIIT Campus",      address: "Infocity Road, Patia, Bhubaneswar, Odisha",                      lat: 20.3540, lon: 85.8175, is_open: 1, phone: "+91 98765 43215" },
    { id: 7,  name: "Kalinga Medicos — Jayadev Vihar",      address: "Near Pal Heights, Jayadev Vihar, Bhubaneswar, Odisha",           lat: 20.3015, lon: 85.8185, is_open: 1, phone: "+91 98765 43216" },
    { id: 8,  name: "Damana Health Chemist",                address: "Damana Square, Chandrasekharpur, Bhubaneswar, Odisha",           lat: 20.3250, lon: 85.8190, is_open: 1, phone: "+91 98765 43217" },
    { id: 9,  name: "AIIMS Care Pharmacy",                  address: "Sijua, Near AIIMS Hospital, Bhubaneswar, Odisha",                lat: 20.2310, lon: 85.7750, is_open: 1, phone: "+91 98765 43218" },
    { id: 10, name: "SUM Hospital Medical Store",           address: "Kalinga Nagar, Near SUM Hospital, Ghatikia, Bhubaneswar, Odisha", lat: 20.2785, lon: 85.7620, is_open: 1, phone: "+91 98765 43219" },
    { id: 11, name: "Khandagiri Express Pharmacy",          address: "Near Khandagiri Caves, Baramunda, Bhubaneswar, Odisha",          lat: 20.2580, lon: 85.7860, is_open: 1, phone: "+91 98765 43220" },
    { id: 12, name: "Esplanade Care Pharmacy",              address: "Cuttack Road, Near Esplanade One Mall, Rasulgarh, Bhubaneswar",  lat: 20.2910, lon: 85.8640, is_open: 1, phone: "+91 98765 43221" },
  ];

  const BBSR_NEIGHBORHOODS = [
    { name: "All BBSR",           label: "📍 All Bhubaneswar",        lat: 20.2961, lon: 85.8245, zoom: 12 },
    { name: "Patia / KIIT",       label: "🎓 Patia & KIIT",            lat: 20.3540, lon: 85.8175, zoom: 14 },
    { name: "Saheed Nagar",       label: "🛍️ Saheed Nagar / Rasulgarh", lat: 20.2895, lon: 85.8450, zoom: 14 },
    { name: "AIIMS / SUM",        label: "🏥 AIIMS & SUM Hospital",    lat: 20.2550, lon: 85.7680, zoom: 14 },
    { name: "Jayadev Vihar",      label: "🏛️ Jayadev Vihar / Nayapalli", lat: 20.2980, lon: 85.8100, zoom: 14 },
    { name: "Janpath",            label: "🚂 Janpath / Master Canteen", lat: 20.2680, lon: 85.8400, zoom: 14 },
  ];

  const MOCK_MEDICINES = [
    { name: "Paracetamol", strength: "650mg", form: "Tablet" },
    { name: "Paracetamol", strength: "500mg", form: "Tablet" },
    { name: "Dolo 650", strength: "650mg", form: "Tablet" },
    { name: "Crocin", strength: "500mg", form: "Tablet" },
    { name: "Combiflam", strength: "400mg", form: "Tablet" },
    { name: "Amoxicillin", strength: "500mg", form: "Capsule" },
    { name: "Amoxicillin", strength: "250mg", form: "Syrup" },
    { name: "Metformin", strength: "500mg", form: "Tablet" },
    { name: "Cetirizine", strength: "10mg", form: "Tablet" },
    { name: "Ibuprofen", strength: "400mg", form: "Tablet" },
    { name: "Omeprazole", strength: "20mg", form: "Capsule" },
    { name: "Azithromycin", strength: "500mg", form: "Tablet" },
    { name: "Pantoprazole", strength: "40mg", form: "Tablet" },
    { name: "Atorvastatin", strength: "10mg", form: "Tablet" },
    { name: "Aspirin", strength: "75mg", form: "Tablet" },
    { name: "Vitamin C", strength: "500mg", form: "Chewable Tablet" },
    { name: "Montelukast", strength: "10mg", form: "Tablet" },
    { name: "Amlodipine", strength: "5mg", form: "Tablet" },
    { name: "Telmisartan", strength: "40mg", form: "Tablet" },
    { name: "Levothyroxine", strength: "50mcg", form: "Tablet" },
    { name: "Ciprofloxacin", strength: "500mg", form: "Tablet" },
    { name: "Doxycycline", strength: "100mg", form: "Capsule" },
    { name: "Salbutamol", strength: "100mcg", form: "Inhaler" },
    { name: "Clopidogrel", strength: "75mg", form: "Tablet" },
    { name: "Diclofenac", strength: "50mg", form: "Tablet" },
  ];

  function calcHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 100) / 100;
  }

  function mockSearch(query, userLat = 20.2961, userLon = 85.8245) {
    const qLower = (query || '').trim().toLowerCase();
    if (!qLower) return [];

    const matchedMeds = MOCK_MEDICINES.filter(m =>
      m.name.toLowerCase().includes(qLower) || qLower.includes(m.name.toLowerCase())
    );

    if (matchedMeds.length === 0) return [];

    const results = [];
    const targetMed = matchedMeds[0];

    MOCK_PHARMACIES.forEach((p, idx) => {
      const quantities = [75, 12, 0, 45, 90, 5];
      const minutes = [8, 24, 180, 15, 600, 42];
      const qty = quantities[idx % quantities.length];
      const mins = minutes[idx % minutes.length];

      let stock_status = 'in_stock';
      if (qty === 0) stock_status = 'out_of_stock';
      else if (qty <= 15) stock_status = 'low_stock';

      let freshness_class = 'fresh';
      if (mins >= 720) freshness_class = 'stale';
      else if (mins >= 30) freshness_class = 'aging';

      const dist = calcHaversine(userLat, userLon, p.lat, p.lon);
      const availScore = qty === 0 ? 0 : (qty <= 15 ? 0.5 : 1.0);
      const freshScore = mins < 30 ? 1.0 : (mins < 720 ? 0.6 : 0.2);
      const distScore = Math.max(0.1, 1 - (dist / 15));
      const openScore = p.is_open ? 1.0 : 0.0;
      const score = Math.round((availScore * 0.4 + freshScore * 0.25 + distScore * 0.25 + openScore * 0.1) * 100);

      results.push({
        pharmacy_id: p.id,
        pharmacy_name: p.name,
        address: p.address,
        latitude: p.lat,
        longitude: p.lon,
        is_open: p.is_open,
        phone: p.phone,
        medicine_name: targetMed.name,
        strength: targetMed.strength,
        form: targetMed.form,
        quantity: qty,
        stock_status,
        last_updated_minutes: mins,
        freshness_class,
        distance_km: dist,
        confidence_score: score
      });
    });

    results.sort((a, b) => b.confidence_score - a.confidence_score);
    return results;
  }

  const get  = (path)        => request('GET',  path);
  const post = (path, body)  => request('POST', path, body);

  return {
    search: async (q, lat, lon) => {
      try {
        return await get(`/api/search?q=${encodeURIComponent(q)}&lat=${lat}&lon=${lon}`);
      } catch (err) {
        console.warn('API search endpoint unreachable, using client mock search fallback:', err);
        return mockSearch(q, lat, lon);
      }
    },
    login:      (body)        => post('/api/login', body),
    logout:     ()            => post('/api/logout'),
    session:    async ()      => {
      try {
        return await get('/api/session');
      } catch (err) {
        return { logged_in: false, pharmacy_id: null, name: null };
      }
    },
    inventory:  (id)          => get(`/api/pharmacy/${id}/inventory`),
    updateStock:(id, body)    => post(`/api/pharmacy/${id}/inventory`, body),
    reserve:    (body)        => post('/api/reserve', body),
    reservations: (id)        => get(`/api/pharmacy/${id}/reservations`),
    updateReservationStatus: (pharmacyId, resId, status) => post(`/api/pharmacy/${pharmacyId}/reservations/${resId}/status`, { status }),
    toggleStoreOpen: (pharmacyId, isOpen) => post(`/api/pharmacy/${pharmacyId}/toggle-open`, { is_open: isOpen }),
    markAllFresh: (pharmacyId) => post(`/api/pharmacy/${pharmacyId}/mark-all-fresh`),
    analytics: (pharmacyId)   => get(`/api/pharmacy/${pharmacyId}/analytics`),
    addMedicine: (pharmacyId, medicineId, quantity) => post(`/api/pharmacy/${pharmacyId}/inventory/add`, { medicine_id: medicineId, quantity }),
    catalog: () => get('/api/medicines/catalog'),
    placeOrder: (body) => post('/api/orders', body),
    getOrder: (code) => get(`/api/orders/${encodeURIComponent(code)}`),
    updateOrderStatus: (code, status) => post(`/api/orders/${encodeURIComponent(code)}/status`, { status }),
    listOrders: (phone) => get(`/api/orders${phone ? '?phone=' + encodeURIComponent(phone) : ''}`),
    pharmacyOrders: (id) => get(`/api/pharmacy/${id}/orders`),
    updatePharmacyOrderStatus: (pharmacyId, orderId, status) => post(`/api/pharmacy/${pharmacyId}/orders/${orderId}/status`, { status }),
    pharmacies: async (lat, lon) => {
      try {
        return await get(`/api/pharmacies?lat=${lat}&lon=${lon}`);
      } catch (err) {
        return MOCK_PHARMACIES.map(p => ({
          id: p.id,
          pharmacy_id: p.id,
          name: p.name,
          pharmacy: p.name,
          address: p.address,
          latitude: p.lat,
          longitude: p.lon,
          is_open: p.is_open,
          distance_km: calcHaversine(lat, lon, p.lat, p.lon)
        }));
      }
    },
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
    viewMode:   'list', // 'list' | 'map'
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
   CART & USER ORDERS STORE (Blinkit / Swiggy style)
   ============================================================ */
const userOrders = (() => {
  const ORDERS_KEY = 'medfind_user_orders_v1';
  function getCodes() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); } catch (_) { return []; }
  }
  function addCode(code) {
    try {
      const list = getCodes().filter(c => c !== code);
      list.unshift(code);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
    } catch (_) {}
    updateBadge();
  }
  function updateBadge() {
    const badge = document.getElementById('nav-orders-badge');
    const mobBadge = document.getElementById('mob-orders-badge');
    const codes = getCodes();
    const count = codes.length;
    [badge, mobBadge].forEach(b => {
      if (b) {
        if (count > 0) {
          b.textContent = count;
          b.hidden = false;
        } else {
          b.hidden = true;
        }
      }
    });
  }
  return { getCodes, addCode, updateBadge };
})();

const cart = (() => {
  const CART_KEY = 'medfind_cart_v1';

  function load() {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return { pharmacy_id: null, pharmacy_name: null, pharmacy_address: null, items: [] };
  }

  function save(data) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(data));
    } catch (_) {}
    updateUI();
  }

  function get() {
    return load();
  }

  function addItem(item, qty = 1) {
    const current = load();
    if (current.pharmacy_id && current.pharmacy_id !== item.pharmacy_id && current.items.length > 0) {
      const confirmReplace = confirm(
        `Your cart currently has medicines from "${current.pharmacy_name}".\n\nStart a new cart with items from "${item.pharmacy}"?`
      );
      if (!confirmReplace) return false;
      current.items = [];
    }

    current.pharmacy_id = item.pharmacy_id;
    current.pharmacy_name = item.pharmacy;
    current.pharmacy_address = item.address;

    const existing = current.items.find(
      i => i.medicine.toLowerCase() === item.medicine.toLowerCase() && i.strength === item.strength
    );
    const maxQty = item.quantity || 99;
    if (existing) {
      existing.quantity = Math.min(maxQty, existing.quantity + qty);
    } else {
      current.items.push({
        medicine_id: item.medicine_id,
        medicine: item.medicine,
        strength: item.strength,
        form: item.form,
        price: item.price || 35.0,
        quantity: Math.min(maxQty, qty),
        max_quantity: maxQty
      });
    }

    save(current);
    toast.success('Added to Order Basket', `${item.medicine} added from ${item.pharmacy}.`);
    return true;
  }

  function updateQty(medName, strength, newQty) {
    const current = load();
    const idx = current.items.findIndex(
      i => i.medicine.toLowerCase() === medName.toLowerCase() && i.strength === strength
    );
    if (idx !== -1) {
      if (newQty <= 0) {
        current.items.splice(idx, 1);
      } else {
        current.items[idx].quantity = Math.min(current.items[idx].max_quantity || 99, newQty);
      }
    }
    if (current.items.length === 0) {
      current.pharmacy_id = null;
      current.pharmacy_name = null;
      current.pharmacy_address = null;
    }
    save(current);
  }

  function removeItem(medName, strength) {
    updateQty(medName, strength, 0);
  }

  function clear() {
    save({ pharmacy_id: null, pharmacy_name: null, pharmacy_address: null, items: [] });
  }

  function getCount() {
    const current = load();
    return current.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  function getSubtotal() {
    const current = load();
    return current.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  }

  function updateUI() {
    const bar = document.getElementById('floating-cart-bar');
    const pillCount = document.getElementById('cart-pill-count');
    const pillTotal = document.getElementById('cart-pill-total');
    const pillSubtext = document.getElementById('cart-pill-subtext');

    const current = load();
    const count = getCount();
    const total = getSubtotal();

    const isCheckoutOrTrack = window.location.hash.startsWith('#/checkout') || window.location.hash.startsWith('#/track');

    if (bar) {
      const showBar = count > 0 && !isCheckoutOrTrack;
      bar.hidden = !showBar;
      document.body.classList.toggle('has-floating-cart', showBar);
      if (showBar) {
        if (pillCount) pillCount.textContent = count;
        if (pillTotal) pillTotal.textContent = `₹${total.toFixed(0)}`;
        if (pillSubtext) pillSubtext.textContent = `From ${current.pharmacy_name || 'Pharmacy'}`;
      }
    }
    userOrders.updateBadge();
  }

  return { get, addItem, updateQty, removeItem, clear, getCount, getSubtotal, updateUI };
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

    // Price tag
    const priceTag = document.createElement('span');
    priceTag.className = 'result-card__price-tag';
    priceTag.textContent = `₹${item.price || 35}`;
    medRow.append(priceTag);

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

    const actionGroup = document.createElement('div');
    actionGroup.className = 'result-card__actions';

    // 1. Order Express (Blinkit / Swiggy style)
    const orderBtn = document.createElement('button');
    orderBtn.className = 'btn btn--primary btn--sm btn--order-now';
    orderBtn.disabled = item.availability === 'out_of_stock';
    orderBtn.innerHTML = `⚡ Order Now`;
    orderBtn.title = 'Order for 15-20 min Express Delivery';
    orderBtn.addEventListener('click', () => {
      if (item.availability !== 'out_of_stock') {
        cart.addItem(item, 1);
        router.navigate('#/checkout');
      }
    });

    // 2. Add to Cart button
    const addCartBtn = document.createElement('button');
    addCartBtn.className = 'btn btn--secondary btn--sm btn--add-cart';
    addCartBtn.disabled = item.availability === 'out_of_stock';
    addCartBtn.innerHTML = `+ Cart`;
    addCartBtn.title = 'Add to medicine order basket';
    addCartBtn.addEventListener('click', () => {
      if (item.availability !== 'out_of_stock') {
        cart.addItem(item, 1);
      }
    });

    // 3. 30-min Counter Hold Reservation
    const reserveBtn = document.createElement('button');
    reserveBtn.className = 'btn btn--ghost btn--sm btn--hold-reserve';
    reserveBtn.disabled = item.availability === 'out_of_stock';
    reserveBtn.innerHTML = `Hold (Pickup)`;
    reserveBtn.title = 'Hold at pharmacy counter for 30 minutes';
    reserveBtn.addEventListener('click', () => {
      if (item.availability !== 'out_of_stock') {
        modal.openReserve(item);
      }
    });

    actionGroup.append(orderBtn, addCartBtn, reserveBtn);
    footer.append(actionGroup);

    card.append(header, medRow, meta, footer);
    return card;
  }

  const _activeLeafletMaps = {};

  /* ---- Interactive Live Map Component ---- */
  function liveMap(items, options = {}) {
    const mapId = options.id || `live-map-${Date.now()}`;
    const medicineQuery = options.medicine || '';
    const userLoc = state.get().location;
    const userLat = userLoc.lat || 20.2961;
    const userLon = userLoc.lon || 85.8245;

    const card = document.createElement('div');
    card.className = 'live-map-card';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'live-map-toolbar';
    toolbar.innerHTML = `
      <div class="map-toolbar-left">
        <div class="map-legend">
          <span class="legend-item"><span class="legend-dot legend-dot--green"></span> In Stock / Open</span>
          <span class="legend-item"><span class="legend-dot legend-dot--amber"></span> Low Stock</span>
          <span class="legend-item"><span class="legend-dot legend-dot--red"></span> Out of Stock</span>
          <span class="legend-item"><span class="legend-dot legend-dot--blue"></span> You</span>
        </div>
        <div style="display:inline-flex;gap:4px;margin-left:6px;">
          <button type="button" class="map-filter-chip active" data-map-filter="all">All (${items.length})</button>
          <button type="button" class="map-filter-chip" data-map-filter="open">Open Now</button>
          ${medicineQuery ? '<button type="button" class="map-filter-chip" data-map-filter="instock">In Stock</button>' : ''}
        </div>
      </div>
      <div class="map-toolbar-right">
        <select class="form-input map-bbsr-select" id="${mapId}-bbsr-hub-select" style="padding:4px 8px;font-size:12px;height:32px;width:auto;border-radius:var(--radius-md);background:var(--clr-surface);border:1px solid var(--clr-border);color:var(--clr-text-700);cursor:pointer;" title="Jump to Bhubaneswar Hub">
          <option value="">Jump to BBSR Hub…</option>
          ${BBSR_NEIGHBORHOODS.map(nh => `<option value="${nh.lat},${nh.lon},${nh.zoom}">${nh.label}</option>`).join('')}
        </select>
        <button type="button" class="map-recenter-btn" id="${mapId}-recenter" title="Recenter on your location">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>
          My Location
        </button>
      </div>
    `;

    // Map container element
    const mapEl = document.createElement('div');
    mapEl.className = 'live-map-element';
    mapEl.id = mapId;

    card.append(toolbar, mapEl);

    // Initialize Leaflet after DOM attachment
    requestAnimationFrame(() => {
      setTimeout(() => {
        initLeafletInstance(mapId, items, userLat, userLon, medicineQuery, toolbar);
      }, 50);
    });

    return card;
  }

  function initLeafletInstance(mapId, items, userLat, userLon, medicineQuery, toolbar) {
    if (typeof window.L === 'undefined') {
      setTimeout(() => initLeafletInstance(mapId, items, userLat, userLon, medicineQuery, toolbar), 200);
      return;
    }

    const container = document.getElementById(mapId);
    if (!container) return;

    if (_activeLeafletMaps[mapId]) {
      try { _activeLeafletMaps[mapId].remove(); } catch (_) {}
      delete _activeLeafletMaps[mapId];
    }
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }

    const map = L.map(mapId, {
      zoomControl: false,
      scrollWheelZoom: true
    }).setView([userLat, userLon], 13);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    // User location marker
    const userMarker = L.marker([userLat, userLon], {
      icon: L.divIcon({
        className: 'user-pin-wrapper',
        html: '<div class="user-location-pin"><div class="user-location-beacon"></div></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      }),
      zIndexOffset: 1000
    }).addTo(map);

    userMarker.bindPopup('<div style="padding:6px 8px;font-family:var(--font-body);"><strong>📍 Your Current Location</strong><div style="font-size:12px;color:var(--clr-text-500);margin-top:2px;">Bhubaneswar GPS center</div></div>');

    const markersLayer = L.layerGroup().addTo(map);

    function renderMarkers(filter = 'all') {
      markersLayer.clearLayers();
      const boundsList = [[userLat, userLon]];

      let filtered = items;
      if (filter === 'open') {
        filtered = items.filter(it => it.is_open);
      } else if (filter === 'instock') {
        filtered = items.filter(it => it.availability !== 'out_of_stock' && it.is_open);
      }

      filtered.forEach(item => {
        const lat = item.latitude || item.lat;
        const lon = item.longitude || item.lon;
        if (!lat || !lon) return;

        boundsList.push([lat, lon]);

        const isOpen = item.is_open !== false && item.is_open !== 0;
        let pinClass = 'pin--green';
        let pinBadge = '✓';

        if (!isOpen) {
          pinClass = 'pin--gray';
          pinBadge = '✕';
        } else if (item.availability === 'out_of_stock') {
          pinClass = 'pin--red';
          pinBadge = '0';
        } else if (item.availability === 'low_stock') {
          pinClass = 'pin--amber';
          pinBadge = item.quantity != null ? String(item.quantity) : '!';
        } else if (item.quantity != null) {
          pinBadge = item.quantity > 99 ? '99+' : String(item.quantity);
        }

        const pinIcon = L.divIcon({
          className: 'medfind-pin-wrapper',
          html: `<div class="medfind-map-pin ${pinClass}"><div class="medfind-map-pin-inner">${pinBadge}</div></div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 38],
          popupAnchor: [0, -36]
        });

        const medName = item.medicine || item.medicine_name;
        const popupContent = `
          <div class="map-popup-card">
            <div class="map-popup-header">
              <div class="map-popup-title">${utils.escape(item.pharmacy || item.name)}</div>
              <span class="badge ${isOpen ? 'badge--green' : 'badge--muted'}">${isOpen ? '● Open' : '● Closed'}</span>
            </div>
            <div class="map-popup-address">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${utils.escape(item.address)} • <strong>${item.distance_km || 0} km</strong>
            </div>
            ${medName ? `
              <div class="map-popup-med-box">
                <div class="map-popup-med-row">
                  <span class="map-popup-med-name">${utils.escape(medName)} ${utils.escape(item.strength || '')}</span>
                  <span class="map-popup-med-price">₹${item.price || 35}</span>
                </div>
                <div class="map-popup-meta">
                  <span>${item.quantity != null ? `${item.quantity} units in stock` : 'Reported available'}</span>
                  <span>${item.last_updated_minutes_ago != null ? utils.formatAgo(item.last_updated_minutes_ago) : 'Recent'}</span>
                </div>
              </div>
              <div class="map-popup-actions">
                <button class="btn btn--primary btn--sm btn-map-order" ${item.availability === 'out_of_stock' || !isOpen ? 'disabled' : ''}>
                  ⚡ Order
                </button>
                <button class="btn btn--secondary btn--sm btn-map-cart" ${item.availability === 'out_of_stock' || !isOpen ? 'disabled' : ''}>
                  + Cart
                </button>
              </div>
            ` : `
              <div style="font-size:12px;color:var(--clr-text-500);margin:8px 0 10px;">
                Verified MedFind Partner Pharmacy. Search any medicine to check live inventory.
              </div>
            `}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank" rel="noopener noreferrer" class="map-popup-dir-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              Navigate in Google Maps
            </a>
          </div>
        `;

        const marker = L.marker([lat, lon], { icon: pinIcon }).addTo(markersLayer);
        marker.bindPopup(popupContent, { maxWidth: 320 });

        marker.on('popupopen', (e) => {
          const px = e.popup.getElement();
          if (!px) return;
          const orderBtn = px.querySelector('.btn-map-order');
          const cartBtn = px.querySelector('.btn-map-cart');
          if (orderBtn) {
            orderBtn.addEventListener('click', () => {
              cart.addItem(item, 1);
              router.navigate('#/checkout');
            });
          }
          if (cartBtn) {
            cartBtn.addEventListener('click', () => {
              cart.addItem(item, 1);
            });
          }
        });
      });

      if (boundsList.length > 1) {
        map.fitBounds(boundsList, { padding: [40, 40], maxZoom: 15 });
      }
    }

    renderMarkers('all');

    // Recenter listener
    const recenterBtn = document.getElementById(`${mapId}-recenter`);
    if (recenterBtn) {
      recenterBtn.addEventListener('click', () => {
        map.flyTo([userLat, userLon], 14, { duration: 1.2 });
      });
    }

    // Filter chips listener
    if (toolbar) {
      toolbar.querySelectorAll('[data-map-filter]').forEach(chip => {
        chip.addEventListener('click', () => {
          toolbar.querySelectorAll('[data-map-filter]').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          renderMarkers(chip.dataset.mapFilter);
        });
      });
    }

    // BBSR Hub select listener
    const hubSelect = document.getElementById(`${mapId}-bbsr-hub-select`);
    if (hubSelect) {
      hubSelect.addEventListener('change', () => {
        if (!hubSelect.value) return;
        const [hLat, hLon, hZoom] = hubSelect.value.split(',').map(Number);
        map.flyTo([hLat, hLon], hZoom || 14, { duration: 1.2 });
      });
    }

    _activeLeafletMaps[mapId] = map;
    setTimeout(() => { map.invalidateSize(); }, 200);
  }

  return { availBadge, openBadge, freshnessItem, scoreRing, skeletonCard, resultCard, liveMap };
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

    // Delivery Switch button
    const expressOrderBtn = document.createElement('button');
    expressOrderBtn.type = 'button';
    expressOrderBtn.className = 'btn btn--secondary';
    expressOrderBtn.style.cssText = 'width: 100%; margin-top: 10px; font-weight: 700;';
    expressOrderBtn.innerHTML = `🛵 Switch to Home Delivery Order (15-20 min)`;
    expressOrderBtn.addEventListener('click', () => {
      const qty = parseInt(input.value, 10) || 1;
      cart.addItem(item, qty);
      close();
      router.navigate('#/checkout');
    });

    content.append(titleEl, subtitleEl, infoCard, qtyLabel, stepper, errEl, confirmBtn, expressOrderBtn);
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

    // Segmented View Toggle (List vs Live Map)
    const toggleWrap = document.createElement('div');
    toggleWrap.className = 'view-mode-toggle';
    const isMapView = state.get().viewMode === 'map';
    toggleWrap.innerHTML = `
      <button class="view-mode-btn ${!isMapView ? 'active' : ''}" id="toggle-view-list" type="button" aria-label="List View">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        List View
      </button>
      <button class="view-mode-btn ${isMapView ? 'active' : ''}" id="toggle-view-map" type="button" aria-label="Live Map View">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
        Live Map
      </button>
    `;

    toggleWrap.querySelector('#toggle-view-list')?.addEventListener('click', () => {
      state.set({ viewMode: 'list' });
      renderResults();
    });

    toggleWrap.querySelector('#toggle-view-map')?.addEventListener('click', () => {
      state.set({ viewMode: 'map' });
      renderResults();
    });

    hdr.append(toggleWrap);
    main.append(hdr);

    if (isMapView) {
      main.append(components.liveMap(results, { id: 'search-results-map', medicine: search.query }));
    } else {
      const grid = document.createElement('div');
      grid.className = 'results-grid';
      grid.setAttribute('role', 'list');
      results.forEach((item, i) => grid.append(components.resultCard(item, i)));
      main.append(grid);
    }
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
      <p class="initial-state__desc">Type a medicine name above or pick a quick suggestion to see nearby pharmacy availability, stock levels, and data freshness.</p>
      <div style="margin-top:20px;">
        <a href="#/map" class="btn btn--secondary" style="display:inline-flex;align-items:center;gap:8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          Explore All Pharmacies on Live Map
        </a>
      </div>`;
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
    titleEl.innerHTML = `Operations Dashboard — <span></span>`;
    titleEl.querySelector('span').textContent = session.name;
    hdr.append(titleEl);
    page.append(hdr);

    // Operations Bar (Store Toggle + Power Tools)
    const opsBar = document.createElement('div');
    opsBar.className = 'dashboard-ops-bar';
    opsBar.id = 'dashboard-ops-bar';
    page.append(opsBar);

    // Tabs Navigation
    const tabsNav = document.createElement('div');
    tabsNav.className = 'ops-tabs';
    tabsNav.innerHTML = `
      <button class="ops-tab active" data-tab="inventory" type="button" id="tab-btn-inventory">
        📦 Live Inventory
      </button>
      <button class="ops-tab" data-tab="reservations" type="button" id="tab-btn-reservations">
        🛎️ Reservations Queue <span class="ops-tab-badge" id="res-pending-badge" style="display:none;">0</span>
      </button>
      <button class="ops-tab" data-tab="orders" type="button" id="tab-btn-orders">
        🛵 Delivery Orders <span class="ops-tab-badge" id="orders-pending-badge" style="display:none;">0</span>
      </button>
      <button class="ops-tab" data-tab="analytics" type="button" id="tab-btn-analytics">
        📊 Demand &amp; Restock Analytics
      </button>
    `;
    page.append(tabsNav);

    // Tab Contents Containers
    const tabContentInv = document.createElement('div');
    tabContentInv.id = 'tab-content-inventory';

    const tabContentRes = document.createElement('div');
    tabContentRes.id = 'tab-content-reservations';
    tabContentRes.style.display = 'none';

    const tabContentOrders = document.createElement('div');
    tabContentOrders.id = 'tab-content-orders';
    tabContentOrders.style.display = 'none';

    const tabContentAnalytics = document.createElement('div');
    tabContentAnalytics.id = 'tab-content-analytics';
    tabContentAnalytics.style.display = 'none';

    // 1. Setup Inventory Tab Elements
    const statGrid = document.createElement('div');
    statGrid.className = 'stat-grid';
    statGrid.id = 'stat-grid';
    tabContentInv.append(statGrid);

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
    tabContentInv.append(toolbar);

    const invGrid = document.createElement('div');
    invGrid.className = 'inventory-grid';
    invGrid.id = 'inv-grid';
    invGrid.setAttribute('aria-live', 'polite');
    invGrid.innerHTML = `<div class="spinner" aria-label="Loading inventory…"></div>`;
    tabContentInv.append(invGrid);

    page.append(tabContentInv, tabContentRes, tabContentOrders, tabContentAnalytics);
    root.append(page);

    // Render Operations Bar
    let isStoreOpen = session.is_open ?? true;
    function renderOpsBar() {
      opsBar.innerHTML = `
        <div class="store-toggle-wrap">
          <button class="store-toggle-btn ${isStoreOpen ? 'store-toggle-btn--open' : 'store-toggle-btn--closed'}" id="store-toggle-btn" type="button" title="Click to toggle store open/close">
            <span>●</span> ${isStoreOpen ? 'Store Open • Accepting Holds' : 'Store Closed • Paused'}
          </button>
          <span style="font-size:var(--text-xs); color:var(--clr-text-500);">(Click to toggle live status)</span>
        </div>
        <div class="dashboard-ops-actions">
          <button class="btn btn--secondary btn--sm" id="mark-all-fresh-btn" type="button" title="Update all inventory timestamps to Now">
            ⚡ Mark All Stock Fresh
          </button>
          <button class="btn btn--primary btn--sm" id="add-medicine-btn" type="button">
            + Add Medicine to Store
          </button>
        </div>
      `;

      document.getElementById('store-toggle-btn')?.addEventListener('click', async () => {
        try {
          const res = await api.toggleStoreOpen(session.pharmacy_id, !isStoreOpen);
          isStoreOpen = res.is_open;
          session.is_open = isStoreOpen;
          renderOpsBar();
          toast.success(isStoreOpen ? 'Store Open' : 'Store Closed', `Pharmacy status updated to ${isStoreOpen ? 'Open' : 'Closed'}.`);
        } catch (err) {
          toast.error('Toggle failed', err.message);
        }
      });

      document.getElementById('mark-all-fresh-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('mark-all-fresh-btn');
        btn.disabled = true;
        btn.textContent = 'Updating…';
        try {
          const res = await api.markAllFresh(session.pharmacy_id);
          btn.textContent = 'Refreshed ✓';
          toast.success('Freshness Boosted', `All ${res.updated_count} medicines marked fresh!`);
          const invItems = state.get().inventory.items;
          invItems.forEach(i => {
            i.freshness = 'fresh';
            i.last_updated_minutes_ago = 0;
          });
          renderStats(invItems);
          renderInventory();
          setTimeout(() => { btn.disabled = false; btn.textContent = '⚡ Mark All Stock Fresh'; }, 2000);
        } catch (err) {
          btn.disabled = false;
          btn.textContent = '⚡ Mark All Stock Fresh';
          toast.error('Failed to refresh', err.message);
        }
      });

      document.getElementById('add-medicine-btn')?.addEventListener('click', () => {
        openAddMedicineDialog(session);
      });
    }

    renderOpsBar();

    // Tab Switching
    tabsNav.querySelectorAll('.ops-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const target = tabBtn.getAttribute('data-tab');
        tabsNav.querySelectorAll('.ops-tab').forEach(t => t.classList.remove('active'));
        tabBtn.classList.add('active');

        tabContentInv.style.display = target === 'inventory' ? 'block' : 'none';
        tabContentRes.style.display = target === 'reservations' ? 'block' : 'none';
        tabContentOrders.style.display = target === 'orders' ? 'block' : 'none';
        tabContentAnalytics.style.display = target === 'analytics' ? 'block' : 'none';

        if (target === 'reservations') {
          loadAndRenderReservations(tabContentRes, session);
        } else if (target === 'orders') {
          loadAndRenderPharmacyOrders(tabContentOrders, session);
        } else if (target === 'analytics') {
          loadAndRenderAnalytics(tabContentAnalytics, session);
        }
      });
    });

    // Check reservations count for tab badge
    api.reservations(session.pharmacy_id).then(resList => {
      const pendingCount = resList.filter(r => r.status === 'pending').length;
      const badge = document.getElementById('res-pending-badge');
      if (badge && pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline-block';
      }
    }).catch(() => {});

    // Check delivery orders count for tab badge
    api.pharmacyOrders(session.pharmacy_id).then(ordList => {
      const pendingCount = ordList.filter(o => o.status === 'placed' || o.status === 'preparing').length;
      const badge = document.getElementById('orders-pending-badge');
      if (badge && pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline-block';
      }
    }).catch(() => {});

    // Fetch Inventory
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

  // ------------------------------------------------------------
  // Reservations Queue Tab
  // ------------------------------------------------------------
  async function loadAndRenderReservations(container, session) {
    container.innerHTML = `<div class="spinner" aria-label="Loading reservations…"></div>`;

    try {
      const list = await api.reservations(session.pharmacy_id);
      let currentFilter = 'all';

      function renderQueue() {
        const filtered = list.filter(r => {
          if (currentFilter === 'all') return true;
          return r.status === currentFilter;
        });

        const pendingCount = list.filter(r => r.status === 'pending').length;
        const badge = document.getElementById('res-pending-badge');
        if (badge) {
          badge.textContent = pendingCount;
          badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }

        container.innerHTML = `
          <div class="res-queue">
            <div class="res-queue-toolbar">
              <div class="res-filter-group">
                <button class="res-filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All (${list.length})</button>
                <button class="res-filter-btn ${currentFilter === 'pending' ? 'active' : ''}" data-filter="pending">Pending (${list.filter(r => r.status === 'pending').length})</button>
                <button class="res-filter-btn ${currentFilter === 'confirmed' ? 'active' : ''}" data-filter="confirmed">Confirmed (${list.filter(r => r.status === 'confirmed').length})</button>
                <button class="res-filter-btn ${currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">Fulfilled (${list.filter(r => r.status === 'completed').length})</button>
                <button class="res-filter-btn ${currentFilter === 'cancelled' ? 'active' : ''}" data-filter="cancelled">Cancelled (${list.filter(r => r.status === 'cancelled' || r.status === 'expired').length})</button>
              </div>
              <button class="btn btn--ghost btn--sm" id="res-refresh-btn">
                🔄 Refresh Queue
              </button>
            </div>
            <div class="res-list-container" id="res-list-items"></div>
          </div>
        `;

        const listDiv = container.querySelector('#res-list-items');

        if (filtered.length === 0) {
          listDiv.innerHTML = `
            <div class="empty-state" style="padding:48px 20px;">
              <p class="empty-state__desc">No customer reservations in this category.</p>
            </div>
          `;
        } else {
          filtered.forEach(res => {
            const card = document.createElement('div');
            card.className = `res-order-card res-order-card--${res.status}`;

            const statusBadges = {
              pending: '<span class="badge badge--amber">● Pending Hold</span>',
              confirmed: '<span class="badge badge--green">● Confirmed Ready</span>',
              completed: '<span class="badge badge--green">✓ Picked Up &amp; Fulfilled</span>',
              cancelled: '<span class="badge badge--red">✕ Cancelled</span>',
              expired: '<span class="badge badge--red">✕ Hold Expired</span>'
            };

            const holdTimeInfo = res.status === 'pending'
              ? (res.remaining_minutes > 0 ? `<span style="color:var(--clr-amber); font-weight:700;">⏳ ${res.remaining_minutes}m left to hold</span>` : '<span style="color:var(--clr-red);">Hold Expired</span>')
              : `<span style="color:var(--clr-text-500);">${utils.formatAgo(res.minutes_ago)}</span>`;

            card.innerHTML = `
              <div class="res-order-card__header">
                <div>
                  <span class="res-order-code">${res.request_id}</span>
                  <span style="font-size:var(--text-xs); color:var(--clr-text-500); margin-left:8px;">${res.created_at}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  ${holdTimeInfo}
                  ${statusBadges[res.status] || ''}
                </div>
              </div>
              <div class="res-order-card__body">
                <div>
                  <div class="res-order-med">${utils.escape(res.medicine_name)}</div>
                  <div class="res-order-qty">Quantity: <strong>${res.quantity}</strong> unit(s)</div>
                </div>
                <div class="res-order-actions">
                  ${res.status === 'pending' ? `
                    <button class="btn btn--primary btn--sm res-act-btn" data-act="confirmed" data-id="${res.id}">
                      ✓ Confirm (Ready for Pickup)
                    </button>
                    <button class="btn btn--ghost btn--sm res-act-btn" data-act="cancelled" data-id="${res.id}">
                      ✕ Out of Stock / Reject
                    </button>
                  ` : ''}
                  ${res.status === 'confirmed' ? `
                    <button class="btn btn--primary btn--sm res-act-btn" data-act="completed" data-id="${res.id}">
                      ✓ Handed Over &amp; Complete
                    </button>
                    <button class="btn btn--ghost btn--sm res-act-btn" data-act="cancelled" data-id="${res.id}">
                      ✕ Cancel Order
                    </button>
                  ` : ''}
                  <a href="https://api.whatsapp.com/send?text=${encodeURIComponent('Hello! Your reservation ' + res.request_id + ' for ' + res.medicine_name + ' (' + res.quantity + 'x) at ' + session.name + ' is confirmed. Please show this message at counter.')}" target="_blank" rel="noopener" class="btn btn--secondary btn--sm">
                    💬 WhatsApp Slip
                  </a>
                </div>
              </div>
            `;

            card.querySelectorAll('.res-act-btn').forEach(btn => {
              btn.addEventListener('click', async () => {
                const act = btn.getAttribute('data-act');
                const id = parseInt(btn.getAttribute('data-id'), 10);
                btn.disabled = true;
                try {
                  await api.updateReservationStatus(session.pharmacy_id, id, act);
                  res.status = act;
                  toast.success('Reservation Updated', `Order ${res.request_id} marked as ${act}.`);
                  // If completed, refresh inventory too!
                  if (act === 'completed') {
                    api.inventory(session.pharmacy_id).then(newItems => {
                      state.set({ inventory: { items: newItems } });
                      renderStats(newItems);
                      renderInventory();
                    });
                  }
                  renderQueue();
                } catch (err) {
                  btn.disabled = false;
                  toast.error('Update failed', err.message);
                }
              });
            });

            listDiv.appendChild(card);
          });
        }

        // Filter button listeners
        container.querySelectorAll('.res-filter-btn').forEach(fb => {
          fb.addEventListener('click', () => {
            currentFilter = fb.getAttribute('data-filter');
            renderQueue();
          });
        });

        // Refresh button
        container.querySelector('#res-refresh-btn')?.addEventListener('click', () => {
          loadAndRenderReservations(container, session);
        });
      }

      renderQueue();

    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p class="empty-state__desc">Failed to load reservations: ${utils.escape(err.message)}</p></div>`;
    }
  }

  // ------------------------------------------------------------
  // Pharmacy Delivery Orders Tab
  // ------------------------------------------------------------
  async function loadAndRenderPharmacyOrders(container, session) {
    container.innerHTML = `<div class="spinner" aria-label="Loading delivery orders…"></div>`;

    try {
      const list = await api.pharmacyOrders(session.pharmacy_id);
      let currentFilter = 'active';

      function renderOrders() {
        const filtered = list.filter(o => {
          if (currentFilter === 'active') return o.status === 'placed' || o.status === 'preparing' || o.status === 'out_for_delivery';
          if (currentFilter === 'completed') return o.status === 'delivered';
          if (currentFilter === 'all') return true;
          return o.status === currentFilter;
        });

        const activeCount = list.filter(o => o.status === 'placed' || o.status === 'preparing' || o.status === 'out_for_delivery').length;
        const badge = document.getElementById('orders-pending-badge');
        if (badge) {
          badge.textContent = activeCount;
          badge.style.display = activeCount > 0 ? 'inline-block' : 'none';
        }

        container.innerHTML = `
          <div class="res-queue">
            <div class="res-queue-toolbar">
              <div class="res-filter-group">
                <button class="res-filter-btn ${currentFilter === 'active' ? 'active' : ''}" data-filter="active">Active Orders (${activeCount})</button>
                <button class="res-filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All (${list.length})</button>
                <button class="res-filter-btn ${currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">Delivered (${list.filter(o => o.status === 'delivered').length})</button>
              </div>
              <button class="btn btn--ghost btn--sm" id="ord-refresh-btn">
                🔄 Refresh Orders
              </button>
            </div>
            <div class="res-list-container" id="ord-list-items"></div>
          </div>
        `;

        const listDiv = container.querySelector('#ord-list-items');
        if (filtered.length === 0) {
          listDiv.innerHTML = `
            <div class="empty-state card" style="padding:48px 20px; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 12px;">🛵</div>
              <p class="empty-state__desc">No incoming delivery orders in this view.</p>
            </div>`;
        } else {
          filtered.forEach(order => {
            const card = document.createElement('div');
            card.className = `order-card card`;
            const itemsHtml = (order.items || []).map(i => `
              <div class="order-card__item">
                <strong>${i.quantity}x ${utils.escape(i.medicine_name || i.medicine)}</strong> ${utils.escape(i.strength || '')} (${utils.escape(i.form || 'Tablet')}) — ₹${i.line_total || (i.price * i.quantity)}
              </div>
            `).join('');

            const statusColors = {
              placed: 'badge--primary',
              preparing: 'badge--amber',
              out_for_delivery: 'badge--green',
              delivered: 'badge--green',
              cancelled: 'badge--red'
            };

            card.innerHTML = `
              <div class="order-card__header">
                <div>
                  <span class="order-card__code">${utils.escape(order.order_code)}</span>
                  <span class="badge ${statusColors[order.status] || 'badge--muted'}" style="margin-left: 8px;">● ${order.status.replace(/_/g, ' ').toUpperCase()}</span>
                </div>
                <div class="order-card__meta">
                  OTP: <strong>${utils.escape(order.delivery_otp || '----')}</strong> • Placed ${order.minutes_ago ? order.minutes_ago + 'm ago' : 'Recently'}
                </div>
              </div>
              <div style="font-size: 13px; color: var(--clr-text-700); margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px;">
                <div>👤 <strong>Customer:</strong> ${utils.escape(order.customer_name)} (${utils.escape(order.customer_phone)})</div>
                <div>📍 <strong>Address:</strong> ${utils.escape(order.customer_address)}</div>
                <div>🛵 <strong>Delivery Partner:</strong> ${utils.escape(order.rider_name || 'Ramesh Kumar')} (${utils.escape(order.rider_phone || '')})</div>
              </div>
              <div class="order-card__items">
                ${itemsHtml}
              </div>
              <div class="order-card__footer">
                <div class="order-card__total">Bill Total: ₹${order.total_amount} <span style="font-size: 11px; font-weight: normal; color: var(--clr-text-500);">(${order.payment_method.toUpperCase()})</span></div>
                <div class="order-actions-wrap" style="display: flex; gap: 8px;">
                  ${order.status === 'placed' ? `<button class="btn btn--primary btn--sm btn-pack-order">Start Packing 💊</button>` : ''}
                  ${order.status === 'preparing' ? `<button class="btn btn--primary btn--sm btn-dispatch-order">Hand to Rider 🛵</button>` : ''}
                  ${order.status === 'out_for_delivery' ? `<button class="btn btn--secondary btn--sm btn-complete-order">Mark Delivered ✅</button>` : ''}
                  <a href="#/track/${encodeURIComponent(order.order_code)}" class="btn btn--ghost btn--sm">Track Live ➔</a>
                </div>
              </div>
            `;

            card.querySelector('.btn-pack-order')?.addEventListener('click', async (e) => {
              e.target.disabled = true;
              await api.updatePharmacyOrderStatus(session.pharmacy_id, order.id, 'preparing');
              order.status = 'preparing';
              toast.success('Order Packed', `Order ${order.order_code} is ready for rider handover.`);
              renderOrders();
            });

            card.querySelector('.btn-dispatch-order')?.addEventListener('click', async (e) => {
              e.target.disabled = true;
              await api.updatePharmacyOrderStatus(session.pharmacy_id, order.id, 'out_for_delivery');
              order.status = 'out_for_delivery';
              toast.success('Dispatched', `Order ${order.order_code} handed over to delivery partner.`);
              renderOrders();
            });

            card.querySelector('.btn-complete-order')?.addEventListener('click', async (e) => {
              e.target.disabled = true;
              await api.updatePharmacyOrderStatus(session.pharmacy_id, order.id, 'delivered');
              order.status = 'delivered';
              toast.success('Delivered', `Order ${order.order_code} marked as delivered.`);
              renderOrders();
            });

            listDiv.append(card);
          });
        }

        container.querySelectorAll('.res-filter-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            currentFilter = btn.getAttribute('data-filter');
            renderOrders();
          });
        });

        container.querySelector('#ord-refresh-btn')?.addEventListener('click', () => {
          loadAndRenderPharmacyOrders(container, session);
        });
      }

      renderOrders();
    } catch (err) {
      container.innerHTML = `<p class="form-error">Failed to load orders: ${utils.escape(err.message)}</p>`;
    }
  }

  // ------------------------------------------------------------
  // Demand Analytics & Restock Predictor Tab
  // ------------------------------------------------------------
  async function loadAndRenderAnalytics(container, session) {
    container.innerHTML = `<div class="spinner" aria-label="Loading analytics…"></div>`;

    try {
      const data = await api.analytics(session.pharmacy_id);
      const resData = data.reservations;
      const invData = data.inventory_health;
      const insights = data.demand_insights || [];

      const rowsHtml = insights.map(item => {
        const badgeCls = item.urgency.includes('Critical')
          ? 'urgency-badge--critical'
          : (item.urgency.includes('Low') ? 'urgency-badge--low' : 'urgency-badge--healthy');

        return `
          <tr>
            <td><strong>${utils.escape(item.name)}</strong></td>
            <td><span class="badge ${item.demand_level.includes('High') ? 'badge--amber' : 'badge--green'}">${item.demand_level}</span></td>
            <td>${item.searches_30d.toLocaleString()} local searches</td>
            <td><strong>${item.current_stock}</strong> in stock</td>
            <td><span class="urgency-badge ${badgeCls}">${item.urgency}</span></td>
            <td>
              <button class="btn btn--secondary btn--sm quick-restock-btn" data-name="${utils.escape(item.name)}">
                + Restock (+20)
              </button>
            </td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
          <!-- KPI Cards -->
          <div class="analytics-grid">
            <div class="stat-card">
              <div class="stat-card__value stat-card__value--green">${resData.fulfillment_rate}%</div>
              <div class="stat-card__label">Order Fulfillment Rate</div>
            </div>
            <div class="stat-card">
              <div class="stat-card__value">${resData.total}</div>
              <div class="stat-card__label">Total Customer Holds</div>
            </div>
            <div class="stat-card">
              <div class="stat-card__value stat-card__value--green">${invData.freshness_health_pct}%</div>
              <div class="stat-card__label">Inventory Freshness Score</div>
            </div>
            <div class="stat-card">
              <div class="stat-card__value stat-card__value--amber">${invData.low_stock + invData.out_of_stock}</div>
              <div class="stat-card__label">Medicines Needing Restock</div>
            </div>
          </div>

          <!-- Neighborhood Demand Table -->
          <div class="demand-table-wrap">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
              <div>
                <h3 style="margin:0; font-size:var(--text-lg); font-weight:800; color:var(--clr-text-900);">
                  📍 High-Demand Medicines in Your Area (Neighborhood Search Index)
                </h3>
                <p style="margin:4px 0 0 0; font-size:var(--text-sm); color:var(--clr-text-500);">
                  Real-time medicine demand trends from nearby customers compared against your store's current inventory.
                </p>
              </div>
            </div>
            <table class="demand-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Area Demand</th>
                  <th>Monthly Searches</th>
                  <th>Your Stock</th>
                  <th>Restock Urgency</th>
                  <th>Quick Action</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Quick restock button handlers
      container.querySelectorAll('.quick-restock-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const medName = btn.getAttribute('data-name');
          btn.disabled = true;
          btn.textContent = 'Updating…';

          try {
            // Find in current inventory
            const items = state.get().inventory.items;
            const existing = items.find(i => i.name.toLowerCase().includes(medName.toLowerCase()));

            if (existing) {
              const newQty = existing.quantity + 20;
              await api.updateStock(session.pharmacy_id, { medicine_id: existing.medicine_id, quantity: newQty });
              existing.quantity = newQty;
              existing.freshness = 'fresh';
              toast.success('Restocked!', `${medName} increased by +20 (Total: ${newQty}).`);
            } else {
              // Add from catalog
              const cat = await api.catalog();
              const catItem = cat.find(c => c.name.toLowerCase().includes(medName.toLowerCase()));
              if (catItem) {
                await api.addMedicine(session.pharmacy_id, catItem.id, 20);
                toast.success('Added & Restocked!', `${medName} added to inventory with 20 units.`);
              }
            }

            // Refresh analytics and inventory
            loadAndRenderAnalytics(container, session);
            api.inventory(session.pharmacy_id).then(newItems => {
              state.set({ inventory: { items: newItems } });
              renderStats(newItems);
              renderInventory();
            });
          } catch (err) {
            btn.disabled = false;
            btn.textContent = '+ Restock (+20)';
            toast.error('Restock failed', err.message);
          }
        });
      });

    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p class="empty-state__desc">Failed to load analytics: ${utils.escape(err.message)}</p></div>`;
    }
  }

  // ------------------------------------------------------------
  // Add Medicine Dialog Modal
  // ------------------------------------------------------------
  async function openAddMedicineDialog(session) {
    const backdrop = document.getElementById('reserve-modal-backdrop');
    const content = document.getElementById('reserve-modal-content');
    if (!backdrop || !content) return;

    content.innerHTML = `<div class="spinner" aria-label="Loading catalog…"></div>`;
    backdrop.hidden = false;

    try {
      const catalog = await api.catalog();
      const currentItems = state.get().inventory.items;
      const currentIds = new Set(currentItems.map(i => i.medicine_id));
      const availableToAdd = catalog.filter(c => !currentIds.has(c.id));

      if (availableToAdd.length === 0) {
        content.innerHTML = `
          <h2 class="modal__title">All Medicines Listed</h2>
          <p class="modal__subtitle">Your pharmacy currently lists all medicines in the MedFind catalog!</p>
          <button class="btn btn--secondary" style="width:100%; margin-top:16px;" id="close-add-modal-btn">Close</button>
        `;
        content.querySelector('#close-add-modal-btn')?.addEventListener('click', () => { backdrop.hidden = true; });
        return;
      }

      const optionsHtml = availableToAdd.map(c => `
        <option value="${c.id}">${utils.escape(c.name)} ${utils.escape(c.strength)} (${utils.escape(c.form)})</option>
      `).join('');

      content.innerHTML = `
        <h2 class="modal__title">+ Add Medicine to Store</h2>
        <p class="modal__subtitle">Select a medicine from the verified MedFind catalog and set your counter stock.</p>
        <div style="display:flex; flex-direction:column; gap:14px; margin-top:16px;">
          <div>
            <label class="form-label" for="add-med-select">Medicine</label>
            <select id="add-med-select" class="form-input" style="width:100%;">
              ${optionsHtml}
            </select>
          </div>
          <div>
            <label class="form-label" for="add-med-qty">Initial Stock Quantity</label>
            <input type="number" id="add-med-qty" class="form-input" value="30" min="1" max="1000" style="width:100%;" />
          </div>
          <button class="btn btn--primary" id="confirm-add-med-btn" style="width:100%; margin-top:8px;">
            Add to My Inventory
          </button>
        </div>
      `;

      content.querySelector('#confirm-add-med-btn')?.addEventListener('click', async () => {
        const select = content.querySelector('#add-med-select');
        const qtyInput = content.querySelector('#add-med-qty');
        const medId = parseInt(select.value, 10);
        const qty = parseInt(qtyInput.value, 10) || 10;

        const btn = content.querySelector('#confirm-add-med-btn');
        btn.disabled = true;
        btn.textContent = 'Adding…';

        try {
          await api.addMedicine(session.pharmacy_id, medId, qty);
          backdrop.hidden = true;
          toast.success('Medicine Added', 'New medicine added to your pharmacy inventory.');
          // Refresh inventory
          const newItems = await api.inventory(session.pharmacy_id);
          state.set({ inventory: { items: newItems } });
          renderStats(newItems);
          renderInventory();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Add to My Inventory';
          toast.error('Add failed', err.message);
        }
      });

    } catch (err) {
      content.innerHTML = `<p class="form-error">Failed to load catalog: ${utils.escape(err.message)}</p>`;
    }
  }

  /* ----------------------------------------------------------
     CHECKOUT & PLACE ORDER VIEW (Swiggy / Blinkit style)
     ---------------------------------------------------------- */
  function checkout() {
    root.innerHTML = '';
    const currentCart = cart.get();

    const page = document.createElement('div');
    page.className = 'checkout-page page';

    if (!currentCart.items || currentCart.items.length === 0) {
      page.innerHTML = `
        <div class="empty-state card" style="max-width: 580px; margin: 40px auto; text-align: center; padding: 48px 24px;">
          <div style="font-size: 56px; margin-bottom: 16px;">🛍️</div>
          <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 8px;">Your Medicine Cart is Empty</h2>
          <p style="color: var(--clr-text-500); margin-bottom: 24px;">Search and add medicines from verified pharmacies near you to order with 15–20 min express delivery.</p>
          <a href="#/" class="btn btn--primary" style="display: inline-flex; border-radius: var(--radius-full); padding: 10px 24px;">🔍 Search Nearby Medicines</a>
        </div>
      `;
      root.append(page);
      return;
    }

    const savedCustomer = JSON.parse(localStorage.getItem('medfind_customer_details') || '{}');
    let deliveryMode = 'delivery'; // 'delivery' or 'pickup'
    let selectedAddressType = 'Home';
    let selectedPayment = 'upi';
    let discountAmount = 20.0; // HEALTHY20 promo

    page.innerHTML = `
      <div class="checkout-layout">
        <!-- Main Form Column -->
        <div class="checkout-main">
          <!-- Express Banner -->
          <div class="express-banner card">
            <div class="express-banner__icon">⚡</div>
            <div class="express-banner__text">
              <strong>Superfast Medicine Delivery in 15–20 Mins</strong>
              <p>Dispensed from verified store: <strong>${utils.escape(currentCart.pharmacy_name)}</strong></p>
            </div>
            <span class="badge badge--green">Live Dispensing</span>
          </div>

          <!-- Step 1: Delivery Mode & Address -->
          <div class="checkout-card card">
            <div class="checkout-card__header">
              <span class="step-circle">1</span>
              <div>
                <h2 class="checkout-card__title">Delivery Address &amp; Contact</h2>
                <p class="checkout-card__desc">Choose doorstep delivery or counter pickup</p>
              </div>
            </div>

            <!-- Delivery / Pickup Toggle -->
            <div class="delivery-toggle-group" role="radiogroup" aria-label="Order fulfillment type">
              <label class="delivery-toggle active" id="label-mode-delivery">
                <input type="radio" name="checkout_delivery_type" value="delivery" checked />
                <span class="delivery-toggle__icon">🛵</span>
                <div>
                  <strong>Doorstep Express Delivery</strong>
                  <p>Delivery partner brings to your home in 15–20 mins</p>
                </div>
              </label>
              <label class="delivery-toggle" id="label-mode-pickup">
                <input type="radio" name="checkout_delivery_type" value="pickup" />
                <span class="delivery-toggle__icon">🏥</span>
                <div>
                  <strong>Pharmacy Counter Pickup</strong>
                  <p>Pick up yourself in 10 mins (Zero delivery fee)</p>
                </div>
              </label>
            </div>

            <!-- Address Form Fields -->
            <div id="delivery-fields-wrapper" class="checkout-form-grid">
              <div class="form-group full-width">
                <label class="form-label">Address Tag</label>
                <div class="address-type-chips">
                  <button type="button" class="addr-chip active" data-type="Home">🏠 Home</button>
                  <button type="button" class="addr-chip" data-type="Work">💼 Work</button>
                  <button type="button" class="addr-chip" data-type="Other">📍 Other</button>
                </div>
              </div>

              <div class="form-group full-width">
                <label class="form-label" for="cust-address">Street / Flat / House Address *</label>
                <input type="text" id="cust-address" class="input" placeholder="e.g. Flat 402, Royal Residency, Janpath, Bhubaneswar" value="${utils.escape(savedCustomer.address || '')}" required />
              </div>

              <div class="form-group">
                <label class="form-label" for="cust-name">Patient / Recipient Name *</label>
                <input type="text" id="cust-name" class="input" placeholder="Full name" value="${utils.escape(savedCustomer.name || '')}" required />
              </div>

              <div class="form-group">
                <label class="form-label" for="cust-phone">Mobile Phone (for live delivery OTP) *</label>
                <input type="tel" id="cust-phone" class="input" placeholder="e.g. 9876543210" value="${utils.escape(savedCustomer.phone || '')}" required />
              </div>

              <div class="form-group full-width">
                <label class="form-label">Delivery Instructions (Optional)</label>
                <div class="instruction-chips">
                  <label class="inst-chip"><input type="checkbox" value="Leave at door" /> 🚪 Leave at door</label>
                  <label class="inst-chip"><input type="checkbox" value="Ring bell" /> 🔔 Ring bell</label>
                  <label class="inst-chip"><input type="checkbox" value="Avoid calling" /> 🔕 Avoid calling</label>
                  <label class="inst-chip"><input type="checkbox" value="Elderly patient" /> 👵 Elderly patient</label>
                </div>
              </div>
            </div>

            <!-- Pickup notice (hidden by default) -->
            <div id="pickup-fields-wrapper" class="pickup-notice" style="display: none;">
              <p>🏥 <strong>Counter Pickup Store:</strong> ${utils.escape(currentCart.pharmacy_name)}</p>
              <p style="color: var(--clr-text-500); font-size: 13px; margin: 4px 0 8px;">${utils.escape(currentCart.pharmacy_address || 'Bhubaneswar, Odisha')}</p>
              <div style="font-size: 13px; color: var(--clr-primary-dark); font-weight: 600;">
                ⚡ Your medicines will be packed and held at the express counter for pickup with your Order Code.
              </div>
            </div>
          </div>

          <!-- Step 2: Medicine Items in Cart -->
          <div class="checkout-card card">
            <div class="checkout-card__header">
              <span class="step-circle">2</span>
              <div>
                <h2 class="checkout-card__title">Medicines in Your Order</h2>
                <p class="checkout-card__desc">Dispensed by ${utils.escape(currentCart.pharmacy_name)}</p>
              </div>
              <a href="#/" class="btn btn--ghost btn--sm" style="margin-left: auto;">+ Add More Medicines</a>
            </div>

            <div class="checkout-items-list" id="checkout-items-list"></div>

            <div class="rx-note-box">
              <div class="rx-note-box__icon">📋</div>
              <div class="rx-note-box__text">
                <strong>Prescription Verification at Handover</strong>
                <p>For prescription medicines, please keep your doctor's prescription ready for the delivery partner or pharmacist.</p>
              </div>
            </div>
          </div>

          <!-- Step 3: Payment Options -->
          <div class="checkout-card card">
            <div class="checkout-card__header">
              <span class="step-circle">3</span>
              <div>
                <h2 class="checkout-card__title">Payment Method</h2>
                <p class="checkout-card__desc">Encrypted &amp; secure healthcare checkout</p>
              </div>
            </div>

            <div class="payment-options">
              <label class="payment-option active" id="pay-opt-upi">
                <input type="radio" name="checkout_payment" value="upi" checked />
                <span class="payment-icon">📱</span>
                <div style="flex: 1;">
                  <strong>Instant UPI (Google Pay, PhonePe, Paytm, BHIM)</strong>
                  <p>Instant confirmation • Zero transaction fee</p>
                </div>
                <span class="badge badge--green">Recommended</span>
              </label>

              <label class="payment-option" id="pay-opt-cod">
                <input type="radio" name="checkout_payment" value="cod" />
                <span class="payment-icon">💵</span>
                <div style="flex: 1;">
                  <strong>Cash on Delivery (Pay upon Arrival)</strong>
                  <p>Pay cash or scan QR when delivery partner arrives at your door</p>
                </div>
              </label>

              <label class="payment-option" id="pay-opt-card">
                <input type="radio" name="checkout_payment" value="card" />
                <span class="payment-icon">💳</span>
                <div style="flex: 1;">
                  <strong>Credit / Debit Card / Netbanking</strong>
                  <p>Visa, MasterCard, RuPay &amp; all major bank netbanking</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- Sticky Bill Summary Column -->
        <aside class="checkout-sidebar">
          <div class="bill-card card">
            <h2 class="bill-card__title">Bill Details</h2>

            <div class="bill-row">
              <span id="bill-items-label">Item Total</span>
              <span id="bill-subtotal">₹0</span>
            </div>

            <div class="bill-row">
              <span>Delivery Partner Fee</span>
              <span id="bill-delivery">₹25</span>
            </div>

            <div class="bill-row">
              <span>Sanitized Packaging &amp; Safety</span>
              <span id="bill-packaging">₹4</span>
            </div>

            <div class="bill-row" id="bill-discount-row">
              <span style="color: var(--clr-green); font-weight: 600;">Coupon: HEALTHY20</span>
              <span id="bill-discount" style="color: var(--clr-green); font-weight: 700;">-₹20</span>
            </div>

            <div class="bill-divider"></div>

            <div class="bill-row bill-row--total">
              <strong>To Pay</strong>
              <strong class="total-amount" id="bill-grand-total">₹0</strong>
            </div>

            <div class="savings-pill" id="bill-savings-pill">
              🎉 You are saving ₹20 on this medicine order!
            </div>

            <button type="button" class="btn btn--primary btn--order" id="btn-place-order">
              <span class="btn-order__total" id="btn-order-total">₹0</span>
              <span class="btn-order__action">
                Place Order
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </span>
            </button>

            <p class="bill-guarantee">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              100% genuine medicines from licensed pharmacies.
            </p>
          </div>
        </aside>
      </div>
    `;

    root.append(page);

    // Helpers to recalculate and re-render bill and items
    const itemsListEl = page.querySelector('#checkout-items-list');
    const billItemsLabel = page.querySelector('#bill-items-label');
    const billSubtotalEl = page.querySelector('#bill-subtotal');
    const billDeliveryEl = page.querySelector('#bill-delivery');
    const billPackagingEl = page.querySelector('#bill-packaging');
    const billDiscountRow = page.querySelector('#bill-discount-row');
    const billDiscountEl = page.querySelector('#bill-discount');
    const billGrandTotalEl = page.querySelector('#bill-grand-total');
    const btnOrderTotalEl = page.querySelector('#btn-order-total');
    const btnPlaceOrder = page.querySelector('#btn-place-order');

    function renderItems() {
      const c = cart.get();
      if (!c.items || c.items.length === 0) {
        checkout();
        return;
      }

      itemsListEl.innerHTML = '';
      c.items.forEach(it => {
        const row = document.createElement('div');
        row.className = 'checkout-item-row';
        row.innerHTML = `
          <div class="checkout-item-row__info">
            <span class="checkout-item-row__icon">💊</span>
            <div>
              <div class="checkout-item-row__name">${utils.escape(it.medicine)} ${utils.escape(it.strength)}</div>
              <div class="checkout-item-row__form">${utils.escape(it.form)} • ₹${it.price} each</div>
            </div>
          </div>
          <div class="checkout-item-row__stepper">
            <button type="button" class="btn-item-minus" aria-label="Decrease">−</button>
            <span class="item-qty">${it.quantity}</span>
            <button type="button" class="btn-item-plus" aria-label="Increase">+</button>
          </div>
          <div class="checkout-item-row__price">₹${(it.price * it.quantity).toFixed(0)}</div>
          <button type="button" class="checkout-item-row__remove" title="Remove item">×</button>
        `;

        row.querySelector('.btn-item-minus').addEventListener('click', () => {
          cart.updateQty(it.medicine, it.strength, it.quantity - 1);
          renderItems();
        });
        row.querySelector('.btn-item-plus').addEventListener('click', () => {
          cart.updateQty(it.medicine, it.strength, it.quantity + 1);
          renderItems();
        });
        row.querySelector('.checkout-item-row__remove').addEventListener('click', () => {
          cart.removeItem(it.medicine, it.strength);
          renderItems();
        });

        itemsListEl.appendChild(row);
      });

      updateBill();
    }

    function updateBill() {
      const c = cart.get();
      const subtotal = cart.getSubtotal();
      const count = cart.getCount();

      const deliveryFee = (subtotal >= 199 || deliveryMode === 'pickup') ? 0 : 25;
      const packagingFee = deliveryMode === 'delivery' ? 4 : 0;
      const discount = Math.min(subtotal, discountAmount);
      const grandTotal = Math.max(0, subtotal + deliveryFee + packagingFee - discount);

      billItemsLabel.textContent = `Item Total (${count} item${count > 1 ? 's' : ''})`;
      billSubtotalEl.textContent = `₹${subtotal.toFixed(0)}`;
      billDeliveryEl.innerHTML = deliveryFee === 0 ? '<span style="color:var(--clr-green); font-weight:700;">FREE</span>' : `₹${deliveryFee}`;
      billPackagingEl.textContent = `₹${packagingFee}`;
      billDiscountEl.textContent = `-₹${discount.toFixed(0)}`;
      billGrandTotalEl.textContent = `₹${grandTotal.toFixed(0)}`;
      btnOrderTotalEl.textContent = `₹${grandTotal.toFixed(0)}`;
    }

    // Toggle Delivery / Pickup
    const labelDelivery = page.querySelector('#label-mode-delivery');
    const labelPickup = page.querySelector('#label-mode-pickup');
    const deliveryFields = page.querySelector('#delivery-fields-wrapper');
    const pickupFields = page.querySelector('#pickup-fields-wrapper');

    labelDelivery.addEventListener('click', () => {
      deliveryMode = 'delivery';
      labelDelivery.classList.add('active');
      labelPickup.classList.remove('active');
      deliveryFields.style.display = 'grid';
      pickupFields.style.display = 'none';
      updateBill();
    });

    labelPickup.addEventListener('click', () => {
      deliveryMode = 'pickup';
      labelPickup.classList.add('active');
      labelDelivery.classList.remove('active');
      deliveryFields.style.display = 'none';
      pickupFields.style.display = 'block';
      updateBill();
    });

    // Address Type Chips
    page.querySelectorAll('.addr-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        page.querySelectorAll('.addr-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedAddressType = chip.getAttribute('data-type');
      });
    });

    // Payment method selection
    page.querySelectorAll('.payment-option').forEach(opt => {
      opt.addEventListener('click', () => {
        page.querySelectorAll('.payment-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        const rad = opt.querySelector('input[type="radio"]');
        if (rad) {
          rad.checked = true;
          selectedPayment = rad.value;
        }
      });
    });

    // Place Order Action
    btnPlaceOrder.addEventListener('click', async () => {
      const c = cart.get();
      if (!c.items || c.items.length === 0) return;

      const custName = (page.querySelector('#cust-name').value || '').trim();
      const custPhone = (page.querySelector('#cust-phone').value || '').trim();
      const custAddress = (page.querySelector('#cust-address').value || '').trim();

      if (deliveryMode === 'delivery') {
        if (!custAddress) {
          toast.warning('Address Required', 'Please enter your street / flat delivery address.');
          page.querySelector('#cust-address').focus();
          return;
        }
        if (!custPhone || custPhone.length < 7) {
          toast.warning('Phone Required', 'Please enter a valid mobile number for OTP delivery.');
          page.querySelector('#cust-phone').focus();
          return;
        }
      }

      const finalName = custName || 'Guest Patient';
      const finalAddress = deliveryMode === 'delivery'
        ? `[${selectedAddressType}] ${custAddress}`
        : `Store Pickup at ${c.pharmacy_name}`;

      localStorage.setItem('medfind_customer_details', JSON.stringify({
        name: finalName,
        phone: custPhone,
        address: custAddress,
      }));

      btnPlaceOrder.disabled = true;
      btnPlaceOrder.classList.add('btn--loading');

      try {
        const orderPayload = {
          pharmacy_id: c.pharmacy_id,
          pharmacy_name: c.pharmacy_name,
          customer_name: finalName,
          customer_phone: custPhone || '9876543210',
          customer_address: finalAddress,
          delivery_type: deliveryMode,
          items: c.items,
          discount: discountAmount,
          payment_method: selectedPayment,
        };

        const result = await api.placeOrder(orderPayload);
        userOrders.addCode(result.order_code);
        cart.clear();

        toast.success('Order Placed Successfully!', `Order ${result.order_code} dispatched to ${c.pharmacy_name}.`);
        router.navigate(`#/track/${encodeURIComponent(result.order_code)}`);
      } catch (err) {
        btnPlaceOrder.disabled = false;
        btnPlaceOrder.classList.remove('btn--loading');
        toast.error('Order Failed', err.message || 'Unable to place order. Please try again.');
      }
    });

    renderItems();
  }

  /* ----------------------------------------------------------
     LIVE ORDER TRACKING VIEW (Swiggy / Blinkit style)
     ---------------------------------------------------------- */
  async function orderTracking(orderCode) {
    root.innerHTML = '';
    const page = document.createElement('div');
    page.className = 'tracking-page page';

    if (!orderCode) {
      const saved = userOrders.getCodes();
      if (saved.length > 0) {
        orderCode = saved[0];
      } else {
        page.innerHTML = `
          <div class="empty-state card" style="max-width: 500px; margin: 40px auto; text-align: center; padding: 48px 24px;">
            <div style="font-size: 50px; margin-bottom: 12px;">🔍</div>
            <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 8px;">No Order Selected</h2>
            <p style="color: var(--clr-text-500); margin-bottom: 20px;">You haven't placed or selected an order to track yet.</p>
            <a href="#/orders" class="btn btn--primary">View My Orders</a>
          </div>`;
        root.append(page);
        return;
      }
    }

    page.innerHTML = `
      <div class="card" style="max-width: 650px; margin: 40px auto; text-align: center; padding: 48px 20px;">
        <div class="spinner" style="margin: 0 auto 16px;"></div>
        <p style="color: var(--clr-text-700); font-weight: 600;">Fetching live delivery tracking for ${utils.escape(orderCode)}…</p>
      </div>
    `;
    root.append(page);

    let order = null;
    try {
      order = await api.getOrder(orderCode);
    } catch (err) {
      page.innerHTML = `
        <div class="empty-state card" style="max-width: 520px; margin: 40px auto; text-align: center; padding: 40px 20px;">
          <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
          <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 8px;">Order Not Found</h2>
          <p style="color: var(--clr-text-500); margin-bottom: 20px;">Could not locate order "${utils.escape(orderCode)}".</p>
          <a href="#/orders" class="btn btn--primary">Go to My Orders</a>
        </div>`;
      return;
    }

    function renderTrackingUI() {
      const status = order.status || 'placed';

      const statusTitles = {
        placed: 'Order Placed! Pharmacy is preparing items 💊',
        preparing: 'Pharmacy is packing your medicines 📦',
        out_for_delivery: 'Out for Delivery! Rider on the way 🛵',
        delivered: 'Order Delivered! Get well soon 🎉',
        cancelled: 'Order has been cancelled ❌'
      };

      const etaBadgeText = {
        placed: 'Arriving in ~20 mins',
        preparing: 'Arriving in ~15 mins',
        out_for_delivery: 'Arriving in ~8 mins',
        delivered: 'Delivered',
        cancelled: 'Cancelled'
      };

      const routeFillPct = {
        placed: 25,
        preparing: 45,
        out_for_delivery: 75,
        delivered: 100,
        cancelled: 0
      };

      const riderPinPct = {
        placed: 25,
        preparing: 45,
        out_for_delivery: 75,
        delivered: 100,
        cancelled: 0
      };

      const steps = [
        { key: 'placed', label: 'Order Placed & Confirmed', desc: 'Pharmacy received your medicine request' },
        { key: 'preparing', label: 'Medicines Packed & Checked', desc: 'Pharmacist verified batches & expiries' },
        { key: 'out_for_delivery', label: 'Delivery Partner On the Way', desc: `${order.rider_name || 'Ramesh Kumar'} picked up package` },
        { key: 'delivered', label: 'Delivered to Doorstep', desc: 'Package handed over safely with OTP' },
      ];

      const stepKeys = ['placed', 'preparing', 'out_for_delivery', 'delivered'];
      const currentIdx = stepKeys.indexOf(status);

      const stepsHtml = steps.map((s, idx) => {
        let cls = '';
        if (currentIdx > idx || status === 'delivered') cls = 'completed';
        else if (currentIdx === idx) cls = 'current';

        return `
          <div class="stepper-step ${cls}">
            <div class="stepper-step__marker">${currentIdx > idx || status === 'delivered' ? '✓' : idx + 1}</div>
            <div class="stepper-step__content">
              <strong>${s.label}</strong>
              <p>${s.desc}</p>
            </div>
          </div>
        `;
      }).join('');

      const itemsHtml = (order.items || []).map(it => `
        <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
          <span>${it.quantity}x ${utils.escape(it.medicine_name || it.medicine)} (${utils.escape(it.strength || '')})</span>
          <strong>₹${it.line_total || (it.price * it.quantity)}</strong>
        </div>
      `).join('');

      page.innerHTML = `
        <!-- Teacher Demo Simulator Toolbar -->
        <div class="demo-controls-bar">
          <span class="demo-badge">🎓 Teacher/Examiner Simulator:</span>
          <button type="button" class="btn btn--sm btn--primary" id="btn-demo-advance">
            ⏩ Advance to Next Stage
          </button>
          <button type="button" class="btn btn--sm btn--secondary" id="btn-demo-reset">
            🔄 Reset to Placed
          </button>
          <span style="font-size: 12px; color: var(--clr-text-500); margin-left: auto;">
            Current Status: <strong>${status.toUpperCase()}</strong>
          </span>
        </div>

        <!-- Hero Header -->
        <div class="tracking-hero">
          <div>
            <div class="tracking-eta-pill">
              <span class="pulse-dot"></span>
              <span>${etaBadgeText[status] || 'Live Delivery'}</span>
            </div>
            <h1 class="tracking-hero__title">${statusTitles[status] || 'Medicine Delivery in Progress'}</h1>
            <p class="tracking-hero__sub">Order Code: <strong>${utils.escape(order.order_code)}</strong> • From ${utils.escape(order.pharmacy_name)}</p>
          </div>
          <button class="btn btn--white btn--sm" id="btn-refresh-tracking" style="font-weight: 700;">
            🔄 Refresh Status
          </button>
        </div>

        <!-- Delivery OTP Banner -->
        <div class="otp-banner">
          <div class="otp-banner__text">
            <strong>Delivery Verification OTP</strong>
            <p>Share this 4-digit security code with the delivery rider upon arrival</p>
          </div>
          <div class="otp-box">${utils.escape(order.delivery_otp || '4821')}</div>
        </div>

        <!-- Animated Delivery Route Simulation -->
        <div class="route-map-card card">
          <h2 style="font-size: 15px; font-weight: 800; margin: 0 0 10px; color: var(--clr-text-900);">Live Delivery Route</h2>
          <div class="route-simulation">
            <div class="route-node">
              <div class="route-node__icon">🏥</div>
              <strong>${utils.escape(order.pharmacy_name)}</strong>
            </div>

            <div class="route-line">
              <div class="route-line__fill" style="width: ${routeFillPct[status]}%;"></div>
              <div class="rider-avatar-pin" style="left: ${riderPinPct[status]}%;">🛵</div>
            </div>

            <div class="route-node">
              <div class="route-node__icon">🏠</div>
              <strong>Your Doorstep</strong>
            </div>
          </div>
          <p style="text-align: center; font-size: 12px; color: var(--clr-text-500); margin: 6px 0 0;">
            ${order.delivery_type === 'pickup' ? '🏥 Store Counter Pickup Mode' : `Delivering to: ${utils.escape(order.customer_address)}`}
          </p>
        </div>

        <!-- Stepper Pipeline -->
        <div class="stepper-card card">
          <h2 style="font-size: 16px; font-weight: 800; margin: 0 0 20px; color: var(--clr-text-900);">Order Progress</h2>
          <div class="stepper-track">
            ${stepsHtml}
          </div>
        </div>

        <!-- Delivery Partner Profile Card -->
        <div class="rider-card card">
          <div class="rider-info">
            <div class="rider-avatar">🛵</div>
            <div>
              <div class="rider-name">${utils.escape(order.rider_name || 'Ramesh Kumar')}</div>
              <div class="rider-rating">★ 4.9 • Superfast Delivery Partner • 1,240+ deliveries</div>
            </div>
          </div>
          <div class="rider-actions">
            <a href="tel:${order.rider_phone || '+919876543210'}" class="btn btn--secondary btn--sm">
              📞 Call Partner
            </a>
            <a href="https://wa.me/919876543210?text=Hi, regarding my medicine delivery order ${encodeURIComponent(order.order_code)}" target="_blank" class="btn btn--ghost btn--sm">
              💬 WhatsApp
            </a>
          </div>
        </div>

        <!-- Order Summary & Printable Receipt Accordion -->
        <div class="card printable-invoice" style="padding: 24px; border-radius: var(--radius-lg);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--clr-border); padding-bottom: 14px; margin-bottom: 14px;">
            <div>
              <h2 style="font-size: 16px; font-weight: 800; margin: 0; color: var(--clr-text-900);">Medical Invoice &amp; Order Summary</h2>
              <p style="font-size: 12px; color: var(--clr-text-500); margin: 2px 0 0;">Receipt #${utils.escape(order.order_code)} • Placed at ${order.created_at}</p>
            </div>
            <button type="button" class="btn btn--secondary btn--sm" id="btn-print-receipt">
              🖨️ Print Receipt
            </button>
          </div>

          <div style="margin-bottom: 16px;">
            ${itemsHtml}
          </div>

          <div style="border-top: 1px dashed var(--clr-border); padding-top: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--clr-text-500); margin-bottom: 4px;">
              <span>Subtotal:</span> <span>₹${order.subtotal}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--clr-text-500); margin-bottom: 4px;">
              <span>Delivery Partner Fee:</span> <span>${order.delivery_fee === 0 ? 'FREE' : '₹' + order.delivery_fee}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--clr-green); font-weight: 600; margin-bottom: 8px;">
              <span>Discount (HEALTHY20):</span> <span>-₹${order.discount}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: var(--clr-text-900);">
              <span>Total Paid:</span> <span style="color: var(--clr-primary-dark);">₹${order.total_amount}</span>
            </div>
          </div>

          <div style="margin-top: 18px; display: flex; gap: 10px;">
            <a href="#/orders" class="btn btn--secondary btn--sm">View All Orders</a>
            <a href="#/" class="btn btn--primary btn--sm">Order More Medicines</a>
          </div>
        </div>
      `;

      // Wire simulator advance button
      page.querySelector('#btn-demo-advance')?.addEventListener('click', async () => {
        const nextMap = {
          placed: 'preparing',
          preparing: 'out_for_delivery',
          out_for_delivery: 'delivered',
          delivered: 'placed',
          cancelled: 'placed'
        };
        const nextStatus = nextMap[order.status] || 'preparing';
        try {
          await api.updateOrderStatus(order.order_code, nextStatus);
          order.status = nextStatus;
          toast.success('Status Updated', `Order transitioned to ${nextStatus.replace(/_/g, ' ')}!`);
          renderTrackingUI();
        } catch (err) {
          toast.error('Update failed', err.message);
        }
      });

      // Wire simulator reset button
      page.querySelector('#btn-demo-reset')?.addEventListener('click', async () => {
        try {
          await api.updateOrderStatus(order.order_code, 'placed');
          order.status = 'placed';
          toast.info('Status Reset', 'Order reset back to Placed stage.');
          renderTrackingUI();
        } catch (err) {
          toast.error('Reset failed', err.message);
        }
      });

      // Wire refresh
      page.querySelector('#btn-refresh-tracking')?.addEventListener('click', async () => {
        try {
          order = await api.getOrder(order.order_code);
          toast.info('Status Refreshed', 'Latest order updates loaded.');
          renderTrackingUI();
        } catch (err) {
          toast.error('Refresh failed', err.message);
        }
      });

      // Wire print receipt
      page.querySelector('#btn-print-receipt')?.addEventListener('click', () => {
        window.print();
      });
    }

    renderTrackingUI();
  }

  /* ----------------------------------------------------------
     MY ORDERS VIEW (Swiggy / Blinkit style)
     ---------------------------------------------------------- */
  async function orders() {
    root.innerHTML = '';
    const page = document.createElement('div');
    page.className = 'orders-page page';

    page.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h1 style="font-size: 24px; font-weight: 800; color: var(--clr-text-900); margin: 0;">My Medicine Orders</h1>
          <p style="color: var(--clr-text-500); font-size: 14px; margin: 4px 0 0;">View live delivery progress, past prescriptions, and invoices</p>
        </div>
        <a href="#/" class="btn btn--primary btn--sm">+ Order New Medicines</a>
      </div>
      <div id="orders-content-area">
        <div class="card" style="padding: 40px; text-align: center;">
          <div class="spinner" style="margin: 0 auto 12px;"></div>
          <p>Loading your orders…</p>
        </div>
      </div>
    `;

    root.append(page);
    const contentArea = page.querySelector('#orders-content-area');

    try {
      const allOrders = await api.listOrders();
      const userCodes = userOrders.getCodes();

      let displayOrders = allOrders;
      if (userCodes.length > 0) {
        displayOrders = allOrders.filter(o => userCodes.includes(o.order_code));
        if (displayOrders.length === 0) displayOrders = allOrders;
      }

      if (displayOrders.length === 0) {
        contentArea.innerHTML = `
          <div class="empty-state card" style="text-align: center; padding: 48px 20px;">
            <div style="font-size: 48px; margin-bottom: 12px;">🛍️</div>
            <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 8px;">No Orders Yet</h2>
            <p style="color: var(--clr-text-500); margin-bottom: 20px;">You haven't placed any medicine orders. Search for medicines near you to get started.</p>
            <a href="#/" class="btn btn--primary">Find Medicines Nearby</a>
          </div>
        `;
        return;
      }

      const statusColors = {
        placed: 'badge--primary',
        preparing: 'badge--amber',
        out_for_delivery: 'badge--green',
        delivered: 'badge--green',
        cancelled: 'badge--red'
      };

      contentArea.innerHTML = `
        <div class="orders-list">
          ${displayOrders.map(o => {
            const itemsSummary = (o.items || []).map(i => `${i.quantity}x ${utils.escape(i.medicine_name || i.medicine)}`).join(', ');
            return `
              <div class="order-card card">
                <div class="order-card__header">
                  <div>
                    <span class="order-card__code">${utils.escape(o.order_code)}</span>
                    <span class="badge ${statusColors[o.status] || 'badge--muted'}" style="margin-left: 8px;">
                      ● ${o.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <div class="order-card__meta">
                    Placed at ${o.created_at} • OTP: <strong>${utils.escape(o.delivery_otp || '4821')}</strong>
                  </div>
                </div>

                <div style="font-size: 14px; margin-bottom: 10px; color: var(--clr-text-700);">
                  🏥 Dispensed from <strong>${utils.escape(o.pharmacy_name)}</strong>
                </div>

                <div class="order-card__items">
                  <div class="order-card__item">💊 ${itemsSummary}</div>
                  <div style="font-size: 12px; color: var(--clr-text-500);">📍 ${utils.escape(o.customer_address)}</div>
                </div>

                <div class="order-card__footer">
                  <div class="order-card__total">
                    Total: ₹${o.total_amount} <span style="font-size: 12px; font-weight: normal; color: var(--clr-text-500);">(${o.payment_method.toUpperCase()})</span>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <a href="#/track/${encodeURIComponent(o.order_code)}" class="btn btn--primary btn--sm">
                      Track Live Order ➔
                    </a>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch (err) {
      contentArea.innerHTML = `<p class="form-error">Failed to load orders: ${utils.escape(err.message)}</p>`;
    }
  }

  /* ----------------------------------------------------------
     LIVE MAP VIEW (#/map)
     ---------------------------------------------------------- */
  async function map() {
    root.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'map-page';

    const hero = document.createElement('div');
    hero.className = 'map-page__hero';
    hero.innerHTML = `
      <div>
        <div class="hero__eyebrow" style="margin-bottom:8px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          Real-time GPS Proximity
        </div>
        <h1 class="map-page__title">Live Pharmacy Map</h1>
        <p class="map-page__subtitle">Explore real-time medicine availability, store hours, and direct routes across Bhubaneswar.</p>
      </div>
      <div class="map-page__search-wrap">
        <form id="map-search-form" class="search-bar" role="search" aria-label="Search medicine on map">
          <div class="search-bar__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <input type="search" id="map-search-input" class="search-bar__input" placeholder="Search medicine (e.g. Dolo 650) or area (e.g. Patia, Saheed Nagar)…" value="${utils.escape(state.get().search.query)}" autocomplete="off" />
          <button type="submit" class="search-bar__btn" aria-label="Search">
            <span class="btn-label">Search</span>
          </button>
        </form>
        <div class="bbsr-hubs-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
          ${BBSR_NEIGHBORHOODS.map(nh => `
            <button type="button" class="chip bbsr-hub-btn" data-lat="${nh.lat}" data-lon="${nh.lon}" data-zoom="${nh.zoom}" style="font-size:12px;padding:5px 10px;">
              ${nh.label}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    const mapHost = document.createElement('div');
    mapHost.id = 'map-view-host';
    mapHost.innerHTML = `<div style="padding:60px 20px;text-align:center;"><p style="color:var(--clr-text-500);margin-top:12px;">Loading live pharmacy coordinates…</p></div>`;

    container.append(hero, mapHost);
    root.append(container);

    // Bind BBSR Hub chip buttons
    container.querySelectorAll('.bbsr-hub-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const hLat = parseFloat(btn.dataset.lat);
        const hLon = parseFloat(btn.dataset.lon);
        const hZoom = parseInt(btn.dataset.zoom, 10) || 14;
        const activeMap = components._activeLeafletMaps['fullscreen-live-map'];
        if (activeMap) {
          activeMap.flyTo([hLat, hLon], hZoom, { duration: 1.2 });
        }
      });
    });

    const { lat, lon } = state.get().location;
    const currentQ = state.get().search.query;

    const loadData = async (query = '') => {
      try {
        let items = [];
        if (query.trim().length >= 2) {
          items = await api.search(query.trim(), lat, lon);
        } else {
          items = await api.pharmacies(lat, lon);
        }
        mapHost.innerHTML = '';
        const mapCard = components.liveMap(items, {
          id: 'fullscreen-live-map',
          medicine: query.trim()
        });
        mapHost.append(mapCard);
      } catch (err) {
        mapHost.innerHTML = `
          <div class="empty-state" style="padding:40px 20px;">
            <p class="form-error">Could not load map data: ${utils.escape(err.message)}</p>
            <button class="btn btn--secondary" id="retry-map-btn">Retry</button>
          </div>
        `;
        document.getElementById('retry-map-btn')?.addEventListener('click', () => loadData(query));
      }
    };

    // Bind map search form
    const form = document.getElementById('map-search-form');
    const input = document.getElementById('map-search-input');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = (input?.value || '').trim();
      if (!q) {
        loadData('');
        return;
      }

      // Check if search query matches a Bhubaneswar area
      const matchedArea = BBSR_NEIGHBORHOODS.find(nh =>
        nh.name.toLowerCase().includes(q.toLowerCase()) || q.toLowerCase().includes(nh.name.toLowerCase())
      );
      if (matchedArea) {
        const activeMap = components._activeLeafletMaps['fullscreen-live-map'];
        if (activeMap) {
          activeMap.flyTo([matchedArea.lat, matchedArea.lon], matchedArea.zoom, { duration: 1.2 });
          toast.info('Bhubaneswar Hub', `Centered map on ${matchedArea.label}`);
          return;
        }
      }

      state.set({ search: { query: q } });
      loadData(q);
    });

    loadData(currentQ);
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

  return { home, login, dashboard, checkout, orderTracking, orders, map, notFound, applyFilters };
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
    '#/map'       : 'map',
    '#/login'     : 'login',
    '#/dashboard' : 'dashboard',
  };

  function resolve() {
    const hash = window.location.hash || '#/';

    // Close mobile menu
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) mobileMenu.hidden = true;
    const hamburger = document.getElementById('hamburger-btn');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');

    cart.updateUI();

    if (hash === '#/' || hash === '') {
      nav.setActiveLink('home');
      views.home();
    } else if (hash === '#/map') {
      nav.setActiveLink('map');
      views.map();
    } else if (hash === '#/checkout') {
      nav.setActiveLink('orders');
      views.checkout();
    } else if (hash.startsWith('#/track')) {
      nav.setActiveLink('orders');
      const parts = hash.split('/');
      const code = parts[2] ? decodeURIComponent(parts[2]) : '';
      views.orderTracking(code);
    } else if (hash === '#/orders') {
      nav.setActiveLink('orders');
      views.orders();
    } else if (hash === '#/login') {
      nav.setActiveLink('login');
      views.login();
    } else if (hash === '#/dashboard') {
      nav.setActiveLink('dashboard');
      views.dashboard();
    } else {
      views.notFound();
    }
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

  // Floating Cart Bar Checkout button listener
  document.getElementById('cart-pill-checkout-btn')?.addEventListener('click', () => {
    router.navigate('#/checkout');
  });

  // Restore session
  try {
    const sess = await api.session();
    if (sess.logged_in) {
      state.set({ session: { logged_in: true, pharmacy_id: sess.pharmacy_id, name: sess.name } });
      nav.updateAuth(true, sess.name);
    }
  } catch (_) { /* session check failing is non-fatal */ }

  // Initial cart UI & orders badge
  cart.updateUI();
  userOrders.updateBadge();

  // Initial route
  router.resolve();

  // Expose modal and router for widget integrations (e.g., MedBot assistant)
  window.medfindModal = modal;
  window.medfindRouter = router;
  window.medfindCart = cart;
}

document.addEventListener('DOMContentLoaded', boot);
