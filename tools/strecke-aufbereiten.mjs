/* ------------------------------------------------------------------
   strecke-aufbereiten.mjs

   Liest die GPX-Dateien aus data/gpx, rechnet Distanz und Hoehenmeter
   pro Segment aus, duennt die Streckenlinie fuer die Karte aus, holt
   die Namen aus data/texte.json und schreibt alles zusammen nach
   data/segmente.json.

   Aufruf im Projektordner:

       node tools/strecke-aufbereiten.mjs

   Neue Strecke einsetzen: die GPX-Datei in data/gpx ersetzen, dabei
   die fuehrende Nummer behalten (sie bestimmt die Reihenfolge), dann
   den Befehl oben laufen lassen. Am Code ist nichts zu aendern.

   data/segmente.json wird bei jedem Lauf ueberschrieben. Nichts von
   Hand hineinschreiben, das geht sonst verloren. Texte gehoeren in
   data/texte.json.
   ------------------------------------------------------------------ */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const GPX_ORDNER = 'data/gpx';
const TEXTE = 'data/texte.json';
const ZIEL = 'data/segmente.json';

/* Ab welchem Anstieg in Metern ein Hoehenunterschied zaehlt. Komoot
   liefert Hoehen aus einem Gelaendemodell, die rauschen wenig, darum
   reicht eine kleine Schwelle. */
const SCHWELLE = 1.0;

/* Wie weit die gezeichnete Linie von der Originalspur abweichen darf,
   in Metern. Drei Meter sieht man auf der Karte nicht, spart aber
   viele Punkte. Die Distanzen werden weiterhin aus allen Punkten
   gerechnet, nur die Zeichnung wird ausgeduennt. */
const LINIE_TOLERANZ = 3.0;

/* ---------- Geometrie ---------- */

const ERDRADIUS = 6371000;
const bogen = grad => (grad * Math.PI) / 180;

function abstand(a, b) {
  const p1 = bogen(a.lat);
  const p2 = bogen(b.lat);
  const dp = p2 - p1;
  const dl = bogen(b.lon - a.lon);
  const h =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * ERDRADIUS * Math.asin(Math.sqrt(h));
}

/* ---------- GPX lesen ---------- */

