let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playScanTone(type: 'success' | 'duplicate' | 'error'): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const playBeep = (freq: number, start: number, duration: number, gainPeak = 0.18) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type === 'error' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };

  if (type === 'success') {
    playBeep(880, now, 0.11);
    playBeep(1174.66, now + 0.1, 0.18);
  } else if (type === 'duplicate') {
    playBeep(660, now, 0.1, 0.14);
    playBeep(660, now + 0.13, 0.12, 0.14);
  } else {
    playBeep(240, now, 0.22, 0.16);
  }
}

export function speakConfirmation(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.02;
    utterance.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find((v) => v.lang.toLowerCase().startsWith('id'));
    if (idVoice) {
      utterance.voice = idVoice;
    }
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis errors on restricted TV browsers
  }
}

export function detectDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Perangkat';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('googletv') || ua.includes('android tv') || ua.includes('smart-tv') || ua.includes('bravia')) {
    return 'Google TV';
  }
  if (ua.includes('ipad') || (ua.includes('macintosh') && navigator.maxTouchPoints > 1)) {
    return 'iPad';
  }
  if (ua.includes('iphone') || (ua.includes('android') && ua.includes('mobile'))) {
    return 'HP';
  }
  if (ua.includes('android')) {
    return 'Tablet Android';
  }
  return 'Laptop / Desktop';
}
