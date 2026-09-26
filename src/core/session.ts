import { ref, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import type { GameId } from '@/games/registry'
import { useStatsStore } from '@/stores/stats'
import { useDailyStore } from '@/stores/daily'
import { useResultStore } from '@/stores/result'

export type SessionPhase = 'ready' | 'showing' | 'recall' | 'finished'

export interface GameSessionOptions {
  /** 挑战链接注入的种子，不传则随机生成 */
  seed?: string
  /** 起始等级（如挑战链接指定难度），默认 1 */
  initialLevel?: number
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
   * 然后跳转 /result。不传参数则取当前 score/level。
   */
  finish(score?: number, level?: number): Promise<void>
}

export function useGameSession(
  gameId: GameId,
  options: GameSessionOptions = {},
): GameSession {
  const router = useRouter()
  const stats = useStatsStore()
  const daily = useDailyStore()
  const resultStore = useResultStore()

  const phase = ref<SessionPhase>('ready')
  const level = ref(options.initialLevel ?? 1)
  const score = ref(0)
  const errors = ref(0)
  const seed =
    options.seed ?? `${gameId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  async function finish(finalScore = score.value, finalLevel = level.value) {
    if (phase.value === 'finished') return
    phase.value = 'finished'
    score.value = finalScore
    level.value = finalLevel
    const outcome = stats.recordResult(gameId, {
      score: finalScore,
      level: finalLevel,
    })
    daily.recordPlay(gameId)
    resultStore.setResult({
      gameId,
      score: finalScore,
      level: finalLevel,
      isBestScore: outcome.isBestScore,
      isBestLevel: outcome.isBestLevel,
      seed,
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
