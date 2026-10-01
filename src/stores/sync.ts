import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useStatsStore } from './stats'
import { useDailyStore } from './daily'
import { loadJSON, saveJSON, STORAGE_KEYS } from './persist'
import {
  PROFILE_VERSION,
  codeFromBytes,
  mergeProfiles,
  normalizeCode,
  sanitizeProfile,
  type Profile,
} from '@/sync/profile'

/** idle：还没开启云端存档；offline：最近一次同步失败，本机照常记录，下次再补 */
export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'offline'

export type RestoreOutcome = 'ok' | 'invalid' | 'notfound' | 'offline'

interface SyncState {
  /** 恢复码 = 云端档案的钥匙；第一次有成绩时在本机生成 */
  code: string | null
  lastSyncAt: number | null
}

const TIMEOUT_MS = 8000

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`)
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json' },
      signal: ctrl.signal,
    })
    if (!res.ok) throw new HttpError(res.status)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

export const useSyncStore = defineStore('sync', () => {
  const state = ref<SyncState>(
    loadJSON(STORAGE_KEYS.sync, { code: null, lastSyncAt: null }),
  )
  watch(state, (v) => saveJSON(STORAGE_KEYS.sync, v), { deep: true })

  const status = ref<SyncStatus>(state.value.code ? 'ok' : 'idle')
  /** 存档卡片的提示文字。放在 store 里：找回成功后档案页会从空态切到有数据，卡片重建也不丢提示 */
  const notice = ref('')
  const stats = useStatsStore()
  const daily = useDailyStore()

  function localProfile(): Profile {
    return {
      v: PROFILE_VERSION,
      stats: JSON.parse(JSON.stringify(stats.records)),
      daily: JSON.parse(JSON.stringify(daily.state)),
    }
  }

  /** 合并时以「此刻」的本机数据为基准，请求期间新打完的局不会被覆盖 */
  function applyRemote(remote: Profile) {
    const merged = mergeProfiles(localProfile(), remote)
    stats.records = merged.stats
    daily.state = merged.daily
  }

  function hasLocalData(): boolean {
    return Object.values(stats.records).some((r) => r.history.length > 0)
  }

  async function pushAndPull(code: string) {
    const res = await api<{ profile: unknown }>('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ code, profile: localProfile() }),
    })
    const remote = sanitizeProfile(res.profile)
    if (remote) applyRemote(remote)
    state.value.lastSyncAt = Date.now()
  }

  let inflight: Promise<void> | null = null
  let again = false

  /** 上传本机档案并取回合并结果。失败静默，状态置 offline；并发调用合并为一次 */
  function sync(): Promise<void> {
    if (inflight) {
      again = true
      return inflight
    }
    inflight = (async () => {
      if (!state.value.code) {
        if (!hasLocalData()) return
        state.value.code = codeFromBytes(crypto.getRandomValues(new Uint8Array(8)))
      }
      status.value = 'syncing'
      try {
        await pushAndPull(state.value.code)
        status.value = 'ok'
      } catch {
        status.value = 'offline'
      }
    })().finally(() => {
      inflight = null
      if (again) {
        again = false
        void sync()
      }
    })
    return inflight
  }

  /** 输入恢复码：取回云端档案、与本机已有成绩合并，此后本机改用这个码 */
  async function restore(input: string): Promise<RestoreOutcome> {
    const code = normalizeCode(input)
    if (!code) return 'invalid'
    if (inflight) await inflight
    let remote: Profile | null
    try {
      const res = await api<{ profile: unknown }>(`/api/profile?code=${code}`)
      remote = sanitizeProfile(res.profile)
    } catch (e) {
      return e instanceof HttpError && e.status === 404 ? 'notfound' : 'offline'
    }
    if (!remote) return 'offline'
    applyRemote(remote)
    state.value.code = code
    await sync()
    return 'ok'
  }

  return { state, status, notice, sync, restore }
})
