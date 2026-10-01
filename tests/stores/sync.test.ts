import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSyncStore } from '@/stores/sync'
import { useStatsStore } from '@/stores/stats'
import { emptyProfile, type Profile } from '@/sync/profile'

function reply(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

const remoteWith = (at: number, score: number): Profile => ({
  ...emptyProfile(),
  stats: { corsi: { bestScore: score, bestLevel: 2, history: [{ at, score, level: 2 }] } },
})

describe('stores/sync', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('没有成绩时不开启存档、不发请求', async () => {
    const sync = useSyncStore()
    await sync.sync()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sync.state.code).toBeNull()
    expect(sync.status).toBe('idle')
  })

  it('有成绩后生成恢复码并上传，取回的合并结果写回本机', async () => {
    const stats = useStatsStore()
    stats.recordResult('matrix', { score: 50, level: 2 }, 100)
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      // 模拟服务端：已存的 corsi 成绩 + 本次上传的合并
      return reply(200, { profile: { ...body.profile, stats: { ...body.profile.stats, ...remoteWith(5, 30).stats } } })
    })
    const sync = useSyncStore()
    await sync.sync()

    expect(sync.state.code).toMatch(/^[0-9A-Z]{8}$/)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/sync')
    expect(sync.status).toBe('ok')
    expect(stats.getRecord('corsi').bestScore).toBe(30)
    expect(stats.getRecord('matrix').bestScore).toBe(50)
  })

  it('网络失败置 offline，本机成绩不受影响', async () => {
    const stats = useStatsStore()
    stats.recordResult('matrix', { score: 50, level: 2 })
    fetchMock.mockRejectedValue(new TypeError('network'))
    const sync = useSyncStore()
    await sync.sync()
    expect(sync.status).toBe('offline')
    expect(stats.getRecord('matrix').bestScore).toBe(50)
  })

  it('恢复：码格式不对 / 不存在 / 成功合并并改用该码', async () => {
    const stats = useStatsStore()
    stats.recordResult('matrix', { score: 50, level: 2 }, 100)
    const sync = useSyncStore()

    expect(await sync.restore('abc')).toBe('invalid')
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockReturnValueOnce(reply(404, { error: 'not_found' }))
    expect(await sync.restore('ZZZZ-ZZZZ')).toBe('notfound')

    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      url.startsWith('/api/profile')
        ? reply(200, { profile: remoteWith(5, 30) })
        : reply(200, { profile: JSON.parse(String(init!.body)).profile }),
    )
    expect(await sync.restore('ab12-cd34')).toBe('ok')
    expect(sync.state.code).toBe('AB12CD34')
    expect(stats.getRecord('corsi').bestScore).toBe(30)
    expect(stats.getRecord('matrix').bestScore).toBe(50)
    // 恢复后把合并结果推回云端
    expect(fetchMock.mock.calls.at(-1)![0]).toBe('/api/sync')
  })
})
