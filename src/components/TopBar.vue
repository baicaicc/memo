<script setup lang="ts">
defineProps<{ title: string; back?: boolean }>()
const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <header class="topbar">
    <button v-if="back" class="back" aria-label="返回" @click="emit('back')">‹</button>
    <h1 class="title">{{ title }}</h1>
    <div class="right"><slot name="right" /></div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  height: 48px;
  margin-bottom: 12px;
}

.back {
  width: 40px;
  height: 40px;
  font-size: 28px;
  line-height: 1;
  color: var(--color-text);
}

.title {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}

.right {
  min-width: 40px;
  display: flex;
  justify-content: flex-end;
}
</style>
