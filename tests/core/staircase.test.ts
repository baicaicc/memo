import { describe, expect, it } from 'vitest'
import { createStaircase } from '@/core/staircase'

describe('core/staircase', () => {
  it('默认从等级 1 开始，初始难度可注入', () => {
    expect(createStaircase().level).toBe(1)
    expect(createStaircase({ initialLevel: 5 }).level).toBe(5)
  })

  it('累计对 2 次升 1 级', () => {
    const s = createStaircase()
    s.onSuccess()
    expect(s.level).toBe(1)
    s.onSuccess()
    expect(s.level).toBe(2)
    s.onSuccess()
    expect(s.level).toBe(2)
    s.onSuccess()
    expect(s.level).toBe(3)
  })

  it('错 1 次降 1 级且不低于最低级，失败打断连续成功', () => {
    const s = createStaircase({ initialLevel: 3 })
    s.onSuccess()
    expect(s.consecutiveSuccesses).toBe(1)
    s.onFailure()
    expect(s.level).toBe(2)
    expect(s.consecutiveSuccesses).toBe(0)
    expect(s.errors).toBe(1)
    s.onFailure()
    expect(s.level).toBe(1)
    // 已在最低级，不再下降
    expect(createStaircase().onFailure()).toBe(1)
  })

  it('累计 2 次失败应终止', () => {
    const s = createStaircase()
    expect(s.shouldStop).toBe(false)
    s.onFailure()
    expect(s.shouldStop).toBe(false)
    s.onFailure()
    expect(s.shouldStop).toBe(true)
  })

  it('尊重 maxLevel 封顶', () => {
    const s = createStaircase({ initialLevel: 5, maxLevel: 5 })
    s.onSuccess()
    s.onSuccess()
    expect(s.level).toBe(5)
  })

  it('initialLevel 会被钳制在 [minLevel, maxLevel]', () => {
    expect(createStaircase({ initialLevel: 0, minLevel: 2 }).level).toBe(2)
    expect(createStaircase({ initialLevel: 9, maxLevel: 4 }).level).toBe(4)
  })
})
