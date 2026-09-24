# Todo Geburtstagslauf-Website

Stand 22.09.2026, Lauf am Sa 28.11.2026. Punkt 2 ist erledigt, die Zeiten stehen. Punkt 5 zum Schluss, sonst testest du zweimal.

## 1. Opener mit allen Infos, wie die Seite funktioniert (gebaut am 22.09.)

Gebaut als Blatt ueber der ganzen Seite, das beim ersten Besuch aufgeht: Datumszeile, Titel «34 Jahre Kilometer» wie im Laufband, ein Absatz zum Lauf, drei nummerierte Schritte (du musst nicht alles laufen / tipp auf die Punkte am linken Rand / dort meldest du dich an), ein Satz zum Open House, unten der Knopf «Los geht's».

Geändert: `index.html` (Block `.opener` direkt nach `<body>`, steht auf `hidden`), `assets/style.css` (Abschnitt «Begruessung beim ersten Besuch»), `assets/app.js` (`openerAufbauen`, aufgerufen vor allem anderen).

Entschieden: Variante «einmalig wegklickbar». Der Schlüssel heisst `geburtstagslauf-begruessung` im localStorage. Zum Nochmalansehen die Seite mit `?begruessung` aufrufen, das übergeht den Merkzettel. Ohne Javascript bleibt das Blatt versteckt, die Seite ist also nie zugeklebt.

Geprüft: 375 px hoch, Handy quer (667 × 375, eigene Regel ab `max-height:560px`, sonst frisst der Titel die halbe Höhe), Schliessen per Knopf, per Escape und per Tipp neben das Blatt, Tabulator bleibt auf dem Knopf, nach dem Neuladen kommt es nicht wieder.

- [x] Texte am 24.09. gemeinsam durchgegangen, alle von dir. Begrüssung hat jetzt vier Schritte, der vierte führt zum Open House.
- [x] i-Knopf am 24.09. neu geschrieben. «Licht» ist raus, die Beschriftungen haben Doppelpunkte, «Basis» heisst überall «Bei uns zuhause».
- [ ] Die 13:35 im Opener stehen fest im HTML, wie die 08:30 im Feld «Der Lauf». Ändern sich die Minuten in Punkt 2, muss beides von Hand nach.

## 1b. Am Handy war das Feld nicht mehr zu schliessen (behoben am 22.09.)

Von dir gefunden: bei den unteren Knöpfen (1, 2, 3) kam man nicht mehr zurück. Gemessen bei 375 × 812 waren 1 und 2 ganz verdeckt, 3 zur Hälfte, und **das i ebenfalls ganz**, weil sein Feld das längste ist. Auf einem kürzeren Display wären es mehr gewesen.

Ursache: Am Handy wird aus dem Feld ein Blatt am unteren Rand mit `position:fixed`. Es steht im selben `.schalter` wie sein Knopf, und weil der Knopf nicht positioniert ist, malt der Browser das Blatt darüber. Das Kreuz war also da, nur unter dem Papier.

Behoben nach deinem Vorschlag: der gedrückte Knopf schrumpft auf 30 px und fährt in die obere rechte Ecke des Blattes. Die Ecke ist genau seine Mitte, ein Viertel liegt also auf dem Papier, der Rest darüber. Er fährt den Weg, statt zu springen, damit man sieht, dass es derselbe Knopf ist; die Bewegung dauert 0,28 s und kommt aus der bestehenden Regel auf `.knopf`. Bei «weniger Bewegung» in den Systemeinstellungen springt er, das war schon so geregelt. Das Blatt geht damit wieder über die volle Breite, der Einzug von vorher ist zurückgenommen.

Geändert: `assets/style.css` (im Block `@media(max-width:759px)`: `.schalter.gedrueckt .knopf` liegt über dem Blatt, dazu ein engerer Schatten für den kleinen Knopf), `assets/app.js` (Abschnitt «Kreuz an der Blattecke»).

Das Schrumpfen über `transform:scale` zieht den Rand mit, aus 1 px würden 0,65. Darum legt `app.js` den Kehrwert der Verkleinerung als `--gegen-mass` am Knopf ab, und die Gestaltung rechnet damit Rand und Fokusring hoch. Gemessen am kleinen Knopf: Rand 0,98 px gezeichnet, Fokusring 2,93 px — also gleich dick wie die 1 px und 3 px der grossen Knöpfe.

