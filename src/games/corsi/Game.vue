<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createRng } from '@/core/rng'
import { createStaircase } from '@/core/staircase'
import { useGameSession } from '@/core/session'
import { useStatsStore } from '@/stores/stats'
import { getGame } from '@/games/registry'
import { onVisibilityChange } from '@/wechat/compat'
import { play } from '@/audio/sfx'
import PageContainer from '@/components/PageContainer.vue'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import {
  BLOCK_POSITIONS,
  GAP_MS,
  LIGHT_MS,
  MAX_LEVEL,
  MIN_LEVEL,
  checkTap,
  generateSequence,
  roundScore,
  sequenceLength,
} from './logic'

const meta = getGame('corsi')!
const route = useRoute()
const router = useRouter()
const stats = useStatsStore()

function firstQuery(v: unknown): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  return typeof s === 'string' && s !== '' ? s : undefined
}

const querySeed = firstQuery(route.query.seed)
const queryLevel = (() => {
  const raw = firstQuery(route.query.level)
  if (raw === undefined) return undefined
  const n = Number(raw)
  if (!Number.isInteger(n)) return undefined
  return Math.min(Math.max(n, MIN_LEVEL), MAX_LEVEL)
})()

// 挑战模式：同种子（且同起始等级）可复现同一套题
const session = useGameSession('corsi', {
  seed: querySeed,
  initialLevel: queryLevel,
})
const isChallenge = querySeed !== undefined

const staircase = createStaircase({
  initialLevel: session.level.value,
  minLevel: MIN_LEVEL,
  maxLevel: MAX_LEVEL,
})

const phase = computed(() => session.phase.value)
const score = computed(() => session.score.value)
const level = computed(() => session.level.value)
const failures = ref(staircase.failures)

const blocks = BLOCK_POSITIONS
const sequence = ref<number[]>([])
const round = ref(0)
const tapIndex = ref(0)
/** 演示阶段当前点亮的块索引，-1 表示无 */
const activeBlock = ref(-1)
/** 玩家点按后的瞬时标记（对/错高亮） */
const tapMark = ref<{ index: number; kind: 'ok' | 'bad' } | null>(null)
const feedback = ref<'' | 'success' | 'fail'>('')
const feedbackText = ref('')
const maxSpan = ref(0)
const maxPassedLevel = ref(0)
/** 在最高等级（长度 14）通关次数，满 2 次视为通关并结束本局，防止无限刷分 */
const topClears = ref(0)

// ---------- 可暂停的单发计时器（播放/反馈节奏，切后台时冻结剩余时间） ----------
let runToken = 0
let timeoutId: number | null = null
let endAt = 0
let remainMs = 0
let wake: (() => void) | null = null
let suspended = false
let markTimer: number | null = null

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    wake = resolve
    if (suspended) {
      remainMs = ms
      return
    }
    endAt = performance.now() + ms
    timeoutId = window.setTimeout(fire, ms)
  })
}

function fire() {
  timeoutId = null
  const w = wake
  wake = null
  w?.()
}

function suspendTimers() {
  suspended = true
  if (timeoutId != null) {
    window.clearTimeout(timeoutId)
    timeoutId = null
    remainMs = Math.max(0, endAt - performance.now())
  }
}

function resumeTimers() {
  suspended = false
  if (timeoutId == null && wake) {
    endAt = performance.now() + remainMs
    timeoutId = window.setTimeout(fire, remainMs)
  }
}

function cancelTimers() {
  runToken += 1
  if (timeoutId != null) {
    window.clearTimeout(timeoutId)
    timeoutId = null
  }
  const w = wake
  wake = null
  w?.()
}

const offVisibility = onVisibilityChange(({ hidden }) => {
  if (hidden) suspendTimers()
  else resumeTimers()
})

onBeforeUnmount(() => {
  cancelTimers()
  if (markTimer != null) window.clearTimeout(markTimer)
  offVisibility()
})

// ---------- 对局流程 ----------
function syncStaircase() {
  session.level.value = staircase.level
  failures.value = staircase.failures
}

function startGame() {
  round.value = 0
  void startRound()
}

async function startRound() {
  const token = runToken
  feedback.value = ''
  tapIndex.value = 0
  activeBlock.value = -1
  round.value += 1
  const rng = createRng(`${session.seed}#${round.value}`)
  sequence.value = generateSequence(rng, sequenceLength(staircase.level))

  session.setPhase('showing')
  await wait(400)
  for (let i = 0; i < sequence.value.length; i++) {
    if (token !== runToken) return
    activeBlock.value = sequence.value[i]
    await wait(LIGHT_MS)
    if (token !== runToken) return
    activeBlock.value = -1
    await wait(GAP_MS)
  }
  if (token !== runToken) return
  tapIndex.value = 0
  session.setPhase('recall')
}

function tapBlock(index: number) {
  if (phase.value !== 'recall' || feedback.value !== '') return
  const correct = checkTap(sequence.value, tapIndex.value, index)
  markTap(index, correct ? 'ok' : 'bad')
  if (correct) {
    tapIndex.value += 1
    if (tapIndex.value >= sequence.value.length) void onRoundSuccess()
  } else {
    void onRoundFailure()
  }
}

function markTap(index: number, kind: 'ok' | 'bad') {
  tapMark.value = { index, kind }
  if (markTimer != null) window.clearTimeout(markTimer)
  markTimer = window.setTimeout(() => {
    tapMark.value = null
    markTimer = null
  }, 200)
}

