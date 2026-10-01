/**
 * 进步统计（MEMO-22）：只看等级不看得分——得分受难度影响，等级才是能力的刻度。
 * 日期一律按本机时区（core/date），与打卡、每日任务同一口径。
 */
import { createRng } from './rng'
import { addDays, formatDate } from './date'
import { games, type GameId } from '@/games/registry'
import type { GameRecord, HistoryEntry } from '@/stores/stats'

export interface DayPoint {
  /** YYYY-MM-DD */
  date: string
  /** 当天最高等级；没玩为 null */
  level: number | null
}

function bestByDate(history: HistoryEntry[]): Map<string, number> {
  const best = new Map<string, number>()
  for (const h of history) {
    const d = formatDate(new Date(h.at))
    best.set(d, Math.max(best.get(d) ?? 0, h.level))
  }
  return best
}

/** 最近 days 天（含今天，旧→新）每天的最高等级 */
export function dailyBestLevels(history: HistoryEntry[], now: Date, days = 14): DayPoint[] {
  const best = bestByDate(history)
  const out: DayPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = formatDate(addDays(now, -i))
    out.push({ date, level: best.get(date) ?? null })
  }
  return out
}

export interface GameProgress {
  /** 近 windowDays 天（含今天）的最高等级 */
  recent: number | null
  /** 此前的最高等级 */
  before: number | null
  /** recent - before；两段都有数据才有值 */
  delta: number | null
}

export function gameProgress(history: HistoryEntry[], now: Date, windowDays = 7): GameProgress {
  const start = formatDate(addDays(now, -(windowDays - 1)))
  let recent: number | null = null
  let before: number | null = null
  for (const [date, level] of bestByDate(history)) {
    if (date >= start) recent = Math.max(recent ?? 0, level)
    else before = Math.max(before ?? 0, level)
  }
  return { recent, before, delta: recent !== null && before !== null ? recent - before : null }
}

/**
 * 今天最该练的游戏：最佳等级 / 等级上限 最低（没玩过的算 0）。
 * 并列时按日期种子挑，同一天在各设备上结果一致。
 */
export function pickFocusGame(records: Record<string, GameRecord>, dateStr: string): GameId {
  const ratio = (id: GameId, max: number) => (records[id]?.bestLevel ?? 0) / max
  const min = Math.min(...games.map((g) => ratio(g.id, g.maxLevel)))
  const ties = games.filter((g) => ratio(g.id, g.maxLevel) === min).map((g) => g.id)
  return createRng(`focus:${dateStr}`).pick(ties)
}

export interface WeeklySummary {
  /** 近 7 天里有成绩的天数 */
  daysPlayed: number
  sessions: number
  /** 近 7 天比此前最高等级涨得最多的游戏；没有上涨为 null */
  topGain: { gameId: GameId; from: number; to: number } | null
  focus: GameId
}

export function weeklySummary(records: Record<string, GameRecord>, now: Date): WeeklySummary {
  const start = formatDate(addDays(now, -6))
  const days = new Set<string>()
  let sessions = 0
  let topGain: WeeklySummary['topGain'] = null

  for (const g of games) {
    const history = records[g.id]?.history ?? []
    for (const h of history) {
      const d = formatDate(new Date(h.at))
      if (d >= start) {
        days.add(d)
        sessions++
      }
    }
    const p = gameProgress(history, now)
    if (p.delta !== null && p.delta > 0 && (!topGain || p.delta > topGain.to - topGain.from)) {
      topGain = { gameId: g.id, from: p.before!, to: p.recent! }
    }
  }

  return { daysPlayed: days.size, sessions, topGain, focus: pickFocusGame(records, formatDate(now)) }
}
