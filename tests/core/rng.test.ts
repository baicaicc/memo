import { describe, expect, it } from 'vitest'
import { createRng, hashSeed, mulberry32 } from '@/core/rng'

describe('core/rng', () => {
  it('同种子产出同序列', () => {
    const a = createRng('challenge-abc')
    const b = createRng('challenge-abc')
    const seqA = Array.from({ length: 20 }, () => a.next())
    const seqB = Array.from({ length: 20 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('不同种子产出不同序列', () => {
    const a = createRng('seed-1')
    const b = createRng('seed-2')
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).not.toEqual(seqB)
  })

  it('next() 落在 [0, 1)', () => {
    const rng = createRng('range')
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int() 落在闭区间 [min, max]', () => {
    const rng = createRng('int')
    for (let i = 0; i < 500; i++) {
      const v = rng.int(3, 7)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(7)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('shuffle 不改原数组且元素不变', () => {
    const rng = createRng('shuffle')
    const src = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = rng.shuffle(src)
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...out].sort((x, y) => x - y)).toEqual(src)
  })

  it('uniqueInts 返回不重复整数，超界抛错', () => {
    const rng = createRng('uniq')
    const vals = rng.uniqueInts(5, 0, 8)
    expect(new Set(vals).size).toBe(5)
    expect(() => rng.uniqueInts(10, 0, 8)).toThrow(RangeError)
  })

  it('hashSeed 确定性且 mulberry32 确定性', () => {
    expect(hashSeed('memo')).toBe(hashSeed('memo'))
    const r1 = mulberry32(42)
    const r2 = mulberry32(42)
    expect(r1()).toBe(r2())
  })
})