function punkteLesen(text) {
  const punkte = [];
  // Jeder Streckenpunkt beginnt mit <trkpt lat=".." lon="..">.
  const stuecke = text.split(/<trkpt\b/).slice(1);
  for (const stueck of stuecke) {
    const lat = Number(stueck.match(/lat="([-\d.]+)"/)?.[1]);
    const lon = Number(stueck.match(/lon="([-\d.]+)"/)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const roh = stueck.match(/<ele>([-\d.]+)<\/ele>/)?.[1];
    const ele = roh === undefined ? null : Number(roh);
    punkte.push({ lat, lon, ele: Number.isFinite(ele) ? ele : null });
  }
  return punkte;
}

function laenge(punkte) {
  let summe = 0;
  for (let i = 1; i < punkte.length; i++) summe += abstand(punkte[i - 1], punkte[i]);
  return summe;
}

function hoehenmeter(punkte) {
  let auf = 0;
  let ab = 0;
  let bezug = null;
  for (const p of punkte) {
    if (p.ele === null) continue;
    if (bezug === null) {
      bezug = p.ele;
      continue;
    }
    const diff = p.ele - bezug;
    if (diff > SCHWELLE) {
      auf += diff;
      bezug = p.ele;
    } else if (diff < -SCHWELLE) {
      ab += -diff;
      bezug = p.ele;
    }
  }
  return { auf: Math.round(auf), ab: Math.round(ab) };
}

/* ---------- Linie ausduennen ----------
   Douglas-Peucker: ein Punkt bleibt nur, wenn die Linie ohne ihn
   weiter als die Toleranz von ihm abweichen wuerde. Gerechnet wird in
   Metern, dafuer werden die Grade lokal flach umgerechnet. */

function vereinfachen(punkte, toleranz) {
  if (punkte.length < 3) return punkte.slice();

  const meterProBogenLon = ERDRADIUS * Math.cos(bogen(punkte[0].lat));
  const x = p => bogen(p.lon) * meterProBogenLon;
  const y = p => bogen(p.lat) * ERDRADIUS;

  const behalten = new Uint8Array(punkte.length);
  behalten[0] = 1;
  behalten[punkte.length - 1] = 1;

  const stapel = [[0, punkte.length - 1]];
  while (stapel.length) {
    const [a, b] = stapel.pop();
    if (b - a < 2) continue;

    const ax = x(punkte[a]);
    const ay = y(punkte[a]);
    const dx = x(punkte[b]) - ax;
    const dy = y(punkte[b]) - ay;
    const strecke2 = dx * dx + dy * dy;

    let weiteste = -1;
    let index = -1;

    for (let i = a + 1; i < b; i++) {
      const px = x(punkte[i]);
      const py = y(punkte[i]);
      let entfernung;
      if (strecke2 === 0) {
        entfernung = Math.hypot(px - ax, py - ay);
      } else {
        let t = ((px - ax) * dx + (py - ay) * dy) / strecke2;
        t = Math.max(0, Math.min(1, t));
        entfernung = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (entfernung > weiteste) {
        weiteste = entfernung;
        index = i;
      }
    }

    if (weiteste > toleranz) {
      behalten[index] = 1;
      stapel.push([a, index], [index, b]);
    }
  }

  return punkte.filter((_, i) => behalten[i] === 1);
}

/* ---------- Hoehenkurve ----------
   Fuer das Profil zaehlt nicht die Lage, sondern Distanz und Hoehe.
   Darum eine eigene Vereinfachung in dieser Ebene: x ist der Weg in
   Metern seit Segmentbeginn, y die Hoehe ueber Meer. */

function vereinfachenXY(punkte, toleranz) {
  if (punkte.length < 3) return punkte.slice();

  const behalten = new Uint8Array(punkte.length);
  behalten[0] = 1;
  behalten[punkte.length - 1] = 1;

  const stapel = [[0, punkte.length - 1]];
  while (stapel.length) {
    const [a, b] = stapel.pop();
    if (b - a < 2) continue;

    const ax = punkte[a].x;
    const ay = punkte[a].y;
    const dx = punkte[b].x - ax;
    const dy = punkte[b].y - ay;
    const strecke2 = dx * dx + dy * dy;

    let weiteste = -1;
    let index = -1;

    for (let i = a + 1; i < b; i++) {
      const px = punkte[i].x;
      const py = punkte[i].y;
      let entfernung;
      if (strecke2 === 0) {
        entfernung = Math.hypot(px - ax, py - ay);
      } else {
        let t = ((px - ax) * dx + (py - ay) * dy) / strecke2;
        t = Math.max(0, Math.min(1, t));
        entfernung = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (entfernung > weiteste) {
        weiteste = entfernung;
        index = i;
      }
    }

    if (weiteste > toleranz) {
      behalten[index] = 1;
      stapel.push([a, index], [index, b]);
    }
  }

  return punkte.filter((_, i) => behalten[i] === 1);
}

/* Baut die Hoehenkurve eines Segments: [Kilometer, Meter ueber Meer].
   Die Toleranz ist in Metern, gemessen im Distanz-Hoehen-Raum. Der
   Weg ist dort tausendfach laenger als die Hoehe, darum wird die
   Hoehe vorher gestreckt, sonst wirft die Vereinfachung genau die
   Spitzen weg, auf die es ankommt. */
const HOEHE_STRECKUNG = 12;
const PROFIL_TOLERANZ = 6;

function hoehenkurve(punkte) {
  let weg = 0;
  const roh = [];
  for (let i = 0; i < punkte.length; i++) {
    if (i > 0) weg += abstand(punkte[i - 1], punkte[i]);
    if (punkte[i].ele === null) continue;
    roh.push({ x: weg, y: punkte[i].ele * HOEHE_STRECKUNG, ele: punkte[i].ele });
  }
  if (roh.length < 2) return [];
  return vereinfachenXY(roh, PROFIL_TOLERANZ).map(p => [
    Number((p.x / 1000).toFixed(3)),
    Math.round(p.ele)
  ]);
}

/* ---------- Hauptlauf ---------- */

let texte = { segmente: [] };
try {
  texte = JSON.parse(readFileSync(TEXTE, 'utf8'));
} catch {
  console.warn(`Hinweis: ${TEXTE} fehlt oder ist fehlerhaft, ich nehme Platzhalternamen.`);
}
const namen = new Map((texte.segmente || []).map(s => [s.nr, s.name]));

const dateien = readdirSync(GPX_ORDNER)
  .filter(n => n.toLowerCase().endsWith('.gpx'))
  .sort();

if (!dateien.length) {
  console.error(`Keine GPX-Dateien in ${GPX_ORDNER}.`);
  process.exit(1);
}

const segmente = [];
const warnungen = [];
let punkteRoh = 0;
let punkteLinie = 0;

dateien.forEach((datei, i) => {
  const nr = i + 1;
  const punkte = punkteLesen(readFileSync(join(GPX_ORDNER, datei), 'utf8'));
  if (punkte.length < 2) {
    warnungen.push(`${datei}: zu wenige Streckenpunkte, uebersprungen.`);
    return;
  }

  const meter = laenge(punkte);
  const hm = hoehenmeter(punkte);
  const duenn = vereinfachen(punkte, LINIE_TOLERANZ);

  punkteRoh += punkte.length;
  punkteLinie += duenn.length;

  segmente.push({
    nr,
    name: namen.get(nr) || `Segment ${nr}`,
    datei,
    km: Number((meter / 1000).toFixed(2)),
    hm_auf: hm.auf,
    hm_ab: hm.ab,
    punkte: punkte.length,
    start: { lat: punkte[0].lat, lon: punkte[0].lon },
    ziel: {
      lat: punkte[punkte.length - 1].lat,
      lon: punkte[punkte.length - 1].lon
    },
    // Fuer die Karte: [lat, lon] auf fuenf Nachkommastellen, das ist
    // gut ein Meter genau und haelt die Datei klein.
    linie: duenn.map(p => [Number(p.lat.toFixed(5)), Number(p.lon.toFixed(5))]),
    // Fuer das Hoehenprofil: [Kilometer seit Segmentbeginn, Meter ueber Meer]
    profil: hoehenkurve(punkte)
  });
});

/* Anschluesse pruefen: das Ende eines Segments sollte dort liegen, wo
   das naechste beginnt. Grosse Luecken sind ein Planungsfehler. */
for (let i = 0; i < segmente.length - 1; i++) {
  const luecke = abstand(segmente[i].ziel, segmente[i + 1].start);
  if (luecke > 50) {
    warnungen.push(
      `Luecke zwischen Segment ${i + 1} und ${i + 2}: ${Math.round(luecke)} m.`
    );
  }
}
const schluss = abstand(segmente[segmente.length - 1].ziel, segmente[0].start);
if (schluss > 50) {
  warnungen.push(`Die Runde schliesst nicht: ${Math.round(schluss)} m vom Start entfernt.`);
}

/* Zeiten: Die Dauer pro Segment steht in data/texte.json, entweder fest
   als "minuten" oder als Schnitt "tempo" pro Kilometer (m:ss). Ein
   Schnitt wird auf 5 Minuten gerundet. Die Startzeiten laufen ab
   texte.start ohne Pausen durch. Fehlt eine Dauer, bleiben die
   folgenden Startzeiten leer. */
const angaben = new Map((texte.segmente || []).map(s => [s.nr, s]));
function dauerMinuten(s) {
  const a = angaben.get(s.nr) || {};
  if (Number.isFinite(a.minuten)) return a.minuten;
  const t = /^(\d+):(\d{2})$/.exec(a.tempo || '');
  if (t) return Math.round((s.km * (Number(t[1]) + Number(t[2]) / 60)) / 5) * 5;
  return null;
}
const beginn = /^(\d{1,2}):(\d{2})$/.exec(texte.start || '');
let uhr = beginn ? Number(beginn[1]) * 60 + Number(beginn[2]) : null;
for (const s of segmente) {
  const minuten = dauerMinuten(s);
  if (minuten === null) {
    warnungen.push(`Segment ${s.nr}: keine Dauer in ${TEXTE}, Startzeiten ab hier fehlen.`);
    uhr = null;
    continue;
  }
  s.minuten = minuten;
  if (uhr !== null) {
    s.beginn = `${String(Math.floor(uhr / 60)).padStart(2, '0')}:${String(uhr % 60).padStart(2, '0')}`;
    uhr += minuten;
  }
}

/* Treffpunkt und Beschreibung, beide hinter dem Knopf «Info» im
   Segmentfeld */
for (const s of segmente) {
  const a = angaben.get(s.nr) || {};
  if (a.treffpunkt) s.treffpunkt = a.treffpunkt;
  if (a.beschreibung) s.beschreibung = a.beschreibung;
}

const gesamt = {
  km: Number(segmente.reduce((a, s) => a + s.km, 0).toFixed(2)),
  hm_auf: segmente.reduce((a, s) => a + s.hm_auf, 0),
  hm_ab: segmente.reduce((a, s) => a + s.hm_ab, 0),
  anzahl: segmente.length
};

/* Open House: kein Streckenstueck, darum ohne GPX, Zahlen und Karte.
   Der Block wird unveraendert durchgereicht, damit auch dieser Text in
   data/texte.json steht und nicht in der Seite. */
const openhouse = texte.openhouse && texte.openhouse.name ? texte.openhouse : null;
if (openhouse && /PLATZHALTER/i.test(openhouse.beschreibung || '')) {
  warnungen.push('Open House: der Text ist noch ein Platzhalter.');
}

const roh = JSON.stringify(
  {
    _hinweis: 'Erzeugt von tools/strecke-aufbereiten.mjs. Nicht von Hand aendern, Texte gehoeren in data/texte.json.',
    erzeugt: new Date().toISOString(),
    gesamt,
    segmente,
    ...(openhouse ? { openhouse } : {})
  },
  null,
  2
);

/* Die eingerueckte Ausgabe setzt jedes Koordinatenpaar auf drei Zeilen.
   Das blaeht die Datei auf das Doppelte auf, ohne sie lesbarer zu
   machen. Paare kommen darum auf eine Zeile. */
const kompakt = roh.replace(
  /\[\s+(-?\d+(?:\.\d+)?),\s+(-?\d+(?:\.\d+)?)\s+\]/g,
  '[$1, $2]'
);

writeFileSync(ZIEL, kompakt + '\n', 'utf8');

/* ---------- Bericht ---------- */

const kmText = n => n.toFixed(2).replace('.', ',');
console.log(`\n${ZIEL} geschrieben.\n`);
console.log('Nr  Segment                     km     auf      ab   Linie');
console.log('-'.repeat(61));
for (const s of segmente) {
  console.log(
    `${String(s.nr).padStart(2)}  ${s.name.slice(0, 24).padEnd(24)} ${kmText(s.km).padStart(6)}  ` +
    `${('+' + s.hm_auf + ' m').padStart(7)} ${('-' + s.hm_ab + ' m').padStart(7)}  ` +
    `${(s.linie.length + '/' + s.punkte).padStart(8)}`
  );
}
console.log('-'.repeat(61));
console.log(
  `    ${(gesamt.anzahl + ' Segmente').padEnd(24)} ${kmText(gesamt.km).padStart(6)}  ` +
  `${('+' + gesamt.hm_auf + ' m').padStart(7)} ${('-' + gesamt.hm_ab + ' m').padStart(7)}  ` +
  `${(punkteLinie + '/' + punkteRoh).padStart(8)}`
);

const groesse = statSync(ZIEL).size;
console.log(
  `\nLinie auf ${Math.round((punkteLinie / punkteRoh) * 100)} % der Punkte ausgeduennt, ` +
  `Toleranz ${LINIE_TOLERANZ} m.`
);
console.log(`${ZIEL} ist ${Math.round(groesse / 1024)} KB gross.`);

if (warnungen.length) {
  console.log('\nZu pruefen:');
  for (const w of warnungen) console.log(`  ${w}`);
}
console.log('');
