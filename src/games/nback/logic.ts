// 硬核回想（N-back）出题/判定/计分逻辑（MEMO-2 实现）。保持纯函数、依赖 core/rng 的种子随机。
import type { Rng } from '@/core/rng'

export const GAME_ID = 'nback' as const

/** 九宫格格数（科学原型为 3×3 位置 N-back） */
export const GRID_COUNT = 9
export const MIN_N = 1
export const MAX_N = 8
/** 每拍总时长：亮 LIGHT_MS + 间隔 */
export const TICK_MS = 2200
export const LIGHT_MS = 500
/** 每局可判定拍数（前 N 拍为热身，不计判定；实际刺激数 = JUDGED_TRIALS + N） */
export const JUDGED_TRIALS = 20
/** 匹配拍占可判定拍的比例目标（约 30%） */
export const MATCH_RATIO = 0.3
/** 完成多少局后结束本盘 */
export const MAX_ROUNDS = 5
/** 累计多少次降级后结束本盘 */
export const MAX_DEMOTES = 2
/** 每次正确判定得分 = SCORE_PER_CORRECT × N（含「正确放过」） */
export const SCORE_PER_CORRECT = 10
/** 错点/漏报扣分 */
export const PENALTY_PER_MISTAKE = 5

export interface Stimulus {
  /** 九宫格位置索引 [0, GRID_COUNT) */
  position: number
  /** 是否与 N 步前位置相同（前 N 拍恒为 false） */
  isMatch: boolean
}

/** 一局刺激数 = 20 + N */
export function roundTrialCount(n: number): number {
  return JUDGED_TRIALS + n
}

/**
 * 用种子随机生成一拍序列。
 * 先在可判定拍 [n, count) 中随机挑出 round(judged × MATCH_RATIO) 个匹配拍，
 * 匹配拍直接复制 N 步前的位置；非匹配拍显式避开 N 步前位置，保证
 * isMatch 标记与「位置是否等于 N 步前」严格一致，不会意外匹配。
 */
export function generateStimuli(rng: Rng, n: number, count = roundTrialCount(n)): Stimulus[] {
  if (!Number.isInteger(n) || n < MIN_N) throw new RangeError(`generateStimuli: n=${n} 不合法`)
  if (count <= n) throw new RangeError(`generateStimuli: count=${count} 必须大于 n=${n}`)
  const judged = count - n
  const matchTarget = Math.round(judged * MATCH_RATIO)
  const judgedIndexes = Array.from({ length: judged }, (_, k) => n + k)
  const matchSet = new Set(rng.shuffle(judgedIndexes).slice(0, matchTarget))

  const positions: number[] = []
  for (let i = 0; i < count; i++) {
    if (i >= n && matchSet.has(i)) {
      positions.push(positions[i - n])
    } else if (i >= n) {
      const pool: number[] = []
      for (let p = 0; p < GRID_COUNT; p++) {
        if (p !== positions[i - n]) pool.push(p)
      }
      positions.push(rng.pick(pool))
    } else {
      positions.push(rng.int(0, GRID_COUNT - 1))
    }
  }
  return positions.map((position, i) => ({ position, isMatch: matchSet.has(i) }))
}

/** 命中=匹配且按下；正确放过=非匹配且未按；漏报=匹配未按；错点=非匹配误按 */
export type TrialKind = 'hit' | 'correctReject' | 'miss' | 'falseAlarm'

export interface TrialJudgement {
  kind: TrialKind
  correct: boolean
  /** 得分增量：正确 +10×N，错误 -5 */
  delta: number
}

export function judgeTrial(isMatch: boolean, pressed: boolean, n: number): TrialJudgement {
  if (isMatch && pressed) return { kind: 'hit', correct: true, delta: SCORE_PER_CORRECT * n }
  if (!isMatch && !pressed) {
    return { kind: 'correctReject', correct: true, delta: SCORE_PER_CORRECT * n }
  }
  if (isMatch && !pressed) return { kind: 'miss', correct: false, delta: -PENALTY_PER_MISTAKE }
  return { kind: 'falseAlarm', correct: false, delta: -PENALTY_PER_MISTAKE }
}

