<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createRng } from '@/core/rng'
import { useGameSession } from '@/core/session'
import { getGame } from '@/games/registry'
import { onVisibilityChange } from '@/wechat/compat'
import { play } from '@/audio/sfx'
import PageContainer from '@/components/PageContainer.vue'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import {
  GRID_COUNT,
  JUDGED_TRIALS,
  LIGHT_MS,
  MAX_DEMOTES,
  MAX_N,
  MAX_ROUNDS,
  MIN_N,
  PENALTY_PER_MISTAKE,
  TICK_MS,
  generateStimuli,
  judgeRound,
  judgeTrial,
  nextN,
  roundOutcome,
  type Stimulus,
} from './logic'

const meta = getGame('nback')!
const route = useRoute()
const router = useRouter()

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
  return Math.min(Math.max(n, MIN_N), MAX_N)
})()

// 挑战模式：同种子（且同起始 N）可复现同一套题
const session = useGameSession('nback', {
  seed: querySeed,
  initialLevel: queryLevel,
})
const isChallenge = querySeed !== undefined

const phase = computed(() => session.phase.value)
const score = computed(() => session.score.value)

/** 当前 N（= 当前等级） */
const currentN = ref(session.level.value)
const roundNum = ref(0)
const demotions = ref(0)
const maxN = ref(session.level.value)
const stimuli = ref<Stimulus[]>([])
const pressed = ref<boolean[]>([])
/** 当前播放到的拍索引，-1 表示未在播放 */
const currentIndex = ref(-1)
/** 当前亮起的格子位置，-1 表示无 */
const activeCell = ref(-1)
const feedback = ref<'' | 'success' | 'fail'>('')
const feedbackText = ref('')
/** 「相同」按钮的瞬时对错脉冲 */
const buttonFlash = ref<'' | 'ok' | 'bad'>('')
/** 局间结算文案，非空时优先显示 */
const summaryText = ref('')

// ---------- 可暂停的单发计时器（播放节奏，切后台时冻结剩余时间） ----------
let runToken = 0
let timeoutId: number | null = null
let endAt = 0
let remainMs = 0
let wake: (() => void) | null = null
let suspended = false
let flashTimer: number | null = null

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
  if (flashTimer != null) window.clearTimeout(flashTimer)
  offVisibility()
})

// ---------- 规则页动态示意（1-back 迷你演示，仅 ready 阶段运行） ----------
const DEMO_POSITIONS = [4, 6, 6, 2, 0, 0, 8, 4]
const demoIndex = ref(0)
const demoCell = computed(() => DEMO_POSITIONS[demoIndex.value])
const demoPrevCell = computed(() =>
  demoIndex.value > 0 ? DEMO_POSITIONS[demoIndex.value - 1] : -1,
)
const demoIsMatch = computed(() => demoIndex.value > 0 && demoCell.value === demoPrevCell.value)
const demoLabel = computed(() => {
  if (demoIndex.value === 0) return '第 1 拍：记住它亮的位置'
  return demoIsMatch.value
    ? '这一拍和 1 步前相同 → 点「相同」！'
    : '这一拍和 1 步前不同 → 不用操作'
})

async function demoLoop() {
  const token = runToken
  while (phase.value === 'ready') {
    if (token !== runToken) return
    demoIndex.value = (demoIndex.value + 1) % DEMO_POSITIONS.length
    await wait(1100)
  }
}

onMounted(() => {
  void demoLoop()
})

// ---------- 对局流程 ----------
function startGame() {
  cancelTimers()
  roundNum.value = 0
  demotions.value = 0
  maxN.value = currentN.value
  void startRound()
}