Zwei Dinge, die beim Bauen aufgefallen sind und im Code stehen:

- Gerechnet wird der Weg in Javascript, weil die Höhe des Blattes am Text hängt und erst im Browser feststeht. Ein `ResizeObserver` zieht das Kreuz mit, sobald das Anmeldeformular aufgeht: das Blatt wächst dann nach oben.
- Die Ruhelage des Knopfes wird über `offsetLeft`/`offsetWidth` gemessen, nicht über `getBoundingClientRect`. Letzteres gibt mitten in einer laufenden Bewegung den Zwischenstand zurück, und beim zweiten Rechnen (Gerät drehen) fuhr der Knopf damit ins Leere.

Geprüft: alle neun Knöpfe bei 375 × 812, 320 × 568 und 667 × 375, jeder landet auf 2 px genau auf der Ecke, ist mit `elementFromPoint` erreichbar und ragt nirgends über den Bildschirmrand hinaus (bei 375 px bleibt rechts 1 px). Drehen mit offenem Feld in beide Richtungen, Formular auf und zu, Schliessen setzt die Verschiebung zurück. Ab 760 px bleibt alles wie vorher, dort wird gar nichts verschoben.

- [ ] Auf einem echten Gerät ansehen. 30 px sind deutlich kleiner als die 44 px, die Apple als Tippfläche empfiehlt, und auf der Ecke liegt nur ein Viertel davon auf dem Papier — wenn es sich fummelig anfühlt, stell ich `ECKE_GROESSE` in `app.js` höher.
- [ ] Zweiter Rückweg fehlt weiterhin: am Handy schliesst ein Tipp auf die Karte das Feld nicht, und Escape gibt es ohne Tastatur nicht.

## 1c. Seite laesst sich auf Touchgeraeten nicht mehr ziehen (gebaut am 22.09.)

Auf Handy und Tablet soll die Startseite stillstehen: kein Gummiband beim Wischen über den Grund, kein Herunterziehen zum Neuladen.

Gebaut in `assets/style.css` als eigener Block, nicht nach Breite, sondern nach Zeigergerät — ein Tablet quer ist breiter als mancher Laptop:

```css
@media(pointer:coarse){
  html,body{height:100%;overflow:hidden;overscroll-behavior:none}
}
```

Zu scrollen gibt es auf der Seite ohnehin nichts, sie passt genau auf den Schirm. Was scrollen soll, scrollt weiter: die Felder, die Begrüssung und die Karte. `overscroll-behavior` hält deren Scrollen ausserdem bei ihnen, statt es am Ende an die Seite weiterzugeben.

Geprüft im Vorschaubrowser bei 375 × 812 und 667 × 375: Seite lässt sich nicht verschieben (`scrollY` bleibt 0, kein Überhang), Feld und Begrüssung scrollen in sich weiter, die Karte lässt sich weiter ziehen. Am Computer ändert sich nichts, dort greift die Regel nicht.

- [ ] **Auf einem echten iPhone nachsehen.** Der Vorschaubrowser hier ist Chromium mit angeschaltetem Touch, nicht Safari. `overscroll-behavior` kennt Safari erst ab Version 16. Federt die Seite auf deinem Gerät trotzdem, setze ich zusätzlich `position:fixed` auf den Body, das ist der ältere, härtere Weg.
- [x] Tastatur: geprüft von dir auf dem Handy, die Eingabefelder waren verdeckt. Behoben, siehe Punkt 1d.

## 1d. Anmeldung am Handy ist jetzt eine eigene Ansicht (22.09.)

Von dir gemeldet, in drei Runden. Der Reihe nach: die Tastatur verdeckte das Formular; dann sprang der Fokus beim Druck auf «Anmelden» sofort ins Feld; dann klappte das Feld beim Antippen von Name und Mail zu; dann war es «irgendwo» und gar nicht mehr zu sehen.

Was ich zuerst versucht habe und was daran falsch war:

