/* Le mie carte — Telegram Mini App per fidelity card
 * Nessun backend: i dati stanno nel CloudStorage di Telegram (per utente, per bot).
 * Fuori da Telegram (test nel browser) usa localStorage.
 */
(() => {
  'use strict';

  // ---------- Telegram ----------
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTG = !!(tg && tg.initData);
  const tgVer = (v) => inTG && typeof tg.isVersionAtLeast === 'function' && tg.isVersionAtLeast(v);
  let nativeOK = false; // diventa true solo quando Telegram risponde davvero (vedi init)
  if (inTG) {
    tg.ready();
    tg.expand();
    try { if (tgVer('7.7')) tg.disableVerticalSwipes(); } catch (_) {}
  }
  const haptic = (type) => { try { if (tgVer('6.1')) tg.HapticFeedback.notificationOccurred(type); } catch (_) {} };
  const tap = () => { try { if (tgVer('6.1')) tg.HapticFeedback.impactOccurred('light'); } catch (_) {} };

  // ---------- Formati ----------
  // bcid = nome del simbolo in bwip-js; zx = nome restituito dallo scanner
  const FORMATS = [
    { bcid: 'code128', label: 'Code 128', zx: 'CODE_128', linear: true },
    { bcid: 'ean13', label: 'EAN-13', zx: 'EAN_13', linear: true, re: /^\d{12,13}$/, msg: 'EAN-13 vuole 12 o 13 cifre' },
    { bcid: 'ean8', label: 'EAN-8', zx: 'EAN_8', linear: true, re: /^\d{7,8}$/, msg: 'EAN-8 vuole 7 o 8 cifre' },
    { bcid: 'upca', label: 'UPC-A', zx: 'UPC_A', linear: true, re: /^\d{11,12}$/, msg: 'UPC-A vuole 11 o 12 cifre' },
    { bcid: 'upce', label: 'UPC-E', zx: 'UPC_E', linear: true, re: /^\d{7,8}$/, msg: 'UPC-E vuole 7 o 8 cifre' },
    { bcid: 'code39', label: 'Code 39', zx: 'CODE_39', linear: true },
    { bcid: 'code93', label: 'Code 93', zx: 'CODE_93', linear: true },
    { bcid: 'interleaved2of5', label: 'ITF (Interleaved 2 of 5)', zx: 'ITF', linear: true, re: /^\d+$/, msg: 'ITF accetta solo cifre' },
    { bcid: 'rationalizedCodabar', label: 'Codabar', zx: 'CODABAR', linear: true },
    { bcid: 'qrcode', label: 'QR Code', zx: 'QR_CODE' },
    { bcid: 'datamatrix', label: 'Data Matrix', zx: 'DATA_MATRIX' },
    { bcid: 'pdf417', label: 'PDF417', zx: 'PDF_417', linear: true },
    { bcid: 'azteccode', label: 'Aztec', zx: 'AZTEC' },
  ];
  const fmtByBcid = (b) => FORMATS.find(f => f.bcid === b) || FORMATS[0];
  const fmtByZx = (z) => FORMATS.find(f => f.zx === z);

  const COLORS = ['#e34948', '#eb6834', '#eda100', '#1baf7a', '#008a5e', '#2a78d6', '#1e2761', '#6250d6', '#d55181', '#5f5e5a', '#111111'];

  // ---------- Utility ----------
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const initials = (name) => {
    const w = String(name).trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '?';
    return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]).toUpperCase();
  };
  const maskNum = (n) => { const s = String(n); return s.length > 6 ? '•••• ' + s.slice(-4) : s; };
  let toastT;
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2200); };
  const confirmBox = (msg) => new Promise(res => {
    if (nativeOK && tgVer('6.2')) tg.showConfirm(msg, ok => res(!!ok)); else res(window.confirm(msg));
  });

  // ---------- Storage (local-first + sincronizzazione cloud) ----------
  // Ogni modifica va subito nel dispositivo (localStorage), poi viene inviata al
  // CloudStorage di Telegram in background. Se Telegram è lento o non risponde,
  // le carte restano comunque salvate e la sincronizzazione riprova più tardi.
  const PREFIX = 'c_';
  const LS_KEY = 'fidelity_cards_v1';        // id -> carta (anche "tombstone" {deleted:true})
  const LS_PENDING = 'fidelity_pending_v1';   // id da inviare al cloud
  const LS_MIGRATED = 'fidelity_v2';
  const cloudCapable = !!(tgVer('6.9') && tg.CloudStorage);
  const CLOUD_TIMEOUT = 10000;
  const mem = {};
  const lsGet = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (_) { return mem[k] ?? def; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { mem[k] = v; } };

  const cloud = (method, ...args) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('nessuna risposta da Telegram in ' + (CLOUD_TIMEOUT / 1000) + 's (' + method + ')')), CLOUD_TIMEOUT);
    try {
      tg.CloudStorage[method](...args, (err, val) => { clearTimeout(t); err ? reject(new Error(String(err))) : resolve(val); });
    } catch (e) { clearTimeout(t); reject(e); }
  });

  const Sync = {
    state: cloudCapable ? 'syncing' : 'local',   // syncing | ok | error | local
    lastError: '', lastPingMs: null, lastOkAt: null, running: null,
    onChange: () => {},
  };
  let db = lsGet(LS_KEY, {});
  let pending = new Set(lsGet(LS_PENDING, []));
  // Migrazione dalla versione precedente: le carte locali non ancora nel cloud vanno inviate
  if (!lsGet(LS_MIGRATED, false)) { Object.keys(db).forEach(id => pending.add(id)); lsSet(LS_MIGRATED, true); }
  const persist = () => { lsSet(LS_KEY, db); lsSet(LS_PENDING, [...pending]); };
  persist();

  const Data = {
    list: () => Object.values(db).filter(c => c && !c.deleted),
    save(card) {
      card.updated = Date.now();
      db[card.id] = card; pending.add(card.id); persist();
      Data.syncSoon();
    },
    remove(id) {
      db[id] = { id, deleted: true, updated: Date.now() }; pending.add(id); persist();
      Data.syncSoon();
    },
    pendingCount: () => pending.size,
    syncSoon() { clearTimeout(Data._t); Data._t = setTimeout(() => Data.sync(), 300); },
    async sync() {
      if (!cloudCapable) { Sync.state = 'local'; Sync.onChange(); return; }
      if (Sync.running) return Sync.running;
      Sync.running = (async () => {
        Sync.state = 'syncing'; Sync.onChange();
        try {
          const t0 = performance.now();
          // 1) invia le modifiche locali
          for (const id of [...pending]) {
            const c = db[id];
            if (!c || c.deleted) await cloud('removeItem', PREFIX + id);
            else {
              const json = JSON.stringify(c);
              if (json.length > 4000) throw new Error('carta "' + c.name + '" troppo lunga per il cloud');
              await cloud('setItem', PREFIX + id, json);
            }
            pending.delete(id);
            if (c && c.deleted) delete db[id];
            persist();
          }
          // 2) scarica e unisci
          const keys = (await cloud('getKeys')).filter(k => k.startsWith(PREFIX));
          const remote = {};
          for (let i = 0; i < keys.length; i += 50) {
            const vals = await cloud('getItems', keys.slice(i, i + 50));
            for (const k of Object.keys(vals)) { try { const c = JSON.parse(vals[k]); if (c && c.id) remote[c.id] = c; } catch (_) {} }
          }
          for (const id of Object.keys(remote)) {
            const l = db[id], r = remote[id];
            if (pending.has(id)) continue;
            if (!l || (r.updated | 0) >= (l.updated | 0)) db[id] = r;
          }
          for (const id of Object.keys(db)) {
            if (!remote[id] && !pending.has(id)) delete db[id]; // eliminata da un altro dispositivo
          }
          persist();
          Sync.lastPingMs = Math.round(performance.now() - t0);
          Sync.lastOkAt = new Date();
          Sync.state = 'ok'; Sync.lastError = '';
          if (!nativeOK && inTG) enableNative();
        } catch (e) {
          Sync.state = 'error'; Sync.lastError = e.message || String(e);
          console.warn('Sync error', e);
        } finally {
          Sync.running = null; Sync.onChange();
        }
      })();
      return Sync.running;
    },
  };

  // ---------- Barcode ----------
  function prepText(bcid, text) {
    let t = String(text).trim();
    if (bcid === 'code39') t = t.toUpperCase();
    if (bcid === 'rationalizedCodabar' && !/^[A-D].*[A-D]$/i.test(t)) t = 'A' + t + 'A';
    return t;
  }
  // Aggiunge la cifra di controllo GS1 se manca (EAN-13 a 12 cifre, EAN-8 a 7, UPC-A a 11)
  function withCheckDigit(bcid, number) {
    const t = String(number).trim();
    const need = { ean13: 12, ean8: 7, upca: 11 }[bcid];
    if (!need || !/^\d+$/.test(t) || t.length !== need) return t;
    const sum = [...t].reverse().reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
    return t + ((10 - (sum % 10)) % 10);
  }
  function validate(bcid, number) {
    const f = fmtByBcid(bcid);
    const t = String(number).trim();
    if (!t) return 'Inserisci il numero della carta';
    if (f.re && !f.re.test(t)) return f.msg;
    return null;
  }
  function drawBarcode(canvas, bcid, number, big) {
    const f = fmtByBcid(bcid);
    const opts = {
      bcid, text: prepText(bcid, number), scale: big ? 4 : 2,
      paddingwidth: f.linear ? 12 : 4, paddingheight: 4, backgroundcolor: 'FFFFFF',
    };
    if (f.linear && bcid !== 'pdf417') opts.height = big ? 22 : 12;
    if (bcid === 'interleaved2of5' && opts.text.length % 2) opts.text = '0' + opts.text;
    if (bcid === 'code93') opts.includecheck = true; // i due caratteri di controllo sono obbligatori per gli scanner
    window.bwipjs.toCanvas(canvas, opts);
  }

  // ---------- Stato & navigazione ----------
  let cards = [];
  let current = null;       // carta aperta / in modifica
  let draft = null;         // dati del form
  const stack = ['list'];
  const VIEWS = ['list', 'scan', 'form', 'show', 'backup'];

  function show(view, push = true) {
    const prev = stack[stack.length - 1];
    if (prev === 'scan' && view !== 'scan') stopScanner();
    if (push) stack.push(view);
    VIEWS.forEach(v => $('#view-' + v).classList.toggle('hidden', v !== view));
    document.body.classList.toggle('showing', view === 'show');
    window.scrollTo(0, 0);
    setChrome(view);
  }
  function back() {
    if (stack.length <= 1) { if (nativeOK) tg.close(); return; }
    stack.pop();
    const v = stack[stack.length - 1];
    show(v, false);
    if (v === 'list') renderList();
    if (v === 'show' && current) renderShow();
  }
  function goHome() { stack.length = 1; show('list', false); renderList(); }

  const MAIN = { form: 'Salva carta' };
  function setChrome(view) {
    if (!inTG || !nativeOK) return;
    const white = view === 'show';
    try {
      if (tgVer('6.1')) {
        tg.setHeaderColor(white ? '#ffffff' : 'secondary_bg_color');
        tg.setBackgroundColor(white ? '#ffffff' : 'secondary_bg_color');
      }
      if (tgVer('7.10')) tg.setBottomBarColor(white ? '#ffffff' : 'secondary_bg_color');
    } catch (_) {}
    if (tgVer('6.1')) { stack.length > 1 ? tg.BackButton.show() : tg.BackButton.hide(); }
    if (MAIN[view]) { tg.MainButton.setParams({ text: MAIN[view], is_visible: true, is_active: true }); }
    else tg.MainButton.hide();
  }
  function onMain() {
    const v = stack[stack.length - 1];
    if (v === 'list') startAdd();
    else if (v === 'form') saveForm();
  }
  function enableNative() {
    nativeOK = true;
    document.documentElement.classList.add('tg');
    try { tg.MainButton.onClick(onMain); if (tgVer('6.1')) tg.BackButton.onClick(back); } catch (_) {}
    setChrome(stack[stack.length - 1]);
  }
  $('#btn-add').addEventListener('click', () => { tap(); startAdd(); });
  $('#btn-add-empty').addEventListener('click', () => { tap(); startAdd(); });
  document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', back));
  document.querySelectorAll('[data-main]').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); onMain(); }));

  // ---------- Lista ----------
  function sortCards(list) {
    return [...list].sort((a, b) => (b.fav | 0) - (a.fav | 0) || (b.uses | 0) - (a.uses | 0) || a.name.localeCompare(b.name, 'it'));
  }
  function renderList() {
    const q = $('#search').value.trim().toLowerCase();
    const list = sortCards(cards).filter(c => !q || c.name.toLowerCase().includes(q) || (c.note || '').toLowerCase().includes(q));
    $('#grid').innerHTML = list.map(c => `
      <button class="card" data-id="${esc(c.id)}" style="background:${esc(c.color)}">
        ${c.fav ? '<span class="star">★</span>' : ''}
        <span class="initials">${esc(initials(c.name))}</span>
        <span><span class="name">${esc(c.name)}</span><br><span class="num">${esc(maskNum(c.number))}</span></span>
      </button>`).join('');
    $('#empty').classList.toggle('hidden', cards.length > 0);
    $('#search').parentElement.classList.toggle('hidden', cards.length < 5);
  }
  $('#search').addEventListener('input', renderList);
  $('#grid').addEventListener('click', (e) => {
    const el = e.target.closest('.card'); if (!el) return;
    current = cards.find(c => c.id === el.dataset.id);
    if (current) { tap(); openShow(); }
  });

  // ---------- Mostra carta ----------
  async function openShow() {
    show('show');
    renderShow();
    current.uses = (current.uses | 0) + 1;
    current.lastUsed = Date.now();
    Data.save(current);
  }
  function renderShow() {
    const c = current;
    $('#show-name').textContent = c.name;
    $('#show-number').textContent = c.number;
    $('#show-note').textContent = c.note || '';
    $('#btn-fav').textContent = c.fav ? '★' : '☆';
    const f = fmtByBcid(c.format);
    $('#code-wrap').classList.toggle('square', !f.linear);
    try { drawBarcode($('#show-canvas'), c.format, c.number, true); }
    catch (err) { toast('Impossibile generare il codice: controlla numero e formato'); }
  }
  $('#btn-fav').addEventListener('click', async () => {
    current.fav = !current.fav; tap(); renderShow();
    Data.save(current);
  });
  $('#btn-edit').addEventListener('click', () => openForm(current));
  $('#btn-delete').addEventListener('click', async () => {
    if (!(await confirmBox(`Eliminare la carta "${current.name}"?`))) return;
    Data.remove(current.id);
    cards = Data.list();
    haptic('success'); toast('Carta eliminata'); current = null; goHome();
  });

  // ---------- Scansione (ZXing C++ in WebAssembly) ----------
  const ZX_FORMATS = ['Codabar', 'Code39', 'Code93', 'Code128', 'EAN8', 'EAN13', 'ITF', 'UPCA', 'UPCE', 'QRCode', 'DataMatrix', 'PDF417', 'Aztec'];
  const ZX_TO_BCID = {
    CODABAR: 'rationalizedCodabar', CODE39: 'code39', CODE93: 'code93', CODE128: 'code128', EAN8: 'ean8', EAN13: 'ean13',
    ITF: 'interleaved2of5', ITF14: 'interleaved2of5', UPCA: 'upca', UPCE: 'upce', QRCODE: 'qrcode', MICROQRCODE: 'qrcode',
    DATAMATRIX: 'datamatrix', PDF417: 'pdf417', AZTEC: 'azteccode',
  };
  const bcidFromZx = (name) => ZX_TO_BCID[String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '')] || 'code128';
  let zxReady = null;
  function zx() {
    if (!zxReady) {
      const Z = window.ZXingWASM;
      if (!Z) return Promise.reject(new Error('libreria di scansione non caricata'));
      zxReady = Promise.resolve(Z.prepareZXingModule({
        overrides: { locateFile: (p, prefix) => p.endsWith('.wasm') ? new URL('vendor/' + p, location.href).href : prefix + p },
        fireImmediately: true,
      })).then(() => Z);
    }
    return zxReady;
  }
  async function decode(imageData, opts = {}) {
    const Z = await zx();
    const res = await Z.readBarcodes(imageData, { formats: ZX_FORMATS, tryHarder: true, tryRotate: true, tryInvert: true, maxNumberOfSymbols: 1, ...opts });
    const r = res.find(x => x.isValid && x.text);
    if (!r) return null;
    let bcid = bcidFromZx(r.format), text = r.text;
    if (bcid === 'ean13' && /^0\d{12}$/.test(text)) { bcid = 'upca'; text = text.slice(1); } // UPC-A letto come EAN-13
    return { text, bcid, format: r.format };
  }

  const cam = { stream: null, timer: null, busy: false, last: null, hits: 0, canvas: document.createElement('canvas'), torch: false };
  function startAdd() {
    current = null;
    show('scan');
    startScanner();
  }
  function camError(err) {
    const n = err && err.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'Permesso fotocamera negato. Consenti la fotocamera a Telegram nelle impostazioni del telefono, oppure usa una foto.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Nessuna fotocamera trovata su questo dispositivo. Usa una foto o inserisci il numero a mano.';
    if (n === 'NotReadableError') return 'La fotocamera è usata da un\'altra app. Chiudila e riprova.';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'Qui la fotocamera live non è disponibile. Usa "Scatta o scegli una foto".';
    return 'Fotocamera non disponibile (' + (n || err.message || err) + '). Usa una foto o inserisci il numero a mano.';
  }
  async function startScanner() {
    const status = $('#scan-status');
    status.textContent = 'Avvio fotocamera…';
    $('#btn-torch').classList.add('hidden');
    zx().catch(() => {}); // precarica il motore mentre parte la fotocamera
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no-media');
      cam.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (stack[stack.length - 1] !== 'scan') { stopScanner(); return; }
      const v = $('#scan-video');
      v.srcObject = cam.stream;
      await v.play().catch(() => {});
      const track = cam.stream.getVideoTracks()[0];
      try {
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.focusMode && caps.focusMode.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
        if (caps.torch) $('#btn-torch').classList.remove('hidden');
      } catch (_) {}
      status.textContent = 'Inquadra il codice dentro il riquadro, con la linea rossa che lo attraversa.';
      cam.last = null; cam.hits = 0;
      cam.timer = setInterval(scanFrame, 150);
    } catch (err) {
      status.textContent = camError(err);
      stopScanner();
    }
  }
  async function scanFrame() {
    const v = $('#scan-video');
    if (cam.busy || !cam.stream || v.readyState < 2 || !v.videoWidth) return;
    cam.busy = true;
    try {
      // area centrale (quella del riquadro), ridotta a max 1280 px di larghezza
      const vw = v.videoWidth, vh = v.videoHeight;
      const sx = Math.round(vw * 0.04), sw = vw - 2 * sx, sy = Math.round(vh * 0.2), sh = vh - 2 * sy;
      const scale = Math.min(1, 1280 / sw);
      const c = cam.canvas; c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
      const r = await decode(ctx.getImageData(0, 0, c.width, c.height), { tryInvert: false });
      if (!r || !cam.stream) return;
      // per i codici lineari chiediamo due letture uguali di fila: evita letture sbagliate
      const linear = fmtByBcid(r.bcid).linear;
      if (linear && cam.last !== r.text) { cam.last = r.text; cam.hits = 1; return; }
      cam.hits++;
      if (!linear || cam.hits >= 2) onScanned(r);
    } catch (e) {
      if (!zxReady || String(e.message).includes('libreria')) $('#scan-status').textContent = 'Motore di scansione non caricato: ' + e.message;
    } finally { cam.busy = false; }
  }
  function stopScanner() {
    clearInterval(cam.timer); cam.timer = null;
    if (cam.stream) { cam.stream.getTracks().forEach(t => t.stop()); cam.stream = null; }
    const v = $('#scan-video'); if (v) v.srcObject = null;
    cam.torch = false; $('#btn-torch').classList.remove('on');
  }
  $('#btn-torch').addEventListener('click', async () => {
    const track = cam.stream && cam.stream.getVideoTracks()[0]; if (!track) return;
    cam.torch = !cam.torch;
    try { await track.applyConstraints({ advanced: [{ torch: cam.torch }] }); $('#btn-torch').classList.toggle('on', cam.torch); } catch (_) {}
  });
  function onScanned(r) {
    haptic('success');
    stopScanner();
    openForm(null, { number: r.text, format: r.bcid }, true);
  }
  async function imageDataFrom(file, maxSide) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (_) {
      bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    }
    const w = bmp.width, h = bmp.height, s = Math.min(1, maxSide / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return ctx.getImageData(0, 0, c.width, c.height);
  }
  $('#scan-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    stopScanner();
    $('#scan-status').textContent = 'Analizzo la foto…';
    try {
      let r = null;
      for (const side of [1600, 2400, 1000, 4096]) {  // più risoluzioni: i codici piccoli o sfocati escono in una di queste
        r = await decode(await imageDataFrom(file, side), { tryDownscale: true });
        if (r) break;
      }
      if (!r) throw new Error('nessun codice');
      onScanned(r);
    } catch (err) {
      haptic('error');
      $('#scan-status').textContent = err.message === 'nessun codice'
        ? 'Nessun codice trovato nella foto. Fotografa solo il codice a barre, dritto, a fuoco e senza riflessi, oppure inserisci il numero a mano.'
        : 'Errore durante l\'analisi della foto: ' + err.message;
    }
  });
  $('#btn-manual').addEventListener('click', () => { stopScanner(); openForm(null, {}, true); });

  // ---------- Form ----------
  $('#f-format').innerHTML = FORMATS.map(f => `<option value="${f.bcid}">${esc(f.label)}</option>`).join('');
  function renderSwatches() {
    $('#f-colors').innerHTML = COLORS.map(c => `<button type="button" class="swatch${draft.color === c ? ' sel' : ''}" data-c="${c}" style="background:${c}" aria-label="Colore ${c}"></button>`).join('');
  }
  $('#f-colors').addEventListener('click', (e) => {
    const b = e.target.closest('.swatch'); if (!b) return;
    draft.color = b.dataset.c; tap(); renderSwatches();
  });
  function openForm(card, prefill = {}, replaceScan = false) {
    const base = card ? { ...card } : { id: null, name: '', number: '', format: 'code128', color: null, note: '', fav: false, uses: 0 };
    draft = { ...base, ...prefill };
    $('#form-title').textContent = card ? 'Modifica carta' : 'Nuova carta';
    $('#f-name').value = draft.name;
    $('#f-number').value = draft.number;
    $('#f-format').value = draft.format;
    $('#f-note').value = draft.note || '';
    if (!draft.color) draft.color = COLORS[hash(draft.number || Date.now()) % COLORS.length];
    renderSwatches();
    updatePreview();
    if (replaceScan && stack[stack.length - 1] === 'scan') stack.pop();
    show('form');
    setTimeout(() => $('#f-name').focus(), 250);
  }
  function updatePreview() {
    const number = $('#f-number').value, format = $('#f-format').value;
    const err = number.trim() ? validate(format, number) : null;
    const canvas = $('#f-preview'), box = $('#f-error');
    if (!number.trim()) { canvas.width = canvas.height = 0; box.classList.add('hidden'); return true; }
    if (err) { canvas.width = canvas.height = 0; box.textContent = err; box.classList.remove('hidden'); return false; }
    try { drawBarcode(canvas, format, number, false); box.classList.add('hidden'); return true; }
    catch (e) {
      canvas.width = canvas.height = 0;
      box.textContent = 'Numero non valido per questo formato' + (/checksum|check digit/i.test(String(e.message)) ? ' (cifra di controllo errata)' : '') + '. Prova con Code 128.';
      box.classList.remove('hidden'); return false;
    }
  }
  ['input', 'change'].forEach(ev => { $('#f-number').addEventListener(ev, updatePreview); $('#f-format').addEventListener(ev, updatePreview); });
  $('#card-form').addEventListener('submit', (e) => { e.preventDefault(); saveForm(); });

  let saving = false;
  async function saveForm() {
    if (saving) return;
    const name = $('#f-name').value.trim();
    const format = $('#f-format').value;
    const number = withCheckDigit(format, $('#f-number').value);
    if (!name) { haptic('error'); toast('Inserisci il nome del negozio'); $('#f-name').focus(); return; }
    const err = validate(format, number);
    if (err) { haptic('error'); toast(err); $('#f-number').focus(); return; }
    if (!updatePreview()) { haptic('error'); toast('Controlla numero e formato'); return; }
    const card = { ...draft, name, number, format, note: $('#f-note').value.trim(), id: draft.id || newId(), updated: Date.now() };
    if (!card.created) card.created = Date.now();
    saving = true;
    try {
      Data.save(card);
      cards = Data.list();
      haptic('success'); toast('Carta salvata');
      current = card;
      goHome();
    } catch (e) {
      haptic('error'); toast('Salvataggio non riuscito: ' + e.message);
    } finally {
      saving = false;
    }
  }

  // ---------- Backup ----------
  $('#btn-backup').addEventListener('click', () => {
    const data = sortCards(cards).map(({ name, number, format, color, note, fav }) => ({ name, number, format, color, note, fav }));
    $('#export-box').value = JSON.stringify(data, null, 1);
    renderBackupInfo();
    $('#backup-msg').textContent = '';
    show('backup');
  });
  $('#btn-copy').addEventListener('click', async () => {
    const box = $('#export-box');
    try { await navigator.clipboard.writeText(box.value); toast('Backup copiato'); }
    catch (_) { box.select(); document.execCommand && document.execCommand('copy'); toast('Seleziona e copia il testo'); }
  });
  $('#btn-import').addEventListener('click', async () => {
    let list;
    try { list = JSON.parse($('#import-box').value); if (!Array.isArray(list)) throw 0; }
    catch (_) { $('#backup-msg').textContent = 'Il testo incollato non è un backup valido.'; haptic('error'); return; }
    let ok = 0, skip = 0;
    for (const raw of list) {
      const name = String(raw.name || '').trim().slice(0, 40), number = String(raw.number || '').trim().slice(0, 200);
      const format = FORMATS.some(f => f.bcid === raw.format) ? raw.format : 'code128';
      const numberFull = withCheckDigit(format, number);
      if (!name || !number || validate(format, number) || cards.some(c => c.number === numberFull && c.name === name)) { skip++; continue; }
      const card = { id: newId(), name, number: numberFull, format, color: COLORS.includes(raw.color) ? raw.color : COLORS[hash(number) % COLORS.length],
        note: String(raw.note || '').slice(0, 120), fav: !!raw.fav, uses: 0, created: Date.now() };
      Data.save(card); cards = Data.list(); ok++;
    }
    $('#backup-msg').textContent = `Importate ${ok} carte` + (skip ? `, ${skip} saltate (duplicate o non valide).` : '.');
    haptic(ok ? 'success' : 'warning');
  });

  // ---------- Stato sincronizzazione ----------
  function transport() {
    if (window.TelegramWebviewProxy) return 'app mobile';
    if (window.external && 'notify' in window.external) return 'desktop (external)';
    if (window.parent && window.parent !== window) return 'iframe (Telegram Web)';
    return 'nessuno';
  }
  function diagnostics() {
    const u = inTG && tg.initDataUnsafe && tg.initDataUnsafe.user;
    return [
      'Telegram: ' + (inTG ? 'versione ' + tg.version + ', piattaforma ' + tg.platform : (tg ? 'initData vuoto (aperta fuori da Telegram?)' : 'SDK non caricato')),
      'Canale: ' + transport() + ' · utente: ' + (u ? 'sì' : 'no'),
      'Cloud: ' + ({ ok: 'OK', syncing: 'sincronizzazione in corso', error: 'ERRORE', local: 'non disponibile' }[Sync.state])
        + (Sync.lastPingMs != null ? ' (' + Sync.lastPingMs + ' ms)' : '')
        + (Sync.lastError ? ' — ' + Sync.lastError : ''),
      'Da sincronizzare: ' + Data.pendingCount(),
      'Pulsanti nativi: ' + (nativeOK ? 'attivi' : 'non attivi'),
      'Origine: ' + location.origin + location.pathname,
    ].join('\n');
  }
  function renderStatus() {
    const el = $('#sync-status');
    const n = Data.pendingCount();
    const map = {
      ok: ['ok', '☁︎ Sincronizzate con Telegram'],
      syncing: ['busy', '⟳ Sincronizzazione…'],
      error: ['err', '⚠︎ Salvate su questo dispositivo, non ancora su Telegram' + (n ? ' (' + n + ')' : '') + ' · tocca per riprovare'],
      local: ['local', inTG ? '⚠︎ Questa versione di Telegram non supporta il cloud: carte solo su questo dispositivo' : 'Modalità test: carte salvate in questo browser'],
    };
    const [cls, text] = map[Sync.state];
    el.className = 'sync ' + cls; el.textContent = text;
    if (!$('#view-backup').classList.contains('hidden')) renderBackupInfo();
  }
  function renderBackupInfo() {
    $('#storage-info').textContent = `${cards.length} carte. ` + (Sync.state === 'ok'
      ? 'Sono salvate nel cloud di Telegram: le ritrovi su tutti i tuoi dispositivi.'
      : 'Sono salvate su questo dispositivo' + (cloudCapable ? '; verranno inviate al cloud di Telegram appena risponde.' : '.'));
    $('#diag').value = diagnostics();
  }
  Sync.onChange = () => {
    const before = JSON.stringify(cards.map(c => [c.id, c.updated]));
    cards = Data.list();
    if (JSON.stringify(cards.map(c => [c.id, c.updated])) !== before && stack[stack.length - 1] === 'list') renderList();
    renderStatus();
  };
  $('#sync-status').addEventListener('click', () => { if (Sync.state === 'error') Data.sync(); });
  $('#btn-retry').addEventListener('click', async () => { $('#diag').value = 'Test in corso…'; await Data.sync(); renderBackupInfo(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && (Sync.state === 'error' || Data.pendingCount())) Data.sync(); });
  setInterval(() => { if (Sync.state === 'error' && Data.pendingCount()) Data.sync(); }, 30000);

  // ---------- Avvio ----------
  (function init() {
    cards = Data.list();          // subito, dal dispositivo
    show('list', false);
    renderList();
    renderStatus();
    Data.sync();                  // poi allinea con il cloud in background
    window.__fidelity = { Data, Sync, drawBarcode, decode, imageDataFrom, FORMATS, get cards() { return cards; } };
  })();
})();
