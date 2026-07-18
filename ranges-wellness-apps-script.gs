/**
 * RANGES Athlete Wellness & Load Monitoring — Google Apps Script backend
 * ----------------------------------------------------------------------
 * Pairs with ranges-wellness.html. Provides:
 *   • Shared storage in a Google Sheet (check-ins visible on every device)
 *   • AUTOMATIC email alerts to the Wellness Coordinator the moment an
 *     athlete's check-in trips an alert rule (red / yellow / chat request)
 *
 * Setup: see RANGES_Wellness_Setup.md in this repo (about 10 minutes).
 * Deploy as Web App: Execute as ME, access: ANYONE. Paste the /exec URL
 * into the app: Admin → Google Sheets sync.
 */

var SHEET_CHECKINS = 'Checkins';
var SHEET_SHARED   = 'Shared';    // config / roster / actioned (key-value JSON)
var SHEET_ALERTS   = 'Alerts';    // log of every alert emailed (also the dedupe record)

// ---------------------------------------------------------------- helpers
function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

function getSheet(name, headers) {
  var sh = ss().getSheetByName(name);
  if (!sh) {
    sh = ss().insertSheet(name);
    if (headers) sh.appendRow(headers);
  }
  return sh;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sharedGet(key) {
  var sh = getSheet(SHEET_SHARED, ['key', 'json']);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      try { return JSON.parse(data[i][1]); } catch (e) { return null; }
    }
  }
  return null;
}

function sharedSet(key, value) {
  var sh = getSheet(SHEET_SHARED, ['key', 'json']);
  var data = sh.getDataRange().getValues();
  var json = JSON.stringify(value);
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) { sh.getRange(i + 1, 2).setValue(json); return; }
  }
  sh.appendRow([key, json]);
}

// ---------------------------------------------------------------- GET
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';

  if (action === 'ping') return jsonOut({ ok: true, app: 'ranges-wellness', time: new Date().toISOString() });

  if (action === 'pull') {
    var sh = getSheet(SHEET_CHECKINS, ['id', 'dateISO', 'userId', 'name', 'json']);
    var rows = sh.getDataRange().getValues();
    var checkins = [];
    for (var i = 1; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      try { checkins.push(JSON.parse(rows[i][4])); } catch (err) { /* skip bad row */ }
    }
    return jsonOut({
      ok: true,
      checkins: checkins,
      config:   sharedGet('config')   || null,
      roster:   sharedGet('roster')   || [],
      actioned: sharedGet('actioned') || []
    });
  }

  return jsonOut({ ok: false, error: 'unknown action: ' + action });
}

// ---------------------------------------------------------------- POST
function doPost(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}

  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    if (action === 'submit')     return handleSubmit(body);
    if (action === 'saveShared') return handleSaveShared(body);
    if (action === 'alert')      return handleAlert(body);
    if (action === 'clearAll')   return handleClearAll();
    return jsonOut({ ok: false, error: 'unknown action: ' + action });
  } finally {
    lock.releaseLock();
  }
}

// append one check-in row (id-deduped)
function handleSubmit(body) {
  var c = body && body.checkin;
  if (!c || !c.id) return jsonOut({ ok: false, error: 'no checkin' });
  var sh = getSheet(SHEET_CHECKINS, ['id', 'dateISO', 'userId', 'name', 'json']);
  var ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (r) { return r[0]; });
  if (ids.indexOf(c.id) === -1) {
    sh.appendRow([c.id, c.dateISO, c.userId, c.name || '', JSON.stringify(c)]);
  }
  return jsonOut({ ok: true });
}

function handleSaveShared(body) {
  if (body.config)   sharedSet('config', body.config);
  if (body.roster)   sharedSet('roster', body.roster);
  if (body.actioned) sharedSet('actioned', body.actioned);
  return jsonOut({ ok: true });
}

function handleClearAll() {
  [SHEET_CHECKINS, SHEET_SHARED, SHEET_ALERTS].forEach(function (name) {
    var sh = ss().getSheetByName(name);
    if (sh) sh.clearContents();
  });
  getSheet(SHEET_CHECKINS, null).appendRow(['id', 'dateISO', 'userId', 'name', 'json']);
  getSheet(SHEET_SHARED, null).appendRow(['key', 'json']);
  getSheet(SHEET_ALERTS, null).appendRow(['flagId', 'sentAt', 'severity', 'athlete', 'title', 'detail']);
  return jsonOut({ ok: true });
}

// ---------------------------------------------------------------- ALERT EMAILS
// The app computes flags client-side and posts each new one here.
// This function dedupes on flag id (Alerts sheet) and emails the
// coordinator automatically — no one needs to be watching the app.
function handleAlert(body) {
  var f = body && body.flag;
  if (!f || !f.id) return jsonOut({ ok: false, error: 'no flag' });

  var sh = getSheet(SHEET_ALERTS, ['flagId', 'sentAt', 'severity', 'athlete', 'title', 'detail']);
  var ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (r) { return r[0]; });
  if (ids.indexOf(f.id) !== -1) return jsonOut({ ok: true, deduped: true });

  var cfg = sharedGet('config') || {};
  var coordEmail = body.coordEmail || cfg.coordEmail || '';
  var coordName  = body.coordName  || cfg.coordName  || 'Wellness Coordinator';
  var coachEmail = body.coachEmail || cfg.coachEmail || '';
  var athlete    = body.athleteName || f.userId;
  var severity   = f.severity || 'yellow';

  var sent = false;
  if (coordEmail) {
    var sevLabel = severity === 'red' ? '🔴 RED ALERT'
                 : severity === 'comm' ? '💬 CHAT REQUEST'
                 : '🟡 Yellow alert';
    var subject = '[RANGES wellness] ' + sevLabel + ' — ' + athlete + ' — ' + f.title;
    var bodyText =
      'Hi ' + coordName + ',\n\n' +
      'Automatic alert from the RANGES wellness monitor:\n\n' +
      'Severity: ' + sevLabel + '\n' +
      'Athlete:  ' + athlete + '\n' +
      'Alert:    ' + f.title + '\n' +
      'Detail:   ' + f.detail + '\n' +
      'Date:     ' + (f.dateISO || '') + '\n\n' +
      (severity === 'red'
        ? 'This is a large negative change from this athlete\'s own baseline within one or two sessions — please follow up as soon as possible.\n\n'
        : severity === 'comm'
          ? 'The athlete has asked to talk — please reach out to them.\n\n'
          : 'This is a sustained or noticeable negative change from this athlete\'s own baseline — worth a check-in when convenient.\n\n') +
      'Open the wellness app (coach screen) for their full trends.\n\n' +
      '— RANGES wellness monitor (automated)';
    try {
      MailApp.sendEmail({
        to: coordEmail,
        cc: coachEmail || undefined,
        subject: subject,
        body: bodyText
      });
      sent = true;
    } catch (err) {
      // record the failure but keep the flag logged so it isn't retried forever
      sh.appendRow([f.id, new Date().toISOString(), severity, athlete, f.title, 'EMAIL FAILED: ' + err]);
      return jsonOut({ ok: false, error: String(err) });
    }
  }

  sh.appendRow([f.id, new Date().toISOString(), severity, athlete, f.title, f.detail + (sent ? '' : ' (no coordinator email configured — logged only)')]);
  return jsonOut({ ok: true, emailed: sent });
}
