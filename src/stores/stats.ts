import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { games, type Dimension, type GameId } from '@/games/registry'
import { loadJSON, saveJSON, STORAGE_KEYS } from './persist'

export interface HistoryEntry {
  score: number
  level: number
  detail?: unknown
  /** 毫秒时间戳 */
  at: number
}

export interface GameRecord {
  bestScore: number
  bestLevel: number
  /** 最近最多 30 局，新的在前 */
  history: HistoryEntry[]
}

export interface RecordResultInput {
  score: number
  level: number
  detail?: unknown
}

export interface RecordResultOutcome {
  isBestScore: boolean
  isBestLevel: boolean
}

const HISTORY_LIMIT = 30

type StatsState = Record<string, GameRecord>

export const useStatsStore = defineStore('stats', () => {
  const records = ref<StatsState>(loadJSON(STORAGE_KEYS.stats, {}))

  watch(records, (v) => saveJSON(STORAGE_KEYS.stats, v), { deep: true })

  function recordResult(
    gameId: GameId,
    result: RecordResultInput,
    at: number = Date.now(),
  ): RecordResultOutcome {
    const rec: GameRecord =
      records.value[gameId] ?? { bestScore: 0, bestLevel: 0, history: [] }
    const isBestScore = result.score > rec.bestScore
    const isBestLevel = result.level > rec.bestLevel
    rec.bestScore = Math.max(rec.bestScore, result.score)
    rec.bestLevel = Math.max(rec.bestLevel, result.level)
    rec.history.unshift({ ...result, at })
    if (rec.history.length > HISTORY_LIMIT) rec.history.length = HISTORY_LIMIT
    records.value[gameId] = rec
    return { isBestScore, isBestLevel }
  }

  function getRecord(gameId: GameId): GameRecord {
    return (
      records.value[gameId] ?? { bestScore: 0, bestLevel: 0, history: [] }
    )
  }

  /** 雷达：同一维度多个游戏取最佳，最佳等级 / maxLevel 归一化到 0–100 */
  const radar = computed<Record<Dimension, number>>(() => {
    const out = {} as Record<Dimension, number>
    for (const g of games) {
      const best = getRecord(g.id).bestLevel
      const v = Math.min(100, Math.round((best / g.maxLevel) * 100))
      out[g.dimension] = Math.max(out[g.dimension] ?? 0, v)
    }
    return out
  })

  /** 综合脑力指数 = 各维度平均（0–100） */
  const brainIndex = computed(() => {
    const values = Object.values(radar.value)
    if (!values.length) return 0
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  })

  return { records, recordResult, getRecord, radar, brainIndex }
})
