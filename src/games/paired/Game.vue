<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { createRng } from '@/core/rng'
import { createStaircase } from '@/core/staircase'
import { createTimer } from '@/core/timer'
import { useGameSession } from '@/core/session'
import { onVisibilityChange } from '@/wechat/compat'
import { play } from '@/audio/sfx'
import { getGame } from '@/games/registry'
import PageContainer from '@/components/PageContainer.vue'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import AppCard from '@/components/AppCard.vue'
import {
  MAX_LEVEL,
  SLOT_COUNT,
  checkPlacement,
  generateLayout,
  itemCountForLevel,
  roundBonus,
  scorePerItem,
  showDurationMs,
  type PairedItem,
  type PlacementVerdict,
} from './logic'

const meta = getGame('paired')!

// 挑战模式：?seed=xxx&level=n 复现同一局题目
const route = useRoute()
const queryLevel = Number(route.query.level)
const session = useGameSession('paired', {
  seed: route.query.seed ? String(route.query.seed) : undefined,
  initialLevel:
    route.query.level && Number.isFinite(queryLevel) ? queryLevel : undefined,
})
const { phase, level, score, errors } = session
const isChallenge = Boolean(route.query.seed)

// 整局共用一个 rng：种子相同则每一轮摆放序列都相同
const rng = createRng(session.seed)
const staircase = createStaircase({
  initialLevel: level.value,
  minLevel: 1,
  maxLevel: MAX_LEVEL,
})
// session.level 可能被 challenge 参数传成超范围值，以 staircase 钳制后的为准
level.value = staircase.level

const COUNTDOWN_MS = 3000
const ROUND_RESULT_MS = 1400

const items = ref<PairedItem[]>([])
const assignments = ref<number[]>([])
const tray = ref<number[]>([])
const placements = ref<number[]>(Array(SLOT_COUNT).fill(-1))
const selected = ref<number | null>(null)
const judged = ref<PlacementVerdict | null>(null)
const bestLevel = ref(staircase.level)
const failures = ref(0)
const roundsWon = ref(0)
const roundsLost = ref(0)
const counting = ref(false)
const countdown = ref(3)
const showLeft = ref(1)
const roundMessage = ref('')

// 倒计时/展示计时随切后台暂停：core/timer + 轮询 remaining
const clock = createTimer()
const pageHidden = ref(false)
let ticker: number | undefined
let roundTimer: number | undefined

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
  const layout = generateLayout(rng, staircase.level)
  items.value = layout.items
  assignments.value = layout.slotAssignments
  tray.value = layout.trayOrder.slice()
  placements.value = Array(SLOT_COUNT).fill(-1)
  selected.value = null
  judged.value = null
  roundMessage.value = ''
  showLeft.value = 1
  phase.value = 'showing'
  clock.start()
  if (pageHidden.value) clock.pause()
  ensureTicker()
}

function skipShow() {
  if (phase.value !== 'showing') return
  clock.stop()
  phase.value = 'recall'
}

function tapTrayItem(item: number) {
  if (phase.value !== 'recall' || judged.value) return
  selected.value = selected.value === item ? null : item
}

function tapSlot(slot: number) {
  if (phase.value !== 'recall' || judged.value) return
  const placed = placements.value[slot]
  if (placed >= 0) {
    // 点已放的格子：取回物品重来
    placements.value[slot] = -1
    tray.value = [...tray.value, placed]
    return
  }
  if (selected.value === null) return
  placements.value[slot] = selected.value
  tray.value = tray.value.filter((i) => i !== selected.value)
  selected.value = null
  if (tray.value.length === 0) judgeRound()
}

function judgeRound() {
  const roundLevel = staircase.level
  const verdict = checkPlacement(assignments.value, placements.value)
  judged.value = verdict
  for (let i = 0; i < verdict.wrongItems.length; i++) session.addError()
  if (verdict.correct > 0) session.addScore(scorePerItem(roundLevel) * verdict.correct)
  play(verdict.allCorrect ? 'levelup' : 'wrong')
  if (verdict.allCorrect) {
    session.addScore(roundBonus(roundLevel))
    bestLevel.value = Math.max(bestLevel.value, roundLevel)
    roundsWon.value += 1
    staircase.onSuccess()
    roundMessage.value = '全部归位，干得漂亮！'
  } else {
    staircase.onFailure()
    roundsLost.value += 1
    failures.value = staircase.failures
    roundMessage.value = staircase.shouldStop
      ? '本局结束'
      : `放错了 ${verdict.wrongItems.length} 件，降一级再来`
  }
  settleRound()
}

