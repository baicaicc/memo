import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/rng'
import {
  BLOCK_COUNT,
  BLOCK_POSITIONS,
  MAX_LEVEL,
  SCORE_PER_BLOCK,
  checkTap,
  generateSequence,
  roundScore,
  sequenceLength,
} from '@/games/corsi/logic'

describe('games/corsi logic', () => {
  it('同种子生成相同序列（挑战链接可复现同题）', () => {
    const a = generateSequence(createRng('corsi-challenge#3'), 7)
    const b = generateSequence(createRng('corsi-challenge#3'), 7)
    expect(a).toEqual(b)
    expect(a).toHaveLength(7)
  })

  it('不同种子生成不同序列', () => {
    const a = generateSequence(createRng('corsi-seed-a#1'), 7)
    const b = generateSequence(createRng('corsi-seed-b#1'), 7)
    expect(a).not.toEqual(b)
  })

  it('长度规则：序列长度 = level + 2', () => {
    expect(sequenceLength(1)).toBe(3)
    expect(sequenceLength(MAX_LEVEL)).toBe(14)
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const seq = generateSequence(createRng(`corsi-len-${level}`), sequenceLength(level))
      expect(seq).toHaveLength(level + 2)
    }
  })

  it('序列元素都是合法块索引，长度不超过块数时不重复', () => {
    const seq = generateSequence(createRng('corsi-range'), BLOCK_COUNT)
    expect(new Set(seq).size).toBe(BLOCK_COUNT)
    for (const b of seq) {
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThan(BLOCK_COUNT)
    }
  })

  it('长度超过块数（最高等级 14 > 9）也能生成且分段内不重复', () => {
    const seq = generateSequence(createRng('corsi-long'), 14)
    expect(seq).toHaveLength(14)
    expect(seq.every((b) => b >= 0 && b < BLOCK_COUNT)).toBe(true)
    expect(new Set(seq.slice(0, BLOCK_COUNT)).size).toBe(BLOCK_COUNT)
    expect(new Set(seq.slice(BLOCK_COUNT)).size).toBe(14 - BLOCK_COUNT)
  })

  it('计分：本轮得分 = 序列长度 × 15', () => {
    expect(SCORE_PER_BLOCK).toBe(15)
    expect(roundScore(1)).toBe(3 * 15)
    expect(roundScore(5)).toBe(7 * 15)
    expect(roundScore(MAX_LEVEL)).toBe(14 * 15)
  })

  it('顺序判定：第几下必须点对对应的块', () => {
    const seq = [4, 1, 7]
    expect(checkTap(seq, 0, 4)).toBe(true)
    expect(checkTap(seq, 1, 1)).toBe(true)
    expect(checkTap(seq, 2, 7)).toBe(true)
    // 块在序列中但顺序不对
    expect(checkTap(seq, 0, 1)).toBe(false)
    expect(checkTap(seq, 2, 4)).toBe(false)
    // 不在序列中的块
    expect(checkTap(seq, 0, 0)).toBe(false)
    // 下标越界
    expect(checkTap(seq, 3, 4)).toBe(false)
    expect(checkTap([], 0, 0)).toBe(false)
  })

  it('圆块布局：9 个固定不规则坐标，非九宫格', () => {
    expect(BLOCK_POSITIONS).toHaveLength(BLOCK_COUNT)
    for (const p of BLOCK_POSITIONS) {
      expect(p.x).toBeGreaterThan(0)
      expect(p.x).toBeLessThan(100)
      expect(p.y).toBeGreaterThan(0)
      expect(p.y).toBeLessThan(100)
    }
    // 九宫格只有 3 档 x/y，不规则布局应远超
    expect(new Set(BLOCK_POSITIONS.map((p) => p.x)).size).toBeGreaterThan(3)
    expect(new Set(BLOCK_POSITIONS.map((p) => p.y)).size).toBeGreaterThan(3)
    // 任意两块圆心不重合且间距足够放下圆块（直径约 17%）
    for (let i = 0; i < BLOCK_POSITIONS.length; i++) {
      for (let j = i + 1; j < BLOCK_POSITIONS.length; j++) {
        const dx = BLOCK_POSITIONS[i].x - BLOCK_POSITIONS[j].x
        const dy = BLOCK_POSITIONS[i].y - BLOCK_POSITIONS[j].y
        expect(Math.hypot(dx, dy)).toBeGreaterThan(18)
      }
    }
  })
})
