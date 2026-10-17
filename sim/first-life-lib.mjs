// 一世模拟的公共部分：纯 double + log 空间，绝不 import BigNumber（sub 钳负数、add 丢小项会静默算错）。
export const ITEMS = [
  { id: 'tuNa', kind: 'auto-base', base: 10, growth: 1.55, power: 10 },
  { id: 'ningQi', kind: 'speed-mult', base: 150, growth: 12, power: 1.09 },
  { id: 'juLing', kind: 'auto-power', base: 60, growth: 20, power: 2.02 },
  { id: 'zhouTian', kind: 'auto-mult', base: 3e3, growth: 15, power: 1.52 },
  { id: 'ziFu', kind: 'auto-base', base: 2e4, growth: 3, power: 2500 },
]
export const GATE = 1e10
export const PERIOD = 5

const geoSumLog10 = (g, n) => {
  const x = n * Math.log10(g)
  return x > 0.5 ? x + Math.log10(1 - 10 ** -x) - Math.log10(g - 1) : Math.log10((g ** n - 1) / (g - 1))
}
/** 悟性/玄铜镜砍的是涨价幅度的百分比，砍到 MIN_GROWTH 为止——再便宜法门就成降价商品了 */
export const MIN_GROWTH = 1.25
export const growthAfterCut = (growth, cut = 0) => Math.max(growth * (1 - cut), MIN_GROWTH)
/** 从 level 起连买 count 级的总价；在 log 空间算，等级高了也不会溢出 */
export const bulkCostLog = (it, level, count, cut = 0) => {
  const g = growthAfterCut(it.growth, cut)
  return Math.log10(it.base) + level * Math.log10(g) + geoSumLog10(g, count)
}
/** 买下一级（count=1）的价格 */
export const nextCost = (it, level, cut = 0) => 10 ** bulkCostLog(it, level, 1, cut)

/** 一次吐纳会心的倍率，和 src/game/词条与属性.ts 的 GATHER_CRIT_MULT 保持一致 */
export const CRIT_MULT = 3

/** 筑基点结算，和 src/game/rebirth.ts 的 pointsForLoop 同一条式子（模拟里是纯 double，不 import 那边的 BigNumber） */
export const POINTS_PER_DECADE = 3
export const LOOP_ECHO = 0.25
export const LOOP_ECHO_CAP = 8
export const pointsForOver = (over, loops = 0) => {
  const o = over + LOOP_ECHO * Math.min(Math.max(loops, 0), LOOP_ECHO_CAP)
  return o < 0 ? 0 : Math.max(1, Math.floor(POINTS_PER_DECADE * o))
}

export function runLife({ outputAdd = 0, globalAdd = 0, floorBase = 1, cut = 0, crit = 0, target = GATE, capSeconds = 3e7 } = {}) {
  const lv = Object.fromEntries(ITEMS.map((i) => [i.id, 0]))
  let spirit = 0
  let loop = 0
  let t = 0
  const timeline = []
  let nextMark = 0
  const income = () => {
    let autoBase = 0
    let p = 1
    let m = 1
    let s = 1
    for (const it of ITEMS) {
      const n = lv[it.id]
      if (!n) continue
      if (it.kind === 'auto-base') autoBase += it.power * n
      else if (it.kind === 'auto-power') p *= it.power ** n
      else if (it.kind === 'auto-mult') m *= it.power ** n
      else s *= it.power ** n
    }
    const perSecond = autoBase * p * m * (1 + outputAdd)
    const floor = floorBase
    const rate = (floor + perSecond) * (1 + globalAdd)
    return { perSecond, floor, rate, speed: s, eff: (floor + perSecond) * (1 + globalAdd) * s * (1 + crit * (CRIT_MULT - 1)) }
  }
  const snap = () => {
    timeline.push({ t, loop, ...income(), lv: Object.entries(lv).map(([k, v]) => `${k}:${v}`).join(' ') })
  }
  while (t < capSeconds) {
    const inc = income()
    const gain = inc.eff * 0.2
    spirit += gain
    loop += gain
    t += 0.2
    // 活跃玩家近似：哪条买得起就买最便宜的一级，买到买不起为止
    for (;;) {
      let best = null
      for (const it of ITEMS) {
        const c = nextCost(it, lv[it.id], cut)
        if (c <= spirit && (best === null || c < best.c)) best = { id: it.id, c }
      }
      if (!best) break
      spirit -= best.c
      lv[best.id] += 1
    }
    if (t >= nextMark) {
      nextMark += 60
      snap()
    }
    if (spirit >= target) {
      snap()
      return { t, loop, spirit, timedOut: false, ...income(), lv, timeline }
    }
  }
  snap()
  return { t, loop, spirit, timedOut: true, ...income(), lv, timeline }
}
