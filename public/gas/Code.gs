/**
 * ============================================================================
 * LMS PENGAWAS UJIAN SMPIT AL-MULTAZAM — Kabupaten Kuningan, Jawa Barat
 * File 1: Code.gs (Google Apps Script Server + Google Sheets Database)
 * ============================================================================
 * CARA PASANG:
 * 1. Buka Google Spreadsheet baru -> Ekstensi -> Apps Script.
 * 2. Tempel seluruh isi file ini ke Code.gs.
 * 3. Buat file HTML baru (+ -> HTML) beri nama: Index  (menjadi Index.html).
 * 4. Tempel seluruh isi Index.html ke file Index.html tersebut.
 * 5. Klik Terapkan (Deploy) -> Deployment Baru -> Jenis: Aplikasi Web.
 *    - Jalankan sebagai: Saya (Me)
 *    - Yang memiliki akses: Siapa saja (Anyone) atau organisasi sekolah.
 * ============================================================================
 */

const SHEET_GURU = 'Data_Guru';
const SHEET_REKAP = 'Rekap_Kehadiran';
const SHEET_PENGATURAN = 'Pengaturan';
const TIMEZONE = 'Asia/Jakarta';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('LMS Pengawas Ujian SMPIT AL-MULTAZAM')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSpreadsheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Script harus terhubung ke Google Spreadsheet (Ekstensi > Apps Script).');
  }
  return ss;
}

function getOrCreateSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#156235')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function safeStr_(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function getTodayDateStr_(now) {
  return Utilities.formatDate(now || new Date(), TIMEZONE, 'yyyy-MM-dd');
}

function parseMinutes_(hhmm) {
  const parts = String(hhmm || '00:00').split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function getDefaultSettings_() {
  return {
    institutionName: 'SMPIT AL-MULTAZAM · Kab. Kuningan, Jawa Barat',
    examTitle: 'Penilaian Akhir Semester',
    academicYear: '2026/2027',
    sessionMode: 'auto',
    manualSessionId: 'ses-1',
    s1Name: 'Sesi 1',
    s1Start: '07:30',
    s1End: '09:30',
    s2Name: 'Sesi 2',
    s2Start: '10:00',
    s2End: '11:30'
  };
}

function readSettings_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_PENGATURAN, ['Kunci', 'Nilai']);
  const defaults = getDefaultSettings_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    const rows = Object.keys(defaults).map(function(k) { return [k, defaults[k]]; });
    sheet.getRange(2, 1, rows.length, 2).setValues(rows);
    return defaults;
  }
  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const result = Object.assign({}, defaults);
  values.forEach(function(row) {
    const key = safeStr_(row[0]).trim();
    const val = safeStr_(row[1]).trim();
    if (key && key in result && val !== '') {
      result[key] = val;
    }
  });
  return result;
}

function writeSettings_(ss, nextSettings) {
  const sheet = getOrCreateSheet_(ss, SHEET_PENGATURAN, ['Kunci', 'Nilai']);
  const current = readSettings_(ss);
  const merged = Object.assign({}, current, nextSettings);
  const keys = Object.keys(getDefaultSettings_());
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).clearContent();
  }
  const rows = keys.map(function(k) { return [k, safeStr_(merged[k])]; });
  sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  return merged;
}

function readTeachers_(ss) {
  const headers = ['ID Guru', 'Nama Guru', 'NIP', 'Mata Pelajaran', 'Kode Barcode', 'Dibuat'];
  const sheet = getOrCreateSheet_(ss, SHEET_GURU, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const list = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const id = safeStr_(r[0]).trim();
    const name = safeStr_(r[1]).trim();
    if (!id || !name) continue;
    list.push({
      id: id,
      name: name,
      nip: safeStr_(r[2]).trim(),
      subject: safeStr_(r[3]).trim(),
      barcodeCode: safeStr_(r[4]).trim(),
      createdAt: safeStr_(r[5]).trim()
    });
  }
  return list;
}

function readAttendances_(ss) {
  const headers = ['ID Catatan', 'Tanggal', 'Jam Hadir', 'Sesi', 'Nama Pengawas', 'NIP', 'Mata Pelajaran', 'Kode Barcode', 'Status', 'Perangkat', 'ID Guru', 'ID Sesi', 'Timestamp ISO'];
  const sheet = getOrCreateSheet_(ss, SHEET_REKAP, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  const list = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const id = safeStr_(r[0]).trim();
    if (!id) continue;
    let dateStr = safeStr_(r[1]).trim();
    if (r[1] instanceof Date) {
      dateStr = Utilities.formatDate(r[1], TIMEZONE, 'yyyy-MM-dd');
    }
    const iso = safeStr_(r[12]).trim() || new Date().toISOString();
    list.push({
      id: id,
      date: dateStr,
      timeDisplay: safeStr_(r[2]).trim(),
      sessionName: safeStr_(r[3]).trim(),
      teacherName: safeStr_(r[4]).trim(),
      teacherNip: safeStr_(r[5]).trim(),
      subject: safeStr_(r[6]).trim(),
      barcodeCode: safeStr_(r[7]).trim(),
      status: 'present',
      deviceType: safeStr_(r[9]).trim() || 'Kamera',
      teacherId: safeStr_(r[10]).trim(),
      sessionId: safeStr_(r[11]).trim() || 'ses-1',
      scannedAt: iso
    });
  }
  return list;
}

