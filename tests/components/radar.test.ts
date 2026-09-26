import { describe, expect, it } from 'vitest'
import {
  RADAR_DIMENSIONS,
  axisAngle,
  clampValue,
  polarPoint,
  pointsToAttr,
  radarPolygon,
  ringPolygon,
} from '@/components/radar'

describe('components/radar', () => {
  it('维度顺序固定为 空间/序列/言语/反应/情景', () => {
    expect(RADAR_DIMENSIONS).toEqual([
      'spatial',
      'sequence',
      'verbal',
      'reaction',
      'episodic',
    ])
  })

  it('clampValue 把数值限制在 0–100，非法值按 0', () => {
    expect(clampValue(-5)).toBe(0)
    expect(clampValue(0)).toBe(0)
    expect(clampValue(55)).toBe(55)
    expect(clampValue(120)).toBe(100)
    expect(clampValue(NaN)).toBe(0)
    expect(clampValue(Infinity)).toBe(0)
  })

  it('轴角从正上方开始，顺时针均分 360°', () => {
    const step = 360 / RADAR_DIMENSIONS.length
    expect(axisAngle(0)).toBe(-90)
    RADAR_DIMENSIONS.forEach((_, i) => {
      expect(axisAngle(i)).toBeCloseTo(-90 + i * step)
    })
  })

  it('polarPoint 极坐标换算正确', () => {
    const p = polarPoint(0, 10, 5, 5)
    expect(p.x).toBeCloseTo(15)
    expect(p.y).toBeCloseTo(5)
    const top = polarPoint(-90, 10, 5, 5)
    expect(top.x).toBeCloseTo(5)
    expect(top.y).toBeCloseTo(-5)
  })

  it('radarPolygon：全 0 时顶点都在圆心，满分时落在轴端点', () => {
    const zero = radarPolygon(
      { spatial: 0, sequence: 0, verbal: 0, reaction: 0, episodic: 0 },
      80,
      100,
      100,
    )
    for (const p of zero) {
      expect(p.x).toBeCloseTo(100)
      expect(p.y).toBeCloseTo(100)
    }
    const full = radarPolygon(
      { spatial: 100, sequence: 100, verbal: 100, reaction: 100, episodic: 100 },
      80,
      100,
      100,
    )
    expect(full[0].x).toBeCloseTo(100) // 上：空间
    expect(full[0].y).toBeCloseTo(20)
    // 其余顶点按 360/N 均分落在半径 80 的圆周上
    for (const p of full) {
      const r = Math.hypot(p.x - 100, p.y - 100)
      expect(r).toBeCloseTo(80)
    }
  })

  it('radarPolygon：分数线性映射到半径，越界值被截断', () => {
    const pts = radarPolygon(
      { spatial: 50, sequence: 150, verbal: -10, reaction: 25, episodic: 75 },
      80,
      100,
      100,
    )
    expect(pts[0].y).toBeCloseTo(60) // 50 → 半径一半
    const r1 = Math.hypot(pts[1].x - 100, pts[1].y - 100)
    expect(r1).toBeCloseTo(80) // 150 → 截断到满分
    const r2 = Math.hypot(pts[2].x - 100, pts[2].y - 100)
    expect(r2).toBeCloseTo(0) // -10 → 截断到 0 → 圆心
    const r3 = Math.hypot(pts[3].x - 100, pts[3].y - 100)
    expect(r3).toBeCloseTo(20) // 25 → 半径 20
    const r4 = Math.hypot(pts[4].x - 100, pts[4].y - 100)
    expect(r4).toBeCloseTo(60) // 75 → 半径 60
  })

  it('ringPolygon 按比例生成网格环并截断 ratio', () => {
    const half = ringPolygon(0.5, 80, 100, 100)
    expect(half[0].y).toBeCloseTo(60)
    // 所有顶点落在半径 40 的圆周上
    for (const p of half) {
      expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(40)
    }
    expect(ringPolygon(2, 80, 100, 100)[0].y).toBeCloseTo(20)
    expect(ringPolygon(-1, 80, 100, 100)[0].y).toBeCloseTo(100)
  })

  it('pointsToAttr 输出 "x,y" 空格连接且保留两位小数', () => {
    expect(
      pointsToAttr([
        { x: 100, y: 20 },
        { x: 180.456, y: 100.1 },
      ]),
    ).toBe('100,20 180.46,100.1')
  })
})
