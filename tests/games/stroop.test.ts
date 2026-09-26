import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/rng'
import {
  ALL_COLORS,
  BASIC_COLORS,
  SCORE_CORRECT,
  SCORE_WRONG,
  colorsForLevel,
  generateTrial,
  incongruentRate,
  scoreAnswer,
} from '@/games/stroop/logic'

function trialsOf(seed: string, level: number, n: number) {
  const rng = createRng(seed)
  return Array.from({ length: n }, () => generateTrial(rng, level))
}

describe('games/stroop logic', () => {
  it('同种子生成完全相同的题目序列', () => {
    expect(trialsOf('challenge-1', 1, 30)).toEqual(trialsOf('challenge-1', 1, 30))
    expect(trialsOf('challenge-2', 6, 30)).toEqual(trialsOf('challenge-2', 6, 30))
  })

  it('不同种子生成不同题目序列', () => {
    expect(trialsOf('seed-a', 3, 20)).not.toEqual(trialsOf('seed-b', 3, 20))
  })

  it('选项包含正确答案，且是当前等级颜色池的不重复排列', () => {
    for (const level of [1, 2, 3, 8]) {
      const ids = colorsForLevel(level).map((c) => c.id)
      for (const t of trialsOf(`opt-${level}`, level, 50)) {
        expect(t.options).toContain(t.inkColor)
        expect(new Set(t.options).size).toBe(ids.length)
        expect([...t.options].sort()).toEqual([...ids].sort())
      }
    }
  })

  it('level 1-2 用 4 色（红黄蓝绿），level 3+ 用 6 色', () => {
    expect(colorsForLevel(1).map((c) => c.id)).toEqual([
      'red',
      'yellow',
      'blue',
      'green',
    ])
    expect(colorsForLevel(2)).toHaveLength(4)
    expect(colorsForLevel(3)).toHaveLength(6)
    expect(colorsForLevel(9)).toHaveLength(6)
    const basicIds = BASIC_COLORS.map((c) => c.id)
    const basicWords = BASIC_COLORS.map((c) => c.word)
    for (const t of trialsOf('low-level', 1, 100)) {
      expect(basicIds).toContain(t.inkColor)
      expect(basicWords).toContain(t.word)
    }
  })

  it('不一致比例：level 1-2 约 60%，level 3+ 约 75%', () => {
    expect(incongruentRate(1)).toBe(0.6)
    expect(incongruentRate(3)).toBe(0.75)
    const rateOf = (list: { matched: boolean }[]) =>
      list.filter((t) => !t.matched).length / list.length
    const low = rateOf(trialsOf('rate-low', 2, 400))
    const high = rateOf(trialsOf('rate-high', 5, 400))
    expect(low).toBeGreaterThan(0.5)
    expect(low).toBeLessThan(0.7)
    expect(high).toBeGreaterThan(0.65)
    expect(high).toBeLessThan(0.85)
  })

  it('字义与墨水都取自色表，matched 标记正确', () => {
    const words = ALL_COLORS.map((c) => c.word)
    for (const t of trialsOf('match-check', 4, 100)) {
      const ink = ALL_COLORS.find((c) => c.id === t.inkColor)!
      expect(words).toContain(t.word)
      expect(t.matched).toBe(ink.word === t.word)
    }
  })

  it('计分：答对 +10，答错 -5 且标记未答对', () => {
    expect(scoreAnswer('red', 'red')).toEqual({
      delta: SCORE_CORRECT,
      isRight: true,
    })
    expect(scoreAnswer('red', 'blue')).toEqual({
      delta: SCORE_WRONG,
      isRight: false,
    })
    expect(SCORE_CORRECT).toBe(10)
    expect(SCORE_WRONG).toBe(-5)
  })
})
