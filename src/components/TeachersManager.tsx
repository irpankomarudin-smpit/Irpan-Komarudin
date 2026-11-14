import { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Layers,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import type { InstitutionSettings, Teacher } from '../types';
import {
  downloadProctorCardPng,
  generateDraftBarcodeCode,
} from '../utils/barcodeCard';
import { BarcodeDisplay } from './BarcodeDisplay';

interface TeachersManagerProps {
  settings: InstitutionSettings;
  teachers: Teacher[];
  onRefresh: () => Promise<void>;
}

export function TeachersManager({
  settings,
  teachers,
  onRefresh,
}: TeachersManagerProps) {
  const [entryMode, setEntryMode] = useState<'single' | 'batch'>('single');
  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [subject, setSubject] = useState('');
  const [draftSalt, setDraftSalt] = useState<number>(() =>
    Math.floor(1000 + Math.random() * 8999)
  );
  const [batchText, setBatchText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [previewTeacher, setPreviewTeacher] = useState<Teacher | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editName, setEditName] = useState('');
  const [editNip, setEditNip] = useState('');
  const [editSubject, setEditSubject] = useState('');

  const liveDraftCode = useMemo(
    () => generateDraftBarcodeCode(name, draftSalt),
    [name, draftSalt]
  );

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.nip.toLowerCase().includes(q) ||
        t.barcodeCode.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
    );
  }, [teachers, searchQuery]);

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSaving) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          nip: nip.trim(),
          subject: subject.trim(),
          barcodeCode: liveDraftCode,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || 'Gagal menyimpan data guru.');
      }
      const created = (await res.json()) as Teacher;
      setName('');
      setNip('');
      setSubject('');
      setDraftSalt(Math.floor(1000 + Math.random() * 8999));
      setFeedback({
        type: 'success',
        text: `Barcode ${created.barcodeCode} otomatis dibuat untuk ${created.name}.`,
      });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = batchText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0 || isSaving) return;

    const items = lines.map((line) => {
      const parts = line.split(/[,\t;]/).map((p) => p.trim());
      return {
        name: parts[0] || '',
        nip: parts[1] || '',
        subject: parts[2] || '',
      };
    });

    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/teachers/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || 'Gagal mengimpor daftar guru.');
      }
      const data = (await res.json()) as { count: number };
      setBatchText('');
      setFeedback({
        type: 'success',
        text: `${data.count} guru dan barcode otomatis berhasil dibuat sekaligus.`,
      });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memproses daftar guru.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (teacher: Teacher) => {
    try {
      await fetch(`/api/teachers/${teacher.id}`, { method: 'DELETE' });
      await onRefresh();
    } catch {
      // Ignore error
    }
  };

  const openEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setEditName(teacher.name);
    setEditNip(teacher.nip);
    setEditSubject(teacher.subject);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher || !editName.trim()) return;
    setIsSaving(true);
    try {
      await fetch(`/api/teachers/${editingTeacher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          nip: editNip.trim(),
          subject: editSubject.trim(),
        }),
      });
      setEditingTeacher(null);
      await onRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print flex flex-col gap-6">
        {/* Top Input & Live Auto-Barcode Preview */}
        <section className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
                Input Nama Guru &amp; Pembuatan Barcode Otomatis
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Ketik nama guru untuk langsung menghasilkan QR Code dan Barcode Code128 siap pindai.
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-full bg-emerald-50 p-1">
              <button
                type="button"
                onClick={() => setEntryMode('single')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  entryMode === 'single'
                    ? 'bg-[#156235] text-white'
                    : 'text-[#156235] hover:bg-emerald-100/70'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Tambah Satu Guru</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('batch')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  entryMode === 'batch'
                    ? 'bg-[#156235] text-white'
                    : 'text-[#156235] hover:bg-emerald-100/70'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Tambah Banyak Sekaligus</span>
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                feedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-[#156235]'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {entryMode === 'single' ? (
            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <form
                onSubmit={handleSingleSubmit}
                className="flex flex-col gap-4 lg:col-span-7"
              >
                <div>
                  <label
                    htmlFor="teacher-name-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Nama Lengkap Guru / Pengawas *
                  </label>
                  <input
                    id="teacher-name-input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Ustadz Ahmad Fauzi, S.Pd"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#156235] focus:outline-none focus:ring-2 focus:ring-[#156235]/20"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="teacher-nip-input"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      NIP / NUPTK / Kode Guru
                    </label>
                    <input
                      id="teacher-nip-input"
                      type="text"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      placeholder="Opsional"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-[#156235] focus:outline-none focus:ring-2 focus:ring-[#156235]/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="teacher-subject-input"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Mata Pelajaran / Jabatan
                    </label>
                    <input
                      id="teacher-subject-input"
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Opsional (mis. Matematika)"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#156235] focus:outline-none focus:ring-2 focus:ring-[#156235]/20"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={isSaving || !name.trim()}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#156235] to-[#1E7E45] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0 min-h-[42px]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>
                      {isSaving ? 'Menyimpan...' : 'Simpan & Aktifkan Barcode'}
                    </span>
                  </button>
                  {name.trim() && (
                    <span className="font-mono text-xs font-medium text-[#156235]">
                      Kode otomatis: {liveDraftCode}
                    </span>
                  )}
                </div>
              </form>

              {/* Real-time Auto-Generated Barcode Preview */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-900/10 bg-[#F4FAF6] p-5 lg:col-span-5">
                <div className="mb-3 w-full text-center">
                  <p className="text-xs font-semibold text-[#156235]">
                    Pratinjau Barcode Otomatis
                  </p>
                  <p className="mt-0.5 truncate text-base font-bold text-slate-900">
                    {name.trim() || 'Nama Guru Akan Tampil di Sini'}
                  </p>
                  {(nip.trim() || subject.trim()) && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[nip.trim() ? `NIP ${nip.trim()}` : null, subject.trim() || null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>

                <BarcodeDisplay code={liveDraftCode} size="md" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleBatchSubmit} className="mt-5 flex flex-col gap-4">
              <div>
                <label
                  htmlFor="batch-teachers-textarea"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Daftar Nama Guru (Satu baris satu guru)
                </label>
                <p className="mt-0.5 text-xs text-slate-500">
                  Cukup tulis nama guru per baris, atau pisahkan koma: Nama Guru, NIP, Mata Pelajaran.
                </p>
                <textarea
                  id="batch-teachers-textarea"
                  rows={6}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={`Ahmad Fauzi, S.Pd, 19850101, Matematika\nSiti Aminah, M.Pd, 19870314, Bahasa Arab\nBudi Santoso, S.Kom`}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#156235] focus:outline-none focus:ring-2 focus:ring-[#156235]/20"
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={isSaving || !batchText.trim()}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#156235] to-[#1E7E45] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0 min-h-[42px]"
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    {isSaving ? 'Membuat Barcode...' : 'Buat Semua Barcode Otomatis'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Directory Toolbar & List */}
        <section className="rounded-2xl border border-emerald-900/10 bg-white shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Daftar Pengawas &amp; Kartu Barcode ({teachers.length})
              </h3>
              <p className="text-xs text-slate-500">
                Unduh kartu PNG atau cetak massal A4 agar guru tinggal menunjukkan ke kamera.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau kode..."
                  className="w-56 rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#156235] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 rounded-full bg-emerald-50 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                    viewMode === 'cards'
                      ? 'bg-[#156235] text-white'
                      : 'text-[#156235] hover:bg-emerald-100/70'
                  }`}
                >
                  Kartu Barcode
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                    viewMode === 'table'
                      ? 'bg-[#156235] text-white'
                      : 'text-[#156235] hover:bg-emerald-100/70'
                  }`}
                >
                  Tabel
                </button>
              </div>

              {teachers.length > 0 && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-full border border-[#156235]/30 bg-white px-4 py-2 text-xs font-semibold text-[#156235] hover:bg-emerald-50 whitespace-nowrap shrink-0"
                >
                  <Printer className="h-4 w-4" />
                  <span>Cetak Semua Kartu (A4)</span>
                </button>
              )}
            </div>
          </div>

          {teachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <QrCode className="h-10 w-10 text-emerald-200" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Belum ada pengawas yang terdaftar
              </p>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                Masukkan nama guru pada formulir di atas untuk langsung menghasilkan barcode otomatis.
              </p>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Tidak ada pengawas yang cocok dengan pencarian &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredTeachers.map((teacher) => (
                <article
                  key={teacher.id}
                  className="flex flex-col justify-between rounded-2xl border border-emerald-900/10 bg-white p-5 transition-colors hover:border-[#156235]/40"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate text-base font-bold text-slate-900">
                          {teacher.name}
                        </h4>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {[
                            teacher.nip ? `NIP ${teacher.nip}` : null,
                            teacher.subject || null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Pengawas Ujian'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(teacher)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-[#156235]"
                          title="Edit pengawas"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(teacher)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Hapus pengawas"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-center rounded-xl bg-[#F4FAF6] py-3">
                      <BarcodeDisplay code={teacher.barcodeCode} size="sm" />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setPreviewTeacher(teacher)}
                      className="flex-1 rounded-full border border-[#156235]/30 bg-white px-3 py-2 text-xs font-semibold text-[#156235] hover:bg-emerald-50 whitespace-nowrap"
                    >
                      Perbesar Barcode
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadProctorCardPng(teacher, settings)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#156235] px-3 py-2 text-xs font-semibold text-white hover:bg-[#11502b] whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Unduh Kartu</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-emerald-50/50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-6 py-3">Nama Guru</th>
                    <th className="px-4 py-3">NIP / Kode</th>
                    <th className="px-4 py-3">Mata Pelajaran / Jabatan</th>
                    <th className="px-4 py-3">Kode Barcode</th>
                    <th className="px-6 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTeachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-emerald-50/30">
                      <td className="px-6 py-3 font-semibold text-slate-900">
                        {teacher.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {teacher.nip || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {teacher.subject || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#156235]">
                        {teacher.barcodeCode}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewTeacher(teacher)}
                            className="rounded-full border border-[#156235]/30 px-3 py-1.5 text-xs font-semibold text-[#156235] hover:bg-emerald-50"
                          >
                            QR/Barcode
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadProctorCardPng(teacher, settings)}
                            className="rounded-full bg-[#156235] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#11502b]"
                          >
                            Unduh PNG
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(teacher)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-[#156235]"
                            title="Edit"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(teacher)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Print-only A4 Batch Card Sheet */}
      <div className="hidden print:block">
        <div className="mb-4 flex items-center gap-3 border-b-2 border-[#156235] pb-2.5">
          <img
            src="/assets/logo-smpit-almultazam.png"
            alt="Logo SMPIT AL-MULTAZAM"
            className="h-12 w-12 object-contain"
          />
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              LMS Pengawas Ujian SMPIT AL-MULTAZAM — Kartu Barcode
            </h1>
            <p className="text-xs text-slate-600">
              {settings.institutionName} · {settings.examTitle} · Tahun Ajaran {settings.academicYear}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {filteredTeachers.map((teacher) => (
            <div
              key={`print-${teacher.id}`}
              className="print-break-inside-avoid rounded-xl border border-slate-400 p-4"
            >
              <div className="border-b border-slate-200 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#156235]">
                  {settings.institutionName} · {settings.examTitle}
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">
                  {teacher.name}
                </p>
                {(teacher.nip || teacher.subject) && (
                  <p className="text-xs text-slate-600">
                    {[
                      teacher.nip ? `NIP: ${teacher.nip}` : null,
                      teacher.subject || null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <div className="mt-3 flex justify-center">
                <BarcodeDisplay code={teacher.barcodeCode} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full Barcode Zoom Modal */}
      {previewTeacher && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-900/15 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#156235]">
                  Kartu Barcode Siap Pindai
                </p>
                <h3 className="mt-0.5 text-lg font-bold text-slate-900">
                  {previewTeacher.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {[
                    previewTeacher.nip ? `NIP ${previewTeacher.nip}` : null,
                    previewTeacher.subject || null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Pengawas Ujian'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTeacher(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex justify-center rounded-xl border border-emerald-900/10 bg-[#F4FAF6] p-6">
              <BarcodeDisplay code={previewTeacher.barcodeCode} size="lg" />
            </div>

            <p className="mt-3 text-center text-xs text-slate-500">
              Perlihatkan layar ini ke kamera HP, iPad, Laptop, atau Google TV untuk mencatat kehadiran.
            </p>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => downloadProctorCardPng(previewTeacher, settings)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#156235] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#11502b]"
              >
                <Download className="h-4 w-4" />
                <span>Unduh Kartu PNG</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewTeacher(null)}
                className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {editingTeacher && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-2xl border border-emerald-900/15 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                Ubah Data Pengawas
              </h3>
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Lengkap Guru
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#156235] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  NIP / NUPTK
                </label>
                <input
                  type="text"
                  value={editNip}
                  onChange={(e) => setEditNip(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm focus:border-[#156235] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Mata Pelajaran / Jabatan
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#156235] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-[#156235] px-5 py-2 text-sm font-semibold text-white hover:bg-[#11502b] disabled:opacity-50"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
