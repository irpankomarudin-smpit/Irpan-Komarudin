import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  Camera,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  Home,
  LayoutGrid,
  Menu,
  QrCode,
  Settings,
  X,
} from 'lucide-react';
import type { AttendanceRecord, BootstrapPayload, Teacher } from './types';
import { DashboardOverview } from './components/DashboardOverview';
import { CameraKiosk } from './components/CameraKiosk';
import { TeachersManager } from './components/TeachersManager';
import { SessionsManager } from './components/SessionsManager';
import { AttendanceReport } from './components/AttendanceReport';
import { SettingsModal } from './components/SettingsModal';
import {
  AlMultazamCrest,
  SidebarBottomWave,
  TopWaveBanner,
} from './components/AlMultazamBrand';

type NavTab = 'overview' | 'kiosk' | 'teachers' | 'sessions' | 'report';

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { id: 'overview', label: 'Ringkasan', icon: LayoutGrid },
  { id: 'kiosk', label: 'Pemindai Kamera', icon: Camera },
  { id: 'teachers', label: 'Data Guru & Barcode', icon: QrCode },
  { id: 'sessions', label: 'Jadwal Sesi', icon: CalendarClock },
  { id: 'report', label: 'Rekap Kehadiran', icon: ClipboardList },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'sheets'>('general');
  const [isTvFullscreen, setIsTvFullscreen] = useState<boolean>(false);
  const [remoteScanEvent, setRemoteScanEvent] = useState<{
    teacher: Teacher;
    attendance: AttendanceRecord;
    seq: number;
  } | null>(null);

  const openSettings = (tab: 'general' | 'sheets' = 'general') => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  const fetchBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error('Gagal memuat data server.');
      const payload = (await res.json()) as BootstrapPayload;
      setData(payload);
      setLoadError('');
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Gagal terhubung ke server.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  useEffect(() => {
    const source = new EventSource('/api/events');
    source.addEventListener('sync', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as BootstrapPayload;
        if (parsed && parsed.settings) {
          setData(parsed);
        }
      } catch {
        fetchBootstrap();
      }
    });
    source.addEventListener('attendance_recorded', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as {
          teacher?: Teacher;
          attendance?: AttendanceRecord;
        };
        if (parsed?.teacher && parsed?.attendance) {
          setRemoteScanEvent({
            teacher: parsed.teacher,
            attendance: parsed.attendance,
            seq: Date.now(),
          });
        }
      } catch {
        // Ignore malformed SSE payload
      }
    });
    return () => {
      source.close();
    };
  }, [fetchBootstrap]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setIsTvFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleTvFullscreen = async () => {
    const next = !isTvFullscreen;
    setIsTvFullscreen(next);
    try {
      if (next && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // CSS fixed overlay works even if fullscreen API is blocked
    }
  };

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const activeNavLabel =
    NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Ringkasan';

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-[#F3FAF5]">
        <aside className="hidden w-64 border-r border-emerald-900/10 bg-white p-6 lg:block">
          <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100" />
          <div className="mx-auto mt-3 h-5 w-32 rounded bg-emerald-100" />
          <div className="mt-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 rounded-full bg-emerald-50" />
            ))}
          </div>
        </aside>
        <main className="flex-1 p-6 lg:p-8">
          <div className="h-44 rounded-2xl border border-emerald-900/10 bg-white" />
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 rounded-2xl border border-emerald-900/10 bg-white"
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3FAF5] p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">
          Koneksi Server Terputus
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-600">
          {loadError || 'Data sistem belum tersedia.'}
        </p>
        <button
          type="button"
          onClick={fetchBootstrap}
          className="mt-5 rounded-full bg-[#156235] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#11502b]"
        >
          Muat Ulang Data
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#F4FAF6] via-[#F7FBF8] to-[#E6F4EB] text-slate-900">
      {/* Desktop White Sidebar matching uploaded design */}
      <aside className="no-print relative hidden w-64 shrink-0 flex-col justify-between overflow-hidden border-r border-emerald-900/10 bg-white lg:flex">
        <div className="relative z-10">
          {/* Crest + Brand Title + Gold Diamond Divider */}
          <div className="px-5 pb-4 pt-6 text-center">
            <div className="flex justify-center">
              <AlMultazamCrest className="h-16 w-16" />
            </div>
            <h1 className="mt-2.5 font-display text-[15px] font-extrabold leading-snug tracking-tight text-[#156235] [text-wrap:balance]">
              LMS Pengawas Ujian
              <span className="block text-sm font-bold text-[#0E4A27]">
                SMPIT AL-MULTAZAM
              </span>
            </h1>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Kab. Kuningan, Jawa Barat
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="h-px flex-1 bg-amber-400/50" />
              <span className="h-2 w-2 rotate-45 bg-amber-500" />
              <span className="h-px flex-1 bg-amber-400/50" />
            </div>
          </div>

          <nav className="flex flex-col gap-1.5 px-4 py-2" aria-label="Menu Utama">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  className={`flex items-center justify-between gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#156235] to-[#1E7E45] text-white shadow-sm'
                      : 'text-slate-700 hover:bg-emerald-50 hover:text-[#156235]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-[#156235]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </span>
                  {isActive && <ChevronRight className="h-4 w-4 shrink-0 text-white" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Settings + Emblem Watermark + Green/Gold Wave */}
        <div className="relative z-10 flex flex-col">
          <div className="flex flex-col gap-1 px-4 pb-3">
            <button
              type="button"
              onClick={() => openSettings('sheets')}
              className="flex w-full items-center gap-3 rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-[#156235] whitespace-nowrap"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#156235]" />
              <span>Google Sheets</span>
            </button>
            <button
              type="button"
              onClick={() => openSettings('general')}
              className="flex w-full items-center gap-3 rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-[#156235] whitespace-nowrap"
            >
              <Settings className="h-4 w-4 shrink-0 text-[#156235]" />
              <span>Pengaturan Ujian</span>
            </button>
          </div>
          <SidebarBottomWave />
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {isMobileMenuOpen && (
        <div className="no-print fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-72 flex-col justify-between overflow-hidden bg-white shadow-xl">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <AlMultazamCrest className="h-11 w-11 shrink-0" />
                  <div>
                    <span className="block font-display text-sm font-extrabold leading-tight text-[#156235]">
                      LMS Pengawas Ujian
                    </span>
                    <p className="text-[11px] font-bold text-slate-700">
                      SMPIT AL-MULTAZAM
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex flex-col gap-1.5 p-4">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTab(item.id)}
                      className={`flex items-center justify-between gap-3 rounded-full px-4 py-3 text-sm font-semibold whitespace-nowrap ${
                        isActive
                          ? 'bg-gradient-to-r from-[#156235] to-[#1E7E45] text-white'
                          : 'text-slate-700 hover:bg-emerald-50 hover:text-[#156235]'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isActive ? 'text-white' : 'text-[#156235]'
                          }`}
                        />
                        <span>{item.label}</span>
                      </span>
                      {isActive && <ChevronRight className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div>
              <div className="flex flex-col gap-1 border-t border-slate-100 p-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    openSettings('sheets');
                  }}
                  className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-emerald-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-[#156235]" />
                  <span>Google Sheets</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    openSettings('general');
                  }}
                  className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-emerald-50"
                >
                  <Settings className="h-4 w-4 text-[#156235]" />
                  <span>Pengaturan Ujian</span>
                </button>
              </div>
              <SidebarBottomWave />
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Green & Gold Wave Ribbon */}
        <div className="no-print">
          <TopWaveBanner />
        </div>

        {/* Top Bar with Home Breadcrumb + Primary Camera CTA */}
        <header className="no-print flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="rounded-full border border-emerald-900/15 bg-white p-2 text-[#156235] hover:bg-emerald-50 lg:hidden"
              aria-label="Buka menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectTab('overview')}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#156235] shadow-xs border border-emerald-900/10 hover:bg-emerald-50"
                title="Ke Ringkasan"
              >
                <Home className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 items-center gap-1.5 text-sm">
                <span className="hidden font-semibold text-slate-600 sm:inline">
                  LMS Pengawas Ujian SMPIT AL-MULTAZAM
                </span>
                <ChevronRight className="hidden h-4 w-4 text-slate-400 sm:inline" />
                <span className="truncate font-display font-bold text-[#156235]">
                  {activeNavLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {activeTab !== 'kiosk' ? (
              <button
                type="button"
                onClick={() => handleSelectTab('kiosk')}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#156235] to-[#1E7E45] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 whitespace-nowrap shrink-0 min-h-[40px]"
              >
                <Camera className="h-4 w-4" />
                <span>Buka Pemindai Kamera</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSelectTab('teachers')}
                className="inline-flex items-center gap-2 rounded-full border border-[#156235]/30 bg-white px-5 py-2.5 text-xs font-semibold text-[#156235] shadow-xs hover:bg-emerald-50 whitespace-nowrap shrink-0 min-h-[40px]"
              >
                <QrCode className="h-4 w-4" />
                <span>Buat Barcode Guru</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-8 pt-2 sm:px-6 lg:px-8">
          {activeTab === 'overview' && (
            <DashboardOverview
              settings={data.settings}
              teachers={data.teachers}
              sessions={data.sessions}
              attendances={data.attendances}
              onNavigate={handleSelectTab}
            />
          )}

          {activeTab === 'kiosk' && (
            <CameraKiosk
              settings={data.settings}
              sessions={data.sessions}
              teachers={data.teachers}
              attendances={data.attendances}
              isTvFullscreen={isTvFullscreen}
              remoteScanEvent={remoteScanEvent}
              onToggleTvFullscreen={handleToggleTvFullscreen}
              onScanProcessed={() => {
                fetchBootstrap();
              }}
            />
          )}

          {activeTab === 'teachers' && (
            <TeachersManager
              settings={data.settings}
              teachers={data.teachers}
              onRefresh={fetchBootstrap}
            />
          )}

          {activeTab === 'sessions' && (
            <SessionsManager
              settings={data.settings}
              sessions={data.sessions}
              onRefresh={fetchBootstrap}
            />
          )}

          {activeTab === 'report' && (
            <AttendanceReport
              settings={data.settings}
              teachers={data.teachers}
              sessions={data.sessions}
              attendances={data.attendances}
              onRefresh={fetchBootstrap}
            />
          )}
        </main>
      </div>

      {isSettingsOpen && (
        <SettingsModal
          settings={data.settings}
          initialTab={settingsInitialTab}
          onClose={() => setIsSettingsOpen(false)}
          onSaved={fetchBootstrap}
        />
      )}
    </div>
  );
}
