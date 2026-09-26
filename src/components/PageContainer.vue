<script setup lang="ts">
defineProps<{ padded?: boolean }>()
</script>

<template>
  <div class="page" :class="{ padded: padded !== false }">
    <slot />
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  min-height: 100dvh;
  padding-top: calc(var(--safe-top) + 12px);
  padding-bottom: calc(var(--safe-bottom) + 16px);
  padding-left: calc(var(--safe-left) + 16px);
  padding-right: calc(var(--safe-right) + 16px);
}

.page:not(.padded) {
  padding: 0;
}
</style>
