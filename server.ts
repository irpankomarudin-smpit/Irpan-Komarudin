import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import type {
  AttendanceRecord,
  BootstrapPayload,
  ExamSession,
  InstitutionSettings,
  ScanMethod,
  Teacher,
} from './src/types.ts';
import {
  getTodayDateString,
  resolveActiveSession,
} from './src/utils/sessionSchedule.ts';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'lms-attendance.json');

function getDefaultSessions(): ExamSession[] {
  return [
    {
      id: 'ses-1',
      name: 'Sesi 1',
      startTime: '07:30',
      endTime: '09:30',
      description: 'Kehadiran Pengawas Sesi Pagi (Otomatis Harian)',
    },
    {
      id: 'ses-2',
      name: 'Sesi 2',
      startTime: '10:00',
      endTime: '11:30',
      description: 'Kehadiran Pengawas Sesi Kedua (Otomatis Harian)',
    },
  ];
}

function getDefaultData(): BootstrapPayload {
  return {
    settings: {
      institutionName: 'SMPIT AL-MULTAZAM · Kab. Kuningan, Jawa Barat',
      examTitle: 'Penilaian Akhir Semester',
      academicYear: '2026/2027',
      scanCooldownSeconds: 15,
      sessionMode: 'auto',
      manualSessionId: 'ses-1',
    },
    teachers: [],
    sessions: getDefaultSessions(),
    attendances: [],
  };
}

let dbState: BootstrapPayload = getDefaultData();
let writeChain: Promise<void> = Promise.resolve();

async function loadDatabase(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<BootstrapPayload>;
    const defaults = getDefaultData();

    const rawSettings = parsed.settings as Partial<InstitutionSettings> | undefined;
    const isOldPlaceholder =
      !rawSettings?.institutionName ||
      rawSettings.institutionName === 'Sekolah / Madrasah Pelaksana Ujian' ||
      rawSettings.institutionName === 'SMPIT Ponpes Terpadu Al-Multazam';

    const migratedSettings: InstitutionSettings = {
      institutionName: isOldPlaceholder
        ? defaults.settings.institutionName
        : rawSettings.institutionName!,
      examTitle: rawSettings?.examTitle || defaults.settings.examTitle,
      academicYear: rawSettings?.academicYear || defaults.settings.academicYear,
      scanCooldownSeconds:
        typeof rawSettings?.scanCooldownSeconds === 'number'
          ? rawSettings.scanCooldownSeconds
          : defaults.settings.scanCooldownSeconds,
      sessionMode:
        rawSettings?.sessionMode === 'manual' ? 'manual' : 'auto',
      manualSessionId: rawSettings?.manualSessionId || 'ses-1',
      appsScriptWebhookUrl:
        typeof rawSettings?.appsScriptWebhookUrl === 'string'
          ? rawSettings.appsScriptWebhookUrl.trim()
          : '',
      lastSheetsSyncAt: rawSettings?.lastSheetsSyncAt || '',
      lastSheetsSyncStatus: rawSettings?.lastSheetsSyncStatus || '',
    };

    const migratedTeachers: Teacher[] = Array.isArray(parsed.teachers)
      ? parsed.teachers.map((t) => ({
          id: t.id,
          name: t.name,
          nip: t.nip || '',
          subject: t.subject || '',
          barcodeCode: t.barcodeCode,
          createdAt: t.createdAt || new Date().toISOString(),
        }))
      : [];

    const existingSessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    const s1 = existingSessions.find((s) => s.id === 'ses-1');
    const s2 = existingSessions.find((s) => s.id === 'ses-2');
    const migratedSessions: ExamSession[] = [
      {
        id: 'ses-1',
        name: s1?.name && s1.name !== 'Sesi 1 — Pagi' ? s1.name : 'Sesi 1',
        startTime: s1?.startTime || '07:30',
        endTime: s1?.endTime || '09:30',
        description:
          s1?.description && s1.description !== 'Ujian Ruang Utama'
            ? s1.description
            : 'Kehadiran Pengawas Sesi Pagi (Otomatis Harian)',
      },
      {
        id: 'ses-2',
        name: s2?.name && s2.name !== 'Sesi 2 — Siang' ? s2.name : 'Sesi 2',
        startTime: s2?.startTime || '10:00',
        endTime: s2?.endTime && s2.endTime !== '12:00' ? s2.endTime : '11:30',
        description:
          s2?.description && s2.description !== 'Ujian Sesi Lanjutan'
            ? s2.description
            : 'Kehadiran Pengawas Sesi Kedua (Otomatis Harian)',
      },
    ];

    const migratedAttendances: AttendanceRecord[] = Array.isArray(parsed.attendances)
      ? parsed.attendances.map((a) => ({
          id: a.id,
          teacherId: a.teacherId,
          teacherName: a.teacherName,
          teacherNip: a.teacherNip || '',
          barcodeCode: a.barcodeCode,
          sessionId: a.sessionId === 'ses-2' ? 'ses-2' : 'ses-1',
          sessionName: a.sessionId === 'ses-2' ? migratedSessions[1].name : migratedSessions[0].name,
          scannedAt: a.scannedAt,
          date: a.date,
          status: 'present',
          deviceType: a.deviceType || 'Kamera Perangkat',
          scanMethod: a.scanMethod || 'camera',
        }))
      : [];

    dbState = {
      settings: migratedSettings,
      teachers: migratedTeachers,
      sessions: migratedSessions,
      attendances: migratedAttendances,
    };
    await persistDatabase();
  } catch {
    dbState = getDefaultData();
    await persistDatabase();
  }
}

