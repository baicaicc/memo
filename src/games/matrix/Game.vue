<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { createRng } from '@/core/rng'
import { createStaircase } from '@/core/staircase'
import { createTimer } from '@/core/timer'
import { useGameSession } from '@/core/session'
import { onVisibilityChange } from '@/wechat/compat'
import { getGame } from '@/games/registry'
import PageContainer from '@/components/PageContainer.vue'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import AppCard from '@/components/AppCard.vue'
import {
  MAX_LEVEL,
  MAX_MISTAKES_PER_ROUND,
  checkRecall,
  generatePuzzle,
  litCountForLevel,
  roundBonus,
  scorePerCell,
  showDurationMs,
} from './logic'

const meta = getGame('matrix')!

// 挑战模式：?seed=xxx&level=n 复现同一局题目
const route = useRoute()
const queryLevel = Number(route.query.level)
const session = useGameSession('matrix', {
  seed: route.query.seed ? String(route.query.seed) : undefined,
  initialLevel:
    route.query.level && Number.isFinite(queryLevel) ? queryLevel : undefined,
})
const { phase, level, score, errors } = session
const isChallenge = Boolean(route.query.seed)

// 整局共用一个 rng：种子相同则每一轮题目序列都相同
const rng = createRng(session.seed)
const staircase = createStaircase({
  initialLevel: level.value,
  minLevel: 1,
  maxLevel: MAX_LEVEL,
})
// session.level 可能被 challenge 参数传成超范围值，以 staircase 钳制后的为准
level.value = staircase.level

const COUNTDOWN_MS = 3000
const ROUND_RESULT_MS = 900

const gridSize = ref(3)
const targets = ref<number[]>([])
const picked = ref<number[]>([])
const mistakes = ref(0)
const failures = ref(0)
const counting = ref(false)
const countdown = ref(3)
const showLeft = ref(1)
const roundMessage = ref('')

// 倒计时/亮格计时随切后台暂停：core/timer + 轮询 remaining
const clock = createTimer()
const pageHidden = ref(false)
let ticker: number | undefined
let roundTimer: number | undefined

const targetSet = computed(() => new Set(targets.value))
const pickedSet = computed(() => new Set(picked.value))
const verdict = computed(() => checkRecall(targets.value, picked.value))
const leftCount = computed(() => targets.value.length - verdict.value.hits.length)
const gridCells = computed(() =>
  Array.from({ length: gridSize.value * gridSize.value }, (_, i) => i),
)

const offVisibility = onVisibilityChange(({ hidden }) => {
  pageHidden.value = hidden
  if (hidden) clock.pause()
  else clock.resume()
})

function ensureTicker() {
  if (ticker === undefined) ticker = window.setInterval(onTick, 50)
}

function stopTicker() {
  if (ticker !== undefined) {
    window.clearInterval(ticker)
    ticker = undefined
  }
}

function onTick() {
  if (counting.value) {
    const left = clock.remaining(COUNTDOWN_MS)
    countdown.value = Math.max(1, Math.ceil(left / 1000))
    if (left <= 0) {
      counting.value = false
      startRound()
    }
    return
  }
  if (phase.value === 'showing') {
    const total = showDurationMs(staircase.level)
    const left = clock.remaining(total)
    showLeft.value = total > 0 ? left / total : 0
    if (left <= 0) phase.value = 'recall'
  }
}

function start() {
  counting.value = true
  countdown.value = 3
  clock.start()
  if (pageHidden.value) clock.pause()
  ensureTicker()
}

function startRound() {
  const puzzle = generatePuzzle(rng, staircase.level)
  gridSize.value = puzzle.gridSize
  targets.value = puzzle.cells
  picked.value = []
  mistakes.value = 0
  roundMessage.value = ''
  showLeft.value = 1
  phase.value = 'showing'
  clock.start()
  if (pageHidden.value) clock.pause()
  ensureTicker()
}

function tapCell(i: number) {
  if (phase.value !== 'recall') return
  if (roundMessage.value) return
  if (pickedSet.value.has(i)) return
  picked.value = [...picked.value, i]
  if (targetSet.value.has(i)) {
    session.addScore(scorePerCell(staircase.level))
    if (verdict.value.completed) {
      session.addScore(roundBonus(staircase.level))
      staircase.onSuccess()
      roundMessage.value = '找齐了，干得漂亮！'
      settleRound()
    }
  } else {
    session.addError()
    mistakes.value += 1
    if (mistakes.value >= MAX_MISTAKES_PER_ROUND) {
      staircase.onFailure()
      failures.value = staircase.failures
      roundMessage.value = staircase.shouldStop
        ? '本局结束'
        : '点错太多，降一级再来'
      settleRound()
    }
  }
}

