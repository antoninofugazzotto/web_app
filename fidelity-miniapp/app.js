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

  // ---------- Storage ----------
  const PREFIX = 'c_';
  const LS_KEY = 'fidelity_cards_v1';
  let useCloud = !!(tgVer('6.9') && tg.CloudStorage);
  let storageNote = useCloud ? 'cloud Telegram' : (inTG ? 'locale (versione Telegram senza CloudStorage)' : 'locale (fuori da Telegram)');
  const mem = {};
  const cloud = (method, ...args) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Telegram non risponde (' + method + ')')), 6000);
    try {
      tg.CloudStorage[method](...args, (err, val) => { clearTimeout(t); err ? reject(new Error(String(err))) : resolve(val); });
    } catch (e) { clearTimeout(t); reject(e); }
  });
  const lsRead = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (_) { return { ...mem }; } };
  const lsWrite = (obj) => { try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch (_) { Object.assign(mem, obj); } };

  const Store = {
    async all() {
      if (useCloud) {
        const keys = (await cloud('getKeys')).filter(k => k.startsWith(PREFIX));
        const out = [];
        for (let i = 0; i < keys.length; i += 50) {
          const vals = await cloud('getItems', keys.slice(i, i + 50));
          for (const k of Object.keys(vals)) { try { out.push(JSON.parse(vals[k])); } catch (_) {} }
        }
        return out;
      }
      return Object.values(lsRead());
    },
    async put(card) {
      const json = JSON.stringify(card);
      if (json.length > 4000) throw new Error('Dati della carta troppo lunghi');
      if (useCloud) return cloud('setItem', PREFIX + card.id, json);
      const all = lsRead(); all[card.id] = card; lsWrite(all);
    },
    async del(id) {
      if (useCloud) return cloud('removeItem', PREFIX + id);
      const all = lsRead(); delete all[id]; lsWrite(all);
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
    Store.put(current).catch(() => {});
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
    try { await Store.put(current); } catch (e) { toast('Salvataggio non riuscito'); }
  });
  $('#btn-edit').addEventListener('click', () => openForm(current));
  $('#btn-delete').addEventListener('click', async () => {
    if (!(await confirmBox(`Eliminare la carta "${current.name}"?`))) return;
    try {
      await Store.del(current.id);
      cards = cards.filter(c => c.id !== current.id);
      haptic('success'); toast('Carta eliminata'); current = null; goHome();
    } catch (e) { haptic('error'); toast('Eliminazione non riuscita'); }
  });

  // ---------- Scansione ----------
  let scanner = null;
  const SUPPORTED = () => {
    const F = window.Html5QrcodeSupportedFormats || (window.__Html5QrcodeLibrary__ && window.__Html5QrcodeLibrary__.Html5QrcodeSupportedFormats);
    return F ? FORMATS.map(f => F[f.zx]).filter(v => v !== undefined) : undefined;
  };
  function makeScanner() {
    const Lib = window.__Html5QrcodeLibrary__;
    return new Lib.Html5Qrcode('reader', { formatsToSupport: SUPPORTED(), useBarCodeDetectorIfSupported: true, verbose: false });
  }
  function startAdd() {
    current = null;
    show('scan');
    startScanner();
  }
  async function startScanner() {
    $('#scan-status').textContent = 'Avvio fotocamera…';
    try {
      scanner = makeScanner();
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: (w, h) => ({ width: Math.floor(w * 0.9), height: Math.floor(Math.min(h, w) * 0.55) }), aspectRatio: 1.333 },
        (text, result) => onScanned(text, result),
        () => {}
      );
      $('#scan-status').textContent = 'Inquadra il codice a barre della carta, ben illuminato e dritto.';
    } catch (err) {
      $('#scan-status').textContent = 'Fotocamera non disponibile qui. Usa una foto o inserisci il numero a mano.';
      scanner = null;
    }
  }
  async function stopScanner() {
    if (!scanner) return;
    const s = scanner; scanner = null;
    try { if (s.isScanning) await s.stop(); s.clear(); } catch (_) {}
  }
  function onScanned(text, result) {
    const zx = result && result.result && result.result.format && result.result.format.formatName;
    const f = fmtByZx(zx) || FORMATS[0];
    haptic('success');
    stopScanner();
    openForm(null, { number: text, format: f.bcid }, true);
  }
  $('#scan-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    $('#scan-status').textContent = 'Analizzo la foto…';
    await stopScanner();
    try {
      const s = makeScanner();
      const r = await s.scanFileV2(file, false);
      try { s.clear(); } catch (_) {}
      onScanned(r.decodedText, r);
    } catch (err) {
      haptic('error');
      $('#scan-status').textContent = 'Nessun codice trovato nella foto. Riprova più da vicino, oppure inserisci il numero a mano.';
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
    if (nativeOK) tg.MainButton.showProgress();
    try {
      await Store.put(card);
      const i = cards.findIndex(c => c.id === card.id);
      if (i >= 0) cards[i] = card; else cards.push(card);
      haptic('success'); toast('Carta salvata');
      current = card;
      goHome();
    } catch (e) {
      haptic('error'); toast('Salvataggio non riuscito: ' + e.message);
    } finally {
      saving = false;
      if (nativeOK) tg.MainButton.hideProgress();
    }
  }

  // ---------- Backup ----------
  $('#btn-backup').addEventListener('click', () => {
    const data = sortCards(cards).map(({ name, number, format, color, note, fav }) => ({ name, number, format, color, note, fav }));
    $('#export-box').value = JSON.stringify(data, null, 1);
    $('#storage-info').textContent = useCloud
      ? `${cards.length} carte salvate nel cloud di Telegram: le ritrovi su tutti i tuoi dispositivi.`
      : `${cards.length} carte salvate solo su questo dispositivo (${storageNote}).`;
    $('#diag').textContent = diagnostics();
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
      try { await Store.put(card); cards.push(card); ok++; } catch (_) { skip++; }
    }
    $('#backup-msg').textContent = `Importate ${ok} carte` + (skip ? `, ${skip} saltate (duplicate o non valide).` : '.');
    haptic(ok ? 'success' : 'warning');
  });

  // ---------- Avvio ----------
  function diagnostics() {
    return [
      'Telegram: ' + (inTG ? 'sì, versione ' + tg.version + ' su ' + tg.platform : (tg ? 'SDK caricato ma initData vuoto (aperta fuori da Telegram?)' : 'SDK non caricato')),
      'Pulsanti nativi: ' + (nativeOK ? 'attivi' : 'non attivi'),
      'Archivio: ' + storageNote,
      'Origine: ' + location.origin + location.pathname,
    ].join('\n');
  }
  function warn(msg) { const w = $('#warn'); w.textContent = msg; w.classList.remove('hidden'); }

  (async function init() {
    show('list', false);
    renderList(); // mostra subito lista vuota e pulsante di aggiunta
    try {
      cards = await Store.all();
      if (inTG) enableNative();
    } catch (e) {
      // Telegram non risponde: si continua in locale, con i pulsanti della pagina
      useCloud = false;
      storageNote = 'locale, perché il cloud Telegram non ha risposto: ' + e.message;
      cards = Object.values(lsRead());
      warn('Telegram non risponde: le carte vengono salvate solo su questo dispositivo. Controlla che l\'URL impostato in BotFather sia esattamente quello del sito.');
      console.warn(diagnostics());
    }
    renderList();
    // test / debug hook (inerte in produzione)
    window.__fidelity = { Store, drawBarcode, FORMATS, get cards() { return cards; } };
  })();
})();
