# Le mie carte — Telegram Mini App per fidelity card

Un portafoglio di fidelity card dentro Telegram: aggiungi le carte inquadrando il codice a barre (o scrivendo il numero), e in cassa le mostri a schermo intero su sfondo bianco.

**Nessun backend.** È un sito statico: le carte vengono salvate nel *CloudStorage* di Telegram, legato al tuo account e al bot, quindi le ritrovi su telefono, tablet e desktop.

## Cosa fa

- Aggiunta carta con **fotocamera**, **foto** (utile su iPhone se la fotocamera live non parte) o **inserimento manuale**
- Riconosce il formato del codice in automatico (Code 128, EAN-13, EAN-8, UPC-A/E, Code 39, ITF, QR, Data Matrix, PDF417, Aztec)
- Anteprima del codice mentre scrivi e controllo del formato; per EAN-13/EAN-8/UPC-A aggiunge da sola la cifra di controllo se la ometti
- Vista cassa: codice grande, sfondo bianco, header Telegram bianco
- Preferite in cima, poi ordinate per utilizzo; ricerca quando le carte sono 5 o più
- Colore e iniziali per riconoscere le carte a colpo d'occhio
- Backup/ripristino in JSON (copia-incolla)
- Pulsanti nativi Telegram (MainButton, BackButton, conferme, vibrazione) e tema chiaro/scuro di Telegram

## File

```
index.html          struttura e viste
style.css           stile (usa i colori del tema Telegram)
app.js              logica: storage, scanner, generazione codici
vendor/             librerie incluse, nessuna CDN esterna
  bwip-js-min.js       generazione codici (MIT)
  html5-qrcode.min.js  scansione da fotocamera/foto (Apache-2.0)
```

## Pubblicazione (15 minuti)

### 1. Metti online la cartella su HTTPS
Telegram richiede un URL `https://`. Opzioni gratuite:

- **GitHub Pages**: crea un repo, carica il contenuto della cartella, poi *Settings → Pages → Deploy from branch → main / root*. URL: `https://<utente>.github.io/<repo>/`
- **Cloudflare Pages** o **Netlify**: trascini la cartella nella dashboard e ottieni subito un URL.

### 2. Crea il bot e la Mini App con @BotFather
1. `/newbot` → scegli nome e username (il token non serve per questa app, ma conservalo).
2. `/newapp` → scegli il bot, inserisci titolo, descrizione, un'immagine 640×360, l'**URL del punto 1** e uno short name (es. `carte`).
   Ottieni il link diretto `https://t.me/<tuobot>/carte`.
3. (Consigliato) `/mybots` → il tuo bot → *Bot Settings* → *Menu Button* → imposta lo stesso URL: l'app si apre dal pulsante accanto al campo di testo della chat del bot.

### 3. Aprila
Apri il link o il pulsante menu del bot. Dal menu ⋯ della Mini App puoi anche aggiungerla alla schermata home del telefono.

## Test in locale

```bash
cd fidelity-miniapp
python3 -m http.server 8000
```

Apri `http://localhost:8000`: fuori da Telegram l'app funziona in *modalità test* e salva le carte nel `localStorage` del browser. La fotocamera nel browser funziona solo su `localhost` o `https`.

## Da sapere

- **Dati legati al bot**: il CloudStorage è per utente *e per bot*. Se cambi bot, le carte non ti seguono: fai prima un backup dal menu ⋯ e reimportalo.
- **Limiti**: fino a 1024 chiavi per utente (una carta = una chiave), più che sufficienti.
- **Privacy**: i dati stanno sui server Telegram, non cifrati end-to-end. Per numeri di fidelity card va bene; non usarla per dati sensibili.
- **Scansione**: lo scanner integrato di Telegram legge solo QR, per questo l'app usa la fotocamera tramite `html5-qrcode`. Su Android funziona bene; su iOS la fotocamera live dentro Telegram può non partire: usa **"Scatta o scegli una foto"**. Code 93 e Codabar vengono generati correttamente per la cassa, ma lo scanner dell'app potrebbe non riconoscerli: in quel caso inserisci il numero a mano.
- **Codici dinamici**: le carte che cambiano codice nell'app del negozio non si possono copiare; quelle fisiche con numero fisso sì.
- **In cassa**: la pagina non può alzare la luminosità da sola; alzala tu. Se il lettore non legge, verifica il formato (spesso EAN-13 ↔ Code 128).

## Idee per estensioni

- Carte condivise in famiglia → serve un piccolo backend (verificando `initData` lato server).
- Foto della carta come copertina (richiede storage esterno: il CloudStorage accetta al massimo 4 KB per carta).
- Suggerimento della carta in base alla posizione vicino al negozio.
