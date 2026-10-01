import { ref, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import type { GameId } from '@/games/registry'
import { useStatsStore } from '@/stores/stats'
import { useDailyStore } from '@/stores/daily'
import { useResultStore } from '@/stores/result'
import { useSyncStore } from '@/stores/sync'

export type SessionPhase = 'ready' | 'showing' | 'recall' | 'finished'

export interface GameSessionOptions {
  /** 挑战链接注入的种子，不传则随机生成 */
  seed?: string
  /** 起始等级（如挑战链接指定难度），默认 1 */
  initialLevel?: number
}

/**
 * 一局的答题明细：session 自动记录通用字段，各游戏经 finish(…, extra) 追加自己的字段。
 * 随成绩写入历史并同步到云端（MEMO-6），供后续 AI 教练分析（MEMO-7）。
 */
export interface SessionDetail {
  seed: string
  /** 是否来自挑战链接 */
  challenge: boolean
  errors: number
  /** 从进入游戏页到结算的时长（毫秒） */
  durationMs: number
  [key: string]: unknown
}

export interface GameSession {
  phase: Ref<SessionPhase>
  level: Ref<number>
  score: Ref<number>
  errors: Ref<number>
  /** 本局种子，出题请用 createRng(session.seed) */
  readonly seed: string
  setPhase(p: SessionPhase): void
  addScore(n: number): void
  addError(): void
  /**
   * 结束本局：写入 stats 纪录、勾选每日任务、写入 result store，
   * 然后跳转 /result。不传参数则取当前 score/level；extra 为游戏特有的明细字段。
   */
  finish(score?: number, level?: number, extra?: Record<string, unknown>): Promise<void>
}

export function useGameSession(
  gameId: GameId,
  options: GameSessionOptions = {},
): GameSession {
  const router = useRouter()
  const stats = useStatsStore()
  const daily = useDailyStore()
  const resultStore = useResultStore()
  const sync = useSyncStore()

  const phase = ref<SessionPhase>('ready')
  const level = ref(options.initialLevel ?? 1)
  const score = ref(0)
  const errors = ref(0)
  const seed =
    options.seed ?? `${gameId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const startedAt = performance.now()

  async function finish(
    finalScore = score.value,
    finalLevel = level.value,
    extra: Record<string, unknown> = {},
  ) {
    if (phase.value === 'finished') return
    phase.value = 'finished'
    score.value = finalScore
    level.value = finalLevel
    const detail: SessionDetail = {
      seed,
      challenge: options.seed !== undefined,
      errors: errors.value,
      durationMs: Math.round(performance.now() - startedAt),
      ...extra,
    }
    const outcome = stats.recordResult(gameId, {
      score: finalScore,
      level: finalLevel,
      detail,
    })
    daily.recordPlay(gameId)
    // 后台上传云端存档，失败不影响结算
    void sync.sync()
    resultStore.setResult({
      gameId,
      score: finalScore,
      level: finalLevel,
      isBestScore: outcome.isBestScore,
      isBestLevel: outcome.isBestLevel,
      seed,
      detail,
      at: Date.now(),
    })
    await router.push('/result')
  }

  return {
    phase,
    level,
    score,
    errors,
    seed,
    setPhase: (p) => {
      phase.value = p
    },
    addScore: (n) => {
      score.value += n
    },
    addError: () => {
      errors.value += 1
    },
    finish,
  }
}
