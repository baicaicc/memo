<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSyncStore, type RestoreOutcome } from '@/stores/sync'
import AppCard from './AppCard.vue'
import AppButton from './AppButton.vue'

const sync = useSyncStore()
const route = useRoute()
const router = useRouter()

const code = computed(() => sync.state.code)
/** 8 位码中间加连字符，方便抄写 */
const codeText = computed(() => (code.value ? `${code.value.slice(0, 4)}-${code.value.slice(4)}` : ''))

const statusText = computed(() => {
  if (sync.status === 'syncing') return '同步中…'
  if (sync.status === 'offline') return '暂时连不上，成绩已存在本机，稍后自动补传'
  const at = sync.state.lastSyncAt
  if (!at) return '已开启'
  const d = new Date(at)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `已同步 · ${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`
})

const showRestore = ref(false)
const input = ref('')
const restoring = ref(false)
const message = computed({
  get: () => sync.notice,
  set: (v: string) => (sync.notice = v),
})

const OUTCOME_TEXT: Record<RestoreOutcome, string> = {
  ok: '已找回，成绩已合并到本机',
  invalid: '恢复码是 8 位字母或数字，请检查一下',
  notfound: '没有找到这个恢复码的存档',
  offline: '网络不太好，稍后再试',
}

async function doRestore(value: string) {
  if (restoring.value) return
  restoring.value = true
  message.value = ''
  const outcome = await sync.restore(value)
  restoring.value = false
  message.value = OUTCOME_TEXT[outcome]
  if (outcome === 'ok') {
    showRestore.value = false
    input.value = ''
  } else {
    showRestore.value = true
    input.value = value
  }
}

async function copy(text: string, tip: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  message.value = tip
}

function copyCode() {
  if (code.value) void copy(codeText.value, '恢复码已复制，存到备忘录或发给自己')
}

function copyLink() {
  if (code.value) void copy(`${location.origin}/restore/${code.value}`, '专属链接已复制，换手机时打开它就能找回')
}

onUnmounted(() => {
  sync.notice = ''
})

onMounted(() => {
  // 专属链接 /restore/:code 会带着 ?restore= 跳到档案页
  const q = route.query.restore
  if (typeof q === 'string' && q) {
    void router.replace({ path: route.path })
    if (q !== code.value) void doRestore(q)
  }
})
</script>

<template>
  <AppCard class="cloud">
    <div class="head">
      <div class="title">云端存档</div>
      <div v-if="code" class="status" :class="sync.status">{{ statusText }}</div>
    </div>

    <template v-if="code">
      <div class="code-label">我的恢复码</div>
      <div class="code">{{ codeText }}</div>
      <div class="hint">清缓存或换手机后，用它找回全部成绩</div>
      <div class="actions">
        <AppButton variant="ghost" @click="copyCode">复制恢复码</AppButton>
        <AppButton variant="ghost" @click="copyLink">复制专属链接</AppButton>
      </div>
    </template>
    <div v-else class="hint">玩完第一局后自动开启，成绩会存到云端</div>

    <div v-if="message" class="message">{{ message }}</div>

    <button v-if="!showRestore" class="link" @click="showRestore = true">
      换了手机或清过缓存？输入恢复码找回
    </button>
    <div v-else class="restore">
      <input
        v-model="input"
        class="input"
        maxlength="12"
        placeholder="输入 8 位恢复码"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        @keyup.enter="doRestore(input)"
      />
      <AppButton :disabled="restoring || !input.trim()" @click="doRestore(input)">
        {{ restoring ? '找回中…' : '找回' }}
      </AppButton>
    </div>
  </AppCard>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.title {
  font-size: 16px;
  font-weight: 700;
}

.status {
  font-size: 12px;
  color: var(--color-success);
  text-align: right;
}

.status.syncing {
  color: var(--color-text-dim);
}

.status.offline {
  color: var(--color-accent);
}

.code-label {
  margin-top: 12px;
  font-size: 12px;
  color: var(--color-text-dim);
}

.code {
  margin-top: 2px;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 3px;
  color: var(--color-accent);
  user-select: text;
  -webkit-user-select: text;
}

.hint {
  margin-top: 6px;
  font-size: 13px;
  color: var(--color-text-dim);
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.actions > * {
  flex: 1;
  padding: 0 8px;
  font-size: 14px;
}

.message {
  margin-top: 10px;
  font-size: 13px;
  color: var(--color-primary);
}

.link {
  margin-top: 12px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text-dim);
  font-size: 13px;
  text-decoration: underline;
}

.restore {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.input {
  flex: 1;
  min-width: 0;
  height: 46px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-bg-soft);
  color: var(--color-text);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 18px;
  letter-spacing: 2px;
  text-transform: uppercase;
  user-select: text;
  -webkit-user-select: text;
}

.input::placeholder {
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 0;
  text-transform: none;
}
</style>
