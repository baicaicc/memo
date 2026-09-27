<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getGame } from '@/games/registry'
import { useGameSession } from '@/core/session'
import { createRng } from '@/core/rng'
import { createTimer } from '@/core/timer'
import { onVisibilityChange } from '@/wechat/compat'
import { play } from '@/audio/sfx'
import PageContainer from '@/components/PageContainer.vue'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import AppCard from '@/components/AppCard.vue'
import {
  GAME_ID,
  SCORE_CORRECT,
  SCORE_WRONG,
  colorById,
  colorsForLevel,
  generateTrial,
  scoreAnswer,
  type Trial,
} from './logic'

const TOTAL_MS = 30_000
const FEEDBACK_MS = 280

const meta = getGame(GAME_ID)!
const route = useRoute()

// 挑战模式：路由带 seed/level 时注入 session，保证同种子同题
const querySeed = route.query.seed
const queryLevel = Number(route.query.level)
const session = useGameSession(GAME_ID, {
  seed: querySeed ? String(querySeed) : undefined,
  initialLevel:
    Number.isInteger(queryLevel) && queryLevel >= 1 ? queryLevel : undefined,
})
const { phase, level, score, errors } = session

// 本局等级固定（不用 staircase），出题随机全部来自种子序列
const rng = createRng(session.seed)
const timer = createTimer()

const trial = ref<Trial | null>(null)
const trialSeq = ref(0)
const pickedId = ref<string | null>(null)
const feedback = ref<'right' | 'wrong' | null>(null)
const locked = ref(false)
const remainingMs = ref(TOTAL_MS)

const levelColors = computed(() => colorsForLevel(level.value))
const inkHex = computed(() =>
  trial.value ? (colorById(trial.value.inkColor)?.hex ?? 'inherit') : 'inherit',
)
const remainText = computed(() => (remainingMs.value / 1000).toFixed(1))
const judgeText = computed(() => {
  if (!feedback.value || !trial.value) return ''
  if (feedback.value === 'right') return `+${SCORE_CORRECT}`
  return `${SCORE_WRONG} · 墨水是「${colorById(trial.value.inkColor)?.word ?? ''}」色`
})

let rafId: number | undefined
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
let offVisibility: (() => void) | undefined

function tick() {
  remainingMs.value = timer.remaining(TOTAL_MS)
  if (remainingMs.value <= 0) {
    void endGame()
    return
  }
  rafId = requestAnimationFrame(tick)
}

function nextTrial() {
  trial.value = generateTrial(rng, level.value)
  trialSeq.value += 1
  pickedId.value = null
  feedback.value = null
  locked.value = false
}

function startGame() {
  session.setPhase('recall')
  timer.start()
  remainingMs.value = TOTAL_MS
  nextTrial()
  rafId = requestAnimationFrame(tick)
}

function answer(id: string) {
  if (locked.value || phase.value !== 'recall' || !trial.value) return
  locked.value = true
  pickedId.value = id
  const result = scoreAnswer(trial.value.inkColor, id)
  session.addScore(result.delta)
  if (!result.isRight) session.addError()
  feedback.value = result.isRight ? 'right' : 'wrong'
  play(result.isRight ? 'tap' : 'wrong')
  feedbackTimer = setTimeout(nextTrial, FEEDBACK_MS)
}

async function endGame() {
  if (rafId !== undefined) cancelAnimationFrame(rafId)
  if (feedbackTimer !== undefined) clearTimeout(feedbackTimer)
  timer.stop()
  play('finish')
  await session.finish()
}

onMounted(() => {
  // 微信/移动浏览器切后台后 JS 计时不可靠：隐藏时暂停，回前台继续
  offVisibility = onVisibilityChange(({ hidden }) => {
    if (phase.value !== 'recall') return
    if (hidden) timer.pause()
    else timer.resume()
  })
})

onBeforeUnmount(() => {
  offVisibility?.()
  if (rafId !== undefined) cancelAnimationFrame(rafId)
  if (feedbackTimer !== undefined) clearTimeout(feedbackTimer)
  timer.stop()
})
</script>