async function onRoundSuccess() {
  const token = runToken
  const gained = roundScore(staircase.level)
  session.addScore(gained)
  const span = sequenceLength(staircase.level)
  maxSpan.value = Math.max(maxSpan.value, span)
  maxPassedLevel.value = Math.max(maxPassedLevel.value, staircase.level)
  if (staircase.level >= MAX_LEVEL) topClears.value += 1
  staircase.onSuccess()
  syncStaircase()
  feedback.value = 'success'
  feedbackText.value = `顺序正确 +${gained} 分`
  play('levelup')
  await wait(900)
  if (token !== runToken) return
  if (topClears.value >= 2) await finishGame()
  else await startRound()
}

async function onRoundFailure() {
  const token = runToken
  session.addError()
  staircase.onFailure()
  syncStaircase()
  feedback.value = 'fail'
  feedbackText.value = staircase.shouldStop ? '点错了，本局结束' : '点错了，降一级再来'
  play('wrong')
  await wait(1000)
  if (token !== runToken) return
  if (staircase.shouldStop) await finishGame()
  else await startRound()
}

async function finishGame() {
  cancelTimers()
  activeBlock.value = -1
  play('finish')
  await session.finish(session.score.value, maxPassedLevel.value)
  // session.finish 不支持 detail，这里把全程最高通过长度补写进刚生成的纪录
  const latest = stats.getRecord('corsi').history[0]
  if (latest) latest.detail = { maxSpan: maxSpan.value }
}

function goBack() {
  cancelTimers()
  router.push('/')
}

const statusText = computed(() => {
  if (phase.value === 'ready') return '观察圆块点亮的顺序，全部熄灭后按相同顺序点回去'
  if (phase.value === 'showing') return `请记住点亮顺序 · 长度 ${sequence.value.length}`
  if (phase.value === 'recall') {
    if (feedback.value !== '') return feedbackText.value
    return `请按相同顺序点按 · 第 ${Math.min(tapIndex.value + 1, sequence.value.length)} / ${sequence.value.length} 个`
  }
  return '本局结束，正在跳转…'
})
</script>

<template>
  <PageContainer>
    <TopBar :title="meta.name" back @back="goBack">
      <template #right>
        <span v-if="isChallenge" class="challenge-tag">挑战</span>
      </template>
    </TopBar>

    <div class="hud">
      <div class="hud-item">
        <span class="hud-label">等级</span>
        <span class="hud-value">{{ level }}</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">得分</span>
        <span class="hud-value">{{ score }}</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">失误</span>
        <span class="hud-value lives">
          <i v-for="n in 2" :key="n" :class="{ lost: n <= failures }" />
        </span>
      </div>
    </div>

    <p class="status" :class="feedback">{{ statusText }}</p>

    <div class="board" :class="{ idle: phase !== 'recall' || feedback !== '' }">
      <button
        v-for="(pos, i) in blocks"
        :key="i"
        type="button"
        class="block"
        :class="{
          lit: activeBlock === i,
          ok: tapMark !== null && tapMark.index === i && tapMark.kind === 'ok',
          bad: tapMark !== null && tapMark.index === i && tapMark.kind === 'bad',
        }"
        :style="{ left: pos.x + '%', top: pos.y + '%' }"
        :aria-label="`圆块 ${i + 1}`"
        @click="tapBlock(i)"
      >
        <span class="glow" />
      </button>
    </div>

    <div v-if="phase === 'ready'" class="intro">
      <p class="tip">
        9 个圆块会依次点亮，请记住顺序并原样点回。连续对 2 轮升一级（序列更长），点错立即本轮失败，累计失误 2 次本局结束。
      </p>
      <AppButton block @click="startGame">开始</AppButton>
    </div>
  </PageContainer>
</template>

<style scoped>
.challenge-tag {
  padding: 2px 8px;
  border-radius: var(--radius-s);
  background: var(--color-card);
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  font-size: 12px;
}

.hud {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 8px 0;
}

.hud-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.hud-label {
  font-size: 13px;
  color: var(--color-text-dim);
}

.hud-value {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.lives {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}

.lives i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-danger);
  opacity: 1;
  transition: opacity 0.2s ease;
}

.lives i.lost {
  opacity: 0.2;
}

.status {
  min-height: 24px;
  margin: 12px 0 8px;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-dim);
}

.status.success {
  color: var(--color-success);
}

.status.fail {
  color: var(--color-danger);
}

.board {
  position: relative;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  aspect-ratio: 1;
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-l);
}

.block {
  position: absolute;
  width: 17%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  transition: transform 0.12s ease;
}

.board:not(.idle) .block:active {
  transform: translate(-50%, -50%) scale(0.92);
}

.glow {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 26px var(--color-glow);
  opacity: 0;
  transform: scale(0.9);
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
  pointer-events: none;
}

.block.lit .glow {
  opacity: 1;
  transform: scale(1.06);
}

.block.ok .glow {
  opacity: 1;
  transform: scale(1.06);
  background: var(--color-success);
  box-shadow: 0 0 22px var(--color-success);
}

.block.bad .glow {
  opacity: 1;
  background: var(--color-danger);
  box-shadow: 0 0 18px var(--color-danger);
}

.intro {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tip {
  font-size: 14px;
  color: var(--color-text-dim);
  text-align: center;
  line-height: 1.7;
}
</style>
