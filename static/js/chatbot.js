/**
 * chatbot.js — MedBot AI Medical Information & Support System
 * 
 * Standalone client module for MedFind. Provides:
 * - Floating action button with pulse notification
 * - Expandable glassmorphism chat interface
 * - Comprehensive medicine detail lookup cards
 * - Real-time nearby pharmacy stock checks & 1-click reservations
 * - Symptom-based guidance & home care remedies
 * - 30-minute hold reservation tracking
 * - In-chat customer support ticketing system
 * - National emergency & poison helpline directory
 * - Synthesized Web Audio sound effects (toggleable)
 * - Conversation persistence across views
 */

'use strict';

const medBot = (() => {
  // -------------------------------------------------------------------------
  // Config & Constants
  // -------------------------------------------------------------------------
  const STORAGE_KEY = 'medbot_conversation_v1';
  const MUTE_KEY = 'medbot_audio_muted';
  const DEFAULT_LAT = 20.2961;
  const DEFAULT_LON = 85.8245;

  let state = {
    isOpen: false,
    isFullscreen: false,
    isMuted: localStorage.getItem(MUTE_KEY) === 'true',
    isThinking: false,
    messages: []
  };

  let elements = {};
  let audioCtx = null;

  // -------------------------------------------------------------------------
  // Audio Synthesis (Web Audio API)
  // -------------------------------------------------------------------------
  function getAudioContext() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (state.isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'send') {
        // Soft friendly pop (600Hz -> 900Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(950, now + 0.06);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'receive') {
        // Pleasant double chime (523Hz [C5] then 659Hz [E5])
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.07);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      }
    } catch (_) {
      // Audio playback errors are non-critical
    }
  }

  // -------------------------------------------------------------------------
  // Escape & Markdown Helper
  // -------------------------------------------------------------------------
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderMarkdown(text) {
    if (!text) return '';
    let parsed = escapeHtml(text);

    // Bold **text**
    parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Bullet points (lines starting with • or -)
    parsed = parsed.replace(/(?:^|\n)[•\-]\s+(.+)/g, '<li>$1</li>');
    parsed = parsed.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    // Clean duplicate <ul> wrapper tags
    parsed = parsed.replace(/<\/ul>\s*<ul>/g, '');
    // Paragraph breaks
    parsed = parsed.replace(/\n\n/g, '</p><p>');
    parsed = parsed.replace(/\n/g, '<br/>');

    return `<p>${parsed}</p>`;
  }

  function formatTimestamp(d = new Date()) {
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hr12 = hours % 12 || 12;
    return `${hr12}:${minutes} ${ampm}`;
  }

  // -------------------------------------------------------------------------
  // Storage Persistence
  // -------------------------------------------------------------------------
  function saveHistory() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages.slice(-30)));
    } catch (_) {}
  }

  function loadHistory() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        state.messages = JSON.parse(saved);
      }
    } catch (_) {
      state.messages = [];
    }
  }

  // -------------------------------------------------------------------------
  // DOM Building
  // -------------------------------------------------------------------------
  function buildWidget() {
    // 1. Floating Action Button (FAB)
    const fab = document.createElement('button');
    fab.className = 'medbot-fab';
    fab.id = 'medbot-launcher';
    fab.setAttribute('aria-label', 'Open MedBot AI Health & Support Assistant');
    fab.innerHTML = `
      <div class="medbot-fab__icon-wrap">
        <svg class="medbot-fab__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          <path d="M12 7v6"></path>
          <path d="M9 10h6"></path>
        </svg>
        <span class="medbot-fab__pulse" aria-hidden="true"></span>
      </div>
      <div class="medbot-fab__label">
        <span class="medbot-fab__title">MedBot AI</span>
        <span class="medbot-fab__subtitle">Medicine &amp; Support</span>
      </div>
    `;

    // 2. Chatbot Window
    const win = document.createElement('div');
    win.className = 'medbot-window';
    win.id = 'medbot-window';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'MedBot Chatbot Window');
    win.innerHTML = `
      <!-- Header -->
      <div class="medbot-header">
        <div class="medbot-header__left">
          <div class="medbot-header__avatar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="6"></rect>
              <line x1="12" y1="6" x2="12" y2="18"></line>
            </svg>
            <span class="medbot-header__avatar-status" title="Active"></span>
          </div>
          <div class="medbot-header__meta">
            <h3>MedBot Assistant</h3>
            <p>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#10B981"><circle cx="12" cy="12" r="10"/></svg>
              Medicine Guide &amp; 24/7 Support
            </p>
          </div>
        </div>
        <div class="medbot-header__actions">
          <button class="medbot-header__btn" id="medbot-mute-btn" title="${state.isMuted ? 'Unmute sounds' : 'Mute sounds'}" aria-label="Toggle sound">
            ${state.isMuted ? '🔇' : '🔊'}
          </button>
          <button class="medbot-header__btn" id="medbot-expand-btn" title="Toggle full window" aria-label="Toggle full window">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          </button>
          <button class="medbot-header__btn" id="medbot-clear-btn" title="Clear conversation" aria-label="Clear chat">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
          <button class="medbot-header__btn" id="medbot-close-btn" title="Close chat" aria-label="Close chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- Medical Disclaimer Bar -->
      <div class="medbot-disclaimer-bar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>Informational medical assistant. In an emergency, dial 108 or 112 immediately.</span>
      </div>

      <!-- Messages Area -->
      <div class="medbot-messages" id="medbot-messages" tabindex="0" aria-live="polite"></div>

      <!-- Quick Chips Suggestion Bar -->
      <div class="medbot-chips" id="medbot-chips"></div>

      <!-- Input Footer -->
      <form class="medbot-footer" id="medbot-form">
        <input 
          type="text" 
          class="medbot-input" 
          id="medbot-input" 
          placeholder="Ask medicine uses, stock, dosage, support..." 
          autocomplete="off"
          aria-label="Ask MedBot a question"
        />
        <button type="submit" class="medbot-send-btn" id="medbot-send-btn" aria-label="Send message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(win);

    elements = {
      fab,
      win,
      messages: win.querySelector('#medbot-messages'),
      chips: win.querySelector('#medbot-chips'),
      form: win.querySelector('#medbot-form'),
      input: win.querySelector('#medbot-input'),
      sendBtn: win.querySelector('#medbot-send-btn'),
      muteBtn: win.querySelector('#medbot-mute-btn'),
      expandBtn: win.querySelector('#medbot-expand-btn'),
      clearBtn: win.querySelector('#medbot-clear-btn'),
      closeBtn: win.querySelector('#medbot-close-btn')
    };

    bindEvents();
  }

  // -------------------------------------------------------------------------
  // Event Listeners
  // -------------------------------------------------------------------------
  function bindEvents() {
    elements.fab.addEventListener('click', toggleOpen);
    elements.closeBtn.addEventListener('click', () => setOpen(false));

    elements.muteBtn.addEventListener('click', () => {
      state.isMuted = !state.isMuted;
      localStorage.setItem(MUTE_KEY, String(state.isMuted));
      elements.muteBtn.textContent = state.isMuted ? '🔇' : '🔊';
      elements.muteBtn.title = state.isMuted ? 'Unmute sounds' : 'Mute sounds';
    });

    elements.expandBtn.addEventListener('click', () => {
      state.isFullscreen = !state.isFullscreen;
      elements.win.classList.toggle('is-fullscreen', state.isFullscreen);
    });

    elements.clearBtn.addEventListener('click', () => {
      if (confirm('Clear chat conversation history?')) {
        state.messages = [];
        saveHistory();
        renderAllMessages();
        sendInitialGreeting();
      }
    });

    elements.form.addEventListener('submit', e => {
      e.preventDefault();
      const text = elements.input.value.trim();
      if (!text || state.isThinking) return;
      elements.input.value = '';
      handleUserSubmit(text);
    });

    // Close on Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.isOpen) {
        setOpen(false);
      }
    });
  }

  function setOpen(open) {
    state.isOpen = open;
    elements.win.classList.toggle('is-open', open);
    if (open) {
      setTimeout(() => elements.input.focus(), 250);
      scrollToBottom();
    }
  }

  function toggleOpen() {
    setOpen(!state.isOpen);
  }

  function scrollToBottom() {
    if (elements.messages) {
      elements.messages.scrollTop = elements.messages.scrollHeight;
    }
  }

  // -------------------------------------------------------------------------
  // Message Handling & Backend Communication
  // -------------------------------------------------------------------------
  async function handleUserSubmit(text) {
    // 1. Add user message
    const userMsg = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text,
      time: formatTimestamp(),
      cards: []
    };
    state.messages.push(userMsg);
    renderMessage(userMsg);
    playSound('send');
    scrollToBottom();
    saveHistory();

    // 2. Show thinking indicator
    showTypingIndicator();

    // 3. Obtain user geolocation if available
    let userLat = DEFAULT_LAT;
    let userLon = DEFAULT_LON;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
        }).catch(() => null);
        if (pos && pos.coords) {
          userLat = pos.coords.latitude;
          userLon = pos.coords.longitude;
        }
      } catch (_) {}
    }

    // 4. Send request to Flask /api/chat
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          lat: userLat,
          lon: userLon
        })
      });

      hideTypingIndicator();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const botMsg = {
        id: 'msg-' + Date.now(),
        sender: 'bot',
        text: data.reply || 'Here is what I found:',
        time: formatTimestamp(),
        cards: data.cards || [],
        quick_replies: data.quick_replies || []
      };

      state.messages.push(botMsg);
      renderMessage(botMsg);
      renderQuickReplies(botMsg.quick_replies);
      playSound('receive');
      scrollToBottom();
      saveHistory();

    } catch (err) {
      console.warn('MedBot API request failed:', err);
      hideTypingIndicator();

      const fallbackMsg = {
        id: 'msg-' + Date.now(),
        sender: 'bot',
        text: "I am having trouble connecting to the medical server. Please check your internet or try again in a moment.\n\nIn the meantime, you can search for medicines directly using the MedFind search bar above or view emergency helplines.",
        time: formatTimestamp(),
        cards: [{
          card_type: 'emergency_card',
          title: '🚨 Emergency Helplines',
          contacts: [
            { label: 'Ambulance / Medical Emergency', number: '108', tel: 'tel:108' },
            { label: 'Universal Emergency Helpline', number: '112', tel: 'tel:112' },
            { label: 'National Poison Info Centre', number: '1800-116-117', tel: 'tel:1800116117' }
          ]
        }],
        quick_replies: [
          { label: '💊 Paracetamol Details', action: 'Tell me about Paracetamol' },
          { label: '📍 Where is Dolo 650 in stock?', action: 'Where is Dolo 650 in stock?' },
          { label: '❓ How MedFind Works', action: 'How does MedFind work?' }
        ]
      };

      state.messages.push(fallbackMsg);
      renderMessage(fallbackMsg);
      renderQuickReplies(fallbackMsg.quick_replies);
      scrollToBottom();
      saveHistory();
    }
  }

  function showTypingIndicator() {
    state.isThinking = true;
    elements.sendBtn.disabled = true;

    const existing = document.getElementById('medbot-typing-indicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'medbot-typing-indicator';
    indicator.className = 'medbot-msg medbot-msg--bot';
    indicator.innerHTML = `
      <div class="medbot-typing">
        <span class="medbot-typing__dot"></span>
        <span class="medbot-typing__dot"></span>
        <span class="medbot-typing__dot"></span>
      </div>
    `;
    elements.messages.appendChild(indicator);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    state.isThinking = false;
    elements.sendBtn.disabled = false;
    const existing = document.getElementById('medbot-typing-indicator');
    if (existing) existing.remove();
  }

  // -------------------------------------------------------------------------
  // Message & Card Rendering
  // -------------------------------------------------------------------------
  function renderAllMessages() {
    elements.messages.innerHTML = '';
    state.messages.forEach(msg => renderMessage(msg));
    scrollToBottom();
  }

  function renderMessage(msg) {
    const el = document.createElement('div');
    el.className = `medbot-msg medbot-msg--${msg.sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'medbot-msg__bubble';
    bubble.innerHTML = renderMarkdown(msg.text);

    // Render structured rich cards
    if (msg.cards && msg.cards.length > 0) {
      msg.cards.forEach(cardData => {
        const cardEl = buildCardElement(cardData);
        if (cardEl) bubble.appendChild(cardEl);
      });
    }

    const time = document.createElement('span');
    time.className = 'medbot-msg__time';
    time.textContent = msg.time || formatTimestamp();

    el.appendChild(bubble);
    el.appendChild(time);
    elements.messages.appendChild(el);
  }

  function buildCardElement(card) {
    if (card.card_type === 'medicine_detail_card') {
      return buildMedicineDetailCard(card);
    } else if (card.card_type === 'stock_results_card') {
      return buildStockResultsCard(card);
    } else if (card.card_type === 'symptom_advice_card') {
      return buildSymptomAdviceCard(card);
    } else if (card.card_type === 'reservation_card') {
      return buildReservationCard(card);
    } else if (card.card_type === 'order_tracking_card') {
      return buildOrderTrackingCard(card);
    } else if (card.card_type === 'ticket_form_card') {
      return buildTicketFormCard(card);
    } else if (card.card_type === 'emergency_card') {
      return buildEmergencyCard(card);
    }
    return null;
  }

  // Card 1: Medicine Detail Card
  function buildMedicineDetailCard(c) {
    const card = document.createElement('div');
    card.className = 'med-card';

    const rxBadge = c.prescription_required
      ? '<span class="med-badge med-badge--rx">℞ Prescription</span>'
      : '<span class="med-badge med-badge--otc">✓ Over-The-Counter</span>';

    const usesList = (c.primary_uses || []).map(u => `<li>${escapeHtml(u)}</li>`).join('');
    const warningsList = (c.warnings || []).map(w => `<p style="margin:2px 0;">${escapeHtml(w)}</p>`).join('');
    const substitutes = (c.brand_equivalents || []).map(b => `<span class="med-tag">${escapeHtml(b)}</span>`).join('');

    card.innerHTML = `
      <div class="med-card__header">
        <div class="med-card__title-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F9D8A" stroke-width="2.5"><rect x="2" y="6" width="20" height="12" rx="6"/><line x1="12" y1="6" x2="12" y2="18"/></svg>
          <span class="med-card__name">${escapeHtml(c.name)}</span>
        </div>
        <div class="med-card__badges">
          <span class="med-badge med-badge--cat">${escapeHtml(c.category)}</span>
          ${rxBadge}
        </div>
      </div>
      <div class="med-card__body">
        <p style="margin:0; font-weight:500; color:var(--clr-text-700);">${escapeHtml(c.description)}</p>

        <div class="med-card__section">
          <span class="med-card__section-label">🩺 Primary Indications &amp; Uses:</span>
          <ul class="med-card__list">${usesList}</ul>
        </div>

        <div class="med-card__section">
          <span class="med-card__section-label">💊 Dosage &amp; Administration:</span>
          <p style="margin:2px 0; color:var(--clr-text-700);"><strong>Adult Dose:</strong> ${escapeHtml(c.dosage_instructions)}</p>
          <p style="margin:2px 0; color:var(--clr-text-500); font-size:0.8rem;"><em>How to take:</em> ${escapeHtml(c.how_to_take)}</p>
        </div>

        ${c.warnings && c.warnings.length ? `
        <div class="med-card__alert-box">
          <strong style="display:flex; align-items:center; gap:4px; margin-bottom:4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Safety Precautions &amp; Warnings:
          </strong>
          ${warningsList}
        </div>` : ''}

        ${substitutes ? `
        <div class="med-card__section">
          <span class="med-card__section-label">🔄 Common Brand Equivalents / Substitutes:</span>
          <div class="med-card__tags">${substitutes}</div>
        </div>` : ''}

        <div style="background:var(--clr-surface-alt); padding:10px; border-radius:8px; border:1px solid var(--clr-border); margin-top:4px;">
          <p style="margin:0 0 8px 0; font-size:0.82rem; font-weight:600;">${c.stock_summary || ''}</p>
          <button class="btn btn--primary btn--sm" style="width:100%;" id="check-stores-btn-${Date.now()}">
            🔍 Check Live Stock Near Me
          </button>
        </div>
      </div>
    `;

    // Hook check stores button
    const btn = card.querySelector('button[id^="check-stores-btn"]');
    if (btn) {
      btn.addEventListener('click', () => {
        handleUserSubmit(`Where is ${c.name} in stock?`);
      });
    }

    return card;
  }

  // Card 2: Stock Results Card
  function buildStockResultsCard(c) {
    const card = document.createElement('div');
    card.className = 'stock-card';

    const items = c.items || [];
    let itemsHtml = '';

    if (items.length === 0) {
      itemsHtml = `<div style="padding:16px; text-align:center; color:var(--clr-text-500); font-size:0.85rem;">No pharmacies found stocking this medicine right now.</div>`;
    } else {
      itemsHtml = items.map((item, idx) => {
        const badgeClass = item.stock_status === 'in_stock'
          ? 'stock-badge--in_stock'
          : (item.stock_status === 'low_stock' ? 'stock-badge--low_stock' : 'stock-badge--out_of_stock');

        const badgeLabel = item.stock_status === 'in_stock'
          ? `In Stock (${item.quantity})`
          : (item.stock_status === 'low_stock' ? `Low Stock (${item.quantity})` : 'Out of Stock');

        return `
          <div class="stock-item" data-idx="${idx}">
            <div class="stock-item__top">
              <div>
                <div class="stock-item__name">${escapeHtml(item.pharmacy)}</div>
                <div class="stock-item__addr">${escapeHtml(item.address)}</div>
              </div>
              <span class="stock-item__dist">📍 ${item.distance_km} km</span>
            </div>
            <div class="stock-item__meta">
              <span class="stock-badge ${badgeClass}">${badgeLabel}</span>
              ${item.stock_status !== 'out_of_stock' ? `
                <button class="stock-item__action-btn" data-pharmacy-id="${item.pharmacy_id}" data-pharmacy="${escapeHtml(item.pharmacy)}" data-medicine="${escapeHtml(item.medicine)}" data-strength="${escapeHtml(item.strength)}" data-form="${escapeHtml(item.form)}" data-quantity="${item.quantity}" data-address="${escapeHtml(item.address)}">
                  Reserve (30m Hold)
                </button>
              ` : '<span style="font-size:0.75rem; color:var(--clr-text-500);">Unavailable</span>'}
            </div>
          </div>
        `;
      }).join('');
    }

    card.innerHTML = `
      <div class="stock-card__header">
        <span>🏪 Nearby Pharmacies (${escapeHtml(c.medicine_name)})</span>
        <span style="font-size:0.75rem; font-weight:500; color:var(--clr-primary-dark);">Live Inventory</span>
      </div>
      <div class="stock-card__list">
        ${itemsHtml}
      </div>
    `;

    // Hook Reserve buttons to MedFind modal
    card.querySelectorAll('.stock-item__action-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const pId = parseInt(btn.getAttribute('data-pharmacy-id'), 10);
        const pName = btn.getAttribute('data-pharmacy');
        const medName = btn.getAttribute('data-medicine');
        const str = btn.getAttribute('data-strength');
        const form = btn.getAttribute('data-form');
        const qty = parseInt(btn.getAttribute('data-quantity'), 10);
        const addr = btn.getAttribute('data-address');

        // Check if window.medfindModal or app.js modal is available
        if (window.medfindModal && typeof window.medfindModal.openReserve === 'function') {
          window.medfindModal.openReserve({
            pharmacy_id: pId,
            pharmacy: pName,
            medicine: medName,
            strength: str,
            form: form,
            quantity: qty,
            address: addr,
            availability: qty > 10 ? 'in_stock' : 'low_stock'
          });
        } else {
          // Fallback direct reservation via API
          reserveDirectlyFromChat(pId, pName, medName, qty);
        }
      });
    });

    return card;
  }

  // Direct Chat Reservation Fallback
  async function reserveDirectlyFromChat(pharmacyId, pharmacyName, medicineName, availableQty) {
    try {
      showTypingIndicator();
      const res = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacy_id: pharmacyId,
          medicine: medicineName,
          quantity: 1
        })
      });
      hideTypingIndicator();
      const data = await res.json();
      if (res.ok) {
        handleUserSubmit(`Track ${data.request_id}`);
      } else {
        alert(data.error || 'Failed to place reservation.');
      }
    } catch (err) {
      hideTypingIndicator();
      alert('Could not place reservation. Please try again.');
    }
  }

  // Card 3: Symptom Advice Card
  function buildSymptomAdviceCard(c) {
    const card = document.createElement('div');
    card.className = 'med-card';

    const firstLineList = (c.first_line || []).map(m => `<li><strong>${escapeHtml(m)}</strong></li>`).join('');
    const homeCareList = (c.home_care || []).map(h => `<li>${escapeHtml(h)}</li>`).join('');

    card.innerHTML = `
      <div class="med-card__header">
        <div class="med-card__title-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F9D8A" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          <span class="med-card__name">${escapeHtml(c.condition)}</span>
        </div>
      </div>
      <div class="med-card__body">
        <div class="med-card__section">
          <span class="med-card__section-label">💊 Recommended First-Line Medications:</span>
          <ul class="med-card__list">${firstLineList}</ul>
        </div>

        <div class="med-card__section">
          <span class="med-card__section-label">🍵 Non-Pharmacological Self-Care:</span>
          <ul class="med-card__list">${homeCareList}</ul>
        </div>

        <div class="med-card__alert-box" style="border-left-color:#DC2626; color:#991B1B; background:#FEF2F2;">
          ${escapeHtml(c.red_flags || '')}
        </div>
      </div>
    `;

    return card;
  }

  // Card 4: Reservation Status Card
  function buildReservationCard(c) {
    const card = document.createElement('div');
    card.className = 'res-card';

    card.innerHTML = `
      <div class="res-card__top">
        <span class="res-card__code">${escapeHtml(c.code)}</span>
        <span class="med-badge" style="background:var(--clr-primary-light); color:var(--clr-primary-dark);">${c.status_badge}</span>
      </div>
      <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:4px;">
        <p style="margin:0;"><strong>Pharmacy:</strong> ${escapeHtml(c.pharmacy)}</p>
        <p style="margin:0; color:var(--clr-text-500); font-size:0.8rem;">📍 ${escapeHtml(c.address)}</p>
        <p style="margin:4px 0 0 0;"><strong>Medicine:</strong> ${escapeHtml(c.medicine)} &bull; <strong>Qty:</strong> ${c.quantity}</p>
      </div>
      <div class="res-card__timer-box">
        ${renderMarkdown(c.time_msg)}
      </div>
    `;

    return card;
  }

  // Card 4.5: Express Order Tracking Card
  function buildOrderTrackingCard(c) {
    const card = document.createElement('div');
    card.className = 'res-card';

    const itemsSummary = (c.items || []).map(it => `${it.quantity}x ${escapeHtml(it.name || it.medicine_name)}`).join(', ');
    const otpBadge = c.otp && c.status !== 'delivered'
      ? `<div style="background:#ECFDF5; border:1px dashed #059669; color:#065F46; padding:6px 10px; border-radius:6px; font-weight:700; font-size:0.85rem; margin-top:6px; display:flex; justify-content:space-between; align-items:center;">
           <span>Delivery OTP:</span>
           <span style="letter-spacing:2px; font-size:1.05rem; font-family:monospace;">${escapeHtml(c.otp)}</span>
         </div>`
      : '';

    card.innerHTML = `
      <div class="res-card__top">
        <span class="res-card__code">🛵 ${escapeHtml(c.order_code)}</span>
        <span class="med-badge" style="background:var(--clr-primary-light); color:var(--clr-primary-dark); font-weight:700;">${escapeHtml(c.status_label || c.status)}</span>
      </div>
      <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:4px;">
        <p style="margin:0;"><strong>Pharmacy:</strong> ${escapeHtml(c.pharmacy || 'MedFind Partner')}</p>
        <p style="margin:0; color:var(--clr-text-600);"><strong>Items:</strong> ${itemsSummary || 'Medicine Order'}</p>
        <p style="margin:2px 0 0 0;"><strong>Total:</strong> ₹${c.total} &bull; <strong>Type:</strong> ${c.delivery_type === 'express_delivery' ? '⚡ 15-Min Express' : '🏪 Counter Pickup'}</p>
      </div>
      ${otpBadge}
      <div style="margin-top:10px; display:flex; gap:8px;">
        <a href="#/track/${encodeURIComponent(c.order_code)}" class="btn btn--primary btn--sm" style="flex:1; text-align:center; text-decoration:none;" onclick="if(window.medBot) window.medBot.close();">
          📍 Track Live Map
        </a>
        <a href="#/orders" class="btn btn--outline btn--sm" style="text-decoration:none;" onclick="if(window.medBot) window.medBot.close();">
          All Orders
        </a>
      </div>
    `;

    return card;
  }

  // Card 5: In-Chat Support Ticket Form Card
  function buildTicketFormCard(c) {
    const card = document.createElement('div');
    card.className = 'ticket-form-card';

    const categories = c.categories || [
      'Stock Discrepancy',
      'Reservation Issue',
      'Pharmacy Partnership',
      'Technical Bug',
      'General Inquiry'
    ];

    const catOptions = categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');

    card.innerHTML = `
      <h4>🎫 Submit Support Ticket</h4>
      <div class="ticket-form-group">
        <label>Issue Category</label>
        <select id="ticket-cat-select">${catOptions}</select>
      </div>
      <div class="ticket-form-group">
        <label>Your Name</label>
        <input type="text" id="ticket-name-input" placeholder="e.g. John Doe" required />
      </div>
      <div class="ticket-form-group">
        <label>Email or Phone Number</label>
        <input type="text" id="ticket-contact-input" placeholder="e.g. john@example.com or 9876543210" required />
      </div>
      <div class="ticket-form-group">
        <label>Describe the Problem / Inquiry</label>
        <textarea id="ticket-msg-input" placeholder="Please describe what happened in detail..." required></textarea>
      </div>
      <button type="button" class="ticket-submit-btn" id="ticket-submit-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Submit Support Ticket
      </button>
    `;

    const submitBtn = card.querySelector('#ticket-submit-btn');
    submitBtn.addEventListener('click', async () => {
      const cat = card.querySelector('#ticket-cat-select').value;
      const name = card.querySelector('#ticket-name-input').value.trim();
      const contact = card.querySelector('#ticket-contact-input').value.trim();
      const message = card.querySelector('#ticket-msg-input').value.trim();

      if (!message) {
        alert('Please describe your issue in the message box.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting Ticket...';

      try {
        const res = await fetch('/api/support/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_name: name || 'Valued User',
            contact: contact,
            category: cat,
            subject: `${cat} - ${name || 'User'}`,
            message: message
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          card.innerHTML = `
            <div style="text-align:center; padding:10px;">
              <div style="font-size:2rem; margin-bottom:8px;">✅</div>
              <h4 style="margin:0 0 6px 0; color:var(--clr-primary-dark);">Ticket Created Successfully!</h4>
              <p style="font-family:monospace; font-size:1.1rem; font-weight:800; color:var(--clr-primary); margin:6px 0;">${data.ticket_code}</p>
              <p style="font-size:0.82rem; color:var(--clr-text-700); margin:0;">Our support operations team will review your inquiry and follow up via ${escapeHtml(contact || 'your contact details')} within 2 hours.</p>
            </div>
          `;
          playSound('receive');
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Support Ticket';
          alert(data.error || 'Failed to submit ticket. Please try again.');
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Support Ticket';
        alert('Network error submitting ticket. Please check your connection.');
      }
    });

    return card;
  }

  // Card 6: Emergency Helplines Card
  function buildEmergencyCard(c) {
    const card = document.createElement('div');
    card.className = 'emergency-card';

    const contacts = c.contacts || [];
    const gridHtml = contacts.map(item => `
      <a href="${item.tel}" class="emergency-btn">
        <span class="emergency-btn__label">${escapeHtml(item.label)}</span>
        <span class="emergency-btn__num">${escapeHtml(item.number)}</span>
      </a>
    `).join('');

    card.innerHTML = `
      <div class="emergency-card__title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        ${escapeHtml(c.title || 'Emergency Helplines')}
      </div>
      <div class="emergency-card__grid">
        ${gridHtml}
      </div>
    `;

    return card;
  }

  // -------------------------------------------------------------------------
  // Quick Reply Suggestion Chips
  // -------------------------------------------------------------------------
  function renderQuickReplies(chips) {
    elements.chips.innerHTML = '';
    if (!chips || chips.length === 0) return;

    chips.forEach(chip => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'medbot-chip';
      btn.textContent = chip.label;
      btn.addEventListener('click', () => {
        handleUserSubmit(chip.action || chip.label);
      });
      elements.chips.appendChild(btn);
    });
  }

  // -------------------------------------------------------------------------
  // Initial Welcome / Greeting
  // -------------------------------------------------------------------------
  function sendInitialGreeting() {
    if (state.messages.length > 0) return;

    const welcomeMsg = {
      id: 'msg-welcome',
      sender: 'bot',
      text: `👋 **Welcome to MedBot!** I am your 24/7 MedFind Health & Support Assistant.

Here are things I can do for you right now:
• **💊 Medicine Details**: Look up dosage, indications, side effects, precautions & brand equivalents
• **📍 Live Stock Check**: Check if nearby pharmacies have your medicine in stock with 1-click reservations
• **🩺 Symptom Guidance**: Find recommended remedies for fever, headache, acidity, cold, or pain
• **📋 Track Orders**: Check 30-minute reservation status using your \`RES-XXXXXX\` code
• **🎫 Support Desk**: Raise a support ticket for stock discrepancies or partner inquiries`,
      time: formatTimestamp(),
      cards: [],
      quick_replies: [
        { label: '💊 Tell me about Paracetamol', action: 'Tell me about Paracetamol' },
        { label: '📍 Where is Dolo 650 in stock?', action: 'Where is Dolo 650 in stock?' },
        { label: '🔥 Medicine for Acidity', action: 'What medicine helps with acidity?' },
        { label: '📋 Track My Reservation', action: 'Track my reservation status' },
        { label: '🎫 Raise Support Ticket', action: 'I want to raise a support ticket' },
        { label: '🚨 Emergency Helplines', action: 'Show emergency contact helplines' }
      ]
    };

    state.messages.push(welcomeMsg);
    renderMessage(welcomeMsg);
    renderQuickReplies(welcomeMsg.quick_replies);
    saveHistory();
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------
  function init() {
    loadHistory();
    buildWidget();

    if (state.messages.length === 0) {
      sendInitialGreeting();
    } else {
      renderAllMessages();
      // Render quick replies from the last bot message
      const lastBot = [...state.messages].reverse().find(m => m.sender === 'bot');
      if (lastBot && lastBot.quick_replies) {
        renderQuickReplies(lastBot.quick_replies);
      }
    }
  }

  // Public API
  const apiObj = {
    init,
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: toggleOpen,
    ask: handleUserSubmit
  };
  window.medBot = apiObj;
  return apiObj;
})();

// Auto-boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', medBot.init);
} else {
  medBot.init();
}
