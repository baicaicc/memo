export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 存储满/隐私模式下静默失败
  }
}

export const STORAGE_KEYS = {
  stats: 'memo:stats',
  daily: 'memo:daily',
  result: 'memo:result',
} as const
