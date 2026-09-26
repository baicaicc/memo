<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getGame } from '@/games/registry'
import { useGameSession } from '@/core/session'
import { createRng } from '@/core/rng'
import { createStaircase } from '@/core/staircase'
import { createTimer } from '@/core/timer'
import { onVisibilityChange } from '@/wechat/compat'
import { useStatsStore } from '@/stores/stats'
import { useResultStore } from '@/stores/result'
import PageContainer from '@/components/PageContainer.vue'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import AppCard from '@/components/AppCard.vue'
import {
  GAME_ID,
  MIN_LEVEL,
  MAX_LEVEL,
  DIGIT_SHOW_MS,
  DIGIT_GAP_MS,
  spanLength,
  roundScore,
  generateDigits,
  checkAnswer,
} from './logic'

const meta = getGame(GAME_ID)!
const route = useRoute()
const router = useRouter()

const isChallenge = route.query.seed != null
const session = useGameSession(
  GAME_ID,
  isChallenge
    ? {
        seed: String(route.query.seed),
        initialLevel: Number(route.query.level ?? 1) || 1,
      }
    : {},
)
const { phase, score, errors } = session

const stats = useStatsStore()
const resultStore = useResultStore()

const staircase = createStaircase({
  initialLevel: session.level.value,
  minLevel: MIN_LEVEL,
  maxLevel: MAX_LEVEL,
})
// 整局共用一条随机流：同种子 + 同答题路径复现同题
const rng = createRng(session.seed)
const timer = createTimer()

const currentLevel = ref(staircase.level)
const peakLevel = ref(staircase.level)
const maxSpan = ref(0)
const round = ref(0)
const digits = ref<number[]>([])
const input = ref<number[]>([])
const showIndex = ref(-1)
const shownCount = ref(0)
const feedback = ref<'' | 'ok' | 'bad'>('')
const lastGain = ref(0)

const length = computed(() => spanLength(currentLevel.value))
const canConfirm = computed(
  () =>
    phase.value === 'recall' &&
    !feedback.value &&
    input.value.length === digits.value.length,
)
const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9]

let rafId = 0
let feedbackTimer: ReturnType<typeof setTimeout> | undefined

function scheduleFrame() {
  rafId = requestAnimationFrame(tick)
}

function tick() {
  if (phase.value !== 'showing') return
  const perDigit = DIGIT_SHOW_MS + DIGIT_GAP_MS
  const total = digits.value.length * perDigit
  const t = timer.elapsed()
  if (t >= total) {
    enterRecall()
    return
  }
  const i = Math.floor(t / perDigit)
  showIndex.value = t - i * perDigit < DIGIT_SHOW_MS ? i : -1
  shownCount.value = Math.min(digits.value.length, i + 1)
  scheduleFrame()
}

function startRound() {
  round.value += 1
  input.value = []
  feedback.value = ''
  digits.value = generateDigits(rng, length.value)
  showIndex.value = -1
  shownCount.value = 0
  session.setPhase('showing')
  timer.start()
  scheduleFrame()
}

function enterRecall() {
  cancelAnimationFrame(rafId)
  timer.stop()
  showIndex.value = -1
  session.setPhase('recall')
}

function pressDigit(d: number) {
  if (phase.value !== 'recall' || feedback.value) return
  if (input.value.length >= digits.value.length) return
  input.value.push(d)
}

function pressDelete() {
  if (phase.value !== 'recall' || feedback.value) return
  input.value.pop()
}

function pressConfirm() {
  if (!canConfirm.value) return
  const len = digits.value.length
  if (checkAnswer(digits.value, input.value)) {
    lastGain.value = roundScore(len)
    session.addScore(lastGain.value)
    maxSpan.value = Math.max(maxSpan.value, len)
    staircase.onSuccess()
    feedback.value = 'ok'
  } else {
    session.addError()
    staircase.onFailure()
    feedback.value = 'bad'
  }
  currentLevel.value = staircase.level
  peakLevel.value = Math.max(peakLevel.value, staircase.level)
  feedbackTimer = setTimeout(
    () => {
      if (staircase.shouldStop) void endGame()
      else startRound()
    },
    feedback.value === 'ok' ? 700 : 1800,
  )
}

async function endGame() {
  cancelAnimationFrame(rafId)
  const done = session.finish(score.value, peakLevel.value)
  // session.finish 不透传 detail，这里把 maxSpan 补进刚写入的纪录与结算
  const rec = stats.getRecord(GAME_ID)
  if (rec.history[0])
    rec.history[0] = { ...rec.history[0], detail: { maxSpan: maxSpan.value } }
  if (resultStore.lastResult)
    resultStore.lastResult = {
      ...resultStore.lastResult,
      detail: { maxSpan: maxSpan.value },
    }
  await done
}

const offVisibility = onVisibilityChange(({ hidden }) => {
  if (phase.value !== 'showing') return
  if (hidden) {
    timer.pause()
    cancelAnimationFrame(rafId)
  } else {
    timer.resume()
    scheduleFrame()
  }
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  if (feedbackTimer !== undefined) clearTimeout(feedbackTimer)
  timer.stop()
  offVisibility()
})
</script>

