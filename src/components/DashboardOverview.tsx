import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  QrCode,
  Users,
} from 'lucide-react';
import type {
  AttendanceRecord,
  ExamSession,
  InstitutionSettings,
  Teacher,
} from '../types';
import {
  getTodayDateString,
  resolveActiveSession,
} from '../utils/sessionSchedule';
import {
  HeroCardAccentLeft,
  HeroCardAccentRight,
} from './AlMultazamBrand';

interface DashboardOverviewProps {
  settings: InstitutionSettings;
  teachers: Teacher[];
  sessions: ExamSession[];
  attendances: AttendanceRecord[];
  onNavigate: (tab: 'kiosk' | 'teachers' | 'sessions' | 'report') => void;
}

export function DashboardOverview({
  settings,
  teachers,
  sessions,
  attendances,
  onNavigate,
}: DashboardOverviewProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const todayStr = useMemo(() => getTodayDateString(now), [now]);

  const activeSession = useMemo(
    () => resolveActiveSession(sessions, settings, now),
    [sessions, settings, now]
  );

  const todayAllAttendances = useMemo(
    () => attendances.filter((a) => a.date === todayStr),
    [attendances, todayStr]
  );

  const sessionAttendances = useMemo(
    () => todayAllAttendances.filter((a) => a.sessionId === activeSession?.id),
    [todayAllAttendances, activeSession]
  );

  const s1Count = useMemo(
    () => todayAllAttendances.filter((a) => a.sessionId === 'ses-1').length,
    [todayAllAttendances]
  );

  const s2Count = useMemo(
    () => todayAllAttendances.filter((a) => a.sessionId === 'ses-2').length,
    [todayAllAttendances]
  );

  const attendedTeacherIds = useMemo(
    () => new Set(sessionAttendances.map((a) => a.teacherId)),
    [sessionAttendances]
  );

  const absentTeachers = useMemo(
    () => teachers.filter((t) => !attendedTeacherIds.has(t.id)),
    [teachers, attendedTeacherIds]
  );

  const attendancePct =
    teachers.length > 0
      ? Math.round((sessionAttendances.length / teachers.length) * 100)
      : 0;

  const todayFormatted = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Hero Banner Card matching uploaded design */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm">
        <HeroCardAccentLeft />
        <HeroCardAccentRight />

        <div className="relative z-10 flex flex-col justify-between gap-5 py-6 pl-24 pr-6 sm:flex-row sm:items-center sm:pl-28 sm:pr-8">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-600">
              {settings.institutionName} · Tahun Ajaran {settings.academicYear}
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {settings.examTitle}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <Clock className="h-4 w-4 shrink-0 text-[#156235]" />
              <span>
                Sesi aktif saat ini:{' '}
                <strong className="font-semibold text-[#156235]">
                  {activeSession.name} ({activeSession.startTime}–{activeSession.endTime} WIB)
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="text-xs text-slate-500">{todayFormatted}</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2.5 sm:items-stretch">
            <button
              type="button"
              onClick={() => onNavigate('teachers')}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#156235]/30 bg-white px-5 py-2.5 text-xs font-semibold text-[#156235] shadow-xs transition-colors hover:bg-emerald-50 whitespace-nowrap min-h-[40px]"
            >
              <QrCode className="h-4 w-4" />
              <span>Buat Barcode Guru</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('kiosk')}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#156235] to-[#1E7E45] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-95 whitespace-nowrap min-h-[40px]"
            >
              <Camera className="h-4 w-4" />
              <span>Buka Pemindai Kamera</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2x2 KPI Cards Grid matching uploaded layout */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Card 1: Total Pengawas */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#156235]">
                <Users className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Total Pengawas Terdaftar
                </p>
                <p className="mt-1 font-display text-3xl font-extrabold tabular-nums text-[#156235]">
                  {teachers.length}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#156235]" />
                  <span>Setiap guru memiliki barcode unik</span>
                </p>
              </div>
            </div>
            <Users className="h-5 w-5 text-[#156235]/60" />
          </div>
        </div>

        {/* Card 2: Sudah Hadir (Sesi Aktif) */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#156235]">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Sudah Hadir ({activeSession.name})
                </p>
                <p className="mt-1 font-display text-3xl font-extrabold tabular-nums text-[#156235]">
                  {sessionAttendances.length}{' '}
                  <span className="text-xl font-bold text-emerald-700">
                    ({attendancePct}%)
                  </span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5 text-[#156235]" />
                  <span>
                    Jadwal {activeSession.startTime}–{activeSession.endTime} WIB
                  </span>
                </p>
              </div>
            </div>
            <CheckCircle2 className="h-5 w-5 text-[#156235]/60" />
          </div>
        </div>

        {/* Card 3: Ringkasan 2 Sesi Hari Ini */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <Clock className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Kehadiran Harian (Sesi 1 &amp; Sesi 2)
                </p>
                <p className="mt-1 font-display text-3xl font-extrabold tabular-nums text-amber-600">
                  {todayAllAttendances.length}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Sesi 1: <strong className="font-mono text-slate-700">{s1Count}</strong> hadir
                  <span aria-hidden="true" className="mx-1.5">·</span>
                  Sesi 2: <strong className="font-mono text-slate-700">{s2Count}</strong> hadir
                </p>
              </div>
            </div>
            <Clock className="h-5 w-5 text-amber-500/70" />
          </div>
        </div>

        {/* Card 4: Belum Memindai Barcode */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <CameraOff className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Belum Memindai Barcode
                </p>
                <p className="mt-1 font-display text-3xl font-extrabold tabular-nums text-slate-900">
                  {absentTeachers.length}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Menunggu scan kamera perangkat ({activeSession.name})
                </p>
              </div>
            </div>
            <CameraOff className="h-5 w-5 text-slate-400" />
          </div>
        </div>
      </section>

      {/* Bottom Two-Column Panels matching uploaded design */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Recent Check-Ins */}
        <section className="rounded-2xl border border-emerald-900/10 bg-white shadow-xs lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#156235] text-white">
                <FileText className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Log Kehadiran Terbaru
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('report')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#156235] hover:underline"
            >
              <span>Lihat Semua Rekap</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {todayAllAttendances.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                Belum ada pengawas yang memindai barcode hari ini
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Buka Pemindai Kamera pada HP, iPad, Laptop, atau Google TV untuk mencatat kehadiran.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-emerald-50/40 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-2.5">Nama Pengawas</th>
                    <th className="px-4 py-2.5">Sesi</th>
                    <th className="px-4 py-2.5">Perangkat</th>
                    <th className="px-5 py-2.5 text-right">Waktu Hadir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todayAllAttendances.slice(0, 7).map((log) => (
                    <tr key={log.id} className="hover:bg-emerald-50/30">
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        {log.teacherName}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-[#156235]">
                        {log.sessionName}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {log.deviceType}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-800">
                        {new Date(log.scannedAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        WIB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Pending Proctors */}
        <section className="rounded-2xl border border-emerald-900/10 bg-white shadow-xs lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-[#156235]">
                <Users className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Belum Hadir ({absentTeachers.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('teachers')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#156235] hover:underline"
            >
              <span>Kelola Guru</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {teachers.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                Data guru masih kosong
              </p>
              <button
                type="button"
                onClick={() => onNavigate('teachers')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#156235] px-4 py-2 text-xs font-semibold text-white hover:bg-[#11502b]"
              >
                Tambah Guru Pertama
              </button>
            </div>
          ) : absentTeachers.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-[#156235]" />
              <p className="mt-2 text-sm font-semibold text-slate-800">
                Seluruh pengawas telah hadir pada {activeSession.name}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {absentTeachers.slice(0, 7).map((teacher) => (
                <li
                  key={teacher.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {teacher.name}
                    </p>
                    {teacher.subject && (
                      <p className="truncate text-xs text-slate-500">
                        {teacher.subject}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-xs text-slate-500">
                    {teacher.barcodeCode}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
