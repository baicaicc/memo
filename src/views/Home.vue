<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { games, DIMENSION_LABELS } from '@/games/registry'
import { useStatsStore } from '@/stores/stats'
import { useDailyStore } from '@/stores/daily'
import PageContainer from '@/components/PageContainer.vue'
import AppCard from '@/components/AppCard.vue'

const router = useRouter()
const stats = useStatsStore()
const daily = useDailyStore()

onMounted(() => daily.ensureToday())

function gameName(id: string) {
  return games.find((g) => g.id === id)?.name ?? id
}
</script>

<template>
  <PageContainer>
    <header class="head">
      <h1 class="app-title">记忆训练</h1>
      <div class="chips">
        <span class="chip">🔥 连续 {{ daily.streak }} 天</span>
        <span class="chip">🧠 脑力指数 {{ stats.brainIndex }}</span>
      </div>
    </header>

    <AppCard class="tasks">
      <h2 class="section-title">今日任务</h2>
      <ul class="task-list">
        <li v-for="task in daily.tasks" :key="task.gameId" class="task">
          <span class="check" :class="{ done: task.done }">
            {{ task.done ? '✓' : '' }}
          </span>
          玩 1 局「{{ gameName(task.gameId) }}」
        </li>
      </ul>
    </AppCard>

    <h2 class="section-title games-title">开始训练</h2>
    <div class="grid">
      <AppCard
        v-for="g in games"
        :key="g.id"
        clickable
        class="game-card"
        @click="router.push(`/play/${g.id}`)"
      >
        <div class="game-name">{{ g.name }}</div>
        <div class="game-tagline">{{ g.tagline }}</div>
        <div class="game-dim">{{ DIMENSION_LABELS[g.dimension] }}</div>
      </AppCard>
    </div>

    <div class="footer-link" @click="router.push('/profile')">我的脑力档案 ›</div>
  </PageContainer>
</template>

<style scoped>
.head {
  padding: 12px 0 20px;
}

.app-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 12px;
}

.chips {
  display: flex;
  gap: 10px;
}

.chip {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 14px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
}

.task-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
}

.check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #0b3d1e;
}

.check.done {
  background: var(--color-success);
  border-color: var(--color-success);
}

.games-title {
  margin-top: 22px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.game-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 110px;
}

.game-name {
  font-size: 17px;
  font-weight: 700;
}

.game-tagline {
  font-size: 13px;
  color: var(--color-text-dim);
  flex: 1;
}

.game-dim {
  font-size: 12px;
  color: var(--color-primary);
}

.footer-link {
  margin-top: 24px;
  text-align: center;
  color: var(--color-text-dim);
  font-size: 14px;
}
</style>
