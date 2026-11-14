import { useMemo, useState } from 'react';
import { Download, Printer, Search, Trash2 } from 'lucide-react';
import type {
  AttendanceRecord,
  ExamSession,
  InstitutionSettings,
  Teacher,
} from '../types';
import { getTodayDateString } from '../utils/sessionSchedule';

interface AttendanceReportProps {
  settings: InstitutionSettings;
  teachers: Teacher[];
  sessions: ExamSession[];
  attendances: AttendanceRecord[];
  onRefresh: () => Promise<void>;
}

export function AttendanceReport({
  settings,
  teachers,
  sessions,
  attendances,
  onRefresh,
}: AttendanceReportProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getTodayDateString()
  );
  const [showAllDates, setShowAllDates] = useState<boolean>(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'present' | 'absent'>(
    'present'
  );
  const [search, setSearch] = useState('');

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attendances.filter((a) => {
      if (!showAllDates && selectedDate && a.date !== selectedDate) {
        return false;
      }
      if (selectedSessionId !== 'all' && a.sessionId !== selectedSessionId) {
        return false;
      }
      if (q) {
        return (
          a.teacherName.toLowerCase().includes(q) ||
          a.barcodeCode.toLowerCase().includes(q) ||
          a.sessionName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [attendances, showAllDates, selectedDate, selectedSessionId, search]);

  const absentList = useMemo(() => {
    const targetSessionId =
      selectedSessionId === 'all' ? sessions[0]?.id : selectedSessionId;
    const targetDate = selectedDate || getTodayDateString();

    const attendedIds = new Set(
      attendances
        .filter((a) => {
          if (a.date !== targetDate) return false;
          if (selectedSessionId !== 'all' && a.sessionId !== targetSessionId) {
            return false;
          }
          return true;
        })
        .map((a) => a.teacherId)
    );

    const q = search.trim().toLowerCase();
    return teachers.filter((t) => {
      if (attendedIds.has(t.id)) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.barcodeCode.toLowerCase().includes(q)
      );
    });
  }, [teachers, attendances, selectedSessionId, sessions, selectedDate, search]);

  const handleExportCsv = () => {
    const headers = [
      'Nama Pengawas',
      'NIP',
      'Kode Barcode',
      'Sesi',
      'Tanggal',
      'Waktu Hadir',
      'Status',
      'Perangkat',
    ];
    const rows = filteredLogs.map((a) => [
      `"${a.teacherName.replace(/"/g, '""')}"`,
      `"${a.teacherNip || '-'}"`,
      `"${a.barcodeCode}"`,
      `"${a.sessionName.replace(/"/g, '""')}"`,
      a.date,
      new Date(a.scannedAt).toLocaleTimeString('id-ID'),
      'Hadir',
      `"${a.deviceType}"`,
    ]);
    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rekap-kehadiran-pengawas-${selectedDate || 'semua'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteLog = async (id: string) => {
    await fetch(`/api/attendance/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Print Header */}
      <div className="hidden print:flex items-center gap-3 border-b-2 border-[#156235] pb-3">
        <img
          src="/assets/logo-smpit-almultazam.png"
          alt="Logo SMPIT AL-MULTAZAM"
          className="h-12 w-12 object-contain"
        />
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            LMS Pengawas Ujian SMPIT AL-MULTAZAM — Rekap Kehadiran
          </h1>
          <p className="text-xs text-slate-600">
            {settings.institutionName} · {settings.examTitle} · Tahun Ajaran {settings.academicYear}
            {!showAllDates && selectedDate ? ` · Tanggal ${selectedDate}` : ''}
          </p>
        </div>
      </div>

      {/* Filters & Export Toolbar */}
      <section className="no-print flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama guru..."
              className="w-48 rounded-full border border-slate-300 py-2 pl-9 pr-3 text-xs focus:border-[#156235] focus:outline-none"
            />
          </div>

          <input
            type="date"
            value={selectedDate}
            disabled={showAllDates}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-full border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-700 focus:border-[#156235] focus:outline-none disabled:opacity-50"
          />

          <button
            type="button"
            onClick={() => setShowAllDates((v) => !v)}
            className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              showAllDates
                ? 'border-[#156235] bg-[#156235] text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Semua Tanggal
          </button>

          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#156235] focus:outline-none"
          >
            <option value="all">Semua Sesi</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.startTime}–{s.endTime})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-full bg-emerald-50 p-1">
            <button
              type="button"
              onClick={() => setStatusFilter('present')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                statusFilter === 'present'
                  ? 'bg-[#156235] text-white'
                  : 'text-[#156235] hover:bg-emerald-100/70'
              }`}
            >
              Sudah Hadir
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('absent')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                statusFilter === 'absent'
                  ? 'bg-[#156235] text-white'
                  : 'text-[#156235] hover:bg-emerald-100/70'
              }`}
            >
              Belum Hadir
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#156235]/30 bg-white px-4 py-2 text-xs font-semibold text-[#156235] hover:bg-emerald-50 disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Unduh CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#156235] px-4 py-2 text-xs font-semibold text-white hover:bg-[#11502b] whitespace-nowrap"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </section>

      {/* Table Output */}
      <section className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-xs">
        {statusFilter === 'absent' ? (
          absentList.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Semua pengawas terdaftar sudah melakukan tanda kehadiran.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-emerald-50/50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-6 py-3">Nama Pengawas</th>
                    <th className="px-4 py-3">NIP</th>
                    <th className="px-4 py-3">Kode Barcode</th>
                    <th className="px-6 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {absentList.map((t) => (
                    <tr key={t.id}>
                      <td className="px-6 py-3 font-semibold text-slate-900">
                        {t.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {t.nip || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {t.barcodeCode}
                      </td>
                      <td className="px-6 py-3 text-right text-xs font-semibold text-slate-500">
                        Belum Hadir
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filteredLogs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            Belum ada catatan kehadiran pengawas yang sesuai filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-emerald-50/50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-6 py-3">Nama Pengawas</th>
                  <th className="px-4 py-3">Sesi</th>
                  <th className="px-4 py-3">Tanggal &amp; Waktu</th>
                  <th className="px-4 py-3">Perangkat</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="no-print px-6 py-3 text-right">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-emerald-50/30">
                    <td className="px-6 py-3">
                      <div className="font-semibold text-slate-900">
                        {log.teacherName}
                      </div>
                      <div className="font-mono text-xs text-slate-500">
                        {log.barcodeCode}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-[#156235]">
                      {log.sessionName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700">
                      {log.date}{' '}
                      {new Date(log.scannedAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {log.deviceType}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-[#156235]">
                      Hadir
                    </td>
                    <td className="no-print px-6 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteLog(log.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Hapus catatan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
