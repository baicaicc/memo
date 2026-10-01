<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { weeklySummary } from '@/core/progress'
import { getGame } from '@/games/registry'
import { useStatsStore } from '@/stores/stats'
import AppCard from './AppCard.vue'
import AppButton from './AppButton.vue'

const router = useRouter()
const stats = useStatsStore()

const summary = computed(() => weeklySummary(stats.records, new Date()))
const name = (id: string) => getGame(id)?.name ?? id

const focusText = computed(() => {
  const id = summary.value.focus
  const meta = getGame(id)!
  const best = stats.getRecord(id).bestLevel
  return best === 0 ? `还没练过「${meta.name}」` : `「${meta.name}」最高 Lv.${best}，离上限 Lv.${meta.maxLevel} 最远`
})
</script>

<template>
  <AppCard class="weekly">
    <div class="title">近 7 天</div>
    <div class="numbers">
      <div class="num">
        <b>{{ summary.daysPlayed }}</b>
        <span>天练习</span>
      </div>
      <div class="num">
        <b>{{ summary.sessions }}</b>
        <span>局训练</span>
      </div>
    </div>

    <div class="row">
      <span class="icon">📈</span>
      <span v-if="summary.topGain">
        进步最大：<b>{{ name(summary.topGain.gameId) }}</b>
        Lv.{{ summary.topGain.from }} → <b>Lv.{{ summary.topGain.to }}</b>
      </span>
      <span v-else class="dim">还没有超过以前的最高等级，坚持练就会出现在这里</span>
    </div>

    <div class="row focus">
      <span class="icon">🎯</span>
      <span class="focus-text">最需要加强：{{ focusText }}</span>
      <AppButton variant="ghost" class="go" @click="router.push(`/play/${summary.focus}`)">去练</AppButton>
    </div>
  </AppCard>
</template>

<style scoped>
.title {
  font-size: 16px;
  font-weight: 700;
}

.numbers {
  display: flex;
  gap: 28px;
  margin-top: 10px;
}

.num b {
  font-size: 30px;
  font-weight: 800;
  color: var(--color-accent);
  line-height: 1.1;
}

.num span {
  margin-left: 4px;
  font-size: 13px;
  color: var(--color-text-dim);
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.4;
}

.icon {
  flex: none;
}

.dim {
  color: var(--color-text-dim);
  font-size: 13px;
}

.focus-text {
  flex: 1;
  min-width: 0;
}

.go {
  flex: none;
  min-height: 36px;
  padding: 0 14px;
  font-size: 14px;
}
</style>
