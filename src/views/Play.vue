<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getGame } from '@/games/registry'

const route = useRoute()
const router = useRouter()

const meta = computed(() => getGame(String(route.params.gameId ?? '')))
const AsyncGame = computed(() =>
  meta.value ? defineAsyncComponent(meta.value.component) : null,
)

onMounted(() => {
  if (!meta.value) router.replace('/')
})
</script>

<template>
  <component :is="AsyncGame" v-if="AsyncGame" />
</template>
