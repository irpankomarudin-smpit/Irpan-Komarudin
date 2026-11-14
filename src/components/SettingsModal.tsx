import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  RefreshCw,
  X,
} from 'lucide-react';
import type { InstitutionSettings } from '../types';

interface SettingsModalProps {
  settings: InstitutionSettings;
  initialTab?: 'general' | 'sheets';
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function SettingsModal({
  settings,
  initialTab = 'general',
  onClose,
  onSaved,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'sheets'>(initialTab);
  const [institutionName, setInstitutionName] = useState(settings.institutionName);
  const [examTitle, setExamTitle] = useState(settings.examTitle);
  const [academicYear, setAcademicYear] = useState(settings.academicYear);
  const [appsScriptWebhookUrl, setAppsScriptWebhookUrl] = useState(
    settings.appsScriptWebhookUrl || ''
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [copiedFile, setCopiedFile] = useState<'code' | 'index' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionName: institutionName.trim(),
          examTitle: examTitle.trim(),
          academicYear: academicYear.trim(),
          appsScriptWebhookUrl: appsScriptWebhookUrl.trim(),
        }),
      });
      await onSaved();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!appsScriptWebhookUrl.trim()) {
      setStatusMessage({
        ok: false,
        text: 'Masukkan URL Web App Apps Script terlebih dahulu.',
      });
      return;
    }
    setIsTesting(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/integrations/apps-script/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: appsScriptWebhookUrl.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      setStatusMessage({ ok: data.ok, text: data.message });
      if (data.ok) await onSaved();
    } catch {
      setStatusMessage({ ok: false, text: 'Gagal menguji koneksi ke server.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncAll = async () => {
    if (!appsScriptWebhookUrl.trim()) {
      setStatusMessage({
        ok: false,
        text: 'Masukkan URL Web App Apps Script terlebih dahulu.',
      });
      return;
    }
    setIsSyncingAll(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/integrations/apps-script/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: appsScriptWebhookUrl.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      setStatusMessage({ ok: data.ok, text: data.message });
      if (data.ok) await onSaved();
    } catch {
      setStatusMessage({ ok: false, text: 'Gagal menyinkronkan data ke Google Sheets.' });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleCopyGasFile = async (which: 'code' | 'index') => {
    const path = which === 'code' ? '/gas/Code.gs' : '/gas/Index.html';
    try {
      const text = await fetch(path).then((r) => r.text());
      await navigator.clipboard.writeText(text);
      setCopiedFile(which);
      window.setTimeout(() => setCopiedFile(null), 2500);
    } catch {
      setStatusMessage({
        ok: false,
        text: `Gagal menyalin ${which === 'code' ? 'Code.gs' : 'Index.html'}. Silakan gunakan tombol Unduh.`,
      });
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-emerald-900/15 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="font-display text-lg font-bold text-slate-900">
            Pengaturan LMS &amp; Paket Google Apps Script
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-emerald-50/40 px-6 py-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'general'
                ? 'bg-[#156235] text-white'
                : 'text-[#156235] hover:bg-emerald-100/70'
            }`}
          >
            Profil Sekolah &amp; Ujian
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sheets')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'sheets'
                ? 'bg-[#156235] text-white'
                : 'text-[#156235] hover:bg-emerald-100/70'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Google Sheets &amp; Apps Script (Code.gs + Index.html)</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto p-6">
          {activeTab === 'general' ? (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Sekolah / Madrasah
                </label>
                <input
                  type="text"
                  required
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#156235] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Kegiatan Ujian
                </label>
                <input
                  type="text"
                  required
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#156235] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Tahun Ajaran
                </label>
                <input
                  type="text"
                  required
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm focus:border-[#156235] focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Download / Copy Complete GAS Package (Code.gs + Index.html) */}
              <div className="rounded-xl border border-emerald-900/15 bg-[#F4FAF6] p-4">
                <p className="text-xs font-bold text-[#156235]">
                  Paket Lengkap Google Apps Script (Code.gs + Index.html)
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Salin atau unduh kedua file berikut ke project Apps Script di Google Spreadsheet Anda. Ketika dibuka di browser, Apps Script akan langsung menampilkan halaman <strong>Index.html</strong>, sekaligus menerima sinkronisasi dari aplikasi web ini.
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-900/10 bg-white px-3.5 py-2.5">
                    <span className="font-mono text-xs font-bold text-slate-800">
                      1. Code.gs
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyGasFile('code')}
                        className="inline-flex items-center gap-1 rounded-full bg-[#156235] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#11502b]"
                      >
                        {copiedFile === 'code' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedFile === 'code' ? 'Tersalin' : 'Salin'}</span>
                      </button>
                      <a
                        href="/gas/Code.gs"
                        download="Code.gs"
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="h-3 w-3" />
                        <span>Unduh</span>
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-900/10 bg-white px-3.5 py-2.5">
                    <span className="font-mono text-xs font-bold text-slate-800">
                      2. Index.html
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyGasFile('index')}
                        className="inline-flex items-center gap-1 rounded-full bg-[#156235] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#11502b]"
                      >
                        {copiedFile === 'index' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedFile === 'index' ? 'Tersalin' : 'Salin'}</span>
                      </button>
                      <a
                        href="/gas/Index.html"
                        download="Index.html"
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="h-3 w-3" />
                        <span>Unduh</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  URL Web App Google Apps Script (Opsional untuk Sinkron Hybrid)
                </label>
                <input
                  type="url"
                  value={appsScriptWebhookUrl}
                  onChange={(e) => setAppsScriptWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#156235] focus:outline-none"
                />
                {settings.lastSheetsSyncAt && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Sinkron terakhir:{' '}
                    <span className="font-mono">
                      {new Date(settings.lastSheetsSyncAt).toLocaleString('id-ID')}
                    </span>{' '}
                    · {settings.lastSheetsSyncStatus}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={handleTestConnection}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#156235]/30 bg-white px-4 py-2 text-xs font-semibold text-[#156235] hover:bg-emerald-50 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isTesting ? 'Menguji...' : 'Uji Koneksi'}</span>
                </button>
                <button
                  type="button"
                  disabled={isSyncingAll}
                  onClick={handleSyncAll}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                  <span>
                    {isSyncingAll
                      ? 'Menyinkronkan...'
                      : 'Sinkronkan Semua Data ke Sheets'}
                  </span>
                </button>
              </div>

              {statusMessage && (
                <div
                  className={`rounded-xl border px-4 py-2.5 text-xs font-medium ${
                    statusMessage.ok
                      ? 'border-emerald-200 bg-emerald-50 text-[#156235]'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {statusMessage.text}
                </div>
              )}

              <ol className="list-decimal space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-4 pl-8 text-xs text-slate-600">
                <li>Buka Google Spreadsheet baru &gt; <strong>Ekstensi &gt; Apps Script</strong>.</li>
                <li>Tempel isi <strong>Code.gs</strong> ke editor bawaan.</li>
                <li>Klik ikon <strong>(+)</strong> di panel File &gt; pilih <strong>HTML</strong> &gt; beri nama <strong>Index</strong> (otomatis menjadi <code>Index.html</code>) &gt; tempel isi <strong>Index.html</strong>.</li>
                <li>Klik <strong>Terapkan (Deploy) &gt; Deployment Baru &gt; Aplikasi Web</strong> &gt; akses <strong>Siapa saja (Anyone)</strong> &gt; Terapkan.</li>
              </ol>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-[#156235] px-5 py-2 text-sm font-semibold text-white hover:bg-[#11502b] disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
