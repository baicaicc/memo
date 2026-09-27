<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getGame } from '@/games/registry'
import { useResultStore } from '@/stores/result'
import { useStatsStore } from '@/stores/stats'
import { judgeOutcome, takeRivalPayload, type ChallengeOutcome } from './Challenge.vue'
import PageContainer from '@/components/PageContainer.vue'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import AppCard from '@/components/AppCard.vue'

const route = useRoute()
const router = useRouter()
const resultStore = useResultStore()
const stats = useStatsStore()

const result = computed(() => resultStore.lastResult)
const meta = computed(() => (result.value ? getGame(result.value.gameId) : undefined))
const record = computed(() =>
  result.value ? stats.getRecord(result.value.gameId) : null,
)

// 挑战模式：优先取路由 query 里的 rival，否则从 sessionStorage 临时键读取（读后即焚）
function resolveRivalScore(): number | null {
  const fromQuery = Number(route.query.rival)
  if (Number.isInteger(fromQuery) && fromQuery >= 0) return fromQuery
  if (!result.value) return null
  return takeRivalPayload(result.value.gameId)?.score ?? null
}
const rivalScore = ref<number | null>(resolveRivalScore())
const outcome = computed<ChallengeOutcome | null>(() =>
  result.value && rivalScore.value !== null
    ? judgeOutcome(result.value.score, rivalScore.value)
    : null,
)
const outcomeText = computed(() => {
  switch (outcome.value) {
    case 'win':
      return '你赢了！'
    case 'draw':
      return '打平！'
    case 'lose':
      return '惜败，再来一局复仇'
    default:
      return ''
  }
})

const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(msg: string) {
  toast.value = msg
  if (toastTimer !== undefined) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 1800)
}

async function copyChallenge() {
  if (!result.value) return
  const url = `${location.origin}/challenge?game=${result.value.gameId}&seed=${encodeURIComponent(result.value.seed)}&level=${result.value.level}&score=${result.value.score}`
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = url
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  showToast('已复制')
}

function replay() {
  if (result.value) router.push(`/play/${result.value.gameId}`)
}
</script>

<template>
  <PageContainer>
    <TopBar title="本局结算" />
    <div v-if="result && meta" class="body">
      <AppCard v-if="outcome && rivalScore !== null" class="vs-card anim-rise" :class="outcome">
        <div class="vs-scores">
          <span>你 {{ result.score }} 分</span>
          <span class="vs-divider">vs</span>
          <span>对方 {{ rivalScore }} 分</span>
        </div>
        <div class="vs-verdict">{{ outcomeText }}</div>
      </AppCard>

      <AppCard class="score-card">
        <div class="game-name">{{ meta.name }}</div>
        <div class="score">{{ result.score }}</div>
        <div class="level">达到等级 Lv.{{ result.level }}</div>
        <div v-if="result.isBestScore || result.isBestLevel" class="new-record">
          🎉 新纪录！
        </div>
      </AppCard>

      <AppCard class="best-card">
        <div class="best-row">
          <span>历史最高分</span><b>{{ record?.bestScore ?? 0 }}</b>
        </div>
        <div class="best-row">
          <span>历史最高等级</span><b>Lv.{{ record?.bestLevel ?? 0 }}</b>
        </div>
      </AppCard>

      <div class="actions">
        <AppButton block @click="replay">再来一局</AppButton>
        <AppButton block variant="ghost" @click="copyChallenge">复制挑战链接</AppButton>
        <AppButton block variant="ghost" @click="router.push('/')">回首页</AppButton>
      </div>
    </div>

    <div v-else class="empty">
      <p>还没有本局成绩</p>
      <AppButton @click="router.push('/')">回首页</AppButton>
    </div>

    <transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </PageContainer>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.vs-card {
  text-align: center;
  padding: 18px 16px;
}

.vs-scores {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 12px;
  font-size: 16px;
  font-weight: 600;
}

.vs-divider {
  color: var(--color-text-dim);
  font-size: 13px;
}

.vs-verdict {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 800;
}

.vs-card.win .vs-verdict {
  color: var(--color-success);
}

.vs-card.draw .vs-verdict {
  color: var(--color-accent);
}

.vs-card.lose .vs-verdict {
  color: var(--color-danger);
}

.score-card {
  text-align: center;
  padding: 28px 16px;
}

.game-name {
  color: var(--color-text-dim);
  font-size: 14px;
}

.score {
  font-size: 52px;
  font-weight: 800;
  color: var(--color-accent);
  line-height: 1.2;
}

.level {
  color: var(--color-text-dim);
}

.new-record {
  margin-top: 10px;
  color: var(--color-success);
  font-weight: 600;
  animation: record-pop 0.4s var(--ease-out);
}

@keyframes record-pop {
  0% {
    opacity: 0;
    transform: scale(0.7);
  }
  55% {
    transform: scale(1.12);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.best-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  color: var(--color-text-dim);
}

.best-row b {
  color: var(--color-text);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 80px 0;
  color: var(--color-text-dim);
}

.toast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--safe-bottom) + 80px);
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  padding: 10px 22px;
  border-radius: 999px;
  font-size: 14px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
