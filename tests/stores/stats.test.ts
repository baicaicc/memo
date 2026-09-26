import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useStatsStore } from '@/stores/stats'
import { STORAGE_KEYS } from '@/stores/persist'

describe('stores/stats', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('recordResult 更新 best 并返回是否破纪录', () => {
    const stats = useStatsStore()
    const r1 = stats.recordResult('matrix', { score: 100, level: 3 })
    expect(r1).toEqual({ isBestScore: true, isBestLevel: true })
    const r2 = stats.recordResult('matrix', { score: 80, level: 2 })
    expect(r2).toEqual({ isBestScore: false, isBestLevel: false })
    const rec = stats.getRecord('matrix')
    expect(rec.bestScore).toBe(100)
    expect(rec.bestLevel).toBe(3)
  })

  it('history 最多保留最近 30 局且新的在前', () => {
    const stats = useStatsStore()
    for (let i = 1; i <= 35; i++) {
      stats.recordResult('corsi', { score: i, level: 1 })
    }
    const rec = stats.getRecord('corsi')
    expect(rec.history.length).toBe(30)
    expect(rec.history[0].score).toBe(35)
    expect(rec.history[29].score).toBe(6)
  })

  it('雷达按最佳等级/maxLevel 归一化到 0–100，脑力指数为四维平均', () => {
    const stats = useStatsStore()
    expect(stats.radar).toEqual({ spatial: 0, sequence: 0, verbal: 0, reaction: 0 })
    expect(stats.brainIndex).toBe(0)

    stats.recordResult('matrix', { score: 0, level: 5 }) // maxLevel 10 → 50
    stats.recordResult('digit', { score: 0, level: 6 }) // maxLevel 12 → 50
    expect(stats.radar.spatial).toBe(50)
    expect(stats.radar.verbal).toBe(50)
    expect(stats.radar.sequence).toBe(0)
    expect(stats.brainIndex).toBe(25)

    // 超过 maxLevel 时截断到 100
    stats.recordResult('stroop', { score: 0, level: 99 })
    expect(stats.radar.reaction).toBe(100)
  })

  it('持久化到 localStorage', async () => {
    const stats = useStatsStore()
    stats.recordResult('matrix', { score: 42, level: 4 })
    await nextTick()
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.stats)!)
    expect(raw.matrix.bestScore).toBe(42)
    expect(raw.matrix.bestLevel).toBe(4)
  })
})
