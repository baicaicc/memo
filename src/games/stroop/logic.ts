// 颜色陷阱（Stroop）出题/判定/计分逻辑。纯函数，随机一律走 core/rng 的种子序列。
import type { Rng } from '@/core/rng'

export const GAME_ID = 'stroop' as const

export interface StroopColor {
  id: string
  /** 颜色字（字义） */
  word: string
  /** 墨水/色块颜色 */
  hex: string
  /** 色盲友好符号 */
  symbol: string
}

export const ALL_COLORS: StroopColor[] = [
  { id: 'red', word: '红', hex: '#f87171', symbol: '●' },
  { id: 'yellow', word: '黄', hex: '#facc15', symbol: '▲' },
  { id: 'blue', word: '蓝', hex: '#60a5fa', symbol: '■' },
  { id: 'green', word: '绿', hex: '#4ade80', symbol: '★' },
  { id: 'purple', word: '紫', hex: '#c084fc', symbol: '◆' },
  { id: 'orange', word: '橙', hex: '#fb923c', symbol: '♥' },
]

/** level 1-2 只用前 4 色（红黄蓝绿） */
export const BASIC_COLORS: StroopColor[] = ALL_COLORS.slice(0, 4)

/** 当前等级可用的颜色池：level 3+ 解锁 6 色 */
export function colorsForLevel(level: number): StroopColor[] {
  return level >= 3 ? [...ALL_COLORS] : [...BASIC_COLORS]
}

/** 字义与墨水不一致的比例：level 3+ 提高到 75% */
export function incongruentRate(level: number): number {
  return level >= 3 ? 0.75 : 0.6
}

export interface Trial {
  /** 屏幕中央显示的颜色字 */
  word: string
  /** 墨水颜色 id（正确答案） */
  inkColor: string
  /** 色块按钮的颜色 id 列表，含正确答案，已乱序 */
  options: string[]
  /** 字义与墨水是否一致 */
  matched: boolean
}

export function generateTrial(rng: Rng, level: number): Trial {
  const colors = colorsForLevel(level)
  const wordColor = rng.pick(colors)
  let inkColor = wordColor
  if (rng.next() < incongruentRate(level)) {
    inkColor = rng.pick(colors.filter((c) => c.id !== wordColor.id))
  }
  const options = rng.shuffle(colors.map((c) => c.id))
  return {
    word: wordColor.word,
    inkColor: inkColor.id,
    options,
    matched: inkColor.id === wordColor.id,
  }
}

export const SCORE_CORRECT = 10
export const SCORE_WRONG = -5

export interface AnswerScore {
  /** 得分变化：答对 +10，答错 -5 */
  delta: number
  /** 是否答对（答错需计 error） */
  isRight: boolean
}

export function scoreAnswer(correct: string, picked: string): AnswerScore {
  const isRight = picked === correct
  return { delta: isRight ? SCORE_CORRECT : SCORE_WRONG, isRight }
}

export function colorById(id: string): StroopColor | undefined {
  return ALL_COLORS.find((c) => c.id === id)
}
