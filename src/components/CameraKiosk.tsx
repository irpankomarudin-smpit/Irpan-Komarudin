import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  FlipHorizontal2,
  Keyboard,
  Maximize2,
  Minimize2,
  RefreshCw,
  ScanLine,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  type CameraDevice,
} from 'html5-qrcode';
import type {
  AttendanceRecord,
  ExamSession,
  InstitutionSettings,
  ScanMethod,
  ScanResultPayload,
  Teacher,
} from '../types';
import { detectDeviceLabel, playScanTone, speakConfirmation } from '../utils/audio';
import {
  getTodayDateString,
  resolveActiveSession,
} from '../utils/sessionSchedule';

interface CameraKioskProps {
  settings: InstitutionSettings;
  sessions: ExamSession[];
  teachers: Teacher[];
  attendances: AttendanceRecord[];
  isTvFullscreen: boolean;
  remoteScanEvent?: {
    teacher: Teacher;
    attendance: AttendanceRecord;
    seq: number;
  } | null;
  onToggleTvFullscreen: () => void;
  onScanProcessed: (payload: ScanResultPayload) => void;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
];

export function CameraKiosk({
  settings,
  sessions,
  teachers,
  attendances,
  isTvFullscreen,
  remoteScanEvent,
  onToggleTvFullscreen,
  onScanProcessed,
}: CameraKioskProps) {
  const [selectedSessionMode, setSelectedSessionMode] = useState<string>('auto');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraState, setCameraState] = useState<
    'initializing' | 'active' | 'permission_denied' | 'no_camera' | 'error'
  >('initializing');
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string>('');
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [manualCode, setManualCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [scanBanner, setScanBanner] = useState<ScanResultPayload | null>(null);
  const [nowClock, setNowClock] = useState<Date>(() => new Date());

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const lastLocalRecordIdRef = useRef<string>('');
  const bannerTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const deviceLabel = useMemo(() => detectDeviceLabel(), []);

  useEffect(() => {
    const id = window.setInterval(() => setNowClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const currentSession = useMemo(() => {
    if (selectedSessionMode !== 'auto') {
      const picked = sessions.find((s) => s.id === selectedSessionMode);
      if (picked) return picked;
    }
    return resolveActiveSession(sessions, settings, nowClock);
  }, [selectedSessionMode, sessions, settings, nowClock]);

  const todayStr = useMemo(() => getTodayDateString(nowClock), [nowClock]);

  const recentTodayLogs = useMemo(
    () => attendances.filter((a) => a.date === todayStr).slice(0, 6),
    [attendances, todayStr]
  );

  const showScanResult = useCallback((payload: ScanResultPayload) => {
    setScanBanner(payload);
    if (bannerTimerRef.current) {
      window.clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setScanBanner(null);
    }, 5000);
  }, []);

  const submitBarcode = useCallback(
    async (rawCode: string, scanMethod: ScanMethod) => {
      const code = rawCode.trim();
      if (!code || isSubmitting) return;

      const nowMs = Date.now();
      if (
        scanMethod === 'camera' &&
        lastScanRef.current.code === code.toUpperCase() &&
        nowMs - lastScanRef.current.at < 4000
      ) {
        return;
      }
      lastScanRef.current = { code: code.toUpperCase(), at: nowMs };

      setIsSubmitting(true);
      try {
        const res = await fetch('/api/attendance/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barcodeCode: code,
            sessionId: selectedSessionMode,
            deviceType: deviceLabel,
            scanMethod,
          }),
        });
        const data = (await res.json()) as ScanResultPayload;
        if (data.attendance?.id) {
          lastLocalRecordIdRef.current = data.attendance.id;
        }
        showScanResult(data);
        onScanProcessed(data);

        if (soundEnabled) {
          if (data.result === 'recorded') playScanTone('success');
          else if (data.result === 'already_scanned') playScanTone('duplicate');
          else playScanTone('error');
        }

        if (voiceEnabled && data.result === 'recorded' && data.teacher && data.attendance) {
          speakConfirmation(
            `Terima kasih, ${data.teacher.name}. Kehadiran tercatat pada ${data.attendance.sessionName}.`
          );
        } else if (voiceEnabled && data.result === 'already_scanned' && data.teacher) {
          speakConfirmation(`${data.teacher.name} sudah tercatat hadir.`);
        }
      } catch {
        const errPayload: ScanResultPayload = {
          result: 'not_found',
          message: 'Gagal terhubung ke server presensi. Periksa koneksi jaringan.',
          barcodeCode: code,
        };
        showScanResult(errPayload);
        if (soundEnabled) playScanTone('error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      deviceLabel,
      isSubmitting,
      onScanProcessed,
      selectedSessionMode,
      showScanResult,
      soundEnabled,
      voiceEnabled,
    ]
  );

  const stopCameraSafe = useCallback(async () => {
    const instance = scannerRef.current;
    if (!instance) return;
    try {
      const state = instance.getState();
      if (state === 2 || state === 3) {
        await instance.stop();
      }
      instance.clear();
    } catch {
      // Ignore cleanup errors
    }
  }, []);

  const isInIframe = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const startCamera = useCallback(
    async (preferredCameraId?: string) => {
      setCameraState('initializing');
      setCameraErrorMsg('');

      await stopCameraSafe();

      const container = document.getElementById('kiosk-qr-reader');
      if (!container) return;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('error');
        setCameraErrorMsg(
          isInIframe
            ? 'Browser memblokir kamera karena aplikasi dibuka di dalam frame/preview. Buka langsung link aplikasi di tab baru browser (Chrome/Safari).'
            : 'Browser atau perangkat ini belum mendukung akses kamera web (pastikan dibuka lewat HTTPS di Chrome/Safari).'
        );
        return;
      }

      const scanConfig = {
        fps: 12,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxWidth = Math.max(180, Math.min(340, Math.floor(viewfinderWidth * 0.72)));
          const boxHeight = Math.max(160, Math.min(280, Math.floor(minEdge * 0.65)));
          return { width: boxWidth, height: boxHeight };
        },
      };

      const onDecoded = (decodedText: string) => {
        submitBarcode(decodedText, 'camera');
      };

      try {
        const instance = new Html5Qrcode('kiosk-qr-reader', {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        });
        scannerRef.current = instance;

        let started = false;
        let lastErr: unknown = null;

        if (preferredCameraId) {
          await instance.start(preferredCameraId, scanConfig, onDecoded, () => {});
          started = true;
        } else {
          const attempts: Array<string | MediaTrackConstraints> = [
            { facingMode: 'environment' },
            { facingMode: 'user' },
          ];
          for (const constraint of attempts) {
            try {
              await instance.start(constraint, scanConfig, onDecoded, () => {});
              started = true;
              break;
            } catch (e) {
              lastErr = e;
            }
          }

          if (!started) {
            const devices = await Html5Qrcode.getCameras();
            if (!devices || devices.length === 0) {
              if (lastErr) throw lastErr;
              setCameraState('no_camera');
              setCameraErrorMsg(
                'Kamera tidak terdeteksi pada perangkat ini. Pada Google TV pastikan Webcam USB terpasang, atau gunakan scanner USB / Scan Foto.'
              );
              return;
            }
            const backCam = devices.find((d) =>
              /back|rear|environment|belakang/i.test(d.label)
            );
            const fallbackId = (backCam || devices[0]).id;
            setSelectedCameraId(fallbackId);
            await instance.start(fallbackId, scanConfig, onDecoded, () => {});
            started = true;
          }
        }

        if (started) {
          try {
            const devices = await Html5Qrcode.getCameras();
            setCameras(devices);
            if (!preferredCameraId && devices.length > 0 && !selectedCameraId) {
              const backCam = devices.find((d) =>
                /back|rear|environment|belakang/i.test(d.label)
              );
              setSelectedCameraId((backCam || devices[0]).id);
            }
          } catch {
            // Camera already active even if label enumeration is restricted
          }
          setCameraState('active');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|notallowed|denied|policy|security/i.test(msg)) {
          setCameraState('permission_denied');
          setCameraErrorMsg(
            isInIframe
              ? 'Akses kamera diblokir di dalam frame preview. Klik tombol "Buka di Tab Baru" di bawah, lalu izinkan akses kamera.'
              : 'Izin kamera ditolak oleh browser. Buka pengaturan izin situs di browser (ikon gembok/kamera di samping alamat web) lalu pilih Izinkan Kamera.'
          );
        } else if (/notfound|requested device not found|overconstrained/i.test(msg)) {
          setCameraState('no_camera');
          setCameraErrorMsg(
            'Kamera tidak ditemukan pada perangkat ini. Untuk Google TV, colokkan Webcam USB ke port USB TV terlebih dahulu.'
          );
        } else {
          setCameraState('error');
          setCameraErrorMsg(
            'Kamera belum aktif atau sedang dipakai aplikasi lain (Zoom/Meet/WhatsApp). Tutup aplikasi kamera lain lalu klik Coba Aktifkan Kamera.'
          );
        }
      }
    },
    [isInIframe, selectedCameraId, stopCameraSafe, submitBarcode]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      startCamera();
    }, 150);
    return () => {
      window.clearTimeout(timer);
      stopCameraSafe();
      if (bannerTimerRef.current) {
        window.clearTimeout(bannerTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!remoteScanEvent) return;
    if (remoteScanEvent.attendance.id === lastLocalRecordIdRef.current) return;
    showScanResult({
      result: 'recorded',
      message: `${remoteScanEvent.teacher.name} tercatat hadir pada ${remoteScanEvent.attendance.sessionName}.`,
      teacher: remoteScanEvent.teacher,
      attendance: remoteScanEvent.attendance,
      barcodeCode: remoteScanEvent.attendance.barcodeCode,
    });
    if (soundEnabled) playScanTone('success');
    if (voiceEnabled) {
      speakConfirmation(
        `Terima kasih, ${remoteScanEvent.teacher.name}. Kehadiran tercatat pada ${remoteScanEvent.attendance.sessionName}.`
      );
    }
  }, [remoteScanEvent, showScanResult, soundEnabled, voiceEnabled]);

  useEffect(() => {
    let buffer = '';
    let lastKeyAt = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      const now = Date.now();
      if (now - lastKeyAt > 250) {
        buffer = '';
      }
      lastKeyAt = now;
      if (e.key === 'Enter') {
        const trimmed = buffer.trim();
        buffer = '';
        if (trimmed.length >= 4) {
          submitBarcode(trimmed, 'manual');
        }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitBarcode]);

  const handleSwitchCamera = (nextId: string) => {
    setSelectedCameraId(nextId);
    startCamera(nextId);
  };

  const handleFlipNextCamera = () => {
    if (cameras.length <= 1) {
      setIsMirrored((m) => !m);
      return;
    }
    const idx = cameras.findIndex((c) => c.id === selectedCameraId);
    const next = cameras[(idx + 1) % cameras.length];
    handleSwitchCamera(next.id);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const tempScanner =
        scannerRef.current ||
        new Html5Qrcode('kiosk-qr-reader-file-helper', {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        });
      const decoded = await tempScanner.scanFile(file, false);
      await submitBarcode(decoded, 'image');
    } catch {
      showScanResult({
        result: 'not_found',
        message: 'Barcode tidak terbaca dari gambar yang diunggah.',
        barcodeCode: '',
      });
      if (soundEnabled) playScanTone('error');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const code = manualCode.trim();
    setManualCode('');
    submitBarcode(code, 'manual');
  };

  const clockFormatted = nowClock.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateFormatted = nowClock.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const attendedCountForSession = useMemo(() => {
    if (!currentSession) return 0;
    return attendances.filter(
      (a) => a.sessionId === currentSession.id && a.date === todayStr
    ).length;
  }, [attendances, currentSession, todayStr]);

  return (
    <div
      className={
        isTvFullscreen
          ? 'fixed inset-0 z-50 flex flex-col bg-slate-950 text-white overflow-y-auto'
          : 'flex flex-col gap-5'
      }
    >
      <div id="kiosk-qr-reader-file-helper" className="hidden" />

      {/* Top Kiosk Control Strip */}
      <div
        className={
          isTvFullscreen
            ? 'flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/95 px-6 py-4'
            : 'flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-900/10 bg-white px-5 py-4 shadow-xs'
        }
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className={isTvFullscreen ? 'text-emerald-400 font-semibold' : 'text-[#156235] font-semibold'}>
              {settings.institutionName}
            </span>
            <span aria-hidden="true">·</span>
            <span className={isTvFullscreen ? 'text-slate-400' : 'text-slate-500'}>
              {deviceLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className={isTvFullscreen ? 'text-slate-400' : 'text-slate-500'}>
              {dateFormatted}
            </span>
          </div>
          <h2
            className={`mt-0.5 font-display text-lg font-bold tracking-tight ${
              isTvFullscreen ? 'text-white sm:text-xl' : 'text-slate-900'
            }`}
          >
            Absensi Tanda Kehadiran Pengawas
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`rounded-full px-4 py-2 font-mono text-sm font-semibold tabular-nums ${
              isTvFullscreen
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'bg-emerald-50 text-[#156235] border border-emerald-200'
            }`}
          >
            {clockFormatted} WIB
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
              isTvFullscreen
                ? 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-[#156235]" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-400" />
            )}
            <span>{soundEnabled ? 'Suara Aktif' : 'Suara Mati'}</span>
          </button>

          <button
            type="button"
            onClick={() => setVoiceEnabled((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
              isTvFullscreen
                ? 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>{voiceEnabled ? 'Ucapan Nama: On' : 'Ucapan Nama: Off'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleTvFullscreen}
            className="inline-flex items-center gap-2 rounded-full bg-[#156235] px-4 py-2 text-xs font-semibold text-white hover:bg-[#11502b] transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
          >
            {isTvFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4" />
                <span>Keluar Mode TV</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                <span>Mode Layar Penuh TV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Two-Column Kiosk Layout */}
      <div
        className={
          isTvFullscreen
            ? 'grid flex-1 grid-cols-1 gap-6 p-6 lg:grid-cols-12'
            : 'grid grid-cols-1 gap-5 lg:grid-cols-12'
        }
      >
        {/* Left/Center Camera Viewport (8 cols) */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          {/* Daily Two-Session Bar */}
          <div
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ${
              isTvFullscreen
                ? 'border border-slate-800 bg-slate-900'
                : 'border border-emerald-900/10 bg-white shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  isTvFullscreen
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-emerald-50 text-[#156235]'
                }`}
              >
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p
                  className={`text-xs font-medium ${
                    isTvFullscreen ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Sesi Presensi Berlaku Hari Ini
                </p>
                <p className="text-sm font-bold">
                  {currentSession.name} ({currentSession.startTime}–{currentSession.endTime} WIB)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-full bg-slate-100/80 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setSelectedSessionMode('auto')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  selectedSessionMode === 'auto'
                    ? 'bg-[#156235] text-white'
                    : isTvFullscreen
                      ? 'text-slate-300 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Otomatis Harian
              </button>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSessionMode(s.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    selectedSessionMode === s.id
                      ? 'bg-[#156235] text-white'
                      : isTvFullscreen
                        ? 'text-slate-300 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s.name} ({s.startTime}–{s.endTime})
                </button>
              ))}
            </div>
          </div>

          {/* Camera Feed Container */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 px-4 py-3 text-white">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Camera className="h-4 w-4 text-emerald-400" />
                <span>
                  {cameraState === 'active'
                    ? 'Kamera Siap — Perlihatkan QR atau Barcode Guru'
                    : cameraState === 'initializing'
                      ? 'Menyiapkan Kamera...'
                      : 'Kamera Tidak Aktif'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {cameras.length > 1 && (
                  <select
                    aria-label="Pilih Kamera"
                    value={selectedCameraId}
                    onChange={(e) => handleSwitchCamera(e.target.value)}
                    className="max-w-[190px] truncate rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {cameras.map((cam, idx) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || `Kamera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={handleFlipNextCamera}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{cameras.length > 1 ? 'Ganti Kamera' : 'Balik Video'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMirrored((m) => !m)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                    isMirrored
                      ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                      : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <FlipHorizontal2 className="h-3.5 w-3.5" />
                  <span>Cermin</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap shrink-0"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Scan Foto</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            <div className="relative aspect-video min-h-[300px] w-full bg-slate-950 sm:min-h-[400px]">
              <div
                id="kiosk-qr-reader"
                className={`h-full w-full ${isMirrored ? 'camera-mirror' : ''}`}
              />

              {cameraState === 'active' && !scanBanner && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                  <div className="relative h-56 w-72 sm:h-64 sm:w-80 rounded-2xl border border-white/25 bg-transparent shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]">
                    <span className="absolute -left-0.5 -top-0.5 h-6 w-6 rounded-tl-xl border-l-2 border-t-2 border-emerald-400" />
                    <span className="absolute -right-0.5 -top-0.5 h-6 w-6 rounded-tr-xl border-r-2 border-t-2 border-emerald-400" />
                    <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-xl border-b-2 border-l-2 border-emerald-400" />
                    <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-xl border-b-2 border-r-2 border-emerald-400" />
                    <div className="absolute inset-x-4 bottom-3 text-center">
                      <span className="rounded bg-slate-950/80 px-2.5 py-1 text-xs font-medium text-slate-200">
                        Perlihatkan QR atau Barcode ke Kamera
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {cameraState !== 'active' && cameraState !== 'initializing' && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-y-auto bg-slate-950/95 p-6 text-center text-white">
                  <Camera className="h-10 w-10 text-emerald-400" />
                  <h3 className="mt-3 text-base font-semibold">
                    {cameraState === 'permission_denied'
                      ? 'Izin Kamera Diperlukan'
                      : 'Kamera Belum Tersambung'}
                  </h3>
                  <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-slate-300 sm:text-sm">
                    {cameraErrorMsg}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="inline-flex items-center gap-2 rounded-full bg-[#156235] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#11502b] sm:text-sm"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Coba Aktifkan Kamera</span>
                    </button>
                    {isInIframe && (
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-amber-600 sm:text-sm"
                      >
                        <Maximize2 className="h-4 w-4" />
                        <span>Buka di Tab Baru (Izinkan Kamera)</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 sm:text-sm"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Scan Foto Barcode</span>
                    </button>
                  </div>
                  <div className="mt-4 max-w-xl rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-left text-[11px] leading-relaxed text-slate-300">
                    <p className="font-semibold text-emerald-400">
                      Panduan Kamera per Perangkat:
                    </p>
                    <p className="mt-1">
                      <strong>HP / iPad:</strong> Buka langsung URL aplikasi di Chrome (Android) atau Safari (iPad/iPhone), lalu pilih <em>Izinkan Kamera</em>.
                    </p>
                    <p className="mt-0.5">
                      <strong>Laptop:</strong> Klik ikon gembok/kamera di sebelah alamat web &rarr; <em>Allow Camera</em>.
                    </p>
                    <p className="mt-0.5">
                      <strong>Google TV:</strong> Colokkan Webcam USB ke TV &rarr; buka URL aplikasi di browser TV (misal TV Bro / Chrome) &rarr; klik <em>Izinkan</em>.
                    </p>
                  </div>
                </div>
              )}

              {/* High-Contrast Confirmation Overlay (No Room, No Lateness) */}
              {scanBanner && (
                <div className="absolute inset-x-4 bottom-4 z-20 sm:inset-x-8 sm:bottom-6">
                  <div
                    className={`rounded-2xl border p-5 shadow-lg ${
                      scanBanner.result === 'recorded'
                        ? 'border-emerald-500/70 bg-slate-900/95 text-white'
                        : scanBanner.result === 'already_scanned'
                          ? 'border-amber-500/70 bg-slate-900/95 text-white'
                          : 'border-red-500/70 bg-slate-900/95 text-white'
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                            scanBanner.result === 'recorded'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : scanBanner.result === 'already_scanned'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {scanBanner.result === 'recorded' ? (
                            <CheckCircle2 className="h-7 w-7" />
                          ) : scanBanner.result === 'already_scanned' ? (
                            <Clock className="h-7 w-7" />
                          ) : (
                            <AlertCircle className="h-7 w-7" />
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                            <span
                              className={
                                scanBanner.result === 'recorded'
                                  ? 'text-emerald-400'
                                  : scanBanner.result === 'already_scanned'
                                    ? 'text-amber-400'
                                    : 'text-red-400'
                              }
                            >
                              {scanBanner.result === 'recorded'
                                ? 'TANDA KEHADIRAN BERHASIL'
                                : scanBanner.result === 'already_scanned'
                                  ? 'SUDAH TERCATAT HADIR'
                                  : 'BARCODE TIDAK DIKENALI'}
                            </span>
                            {scanBanner.barcodeCode && (
                              <>
                                <span aria-hidden="true" className="text-slate-600">
                                  ·
                                </span>
                                <span className="font-mono text-slate-300">
                                  {scanBanner.barcodeCode}
                                </span>
                              </>
                            )}
                          </div>

                          <p className="mt-1 text-xl font-bold tracking-tight text-white">
                            {scanBanner.teacher ? scanBanner.teacher.name : scanBanner.message}
                          </p>

                          {scanBanner.teacher && scanBanner.attendance && (
                            <p className="mt-1 text-sm text-slate-300">
                              {scanBanner.attendance.sessionName}
                              <span aria-hidden="true" className="mx-2 text-slate-500">
                                ·
                              </span>
                              <span className="font-mono tabular-nums">
                                {new Date(scanBanner.attendance.scannedAt).toLocaleTimeString(
                                  'id-ID',
                                  { hour: '2-digit', minute: '2-digit', second: '2-digit' }
                                )}{' '}
                                WIB
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setScanBanner(null)}
                        className="self-start rounded-full border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 sm:self-center"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Manual / USB Scanner Input */}
            <form
              onSubmit={handleManualSubmit}
              className="flex flex-col gap-2 border-t border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center"
            >
              <div className="relative flex-1">
                <Keyboard className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Atau ketik / tembak scanner USB kode barcode (mis. PGW-BUDI-1234)..."
                  className="w-full rounded-full border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 font-mono text-sm text-white placeholder:font-sans placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !manualCode.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#156235] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#11502b] disabled:opacity-50 whitespace-nowrap shrink-0 min-h-[42px]"
              >
                <ScanLine className="h-4 w-4" />
                <span>Catat Hadir</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Live Session Progress & Latest Check-ins */}
        <div className="flex flex-col gap-4 lg:col-span-4">
          <div
            className={`rounded-2xl p-5 ${
              isTvFullscreen
                ? 'border border-slate-800 bg-slate-900'
                : 'border border-emerald-900/10 bg-white shadow-xs'
            }`}
          >
            <p
              className={`text-xs font-semibold ${
                isTvFullscreen ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Kehadiran {currentSession.name} ({currentSession.startTime}–{currentSession.endTime})
            </p>
            <div className="mt-2 font-display text-3xl font-extrabold tabular-nums text-[#156235]">
              {attendedCountForSession}
              <span
                className={`text-lg font-normal ${
                  isTvFullscreen ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {' '}
                / {teachers.length} Pengawas
              </span>
            </div>
            {teachers.length > 0 && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-[#156235] transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((attendedCountForSession / teachers.length) * 100)
                    )}%`,
                  }}
                />
              </div>
            )}
          </div>

          <div
            className={`flex flex-1 flex-col rounded-2xl ${
              isTvFullscreen
                ? 'border border-slate-800 bg-slate-900'
                : 'border border-emerald-900/10 bg-white shadow-xs'
            }`}
          >
            <div
              className={`flex items-center justify-between border-b px-5 py-4 ${
                isTvFullscreen ? 'border-slate-800' : 'border-slate-100'
              }`}
            >
              <h3 className="text-sm font-bold">Kehadiran Terbaru Hari Ini</h3>
              <span
                className={`font-mono text-xs tabular-nums ${
                  isTvFullscreen ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {recentTodayLogs.length} tercatat
              </span>
            </div>

            {recentTodayLogs.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
                <ScanLine
                  className={`h-8 w-8 ${
                    isTvFullscreen ? 'text-slate-600' : 'text-emerald-200'
                  }`}
                />
                <p
                  className={`mt-3 text-sm font-medium ${
                    isTvFullscreen ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  Belum ada pengawas memindai barcode hari ini
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Setiap barcode yang terbaca kamera akan langsung tampil di sini.
                </p>
              </div>
            ) : (
              <ul
                className={`divide-y ${
                  isTvFullscreen ? 'divide-slate-800' : 'divide-slate-100'
                }`}
              >
                {recentTodayLogs.map((log) => (
                  <li key={log.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {log.teacherName}
                        </p>
                        <p
                          className={`mt-0.5 truncate text-xs ${
                            isTvFullscreen ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {log.sessionName} · {log.deviceType}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="block font-mono text-xs font-semibold tabular-nums text-[#156235]">
                          {new Date(log.scannedAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700">
                          Hadir
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
