// 丹炉链的一世模拟器。跑的全是运行时那套式子（src/game/金丹丹炉.ts 与 词条与属性.ts），
// sim 里不留第二份价目表，也不留第二份"丹怎么产"。
//
// 与运行时对齐的三件事：
//   1. 出丹速率 = pillRate(当前灵气/秒, 等级表)——丹房不在这一条上；
//   2. 定价看 pillAnchor（见过的最高灵气/秒），只涨不跌；
//   3. 丹房抬的是灵气那条加法轴，于是它把后面每一格的价也一起抬上去——这条自惩罚是设计的一部分。
import { BigNumber } from '../src/game/BigNumber.ts'
import { JIEDAN_FURNACE_LEVEL, PILL_LINES, findPill } from '../src/game/词条与属性.ts'
import { pillCostLog10, pillFlowLog10, pillRate } from '../src/game/金丹丹炉.ts'

export const PILL_IDS = PILL_LINES.map((d) => d.id)
export const LV0 = Object.fromEntries(PILL_LINES.map((d) => [d.id, 0]))

/** 丹房每级给灵气那条加法轴的额度，直接从词条取 */
export const QI_PER = PILL_LINES.filter((d) => d.kind === 'qi-add').reduce((a, d) => a + d.power, 0)

/** 反哺形状：收的是丹房级数，定稿那条是加法，另几档用来看"做成乘法墙会不会塌" */
export const QI_SHAPE = {
  none: () => 1,
  add: (n) => 1 + QI_PER * n,
  x105: (n) => 1.05 ** n,
  x12: (n) => 1.2 ** n,
}

/**
 * 会不会为丹产率出力。丹房（qi-add）只抬灵气，而灵气被它自己抬上去之后又要涨价，
 * 对"这一世把炉子炼到第 12 级"一点忙都不帮——所以结丹线之前的贪心要跳过它，运行时那颗一键购买同理。
 */
export const makesDan = (id) => findPill(id).kind !== 'qi-add'

/** 默认能买的行：丹炉 + 火候 */
export const DAN_IDS = PILL_IDS.filter(makesDan)

/** 运行时那条口径：炉子过了结丹线，丹房才进这一口 */
export const AFTER_GATE_IDS = PILL_IDS

/**
 * 一世：灵气/秒按 flowBase 起手（构筑与结丹回溯都折进这个数里），
 * 在 budget 秒里按 ids 那几行贪最便宜地把丹花掉。
 * shift 是给整条价目表加的 log10 偏移（定标时用来反解全局常数，不动公式）。
 * afterGate 给了就照运行时那颗一键购买办：炉子摸到结丹线之前只买 ids，之后连 afterGate 里多出来的行一起买。
 */
export function runPillLife({
  flowBase, budget, shift = 0, ids = DAN_IDS, afterGate = null, qiShape = QI_SHAPE.add, maxSteps = 40000,
}) {
  const lv = { ...LV0 }
  let dan = 0
  let t = 0
  let bestFlow = flowBase * qiShape(lv.danFang)
  const flow = () => flowBase * qiShape(lv.danFang)
  const buyable = () => (afterGate && lv.danLu >= JIEDAN_FURNACE_LEVEL ? afterGate : ids)
  const priceLog = (id) => pillCostLog10(findPill(id), lv[id], pillFlowLog10(Math.log10(bestFlow))) + shift
  const price = (id) => 10 ** priceLog(id)
  let steps = 0
  for (; steps < maxSteps && t < budget; steps++) {
    if (!Number.isFinite(dan)) break
    let pick = null
    for (const id of buyable()) if (pick === null || price(id) < price(pick)) pick = id
    if (pick === null) break
    const c = price(pick)
    if (c > dan) {
      const rate = pillRate(BigNumber.from(flow()), lv).toNumber()
      if (!Number.isFinite(rate) || rate <= 0) break
      const dt = (c - dan) / rate
      if (t + dt > budget) break
      dan = c
      t += dt
      continue
    }
    dan -= c
    lv[pick]++
    const f = flow()
    if (f > bestFlow) bestFlow = f
  }
  return {
    lv, t, dan, steps,
    flow: flow(),
    rate: pillRate(BigNumber.from(flow()), lv).toNumber(),
    anchorLog: pillFlowLog10(Math.log10(bestFlow)),
  }
}

/** 二分：丹炉摸到第 k 级要挂多久；预算顶到底还不算成立就报 ∞ */
export function timeToLevel(k, o = {}, hi = 1e12) {
  if (runPillLife({ ...o, budget: hi }).lv.danLu < k) return Infinity
  let lo = 0
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (runPillLife({ ...o, budget: mid }).lv.danLu >= k) hi = mid
    else lo = mid
  }
  return hi
}

/**
 * 二分反解全局常数：condition 随 shift **单调递减**（价目表整体越贵越摸不到门槛），
 * 返回"仍然成立的最大偏移"，也就是门槛刚好压在预算上的那一点。
 */
export function searchShift(condition, lo0 = -40, hi0 = 40) {
  if (condition(hi0)) return Infinity
  if (!condition(lo0)) return -Infinity
  let lo = lo0
  let hi = hi0
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (condition(mid)) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
