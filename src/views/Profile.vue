<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { DIMENSION_LABELS, games } from '@/games/registry'
import { dailyBestLevels, gameProgress } from '@/core/progress'
import { useDailyStore } from '@/stores/daily'
import { useStatsStore } from '@/stores/stats'
import AppButton from '@/components/AppButton.vue'
import AppCard from '@/components/AppCard.vue'
import PageContainer from '@/components/PageContainer.vue'
import RadarChart from '@/components/RadarChart.vue'
import CloudCard from '@/components/CloudCard.vue'
import LevelTrend from '@/components/LevelTrend.vue'
import WeeklyCard from '@/components/WeeklyCard.vue'
import TopBar from '@/components/TopBar.vue'

const router = useRouter()
const stats = useStatsStore()
const daily = useDailyStore()

const hasData = computed(() =>
  games.some((g) => stats.getRecord(g.id).history.length > 0),
)

// 看等级不看得分：得分受难度影响，等级越高单局分数反而可能更低
const cards = computed(() => {
  const now = new Date()
  return games.map((meta) => {
    const rec = stats.getRecord(meta.id)
    const points = dailyBestLevels(rec.history, now)
    const played = points.some((p) => p.level !== null)
    return { meta, rec, points, played, delta: gameProgress(rec.history, now).delta }
  })
})

function deltaText(delta: number | null): string {
  if (delta === null) return ''
  if (delta > 0) return `近 7 天 ↑${delta} 级`
  if (delta < 0) return `近 7 天 ↓${-delta} 级`
  return '近 7 天 持平'
}
</script>

<template>
  <PageContainer>
    <TopBar title="脑力档案" back @back="router.push('/')" />

    <div v-if="!hasData" class="empty">
      <p>还没有记录，去玩一局吧</p>
      <AppButton @click="router.push('/')">去首页</AppButton>
      <CloudCard class="empty-cloud" />
    </div>

    <div v-else class="body">
      <AppCard class="hero">
        <div class="hero-label">脑力指数</div>
        <div class="hero-value">{{ stats.brainIndex }}</div>
        <div class="hero-sub">各项能力综合评估</div>
      </AppCard>

      <WeeklyCard />

      <AppCard class="radar-card">
        <RadarChart :values="stats.radar" />
      </AppCard>

      <CloudCard />

      <AppCard v-for="c in cards" :key="c.meta.id" class="game-card">
        <div class="game-head">
          <div>
            <div class="game-name">{{ c.meta.name }}</div>
            <div class="game-dim">{{ DIMENSION_LABELS[c.meta.dimension] }}</div>
          </div>
          <div class="bests">
            <div>最高等级 <b>Lv.{{ c.rec.bestLevel }}</b></div>
            <div>最高分 <b>{{ c.rec.bestScore }}</b></div>
            <div v-if="c.delta !== null" class="delta" :class="{ up: c.delta > 0 }">{{ deltaText(c.delta) }}</div>
          </div>
        </div>
        <LevelTrend v-if="c.played" :points="c.points" />
        <div v-else class="trend-empty">{{ c.rec.history.length ? '近 14 天没练过' : '暂无成绩' }}</div>
      </AppCard>

      <div class="streak">🔥 已连续训练 {{ daily.streak }} 天</div>
    </div>
  </PageContainer>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hero,
.radar-card,
.game-card {
  animation: rise-in 0.22s var(--ease-out) both;
}

.game-card:nth-of-type(2) {
  animation-delay: 0.04s;
}

.game-card:nth-of-type(3) {
  animation-delay: 0.08s;
}

.game-card:nth-of-type(4) {
  animation-delay: 0.12s;
}

.game-card:nth-of-type(5) {
  animation-delay: 0.16s;
}

.hero {
  text-align: center;
  padding: 24px 16px;
}

.hero-label {
  font-size: 14px;
  color: var(--color-text-dim);
}

.hero-value {
  font-size: 56px;
  font-weight: 800;
  color: var(--color-accent);
  line-height: 1.2;
}

.hero-sub {
  font-size: 12px;
  color: var(--color-text-dim);
}

.game-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.game-name {
  font-size: 16px;
  font-weight: 700;
}

.game-dim {
  margin-top: 2px;
  font-size: 12px;
  color: var(--color-primary);
}

.bests {
  text-align: right;
  font-size: 13px;
  color: var(--color-text-dim);
}

.bests b {
  color: var(--color-text);
}

.delta {
  margin-top: 2px;
  font-size: 12px;
}

.delta.up {
  color: var(--color-success);
}





.trend-empty {
  margin-top: 14px;
  padding: 12px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-dim);
}

.streak {
  margin-top: 8px;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-dim);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 80px 0;
  color: var(--color-text-dim);
}
.empty-cloud {
  width: 100%;
  margin-top: 24px;
  color: var(--color-text);
}
</style>
