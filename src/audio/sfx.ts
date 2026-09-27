// 轻量音效：WebAudio 现场合成，零依赖零资产文件。
// 微信内浏览器禁止无手势播放，靠 initSfx 的双保险解锁；静音状态持久化到 localStorage。
export type SoundName =
  | 'tap' // 轻点/答对一格
  | 'correct' // 答对一道
  | 'wrong' // 答错
  | 'levelup' // 本轮过关/升级
  | 'degrade' // 降级
  | 'finish' // 整局结算

const STORE_KEY = 'memo:muted'

interface Tone {
  /** 频率 Hz */
  f: number
  /** 相对开始的偏移 ms */
  at: number
  /** 时长 ms */
  dur: number
  /** 波形 */
  wave: OscillatorType
  /** 音量 0–1 */
  gain: number
}

const SOUNDS: Record<SoundName, Tone[]> = {
  tap: [{ f: 1250, at: 0, dur: 40, wave: 'sine', gain: 0.12 }],
  correct: [
    { f: 660, at: 0, dur: 90, wave: 'sine', gain: 0.18 },
    { f: 880, at: 80, dur: 120, wave: 'sine', gain: 0.18 },
  ],
  wrong: [{ f: 170, at: 0, dur: 180, wave: 'sawtooth', gain: 0.14 }],
  levelup: [
    { f: 523, at: 0, dur: 90, wave: 'triangle', gain: 0.16 },
    { f: 659, at: 80, dur: 90, wave: 'triangle', gain: 0.16 },
    { f: 784, at: 160, dur: 150, wave: 'triangle', gain: 0.16 },
  ],
  degrade: [
    { f: 440, at: 0, dur: 110, wave: 'triangle', gain: 0.15 },
    { f: 330, at: 100, dur: 110, wave: 'triangle', gain: 0.15 },
    { f: 262, at: 200, dur: 160, wave: 'triangle', gain: 0.15 },
  ],
  finish: [
    { f: 523, at: 0, dur: 350, wave: 'sine', gain: 0.1 },
    { f: 659, at: 0, dur: 350, wave: 'sine', gain: 0.1 },
    { f: 784, at: 0, dur: 350, wave: 'sine', gain: 0.1 },
  ],
}

let ctx: AudioContext | null = null
let inited = false

export function isMuted(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) === '1'
  } catch {
    return false
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  return ctx
}

/** 播放一个音效；静音、未解锁或环境不支持时静默跳过，绝不抛错 */
export function play(name: SoundName): void {
  if (inited === false || isMuted()) return
  const audio = getCtx()
  if (!audio) return
  if (audio.state === 'suspended') void audio.resume()
  const t0 = audio.currentTime
  for (const tone of SOUNDS[name]) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    const start = t0 + tone.at / 1000
    const end = start + tone.dur / 1000
    osc.type = tone.wave
    osc.frequency.value = tone.f
    gain.gain.setValueAtTime(tone.gain, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)
    osc.connect(gain).connect(audio.destination)
    osc.start(start)
    osc.stop(end)
  }
}

/** 解锁音频：微信 WeixinJSBridgeReady + 首次手势双保险；幂等，main.ts 调一次 */
export function initSfx(): void {
  if (inited) return
  inited = true
  const warm = () => {
    const audio = getCtx()
    if (audio && audio.state === 'suspended') void audio.resume()
  }
  if (typeof document === 'undefined') return
  document.addEventListener('WeixinJSBridgeReady', warm, { once: true })
  const onGesture = () => {
    warm()
    document.removeEventListener('touchstart', onGesture)
    document.removeEventListener('click', onGesture)
  }
  document.addEventListener('touchstart', onGesture, { passive: true })
  document.addEventListener('click', onGesture)
}

export function toggleMuted(): boolean {
  const next = !isMuted()
  try {
    localStorage.setItem(STORE_KEY, next ? '1' : '0')
  } catch {
    /* 私密模式等存储不可用时仅不持久化 */
  }
  return next
}
