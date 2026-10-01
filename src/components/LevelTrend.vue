<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DayPoint } from '@/core/progress'

const props = defineProps<{ points: DayPoint[] }>()

// viewBox 单位约等于 CSS px（卡片内宽约 300）
const W = 300
const H = 76
const PAD = { left: 6, right: 44, top: 12, bottom: 20 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

const step = computed(() => plotW / Math.max(1, props.points.length - 1))
const xAt = (i: number) => PAD.left + i * step.value

/** 纵轴只随数据范围伸缩，上下各留一级，低等级时也看得出起伏 */
const range = computed(() => {
  const levels = props.points.flatMap((p) => (p.level === null ? [] : [p.level]))
  const lo = Math.max(0, Math.min(...levels) - 1)
  const hi = Math.max(...levels) + 1
  return { lo, hi }
})
const yAt = (v: number) => PAD.top + ((range.value.hi - v) / (range.value.hi - range.value.lo)) * plotH

const marks = computed(() =>
  props.points.flatMap((p, i) => (p.level === null ? [] : [{ i, x: xAt(i), y: yAt(p.level), level: p.level }])),
)
/** 没练的日子不画点，折线把相邻有成绩的日子连起来 */
const linePath = computed(() => marks.value.map((m, k) => `${k ? 'L' : 'M'}${m.x},${m.y}`).join(' '))
const last = computed(() => marks.value[marks.value.length - 1])

const selected = ref<number | null>(null)

function shortDate(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(m)}/${Number(d)}`
}

const caption = computed(() => {
  if (selected.value === null) return `近 ${props.points.length} 天每日最高等级 · 点图看某天`
  const p = props.points[selected.value]
  const isToday = selected.value === props.points.length - 1
  const day = isToday ? '今天' : shortDate(p.date)
  return p.level === null ? `${day} · 没练` : `${day} · 最高 Lv.${p.level}`
})

function toggle(i: number) {
  selected.value = selected.value === i ? null : i
}
</script>

<template>
  <div class="trend">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`近 ${points.length} 天每日最高等级`">
      <line class="base" :x1="PAD.left" :x2="W - PAD.right" :y1="H - PAD.bottom" :y2="H - PAD.bottom" />
      <line
        v-if="selected !== null"
        class="cross"
        :x1="xAt(selected)"
        :x2="xAt(selected)"
        :y1="PAD.top - 6"
        :y2="H - PAD.bottom"
      />
      <path v-if="marks.length > 1" class="line" :d="linePath" />
      <circle
        v-for="m in marks"
        :key="m.i"
        class="dot"
        :class="{ latest: m === last, active: m.i === selected }"
        :cx="m.x"
        :cy="m.y"
        r="4"
      />
      <text v-if="last" class="end-label" :x="last.x + 9" :y="last.y + 4">Lv.{{ last.level }}</text>
      <text class="axis-label" :x="PAD.left" :y="H - 4">{{ shortDate(points[0].date) }}</text>
      <text class="axis-label" :x="W - PAD.right" :y="H - 4" text-anchor="end">今天</text>
      <!-- 每天一条整高的点击热区，比数据点大得多 -->
      <rect
        v-for="(p, i) in points"
        :key="p.date"
        class="hit"
        :x="xAt(i) - step / 2"
        :y="0"
        :width="step"
        :height="H"
        @click="toggle(i)"
      />
    </svg>
    <div class="caption">{{ caption }}</div>
  </div>
</template>

<style scoped>
.trend {
  margin-top: 12px;
}

svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.base {
  stroke: var(--color-border);
  stroke-width: 1;
}

.cross {
  stroke: var(--color-text-dim);
  stroke-width: 1;
  opacity: 0.6;
}

.line {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

/* 2px 底色描边，让点压在线上时仍清楚 */
.dot {
  fill: var(--color-primary);
  stroke: var(--color-card);
  stroke-width: 2;
}

.dot.latest {
  fill: var(--color-accent);
}

.dot.active {
  stroke: var(--color-text);
}

.end-label {
  font-size: 12px;
  font-weight: 700;
  fill: var(--color-text);
}

.axis-label {
  font-size: 10px;
  fill: var(--color-text-dim);
}

.hit {
  fill: transparent;
  cursor: pointer;
}

.caption {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-dim);
}
</style>
