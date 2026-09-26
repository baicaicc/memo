// 光影序列（Corsi）出题/判定/计分逻辑（W2 实现）。保持纯函数、依赖 core/rng 的种子随机。
import type { Rng } from '@/core/rng'

export const GAME_ID = 'corsi' as const

/** 圆块数量（科学原型 Corsi block tapping 为 9 个不规则摆放的块） */
export const BLOCK_COUNT = 9
export const MIN_LEVEL = 1
export const MAX_LEVEL = 12
/** 演示阶段每块点亮时长（毫秒） */
export const LIGHT_MS = 600
/** 相邻两次点亮的间隔（毫秒） */
export const GAP_MS = 200
/** 计分系数：本轮得分 = 序列长度 × 15 */
export const SCORE_PER_BLOCK = 15

export interface BlockPosition {
  /** 圆心相对棋盘宽高的百分比坐标 */
  x: number
  y: number
}

/**
 * 9 个圆块的固定不规则坐标（百分比）。
 * 刻意避开九宫格排布，防止玩家用「第几行第几列」语言化记忆，保持空间序列记忆负荷。
 */
export const BLOCK_POSITIONS: readonly BlockPosition[] = [
  { x: 20, y: 16 },
  { x: 58, y: 10 },
  { x: 84, y: 26 },
  { x: 12, y: 46 },
  { x: 44, y: 36 },
  { x: 74, y: 52 },
  { x: 28, y: 72 },
  { x: 60, y: 84 },
  { x: 88, y: 76 },
]

/** 序列长度 = level + 2（level 1 起步为 3，level 12 为 14） */
export function sequenceLength(level: number): number {
  return level + 2
}

/** 本轮得分 = 序列长度 × 15 */
export function roundScore(level: number): number {
  return sequenceLength(level) * SCORE_PER_BLOCK
}

/**
 * 用种子随机生成点亮序列，元素为圆块索引 [0, BLOCK_COUNT)。
 * 长度不超过块数时序列内不重复（uniqueInts）；
 * 长度超过块数（level 12 需要 14 > 9）时分段生成，每段内不重复、段间允许重复。
 */
export function generateSequence(rng: Rng, length: number): number[] {
  if (length < 1) return []
  const out: number[] = []
  while (out.length < length) {
    const n = Math.min(length - out.length, BLOCK_COUNT)
    out.push(...rng.uniqueInts(n, 0, BLOCK_COUNT - 1))
  }
  return out
}

/** 判定第 tapIndex 下（0 起）点按 tappedBlock 是否与序列一致 */
export function checkTap(
  sequence: readonly number[],
  tapIndex: number,
  tappedBlock: number,
): boolean {
  return sequence[tapIndex] === tappedBlock
}
