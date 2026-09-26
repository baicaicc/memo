export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^= h >>> 16) >>> 0
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  /** 下一个 [0, 1) 随机数 */
  next(): number
  /** [min, max] 闭区间整数 */
  int(min: number, max: number): number
  /** 从数组中随机取一个元素 */
  pick<T>(arr: readonly T[]): T
  /** 返回乱序后的新数组（不改原数组） */
  shuffle<T>(arr: readonly T[]): T[]
  /** 生成 n 个互不相同的 [min, max] 整数 */
  uniqueInts(n: number, min: number, max: number): number[]
}

export function createRng(seedString: string): Rng {
  const rand = mulberry32(hashSeed(seedString))

  function int(min: number, max: number): number {
    return min + Math.floor(rand() * (max - min + 1))
  }

  return {
    next: () => rand(),
    int,
    pick<T>(arr: readonly T[]): T {
      return arr[int(0, arr.length - 1)]
    },
    shuffle<T>(arr: readonly T[]): T[] {
      const out = arr.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i)
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
    uniqueInts(n: number, min: number, max: number): number[] {
      const pool = max - min + 1
      if (n > pool) throw new RangeError(`uniqueInts: n=${n} > pool=${pool}`)
      const set = new Set<number>()
      while (set.size < n) set.add(int(min, max))
      return [...set]
    },
  }
}