function persistDatabase(): Promise<void> {
  const snapshot = JSON.stringify(dbState, null, 2);
  writeChain = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmpFile = `${DB_FILE}.tmp`;
    await fs.writeFile(tmpFile, snapshot, 'utf-8');
    await fs.rename(tmpFile, DB_FILE);
  });
  return writeChain;
}

function generateUniqueBarcodeCode(name: string, existingCodes: Set<string>): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .trim();

  const firstToken = (cleaned.split(/\s+/)[0] || 'GURU').slice(0, 6);
  for (let i = 0; i < 30; i += 1) {
    const suffix = crypto.randomInt(1000, 9999);
    const candidate = `PGW-${firstToken}-${suffix}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `PGW-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

const sseClients = new Set<Response>();

function broadcastEvent(event: string, payload: unknown): void {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

function isValidAppsScriptUrl(url: string): boolean {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/.test(
    url.trim()
  );
}

async function pushToAppsScript(
  webhookUrl: string,
  payload: unknown
): Promise<{ ok: boolean; message: string }> {
  const target = webhookUrl.trim();
  if (!target) {
    return { ok: false, message: 'URL Web App Apps Script belum diisi.' };
  }
  if (!isValidAppsScriptUrl(target)) {
    return {
      ok: false,
      message:
        'Format URL harus diawali https://script.google.com/macros/s/.../exec',
    };
  }

  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    const text = await response.text();
    try {
      const json = JSON.parse(text) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (json.ok === false) {
        return {
          ok: false,
          message: json.error || 'Apps Script mengembalikan galat.',
        };
      }
      return {
        ok: true,
        message: json.message || 'Berhasil tersinkronisasi ke Google Sheets.',
      };
    } catch {
      if (response.ok) {
        return {
          ok: true,
          message: 'Permintaan terkirim ke Google Apps Script.',
        };
      }
      return {
        ok: false,
        message: `Apps Script merespons status ${response.status}.`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? `Gagal menghubungi Apps Script: ${err.message}`
          : 'Gagal menghubungi Apps Script.',
    };
  }
}

function triggerBackgroundAppsScriptSync(payload: unknown): void {
  const url = dbState.settings.appsScriptWebhookUrl?.trim();
  if (!url) return;
  void pushToAppsScript(url, payload).then(async (res) => {
    dbState.settings.lastSheetsSyncAt = new Date().toISOString();
    dbState.settings.lastSheetsSyncStatus = res.ok
      ? 'Tersinkron ke Google Sheets'
      : res.message;
    await persistDatabase();
    broadcastEvent('sync', dbState);
  });
}

async function startServer(): Promise<void> {
  await loadDatabase();

  const app = express();
  const httpServer = http.createServer(app);
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(*)');
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  app.get('/api/bootstrap', (_req: Request, res: Response) => {
    res.json(dbState);
  });

  app.put('/api/settings', async (req: Request, res: Response) => {
    const body = req.body as Partial<InstitutionSettings>;
    dbState.settings = {
      institutionName:
        typeof body.institutionName === 'string' && body.institutionName.trim()
          ? body.institutionName.trim().slice(0, 120)
          : dbState.settings.institutionName,
      examTitle:
        typeof body.examTitle === 'string' && body.examTitle.trim()
          ? body.examTitle.trim().slice(0, 120)
          : dbState.settings.examTitle,
      academicYear:
        typeof body.academicYear === 'string' && body.academicYear.trim()
          ? body.academicYear.trim().slice(0, 30)
          : dbState.settings.academicYear,
      scanCooldownSeconds:
        typeof body.scanCooldownSeconds === 'number' && body.scanCooldownSeconds >= 3
          ? Math.min(300, Math.round(body.scanCooldownSeconds))
          : dbState.settings.scanCooldownSeconds,
      sessionMode:
        body.sessionMode === 'manual'
          ? 'manual'
          : body.sessionMode === 'auto'
            ? 'auto'
            : dbState.settings.sessionMode,
      manualSessionId:
        typeof body.manualSessionId === 'string' && body.manualSessionId.trim()
          ? body.manualSessionId.trim()
          : dbState.settings.manualSessionId,
      appsScriptWebhookUrl:
        typeof body.appsScriptWebhookUrl === 'string'
          ? body.appsScriptWebhookUrl.trim().slice(0, 300)
          : dbState.settings.appsScriptWebhookUrl || '',
      lastSheetsSyncAt: dbState.settings.lastSheetsSyncAt || '',
      lastSheetsSyncStatus: dbState.settings.lastSheetsSyncStatus || '',
    };
    await persistDatabase();
    broadcastEvent('sync', dbState);
    res.json(dbState.settings);
  });

  app.post('/api/integrations/apps-script/test', async (req: Request, res: Response) => {
    const body = req.body as { webhookUrl?: string };
    const url =
      typeof body.webhookUrl === 'string' && body.webhookUrl.trim()
        ? body.webhookUrl.trim()
        : dbState.settings.appsScriptWebhookUrl || '';
    const result = await pushToAppsScript(url, { action: 'ping' });
    if (result.ok) {
      dbState.settings.appsScriptWebhookUrl = url;
      dbState.settings.lastSheetsSyncAt = new Date().toISOString();
      dbState.settings.lastSheetsSyncStatus = result.message;
      await persistDatabase();
      broadcastEvent('sync', dbState);
    }
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post('/api/integrations/apps-script/sync-all', async (req: Request, res: Response) => {
    const body = req.body as { webhookUrl?: string };
    const url =
      typeof body.webhookUrl === 'string' && body.webhookUrl.trim()
        ? body.webhookUrl.trim()
        : dbState.settings.appsScriptWebhookUrl || '';
    const result = await pushToAppsScript(url, {
      action: 'sync_all',
      settings: dbState.settings,
      teachers: dbState.teachers,
      attendances: dbState.attendances,
    });
    if (result.ok) {
      dbState.settings.appsScriptWebhookUrl = url;
      dbState.settings.lastSheetsSyncAt = new Date().toISOString();
      dbState.settings.lastSheetsSyncStatus = result.message;
      await persistDatabase();
      broadcastEvent('sync', dbState);
    }
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post('/api/teachers', async (req: Request, res: Response) => {
    const body = req.body as Partial<Teacher>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Nama guru wajib diisi.' });
      return;
    }

    const existingCodes = new Set(dbState.teachers.map((t) => t.barcodeCode.toUpperCase()));
    const requestedCode =
      typeof body.barcodeCode === 'string'
        ? body.barcodeCode.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '')
        : '';

    const barcodeCode =
      requestedCode && !existingCodes.has(requestedCode)
        ? requestedCode
        : generateUniqueBarcodeCode(name, existingCodes);

    const teacher: Teacher = {
      id: `t-${crypto.randomUUID().slice(0, 8)}`,
      name: name.slice(0, 120),
      nip: typeof body.nip === 'string' ? body.nip.trim().slice(0, 40) : '',
      subject: typeof body.subject === 'string' ? body.subject.trim().slice(0, 80) : '',
      barcodeCode,
      createdAt: new Date().toISOString(),
    };

    dbState.teachers = [teacher, ...dbState.teachers];
    await persistDatabase();
    broadcastEvent('sync', dbState);
    triggerBackgroundAppsScriptSync({
      action: 'sync_teachers',
      teachers: dbState.teachers,
    });
    res.status(201).json(teacher);
  });

  app.post('/api/teachers/batch', async (req: Request, res: Response) => {
    const body = req.body as {
      items?: Array<{ name: string; nip?: string; subject?: string }>;
    };
    const items = Array.isArray(body.items) ? body.items : [];
    const existingCodes = new Set(dbState.teachers.map((t) => t.barcodeCode.toUpperCase()));
    const created: Teacher[] = [];

    for (const item of items) {
      const name = typeof item?.name === 'string' ? item.name.trim() : '';
      if (!name) continue;
      const barcodeCode = generateUniqueBarcodeCode(name, existingCodes);
      existingCodes.add(barcodeCode);
      created.push({
        id: `t-${crypto.randomUUID().slice(0, 8)}`,
        name: name.slice(0, 120),
        nip: typeof item.nip === 'string' ? item.nip.trim().slice(0, 40) : '',
        subject: typeof item.subject === 'string' ? item.subject.trim().slice(0, 80) : '',
        barcodeCode,
        createdAt: new Date().toISOString(),
      });
    }

    if (created.length === 0) {
      res.status(400).json({ error: 'Tidak ada nama guru valid untuk ditambahkan.' });
      return;
    }

    dbState.teachers = [...created, ...dbState.teachers];
    await persistDatabase();
    broadcastEvent('sync', dbState);
    triggerBackgroundAppsScriptSync({
      action: 'sync_teachers',
      teachers: dbState.teachers,
    });
    res.status(201).json({ count: created.length, teachers: created });
  });

  app.put('/api/teachers/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const index = dbState.teachers.findIndex((t) => t.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Data pengawas tidak ditemukan.' });
      return;
    }

    const body = req.body as Partial<Teacher>;
    const current = dbState.teachers[index];
    const updated: Teacher = {
      ...current,
      name:
        typeof body.name === 'string' && body.name.trim()
          ? body.name.trim().slice(0, 120)
          : current.name,
      nip: typeof body.nip === 'string' ? body.nip.trim().slice(0, 40) : current.nip,
      subject:
        typeof body.subject === 'string' ? body.subject.trim().slice(0, 80) : current.subject,
    };

    dbState.teachers[index] = updated;
    await persistDatabase();
    broadcastEvent('sync', dbState);
    triggerBackgroundAppsScriptSync({
      action: 'sync_teachers',
      teachers: dbState.teachers,
    });
    res.json(updated);
  });

  app.delete('/api/teachers/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const before = dbState.teachers.length;
    dbState.teachers = dbState.teachers.filter((t) => t.id !== id);
    if (dbState.teachers.length === before) {
      res.status(404).json({ error: 'Data pengawas tidak ditemukan.' });
      return;
    }
    await persistDatabase();
    broadcastEvent('sync', dbState);
    triggerBackgroundAppsScriptSync({
      action: 'sync_teachers',
      teachers: dbState.teachers,
    });
    res.json({ ok: true });
  });

  app.put('/api/sessions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const index = dbState.sessions.findIndex((s) => s.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Sesi ujian tidak ditemukan.' });
      return;
    }

    const body = req.body as Partial<ExamSession>;
    const current = dbState.sessions[index];
    const updated: ExamSession = {
      ...current,
      name:
        typeof body.name === 'string' && body.name.trim()
          ? body.name.trim().slice(0, 80)
          : current.name,
      startTime:
        typeof body.startTime === 'string' && /^\d{2}:\d{2}$/.test(body.startTime)
          ? body.startTime
          : current.startTime,
      endTime:
        typeof body.endTime === 'string' && /^\d{2}:\d{2}$/.test(body.endTime)
          ? body.endTime
          : current.endTime,
      description:
        typeof body.description === 'string'
          ? body.description.trim().slice(0, 120)
          : current.description,
    };

    dbState.sessions[index] = updated;
    await persistDatabase();
    broadcastEvent('sync', dbState);
    res.json(updated);
  });

  app.post('/api/attendance/scan', async (req: Request, res: Response) => {
    const body = req.body as {
      barcodeCode?: string;
      sessionId?: string;
      deviceType?: string;
      scanMethod?: ScanMethod;
    };

    const rawCode = typeof body.barcodeCode === 'string' ? body.barcodeCode.trim() : '';
    const normalized = rawCode.toUpperCase();
    if (!normalized) {
      res.status(400).json({
        result: 'not_found',
        message: 'Kode barcode kosong atau tidak terbaca.',
        barcodeCode: '',
      });
      return;
    }

    const teacher = dbState.teachers.find(
      (t) =>
        t.barcodeCode.toUpperCase() === normalized ||
        (t.nip && t.nip.toUpperCase() === normalized)
    );

    if (!teacher) {
      res.status(404).json({
        result: 'not_found',
        message: `Barcode "${rawCode}" tidak terdaftar sebagai guru pengawas.`,
        barcodeCode: rawCode,
      });
      return;
    }

    const now = new Date();
    const today = getTodayDateString(now);

    const session =
      (body.sessionId && body.sessionId !== 'auto'
        ? dbState.sessions.find((s) => s.id === body.sessionId)
        : undefined) || resolveActiveSession(dbState.sessions, dbState.settings, now);

    const existing = dbState.attendances.find(
      (a) =>
        a.teacherId === teacher.id &&
        a.sessionId === session.id &&
        a.date === today
    );

    if (existing) {
      res.json({
        result: 'already_scanned',
        message: `${teacher.name} sudah tercatat hadir pada ${session.name} (${session.startTime}–${session.endTime}).`,
        teacher,
        attendance: existing,
        barcodeCode: teacher.barcodeCode,
      });
      return;
    }

    const record: AttendanceRecord = {
      id: `att-${crypto.randomUUID().slice(0, 8)}`,
      teacherId: teacher.id,
      teacherName: teacher.name,
      teacherNip: teacher.nip,
      barcodeCode: teacher.barcodeCode,
      sessionId: session.id,
      sessionName: `${session.name} (${session.startTime}–${session.endTime})`,
      scannedAt: now.toISOString(),
      date: today,
      status: 'present',
      deviceType:
        typeof body.deviceType === 'string' && body.deviceType.trim()
          ? body.deviceType.trim().slice(0, 40)
          : 'Kamera Perangkat',
      scanMethod: body.scanMethod || 'camera',
    };

    dbState.attendances = [record, ...dbState.attendances];
    await persistDatabase();
    broadcastEvent('sync', dbState);
    broadcastEvent('attendance_recorded', { teacher, attendance: record });
    triggerBackgroundAppsScriptSync({
      action: 'record_attendance',
      teacher,
      attendance: record,
    });

    res.status(201).json({
      result: 'recorded',
      message: `${teacher.name} tercatat hadir pada ${session.name} (${session.startTime}–${session.endTime}).`,
      teacher,
      attendance: record,
      barcodeCode: teacher.barcodeCode,
    });
  });

  app.delete('/api/attendance/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const before = dbState.attendances.length;
    dbState.attendances = dbState.attendances.filter((a) => a.id !== id);
    if (dbState.attendances.length === before) {
      res.status(404).json({ error: 'Catatan kehadiran tidak ditemukan.' });
      return;
    }
    await persistDatabase();
    broadcastEvent('sync', dbState);
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Sipanwas server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Sipanwas server:', err);
  process.exit(1);
});
