import { describe, expect, it } from 'vitest'
import { handleProfile, handleSync, type ProfileStore } from '../../server/handlers'
import { emptyProfile, type Profile } from '@/sync/profile'

function memoryKV(): ProfileStore & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    get: async (k) => map.get(k) ?? null,
    put: async (k, v) => {
      map.set(k, v)
    },
  }
}

const CODE = 'AB12CD34'
const withGame = (at: number, score: number): Profile => ({
  ...emptyProfile(),
  stats: { matrix: { bestScore: score, bestLevel: 1, history: [{ at, score, level: 1 }] } },
})

describe('server/handlers', () => {
  it('首次同步即建档，再次同步与已存档案合并', async () => {
    const kv = memoryKV()
    let res = await handleSync(kv, { code: CODE, profile: withGame(1, 10) }, 1000)
    expect(res.status).toBe(200)
    res = await handleSync(kv, { code: CODE, profile: withGame(2, 20) }, 2000)
    const { profile } = (await res.json()) as { profile: Profile }
    expect(profile.stats.matrix.history.map((h) => h.at)).toEqual([2, 1])

    const stored = JSON.parse(kv.map.get(`profiles/${CODE}.json`)!)
    expect(stored.createdAt).toBe(1000)
    expect(stored.updatedAt).toBe(2000)
  })

  it('码不规范或档案结构不对返回 400，不写 KV', async () => {
    const kv = memoryKV()
    expect((await handleSync(kv, { code: 'ab12cd34', profile: emptyProfile() })).status).toBe(400)
    expect((await handleSync(kv, { code: CODE, profile: { v: 1 } })).status).toBe(400)
    expect((await handleSync(kv, null)).status).toBe(400)
    expect(kv.map.size).toBe(0)
  })

  it('读取：存在返回档案，不存在 404，码不对 400', async () => {
    const kv = memoryKV()
    await handleSync(kv, { code: CODE, profile: withGame(1, 10) })
    const ok = await handleProfile(kv, new URL(`https://x/api/profile?code=${CODE}`))
    expect(ok.status).toBe(200)
    expect(((await ok.json()) as { profile: Profile }).profile.stats.matrix.bestScore).toBe(10)
    expect((await handleProfile(kv, new URL('https://x/api/profile?code=ZZZZZZZZ'))).status).toBe(404)
    expect((await handleProfile(kv, new URL('https://x/api/profile'))).status).toBe(400)
  })

  it('已存数据损坏时按新档处理，不报错', async () => {
    const kv = memoryKV()
    kv.map.set(`profiles/${CODE}.json`, '{broken')
    const res = await handleSync(kv, { code: CODE, profile: withGame(1, 10) })
    expect(res.status).toBe(200)
  })
})
