import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

import { useGameSession } from '@/core/session'
import { useStatsStore } from '@/stores/stats'
import { useResultStore } from '@/stores/result'

describe('core/session finish 答题明细', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    push.mockClear()
  })

  it('通用字段 + 游戏特有字段写入历史与结算', async () => {
    const session = useGameSession('digit', { seed: 'seed-1' })
    session.addError()
    await session.finish(120, 4, { maxSpan: 6 })

    const detail = useStatsStore().getRecord('digit').history[0].detail
    expect(detail).toMatchObject({ seed: 'seed-1', challenge: true, errors: 1, maxSpan: 6 })
    expect(typeof detail?.durationMs).toBe('number')
    expect(useResultStore().lastResult?.detail).toEqual(detail)
    expect(push).toHaveBeenCalledWith('/result')
  })

  it('非挑战局 challenge 为 false，重复 finish 只记一次', async () => {
    const session = useGameSession('matrix')
    await session.finish(10, 1)
    await session.finish(99, 9)
    const rec = useStatsStore().getRecord('matrix')
    expect(rec.history).toHaveLength(1)
    expect(rec.history[0].detail?.challenge).toBe(false)
  })
})
