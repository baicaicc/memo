<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { DIMENSION_LABELS, getGame, type GameId } from '@/games/registry'
import { useStatsStore } from '@/stores/stats'
import { RADAR_DIMENSIONS, polarPoint, radarPolygon } from '@/components/radar'

const props = defineProps<{
  open: boolean
  gameId: GameId
  score: number
  level: number
  isBest: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const stats = useStatsStore()
const ready = ref(false)
const posterUrl = ref('')

const W = 640
const H = 1000
const CX = W / 2
const RADAR_CY = 600
const RADAR_R = 150

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function draw(): void {
  const canvas = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = W * dpr
  canvas.height = H * dpr
  const c = canvas.getContext('2d')
  if (!c) return
  c.scale(dpr, dpr)

  const bg = c.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#141926')
  bg.addColorStop(1, '#0d1017')
  c.fillStyle = bg
  c.fillRect(0, 0, W, H)

  // 装饰光斑
  const glow = c.createRadialGradient(W - 60, 80, 10, W - 60, 80, 260)
  glow.addColorStop(0, 'rgba(91, 140, 255, 0.22)')
  glow.addColorStop(1, 'rgba(91, 140, 255, 0)')
  c.fillStyle = glow
  c.fillRect(0, 0, W, 420)

  const primary = cssVar('--color-primary', '#5b8cff')
  const text = cssVar('--color-text', '#e8ecf4')
  const dim = cssVar('--color-text-dim', '#8a93a6')

  c.textAlign = 'center'
  // 顶部：产品名 + 日期
  c.fillStyle = primary
  c.font = '600 30px -apple-system, PingFang SC, sans-serif'
  c.fillText('记忆训练', CX, 86)
  c.fillStyle = dim
  c.font = '24px -apple-system, PingFang SC, sans-serif'
  c.fillText(new Date().toLocaleDateString('zh-CN'), CX, 124)

  // 游戏名
  c.fillStyle = text
  c.font = '600 40px -apple-system, PingFang SC, sans-serif'
  c.fillText(getGame(props.gameId)?.name ?? String(props.gameId), CX, 210)

  // 分数
  c.fillStyle = primary
  c.font = '700 132px -apple-system, PingFang SC, sans-serif'
  c.fillText(String(props.score), CX, 350)
  c.fillStyle = dim
  c.font = '26px -apple-system, PingFang SC, sans-serif'
  c.fillText(`达到等级 Lv.${props.level}${props.isBest ? ' · 🎉 新纪录' : ''}`, CX, 396)

  // 雷达图
  const values = stats.radar
  for (const ratio of [0.25, 0.5, 0.75, 1]) {
    c.beginPath()
    for (let i = 0; i < RADAR_DIMENSIONS.length; i++) {
      const p = polarPoint(-90 + (i * 360) / RADAR_DIMENSIONS.length, RADAR_R * ratio, CX, RADAR_CY)
      if (i === 0) c.moveTo(p.x, p.y)
      else c.lineTo(p.x, p.y)
    }
    c.closePath()
    c.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    c.lineWidth = 1
    c.stroke()
  }
  const poly = radarPolygon(values, RADAR_R, CX, RADAR_CY)
  c.beginPath()
  poly.forEach((p, i) => (i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)))
  c.closePath()
  c.fillStyle = 'rgba(91, 140, 255, 0.25)'
  c.fill()
  c.strokeStyle = primary
  c.lineWidth = 2
  c.stroke()
  RADAR_DIMENSIONS.forEach((dim, i) => {
    const p = polarPoint(-90 + (i * 360) / RADAR_DIMENSIONS.length, RADAR_R + 34, CX, RADAR_CY)
    c.fillStyle = dim
    c.font = '22px -apple-system, PingFang SC, sans-serif'
    c.fillText(DIMENSION_LABELS[dim], p.x, p.y + 8)
  })

  // 脑力指数
  c.fillStyle = cssVar('--color-accent', '#ffd166')
  c.font = '600 34px -apple-system, PingFang SC, sans-serif'
  c.fillText(`脑力指数 ${stats.brainIndex}`, CX, 830)

  // 底部
  c.fillStyle = dim
  c.font = '24px -apple-system, PingFang SC, sans-serif'
  c.fillText('memo.sesamebox.cn · 微信打开即玩', CX, 940)

  posterUrl.value = canvas.toDataURL('image/png')
  ready.value = true
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      ready.value = false
      await nextTick()
      draw()
    }
  },
)
</script>

<template>
  <transition name="fade">
    <div v-if="open" class="overlay" @click="emit('close')">
      <div class="sheet" @click.stop>
        <div class="frame">
          <img v-if="ready" :src="posterUrl" alt="成绩海报" />
          <p v-else class="pending">生成中…</p>
        </div>
        <p class="hint">长按图片保存或转发 · 点空白处关闭</p>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 90;
  padding: 20px;
}

.sheet {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.frame img {
  width: min(78vw, 340px);
  border-radius: var(--radius-l);
  display: block;
}

.pending {
  width: min(78vw, 340px);
  height: 530px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-card);
  border-radius: var(--radius-l);
  color: var(--color-text-dim);
}

.hint {
  color: var(--color-text-dim);
  font-size: 13px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