1. **Ausweichen nach unten** über `visualViewport`, also das Feld um die Höhe der Tastatur hochrücken. Ging nicht, Safari meldet die Höhe nicht verlässlich.
2. **Sprung an den oberen Rand**, sobald ein Feld den Fokus hat. Ging auch nicht: ein festsitzendes Blatt wird im Layout platziert, die Tastatur verschiebt aber nur den sichtbaren Ausschnitt. Unten liegt es darunter, oben darüber — dein «ich sehe es gar nicht mehr».

**Die Lösung ist jetzt eine andere Form, nicht eine bessere Rechnung.** Am Handy ist die Anmeldung keine Karteikarte mehr, die einer Tastatur ausweichen muss, sondern eine eigene ganzseitige Ansicht: weisses Blatt über allem, oben die Zeile «Anmelden · Segment 1, Uetliberg, hinauf» und ein Kreuz zum Schliessen, darunter die drei Felder und «Eintragen». Ein Blatt, das den ganzen Schirm füllt, kann nirgends hinrutschen — was immer zu sehen ist, ist ein Stück davon. Die Felder stehen oben, wo die Tastatur nicht hinkommt.

Damit ist alle Rechnerei zur Tastatur wieder draussen: `--tastatur`, `--sicht-h`, der Sprung nach oben und die zwei Sicherungen gegen das Zuklappen sind entfernt. Was blieb: **der Fokus springt am Handy nicht mehr ins Feld** (nur noch mit Maus), du kannst das Formular also zuerst lesen.

Geändert: `assets/app.js` (Kopfzeile und Fehlerzeile in beiden Formularen, Schliessknopf verdrahtet, Klasse `formular-offen`), `assets/style.css` (Abschnitt «Anmeldung am Handy: eigene Ansicht»).

Nebenbei aufgefallen und mitgemacht: **Die Fehlermeldung stand im Feld hinter dem Formular.** Schlägt das Abschicken fehl, wäre sie am Handy unter der ganzseitigen Ansicht gelegen, also unsichtbar. Sie steht jetzt im Formular selbst, direkt über «Eintragen».

Geprüft bei 375 × 812: Ansicht deckt 0,0 bis 375 × 812, Felder und «Eintragen» stehen im oberen Drittel, Titelzeile stimmt, auch beim Open House. Kreuz schliesst und lässt das Feld dahinter offen, Escape schliesst alles, ein Tipp ins Eingabefeld klappt nichts mehr zu, das Kreuz des Feldes dahinter tritt zurück. Am Computer (1024 × 768) steht das Formular wie bisher im Feld, ohne Kopfzeile, und der Fokus springt weiterhin ins erste Feld.

- [ ] **Auf dem Handy prüfen.** Diesmal hängt nichts mehr an einer Messung.
- [ ] Beim Testen aufgefallen, gehört zu Punkt 5: Die Namensliste läuft hier öfter in die 15-Sekunden-Frist (`Anmeldungen nicht ladbar` in der Konsole). Das Apps Script antwortet also manchmal langsamer als die Frist erlaubt. Auf der Seite steht dann «Liste gerade nicht erreichbar».

## 2. Schnitt 7:00 bis 7:30 statt 6:30 (erledigt am 22.09.)

Gerechnet wird mit 7:15, auf der Seite steht «7:00 bis 7:30». Start neu 08:30. Geändert in `data/texte.json` (Zeiten und die zwei Beschreibungstexte, die den Schnitt nannten) und in `index.html` (Feld «Der Lauf» und der i-Text), danach `node tools/strecke-aufbereiten.mjs`.

| Segment | km | Hm | bisher | neu | Beginn |
| --- | --- | --- | --- | --- | --- |
| 1 Uetliberg hinauf | 4,8 | +419 | 50 | 55 | 08:30 |
| 2 Uetliberg hinunter | 5,0 | -419 | 30 | 35 | 09:25 |
| 3 Enge-Schlaufe | 4,6 | flach | 30 | 35 | 10:00 |
| 4 Nach Stettbach | 7,7 | +198 | 60 | 70 | 10:35 |
| 5 Von Stettbach zurück | 8,5 | +200 | 70 | 80 | 11:45 |
| 6 Schlussrunde | 3,8 | flach | 30 | 30 | 13:05 |

