import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/rng'
import {
  ITEM_POOL,
  MAX_LEVEL,
  SLOT_COUNT,
  checkPlacement,
  generateLayout,
  itemCountForLevel,
  roundBonus,
  scorePerItem,
  showDurationMs,
} from '@/games/paired/logic'

describe('games/paired logic', () => {
  it('同种子生成相同布局，且整局摆放序列一致', () => {
    const a = createRng('challenge-seed-1')
    const b = createRng('challenge-seed-1')
    for (let round = 0; round < 5; round++) {
      const level = (round % MAX_LEVEL) + 1
      expect(generateLayout(a, level)).toEqual(generateLayout(b, level))
    }
  })

  it('不同种子布局不同（挑战链接可区分）', () => {
    const a = generateLayout(createRng('seed-a'), 5)
    const b = generateLayout(createRng('seed-b'), 5)
    expect(a.items).not.toEqual(b.items)
  })

  it('物品数 = 等级 + 1，顶到槽位数后全上', () => {
    expect(itemCountForLevel(1)).toBe(2)
    expect(itemCountForLevel(7)).toBe(8)
    expect(itemCountForLevel(10)).toBe(8)
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(itemCountForLevel(level)).toBe(Math.min(level + 1, SLOT_COUNT))
    }
  })

  it('出题：物品互不重复、槽位不重复且不越界', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const { items, slotAssignments, trayOrder } = generateLayout(
        createRng(`lvl-${level}`),
        level,
      )
      const k = itemCountForLevel(level)
      expect(items).toHaveLength(k)
      expect(slotAssignments).toHaveLength(k)
      expect(new Set(items.map((i) => i.emoji)).size).toBe(k)
      expect(new Set(slotAssignments).size).toBe(k)
      for (const s of slotAssignments) {
        expect(s).toBeGreaterThanOrEqual(0)
        expect(s).toBeLessThan(SLOT_COUNT)
      }
      // 托盘是物品索引的乱序排列
      expect([...trayOrder].sort((x, y) => x - y)).toEqual(
        Array.from({ length: k }, (_, i) => i),
      )
    }
  })

  it('checkPlacement：放对判定与全对条件', () => {
    // 物品 0→槽 2，物品 1→槽 0，物品 2→槽 5
    const assignments = [2, 0, 5]

    // placements[slot] = 物品索引：物品 1 在槽 0、物品 0 在槽 2、物品 2 在槽 5
    const allRight = checkPlacement(assignments, [1, -1, 0, -1, -1, 2, -1, -1])
    expect(allRight.allCorrect).toBe(true)
    expect(allRight.correct).toBe(3)
    expect(allRight.correctItems).toEqual([0, 1, 2])
    expect(allRight.wrongItems).toEqual([])

    // 物品 2 放到了槽 7（应在槽 5）
    const partial = checkPlacement(assignments, [1, -1, 0, -1, -1, -1, -1, 2])
    expect(partial.allCorrect).toBe(false)
    expect(partial.correct).toBe(2)
    expect(partial.correctItems).toEqual([0, 1])
    expect(partial.wrongItems).toEqual([2])

    const allWrong = checkPlacement(assignments, [0, 1, 2, -1, -1, -1, -1, -1])
    expect(allWrong.correct).toBe(0)
    expect(allWrong.allCorrect).toBe(false)
  })

  it('checkPlacement：空槽不算放错', () => {
    const verdict = checkPlacement([3, 6], [-1, -1, -1, 0, -1, -1, -1, -1])
    expect(verdict.correct).toBe(1)
    expect(verdict.wrongItems).toEqual([1])
  })

  it('计分规则：放对一件 = 等级×10，整轮全对额外 +等级×20', () => {
    expect(scorePerItem(1)).toBe(10)
    expect(scorePerItem(5)).toBe(50)
    expect(roundBonus(1)).toBe(20)
    expect(roundBonus(5)).toBe(100)
  })

  it('展示时长 = 3s + 0.5s×物品数', () => {
    expect(showDurationMs(1)).toBe(3000 + 500 * 2)
    expect(showDurationMs(10)).toBe(3000 + 500 * 8)
  })

  it('物品池 ≥16 件且不重复', () => {
    expect(ITEM_POOL.length).toBeGreaterThanOrEqual(16)
    expect(new Set(ITEM_POOL.map((i) => i.emoji)).size).toBe(ITEM_POOL.length)
  })
})