function buildSessions_(cfg) {
  return [
    {
      id: 'ses-1',
      name: cfg.s1Name || 'Sesi 1',
      startTime: cfg.s1Start || '07:30',
      endTime: cfg.s1End || '09:30',
      description: 'Kehadiran Pengawas Sesi Pagi (Otomatis Harian)'
    },
    {
      id: 'ses-2',
      name: cfg.s2Name || 'Sesi 2',
      startTime: cfg.s2Start || '10:00',
      endTime: cfg.s2End || '11:30',
      description: 'Kehadiran Pengawas Sesi Kedua (Otomatis Harian)'
    }
  ];
}

function resolveSession_(sessions, cfg, now) {
  if (cfg.sessionMode === 'manual') {
    const found = sessions.filter(function(s) { return s.id === cfg.manualSessionId; })[0];
    if (found) return found;
  }
  const s1 = sessions[0];
  const s2 = sessions[1];
  const hhmm = Utilities.formatDate(now || new Date(), TIMEZONE, 'HH:mm');
  const nowMin = parseMinutes_(hhmm);
  const switchMin = Math.floor((parseMinutes_(s1.endTime) + parseMinutes_(s2.startTime)) / 2);
  return nowMin >= switchMin ? s2 : s1;
}

function generateBarcodeCode_(name, existingCodesSet) {
  const cleaned = String(name || '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .trim();
  const token = (cleaned.split(/\s+/)[0] || 'GURU').slice(0, 6);
  for (let i = 0; i < 40; i++) {
    const num = Math.floor(1000 + Math.random() * 9000);
    const code = 'PGW-' + token + '-' + num;
    if (!existingCodesSet[code]) return code;
  }
  return 'PGW-' + Date.now().toString().slice(-6);
}

/**
 *Dipanggil oleh Index.html saat membuka aplikasi atau refresh berkala
 */
function getBootstrapData() {
  const ss = getSpreadsheet_();
  const cfg = readSettings_(ss);
  return {
    settings: cfg,
    sessions: buildSessions_(cfg),
    teachers: readTeachers_(ss),
    attendances: readAttendances_(ss),
    serverDate: getTodayDateStr_(new Date())
  };
}

function saveTeacher(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const teachers = readTeachers_(ss);
    const existingSet = {};
    teachers.forEach(function(t) { existingSet[t.barcodeCode.toUpperCase()] = true; });

    const name = safeStr_(payload.name).trim();
    if (!name) throw new Error('Nama guru wajib diisi.');

    let code = safeStr_(payload.barcodeCode).trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
    if (!code || existingSet[code]) {
      code = generateBarcodeCode_(name, existingSet);
    }

    const teacher = {
      id: 't-' + Utilities.getUuid().slice(0, 8),
      name: name,
      nip: safeStr_(payload.nip).trim(),
      subject: safeStr_(payload.subject).trim(),
      barcodeCode: code,
      createdAt: new Date().toISOString()
    };

    const sheet = getOrCreateSheet_(ss, SHEET_GURU, ['ID Guru', 'Nama Guru', 'NIP', 'Mata Pelajaran', 'Kode Barcode', 'Dibuat']);
    sheet.appendRow([teacher.id, teacher.name, teacher.nip, teacher.subject, teacher.barcodeCode, teacher.createdAt]);
    return getBootstrapData();
  } finally {
    lock.releaseLock();
  }
}

function saveTeachersBatch(items) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const teachers = readTeachers_(ss);
    const existingSet = {};
    teachers.forEach(function(t) { existingSet[t.barcodeCode.toUpperCase()] = true; });

    const sheet = getOrCreateSheet_(ss, SHEET_GURU, ['ID Guru', 'Nama Guru', 'NIP', 'Mata Pelajaran', 'Kode Barcode', 'Dibuat']);
    const rows = [];
    const nowIso = new Date().toISOString();

    (items || []).forEach(function(item) {
      const name = safeStr_(item.name).trim();
      if (!name) return;
      const code = generateBarcodeCode_(name, existingSet);
      existingSet[code] = true;
      rows.push([
        't-' + Utilities.getUuid().slice(0, 8),
        name,
        safeStr_(item.nip).trim(),
        safeStr_(item.subject).trim(),
        code,
        nowIso
      ]);
    });

    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
    }
    return { count: rows.length, data: getBootstrapData() };
  } finally {
    lock.releaseLock();
  }
}