export interface RoundJudgement {
  /** 参与判定的拍数（不含前 N 拍热身） */
  judged: number
  correct: number
  mistakes: number
  /** 正确率 = correct / judged */
  correctRate: number
  /** 敏感度 d'（信号检测量）：命中率与虚报率的 z 分差，防「全程不操作躺分」 */
  dPrime: number
  hits: number
  misses: number
  falseAlarms: number
  correctRejections: number
  /** 本局得分增量合计 */
  scoreDelta: number
  /** 逐拍判定（仅可判定拍，与 stimuli[n..] 对齐） */
  trials: TrialJudgement[]
}

/**
 * 结算一局：只判定第 n 拍及之后（前 N 拍无 N 步前可比，属热身）。
 * pressed[i] 表示第 i 拍窗口内玩家是否按下「相同」。
 */
export function judgeRound(
  stimuli: readonly Stimulus[],
  pressed: readonly boolean[],
  n: number,
): RoundJudgement {
  const trials: TrialJudgement[] = []
  for (let i = n; i < stimuli.length; i++) {
    trials.push(judgeTrial(stimuli[i].isMatch, Boolean(pressed[i]), n))
  }
  const correct = trials.filter((t) => t.correct).length
  const mistakes = trials.length - correct
  const scoreDelta = trials.reduce((sum, t) => sum + t.delta, 0)
  const hits = trials.filter((t) => t.kind === 'hit').length
  const misses = trials.filter((t) => t.kind === 'miss').length
  const falseAlarms = trials.filter((t) => t.kind === 'falseAlarm').length
  const correctRejections = trials.filter((t) => t.kind === 'correctReject').length
  return {
    judged: trials.length,
    correct,
    mistakes,
    correctRate: trials.length === 0 ? 0 : correct / trials.length,
    dPrime: dPrime(hits, misses, falseAlarms, correctRejections),
    hits,
    misses,
    falseAlarms,
    correctRejections,
    scoreDelta,
    trials,
  }
}

/**
 * 标准正态分布的反函数（分位函数），Acklam 算法，|误差| < 1.15e-9。
 * 用于把命中率/虚报率换算成 z 分。
 */
export function probit(p: number): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) throw new RangeError(`probit: p=${p} 必须在 (0,1) 开区间`)
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pLow = 0.02425
  let q: number
  let r: number
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p <= 1 - pLow) {
    q = p - 0.5
    r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  }
  q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
}

/**
 * 信号检测论 d'（log-linear 校正：0 命中/0 虚报用 0.5 平滑，避免 ±∞）。
 * 全程不操作 → 命中率极低 → d' 为负，无法靠「正确放过」躺分。
 */
export function dPrime(hits: number, misses: number, falseAlarms: number, correctRejections: number): number {
  const hitRate = (hits + 0.5) / (hits + misses + 1)
  const faRate = (falseAlarms + 0.5) / (falseAlarms + correctRejections + 1)
  return probit(hitRate) - probit(faRate)
}

export type RoundOutcome = 'up' | 'stay' | 'down'

/** 升降级规则（按敏感度 d'，而非正确率）：d' ≥1.5 升级，<0.5 降级，其间保持 */
export const UP_THRESHOLD = 1.5
export const DOWN_THRESHOLD = 0.5

export function roundOutcome(dp: number): RoundOutcome {
  if (dp >= UP_THRESHOLD) return 'up'
  if (dp < DOWN_THRESHOLD) return 'down'
  return 'stay'
}

/** 下一局的 N（封顶 MAX_N，保底 MIN_N） */
export function nextN(dp: number, currentN: number): number {
  switch (roundOutcome(dp)) {
    case 'up':
      return Math.min(currentN + 1, MAX_N)
    case 'down':
      return Math.max(currentN - 1, MIN_N)
    default:
      return currentN
  }
}
