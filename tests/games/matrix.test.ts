import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/rng'
import {
  MAX_LEVEL,
  checkRecall,
  generatePuzzle,
  gridSizeForLevel,
  litCountForLevel,
  roundBonus,
  scorePerCell,
  showDurationMs,
} from '@/games/matrix/logic'

describe('games/matrix logic', () => {
  it('同种子生成相同题目，且整局题目序列一致', () => {
    const a = createRng('challenge-seed-1')
    const b = createRng('challenge-seed-1')
    for (let round = 0; round < 5; round++) {
      const level = (round % MAX_LEVEL) + 1
      expect(generatePuzzle(a, level)).toEqual(generatePuzzle(b, level))
    }
  })

  it('不同种子题目不同（挑战链接可区分）', () => {
    const a = generatePuzzle(createRng('seed-a'), 5)
    const b = generatePuzzle(createRng('seed-b'), 5)
    expect(a.cells).not.toEqual(b.cells)
  })

  it('网格规模随等级变化：1-3 级 3×3，4-6 级 4×4，7 级以上 5×5', () => {
    expect(gridSizeForLevel(1)).toBe(3)
    expect(gridSizeForLevel(3)).toBe(3)
    expect(gridSizeForLevel(4)).toBe(4)
    expect(gridSizeForLevel(6)).toBe(4)
    expect(gridSizeForLevel(7)).toBe(5)
    expect(gridSizeForLevel(MAX_LEVEL)).toBe(5)
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(generatePuzzle(createRng(`size-${level}`), level).gridSize).toBe(
        gridSizeForLevel(level),
      )
    }
  })

  it('亮格数 = 等级 + 2，且不重复、不越界', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const { gridSize, cells } = generatePuzzle(createRng(`lvl-${level}`), level)
      expect(cells).toHaveLength(level + 2)
      expect(cells).toHaveLength(litCountForLevel(level))
      expect(new Set(cells).size).toBe(cells.length)
      for (const c of cells) {
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThan(gridSize * gridSize)
      }
    }
  })

  it('checkRecall：点对判定与完成条件', () => {
    const cells = [1, 4, 7]

    const win = checkRecall(cells, [4, 1, 7])
    expect(win.completed).toBe(true)
    expect(win.hits).toEqual([4, 1, 7])
    expect(win.misses).toEqual([])

    const partial = checkRecall(cells, [1])
    expect(partial.completed).toBe(false)

    const wrong = checkRecall(cells, [1, 2])
    expect(wrong.completed).toBe(false)
    expect(wrong.misses).toEqual([2])
  })

  it('checkRecall：重复点击只算一次，点错后仍可找齐', () => {
    const cells = [1, 4, 7]

    const dup = checkRecall(cells, [1, 1, 4, 7])
    expect(dup.completed).toBe(true)
    expect(dup.hits).toEqual([1, 4, 7])

    const mixed = checkRecall(cells, [0, 1, 4, 7])
    expect(mixed.completed).toBe(true)
    expect(mixed.misses).toEqual([0])
  })

  it('计分规则：点对一格 = 等级×10，整轮全对额外 +等级×20', () => {
    expect(scorePerCell(1)).toBe(10)
    expect(scorePerCell(3)).toBe(30)
    expect(roundBonus(1)).toBe(20)
    expect(roundBonus(3)).toBe(60)
  })

  it('亮格展示时长 = 1.2s + 0.15s×亮格数', () => {
    expect(showDurationMs(1)).toBe(1200 + 150 * 3)
    expect(showDurationMs(10)).toBe(1200 + 150 * 12)
  })
})
