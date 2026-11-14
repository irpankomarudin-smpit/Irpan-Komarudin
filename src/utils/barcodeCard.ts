import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import type { InstitutionSettings, Teacher } from '../types';

export function generateDraftBarcodeCode(name: string, salt: number): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .trim();

  if (!cleaned) return '';
  const firstToken = (cleaned.split(/\s+/)[0] || 'GURU').slice(0, 6);
  let hash = salt;
  for (let i = 0; i < cleaned.length; i += 1) {
    hash = (hash * 31 + cleaned.charCodeAt(i)) % 9000;
  }
  const suffix = String(1000 + (Math.abs(hash) % 9000));
  return `PGW-${firstToken}-${suffix}`;
}

function loadLogoImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function downloadProctorCardPng(
  teacher: Teacher,
  settings: InstitutionSettings
): Promise<void> {
  const width = 960;
  const height = 560;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clean White Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Al-Multazam Emerald Green Top Header Band
  ctx.fillStyle = '#156235';
  ctx.fillRect(0, 0, width, 134);

  // Warm Gold Accent Wave Line
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(0, 134, width, 7);

  // Official Logo on Header
  const logoImg = await loadLogoImage('/assets/logo-smpit-almultazam.png');
  let textStartX = 48;
  if (logoImg) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(88, 67, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(logoImg, 52, 31, 72, 72);
    textStartX = 152;
  }

  // Header Typography
  ctx.fillStyle = '#D1FAE5';
  ctx.font = '600 17px "DM Sans", sans-serif';
  ctx.fillText(settings.institutionName.toUpperCase(), textStartX, 50);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`LMS Pengawas Ujian SMPIT AL-MULTAZAM`, textStartX, 90);

  // Outer Border
  ctx.strokeStyle = '#BBF7D0';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // QR Code Box
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, teacher.barcodeCode, {
    width: 240,
    margin: 1,
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
  });
  ctx.strokeStyle = '#D1FAE5';
  ctx.lineWidth = 2;
  ctx.strokeRect(656, 174, 256, 256);
  ctx.drawImage(qrCanvas, 664, 182, 240, 240);

  ctx.fillStyle = '#156235';
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TUNJUKKAN KE KAMERA', 784, 456);
  ctx.textAlign = 'left';

  // Teacher Details
  ctx.fillStyle = '#156235';
  ctx.font = '600 16px "DM Sans", sans-serif';
  ctx.fillText('NAMA GURU / PENGAWAS', 48, 200);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 34px "Plus Jakarta Sans", sans-serif';
  const displayName = teacher.name.length > 28 ? `${teacher.name.slice(0, 26)}...` : teacher.name;
  ctx.fillText(displayName, 48, 246);

  ctx.fillStyle = '#475569';
  ctx.font = '500 20px "DM Sans", sans-serif';
  const infoParts = [
    teacher.nip ? `NIP/ID: ${teacher.nip}` : null,
    teacher.subject || null,
  ].filter(Boolean);
  ctx.fillText(infoParts.length > 0 ? infoParts.join('  ·  ') : settings.examTitle, 48, 288);

  ctx.fillStyle = '#156235';
  ctx.font = '600 17px "DM Sans", sans-serif';
  ctx.fillText('Sesi 1 (07:30–09:30)  ·  Sesi 2 (10:00–11:30)', 48, 330);

  // 1D Code128 Barcode
  const barcodeCanvas = document.createElement('canvas');
  JsBarcode(barcodeCanvas, teacher.barcodeCode, {
    format: 'CODE128',
    lineColor: '#0F172A',
    width: 2.3,
    height: 76,
    displayValue: true,
    font: 'JetBrains Mono, monospace',
    fontSize: 18,
    margin: 8,
    background: '#FFFFFF',
  });
  ctx.drawImage(barcodeCanvas, 40, 368);

  // Footer
  ctx.fillStyle = '#64748B';
  ctx.font = '400 15px "DM Sans", sans-serif';
  ctx.fillText(
    `Tahun Ajaran ${settings.academicYear} · Cukup perlihatkan QR atau Barcode ke kamera untuk tanda kehadiran`,
    48,
    526
  );

  const link = document.createElement('a');
  const slug = teacher.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  link.download = `kartu-pengawas-${slug || teacher.barcodeCode.toLowerCase()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