function updateTeacher(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(SHEET_GURU);
    if (!sheet || sheet.getLastRow() <= 1) return getBootstrapData();
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (safeStr_(rows[i][0]).trim() === payload.id) {
        sheet.getRange(i + 2, 2, 1, 3).setValues([[
          safeStr_(payload.name).trim(),
          safeStr_(payload.nip).trim(),
          safeStr_(payload.subject).trim()
        ]]);
        break;
      }
    }
    return getBootstrapData();
  } finally {
    lock.releaseLock();
  }
}

function deleteTeacher(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(SHEET_GURU);
    if (!sheet || sheet.getLastRow() <= 1) return getBootstrapData();
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (safeStr_(ids[i]).trim() === id) {
        sheet.deleteRow(i + 2);
      }
    }
    return getBootstrapData();
  } finally {
    lock.releaseLock();
  }
}

function recordAttendanceScan(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const cfg = readSettings_(ss);
    const sessions = buildSessions_(cfg);
    const teachers = readTeachers_(ss);
    const rawCode = safeStr_(payload.barcodeCode).trim();
    const norm = rawCode.toUpperCase();

    if (!norm) {
      return { result: 'not_found', message: 'Kode barcode kosong.', barcodeCode: '' };
    }

    const teacher = teachers.filter(function(t) {
      return t.barcodeCode.toUpperCase() === norm || (t.nip && t.nip.toUpperCase() === norm);
    })[0];

    if (!teacher) {
      return {
        result: 'not_found',
        message: 'Barcode "' + rawCode + '" tidak terdaftar sebagai guru pengawas.',
        barcodeCode: rawCode
      };
    }

    const now = new Date();
    const today = getTodayDateStr_(now);
    const jam = Utilities.formatDate(now, TIMEZONE, 'HH:mm:ss');

    let session = null;
    if (payload.sessionId && payload.sessionId !== 'auto') {
      session = sessions.filter(function(s) { return s.id === payload.sessionId; })[0];
    }
    if (!session) {
      session = resolveSession_(sessions, cfg, now);
    }

    const attendances = readAttendances_(ss);
    const existing = attendances.filter(function(a) {
      return a.teacherId === teacher.id && a.sessionId === session.id && a.date === today;
    })[0];

    if (existing) {
      return {
        result: 'already_scanned',
        message: teacher.name + ' sudah tercatat hadir pada ' + session.name + '.',
        teacher: teacher,
        attendance: existing,
        barcodeCode: teacher.barcodeCode,
        data: getBootstrapData()
      };
    }

    const sessionLabel = session.name + ' (' + session.startTime + '–' + session.endTime + ')';
    const record = {
      id: 'att-' + Utilities.getUuid().slice(0, 8),
      date: today,
      timeDisplay: jam + ' WIB',
      sessionName: sessionLabel,
      teacherName: teacher.name,
      teacherNip: teacher.nip || '-',
      subject: teacher.subject || '-',
      barcodeCode: teacher.barcodeCode,
      status: 'present',
      deviceType: safeStr_(payload.deviceType).trim() || 'Kamera Perangkat',
      teacherId: teacher.id,
      sessionId: session.id,
      scannedAt: now.toISOString()
    };

    const rekapHeaders = ['ID Catatan', 'Tanggal', 'Jam Hadir', 'Sesi', 'Nama Pengawas', 'NIP', 'Mata Pelajaran', 'Kode Barcode', 'Status', 'Perangkat', 'ID Guru', 'ID Sesi', 'Timestamp ISO'];
    const sheet = getOrCreateSheet_(ss, SHEET_REKAP, rekapHeaders);
    sheet.appendRow([
      record.id,
      "'" + record.date,
      record.timeDisplay,
      record.sessionName,
      record.teacherName,
      record.teacherNip,
      record.subject,
      record.barcodeCode,
      'Hadir',
      record.deviceType,
      record.teacherId,
      record.sessionId,
      record.scannedAt
    ]);

    return {
      result: 'recorded',
      message: teacher.name + ' tercatat hadir pada ' + sessionLabel + '.',
      teacher: teacher,
      attendance: record,
      barcodeCode: teacher.barcodeCode,
      data: getBootstrapData()
    };
  } finally {
    lock.releaseLock();
  }
}

