<script setup lang="ts">
defineProps<{ clickable?: boolean }>()
</script>

<template>
  <div class="card" :class="{ clickable }">
    <slot />
  </div>
</template>

<style scoped>
.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-l);
  padding: 16px;
}

.clickable {
  transition:
    transform 0.08s ease,
    background 0.15s ease;
}

.clickable:active {
  transform: scale(0.97);
  background: var(--color-card-hover);
}
</style>