async function startRound() {
  const token = runToken
  roundNum.value += 1
  stimuli.value = generateStimuli(createRng(`${session.seed}#${roundNum.value}`), currentN.value)
  pressed.value = new Array(stimuli.value.length).fill(false)
  currentIndex.value = -1
  activeCell.value = -1
  feedback.value = ''
  summaryText.value = ''
  session.setPhase('showing')
  await wait(600)
  for (let i = 0; i < stimuli.value.length; i++) {
    if (token !== runToken) return
    currentIndex.value = i
    activeCell.value = stimuli.value[i].position
    await wait(LIGHT_MS)
    if (token !== runToken) return
    activeCell.value = -1
    await wait(TICK_MS - LIGHT_MS)
    if (token !== runToken) return
    settleTrial(i)
  }
  if (token !== runToken) return
  currentIndex.value = -1
  await endRound(token)
}

/** 一拍窗口结束时结算「未按」的可判定拍：漏报扣分，正确放过静默加分 */
function settleTrial(i: number) {
  const n = currentN.value
  if (i < n || pressed.value[i]) return
  const j = judgeTrial(stimuli.value[i].isMatch, false, n)
  session.addScore(j.delta)
  if (!j.correct) {
    session.addError()
    flash('fail', `漏报了 · 这拍其实和 ${n} 步前相同（-${PENALTY_PER_MISTAKE}）`)
  }
}

function tapSame() {
  if (phase.value !== 'showing') return
  const i = currentIndex.value
  if (i < 0 || pressed.value[i]) return
  pressed.value[i] = true
  const n = currentN.value
  if (i < n) {
    flash('fail', `前 ${n} 拍只需观察记住，不用点`)
    pulseButton('bad')
    return
  }
  const j = judgeTrial(stimuli.value[i].isMatch, true, n)
  session.addScore(j.delta)
  if (j.correct) {
    flash('success', `判断正确 +${j.delta}`)
    pulseButton('ok')
    play('tap')
  } else {
    session.addError()
    flash('fail', `错点了 · 这拍和 ${n} 步前不同（-${PENALTY_PER_MISTAKE}）`)
    pulseButton('bad')
    play('wrong')
  }
}

function flash(kind: 'success' | 'fail', text: string) {
  feedback.value = kind
  feedbackText.value = text
}

function pulseButton(kind: 'ok' | 'bad') {
  buttonFlash.value = kind
  if (flashTimer != null) window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => {
    buttonFlash.value = ''
    flashTimer = null
  }, 260)
}

async function endRound(token: number) {
  const n = currentN.value
  const j = judgeRound(stimuli.value, pressed.value, n)
  maxN.value = Math.max(maxN.value, n)
  const outcome = roundOutcome(j.correctRate)
  if (outcome === 'down') demotions.value += 1
  const next = nextN(j.correctRate, n)
  currentN.value = next
  session.level.value = next
  const pct = Math.round(j.correctRate * 100)
  const action =
    outcome === 'up' ? `下一局升级 → ${next}-back` : outcome === 'down' ? `降级 → ${next}-back` : '保持当前难度'
  const done = roundNum.value >= MAX_ROUNDS || demotions.value >= MAX_DEMOTES
  summaryText.value = `第 ${roundNum.value} 局正确率 ${pct}% · ${done ? '本盘结束' : action}`
  feedback.value = outcome === 'down' ? 'fail' : 'success'
  play(outcome === 'up' ? 'levelup' : outcome === 'down' ? 'degrade' : 'tap')
  await wait(1700)
  if (token !== runToken) return
  if (done) await finishGame()
  else await startRound()
}

async function finishGame() {
  cancelTimers()
  activeCell.value = -1
  play('finish')
  await session.finish(session.score.value, maxN.value)
}

function goBack() {
  cancelTimers()
  router.push('/')
}

const totalTrials = computed(() => stimuli.value.length)

