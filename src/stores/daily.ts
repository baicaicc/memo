import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { createRng } from '@/core/rng'
import { games, type GameId } from '@/games/registry'
import { loadJSON, saveJSON, STORAGE_KEYS } from './persist'

export interface DailyTask {
  gameId: GameId
  done: boolean
}

export interface DailyState {
  /** 任务所属日期 YYYY-MM-DD */
  date: string
  tasks: DailyTask[]
  /** 最近一次产生游玩记录的日期 YYYY-MM-DD */
  lastPlayedDate: string | null
  streak: number
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function generateTasks(dateStr: string): DailyTask[] {
  const rng = createRng(`daily:${dateStr}`)
  return rng
    .shuffle(games.map((g) => g.id))
    .slice(0, 3)
    .map((gameId) => ({ gameId, done: false }))
}

export const useDailyStore = defineStore('daily', () => {
  const state = ref<DailyState>(
    loadJSON(STORAGE_KEYS.daily, {
      date: '',
      tasks: [],
      lastPlayedDate: null,
      streak: 0,
    }),
  )

  watch(state, (v) => saveJSON(STORAGE_KEYS.daily, v), { deep: true })

  /** 确保任务属于今天；日期变化时重新生成 3 个任务 */
  function ensureToday(now: Date = new Date()): void {
    const today = formatDate(now)
    if (state.value.date === today) return
    state.value.date = today
    state.value.tasks = generateTasks(today)
  }

  /**
   * 一局结束后调用：勾选对应任务并推进 streak。
   * 昨天玩过 +1；今天已玩过不变；断签则从 1 重新开始。
   */
  function recordPlay(gameId: GameId, now: Date = new Date()): void {
    ensureToday(now)
    const today = formatDate(now)
    const task = state.value.tasks.find((t) => t.gameId === gameId)
    if (task) task.done = true

    if (state.value.lastPlayedDate === today) return
    const yesterday = formatDate(new Date(now.getTime() - 86400000))
    state.value.streak =
      state.value.lastPlayedDate === yesterday ? state.value.streak + 1 : 1
    state.value.lastPlayedDate = today
  }

  const tasks = computed(() => state.value.tasks)
  const streak = computed(() => state.value.streak)
  const allDone = computed(
    () => state.value.tasks.length > 0 && state.value.tasks.every((t) => t.done),
  )
  /** 今日流程里第一个未完成的游戏；全部完成返回 null（「一键今日训练」用） */
  const nextPending = computed(() => state.value.tasks.find((t) => !t.done)?.gameId ?? null)

  return { state, tasks, streak, allDone, nextPending, ensureToday, recordPlay }
})
