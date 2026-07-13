let sharedCtx = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) sharedCtx = new AudioCtx();
  return sharedCtx;
};

/** Gọi sau tương tác người dùng để trình duyệt cho phép phát âm thanh */
export const unlockNotificationAudio = async () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
};

const playTone = (ctx, { freq, start, duration, volume = 0.22, type = 'sine' }) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
};

/**
 * Tiếng chuông thông báo đơn mới — hai nốt ting-ting kiểu chuông quầy.
 */
export const playNewOrderBell = async () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();

    const t = ctx.currentTime;
    // Ting
    playTone(ctx, { freq: 1046.5, start: t, duration: 0.35, volume: 0.28 });
    playTone(ctx, { freq: 1318.5, start: t + 0.02, duration: 0.3, volume: 0.12, type: 'triangle' });
    // Ting
    playTone(ctx, { freq: 1174.7, start: t + 0.22, duration: 0.4, volume: 0.26 });
    playTone(ctx, { freq: 1568, start: t + 0.24, duration: 0.35, volume: 0.1, type: 'triangle' });
  } catch (err) {
    console.warn('Không phát được tiếng chuông:', err);
  }
};