<template>
  <PageContainer>
    <TopBar :title="meta.name" back @back="$router.push('/')" />

    <div v-if="phase === 'ready'" class="ready">
      <AppCard class="intro">
        <p class="rule">屏幕中央会出现一个<b>颜色字</b></p>
        <p class="rule">别管字义，点选它<b>墨水的颜色</b>！</p>
        <p class="rule dim">
          30 秒抢答 · 答对 +{{ SCORE_CORRECT }} · 答错 {{ SCORE_WRONG }}
        </p>
        <p class="rule dim">难度 Lv.{{ level }} · 共 {{ levelColors.length }} 种颜色</p>
      </AppCard>
      <div class="legend">
        <span v-for="c in levelColors" :key="c.id" class="legend-item">
          <i class="chip" :style="{ background: c.hex }">{{ c.symbol }}</i>
          {{ c.word }}
        </span>
      </div>
      <AppButton block @click="startGame">开始挑战</AppButton>
    </div>

    <div v-else class="play">
      <div class="hud">
        <span class="hud-item">得分 <b>{{ score }}</b></span>
        <span class="time" :class="{ urgent: remainingMs <= 5000 }">
          {{ remainText }}s
        </span>
        <span class="hud-item">错误 <b>{{ errors }}</b></span>
      </div>

      <div class="stage">
        <span
          v-if="trial"
          :key="trialSeq"
          class="word"
          :style="{ color: inkHex }"
          >{{ trial.word }}</span
        >
      </div>

      <div class="judge" :class="feedback ?? ''">
        <span v-if="feedback" :key="trialSeq">{{ judgeText }}</span>
      </div>

      <div class="options" :class="{ six: levelColors.length > 4 }">
        <button
          v-for="id in trial?.options ?? []"
          :key="id"
          class="option"
          :class="{
            hit: locked && id === pickedId && feedback === 'right',
            miss: locked && id === pickedId && feedback === 'wrong',
            reveal: locked && feedback === 'wrong' && id === trial?.inkColor,
          }"
          :style="{ background: colorById(id)?.hex }"
          :disabled="locked"
          @click="answer(id)"
        >
          <span class="symbol">{{ colorById(id)?.symbol }}</span>
        </button>
      </div>
    </div>
  </PageContainer>
</template>

<style scoped>
.ready {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-top: 24px;
}

.rule {
  text-align: center;
  padding: 4px 0;
}

.rule b {
  color: var(--color-accent);
}

.rule.dim {
  color: var(--color-text-dim);
  font-size: 14px;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-dim);
  font-size: 14px;
}

.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-s);
  font-style: normal;
  font-size: 13px;
  color: rgba(16, 19, 26, 0.7);
}

.play {
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - var(--safe-top) - var(--safe-bottom) - 88px);
}

.hud {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 2px;
  color: var(--color-text-dim);
  font-size: 14px;
}

.hud-item b {
  color: var(--color-text);
  font-size: 18px;
}

.time {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
}

.time.urgent {
  color: var(--color-danger);
}

.stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.word {
  font-size: 84px;
  font-weight: 800;
  line-height: 1;
  animation: word-in 0.16s ease;
}

.judge {
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
}

.judge.right {
  color: var(--color-success);
}

.judge.wrong {
  color: var(--color-danger);
}

.judge span {
  animation: judge-in 0.28s ease;
}

.options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 12px;
  padding-bottom: 8px;
}

.options.six {
  grid-template-columns: repeat(3, 1fr);
}

.option {
  height: 64px;
  border-radius: var(--radius-m);
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 0.12s ease,
    opacity 0.12s ease;
}

.option:active {
  transform: scale(0.94);
}

.option.hit {
  transform: scale(1.06);
}

.option.miss {
  opacity: 0.45;
}

.option.reveal {
  box-shadow: inset 0 0 0 3px var(--color-text);
}

.symbol {
  font-size: 24px;
  color: rgba(16, 19, 26, 0.65);
}

@keyframes word-in {
  from {
    opacity: 0;
    transform: scale(0.55);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes judge-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
