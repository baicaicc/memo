<script setup lang="ts">
import { computed } from 'vue'
import { DIMENSION_LABELS, type Dimension } from '@/games/registry'
import {
  RADAR_DIMENSIONS,
  axisAngle,
  clampValue,
  polarPoint,
  pointsToAttr,
  radarPolygon,
  ringPolygon,
} from './radar'

const props = defineProps<{ values: Record<Dimension, number> }>()

const SIZE = 240
const CENTER = SIZE / 2
const RADIUS = 72
const LABEL_RADIUS = 92
const RING_RATIOS = [0.25, 0.5, 0.75, 1]

const rings = RING_RATIOS.map((r) =>
  pointsToAttr(ringPolygon(r, RADIUS, CENTER, CENTER)),
)
const axes = RADAR_DIMENSIONS.map((_, i) =>
  polarPoint(axisAngle(i), RADIUS, CENTER, CENTER),
)

const dataPoints = computed(() =>
  radarPolygon(props.values, RADIUS, CENTER, CENTER),
)
const dataAttr = computed(() => pointsToAttr(dataPoints.value))

const labels = computed(() =>
  RADAR_DIMENSIONS.map((dim, i) => {
    const p = polarPoint(axisAngle(i), LABEL_RADIUS, CENTER, CENTER)
    // 标签两行（名称 + 数值），微调首行基线避免上下方向出界
    const y = i === 0 ? p.y - 16 : i === 2 ? p.y - 4 : p.y - 8
    return {
      dim,
      name: DIMENSION_LABELS[dim],
      value: Math.round(clampValue(props.values[dim])),
      x: p.x,
      y,
    }
  }),
)
</script>

<template>
  <svg
    class="radar"
    :viewBox="`0 0 ${SIZE} ${SIZE}`"
    role="img"
    aria-label="四维能力雷达图"
  >
    <polygon v-for="(pts, i) in rings" :key="i" class="ring" :points="pts" />
    <line
      v-for="(a, i) in axes"
      :key="i"
      class="axis"
      :x1="CENTER"
      :y1="CENTER"
      :x2="a.x"
      :y2="a.y"
    />
    <polygon class="data" :points="dataAttr" />
    <circle
      v-for="(p, i) in dataPoints"
      :key="i"
      class="dot"
      :cx="p.x"
      :cy="p.y"
      r="3"
    />
    <text
      v-for="l in labels"
      :key="l.dim"
      :x="l.x"
      :y="l.y"
      text-anchor="middle"
    >
      <tspan :x="l.x" class="label-name" font-size="11">{{ l.name }}</tspan>
      <tspan :x="l.x" dy="14" class="label-value" font-size="12">
        {{ l.value }}
      </tspan>
    </text>
  </svg>
</template>

<style scoped>
.radar {
  display: block;
  width: 100%;
  height: auto;
}

.ring {
  fill: none;
  stroke: var(--color-border);
  stroke-width: 1;
}

.axis {
  stroke: var(--color-border);
  stroke-width: 1;
}

.data {
  fill: var(--color-primary);
  fill-opacity: 0.25;
  stroke: var(--color-primary);
  stroke-width: 2;
  stroke-linejoin: round;
}

.dot {
  fill: var(--color-accent);
}

.data,
.dot {
  animation: fade-in 0.4s ease both;
}

.label-name {
  fill: var(--color-text-dim);
}

.label-value {
  fill: var(--color-text);
  font-weight: 600;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}
</style>
