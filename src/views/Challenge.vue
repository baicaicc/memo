<script lang="ts">
import { getGame, type GameId } from '@/games/registry'

export interface ChallengeQuery {
  game: GameId
  seed: string
  level: number
  score: number
}

/** 挑战者分数的临时传递键：Challenge 写入，Result 读取后清除 */
export const RIVAL_STORAGE_KEY = 'memo:challenge-rival'

export interface RivalPayload {
  gameId: GameId
  score: number
}

function firstString(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return null
}

/**
 * 解析 /challenge?game=&seed=&level=&score= 的 query。
 * 任一参数缺失、非法或游戏未注册时返回 null。
 */
export function parseChallengeQuery(
  q: Record<string, unknown>,
): ChallengeQuery | null {
  const game = firstString(q.game)
  const seed = firstString(q.seed)
  const levelStr = firstString(q.level)
  const scoreStr = firstString(q.score)
  if (!game || !seed || !levelStr || !scoreStr) return null

  const meta = getGame(game)
  if (!meta) return null

  const level = Number(levelStr)
  const score = Number(scoreStr)
  if (!Number.isInteger(level) || level < 1) return null
  if (!Number.isInteger(score) || score < 0) return null

  return { game: meta.id, seed, level, score }
}

export type ChallengeOutcome = 'win' | 'draw' | 'lose'

/** 胜负判定：我方得分 vs 对方得分 */
export function judgeOutcome(mine: number, rival: number): ChallengeOutcome {
  if (mine > rival) return 'win'
  if (mine < rival) return 'lose'
  return 'draw'
}

/** 从 sessionStorage 读出挑战者分数并立即清除；无效或不匹配时返回 null */
export function takeRivalPayload(gameId: string): RivalPayload | null {
  try {
    const raw = sessionStorage.getItem(RIVAL_STORAGE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(RIVAL_STORAGE_KEY)
    const data = JSON.parse(raw) as Partial<RivalPayload>
    if (
      data.gameId === gameId &&
      typeof data.score === 'number' &&
      Number.isInteger(data.score) &&
      data.score >= 0
    ) {
      return { gameId: data.gameId as GameId, score: data.score }
    }
    return null
  } catch {
    return null
  }
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageContainer from '@/components/PageContainer.vue'
import TopBar from '@/components/TopBar.vue'
import AppButton from '@/components/AppButton.vue'
import AppCard from '@/components/AppCard.vue'

const route = useRoute()
const router = useRouter()

const parsed = computed(() => parseChallengeQuery(route.query))
const meta = computed(() => (parsed.value ? getGame(parsed.value.game) : undefined))

function accept() {
  if (!parsed.value) return
  const { game, seed, level, score } = parsed.value
  const payload: RivalPayload = { gameId: game, score }
  try {
    sessionStorage.setItem(RIVAL_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // 私密模式等场景下存储不可用时静默降级，仅丢失结算页对比
  }
  router.push(
    `/play/${game}?seed=${encodeURIComponent(seed)}&level=${level}&rival=${score}`,
  )
}
</script>

<template>
  <PageContainer>
    <TopBar title="好友挑战" back @back="$router.push('/')" />

    <div v-if="parsed && meta" class="body">
      <AppCard class="challenge-card">
        <div class="label">好友挑战</div>
        <div class="game-name">《{{ meta.name }}》</div>
        <div class="rival-info">
          <span>对方得分 <b>{{ parsed.score }}</b></span>
          <span>对方等级 <b>Lv.{{ parsed.level }}</b></span>
        </div>
        <div class="taunt">
          TA 在《{{ meta.name }}》拿了 {{ parsed.score }} 分，你敢接吗？
        </div>
      </AppCard>

      <AppCard class="rule-card">
        <div class="rule-title">挑战规则</div>
        <p>· 你将从 Lv.{{ parsed.level }} 开始，题目与对方完全相同</p>
        <p>· 结算时分数高于对方即为胜出</p>
      </AppCard>

      <AppButton block @click="accept">接受挑战</AppButton>
    </div>

    <div v-else class="invalid">
      <p class="invalid-tip">挑战链接无效或已过期</p>
      <AppButton @click="$router.push('/')">回首页</AppButton>
    </div>
  </PageContainer>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.challenge-card {
  text-align: center;
  padding: 28px 16px;
}

.label {
  display: inline-block;
  padding: 2px 12px;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.game-name {
  margin-top: 10px;
  font-size: 22px;
  font-weight: 800;
}

.rival-info {
  margin-top: 12px;
  display: flex;
  justify-content: center;
  gap: 18px;
  color: var(--color-text-dim);
  font-size: 14px;
}

.rival-info b {
  color: var(--color-accent);
  font-size: 16px;
}

.taunt {
  margin-top: 14px;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.5;
}

.rule-card {
  font-size: 14px;
  color: var(--color-text-dim);
}

.rule-title {
  color: var(--color-text);
  font-weight: 600;
  margin-bottom: 6px;
}

.rule-card p {
  padding: 2px 0;
}

.invalid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 80px 0;
}

.invalid-tip {
  color: var(--color-text-dim);
}
</style>
