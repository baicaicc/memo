import { describe, expect, it } from 'vitest'
import { createTimer } from '@/core/timer'

function fakeNow() {
  let t = 0
  return {
    now: () => t,
    advance(ms: number) {
      t += ms
    },
  }
}

describe('core/timer', () => {
  it('按时间差计时', () => {
    const clock = fakeNow()
    const timer = createTimer(clock.now)
    timer.start()
    clock.advance(1500)
    expect(timer.elapsed()).toBe(1500)
  })

  it('暂停/恢复不计入暂停时长', () => {
    const clock = fakeNow()
    const timer = createTimer(clock.now)
    timer.start()
    clock.advance(1000)
    timer.pause()
    clock.advance(5000)
    expect(timer.elapsed()).toBe(1000)
    timer.resume()
    clock.advance(500)
    expect(timer.elapsed()).toBe(1500)
  })

  it('remaining 不为负，stop 返回最终值并复位', () => {
    const clock = fakeNow()
    const timer = createTimer(clock.now)
    expect(timer.elapsed()).toBe(0)
    timer.start()
    clock.advance(3000)
    expect(timer.remaining(2000)).toBe(0)
    expect(timer.stop()).toBe(3000)
    expect(timer.elapsed()).toBe(0)
  })
})
