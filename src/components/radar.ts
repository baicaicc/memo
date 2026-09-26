import type { Dimension } from '@/games/registry'

export interface Point {
  x: number
  y: number
}

/** 雷达图固定维度顺序：从正上方开始顺时针 */
export const RADAR_DIMENSIONS: Dimension[] = [
  'spatial',
  'sequence',
  'verbal',
  'reaction',
]

/** 归一化到 0–100，非法值按 0 处理 */
export function clampValue(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/** 第 index 个维度的轴角（度）：-90°（正上方）起，顺时针均分 */
export function axisAngle(index: number): number {
  return -90 + (index * 360) / RADAR_DIMENSIONS.length
}

/** 极坐标转直角坐标 */
export function polarPoint(
  angleDeg: number,
  radius: number,
  cx: number,
  cy: number,
): Point {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
}

/** 数据多边形顶点：按 RADAR_DIMENSIONS 顺序取值，0–100 映射到 0–radius */
export function radarPolygon(
  values: Record<Dimension, number>,
  radius: number,
  cx: number,
  cy: number,
): Point[] {
  return RADAR_DIMENSIONS.map((dim, i) =>
    polarPoint(axisAngle(i), (clampValue(values[dim]) / 100) * radius, cx, cy),
  )
}

/** 网格环多边形：ratio 0–1，越界截断 */
export function ringPolygon(
  ratio: number,
  radius: number,
  cx: number,
  cy: number,
): Point[] {
  const r = Math.min(1, Math.max(0, ratio)) * radius
  return RADAR_DIMENSIONS.map((_, i) => polarPoint(axisAngle(i), r, cx, cy))
}

/** 保留两位小数 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 拼成 SVG polygon 的 points 属性："x,y x,y ..." */
export function pointsToAttr(points: Point[]): string {
  return points.map((p) => `${round2(p.x)},${round2(p.y)}`).join(' ')
}
