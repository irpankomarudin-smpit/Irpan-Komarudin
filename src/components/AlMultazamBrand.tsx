import { useState } from 'react';

export function AlMultazamCrest({ className = 'h-16 w-16' }: { className?: string }) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div
        className={`flex items-center justify-center rounded-full border-2 border-[#156235] bg-emerald-50 font-display text-xs font-extrabold text-[#156235] ${className}`}
      >
        SMPIT
      </div>
    );
  }

  return (
    <img
      src="/assets/logo-smpit-almultazam.png"
      alt="Logo SMPIT AL-MULTAZAM Kabupaten Kuningan Jawa Barat"
      onError={() => setImgError(true)}
      className={`object-contain select-none ${className}`}
      referrerPolicy="no-referrer"
    />
  );
}

export function TopWaveBanner() {
  return (
    <svg
      viewBox="0 0 1200 72"
      preserveAspectRatio="none"
      className="pointer-events-none h-10 w-full sm:h-12"
      aria-hidden="true"
    >
      <path
        d="M0 0H1200V24C1020 52 840 12 620 26C390 41 190 58 0 22V0Z"
        fill="#156235"
      />
      <path
        d="M0 14C210 52 410 26 630 14C860 2 1030 40 1200 16V26C1020 50 850 14 630 24C410 34 210 62 0 26V14Z"
        fill="#F59E0B"
      />
    </svg>
  );
}

export function SidebarBottomWave() {
  return (
    <svg
      viewBox="0 0 260 110"
      preserveAspectRatio="none"
      className="pointer-events-none h-24 w-full"
      aria-hidden="true"
    >
      <path
        d="M0 44C58 24 118 68 184 52C218 44 242 28 260 18V110H0V44Z"
        fill="#156235"
      />
      <path
        d="M0 32C62 12 124 56 190 40C220 32 242 18 260 10V22C242 30 220 44 190 52C124 68 62 24 0 44V32Z"
        fill="#F59E0B"
      />
      <path
        d="M0 72C75 56 150 96 260 64V110H0V72Z"
        fill="#0E4A27"
      />
    </svg>
  );
}

export function HeroCardAccentLeft() {
  return (
    <svg
      viewBox="0 0 120 220"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-y-0 left-0 h-full w-20 sm:w-24"
      aria-hidden="true"
    >
      <path
        d="M0 0H86C44 58 46 146 92 220H0V0Z"
        fill="#156235"
      />
      <path
        d="M72 0H86C44 58 46 146 92 220H78C34 146 34 58 72 0Z"
        fill="#F59E0B"
      />
    </svg>
  );
}

export function HeroCardAccentRight() {
  return (
    <svg
      viewBox="0 0 260 120"
      preserveAspectRatio="none"
      className="pointer-events-none absolute bottom-0 right-0 h-20 w-52 sm:h-24 sm:w-64"
      aria-hidden="true"
    >
      <path
        d="M260 20C205 20 155 68 86 92C48 105 22 114 0 120H260V20Z"
        fill="#156235"
        fillOpacity="0.14"
      />
      <path
        d="M260 44C212 46 164 84 96 106C64 116 38 119 16 120H260V44Z"
        fill="#156235"
        fillOpacity="0.9"
      />
      <path
        d="M260 38C210 40 162 78 94 102C68 111 46 116 24 120H46C70 114 94 107 118 98C178 76 218 46 260 46V38Z"
        fill="#F59E0B"
      />
    </svg>
  );
}
