import type { ExamSession, InstitutionSettings } from '../types';

export function getTodayDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseTimeToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number.parseInt(hStr || '0', 10);
  const m = Number.parseInt(mStr || '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Automatically selects the active daily session based on current clock time:
 * - Before 09:45 (or midpoint between Session 1 end and Session 2 start): Sesi 1 (07:30 - 09:30)
 * - From 09:45 onwards: Sesi 2 (10:00 - 11:30)
 * Resets automatically every calendar day!
 */
export function resolveActiveSession(
  sessions: ExamSession[],
  settings: InstitutionSettings,
  now: Date = new Date()
): ExamSession {
  if (settings.sessionMode === 'manual') {
    const manual = sessions.find((s) => s.id === settings.manualSessionId);
    if (manual) return manual;
  }

  const s1 = sessions[0];
  const s2 = sessions[1];
  if (!s2) return s1;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const s1End = parseTimeToMinutes(s1.endTime);
  const s2Start = parseTimeToMinutes(s2.startTime);
  const switchPoint = Math.floor((s1End + s2Start) / 2);

  return currentMinutes >= switchPoint ? s2 : s1;
}