Total 305 statt 270 Minuten, Ende **13:35**. Segment 6 steht jetzt auf festen 30 Minuten statt auf einem Schnitt, weil die Rundung auf fünf Minuten sonst 25 ergeben hätte, also 6:38 pro Kilometer, und damit das Gegenteil von dem, was im i-Text steht.

- [x] Minuten am 24.09. von dir bestätigt, bleiben wie sie sind. Damit stehen die Startzeiten 08:30, 09:25, 10:00, 10:35, 11:45, 13:05 und das Ende um 13:35 fest.
- [ ] Wenn sich schon jemand angemeldet hat: allen Angemeldeten die neuen Zeiten schreiben. Der Start ist eine halbe Stunde früher, das merkt jeder.

## 3. Knopf für Leute, die nur etwas trinken kommen (gebaut am 22.09.)

Gebaut als siebter Punkt in der Segmentreihe, über der 6, mit Becherzeichen statt Zahl, Beschriftung «Open House», mit Namensliste «Wer vorbeikommt». Er zeigt nichts auf der Karte und hat kein Höhenprofil, weil er kein Streckenstück ist. Die Anmeldung läuft unter der Segmentnummer 0.

Geändert: `data/texte.json` (neuer Block `openhouse`, dort stehen Titel, Name, Zeit und Beschreibung), `tools/strecke-aufbereiten.mjs` (reicht den Block durch und warnt, solange PLATZHALTER darin steht), `assets/app.js` (Funktion `openHouseBauen`), `assets/style.css` (zwei Zeilen fürs Becherzeichen), `tools/anmeldung.gs` (die 0 war vorher ungültig).

- [ ] **Apps Script neu bereitstellen.** Ohne das weist die alte Fassung jede Open-House-Anmeldung ab, die Seite zeigt dann «Das hat gerade nicht geklappt». Im Editor: Bereitstellen, Bereitstellungen verwalten, Stift, bei Version «Neue Version», Bereitstellen. Die Adresse bleibt gleich, `data/anmeldung.json` musst du nicht anfassen.
- [ ] Danach eine Testanmeldung auf den Becherknopf machen und schauen, ob in der Tabelle eine Zeile mit Segment 0 landet und die Mail «Open House» im Betreff hat.
- [x] Text am 24.09. geschrieben, der Platzhalter ist weg: kein Ende festgelegt, Snacks und Getränke, keine Obergrenze. Kinder und Adresse kommen auf deinen Wunsch nicht vor.
- [ ] Entscheiden, ob die Zeit «ab 14:00» so stimmt.

## 4. Open House mit Lisa absprechen

Vor dem Schreiben der Texte, nicht danach. Zu klären:

- [x] Zeitfenster: ab 14:00, Ende offen.
- [x] Keine Obergrenze nötig.
- [x] Snacks und Getränke am Nachmittag, Tee, Bier und Suppe für nach dem Lauf.
- [x] Kinder: kommt für die Wohnung nicht auf die Seite.
- [x] Adresse: kommt nicht auf die Seite, die Eingeladenen wissen, wo du wohnst.
- [ ] Umziehen und Duschen: gibt es das, und soll es auf die Seite?

## 1e. Laufband schmaler, kein Zoom beim Eintragen (24.09.)

Zwei Kleinigkeiten von dir gemeldet:

- **Laufband am Computer zu hoch.** Ab 760 px Fensterbreite jetzt höchstens 42 px Schrift statt 58 und Zeilenhöhe 1,12 statt 1,3. Bei 1440 × 900 sinkt das Band von 76 auf 48 px, bei 1280 × 800 auf 47. Am Handy unverändert 40 px. Der Rest rückt mit, weil `app.js` die Höhe misst und als `--laufband-h` ablegt.
- **Zoom beim Eintragen.** Safari auf dem iPhone zoomt beim Antippen in jedes Eingabefeld, dessen Schrift kleiner als 16 px ist, und danach sitzt die Seite verschoben. Die Felder erbten 14 px aus dem Feldtext, stehen jetzt auf 16 px, aber nur auf Touchgeräten. Die Seite selbst lässt sich weiterhin von Hand aufziehen — das gehört nicht abgeschaltet, wer schlecht sieht, braucht es.

