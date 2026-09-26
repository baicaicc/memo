<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'danger'
    block?: boolean
    disabled?: boolean
  }>(),
  { variant: 'primary', block: false, disabled: false },
)
</script>

<template>
  <button
    class="btn"
    :class="[variant, { block }]"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 22px;
  border-radius: var(--radius-m);
  font-size: 16px;
  font-weight: 600;
  transition:
    transform 0.08s ease,
    background 0.15s ease;
}

.btn:active {
  transform: scale(0.96);
}

.btn:disabled {
  opacity: 0.45;
}

.block {
  display: flex;
  width: 100%;
}

.primary {
  background: var(--color-primary);
  color: #fff;
  box-shadow: 0 4px 18px var(--color-glow);
}

.primary:active {
  background: var(--color-primary-press);
}

.ghost {
  background: var(--color-card);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.danger {
  background: var(--color-danger);
  color: #fff;
}
</style>