function settleRound() {
  stopTicker()
  level.value = staircase.level
  roundTimer = window.setTimeout(() => {
    if (staircase.shouldStop) void session.finish(score.value, staircase.level)
    else startRound()
  }, ROUND_RESULT_MS)
}

function cellState(i: number): 'lit' | 'hit' | 'miss' | '' {
  if (phase.value === 'showing') return targetSet.value.has(i) ? 'lit' : ''
  if (pickedSet.value.has(i)) return targetSet.value.has(i) ? 'hit' : 'miss'
  return ''
}

onBeforeUnmount(() => {
  stopTicker()
  if (roundTimer !== undefined) window.clearTimeout(roundTimer)
  offVisibility()
})
</script>

<template>
  <PageContainer>
    <TopBar :title="meta.name" back @back="$router.push('/')">
      <template #right>
        <span class="lv">Lv.{{ level }}</span>
      </template>
    </TopBar>

    <div class="hud">
      <span>得分 {{ score }}</span>
      <span>失误 {{ errors }}</span>
      <span>失败 {{ failures }}/2</span>
    </div>

    <div v-if="phase === 'ready' && !counting" class="intro">
      <AppCard>
        <h2 class="intro-title">玩法</h2>
        <p>记住亮起的格子，熄灭后把它们全部点回来。</p>
        <p>
          等级越高格子越多；一轮内点错 {{ MAX_MISTAKES_PER_ROUND }} 次本轮失败，
          累计失败 2 次本局结束。
        </p>
        <p v-if="isChallenge" class="challenge">
          挑战模式：固定题目，Lv.{{ level }} 起步
        </p>
      </AppCard>
      <AppButton block @click="start">开始</AppButton>
    </div>

    <div v-else-if="counting" class="countdown">{{ countdown }}</div>

    <template v-else>
      <p class="status">
        <template v-if="roundMessage">{{ roundMessage }}</template>
        <template v-else-if="phase === 'showing'">
          记住这 {{ litCountForLevel(level) }} 个格子
        </template>
        <template v-else>还差 {{ leftCount }} 个</template>
      </p>
      <div v-show="phase === 'showing'" class="progress">
        <div class="bar" :style="{ transform: `scaleX(${showLeft})` }" />
      </div>
      <div
        class="grid"
        :class="{ frozen: phase !== 'recall' || !!roundMessage }"
        :style="{ '--grid': gridSize }"
      >
        <button
          v-for="i in gridCells"
          :key="i"
          class="cell"
          :class="cellState(i)"
          :aria-label="`格子 ${i + 1}`"
          @click="tapCell(i)"
        />
      </div>
    </template>
  </PageContainer>
</template>

<style scoped>
.lv {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-accent);
}

.hud {
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
  font-size: 14px;
  color: var(--color-text-dim);
}

.intro {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.intro-title {
  margin-bottom: 8px;
  font-size: 18px;
}

.intro p {
  font-size: 14px;
  color: var(--color-text-dim);
}

.intro .challenge {
  margin-top: 8px;
  color: var(--color-accent);
}

.countdown {
  padding: 90px 0;
  font-size: 76px;
  font-weight: 700;
  text-align: center;
  animation: pop 0.9s ease infinite;
}

@keyframes pop {
  0% {
    transform: scale(0.6);
    opacity: 0;
  }
  25% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.status {
  min-height: 24px;
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.progress {
  height: 4px;
  margin-bottom: 14px;
  border-radius: 2px;
  background: var(--color-bg-soft);
  overflow: hidden;
}

.bar {
  height: 100%;
  background: var(--color-primary);
  transform-origin: left;
}

.grid {
  display: grid;
  grid-template-columns: repeat(var(--grid), 1fr);
  gap: 10px;
}

.grid.frozen .cell {
  pointer-events: none;
}

.cell {
  width: 100%;
  padding-top: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-s);
  background: var(--color-card);
  transition:
    transform 0.12s ease,
    opacity 0.2s ease,
    background-color 0.15s ease;
}

.cell:active {
  transform: scale(0.94);
}

.cell.lit {
  background: var(--color-primary);
  border-color: var(--color-primary);
  box-shadow: 0 0 18px var(--color-glow);
  animation: litpulse 0.6s ease infinite alternate;
}

@keyframes litpulse {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.06);
  }
}

.cell.hit {
  background: var(--color-success);
  border-color: var(--color-success);
}

.cell.miss {
  background: var(--color-danger);
  border-color: var(--color-danger);
  animation: shake 0.3s ease;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}
</style>
