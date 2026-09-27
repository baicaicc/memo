import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/rng'
import {
  GRID_COUNT,
  JUDGED_TRIALS,
  MATCH_RATIO,
  MAX_N,
  MIN_N,
  PENALTY_PER_MISTAKE,
  SCORE_PER_CORRECT,
  generateStimuli,
  judgeRound,
  judgeTrial,
  nextN,
  roundOutcome,
  probit,
  dPrime,
  DOWN_THRESHOLD,
  UP_THRESHOLD,
  roundTrialCount,
} from '@/games/nback/logic'

describe('games/nback logic', () => {
  it('同种子生成相同刺激序列（挑战链接可复现同题）', () => {
    const a = generateStimuli(createRng('nback-challenge#2'), 2)
    const b = generateStimuli(createRng('nback-challenge#2'), 2)
    expect(a).toEqual(b)
    expect(a).toHaveLength(roundTrialCount(2))
  })

  it('不同种子生成不同序列', () => {
    const a = generateStimuli(createRng('nback-seed-a#1'), 1)
    const b = generateStimuli(createRng('nback-seed-b#1'), 1)
    expect(a).not.toEqual(b)
  })

  it('一局刺激数 = 20 + N，位置都在九宫格范围内', () => {
    for (let n = MIN_N; n <= MAX_N; n++) {
      const stimuli = generateStimuli(createRng(`nback-len-${n}`), n)
      expect(stimuli).toHaveLength(20 + n)
      for (const s of stimuli) {
        expect(s.position).toBeGreaterThanOrEqual(0)
        expect(s.position).toBeLessThan(GRID_COUNT)
      }
    }
  })

  it('前 N 拍为热身（恒不匹配），匹配拍约占可判定拍的 30%', () => {
    for (let n = MIN_N; n <= 4; n++) {
      const stimuli = generateStimuli(createRng(`nback-ratio-${n}`), n)
      const judged = stimuli.slice(n)
      expect(judged).toHaveLength(JUDGED_TRIALS)
      expect(stimuli.slice(0, n).every((s) => !s.isMatch)).toBe(true)
      const matches = judged.filter((s) => s.isMatch).length
      expect(matches).toBe(Math.round(JUDGED_TRIALS * MATCH_RATIO))
    }
  })

  it('isMatch 标记与「位置等于 N 步前」严格一致（非匹配拍不会意外匹配）', () => {
    for (const seed of ['nback-cons-1', 'nback-cons-2', 'nback-cons-3']) {
      for (let n = MIN_N; n <= MAX_N; n++) {
        const stimuli = generateStimuli(createRng(`${seed}#${n}`), n)
        for (let i = n; i < stimuli.length; i++) {
          expect(stimuli[i].position === stimuli[i - n].position).toBe(stimuli[i].isMatch)
        }
      }
    }
  })

  it('非法参数抛错', () => {
    const rng = createRng('nback-bad')
    expect(() => generateStimuli(rng, 0)).toThrow(RangeError)
    expect(() => generateStimuli(rng, 2, 2)).toThrow(RangeError)
  })

  it('逐拍判定：命中/正确放过 +10×N，漏报/错点 -5', () => {
    expect(judgeTrial(true, true, 3)).toEqual({
      kind: 'hit',
      correct: true,
      delta: SCORE_PER_CORRECT * 3,
    })
    expect(judgeTrial(false, false, 3)).toEqual({
      kind: 'correctReject',
      correct: true,
      delta: SCORE_PER_CORRECT * 3,
    })
    expect(judgeTrial(true, false, 3)).toEqual({
      kind: 'miss',
      correct: false,
      delta: -PENALTY_PER_MISTAKE,
    })
    expect(judgeTrial(false, true, 3)).toEqual({
      kind: 'falseAlarm',
      correct: false,
      delta: -PENALTY_PER_MISTAKE,
    })
  })

  it('judgeRound 只判定第 N 拍之后，全对/全错/混合的正确率与得分', () => {
    const n = 2
    const stimuli = generateStimuli(createRng('nback-judge'), n)
    const total = stimuli.length - n

    const allCorrect = stimuli.map((s, i) => i >= n && s.isMatch)
    const perfect = judgeRound(stimuli, allCorrect, n)
    expect(perfect.judged).toBe(total)
    expect(perfect.correct).toBe(total)
    expect(perfect.mistakes).toBe(0)
    expect(perfect.correctRate).toBe(1)
    expect(perfect.scoreDelta).toBe(total * SCORE_PER_CORRECT * n)

    const allWrong = stimuli.map((s, i) => i >= n && !s.isMatch)
    const worst = judgeRound(stimuli, allWrong, n)
    expect(worst.correct).toBe(0)
    expect(worst.correctRate).toBe(0)
    expect(worst.scoreDelta).toBe(-total * PENALTY_PER_MISTAKE)

    // 只在首个匹配拍作答（命中 1 次），其余拍全不答（非匹配均为正确放过）
    const firstMatch = n + stimuli.slice(n).findIndex((s) => s.isMatch)
    const partial = stimuli.map((_, i) => i === firstMatch)
    const mixed = judgeRound(stimuli, partial, n)
    const expectedCorrect =
      1 + stimuli.slice(n).filter((s, k) => n + k !== firstMatch && !s.isMatch).length
    expect(mixed.correct).toBe(expectedCorrect)
    expect(mixed.correctRate).toBeCloseTo(expectedCorrect / total)
  })

  it('升降级规则边界：≥80% 升，50–80% 保持，<50% 降', () => {
    expect(roundOutcome(1.5)).toBe('up')
    expect(roundOutcome(3)).toBe('up')
    expect(roundOutcome(1.49)).toBe('stay')
    expect(roundOutcome(0.5)).toBe('stay')
    expect(roundOutcome(0.49)).toBe('down')
    expect(roundOutcome(-2)).toBe('down')

    expect(nextN(1.5, 2)).toBe(3)
    expect(nextN(1, 2)).toBe(2)
    expect(nextN(0.4, 2)).toBe(1)
    // 封顶与保底
    expect(nextN(1, MAX_N)).toBe(MAX_N)
    expect(nextN(0, MIN_N)).toBe(MIN_N)
  })

  it('计分：正确判定得分随 N 放大，错误恒为 -5', () => {
    expect(SCORE_PER_CORRECT).toBe(10)
    expect(PENALTY_PER_MISTAKE).toBe(5)
    expect(judgeTrial(true, true, 1).delta).toBe(10)
    expect(judgeTrial(true, true, MAX_N).delta).toBe(80)
    expect(judgeTrial(false, false, MAX_N).delta).toBe(80)
    expect(judgeTrial(true, false, MAX_N).delta).toBe(-5)
    expect(judgeTrial(false, true, 1).delta).toBe(-5)
  })
})

