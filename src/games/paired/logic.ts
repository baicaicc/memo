// 物归原位（配对联想）出题/判定/计分逻辑。纯函数，随机一律走 core/rng 的种子序列。
import type { Rng } from '@/core/rng'

export const GAME_ID = 'paired' as const

/** 等级上限（此时物品数已顶到槽位数，全上） */
export const MAX_LEVEL = 10

/** 收纳架槽位数（固定 8 格） */
export const SLOT_COUNT = 8

export interface PairedItem {
  emoji: string
  name: string
}

/** 日常物品池（≥16 件，18–60 岁都认识的常见物件） */
export const ITEM_POOL: readonly PairedItem[] = [
  { emoji: '🔑', name: '钥匙' },
  { emoji: '📖', name: '书本' },
  { emoji: '☕', name: '杯子' },
  { emoji: '🎧', name: '耳机' },
  { emoji: '✂️', name: '剪刀' },
  { emoji: '🔦', name: '手电' },
  { emoji: '🧢', name: '帽子' },
  { emoji: '👓', name: '眼镜' },
  { emoji: '📱', name: '手机' },
  { emoji: '🖊️', name: '钢笔' },
  { emoji: '⌚', name: '手表' },
  { emoji: '🌂', name: '雨伞' },
  { emoji: '🍎', name: '苹果' },
  { emoji: '🧸', name: '小熊' },
  { emoji: '🎲', name: '骰子' },
  { emoji: '🔋', name: '电池' },
  { emoji: '🧴', name: '瓶子' },
  { emoji: '🕯️', name: '蜡烛' },
  { emoji: '🧤', name: '手套' },
  { emoji: '📦', name: '盒子' },
]

/** 出场物品数 = 等级 + 1（封顶到槽位数） */
export function itemCountForLevel(level: number): number {
  return Math.min(level + 1, SLOT_COUNT)
}

/** 摆放展示时长（毫秒）= 3s + 0.5s × 物品数 */
export function showDurationMs(level: number): number {
  return 3000 + 500 * itemCountForLevel(level)
}

/** 放对一件得分 = 等级 × 10 */
export function scorePerItem(level: number): number {
  return level * 10
}

/** 整轮全部放对的额外奖励 = 等级 × 20 */
export function roundBonus(level: number): number {
  return level * 20
}

export interface PairedLayout {
  /** 本轮出场的 K 件物品 */
  items: PairedItem[]
  /** slotAssignments[i] = items[i] 摆放的槽位索引（0 起，互不重复） */
  slotAssignments: number[]
  /** 回忆阶段物品在下方托盘里的排列顺序（items 索引的乱序排列） */
  trayOrder: number[]
}

/**
 * 生成一轮摆放：从物品池选 K 件互不相同的物品，分配到 K 个互不相同的槽位；
 * 托盘顺序也用同一个 rng 打乱，保证同种子整局复现。
 */
export function generateLayout(rng: Rng, level: number): PairedLayout {
  const k = itemCountForLevel(level)
  const items = rng.uniqueInts(k, 0, ITEM_POOL.length - 1).map((i) => ITEM_POOL[i])
  const slotAssignments = rng.uniqueInts(k, 0, SLOT_COUNT - 1)
  const trayOrder = rng.shuffle(items.map((_, i) => i))
  return { items, slotAssignments, trayOrder }
}

export interface PlacementVerdict {
  /** 放对位置的物品索引 */
  correctItems: number[]
  /** 放错位置的物品索引 */
  wrongItems: number[]
  /** 放对件数 */
  correct: number
  /** 本轮物品总数 */
  total: number
  /** 是否全部放对（本轮成功） */
  allCorrect: boolean
}

/**
 * 判定归位结果。placements[slot] = 放入该槽的物品索引，-1 表示空槽；
 * 物品 i 放对当且仅当 placements[assignments[i]] === i。
 */
export function checkPlacement(
  assignments: readonly number[],
  placements: readonly number[],
): PlacementVerdict {
  const correctItems: number[] = []
  const wrongItems: number[] = []
  assignments.forEach((slot, item) => {
    if (placements[slot] === item) correctItems.push(item)
    else wrongItems.push(item)
  })
  return {
    correctItems,
    wrongItems,
    correct: correctItems.length,
    total: assignments.length,
    allCorrect: wrongItems.length === 0,
  }
}
