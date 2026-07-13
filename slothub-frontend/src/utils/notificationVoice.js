import api from '../api/axios';

const VOICE_PREF_KEY = 'slothub_vendor_voice_alerts';

export const isVoiceAlertEnabled = () => localStorage.getItem(VOICE_PREF_KEY) !== '0';

export const setVoiceAlertEnabled = (enabled) => {
  localStorage.setItem(VOICE_PREF_KEY, enabled ? '1' : '0');
};

let sharedAudio = null;
let audioUnlocked = false;
let speechChain = Promise.resolve();

export const isVoiceUnlocked = () => audioUnlocked;

const formatForSpeech = (text) =>
  String(text || '')
    .replace(/#/g, ' số ')
    .replace(/·/g, ', ')
    .replace(/(\d+)\.(\d{3})/g, '$1 $2')
    .replace(/đ\b/g, ' đồng')
    .replace(/⭐/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getSpeechText = (payload = {}) => {
  if (payload.speakText) return String(payload.speakText).trim();
  if (payload.title && payload.message) return formatForSpeech(`${payload.title}. ${payload.message}`);
  return formatForSpeech(payload.message || 'Có đơn hàng mới!');
};

const getSharedAudio = () => {
  if (!sharedAudio) sharedAudio = new Audio();
  return sharedAudio;
};

export const unlockNotificationVoice = async () => {
  if (audioUnlocked) return true;
  try {
    const audio = getSharedAudio();
    audio.volume = 0.01;
    audio.muted = false;
    audio.src =
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
    audioUnlocked = true;
    return true;
  } catch {
    return false;
  }
};

const speakWithBrowserTTS = (text) =>
  new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    const viVoice =
      voices.find((v) => v.lang === 'vi-VN') ||
      voices.find((v) => v.lang?.startsWith('vi')) ||
      null;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'vi-VN';
    utter.rate = 0.88;
    utter.volume = 1;
    if (viVoice) utter.voice = viVoice;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    synth.speak(utter);
  });

const playAudioBlob = async (blob) => {
  const audio = getSharedAudio();
  const url = URL.createObjectURL(blob);
  audio.volume = 1;
  audio.muted = false;
  audio.src = url;

  await new Promise((resolve, reject) => {
    const cleanup = () => URL.revokeObjectURL(url);
    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error('audio play failed'));
    };
    audio.play().catch(reject);
  });
};

const getOrderAlertKey = (payload = {}) => {
  if (payload.orderId) return `order:${String(payload.orderId)}`;
  return `text:${getSpeechText(payload)}`;
};

const playPayload = async (payload) => {
  const text = getSpeechText(payload);
  if (!text) return;

  try {
    const res = await api.get('/tts/speak', {
      params: { text },
      responseType: 'blob',
      timeout: 20000,
    });
    await playAudioBlob(res.data);
  } catch (err) {
    console.warn('[voice] Server TTS failed, fallback browser:', err?.message);
    await speakWithBrowserTTS(text);
  }
};

/**
 * Đọc thông báo đơn mới — xếp hàng tuần tự, không chồng âm thanh.
 */
export const speakNewOrderAlert = (payload = {}) => {
  if (!isVoiceAlertEnabled()) return Promise.resolve();
  const text = getSpeechText(payload);
  if (!text) return Promise.resolve();

  const key = getOrderAlertKey(payload);
  if (speakNewOrderAlert._queued?.has(key)) return Promise.resolve();
  if (!speakNewOrderAlert._queued) speakNewOrderAlert._queued = new Set();
  speakNewOrderAlert._queued.add(key);
  window.setTimeout(() => speakNewOrderAlert._queued.delete(key), 30000);

  speechChain = speechChain
    .then(() => new Promise((r) => window.setTimeout(r, 400)))
    .then(() => playPayload(payload))
    .catch((err) => console.warn('[voice] queue error:', err?.message));

  return speechChain;
};

export const speakVoicePreview = async () => {
  const text =
    'Chú ý! Quầy RiceGood có đơn mới từ sinh viên. 1 món, thanh toán bốn mươi nghìn đồng. Nhận lúc 11 giờ 30 đến 12 giờ.';

  speechChain = Promise.resolve();
  speakNewOrderAlert._queued = new Set();

  try {
    await playPayload({ speakText: text });
    audioUnlocked = true;
    return true;
  } catch (err) {
    console.warn('[voice] Preview failed:', err?.message);
    await speakWithBrowserTTS(text);
    audioUnlocked = true;
    return true;
  }
};