// 记忆矩阵出题/判定/计分逻辑。纯函数，随机一律走 core/rng 的种子序列。
import type { Rng } from '@/core/rng'

export const GAME_ID = 'matrix' as const

/** 等级上限（7 级起 5×5，亮格数仍能装下） */
export const MAX_LEVEL = 10

/** 每轮允许的点错次数上限，达到即判本轮失败 */
export const MAX_MISTAKES_PER_ROUND = 3

export interface MatrixPuzzle {
  /** 网格边长（N×N） */
  gridSize: number
  /** 亮起格子的索引（0 起、行优先），互不重复且升序 */
  cells: number[]
}

/** 等级 → 网格边长：1–3 级 3×3，4–6 级 4×4，7 级以上 5×5 */
export function gridSizeForLevel(level: number): number {
  if (level <= 3) return 3
  if (level <= 6) return 4
  return 5
}

/** 亮起格子数 = 等级 + 2 */
export function litCountForLevel(level: number): number {
  return level + 2
}

/** 亮格展示时长（毫秒）= 1.2s + 0.15s × 亮格数 */
export function showDurationMs(level: number): number {
  return 1200 + 150 * litCountForLevel(level)
}

/** 点对一格得分 = 等级 × 10 */
export function scorePerCell(level: number): number {
  return level * 10
}

/** 整轮全部找对的额外奖励 = 等级 × 20 */
export function roundBonus(level: number): number {
  return level * 20
}

/** 生成一道题：cells 取自 gridSize² 个格子，用 rng.uniqueInts 保证不重复 */
export function generatePuzzle(rng: Rng, level: number): MatrixPuzzle {
  const gridSize = gridSizeForLevel(level)
  const cells = rng
    .uniqueInts(litCountForLevel(level), 0, gridSize * gridSize - 1)
    .sort((a, b) => a - b)
  return { gridSize, cells }
}

export interface RecallVerdict {
  /** 点中的目标格 */
  hits: number[]
  /** 点错的格子 */
  misses: number[]
  /** 是否已找齐全部亮格（本轮成功） */
  completed: boolean
}

/** 判定回忆结果：picked 为玩家已点的格子序列（重复点击只算一次） */
export function checkRecall(cells: readonly number[], picked: readonly number[]): RecallVerdict {
  const target = new Set(cells)
  const seen = new Set<number>()
  const hits: number[] = []
  const misses: number[] = []
  for (const c of picked) {
    if (seen.has(c)) continue
    seen.add(c)
    ;(target.has(c) ? hits : misses).push(c)
  }
  return { hits, misses, completed: hits.length === cells.length }
}
