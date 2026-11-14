import { useState } from 'react';
import { CalendarClock, CheckCircle2, Clock, Save } from 'lucide-react';
import type { ExamSession, InstitutionSettings } from '../types';
import { resolveActiveSession } from '../utils/sessionSchedule';

interface SessionsManagerProps {
  settings: InstitutionSettings;
  sessions: ExamSession[];
  onRefresh: () => Promise<void>;
}

export function SessionsManager({
  settings,
  sessions,
  onRefresh,
}: SessionsManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const currentAutoSession = resolveActiveSession(sessions, settings);

  const handleModeChange = async (
    sessionMode: 'auto' | 'manual',
    manualSessionId?: string
  ) => {
    setIsSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionMode,
          ...(manualSessionId ? { manualSessionId } : {}),
        }),
      });
      await onRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (s: ExamSession) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditStart(s.startTime);
    setEditEnd(s.endTime);
    setEditDesc(s.description);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    setIsSaving(true);
    try {
      await fetch(`/api/sessions/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          startTime: editStart,
          endTime: editEnd,
          description: editDesc.trim(),
        }),
      });
      setEditingId(null);
      await onRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Automatic Daily Schedule Explanation & Mode Toggle */}
      <section className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Jadwal Sesi Absensi Harian Otomatis
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Absensi pengawas berjalan otomatis setiap hari tanpa perlu membuat ulang jadwal. Pergantian hari mereset presensi harian secara otomatis sambil menyimpan riwayat hari sebelumnya.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-full bg-emerald-50 p-1.5 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleModeChange('auto')}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                settings.sessionMode === 'auto'
                  ? 'bg-[#156235] text-white'
                  : 'text-[#156235] hover:bg-emerald-100/70'
              }`}
            >
              Otomatis Sesuai Jam
            </button>
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={isSaving}
                onClick={() => handleModeChange('manual', s.id)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  settings.sessionMode === 'manual' &&
                  settings.manualSessionId === s.id
                    ? 'bg-[#156235] text-white'
                    : 'text-[#156235] hover:bg-emerald-100/70'
                }`}
              >
                Kunci {s.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Two Daily Sessions Grid */}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {sessions.map((session) => {
          const isCurrentlyActive = currentAutoSession.id === session.id;
          const isEditing = editingId === session.id;

          return (
            <article
              key={session.id}
              className={`rounded-2xl border bg-white p-6 shadow-xs ${
                isCurrentlyActive
                  ? 'border-[#156235] ring-1 ring-[#156235]/20'
                  : 'border-emerald-900/10'
              }`}
            >
              {!isEditing ? (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full ${
                          isCurrentlyActive
                            ? 'bg-[#156235] text-white'
                            : 'bg-emerald-50 text-[#156235]'
                        }`}
                      >
                        <CalendarClock className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-display text-xl font-bold text-slate-900">
                          {session.name}
                        </h3>
                        <p className="font-mono text-sm font-semibold text-[#156235] tabular-nums">
                          {session.startTime} – {session.endTime} WIB
                        </p>
                      </div>
                    </div>

                    {isCurrentlyActive && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#156235]">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Sedang Aktif</span>
                      </span>
                    )}
                  </div>

                  <p className="mt-4 text-sm text-slate-600">
                    {session.description}
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Berulang otomatis setiap hari</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(session)}
                      className="rounded-full border border-[#156235]/30 px-4 py-1.5 text-xs font-semibold text-[#156235] hover:bg-emerald-50"
                    >
                      Ubah Jam Sesi
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveSession} className="flex flex-col gap-3.5">
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Jadwal {session.name}
                  </h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Nama Sesi
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#156235] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Jam Mulai
                      </label>
                      <input
                        type="time"
                        required
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm focus:border-[#156235] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Jam Selesai
                      </label>
                      <input
                        type="time"
                        required
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm focus:border-[#156235] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Keterangan
                    </label>
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#156235] focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#156235] px-4 py-2 text-xs font-semibold text-white hover:bg-[#11502b]"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>Simpan</span>
                    </button>
                  </div>
                </form>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
