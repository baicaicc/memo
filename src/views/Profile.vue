<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { DIMENSION_LABELS, games } from '@/games/registry'
import { useDailyStore } from '@/stores/daily'
import { useStatsStore } from '@/stores/stats'
import AppButton from '@/components/AppButton.vue'
import AppCard from '@/components/AppCard.vue'
import PageContainer from '@/components/PageContainer.vue'
import RadarChart from '@/components/RadarChart.vue'
import TopBar from '@/components/TopBar.vue'

const router = useRouter()
const stats = useStatsStore()
const daily = useDailyStore()

const hasData = computed(() =>
  games.some((g) => stats.getRecord(g.id).history.length > 0),
)

const cards = computed(() =>
  games.map((meta) => {
    const rec = stats.getRecord(meta.id)
    // history 新的在前，翻转为左旧右新展示趋势
    const trend = [...rec.history].reverse()
    const max = trend.reduce((m, h) => Math.max(m, h.score), 0)
    return { meta, rec, trend, max }
  }),
)

function barHeight(score: number, max: number): string {
  if (max <= 0) return '8%'
  return `${Math.max(8, Math.round((score / max) * 100))}%`
}
</script>

<template>
  <PageContainer>
    <TopBar title="脑力档案" back @back="router.push('/')" />

    <div v-if="!hasData" class="empty">
      <p>还没有记录，去玩一局吧</p>
      <AppButton @click="router.push('/')">去首页</AppButton>
    </div>

    <div v-else class="body">
      <AppCard class="hero">
        <div class="hero-label">脑力指数</div>
        <div class="hero-value">{{ stats.brainIndex }}</div>
        <div class="hero-sub">四维能力综合评估</div>
      </AppCard>

      <AppCard class="radar-card">
        <RadarChart :values="stats.radar" />
      </AppCard>

      <AppCard v-for="c in cards" :key="c.meta.id" class="game-card">
        <div class="game-head">
          <div>
            <div class="game-name">{{ c.meta.name }}</div>
            <div class="game-dim">{{ DIMENSION_LABELS[c.meta.dimension] }}</div>
          </div>
          <div class="bests">
            <div>最高分 <b>{{ c.rec.bestScore }}</b></div>
            <div>最高等级 <b>Lv.{{ c.rec.bestLevel }}</b></div>
          </div>
        </div>
        <template v-if="c.trend.length">
          <div class="bars">
            <div
              v-for="(h, i) in c.trend"
              :key="`${h.at}-${i}`"
              class="bar"
              :style="{ height: barHeight(h.score, c.max) }"
            />
          </div>
          <div class="trend-caption">最近 {{ c.trend.length }} 局得分趋势</div>
        </template>
        <div v-else class="trend-empty">暂无成绩</div>
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

.bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 44px;
  margin-top: 14px;
}

.bar {
  flex: 1;
  min-width: 0;
  background: var(--color-primary);
  border-radius: 2px 2px 0 0;
  opacity: 0.8;
}

.bar:last-child {
  background: var(--color-accent);
  opacity: 1;
}

.trend-caption {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-dim);
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
</style>
