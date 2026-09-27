import { beforeEach, describe, expect, it, vi } from 'vitest'

// node 环境无 AudioContext：play 必须静默安全；本测试主要覆盖静音持久化与 API 形状
describe('audio/sfx', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('默认不静音；toggleMuted 切换并持久化到 localStorage', async () => {
    const sfx = await import('@/audio/sfx')
    expect(sfx.isMuted()).toBe(false)
    expect(sfx.toggleMuted()).toBe(true)
    expect(localStorage.getItem('memo:muted')).toBe('1')
    expect(sfx.isMuted()).toBe(true)
    expect(sfx.toggleMuted()).toBe(false)
    expect(localStorage.getItem('memo:muted')).toBe('0')
  })

  it('未初始化/无 AudioContext 时 play 静默不抛错', async () => {
    const sfx = await import('@/audio/sfx')
    expect(() => sfx.play('correct')).not.toThrow()
    sfx.initSfx()
    expect(() => sfx.play('levelup')).not.toThrow()
    expect(() => sfx.play('finish')).not.toThrow()
  })

  it('重复 initSfx 幂等', async () => {
    const sfx = await import('@/audio/sfx')
    sfx.initSfx()
    expect(() => sfx.initSfx()).not.toThrow()
  })

  it('持久化失败时 toggleMuted 仍返回新状态且不崩', async () => {
    const original = localStorage.setItem.bind(localStorage)
    localStorage.setItem = () => {
      throw new Error('quota')
    }
    try {
      const sfx = await import('@/audio/sfx')
      expect(sfx.toggleMuted()).toBe(true)
    } finally {
      localStorage.setItem = original
    }
  })
})
