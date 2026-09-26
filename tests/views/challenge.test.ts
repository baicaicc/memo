import { describe, expect, it } from 'vitest'
import {
  judgeOutcome,
  parseChallengeQuery,
} from '@/views/Challenge.vue'

describe('views/Challenge parseChallengeQuery', () => {
  it('合法 query 解析成功', () => {
    const parsed = parseChallengeQuery({
      game: 'matrix',
      seed: 'abc-123',
      level: '3',
      score: '320',
    })
    expect(parsed).toEqual({
      game: 'matrix',
      seed: 'abc-123',
      level: 3,
      score: 320,
    })
  })

  it('数组参数取第一个值（vue-router 重复参数场景）', () => {
    const parsed = parseChallengeQuery({
      game: 'corsi',
      seed: 's1',
      level: ['2', '9'],
      score: '100',
    })
    expect(parsed).toEqual({ game: 'corsi', seed: 's1', level: 2, score: 100 })
  })

  it('缺少任一参数时返回 null', () => {
    const base = { game: 'matrix', seed: 'x', level: '1', score: '10' }
    for (const key of ['game', 'seed', 'level', 'score'] as const) {
      const q = { ...base, [key]: undefined }
      expect(parseChallengeQuery(q), `缺少 ${key}`).toBeNull()
    }
  })

  it('游戏未注册时返回 null', () => {
    expect(
      parseChallengeQuery({ game: 'tetris', seed: 'x', level: '1', score: '10' }),
    ).toBeNull()
  })

  it('seed 为空字符串时返回 null', () => {
    expect(
      parseChallengeQuery({ game: 'matrix', seed: '', level: '1', score: '10' }),
    ).toBeNull()
  })

  it('level 非法时返回 null', () => {
    const bad = ['0', '-1', '1.5', 'abc', '']
    for (const level of bad) {
      expect(
        parseChallengeQuery({ game: 'matrix', seed: 'x', level, score: '10' }),
        `level=${level}`,
      ).toBeNull()
    }
  })

  it('score 非法时返回 null', () => {
    const bad = ['-5', '1.2', 'abc', '']
    for (const score of bad) {
      expect(
        parseChallengeQuery({ game: 'matrix', seed: 'x', level: '1', score }),
        `score=${score}`,
      ).toBeNull()
    }
  })

  it('score 允许为 0', () => {
    const parsed = parseChallengeQuery({
      game: 'digit',
      seed: 'x',
      level: '1',
      score: '0',
    })
    expect(parsed?.score).toBe(0)
  })
})

describe('views/Challenge judgeOutcome', () => {
  it('我方分高判胜', () => {
    expect(judgeOutcome(400, 320)).toBe('win')
  })

  it('双方同分判平', () => {
    expect(judgeOutcome(320, 320)).toBe('draw')
  })

  it('我方分低判负', () => {
    expect(judgeOutcome(100, 320)).toBe('lose')
  })

  it('双方 0 分判平', () => {
    expect(judgeOutcome(0, 0)).toBe('draw')
  })
})
