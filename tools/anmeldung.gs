/* Gegenstelle fuer die Anmeldung auf der Geburtstagslauf-Seite.
 *
 * Einrichten, einmalig:
 *   1. Leere Google-Tabelle anlegen.
 *   2. Erweiterungen, Apps Script. Den vorhandenen Code loeschen und
 *      diese Datei hineinkopieren.
 *   3. Bereitstellen, Neue Bereitstellung, Typ Web-App.
 *      Ausfuehren als: ich selbst. Zugriff: Alle.
 *   4. Die Adresse, die dabei herauskommt, in data/anmeldung.json
 *      unter "adresse" eintragen.
 *
 * Freigabe: jede Anmeldung landet mit leerer Spalte "freigegeben" in
 * der Tabelle. Erst wenn dort etwas steht, ein x genuegt, erscheint der
 * Name auf der Seite. Muell loescht man als ganze Zeile.
 *
 * Mail: bei jeder Anmeldung geht eine Mail an das Google-Konto, dem das
 * Skript gehoert. Antworten auf diese Mail gehen direkt an die Person,
 * die sich angemeldet hat. Die Mailadressen stehen nur in der Tabelle,
 * die Seite bekommt sie nie zu sehen.
 *
 * Nach jeder Aenderung an diesem Code:
 *   a. Im Editor oben die Funktion "testmail" waehlen und Ausfuehren.
 *      Beim ersten Mal fragt Google nach der Erlaubnis, Mails zu
 *      schicken. Zulassen, dann kommt eine Testmail.
 *   b. Bereitstellen, Bereitstellungen verwalten, Stift, bei Version
 *      "Neue Version" waehlen, Bereitstellen. So bleibt die Adresse
 *      gleich. Eine "Neue Bereitstellung" gaebe eine neue Adresse.
 */

/* Segmentnummern: 1 bis 6 sind die Streckenstuecke, 0 ist das Open
 * House fuer Gaeste, die nur vorbeikommen. */

var BLATT = 'Anmeldungen';
var KOPF = ['zeit', 'segment', 'vorname', 'bemerkung', 'freigegeben', 'mail'];

function doGet() {
  var werte = blatt().getDataRange().getValues();
  var kopf = werte.shift() || [];
  var iSeg = kopf.indexOf('segment');
  var iVor = kopf.indexOf('vorname');
  var iBem = kopf.indexOf('bemerkung');
  var iFrei = kopf.indexOf('freigegeben');

  // Nur diese drei Felder gehen hinaus, die Mailadresse nie.
  var eintraege = [];
  for (var i = 0; i < werte.length; i++) {
    var z = werte[i];
    if (String(z[iFrei]).trim() === '') continue;      // nicht freigegeben
    var rohSegment = String(z[iSeg]).trim();
    var segment = Number(rohSegment);
    var vorname = String(z[iVor]).trim();
    // Die 0 des Open House ist gueltig, eine leere Zelle nicht.
    if (rohSegment === '' || !isFinite(segment) || !vorname) continue;
    eintraege.push({
      segment: segment,
      vorname: vorname,
      bemerkung: String(z[iBem]).trim()
    });
  }
  return antwort({ eintraege: eintraege });
}

function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var segment = Number(d.segment);
    var vorname = String(d.vorname || '').trim().slice(0, 40);
    var bemerkung = String(d.bemerkung || '').trim().slice(0, 80);
    var mail = String(d.mail || '').trim().slice(0, 100);
    if (String(d.segment).trim() === '' || !isFinite(segment) ||
        segment < 0 || segment > 20 || !vorname ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      return antwort({ ok: false, grund: 'unvollstaendig' });
    }

    // Die Zeile folgt der Kopfzeile, egal in welcher Reihenfolge die
    // Spalten stehen.
    var b = blatt();
    var kopf = b.getRange(1, 1, 1, b.getLastColumn()).getValues()[0];
    var werte = {
      zeit: new Date(), segment: segment, vorname: vorname,
      bemerkung: bemerkung, freigegeben: '', mail: mail
    };
    b.appendRow(kopf.map(function (name) {
      return Object.prototype.hasOwnProperty.call(werte, name) ? werte[name] : '';
    }));

    benachrichtigen(segment, vorname, bemerkung, mail);
    return antwort({ ok: true });
  } catch (fehler) {
    return antwort({ ok: false, grund: String(fehler) });
  }
}

/* Die Mail ist eine Beigabe. Klappt sie nicht, gilt die Anmeldung
   trotzdem. */
function benachrichtigen(segment, vorname, bemerkung, mail) {
  try {
    var an = Session.getEffectiveUser().getEmail();
    if (!an) return;
    MailApp.sendEmail({
      to: an,
      replyTo: mail,
      subject: 'Geburtstagslauf: ' + vorname + ' für ' + bezeichnung(segment),
      body:
        'Neue Anmeldung\n\n' +
        'Wofür: ' + bezeichnung(segment) + '\n' +
        'Vorname: ' + vorname + '\n' +
        'Mail: ' + mail + '\n' +
        'Bemerkung: ' + (bemerkung || '(keine)') + '\n\n' +
        'Zum Freigeben in der Tabelle ein x in die Spalte "freigegeben" setzen:\n' +
        SpreadsheetApp.getActiveSpreadsheet().getUrl()
    });
  } catch (fehler) {
    console.error('Mail nicht verschickt', fehler);
  }
}

function bezeichnung(segment) {
  // Das Open House laeuft unter der 7, nicht unter der 0: die frueher
  // bereitgestellte Fassung dieses Skripts wies die 0 ab.
  return Number(segment) === 7 ? 'Open House' : 'Segment ' + segment;
}

/* Einmal im Editor ausfuehren: holt die Erlaubnis zum Mailen und
   schickt eine Testmail an dich. Schreibt nichts in die Tabelle. */
function testmail() {
  benachrichtigen(0, 'Test', 'nur ein Test', Session.getEffectiveUser().getEmail());
}

function blatt() {
  var datei = SpreadsheetApp.getActiveSpreadsheet();
  var b = datei.getSheetByName(BLATT);
  if (!b) {
    b = datei.insertSheet(BLATT);
    b.setFrozenRows(1);
  }
  if (b.getLastRow() === 0) {
    b.appendRow(KOPF);
    b.setFrozenRows(1);
    return b;
  }
  // Fehlt in einer bestehenden Tabelle eine Spalte, etwa "mail", kommt
  // sie hinten an die Kopfzeile. Die alten Zeilen bleiben, wie sie sind.
  var kopf = b.getRange(1, 1, 1, Math.max(b.getLastColumn(), 1)).getValues()[0];
  for (var i = 0; i < KOPF.length; i++) {
    if (kopf.indexOf(KOPF[i]) === -1) {
      kopf.push(KOPF[i]);
      b.getRange(1, kopf.length).setValue(KOPF[i]);
    }
  }
  return b;
}

function antwort(objekt) {
  return ContentService
    .createTextOutput(JSON.stringify(objekt))
    .setMimeType(ContentService.MimeType.JSON);
}