const statusText = computed(() => {
  if (phase.value === 'ready') return ''
  if (phase.value === 'finished') return '本局结束，正在跳转…'
  if (summaryText.value) return summaryText.value
  if (feedback.value) return feedbackText.value
  const i = currentIndex.value
  if (i < 0) return `第 ${roundNum.value} 局 · 准备`
  const n = currentN.value
  if (i < n) return `第 ${i + 1} / ${totalTrials.value} 拍 · 先记住，前 ${n} 拍不用判断`
  return `第 ${i + 1} / ${totalTrials.value} 拍 · 和 ${n} 步前相同吗？`
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
        <span class="hud-label">N 值</span>
        <span class="hud-value">{{ currentN }}</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">局数</span>
        <span class="hud-value">{{ Math.min(roundNum + (phase === 'ready' ? 1 : 0), MAX_ROUNDS) }}/{{ MAX_ROUNDS }}</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">得分</span>
        <span class="hud-value">{{ score }}</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">降级</span>
        <span class="hud-value lives">
          <i v-for="k in MAX_DEMOTES" :key="k" :class="{ lost: k <= demotions }" />
        </span>
      </div>
    </div>

    <p class="status" :class="feedback">{{ statusText }}</p>

    <template v-if="phase !== 'ready'">
      <div class="grid">
        <div
          v-for="i in GRID_COUNT"
          :key="i"
          class="cell"
          :class="{ lit: activeCell === i - 1 }"
        >
          <span class="glow" />
        </div>
      </div>

      <AppButton
        block
        class="same-btn"
        :class="buttonFlash"
        :disabled="phase !== 'showing' || summaryText !== ''"
        @click="tapSame"
      >
        相同
      </AppButton>
    </template>

    <div v-else class="intro">
      <div class="demo">
        <div class="demo-grid">
          <div
            v-for="i in GRID_COUNT"
            :key="i"
            class="demo-cell"
            :class="{ lit: demoCell === i - 1, prev: !demoIsMatch && demoPrevCell === i - 1 }"
          />
        </div>
        <p class="demo-label" :class="{ match: demoIsMatch }">{{ demoLabel }}</p>
      </div>
      <p class="tip">
        九宫格每 2.2 秒亮起一格。你要判断：当前亮起的位置，和 <b>{{ currentN }} 步前</b> 是不是同一格。
        相同就点下方「相同」按钮，不同就不用操作。判断对一次 +{{ 10 * currentN }} 分（含正确放过），错点或漏报 -{{ PENALTY_PER_MISTAKE }} 分。
      </p>
      <p class="tip">
        一局 {{ JUDGED_TRIALS }}+N 拍；正确率 ≥80% 下一局 N+1，低于 50% 降一级。累计降级 {{ MAX_DEMOTES }} 次或打完 {{ MAX_ROUNDS }} 局结束。
      </p>
      <AppButton block @click="startGame">开始（{{ currentN }}-back）</AppButton>
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
  opacity: 0.2;
  transition: opacity 0.2s ease;
}

.lives i.lost {
  opacity: 1;
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

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  aspect-ratio: 1;
}

.cell {
  position: relative;
  border-radius: var(--radius-m);
  background: var(--color-card);
  border: 1px solid var(--color-border);
}

.glow {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-m);
  background: var(--color-primary);
  box-shadow: 0 0 26px var(--color-glow);
  opacity: 0;
  transform: scale(0.94);
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
  pointer-events: none;
}

.cell.lit .glow {
  opacity: 1;
  transform: scale(1);
}

.same-btn {
  margin-top: 18px;
  min-height: 64px;
  font-size: 20px;
}

.same-btn.ok {
  background: var(--color-success);
}

.same-btn.bad {
  background: var(--color-danger);
}

.intro {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.demo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-l);
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  width: 132px;
  aspect-ratio: 1;
}

.demo-cell {
  border-radius: var(--radius-s);
  background: var(--color-card);
  border: 1px solid var(--color-border);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    background 0.15s ease;
}

.demo-cell.lit {
  background: var(--color-primary);
  box-shadow: 0 0 14px var(--color-glow);
  transform: scale(1.04);
}

.demo-cell.prev {
  border-color: var(--color-accent);
}

.demo-label {
  min-height: 20px;
  font-size: 13px;
  color: var(--color-text-dim);
  text-align: center;
}

.demo-label.match {
  color: var(--color-success);
  font-weight: 600;
}

.tip {
  font-size: 14px;
  color: var(--color-text-dim);
  text-align: center;
  line-height: 1.7;
}
</style>