- [ ] Beides ist nach dem Commit von heute entstanden, gehört also in einen zweiten Commit, sobald der Push durch ist.

## 6. Texte (durchgegangen am 24.09.)

Alle sieben Textblöcke einmal gemeinsam durch. Geändert: Begrüssung (vier Schritte, Geburtstag am 27.11., «bei uns zuhause» statt «Basis»), i-Knopf (neu geschrieben, «Licht» raus), Segment 1 («Uetliberg Laternenweg, hinauf», am Sihlcity vorbei), Segment 2 («Uetliberg Panoramaweg, hinunter»), Segment 5 (Treffpunkt nur noch «Stettbach»), Open House (Platzhalter ersetzt), Formular (Fehlermeldung verweist auf WhatsApp, Dankestext ohne Amtsdeutsch), Vorschautext beim Teilen (sagte fälschlich «sieben Segmente»).

Unverändert geblieben: Feld «Der Lauf», Segmente 3, 4 und 6, Seitentitel, Laufband, Fusszeile.

- [ ] Treffpunkt von Segment 5 heisst jetzt nur noch «Stettbach». Für jemanden, der dorthin anreist, ist das unbestimmt — falls es ein konkreter Ort ist, sag ihn mir.
- [ ] Segment 2 und 4 enden bzw. beginnen auswärts (Uto Kulm, Stettbach). Wie man dorthin kommt und wie man zurückkommt, steht nirgends. Du wolltest es nicht, ich notiere es nur.

## 5. Testen

- [ ] Anmeldung von Anfang bis Ende: eintragen, in der Google-Tabelle nachschauen, Freigabe setzen, prüfen, ob der Name auf der Seite erscheint. Mit einer Fremdmailadresse, nicht mit deinem eigenen Google-Konto.
- [ ] Denselben Test auf dem Handy, Safari und Chrome, und einmal mit Brave. Brave hat beim Mitarbeit-Tool schon Probleme gemacht, das kann hier auch auftreten.
- [ ] Fehlerfall: Was zeigt die Seite, wenn Google nicht antwortet oder die Tabelle leer ist? Die Zwischenspeicherung im Browser darf keine alten Namen zeigen, die längst gelöscht sind.
- [ ] Karte: swisstopo-Kacheln, Umschalten zwischen den drei Hintergründen, Höhenprofil pro Segment und für die ganze Strecke.
- [ ] Alle Segmente durchklicken, Zeiten und Treffpunkte gegen `texte.json` prüfen.
- [x] WhatsApp-Link gestrichen am 24.09., die Leute haben die Nummer schon. Der Satz heisst jetzt «Kannst du doch nicht mehr, gib mir kurz Bescheid», in `index.html` und in der Bestätigung nach dem Eintragen. Die Link-Maschinerie in `app.js` und das Feld `whatsapp` in `data/anmeldung.json` sind weg.
- [ ] Ganze Seite ohne Maus durchgehen, nur mit Tabulator, und einmal auf einem kleinen Handy (375 px).

## Zusätzlich aufgefallen, von dir nicht genannt

- [ ] **Die Seite im Netz ist nicht die Seite auf deinem Mac.** Der letzte Commit ist vom 11.09., seither sind `index.html`, `app.js`, `style.css`, `texte.json` und `segmente.json` geändert und `anmeldung.json`, `anmeldungen.json` und `tools/anmeldung.gs` gar nie eingecheckt. Auf GitHub Pages läuft also eine ältere Fassung ohne Anmeldung. Commit und Push gehören vor jeden Test am echten Link.
- [ ] **Bildband.** Es ist viermal dasselbe Unsplash-Bild. Entweder drei weitere Bilder oder bewusst so lassen.
- [ ] **Wann geht die Einladung raus?** Ende November ist eine belegte Zeit. Vorschlag: bis Mitte Oktober verschicken, damit die Leute den Samstag noch frei haben. Damit ist alles oben in rund drei Wochen fällig.
