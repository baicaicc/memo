export interface GameTimer {
  /** 是否计时中（未暂停） */
  readonly running: boolean
  /** 是否已暂停 */
  readonly paused: boolean
  /** 开始/清零计时 */
  start(): void
  /** 暂停计时 */
  pause(): void
  /** 恢复计时 */
  resume(): void
  /** 已流逝毫秒数（不含暂停时长），未 start 返回 0 */
  elapsed(): number
  /** 返回剩余毫秒数（基于 totalMs），不小于 0 */
  remaining(totalMs: number): number
  /** 停止并返回最终流逝毫秒数 */
  stop(): number
}

export function createTimer(now: () => number = () => performance.now()): GameTimer {
  let startAt = 0
  let accumulated = 0
  let running = false
  let started = false

  function elapsed(): number {
    if (!started) return 0
    return accumulated + (running ? now() - startAt : 0)
  }

  return {
    get running() {
      return running
    },
    get paused() {
      return started && !running
    },
    start() {
      started = true
      running = true
      accumulated = 0
      startAt = now()
    },
    pause() {
      if (!running) return
      accumulated += now() - startAt
      running = false
    },
    resume() {
      if (!started || running) return
      running = true
      startAt = now()
    },
    elapsed,
    remaining(totalMs: number) {
      return Math.max(0, totalMs - elapsed())
    },
    stop() {
      const t = elapsed()
      running = false
      started = false
      accumulated = 0
      return t
    },
  }
}
