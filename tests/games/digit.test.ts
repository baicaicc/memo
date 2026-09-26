import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/rng'
import {
  GAME_ID,
  MIN_LEVEL,
  MAX_LEVEL,
  spanLength,
  roundScore,
  generateDigits,
  checkAnswer,
} from '@/games/digit/logic'

describe('games/digit logic', () => {
  it('同种子生成相同取件码序列', () => {
    const a = generateDigits(createRng('digit-challenge-1'), 8)
    const b = generateDigits(createRng('digit-challenge-1'), 8)
    expect(a).toEqual(b)
  })

  it('不同种子生成不同序列', () => {
    const a = generateDigits(createRng('seed-a'), 8)
    const b = generateDigits(createRng('seed-b'), 8)
    expect(a).not.toEqual(b)
  })

  it('逐位调用 rng.int(0, 9) 生成：与手动连续抽取完全一致', () => {
    const digits = generateDigits(createRng('stream'), 6)
    const manual: number[] = []
    const rng = createRng('stream')
    for (let i = 0; i < 6; i++) manual.push(rng.int(0, 9))
    expect(digits).toEqual(manual)
  })

  it('整局共用一条随机流时，逐轮抽取仍可复现', () => {
    const play = (seed: string) => {
      const rng = createRng(seed)
      return [generateDigits(rng, 3), generateDigits(rng, 4), generateDigits(rng, 4)]
    }
    expect(play('route-seed')).toEqual(play('route-seed'))
  })

  it('长度规则：长度 = level + 2（Lv.1 为 3，Lv.12 为 14）', () => {
    expect(spanLength(MIN_LEVEL)).toBe(3)
    expect(spanLength(1)).toBe(3)
    expect(spanLength(5)).toBe(7)
    expect(spanLength(MAX_LEVEL)).toBe(14)
  })

  it('生成的取件码长度正确且每位都是 0-9 的整数', () => {
    for (const len of [3, 7, 14]) {
      const digits = generateDigits(createRng(`len-${len}`), len)
      expect(digits).toHaveLength(len)
      for (const d of digits) {
        expect(Number.isInteger(d)).toBe(true)
        expect(d).toBeGreaterThanOrEqual(0)
        expect(d).toBeLessThanOrEqual(9)
      }
    }
  })

  it('允许重复数字（14 位超过 0-9 池也能生成）', () => {
    // uniqueInts 在 length > 10 时会抛错，这里必须能正常生成且必然有重复
    const digits = generateDigits(createRng('dup'), 14)
    expect(digits).toHaveLength(14)
    expect(new Set(digits).size).toBeLessThan(14)
  })

  it('计分：本轮得分 = 长度 × 15', () => {
    expect(roundScore(3)).toBe(45)
    expect(roundScore(8)).toBe(120)
    expect(roundScore(14)).toBe(210)
  })

  it('判定：完全一致才算全对', () => {
    const digits = [3, 1, 4, 1, 5]
    expect(checkAnswer(digits, [3, 1, 4, 1, 5])).toBe(true)
    // 顺序错误
    expect(checkAnswer(digits, [3, 1, 4, 5, 1])).toBe(false)
    // 数字错误
    expect(checkAnswer(digits, [3, 1, 4, 1, 6])).toBe(false)
    // 少输/多输
    expect(checkAnswer(digits, [3, 1, 4, 1])).toBe(false)
    expect(checkAnswer(digits, [3, 1, 4, 1, 5, 9])).toBe(false)
    // 空输入
    expect(checkAnswer(digits, [])).toBe(false)
  })

  it('GAME_ID 与注册表一致', () => {
    expect(GAME_ID).toBe('digit')
  })
})
