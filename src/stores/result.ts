import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { GameId } from '@/games/registry'
import { loadJSON, saveJSON, STORAGE_KEYS } from './persist'

export interface GameResult {
  gameId: GameId
  score: number
  level: number
  isBestScore: boolean
  isBestLevel: boolean
  /** 本局使用的种子，用于挑战链接复现同一题 */
  seed: string
  detail?: unknown
  at: number
}

export const useResultStore = defineStore('result', () => {
  const lastResult = ref<GameResult | null>(
    loadJSON<GameResult | null>(STORAGE_KEYS.result, null),
  )

  watch(lastResult, (v) => saveJSON(STORAGE_KEYS.result, v))

  function setResult(result: GameResult): void {
    lastResult.value = result
  }

  function clear(): void {
    lastResult.value = null
  }

  return { lastResult, setResult, clear }
})
