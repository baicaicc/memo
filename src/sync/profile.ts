/**
 * 云端存档的数据形态与合并规则（MEMO-6）。
 * 前端与边缘函数（server/）共用本文件：只依赖纯 TS，不碰 Vue / 浏览器 API / 时区。
 */
import type { GameRecord } from '@/stores/stats'
import type { DailyState } from '@/stores/daily'

export const PROFILE_VERSION = 1
/** 与 stores/stats 的 HISTORY_LIMIT 一致 */
export const HISTORY_LIMIT = 200

export interface Profile {
  v: typeof PROFILE_VERSION
  stats: Record<string, GameRecord>
  daily: DailyState
}

export function emptyDaily(): DailyState {
  return { date: '', tasks: [], lastPlayedDate: null, streak: 0 }
}

export function emptyProfile(): Profile {
  return { v: PROFILE_VERSION, stats: {}, daily: emptyDaily() }
}

// ---- 恢复码 ----

/** Crockford Base32：去掉 I/L/O/U，避免与 1/0 及不雅词混淆 */
export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const CODE_LENGTH = 8

/** bytes 至少 CODE_LENGTH 个随机字节；32 整除 256，取模无偏 */
export function codeFromBytes(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % 32]
  return out
}

/** 用户输入宽松处理：去空白和连字符，转大写，O→0、I/L→1 */
export function normalizeCode(input: string): string | null {
  const s = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
  if (s.length !== CODE_LENGTH) return null
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return null
  return s
}

// ---- 合并 ----

function mergeRecord(a: GameRecord | undefined, b: GameRecord | undefined): GameRecord {
  const seen = new Set<string>()
  const history = [...(a?.history ?? []), ...(b?.history ?? [])]
    .filter((h) => {
      const key = `${h.at}|${h.score}|${h.level}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((x, y) => y.at - x.at)
    .slice(0, HISTORY_LIMIT)
  return {
    bestScore: Math.max(a?.bestScore ?? 0, b?.bestScore ?? 0),
    bestLevel: Math.max(a?.bestLevel ?? 0, b?.bestLevel ?? 0),
    history,
  }
}

function mergeDaily(a: DailyState, b: DailyState): DailyState {
  // 打卡：以最近一次游玩日期更晚的一方为准，同一天取较大 streak
  const la = a.lastPlayedDate ?? ''
  const lb = b.lastPlayedDate ?? ''
  const play = la > lb ? a : lb > la ? b : a.streak >= b.streak ? a : b

  // 今日任务：取日期更晚的一份；同一天按游戏合并完成状态
  let date = a.date
  let tasks = a.tasks
  if (b.date > a.date) {
    date = b.date
    tasks = b.tasks
  } else if (b.date === a.date) {
    const doneInB = new Set(b.tasks.filter((t) => t.done).map((t) => t.gameId))
    tasks = a.tasks.map((t) => ({ ...t, done: t.done || doneInB.has(t.gameId) }))
  }

  return {
    date,
    tasks: tasks.map((t) => ({ ...t })),
    lastPlayedDate: play.lastPlayedDate,
    streak: play.streak,
  }
}

/** 两份档案取并集：历史去重合并、最佳取大、打卡取最近。满足交换律与幂等，前后端各算一遍结果一致 */
export function mergeProfiles(a: Profile, b: Profile): Profile {
  const stats: Record<string, GameRecord> = {}
  for (const id of new Set([...Object.keys(a.stats), ...Object.keys(b.stats)])) {
    stats[id] = mergeRecord(a.stats[id], b.stats[id])
  }
  return { v: PROFILE_VERSION, stats, daily: mergeDaily(a.daily, b.daily) }
}

// ---- 校验（服务端收到的数据不可信） ----

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x)
}

/** 结构不对返回 null；只保留已知字段，丢弃多余内容 */
export function sanitizeProfile(input: unknown): Profile | null {
  if (!isObject(input) || input.v !== PROFILE_VERSION) return null
  if (!isObject(input.stats) || !isObject(input.daily)) return null

  const stats: Record<string, GameRecord> = {}
  for (const [id, rec] of Object.entries(input.stats)) {
    if (!/^[a-z]{1,16}$/.test(id) || !isObject(rec) || !Array.isArray(rec.history)) return null
    if (!isNum(rec.bestScore) || !isNum(rec.bestLevel)) return null
    const history: GameRecord['history'] = []
    for (const h of rec.history.slice(0, HISTORY_LIMIT)) {
      if (!isObject(h) || !isNum(h.score) || !isNum(h.level) || !isNum(h.at)) return null
      history.push({
        score: h.score,
        level: h.level,
        at: h.at,
        ...(isObject(h.detail) ? { detail: h.detail } : {}),
      })
    }
    stats[id] = { bestScore: rec.bestScore, bestLevel: rec.bestLevel, history }
  }

  const d = input.daily
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (typeof d.date !== 'string' || (d.date !== '' && !dateRe.test(d.date))) return null
  if (!Array.isArray(d.tasks) || !isNum(d.streak)) return null
  if (d.lastPlayedDate !== null && !(typeof d.lastPlayedDate === 'string' && dateRe.test(d.lastPlayedDate)))
    return null
  const tasks: DailyState['tasks'] = []
  for (const t of d.tasks.slice(0, 10)) {
    if (!isObject(t) || typeof t.gameId !== 'string' || typeof t.done !== 'boolean') return null
    tasks.push({ gameId: t.gameId as DailyState['tasks'][number]['gameId'], done: t.done })
  }

  return {
    v: PROFILE_VERSION,
    stats,
    daily: { date: d.date, tasks, lastPlayedDate: d.lastPlayedDate, streak: d.streak },
  }
}
