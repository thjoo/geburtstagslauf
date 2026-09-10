/* ------------------------------------------------------------------
   app.js — Verhalten der Seite

   1. Laedt data/segmente.json (erzeugt von tools/strecke-aufbereiten.mjs)
   2. Baut daraus die sechs Segmentpunkte am linken Rand
   3. Traegt die Gesamtzahlen ins Feld «Der Lauf» ein
   4. Schaltet die aufklappbaren Felder, immer nur eines auf einmal
   5. Zeigt die Karte, sobald ein Segment angetippt wird, und hebt das
      gewaehlte Stueck darauf hervor

   Das Aufklappen beim Hovern macht die Gestaltung allein, dafuer
   braucht es kein Javascript. Die Karte erscheint bewusst nur beim
   Antippen, sonst wuerde das Titelbild beim Ueberfahren der Punkte
   hin und her springen.
   ------------------------------------------------------------------ */

(function () {
  const zahl = (n, stellen = 2) => n.toFixed(stellen).replace('.', ',');

  const KACHELN =
    'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg';

  const DUNKEL = '#151515';
  const AKZENT = '#ffd60a';
  const HELL = '#fbfbfb';

  /* Jedes Segment besteht aus zwei Linien: eine breite Huelle und ein
     schmaler Kern darueber. Ruhend hebt eine helle Huelle die dunkle
     Linie vom unruhigen Kartengrund ab, gewaehlt kehrt sich das um,
     dann traegt eine dunkle Huelle den gelben Kern. */
  const RUHEND = {
    huelle: { color: HELL, weight: 6.5, opacity: 0.9 },
    kern: { color: DUNKEL, weight: 2.6, opacity: 0.85 }
  };
  const GEWAEHLT = {
    huelle: { color: DUNKEL, weight: 7.5, opacity: 1 },
    kern: { color: AKZENT, weight: 3.8, opacity: 1 }
  };

  let streckenDaten = null;
  let karte = null;
  let ebenen = {};
  let ganzeRunde = null;
  let marken = null;

  /* ---------- Karte ---------- */

  function karteAufbauen() {
    const behaelter = document.getElementById('karte');
    if (!behaelter || !window.L || !streckenDaten) return false;

    const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    karte = L.map(behaelter, {
      zoomControl: true,
      attributionControl: true,
      zoomAnimation: !ruhig,
      fadeAnimation: !ruhig,
      // Ohne Zwischenstufen faellt der Ausschnitt auf die naechst
      // kleinere ganze Zoomstufe zurueck, im schlechtesten Fall ist er
      // dann doppelt so weit wie noetig.
      zoomSnap: 0,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 120
    });

    L.tileLayer(KACHELN, {
      attribution: '&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a>',
      maxZoom: 18
    }).addTo(karte);

    const alle = [];
    for (const s of streckenDaten.segmente) {
      // Zwei Linien uebereinander: die Huelle liegt dunkel unter der
      // gelben Kernlinie, damit das gewaehlte Segment auf dem hellen
      // Kartengrund nicht verschwindet.
      const gemeinsam = { lineCap: 'round', lineJoin: 'round', interactive: true };
      const huelle = L.polyline(s.linie, { ...gemeinsam, ...RUHEND.huelle }).addTo(karte);
      const kern = L.polyline(s.linie, { ...gemeinsam, ...RUHEND.kern }).addTo(karte);

      kern.bindTooltip(`${s.nr}. ${s.name}`, { sticky: true });
      kern.on('click', () => {
        const knopf = document.querySelector(`[data-ziel="s${s.nr}"]`);
        if (knopf) knopf.click();
      });

      ebenen[s.nr] = { huelle, kern };
      alle.push(kern);
    }

    marken = L.layerGroup().addTo(karte);

    ganzeRunde = L.featureGroup(alle).getBounds();
    karte.fitBounds(ganzeRunde, { padding: [40, 40] });
    return true;
  }

  /* Start und Ziel eines Segments, damit die Laufrichtung ablesbar ist.
     Die Beschriftung steht fest an der Marke, nicht erst beim Hovern,
     sonst waere sie am Handy nicht zu sehen. */
  function marke(punkt, art, text) {
    return L.marker([punkt.lat, punkt.lon], {
      keyboard: false,
      zIndexOffset: art === 'ziel' ? 600 : 500,
      icon: L.divIcon({
        className: '',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        html: `<span class="marke marke-${art}"></span>`
      })
    }).bindTooltip(text, {
      permanent: true,
      // Ueber der Marke statt daneben: so braucht das Schild seitlich
      // nur seine halbe Breite und passt auch am Kartenrand noch hin.
      direction: 'top',
      offset: [0, -12],
      className: 'marke-schild'
    });
  }

  /* Grober Abstand in Metern, reicht um zu erkennen, ob Start und Ziel
     derselbe Ort sind (Schlaufen). */
  function abstandMeter(a, b) {
    const dLat = (a.lat - b.lat) * 111320;
    const dLon = (a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180);
    return Math.hypot(dLat, dLon);
  }

  function markenSetzen(segment) {
    if (!marken) return;
    marken.clearLayers();
    if (!segment) return;
    // Schlaufen enden dort, wo sie beginnen: dann nur eine Marke.
    if (abstandMeter(segment.start, segment.ziel) < 40) {
      marken.addLayer(marke(segment.start, 'start', 'Start und Ziel'));
    } else {
      marken.addLayer(marke(segment.start, 'start', 'Start'));
      marken.addLayer(marke(segment.ziel, 'ziel', 'Ziel'));
    }
  }

  function karteHervorheben(nr) {
    let gewaehlt = null;
    for (const [n, e] of Object.entries(ebenen)) {
      const an = Number(n) === Number(nr);
      const stil = an ? GEWAEHLT : RUHEND;
      e.huelle.setStyle(stil.huelle);
      e.kern.setStyle(stil.kern);
      if (an) {
        e.huelle.bringToFront();
        e.kern.bringToFront();
        gewaehlt = e.kern;
      }
    }
    markenSetzen(streckenDaten.segmente.find(s => s.nr === Number(nr)));
    if (gewaehlt) {
      karte.fitBounds(gewaehlt.getBounds(), { maxZoom: 15, ...kartenPolster() });
    }
  }

  /* Der Kartenausschnitt muss um die aufgeklappten Felder und die zwei
     Knopfspalten herum gelegt werden, sonst liegt das gewaehlte Segment
     hinter ihnen. Gemessen wird, was gerade wirklich im Weg ist. */
  function kartenPolster() {
    const flaeche = document.getElementById('karte').getBoundingClientRect();
    const kasten = el => (el ? el.getBoundingClientRect() : null);

    // Grundpolster so gross, dass die Schilder ueber Start- und Zielmarke
    // hineinpassen, statt am Kartenrand abgeschnitten zu werden.
    let links = 60;
    let rechts = 60;
    let oben = 58;
    let unten = 36;

    const linkeSpalte = kasten(document.querySelector('.segmentreihe'));
    if (linkeSpalte) links = Math.max(links, linkeSpalte.right - flaeche.left + 16);

    const rechteSpalte = kasten(document.querySelector('.knopfreihe'));
    if (rechteSpalte) rechts = Math.max(rechts, flaeche.right - rechteSpalte.left + 16);

    /* Am Computer liegt das Profil als Blatt ueber einer Haelfte der
       Karte, je nach Wahl links oder rechts. Der Ausschnitt muss auf
       der anderen Seite Platz finden. */
    const blatt = document.querySelector('.profil');
    if (blatt && document.body.classList.contains('zeigt-profil')
        && getComputedStyle(blatt).position === 'absolute') {
      const pk = blatt.getBoundingClientRect();
      if (document.body.classList.contains('wahl-rechts')) {
        links = Math.max(links, pk.right - flaeche.left + 16);
      } else {
        rechts = Math.max(rechts, flaeche.right - pk.left + 16);
      }
    }

    const feld = kasten(document.querySelector('.panel-halter.offen .panel'));
    if (feld) {
      // Breites Blatt am unteren Rand (Handy) oder Feld seitlich (Desktop)?
      if (feld.width > flaeche.width * 0.6) {
        unten = Math.max(unten, flaeche.bottom - feld.top + 16);
      } else if ((feld.left + feld.right) / 2 < (flaeche.left + flaeche.right) / 2) {
        links = Math.max(links, Math.min(feld.right - flaeche.left + 16, flaeche.width * 0.4));
      } else {
        rechts = Math.max(rechts, Math.min(flaeche.right - feld.left + 16, flaeche.width * 0.4));
      }
    }

    // Nie mehr als vier Fuenftel der Flaeche wegpolstern, sonst findet
    // Leaflet keinen sinnvollen Ausschnitt mehr.
    const kappen = (a, b, ganz) => {
      const erlaubt = ganz * 0.8;
      if (a + b <= erlaubt) return [a, b];
      const faktor = erlaubt / (a + b);
      return [a * faktor, b * faktor];
    };
    [links, rechts] = kappen(links, rechts, flaeche.width);
    [oben, unten] = kappen(oben, unten, flaeche.height);

    return {
      paddingTopLeft: [Math.round(links), Math.round(oben)],
      paddingBottomRight: [Math.round(rechts), Math.round(unten)]
    };
  }

  let letzterAusschnitt = null;   // fuer das Neueinpassen beim Umschalten

  function karteSchalten(name) {
    const treffer = /^s(\d+)$/.exec(name || '');
    const ganze = name === 'lauf';
    document.body.classList.toggle('zeigt-karte', Boolean(treffer || ganze));
    if (!treffer && !ganze) return;
    if (!karte && !karteAufbauen()) {
      document.body.classList.remove('zeigt-karte');
      return;
    }
    letzterAusschnitt = name;
    karte.invalidateSize();
    if (ganze) karteGanzeRunde();
    else karteHervorheben(Number(treffer[1]));
    profilSetzen(name);
  }

  /* Der 34er zeigt die ganze Runde: alle sechs Segmente gewaehlt. */
  function karteGanzeRunde() {
    for (const e of Object.values(ebenen)) {
      e.huelle.setStyle(GEWAEHLT.huelle);
      e.kern.setStyle(GEWAEHLT.kern);
    }
    if (marken) {
      marken.clearLayers();
      marken.addLayer(marke(streckenDaten.segmente[0].start, 'start', 'Tee, Bier und Suppe'));
    }
    if (ganzeRunde) {
      karte.fitBounds(ganzeRunde, { maxZoom: 15, ...kartenPolster() });
    }
  }

  /* ---------- Hoehenprofil ----------
     Isometrischer Riegel, in echten Pixeln gezeichnet, darum bei jeder
     Fenstergroesse neu. Die Beschriftungen (Hoehenmeter, Gipfelhoehe)
     kommen aus den Originaldaten, die Zeichnung aus einer ausgeduennten
     Fassung, damit die Gipfel nicht spitz werden. */

  /* Fester Hoehenmassstab fuer alle sieben Ansichten. Nur so sind die
     Bilder untereinander vergleichbar und die Steigungen richtig zu
     lesen. Preis: flache Segmente fuellen den Rahmen nicht mehr. */
  const HOEHE_BASIS = 400;     // Nulllinie aller Profile
  const HOEHE_OBEN = 800;      // oberste Hoehenlinie
  const HOEHE_SPITZE = 850;    // Anschlag, unter dem der Gipfel bleibt
  const HOEHE_STUFE = 100;     // Abstand der Hoehenlinien
  const NEIGUNG = 0.7;

  let profilDaten = null;      // { punkte, titel, hm }

  function profilDatenFuer(name) {
    if (!streckenDaten) return null;

    if (name === 'lauf') {
      const alle = [];
      let versatz = 0;
      for (const s of streckenDaten.segmente) {
        for (const [km, m] of s.profil) {
          alle.push([Number((versatz + km).toFixed(3)), m]);
        }
        versatz += s.km;
      }
      return {
        punkte: alle,
        titel: 'Ganze Runde',
        hm: String(streckenDaten.gesamt.hm_auf),
        hmZahl: streckenDaten.gesamt.hm_auf,
        hmWort: 'Aufstieg'
      };
    }

    const treffer = /^s(\d+)$/.exec(name || '');
    if (!treffer) return null;
    const s = streckenDaten.segmente.find(x => x.nr === Number(treffer[1]));
    if (!s || !s.profil || !s.profil.length) return null;
    /* Faellt ein Segment netto, sagt der Aufstieg nichts aus. Dann
       steht der Abstieg da, mit Minus. */
    const faellt = s.hm_ab > s.hm_auf;
    return {
      punkte: s.profil,
      titel: `Segment ${s.nr}`,
      hm: faellt ? `-${s.hm_ab}` : String(s.hm_auf),
      hmZahl: faellt ? s.hm_ab : s.hm_auf,
      hmWort: faellt ? 'Abstieg' : 'Aufstieg'
    };
  }

  /* Gleichmaessig neu abtasten. Ueber hundert Punkte machen die Gipfel
     spitz und die Deckflaechen ueberlagern sich. */
  function abtasten(punkte, anzahl) {
    if (!anzahl || punkte.length <= anzahl) return punkte;
    const kmMax = punkte[punkte.length - 1][0];
    const raus = [];
    for (let i = 0; i < anzahl; i++) {
      const km = (kmMax * i) / (anzahl - 1);
      let j = punkte.findIndex(pp => pp[0] >= km);
      if (j <= 0) { raus.push([km, punkte[0][1]]); continue; }
      const [k0, m0] = punkte[j - 1], [k1, m1] = punkte[j];
      const f = (km - k0) / Math.max(k1 - k0, 1e-9);
      raus.push([km, m0 + (m1 - m0) * f]);
    }
    return raus;
  }

  function isoProfil(rohPunkte, meta, B, H) {
    const kmSpanne = rohPunkte[rohPunkte.length - 1][0] || 1;
    const punkte = abtasten(rohPunkte, rohPunkte.length > 60 ? 55 : 0);

    const randL = Math.min(72, B * 0.13);
    /* Fester rechter Rand, damit der Riegel ueberall gleich weit vor
       den Hoehenzahlen endet. Frueher war er anteilig zur Breite, auf
       schmalen Schirmen zu knapp, und die Zahlen lagen im Gelb. Am
       Computer war er schon immer 88, dort aendert sich nichts. */
    const randR = Math.min(88, B * 0.3);
    const randO = Math.min(56, H * 0.10);
    const randU = Math.min(78, H * 0.13);

    /* Blick von rechts oben herunter: die Tiefe des Riegels weicht nach
       links hinten. Distanz- und Tiefenachse liegen in der Bodenebene,
       steigen also gleich stark. */
    const t = Math.max(28, Math.min(56, 60 - kmSpanne * 0.8));
    const tiefeX = -t;
    const sockel = 28;

    const kmMax = punkte[punkte.length - 1][0] || 1;
    const tief = HOEHE_BASIS;

    const lauf = B - randL - randR - Math.abs(tiefeX);
    /* Der isometrische Anstieg der Achse darf die Bildhoehe nicht
       sprengen. Auf einem kurzen, breiten Rahmen wird die Szene
       flacher gekippt. */
    const anstieg = Math.min(lauf * NEIGUNG, (H - randO - randU) * 0.42);
    const neig = anstieg / lauf;
    const tiefeY = -t * neig;
    const proKm = lauf / kmMax;
    const bodenY = km => H - randU - km * (anstieg / kmMax);

    /* Der Massstab haengt nur vom Rahmen ab, nicht vom Segment: der
       Anschlag bei HOEHE_SPITZE muss am hinteren Ende der Achse noch
       unter den oberen Rand passen. Weiter vorne ist es ohnehin
       tiefer, also sicher. */
    const zielOben = randO * 0.7;
    const proMeter =
      (bodenY(kmMax) - sockel + tiefeY - zielOben) / (HOEHE_SPITZE - HOEHE_BASIS);

    const PX = km => randL + Math.abs(tiefeX) + km * proKm;
    const PY = (km, m) => bodenY(km) - sockel - (m - tief) * proMeter;

    const vorn  = punkte.map(([km, m]) => [PX(km), PY(km, m)]);
    const hint  = vorn.map(([x, y]) => [x + tiefeX, y + tiefeY]);
    const fussV = punkte.map(([km]) => [PX(km), bodenY(km)]);
    const fussH = fussV.map(([x, y]) => [x + tiefeX, y + tiefeY]);
    const mitte = vorn.map(([x, y]) => [x + tiefeX / 2, y + tiefeY / 2]);

    const P = (a, b) => `${a.toFixed(1)} ${b.toFixed(1)}`;
    const zug = pts => pts.map((pp, i) => (i ? 'L' : 'M') + P(pp[0], pp[1])).join('');
    const flaeche = pts => zug(pts) + 'Z';

    /* ---------- Verdeckung ----------
       Ein Punkt in der Tiefe f ist verdeckt, wenn auf dem Sehstrahl
       davor die Gelaendeoberflaeche hoeher liegt. Hinter einem Gipfel
       verdeckt die Deckflaeche des Gipfels selbst, die in mittlerer
       Tiefe liegt, darum wird der ganze Strahl abgetastet. */
    function vornYbei(x) {
      if (x <= vorn[0][0] || x >= vorn[vorn.length - 1][0]) return null;
      for (let k = 1; k < vorn.length; k++) {
        if (vorn[k][0] >= x) {
          const f = (x - vorn[k - 1][0]) / (vorn[k][0] - vorn[k - 1][0] || 1e-9);
          return vorn[k - 1][1] + (vorn[k][1] - vorn[k - 1][1]) * f;
        }
      }
      return null;
    }
    const SCHRITTE = 20;
    function sichtbar(i, f) {
      const px = vorn[i][0] + tiefeX * f;
      const py = vorn[i][1] + tiefeY * f;
      for (let k = 0; k < SCHRITTE; k++) {
        const u = (f * k) / SCHRITTE;
        const vy = vornYbei(px - tiefeX * u);
        if (vy === null) continue;
        if (vy + tiefeY * u < py - 0.5) return false;
      }
      return true;
    }
    function laeufe(f) {
      const raus = [];
      let lauf = [];
      for (let i = 0; i < vorn.length; i++) {
        if (sichtbar(i, f)) lauf.push(i);
        else { if (lauf.length > 1) raus.push(lauf); lauf = []; }
      }
      if (lauf.length > 1) raus.push(lauf);
      return raus;
    }

    const laeufeHinten = laeufe(1);
    const hinterkante = laeufeHinten
      .map(l => `<path class="iso-hinterkante" d="${zug(l.map(i => hint[i]))}"/>`).join('');
    const routeLinie = laeufe(0.5)
      .map(l => `<path class="iso-route" d="${zug(l.map(i => mitte[i]))}"/>`).join('');

    /* Querkanten ueber die Deckflaeche am Start, am Ziel und dort, wo
       die Sicht auf die Oberflaeche hinter einem Gipfel abreisst. */
    const querKanten = new Set([0, vorn.length - 1]);
    for (const l of laeufeHinten) querKanten.add(l[l.length - 1]);
    const tiefenkanten = [...querKanten]
      .map(i => `<path class="iso-hinterkante" d="M${P(vorn[i][0], vorn[i][1])}L${P(hint[i][0], hint[i][1])}"/>`)
      .join('');

    const grund = flaeche([fussV[0], fussV[fussV.length - 1], fussH[fussH.length - 1], fussH[0]]);

    let deck = '';
    for (let i = vorn.length - 2; i >= 0; i--) {
      deck += `<path class="iso-deck" d="${flaeche([vorn[i], vorn[i + 1], hint[i + 1], hint[i]])}"/>`;
    }

    const wand = flaeche([...vorn, ...fussV.slice().reverse()]);
    const stirnL = flaeche([vorn[0], hint[0], fussH[0], fussV[0]]);

    const tickAbstand = kmMax > 20 ? 10 : kmMax > 8 ? 2 : 1;

    /* Hoehenskala auf der hintersten Ebene des Riegels. Die Linien
       laufen parallel zur Kilometerachse ueber die ganze Laenge und
       stehen im Hintergrund, das Gelaende verdeckt sie also. Sichtbar
       bleibt nur, was ueber der Kurve steht. Die Zahlen beziehen sich
       damit auf die hintere Oberkante. Beschriftung rechts am Ende der Linie. */
    /* Faellt das Segment netto, zeigt der Pfeil nach unten und die
       Hoehenzahlen stehen in einer Spalte statt am rechten Rand. */
    const faelltNetto = String(meta.hm).startsWith('-');

    const stufe = HOEHE_STUFE;
    const winkel = -(Math.atan(neig) * 180) / Math.PI;
    const laenge = Math.hypot(1, neig);
    const senk = [neig / laenge, 1 / laenge];

    const OBEN = 12;                                   // oberer Rand fuer die Skala
    const xLinksH = PX(0) + tiefeX - 20;               // etwas vor die Riegelkante
    const xRechtsH = B - 84;                           // bis kurz vor den Rand
    /* Erst alle Stufen sammeln, die ueberhaupt ins Bild passen.
       Jede Linie laeuft bis kurz vor den rechten Rand. */
    const stufen = [];
    for (let m = HOEHE_BASIS; m <= HOEHE_OBEN + 0.5; m += stufe) {
      const yAnfang = PY(0, m) + tiefeY + neig * 20;
      if (yAnfang < OBEN) continue;                    // ganz oben raus
      stufen.push([m, yAnfang]);
    }
    let skala = '';
    let skalaText = '';
    let xZahlMax = 0;
    let yZahlOben = Infinity;
    let yZahlUnten = -Infinity;
    for (const [m, yAnfang] of stufen) {
      let xEnde = xRechtsH;
      let yEnde = yAnfang - neig * (xEnde - xLinksH);
      if (yEnde < OBEN) {                              // laeuft oben raus
        xEnde = xLinksH + (yAnfang - OBEN) / neig;
        yEnde = OBEN;
      }
      skala += `<line class="iso-hilfslinie" x1="${xLinksH.toFixed(1)}" y1="${yAnfang.toFixed(1)}" x2="${xEnde.toFixed(1)}" y2="${yEnde.toFixed(1)}"/>`;
      /* Die Zahl kommt in den Vordergrund, sonst deckt der Riegel sie
         zu, wo die Linie hinter dem Gelaende endet. */
      const zx = xEnde + 6;
      const zy = yEnde + 3.5;
      skalaText += `<text class="iso-klein" transform="translate(${zx.toFixed(1)},${zy.toFixed(1)}) rotate(${winkel.toFixed(1)})">${Math.round(m)}</text>`;
      xZahlMax = Math.max(xZahlMax, zx);
      yZahlOben = Math.min(yZahlOben, zy);
      yZahlUnten = Math.max(yZahlUnten, zy);
    }

    const kmGesamt = kmSpanne.toFixed(kmSpanne < 10 ? 2 : (kmSpanne % 1 ? 1 : 0)).replace('.', ',');

    /* Kilometerachse: nur die nackten Zahlen, waagrecht unter dem
       Tick, ohne Einheit. Der Schlusstick traegt die Gesamtdistanz.
       Zwischenticks, die dem Schluss zu nahe kommen, fallen weg. */
    const xSchluss = PX(kmMax);
    let ticks = '';
    for (let km = 0; km <= kmMax + 0.001; km += tickAbstand) {
      const x = PX(km);
      const y = bodenY(km);
      if (xSchluss - x < 34) continue;
      ticks +=
        `<line class="iso-tick" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + 9).toFixed(1)}"/>` +
        `<text class="iso-klein" transform="translate(${x.toFixed(1)},${(y + 22).toFixed(1)}) rotate(${winkel.toFixed(1)})" text-anchor="middle">${km % 1 ? String(km).replace('.', ',') : km}</text>`;
    }
    /* Achsenbeschriftung: km laeuft mit der Achse mit, m ue. M. steht
       rechts neben der Zahlenreihe, senkrecht von unten nach oben. */
    const xKmAchse = PX(kmMax / 2) + senk[0] * 62;
    const yKmAchse = bodenY(kmMax / 2) + senk[1] * 62;
    const xMAchse = Math.min(B - 8, (xZahlMax || xRechtsH) + 36);
    const yMAchse = isFinite(yZahlOben) ? (yZahlOben + yZahlUnten) / 2
                                        : (randO + (H - randU)) / 2;

    const ySchluss = bodenY(kmMax);
    ticks +=
      `<line class="iso-tick" x1="${xSchluss.toFixed(1)}" y1="${ySchluss.toFixed(1)}" x2="${xSchluss.toFixed(1)}" y2="${(ySchluss + 9).toFixed(1)}"/>` +
      `<text class="iso-klein" transform="translate(${xSchluss.toFixed(1)},${(ySchluss + 22).toFixed(1)}) rotate(${winkel.toFixed(1)})" text-anchor="middle">${kmGesamt}</text>`;

    return `<svg viewBox="0 0 ${B} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block">
      <defs><marker id="p-pfeil" viewBox="0 0 10 10" refX="8" refY="5"
        markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0 0 L10 5 L0 10 z" fill="var(--ink)"/></marker></defs>
      ${skala}
      <path class="iso-grund" d="${grund}"/>
      <path class="iso-stirn" d="${stirnL}"/>
      ${deck}
      ${hinterkante}
      ${routeLinie}
      <path class="iso-wand" d="${wand}"/>
      <path class="iso-umriss" d="${wand}"/>
      <path class="iso-kante" d="${zug(vorn)}"/>
      ${tiefenkanten}
      ${ticks}
      ${skalaText}
      <text class="iso-klein" transform="translate(${xKmAchse.toFixed(1)},${yKmAchse.toFixed(1)}) rotate(${winkel.toFixed(1)})" text-anchor="middle">km</text>
      <text class="iso-klein" transform="translate(${xMAchse.toFixed(1)},${yMAchse.toFixed(1)}) rotate(-90)" text-anchor="middle">m ü. M.</text>
      <line class="iso-achse" x1="${(randL - 30).toFixed(1)}" y1="${(faelltNetto ? randO + 20 : fussH[0][1]).toFixed(1)}" x2="${(randL - 30).toFixed(1)}" y2="${(faelltNetto ? fussH[0][1] : randO + 20).toFixed(1)}" marker-end="url(#p-pfeil)"/>
      <text class="iso-hm" x="${(randL - 20).toFixed(1)}" y="${(randO + 18).toFixed(1)}">${meta.hm}</text>
      <text class="iso-hm-klein" x="${(randL - 20).toFixed(1)}" y="${(randO + 31).toFixed(1)}">hm</text>
    </svg>`;
  }

  function profilZeichnen() {
    const feld = document.getElementById('profil');
    if (!feld) return;
    if (!profilDaten || profilDaten.punkte.length < 2) { feld.innerHTML = ''; return; }

    const B = Math.round(feld.clientWidth);
    let H = Math.round(feld.clientHeight);
    if (B < 80 || H < 80) return;

    /* Nur auf dem Handy ersetzt das Profil die Karte ganz und das
       aufgeklappte Blatt liegt unten darueber. Dann den verdeckten
       Streifen aussparen. Am Computer steht das Profil neben der Karte
       und das Blatt schwebt daneben wie ueber der Karte. */
    const schmal = window.matchMedia('(max-width:759px)').matches;
    const blatt = schmal && document.querySelector('.panel-halter.offen .panel');
    if (blatt) {
      const fr = feld.getBoundingClientRect();
      const br = blatt.getBoundingClientRect();
      if (br.top < fr.bottom && br.left < fr.right && br.right > fr.left) {
        H = Math.max(150, Math.round(br.top - fr.top) - 8);
      }
    }

    feld.innerHTML = isoProfil(profilDaten.punkte, profilDaten, B, H);
    feld.setAttribute('aria-label',
      `Höhenprofil ${profilDaten.titel}, ${profilDaten.hmZahl} Höhenmeter ${profilDaten.hmWort}`);
  }

  /* Der Knopf teilt am Computer das Feld: links Karte, rechts Profil.
     Auf schmalen Schirmen ersetzt das Profil die Karte ganz. */
  /* Der Knopf im Feld hat zwei Aufgaben. Gehoert das Feld nicht zum
     gewaehlten Segment, was am Computer beim blossen Ueberfahren
     passiert, heisst er «Karte» und laedt dieses Segment. Gehoert es
     zum gewaehlten, schaltet er zwischen Karte und Hoehenprofil um. */
  function profilKnoepfeBeschriften() {
    const zeigtProfil = document.body.classList.contains('zeigt-profil');
    document.querySelectorAll('.panel-halter[data-panel]').forEach(halter => {
      const knopf = halter.querySelector('[data-profil]');
      if (!knopf) return;
      const gewaehlt = halter.classList.contains('offen');
      knopf.textContent = !gewaehlt || zeigtProfil ? 'Karte' : 'Höhenprofil';
      if (gewaehlt) knopf.setAttribute('aria-pressed', zeigtProfil ? 'true' : 'false');
      else knopf.removeAttribute('aria-pressed');
    });
  }

  function profilAnsichtSetzen(an) {
    document.body.classList.toggle('zeigt-profil', an);
    profilKnoepfeBeschriften();
    requestAnimationFrame(() => {
      if (karte) {
        karte.invalidateSize();
        /* Das Blatt deckt einen Teil der Karte zu, der Ausschnitt muss
           sich neu auf die freie Flaeche legen. */
        if (letzterAusschnitt === 'lauf') karteGanzeRunde();
        else if (letzterAusschnitt) {
          karteHervorheben(Number(/^s(\d+)$/.exec(letzterAusschnitt)[1]));
        }
      }
      profilZeichnen();
    });
  }

  function profilSetzen(name) {
    profilDaten = profilDatenFuer(name);
    profilZeichnen();
  }

  /* ---------- Felder schalten ---------- */

  function schalterAufbauen() {
    const halter = [...document.querySelectorAll('.panel-halter[data-panel]')];
    const knoepfe = [...document.querySelectorAll('[data-ziel]')];

    function setzen(name) {
      halter.forEach(h => h.classList.toggle('offen', h.dataset.panel === name));
      knoepfe.forEach(k =>
        k.setAttribute('aria-expanded', k.dataset.ziel === name ? 'true' : 'false')
      );

      // Beim Druecken tritt alles ausser dem gedrueckten Knopf zurueck.
      // Beim Hovern nicht, sonst flackert die ganze Seite, sobald man
      // mit der Maus ueber die Raender faehrt.
      document.body.classList.toggle('eine-gewaehlt', Boolean(name));
      if (!name) profilAnsichtSetzen(false);
      for (const schalter of document.querySelectorAll('.schalter')) {
        const knopf = schalter.querySelector('[data-ziel]');
        schalter.classList.toggle(
          'gedrueckt',
          Boolean(knopf) && knopf.dataset.ziel === name
        );
      }

      /* Merken, aus welcher Spalte die Wahl kam. Danach richtet sich,
         auf welcher Seite das Hoehenprofil liegt. */
      document.body.classList.toggle(
        'wahl-rechts',
        name === 'lauf' || name === 'info'
      );

      karteSchalten(name);
      profilKnoepfeBeschriften();
      baenderPruefen();
    }

    knoepfe.forEach(knopf => {
      knopf.addEventListener('click', () => {
        const name = knopf.dataset.ziel;
        const offen = halter.some(
          h => h.dataset.panel === name && h.classList.contains('offen')
        );
        setzen(offen ? null : name);
      });
    });

    document.querySelectorAll('[data-profil]').forEach(knopf => {
      knopf.addEventListener('click', () => {
        const halterEl = knopf.closest('.panel-halter[data-panel]');
        if (halterEl && !halterEl.classList.contains('offen')) {
          setzen(halterEl.dataset.panel);
          profilAnsichtSetzen(false);
          return;
        }
        profilAnsichtSetzen(!document.body.classList.contains('zeigt-profil'));
      });
    });

    document.addEventListener('click', ev => {
      if (!ev.target.closest('.segmente, .knoepfe, .kartenfeld')) setzen(null);
    });

    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape') return;
      const offen = halter.find(h => h.classList.contains('offen'));
      if (!offen) return;
      const knopf = knoepfe.find(k => k.dataset.ziel === offen.dataset.panel);
      setzen(null);
      if (knopf) knopf.focus();
    });
  }

  /* ---------- Spalten an den Bildschirm anpassen ----------
     Misst die Hoehe des Laufbands, damit die Spalten darunter
     beginnen, und entscheidet pro Knopf, ob sein Feld nach oben oder
     nach unten aufklappt. Beides haengt an der Fenstergroesse. */

  function anordnen() {
    const band = document.querySelector('.marquee');
    if (band) {
      document.documentElement.style.setProperty(
        '--laufband-h',
        `${Math.round(band.getBoundingClientRect().height)}px`
      );
    }
    const mitte = window.innerHeight / 2;
    document.querySelectorAll('.schalter').forEach(schalter => {
      const r = schalter.getBoundingClientRect();
      schalter.classList.toggle('oben', r.top + r.height / 2 < mitte);
    });
  }

  function anordnenBeobachten() {
    anordnen();
    let geplant = false;
    window.addEventListener('resize', () => {
      if (geplant) return;
      geplant = true;
      requestAnimationFrame(() => {
        geplant = false;
        anordnen();
        if (karte) karte.invalidateSize();
        profilZeichnen();
        baenderPruefen();
      });
    });
  }

  /* Kleine Zeichen fuer die drei Kennzahlen, gleiche Strichstaerke wie
     das Kartenzeichen auf den Knoepfen. */
  const SYMBOL_DISTANZ =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">' +
    '<path d="M4 7 V17"></path><path d="M20 7 V17"></path><path d="M4 12 H20"></path></svg>';
  const SYMBOL_AUF =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M12 19 V6"></path><path d="M6 12 L12 6 L18 12"></path></svg>';
  const SYMBOL_AB =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M12 5 V18"></path><path d="M6 12 L12 18 L18 12"></path></svg>';

  /* ---------- Segmentpunkte bauen ---------- */

  function segmenteBauen(daten) {
    const behaelter = document.getElementById('segmente');
    if (!behaelter) return;

    const reihe = document.createElement('div');
    reihe.className = 'segmentreihe';

    for (const s of daten.segmente) {
      const name = `s${s.nr}`;
      const schalter = document.createElement('div');
      schalter.className = 'schalter';

      schalter.innerHTML = `
        <div class="panel-halter" data-panel="${name}">
          <div class="panel" id="panel-${name}" role="region" aria-label="Segment ${s.nr}">
            <div class="panel-kopf">
              <p class="panel-titel">Segment ${s.nr}</p>
              <button class="profil-knopf" type="button" data-profil aria-pressed="false">Höhenprofil</button>
            </div>
            <p class="panel-name"></p>
            <ul class="kennzahlen">
              <li>${SYMBOL_DISTANZ}<span>${zahl(s.km)} km</span><span class="vh">Distanz</span></li>
              <li>${SYMBOL_AUF}<span>${s.hm_auf} m</span><span class="vh">Aufstieg</span></li>
              <li>${SYMBOL_AB}<span>${s.hm_ab} m</span><span class="vh">Abstieg</span></li>
            </ul>
            <div class="anmeldung" data-anmeldung="${s.nr}">
              <p class="anmelde-titel">Wer mitläuft</p>
              <div class="namenband" data-band="${s.nr}"><div class="namenband-spur"></div></div>
              <form class="anmelde-form" data-formular="${s.nr}">
                <label class="feld">
                  <span>Vorname</span>
                  <input type="text" name="vorname" required maxlength="40"
                         autocomplete="given-name" enterkeyhint="done">
                </label>
                <label class="feld">
                  <span>Bemerkung, freiwillig</span>
                  <input type="text" name="bemerkung" maxlength="80"
                         placeholder="komme mit Hund">
                </label>
                <button class="anmelde-knopf" type="submit">Eintragen</button>
              </form>
              <p class="anmelde-danke" data-danke="${s.nr}" hidden></p>
            </div>
          </div>
        </div>
        <button class="knopf knopf-punkt" type="button" data-ziel="${name}"
                aria-expanded="false" aria-controls="panel-${name}">
          <span class="zeichen zeichen-zahl" aria-hidden="true">${s.nr}</span>
          <span class="zeichen zeichen-karte" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linejoin="round" stroke-linecap="round" focusable="false">
              <path d="M9 3.6 L3 6.2 V20.4 L9 17.8 L15 20.4 L21 17.8 V3.6 L15 6.2 Z"></path>
              <path d="M9 3.6 V17.8"></path>
              <path d="M15 6.2 V20.4"></path>
            </svg>
          </span>
          <span class="zeichen zeichen-x" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                 stroke="currentColor" stroke-width="2.6"
                 stroke-linecap="round" focusable="false">
              <path d="M6.5 6.5 L17.5 17.5"></path>
              <path d="M17.5 6.5 L6.5 17.5"></path>
            </svg>
          </span>
          <span class="vh"></span>
        </button>`;

      // Namen als Text setzen, nicht als HTML, damit nichts ausbricht
      schalter.querySelector('.panel-name').textContent = s.name;
      schalter.querySelector('button .vh').textContent =
        `Segment ${s.nr}, ${s.name}, auf der Karte zeigen`;

      reihe.appendChild(schalter);
    }

    behaelter.appendChild(reihe);
  }

  /* ---------- Gesamtzahlen eintragen ---------- */

  function gesamtEintragen(daten) {
    const g = daten.gesamt;
    const felder = {
      km: `${zahl(g.km)} km`,
      hm: `${g.hm_auf} m`,
      anzahl: String(g.anzahl)
    };
    for (const [schluessel, wert] of Object.entries(felder)) {
      const knoten = document.querySelector(`[data-gesamt="${schluessel}"]`);
      if (knoten) knoten.textContent = wert;
    }
  }

  /* ---------- Anmeldungen ----------
     Vorlaeufig aus data/anmeldungen.json. Im naechsten Schritt kommt
     dieselbe Struktur aus der Google-Tabelle, die Anzeige bleibt gleich.
     Angezeigt wird nur der Vorname. Eintraege sind freigegeben, sobald
     sie in der Quelle stehen, darum erscheint ein frischer Eintrag nicht
     sofort. */

  function anmeldungenAnzeigen(eintraege) {
    document.querySelectorAll('[data-band]').forEach(band => {
      const nr = Number(band.dataset.band);
      const meine = eintraege.filter(e => Number(e.segment) === nr && e.vorname);
      const spur = band.querySelector('.namenband-spur');
      spur.classList.remove('laeuft');
      band.classList.remove('laeuft');
      spur.innerHTML = '';
      band.dataset.voll = meine.length ? 'ja' : 'nein';
      if (!meine.length) {
        const leer = document.createElement('span');
        leer.className = 'namenband-leer';
        leer.textContent = 'Noch niemand eingetragen.';
        spur.appendChild(leer);
        return;
      }
      spur.appendChild(namenTeil(meine));
    });
    baenderPruefen();
  }

  function namenTeil(eintraege) {
    const teil = document.createDocumentFragment();
    for (const e of eintraege) {
      const gruppe = document.createElement('span');
      gruppe.className = 'namenband-eintrag';
      const name = document.createElement('b');
      name.textContent = e.vorname;
      gruppe.appendChild(name);
      if (e.bemerkung) {
        const bem = document.createElement('i');
        bem.textContent = e.bemerkung;
        gruppe.appendChild(bem);
      }
      teil.appendChild(gruppe);
    }
    return teil;
  }

  /* Die Zeile laeuft nur, wenn sie nicht hineinpasst. Dann wird der
     Inhalt einmal verdoppelt, damit die Schleife nahtlos ist, und das
     Tempo an die Laenge gekoppelt: rund vierzig Pixel je Sekunde. */
  function baenderPruefen() {
    document.querySelectorAll('[data-band]').forEach(band => {
      const spur = band.querySelector('.namenband-spur');
      if (band.dataset.voll !== 'ja') return;
      const eigene = [...spur.children].filter(k => !k.dataset.kopie);
      if (spur.classList.contains('laeuft')) {
        spur.classList.remove('laeuft');
        band.classList.remove('laeuft');
        [...spur.children].forEach(k => { if (k.dataset.kopie) k.remove(); });
      }
      const platz = band.clientWidth;
      if (!platz) return;
      if (spur.scrollWidth <= platz + 1) return;
      const breite = spur.scrollWidth;
      for (const k of eigene) {
        const kopie = k.cloneNode(true);
        kopie.dataset.kopie = 'ja';
        kopie.setAttribute('aria-hidden', 'true');
        spur.appendChild(kopie);
      }
      spur.style.setProperty('--band-dauer', `${Math.max(12, Math.round(breite / 40))}s`);
      spur.classList.add('laeuft');
      band.classList.add('laeuft');
    });
  }

  /* Steht in data/anmeldung.json eine Adresse, liest und schreibt die
     Seite dort. Ist sie leer, gilt die mitgelieferte Datei und das
     Formular bestaetigt nur, ohne etwas zu schicken. */
  let anmeldeAdresse = '';

  /* Apps Script braucht ein bis drei Sekunden, gelegentlich viel mehr.
     Dagegen dreierlei: die Anfrage startet sofort und nicht erst nach
     den Streckendaten, sie bricht nach fuenfzehn Sekunden ab und
     versucht es einmal nochmals, und der zuletzt gesehene Stand liegt
     im Browser des Besuchers, damit beim zweiten Besuch sofort etwas
     dasteht. Gemessen wurden Antwortzeiten zwischen 1,8 und 13
     Sekunden, dazu gelegentlich ein 404, den der zweite Versuch
     abfaengt. */
  const ANMELDE_FRIST = 15000;
  const ANMELDE_SPEICHER = 'geburtstagslauf-anmeldungen';

  function mitFrist(adresse) {
    const abbruch = new AbortController();
    const uhr = setTimeout(() => abbruch.abort(), ANMELDE_FRIST);
    return fetch(adresse, { cache: 'no-store', signal: abbruch.signal })
      .finally(() => clearTimeout(uhr));
  }

  function anmeldungenHolen() {
    return fetch('data/anmeldung.json', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then(d => {
        anmeldeAdresse = String((d && d.adresse) || '').trim();
        return mitFrist(anmeldeAdresse || 'data/anmeldungen.json');
      })
      .then(r => {
        if (!r.ok) throw new Error(`Anmeldungen ${r.status}`);
        return r.json();
      })
      .then(d => (Array.isArray(d.eintraege) ? d.eintraege : []));
  }

  function gemerkteAnmeldungen() {
    try {
      const roh = localStorage.getItem(ANMELDE_SPEICHER);
      const d = roh ? JSON.parse(roh) : null;
      return Array.isArray(d) ? d : null;
    } catch (fehler) {
      return null;
    }
  }

  function anmeldungenMerken(eintraege) {
    try {
      localStorage.setItem(ANMELDE_SPEICHER, JSON.stringify(eintraege));
    } catch (fehler) {
      /* Privates Fenster oder Speicher voll, nicht weiter schlimm. */
    }
  }

  function bandHinweis(text) {
    document.querySelectorAll('[data-band]').forEach(band => {
      const spur = band.querySelector('.namenband-spur');
      spur.classList.remove('laeuft');
      band.classList.remove('laeuft');
      band.dataset.voll = 'nein';
      spur.innerHTML = '';
      const hinweis = document.createElement('span');
      hinweis.className = 'namenband-leer';
      hinweis.textContent = text;
      spur.appendChild(hinweis);
    });
  }

  function anmeldungenAufbauen() {
    document.querySelectorAll('[data-formular]').forEach(formular => {
      formular.addEventListener('submit', ev => {
        ev.preventDefault();
        const nr = Number(formular.dataset.formular);
        const vorname = formular.elements.vorname.value.trim();
        const bemerkung = formular.elements.bemerkung.value.trim();
        if (!vorname) return;

        const danke = document.querySelector(`[data-danke="${nr}"]`);
        const knopf = formular.querySelector('.anmelde-knopf');
        const bestaetigen = () => {
          formular.hidden = true;
          if (!danke) return;
          danke.classList.remove('fehler');
          danke.textContent =
            `Danke ${vorname}, ich habe dich notiert. Dein Name erscheint hier, sobald ich ihn freigegeben habe.`;
          danke.hidden = false;
        };

        if (!anmeldeAdresse) { bestaetigen(); return; }

        knopf.disabled = true;
        knopf.textContent = 'Wird geschickt';
        /* text/plain, damit der Browser keine Vorabfrage schickt. Apps
           Script beantwortet keine. */
        fetch(anmeldeAdresse, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ segment: nr, vorname, bemerkung })
        })
          .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
          .then(d => {
            if (!d || d.ok !== true) throw new Error((d && d.grund) || 'abgelehnt');
            bestaetigen();
          })
          .catch(fehler => {
            console.error('Anmeldung nicht abgeschickt', fehler);
            knopf.disabled = false;
            knopf.textContent = 'Eintragen';
            if (!danke) return;
            danke.classList.add('fehler');
            danke.textContent =
              'Das hat gerade nicht geklappt. Versuch es nochmals oder schreib mir eine Mail.';
            danke.hidden = false;
          });
      });
    });

    const gemerkt = gemerkteAnmeldungen();
    if (gemerkt) anmeldungenAnzeigen(gemerkt);
    else bandHinweis('Wird geladen …');

    anmeldungenUnterwegs
      .catch(fehler => {
        console.warn('Anmeldungen beim ersten Versuch nicht da, probiere nochmals', fehler);
        return anmeldungenHolen();
      })
      .then(eintraege => {
        anmeldungenAnzeigen(eintraege);
        anmeldungenMerken(eintraege);
      })
      .catch(fehler => {
        console.error('Anmeldungen nicht ladbar', fehler);
        /* Steht schon ein gemerkter Stand da, bleibt er stehen. Sonst
           die ehrliche Meldung. */
        if (!gemerkt) bandHinweis('Liste gerade nicht erreichbar.');
      });
  }

  /* ---------- Start ---------- */

  /* Sofort losschicken, nicht erst nach den Streckendaten. */
  const anmeldungenUnterwegs = anmeldungenHolen();


  fetch('data/segmente.json')
    .then(r => {
      if (!r.ok) throw new Error(`data/segmente.json fehlt (${r.status})`);
      return r.json();
    })
    .then(daten => {
      streckenDaten = daten;
      segmenteBauen(daten);
      gesamtEintragen(daten);
    })
    .catch(fehler => {
      console.error(
        'Streckendaten nicht ladbar. Lauf einmal: node tools/strecke-aufbereiten.mjs',
        fehler
      );
    })
    .finally(() => {
      // Auch wenn die Streckendaten fehlen, sollen die zwei Knoepfe
      // rechts funktionieren und richtig sitzen.
      schalterAufbauen();
      anmeldungenAufbauen();
      profilKnoepfeBeschriften();
      anordnenBeobachten();
    });
})();
