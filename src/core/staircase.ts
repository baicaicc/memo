export interface StaircaseOptions {
  /** 初始等级，默认 1 */
  initialLevel?: number
  /** 最低等级，降级不会低于它，默认 1 */
  minLevel?: number
  /** 最高等级封顶，默认不封顶 */
  maxLevel?: number
  /** 累计多少次升级，默认 2（对 2 次升 1 级） */
  successesToLevelUp?: number
  /** 累计多少次失败终止，默认 2 */
  maxFailures?: number
}

export interface Staircase {
  /** 当前等级 */
  readonly level: number
  /** 当前连续成功计数（升级后清零） */
  readonly consecutiveSuccesses: number
  /** 本局累计错误数 */
  readonly errors: number
  /** 本局累计失败数（达到 maxFailures 应终止） */
  readonly failures: number
  /** 是否应终止本局 */
  readonly shouldStop: boolean
  /** 记一次成功，返回新等级 */
  onSuccess(): number
  /** 记一次失败，返回新等级 */
  onFailure(): number
}

export function createStaircase(options: StaircaseOptions = {}): Staircase {
  const minLevel = options.minLevel ?? 1
  const maxLevel = options.maxLevel ?? Number.POSITIVE_INFINITY
  const successesToLevelUp = options.successesToLevelUp ?? 2
  const maxFailures = options.maxFailures ?? 2

  let level = Math.max(minLevel, Math.min(options.initialLevel ?? minLevel, maxLevel))
  let consecutiveSuccesses = 0
  let errors = 0
  let failures = 0

  return {
    get level() {
      return level
    },
    get consecutiveSuccesses() {
      return consecutiveSuccesses
    },
    get errors() {
      return errors
    },
    get failures() {
      return failures
    },
    get shouldStop() {
      return failures >= maxFailures
    },
    onSuccess() {
      consecutiveSuccesses += 1
      if (consecutiveSuccesses >= successesToLevelUp) {
        level = Math.min(level + 1, maxLevel)
        consecutiveSuccesses = 0
      }
      return level
    },
    onFailure() {
      errors += 1
      failures += 1
      consecutiveSuccesses = 0
      level = Math.max(level - 1, minLevel)
      return level
    },
  }
}
