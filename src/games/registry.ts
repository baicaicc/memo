import type { Component } from 'vue'

export type GameId = 'matrix' | 'corsi' | 'digit' | 'stroop'

export type Dimension = 'spatial' | 'sequence' | 'verbal' | 'reaction'

export const DIMENSION_LABELS: Record<Dimension, string> = {
  spatial: '空间记忆',
  sequence: '序列记忆',
  verbal: '言语记忆',
  reaction: '反应速度',
}

export interface GameMeta {
  id: GameId
  name: string
  tagline: string
  dimension: Dimension
  /** 该游戏的等级上限参考值，用于雷达图把最佳等级归一化到 0–100 */
  maxLevel: number
  component: () => Promise<{ default: Component }>
}

export const games: GameMeta[] = [
  {
    id: 'matrix',
    name: '记忆矩阵',
    tagline: '记住亮起的格子，熄灭后点回来',
    dimension: 'spatial',
    maxLevel: 10,
    component: () => import('./matrix/Game.vue'),
  },
  {
    id: 'corsi',
    name: '光影序列',
    tagline: '跟着点亮的顺序，原样点回去',
    dimension: 'sequence',
    maxLevel: 12,
    component: () => import('./corsi/Game.vue'),
  },
  {
    id: 'digit',
    name: '数字闪电',
    tagline: '数字一闪而过，按顺序输入取件码',
    dimension: 'verbal',
    maxLevel: 12,
    component: () => import('./digit/Game.vue'),
  },
  {
    id: 'stroop',
    name: '颜色陷阱',
    tagline: '别管字义，选出墨水的颜色',
    dimension: 'reaction',
    maxLevel: 20,
    component: () => import('./stroop/Game.vue'),
  },
]

export function getGame(id: string): GameMeta | undefined {
  return games.find((g) => g.id === id)
}
