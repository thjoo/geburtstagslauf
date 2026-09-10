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
 * Nach jeder Aenderung an diesem Code muss die Bereitstellung neu
 * gemacht werden, sonst laeuft weiter die alte Fassung.
 */

var BLATT = 'Anmeldungen';
var KOPF = ['zeit', 'segment', 'vorname', 'bemerkung', 'freigegeben'];

function doGet() {
  var werte = blatt().getDataRange().getValues();
  var kopf = werte.shift() || [];
  var iSeg = kopf.indexOf('segment');
  var iVor = kopf.indexOf('vorname');
  var iBem = kopf.indexOf('bemerkung');
  var iFrei = kopf.indexOf('freigegeben');

  var eintraege = [];
  for (var i = 0; i < werte.length; i++) {
    var z = werte[i];
    if (String(z[iFrei]).trim() === '') continue;      // nicht freigegeben
    var segment = Number(z[iSeg]);
    var vorname = String(z[iVor]).trim();
    if (!segment || !vorname) continue;
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
    if (!segment || segment < 1 || segment > 20 || !vorname) {
      return antwort({ ok: false, grund: 'unvollstaendig' });
    }
    blatt().appendRow([new Date(), segment, vorname, bemerkung, '']);
    return antwort({ ok: true });
  } catch (fehler) {
    return antwort({ ok: false, grund: String(fehler) });
  }
}

function blatt() {
  var datei = SpreadsheetApp.getActiveSpreadsheet();
  var b = datei.getSheetByName(BLATT);
  if (!b) {
    b = datei.insertSheet(BLATT);
    b.appendRow(KOPF);
    b.setFrozenRows(1);
  }
  if (b.getLastRow() === 0) {
    b.appendRow(KOPF);
    b.setFrozenRows(1);
  }
  return b;
}

function antwort(objekt) {
  return ContentService
    .createTextOutput(JSON.stringify(objekt))
    .setMimeType(ContentService.MimeType.JSON);
}
