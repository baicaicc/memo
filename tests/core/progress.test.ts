import { describe, expect, it } from 'vitest'
import { dailyBestLevels, gameProgress, pickFocusGame, weeklySummary } from '@/core/progress'
import { games } from '@/games/registry'
import type { GameRecord, HistoryEntry } from '@/stores/stats'

const now = new Date('2026-10-01T20:00:00')
/** daysAgo 天前的某个时刻 */
const at = (daysAgo: number, hour = 12) => {
  const d = new Date(now)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}
const h = (daysAgo: number, level: number, hour = 12): HistoryEntry => ({ score: level * 10, level, at: at(daysAgo, hour) })
const rec = (history: HistoryEntry[]): GameRecord => ({
  bestScore: Math.max(0, ...history.map((x) => x.score)),
  bestLevel: Math.max(0, ...history.map((x) => x.level)),
  history,
})

describe('core/progress dailyBestLevels', () => {
  it('近 14 天旧→新，当天取最高，没玩为 null', () => {
    const pts = dailyBestLevels([h(0, 3, 9), h(0, 5, 18), h(2, 4), h(20, 9)], now)
    expect(pts).toHaveLength(14)
    expect(pts[13]).toEqual({ date: '2026-10-01', level: 5 })
    expect(pts[12].level).toBeNull()
    expect(pts[11]).toEqual({ date: '2026-09-29', level: 4 })
    expect(pts[0].date).toBe('2026-09-18')
    expect(pts.filter((p) => p.level !== null)).toHaveLength(2) // 20 天前的不在窗口内
  })
})

describe('core/progress gameProgress', () => {
  it('近 7 天最高 vs 此前最高', () => {
    expect(gameProgress([h(1, 6), h(6, 4), h(7, 5), h(30, 3)], now)).toEqual({ recent: 6, before: 5, delta: 1 })
  })
  it('只有一段有数据时 delta 为 null', () => {
    expect(gameProgress([h(1, 6)], now).delta).toBeNull()
    expect(gameProgress([h(10, 6)], now)).toEqual({ recent: null, before: 6, delta: null })
  })
})

describe('core/progress pickFocusGame', () => {
  it('取最佳等级/上限最低的游戏', () => {
    const records: Record<string, GameRecord> = {}
    for (const g of games) records[g.id] = rec([h(1, g.maxLevel)])
    records.corsi = rec([h(1, 2)])
    expect(pickFocusGame(records, '2026-10-01')).toBe('corsi')
  })
  it('没玩过的游戏优先；并列时同一天结果稳定', () => {
    const records = { matrix: rec([h(1, 3)]) }
    const a = pickFocusGame(records, '2026-10-01')
    expect(a).not.toBe('matrix')
    expect(pickFocusGame(records, '2026-10-01')).toBe(a)
  })
})

describe('core/progress weeklySummary', () => {
  it('统计天数、局数、进步最大与弱项', () => {
    const records = {
      matrix: rec([h(0, 5), h(1, 4), h(9, 3)]),
      digit: rec([h(2, 6), h(8, 5)]),
      stroop: rec([h(12, 2)]),
    }
    const s = weeklySummary(records, now)
    expect(s.daysPlayed).toBe(3)
    expect(s.sessions).toBe(3)
    expect(s.topGain).toEqual({ gameId: 'matrix', from: 3, to: 5 })
    expect(['corsi', 'nback', 'paired']).toContain(s.focus)
  })
  it('没有上涨时 topGain 为 null', () => {
    expect(weeklySummary({ matrix: rec([h(0, 3), h(9, 3)]) }, now).topGain).toBeNull()
  })
})
