import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDailyStore, formatDate } from '@/stores/daily'

function day(s: string): Date {
  return new Date(`${s}T12:00:00`)
}

describe('stores/daily', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('每天生成 3 个任务，同日重复生成结果一致', () => {
    const daily = useDailyStore()
    daily.ensureToday(day('2026-09-26'))
    const first = daily.tasks.map((t) => t.gameId)
    expect(first.length).toBe(3)
    expect(new Set(first).size).toBe(3)

    setActivePinia(createPinia())
    const daily2 = useDailyStore()
    daily2.ensureToday(day('2026-09-26'))
    expect(daily2.tasks.map((t) => t.gameId)).toEqual(first)
  })

  it('recordPlay 勾选对应任务', () => {
    const daily = useDailyStore()
    const now = day('2026-09-26')
    daily.ensureToday(now)
    const target = daily.tasks[0].gameId
    daily.recordPlay(target, now)
    expect(daily.tasks.find((t) => t.gameId === target)?.done).toBe(true)
    expect(daily.allDone).toBe(false)
  })

  it('streak：首玩为 1，连续天 +1，同日重复不变', () => {
    const daily = useDailyStore()
    daily.recordPlay('matrix', day('2026-09-25'))
    expect(daily.streak).toBe(1)

    daily.recordPlay('matrix', day('2026-09-26'))
    expect(daily.streak).toBe(2)

    daily.recordPlay('corsi', day('2026-09-26'))
    expect(daily.streak).toBe(2)
  })

  it('streak：断签归零重新计数', () => {
    const daily = useDailyStore()
    daily.recordPlay('matrix', day('2026-09-20'))
    expect(daily.streak).toBe(1)
    daily.recordPlay('matrix', day('2026-09-26'))
    expect(daily.streak).toBe(1)
  })

  it('跨天后重新生成任务', () => {
    const daily = useDailyStore()
    daily.ensureToday(day('2026-09-25'))
    const oldTasks = daily.tasks.map((t) => ({ ...t }))
    daily.recordPlay(oldTasks[0].gameId, day('2026-09-25'))

    daily.ensureToday(day('2026-09-26'))
    expect(daily.state.date).toBe('2026-09-26')
    expect(daily.tasks.every((t) => !t.done)).toBe(true)
    expect(formatDate(day('2026-09-26'))).toBe('2026-09-26')
  })
})
