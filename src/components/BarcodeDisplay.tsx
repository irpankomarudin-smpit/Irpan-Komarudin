import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

interface BarcodeDisplayProps {
  code: string;
  size?: 'sm' | 'md' | 'lg';
  showLinear?: boolean;
  showQr?: boolean;
}

export function BarcodeDisplay({
  code,
  size = 'md',
  showLinear = true,
  showQr = true,
}: BarcodeDisplayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const qrPixels = size === 'lg' ? 176 : size === 'md' ? 128 : 88;
  const barHeight = size === 'lg' ? 52 : size === 'md' ? 42 : 32;
  const barWidth = size === 'lg' ? 1.8 : size === 'md' ? 1.45 : 1.15;

  useEffect(() => {
    if (!code || !showQr) {
      setQrDataUrl('');
      return;
    }
    let active = true;
    QRCode.toDataURL(code, {
      width: qrPixels * 2,
      margin: 1,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [code, qrPixels, showQr]);

  useEffect(() => {
    if (!code || !showLinear || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, code, {
        format: 'CODE128',
        lineColor: '#0F172A',
        width: barWidth,
        height: barHeight,
        displayValue: true,
        font: 'JetBrains Mono, monospace',
        fontSize: size === 'sm' ? 11 : 13,
        margin: 4,
        background: '#FFFFFF',
      });
    } catch {
      // Ignore transient invalid characters while typing
    }
  }, [code, barHeight, barWidth, showLinear, size]);

  if (!code) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
        <p className="text-sm font-medium text-slate-600">
          Barcode akan dibuat otomatis
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Mulai ketik nama guru pada kolom di samping.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {showQr && qrDataUrl && (
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <img
            src={qrDataUrl}
            alt={`QR Code ${code}`}
            style={{ width: qrPixels, height: qrPixels }}
            className="block"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      {showLinear && (
        <div className="max-w-full overflow-hidden rounded-md border border-slate-200 bg-white px-2 py-1">
          <svg ref={svgRef} className="max-w-full h-auto" aria-label={`Barcode ${code}`} />
        </div>
      )}
    </div>
  );
}
