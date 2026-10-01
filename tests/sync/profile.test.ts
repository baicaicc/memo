import { describe, expect, it } from 'vitest'
import {
  CODE_ALPHABET,
  codeFromBytes,
  emptyProfile,
  mergeProfiles,
  normalizeCode,
  sanitizeProfile,
  type Profile,
} from '@/sync/profile'

function profile(over: Partial<Profile> = {}): Profile {
  return { ...emptyProfile(), ...over }
}

const h = (at: number, score: number, level = 1) => ({ at, score, level })

describe('sync/profile 恢复码', () => {
  it('8 位、只含 Crockford 字符', () => {
    const code = codeFromBytes(new Uint8Array([0, 31, 32, 255, 100, 7, 64, 200]))
    expect(code).toHaveLength(8)
    for (const ch of code) expect(CODE_ALPHABET).toContain(ch)
    expect(code.startsWith('0Z0Z')).toBe(true)
  })

  it('输入宽松：小写、空格、连字符、O/I/L 都能认', () => {
    expect(normalizeCode('ab12-cd34')).toBe('AB12CD34')
    expect(normalizeCode(' oil0 ABCD ')).toBe('0110ABCD')
    expect(normalizeCode('ABC')).toBeNull()
    expect(normalizeCode('ABCDEFGU')).toBeNull() // U 不在字母表
  })
})

describe('sync/profile mergeProfiles', () => {
  it('历史去重合并、按时间新到旧，最佳取大', () => {
    const a = profile({ stats: { matrix: { bestScore: 100, bestLevel: 3, history: [h(3, 100, 3), h(1, 50)] } } })
    const b = profile({
      stats: {
        matrix: { bestScore: 80, bestLevel: 5, history: [h(4, 80, 5), h(1, 50)] },
        corsi: { bestScore: 10, bestLevel: 2, history: [h(2, 10, 2)] },
      },
    })
    const m = mergeProfiles(a, b)
    expect(m.stats.matrix.history.map((x) => x.at)).toEqual([4, 3, 1])
    expect(m.stats.matrix.bestScore).toBe(100)
    expect(m.stats.matrix.bestLevel).toBe(5)
    expect(m.stats.corsi.history).toHaveLength(1)
  })

  it('满足交换律与幂等', () => {
    const a = profile({ stats: { digit: { bestScore: 5, bestLevel: 1, history: [h(9, 5)] } } })
    const b = profile({ stats: { digit: { bestScore: 7, bestLevel: 2, history: [h(8, 7, 2)] } } })
    expect(mergeProfiles(a, b)).toEqual(mergeProfiles(b, a))
    const m = mergeProfiles(a, b)
    expect(mergeProfiles(m, m)).toEqual(m)
  })

  it('历史最多保留 200 局', () => {
    const many = Array.from({ length: 150 }, (_, i) => h(i, i))
    const more = Array.from({ length: 150 }, (_, i) => h(1000 + i, i))
    const m = mergeProfiles(
      profile({ stats: { stroop: { bestScore: 0, bestLevel: 0, history: many } } }),
      profile({ stats: { stroop: { bestScore: 0, bestLevel: 0, history: more } } }),
    )
    expect(m.stats.stroop.history).toHaveLength(200)
    expect(m.stats.stroop.history[0].at).toBe(1149)
  })

  it('打卡取最近一次游玩更晚的一方；同一天任务完成状态取并集', () => {
    const a = profile({
      daily: {
        date: '2026-10-01',
        tasks: [{ gameId: 'matrix', done: true }, { gameId: 'corsi', done: false }],
        lastPlayedDate: '2026-10-01',
        streak: 3,
      },
    })
    const b = profile({
      daily: {
        date: '2026-10-01',
        tasks: [{ gameId: 'matrix', done: false }, { gameId: 'corsi', done: true }],
        lastPlayedDate: '2026-09-20',
        streak: 9,
      },
    })
    const m = mergeProfiles(a, b)
    expect(m.daily.streak).toBe(3)
    expect(m.daily.lastPlayedDate).toBe('2026-10-01')
    expect(m.daily.tasks.every((t) => t.done)).toBe(true)
  })

  it('任务日期不同取更晚那天的', () => {
    const a = profile({ daily: { date: '2026-09-30', tasks: [{ gameId: 'matrix', done: true }], lastPlayedDate: null, streak: 0 } })
    const b = profile({ daily: { date: '2026-10-01', tasks: [{ gameId: 'digit', done: false }], lastPlayedDate: null, streak: 0 } })
    expect(mergeProfiles(a, b).daily.tasks).toEqual([{ gameId: 'digit', done: false }])
  })
})

describe('sync/profile sanitizeProfile', () => {
  it('合法档案原样通过，多余字段被丢弃', () => {
    const p = profile({ stats: { matrix: { bestScore: 1, bestLevel: 1, history: [{ ...h(1, 1), detail: { seed: 's' } }] } } })
    expect(sanitizeProfile({ ...p, extra: 'x' })).toEqual(p)
  })

  it('结构不对返回 null', () => {
    expect(sanitizeProfile(null)).toBeNull()
    expect(sanitizeProfile({ v: 2, stats: {}, daily: emptyProfile().daily })).toBeNull()
    expect(sanitizeProfile({ ...emptyProfile(), stats: { matrix: { bestScore: 'x', bestLevel: 1, history: [] } } })).toBeNull()
    expect(sanitizeProfile({ ...emptyProfile(), stats: { '../x': { bestScore: 1, bestLevel: 1, history: [] } } })).toBeNull()
    expect(sanitizeProfile({ ...emptyProfile(), daily: { date: 'bad', tasks: [], lastPlayedDate: null, streak: 0 } })).toBeNull()
  })
})