<template>
  <PageContainer>
    <TopBar :title="meta.name" back @back="router.push('/')">
      <template #right><span class="score-chip">{{ score }} 分</span></template>
    </TopBar>

    <div v-if="phase === 'ready'" class="ready">
      <AppCard class="rule-card">
        <div class="rule-title">记住取件码</div>
        <p>· 取件码逐位闪现（每位 0.8 秒），请记住顺序</p>
        <p>· 闪完后用键盘按相同顺序输入</p>
        <p>· 连续答对 2 轮升级，取件码变长；答错降级</p>
        <p>· 累计答错 2 次，游戏结束</p>
        <p v-if="isChallenge" class="challenge-tip">
          挑战模式：从 Lv.{{ currentLevel }} 开始，题目与好友相同
        </p>
      </AppCard>
      <AppButton block @click="startRound">开始</AppButton>
    </div>

    <div v-else-if="phase === 'showing'" class="showing">
      <p class="round-info">
        第 {{ round }} 轮 · Lv.{{ currentLevel }} · {{ length }} 位取件码
      </p>
      <div class="stage">
        <transition name="pop">
          <span v-if="showIndex >= 0" :key="showIndex" class="digit">
            {{ digits[showIndex] }}
          </span>
        </transition>
      </div>
      <div class="progress-dots">
        <span
          v-for="i in digits.length"
          :key="i"
          class="dot"
          :class="{ filled: i <= shownCount }"
        />
      </div>
      <p class="hint">记住取件码…</p>
    </div>

    <div v-else-if="phase === 'recall'" class="recall">
      <p class="round-info">第 {{ round }} 轮 · 输入 {{ digits.length }} 位取件码</p>
      <div class="input-dots">
        <span
          v-for="i in digits.length"
          :key="i"
          class="dot big"
          :class="{ filled: i <= input.length, next: i === input.length + 1 }"
        />
      </div>
      <div class="feedback" :class="feedback">
        <template v-if="feedback === 'ok'">取件成功！+{{ lastGain }} 分</template>
        <template v-else-if="feedback === 'bad'">
          取件失败，正确取件码：{{ digits.join('') }}
        </template>
        <template v-else>已错 {{ errors }} 次 · 错满 2 次结束</template>
      </div>
      <div class="keypad" :class="{ locked: !!feedback }">
        <button v-for="k in keys" :key="k" class="key" @click="pressDigit(k)">
          {{ k }}
        </button>
        <button class="key ghost" @click="pressDelete">删除</button>
        <button class="key" @click="pressDigit(0)">0</button>
        <button
          class="key confirm"
          :disabled="!canConfirm"
          @click="pressConfirm"
        >
          确认
        </button>
      </div>
    </div>

    <div v-else class="finished"><p>正在结算…</p></div>
  </PageContainer>
</template>

<style scoped>
.score-chip {
  color: var(--color-accent);
  font-weight: 700;
  font-size: 14px;
  white-space: nowrap;
}

.ready {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rule-card {
  color: var(--color-text-dim);
  font-size: 14px;
}

.rule-title {
  color: var(--color-text);
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
}

.rule-card p {
  padding: 3px 0;
}

.challenge-tip {
  color: var(--color-accent);
}

.showing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.round-info {
  color: var(--color-text-dim);
  font-size: 14px;
  text-align: center;
}

.stage {
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.digit {
  font-size: 96px;
  font-weight: 800;
  color: var(--color-accent);
  text-shadow: 0 0 24px var(--color-glow);
}

.pop-enter-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.pop-leave-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease;
}

.pop-enter-from {
  opacity: 0;
  transform: scale(0.5);
}

.pop-leave-to {
  opacity: 0;
  transform: scale(1.15);
}

.progress-dots,
.input-dots {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  min-height: 18px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  transition: transform 0.1s ease;
}

.dot.filled {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.dot.big {
  width: 14px;
  height: 14px;
}

.dot.big.filled {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.dot.big.next {
  border-color: var(--color-accent);
  transform: scale(1.25);
}

.hint {
  color: var(--color-text-dim);
  font-size: 14px;
}

.recall {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feedback {
  min-height: 24px;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-dim);
}

.feedback.ok {
  color: var(--color-success);
}

.feedback.bad {
  color: var(--color-danger);
}

.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.keypad.locked {
  pointer-events: none;
}

.key {
  height: 56px;
  border-radius: var(--radius-m);
  background: var(--color-card);
  border: 1px solid var(--color-border);
  font-size: 22px;
  font-weight: 700;
  transition:
    transform 0.08s ease,
    background 0.15s ease;
}

.key:active {
  transform: scale(0.94);
  background: var(--color-card-hover);
}

.key.ghost {
  font-size: 16px;
  color: var(--color-text-dim);
}

.key.confirm {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
  font-size: 16px;
}

.key.confirm:active {
  background: var(--color-primary-press);
}

.key.confirm:disabled {
  opacity: 0.45;
}

.finished {
  padding: 80px 0;
  text-align: center;
  color: var(--color-text-dim);
}
</style>
