// 数字闪电（数字广度顺背）出题/判定/计分逻辑。纯函数，出题随机一律走 core/rng 的种子随机。
import type { Rng } from '@/core/rng'

export const GAME_ID = 'digit' as const

/** 等级范围：Lv.1 起步，封顶 Lv.12 */
export const MIN_LEVEL = 1
export const MAX_LEVEL = 12

/** 闪现节奏：每个数字显示 800ms，间隔 200ms */
export const DIGIT_SHOW_MS = 800
export const DIGIT_GAP_MS = 200

/** 每位数字的分值 */
export const SCORE_PER_DIGIT = 15

/** 取件码长度 = level + 2（Lv.1 为 3 位，Lv.12 为 14 位） */
export function spanLength(level: number): number {
  return level + 2
}

/** 本轮得分 = 长度 × 15 */
export function roundScore(length: number): number {
  return length * SCORE_PER_DIGIT
}

/**
 * 生成指定长度的取件码。允许重复数字，逐位调用 rng.int(0, 9)，
 * 不能用 uniqueInts（最长 14 位超过 0-9 池，且顺背允许重复）。
 */
export function generateDigits(rng: Rng, length: number): number[] {
  return Array.from({ length }, () => rng.int(0, 9))
}

/** 判定：长度一致且逐位相同才算全对 */
export function checkAnswer(
  digits: readonly number[],
  input: readonly number[],
): boolean {
  if (digits.length !== input.length) return false
  return digits.every((d, i) => d === input[i])
}