function settleRound() {
  stopTicker()
  level.value = staircase.level
  roundTimer = window.setTimeout(() => {
    if (staircase.shouldStop) {
      play('finish')
      void session.finish(score.value, bestLevel.value, {
        roundsWon: roundsWon.value,
        roundsLost: roundsLost.value,
      })
    } else startRound()
  }, ROUND_RESULT_MS)
}

/** 槽位当前应显示的物品 emoji（展示阶段看摆放，回忆阶段看已放的） */
function slotEmoji(slot: number): string {
  if (phase.value === 'showing') {
    const i = assignments.value.indexOf(slot)
    return i >= 0 ? items.value[i].emoji : ''
  }
  const it = placements.value[slot]
  return it >= 0 ? items.value[it].emoji : ''
}

function slotState(slot: number): 'correct' | 'wrong' | '' {
  if (!judged.value) return ''
  const it = placements.value[slot]
  if (it < 0) return ''
  return assignments.value[it] === slot ? 'correct' : 'wrong'
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
        <p>桌上摆着几件东西，记住它们各自的位置。</p>
        <p>
          东西收起后，先点下面的物品、再点上面的格子，把它们放回原位；
          点已放好的格子可以取回重来。
        </p>
        <p>等级越高东西越多；一轮内有放错则本轮失败，累计失败 2 次本局结束。</p>
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
          记住这 {{ itemCountForLevel(level) }} 件东西的位置
        </template>
        <template v-else>先点物品，再点格子放回去 · 还差 {{ tray.length }} 件</template>
      </p>
      <div v-show="phase === 'showing'" class="progress">
        <div class="bar" :style="{ transform: `scaleX(${showLeft})` }" />
      </div>

      <div class="shelf">
        <button
          v-for="slot in SLOT_COUNT"
          :key="slot"
          class="slot"
          :class="[
            slotState(slot - 1),
            {
              open:
                phase === 'recall' &&
                !judged &&
                selected !== null &&
                placements[slot - 1] < 0,
            },
          ]"
          :aria-label="`格子 ${slot}`"
          @click="tapSlot(slot - 1)"
        >
          <span v-if="slotEmoji(slot - 1)" class="emoji">{{ slotEmoji(slot - 1) }}</span>
        </button>
      </div>

      <AppButton
        v-if="phase === 'showing'"
        block
        variant="ghost"
        class="memorized"
        @click="skipShow"
      >
        我记住了
      </AppButton>

      <div v-if="phase === 'recall'" class="tray">
        <button
          v-for="item in tray"
          :key="item"
          class="tray-item"
          :class="{ selected: selected === item }"
          @click="tapTrayItem(item)"
        >
          <span class="emoji">{{ items[item].emoji }}</span>
          <span class="name">{{ items[item].name }}</span>
        </button>
        <p v-if="!tray.length && !judged" class="tray-done">都放好了</p>
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
  background: var(--color-accent);
  transform-origin: left;
}

.shelf {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-l);
  background: var(--color-bg-soft);
}

.slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding-top: 100%;
  position: relative;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-card);
  transition:
    transform 0.12s ease,
    opacity 0.2s ease,
    background-color 0.15s ease;
}

.slot .emoji {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
}

.slot:active {
  transform: scale(0.94);
}

.slot.open {
  border-color: var(--color-accent);
  box-shadow: 0 0 12px rgba(255, 209, 102, 0.25);
}

.slot.correct {
  border-style: solid;
  border-color: var(--color-success);
  background: rgba(74, 222, 128, 0.12);
}

.slot.wrong {
  border-style: solid;
  border-color: var(--color-danger);
  background: rgba(248, 113, 113, 0.12);
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

.memorized {
  margin-top: 14px;
}

.tray {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  min-height: 76px;
  margin-top: 14px;
  padding: 10px;
  border-radius: var(--radius-l);
  background: var(--color-bg-soft);
}

.tray-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 56px;
  padding: 8px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-card);
  transition:
    transform 0.12s ease,
    border-color 0.15s ease;
}

.tray-item .emoji {
  font-size: 28px;
}

.tray-item .name {
  font-size: 12px;
  color: var(--color-text-dim);
}

.tray-item:active {
  transform: scale(0.94);
}

.tray-item.selected {
  border-color: var(--color-accent);
  transform: translateY(-4px);
  box-shadow: 0 6px 14px rgba(255, 209, 102, 0.25);
}

.tray-done {
  align-self: center;
  font-size: 14px;
  color: var(--color-text-dim);
}
</style>