describe('nback d\' 记分（防挂机，MEMO 反馈）', () => {
  it('probit 与标准正态分位数一致（±0.01）', () => {
    expect(probit(0.5)).toBeCloseTo(0, 6)
    expect(probit(0.8413)).toBeCloseTo(1, 2)
    expect(probit(0.9772)).toBeCloseTo(2, 2)
    expect(probit(0.0228)).toBeCloseTo(-2, 2)
  })

  it('全程不操作（正确放过全部非匹配）d\' 为负 → 必降级，无法躺分', () => {
    // 20 判定拍、6 匹配：命中 0、漏报 6、错点 0、正确放过 14
    const dp = dPrime(0, 6, 0, 14)
    expect(dp).toBeLessThan(DOWN_THRESHOLD)
    expect(roundOutcome(dp)).toBe('down')
  })

  it('完美表现 d\' 很高 → 升级', () => {
    const dp = dPrime(6, 0, 0, 14)
    expect(dp).toBeGreaterThan(UP_THRESHOLD)
    expect(roundOutcome(dp)).toBe('up')
  })

  it('乱按（全部虚报）同样 d\' 为负', () => {
    const dp = dPrime(0, 6, 14, 0)
    expect(roundOutcome(dp)).toBe('down')
  })

  it('judgeRound 输出四分类计数与 d\'', () => {
    const rng = createRng('dp-round')
    const stimuli = generateStimuli(rng, 2)
    const pressed = stimuli.map((s) => s.isMatch) // 全部按对（命中），非匹配全不按
    const j = judgeRound(stimuli, pressed, 2)
    expect(j.judged).toBe(20)
    expect(j.hits).toBe(6)
    expect(j.misses).toBe(0)
    expect(j.falseAlarms).toBe(0)
    expect(j.correctRejections).toBe(14)
    expect(j.dPrime).toBeGreaterThan(UP_THRESHOLD)
  })
})