function deleteAttendance(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(SHEET_REKAP);
    if (!sheet || sheet.getLastRow() <= 1) return getBootstrapData();
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (safeStr_(ids[i]).trim() === id) {
        sheet.deleteRow(i + 2);
      }
    }
    return getBootstrapData();
  } finally {
    lock.releaseLock();
  }
}

function saveSettings(nextSettings) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    writeSettings_(ss, nextSettings || {});
    return getBootstrapData();
  } finally {
    lock.releaseLock();
  }
}

function overwriteTeachersSheet_(ss, teachers) {
  const headers = ['ID Guru', 'Nama Guru', 'NIP', 'Mata Pelajaran', 'Kode Barcode', 'Dibuat'];
  const sheet = getOrCreateSheet_(ss, SHEET_GURU, headers);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).clearContent();
  }
  const rows = (teachers || []).map(function(t) {
    return [
      safeStr_(t.id),
      safeStr_(t.name),
      safeStr_(t.nip),
      safeStr_(t.subject),
      safeStr_(t.barcodeCode),
      safeStr_(t.createdAt)
    ];
  });
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  }
}

function overwriteAttendancesSheet_(ss, attendances, teachers) {
  const headers = ['ID Catatan', 'Tanggal', 'Jam Hadir', 'Sesi', 'Nama Pengawas', 'NIP', 'Mata Pelajaran', 'Kode Barcode', 'Status', 'Perangkat', 'ID Guru', 'ID Sesi', 'Timestamp ISO'];
  const sheet = getOrCreateSheet_(ss, SHEET_REKAP, headers);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 13).clearContent();
  }
  const subjectById = {};
  (teachers || []).forEach(function(t) { subjectById[safeStr_(t.id)] = safeStr_(t.subject); });
  const rows = (attendances || []).map(function(a) {
    const dt = a.scannedAt ? new Date(a.scannedAt) : new Date();
    const jam = Utilities.formatDate(dt, TIMEZONE, 'HH:mm:ss') + ' WIB';
    return [
      safeStr_(a.id),
      "'" + safeStr_(a.date),
      jam,
      safeStr_(a.sessionName),
      safeStr_(a.teacherName),
      safeStr_(a.teacherNip) || '-',
      subjectById[safeStr_(a.teacherId)] || '-',
      safeStr_(a.barcodeCode),
      'Hadir',
      safeStr_(a.deviceType) || 'Kamera',
      safeStr_(a.teacherId),
      safeStr_(a.sessionId),
      safeStr_(a.scannedAt)
    ];
  });
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 13).setValues(rows);
  }
}

/**
 * Webhook POST opsional jika dihubungkan dari Web App eksternal (Mode Hybrid)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const action = data.action || 'ping';

    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Terhubung ke Google Sheets SMPIT AL-MULTAZAM.' })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'sync_teachers') {
      overwriteTeachersSheet_(ss, data.teachers || []);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Data guru tersinkron ke Sheets.' })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'sync_all') {
      if (data.settings) {
        writeSettings_(ss, {
          institutionName: data.settings.institutionName,
          examTitle: data.settings.examTitle,
          academicYear: data.settings.academicYear,
          sessionMode: data.settings.sessionMode,
          manualSessionId: data.settings.manualSessionId
        });
      }
      overwriteTeachersSheet_(ss, data.teachers || []);
      overwriteAttendancesSheet_(ss, data.attendances || [], data.teachers || []);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Seluruh data guru dan kehadiran tersinkron ke Google Sheets.' })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'record_attendance' && data.attendance) {
      const a = data.attendance;
      const t = data.teacher || {};
      const headers = ['ID Catatan', 'Tanggal', 'Jam Hadir', 'Sesi', 'Nama Pengawas', 'NIP', 'Mata Pelajaran', 'Kode Barcode', 'Status', 'Perangkat', 'ID Guru', 'ID Sesi', 'Timestamp ISO'];
      const sheet = getOrCreateSheet_(ss, SHEET_REKAP, headers);
      const dt = a.scannedAt ? new Date(a.scannedAt) : new Date();
      const jam = Utilities.formatDate(dt, TIMEZONE, 'HH:mm:ss') + ' WIB';
      sheet.appendRow([
        safeStr_(a.id),
        "'" + safeStr_(a.date),
        jam,
        safeStr_(a.sessionName),
        safeStr_(a.teacherName || t.name),
        safeStr_(a.teacherNip || t.nip) || '-',
        safeStr_(t.subject) || '-',
        safeStr_(a.barcodeCode),
        'Hadir',
        safeStr_(a.deviceType) || 'Kamera Perangkat',
        safeStr_(a.teacherId),
        safeStr_(a.sessionId),
        safeStr_(a.scannedAt)
      ]);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Kehadiran tercatat ke Google Sheets.' })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
