/**
 * Example Google Apps Script Web App (Code.gs)
 * ----------------------------------------------
 * Your current deployment (per Section 72) needs to expose these three
 * actions for backend/data/GoogleSheetsAdapter.js to work. Paste this into
 * your Apps Script project (Extensions > Apps Script from the spreadsheet),
 * adjust SHEET_ID if this script isn't bound to the spreadsheet directly,
 * then Deploy > New deployment > Web app (Execute as: Me, Access: Anyone
 * with the link — restrict further with a shared secret if you want extra
 * protection beyond "security through an unguessable URL").
 *
 * GET ?action=ping
 *   -> { "ok": true }
 *
 * GET ?action=listSheets
 *   -> [ { "sheetName": "Sales & cub", "headers": ["Week","Vendor",...] }, ... ]
 *
 * GET ?action=getSheet&name=<sheetName>
 *   -> [ { "Week": "...", "Vendor": "...", ... }, ... ]   (array of row objects, keyed by header)
 */

function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === 'ping') return json_({ ok: true });
    if (action === 'listSheets') return json_(listSheets_());
    if (action === 'getSheet') return json_(getSheet_(e.parameter.name));
    return json_({ error: 'UNKNOWN_ACTION', message: 'action must be ping | listSheets | getSheet' }, 400);
  } catch (err) {
    return json_({ error: 'SERVER_ERROR', message: String(err) }, 500);
  }
}

function listSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets().map(function (sheet) {
    const lastCol = sheet.getLastColumn();
    const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    return { sheetName: sheet.getName(), headers: headers };
  });
}

function getSheet_(name) {
  if (!name) throw new Error('Missing required parameter: name');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('No sheet named "' + name + '" found.');

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values.map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) {
      if (!h) return;
      const v = row[i];
      // Dates come through as JS Date objects in Apps Script — serialize to ISO
      // so backend/data/normalize.js's parseSheetDate() gets an unambiguous value.
      obj[h] = v instanceof Date ? v.toISOString() : v;
    });
    return obj;
  });
}

function json_(payload, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
  // Note: Apps Script Web Apps cannot set a custom HTTP status code on
  // ContentService responses; the adapter treats a JSON body with an
  // "error" key as a failure regardless of HTTP status.
}
