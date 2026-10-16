// 丹炉链的定标：解出整条链唯一的绝对量 PILL_ANCHOR_SECONDS，并把结丹线前后的落点全量一遍。
// 数学一律取自运行时——价格、出丹、灵气反哺都 import src/game/金丹丹炉.ts 与 词条与属性.ts，
// 这里只把"全局常数"这一个旋钮解出来（见 sim/pill-life.mjs）。
//
// 用法：node --import ./sim/ts-hook.mjs sim/jindan-anchor.mjs
//   解出新常数 → 抄进 src/game/词条与属性.ts 的 PILL_ANCHOR_SECONDS → 再跑 sim/pill-check.mjs 收尾
import { JIEDAN_FURNACE_LEVEL, PILL_ANCHOR_SECONDS, PILL_CONVERT_BASE, PILL_LINES } from '../src/game/词条与属性.ts'
import { DAN_IDS, QI_PER, QI_SHAPE, PILL_IDS, runPillLife, searchShift, timeToLevel } from './pill-life.mjs'
import { dur } from './life-engine.mjs'

/** 定标档：这一档构筑挂满 12 小时正好摸到结丹线（炉子第 12 级）。灵气/秒取 sim/jindan.mjs 的实测锚点 */
const CAL_FLOW = 1e24
const TARGET = JIEDAN_FURNACE_LEVEL
const BUDGET = 12 * 3600

/** 结丹线之外还要不要往上：只堆炉子那一列用来看贪心省了多少 */
const shift = searchShift((s) => runPillLife({ flowBase: CAL_FLOW, budget: BUDGET, shift: s }).lv.danLu >= TARGET)
const S = PILL_ANCHOR_SECONDS * 10 ** shift
console.log(`定标：灵气/秒 ${CAL_FLOW.toExponential(0)} 挂满 ${dur(BUDGET)} 正好炉子第 ${TARGET} 级`)
console.log(`  当前常数 ${PILL_ANCHOR_SECONDS.toExponential(3)} 秒 · 该改成 ${S.toExponential(3)} 秒（偏移 10^${shift.toFixed(3)}）`)
for (const d of PILL_LINES) {
  console.log(`  ${d.name} 第 1 级 = ${(S * d.ratio).toExponential(3)} 秒的定标产量 × √流量 · 涨价 ×${d.growth}`)
}
console.log(`  定标产量 = 灵气/秒 × 转化 ${PILL_CONVERT_BASE} = ${(CAL_FLOW * PILL_CONVERT_BASE).toExponential(2)} 丹/秒`)

/** 把常数换成解出来的那份再跑后面的表：shift 就是两者之差 */
const OPT = { flowBase: CAL_FLOW, shift }

console.log('\n【每多一级炉子要等多久】定标档按解出来的常数——面板念的就是这一格')
let acc = 0
let accF = 0
for (let k = TARGET - 3; k <= TARGET + 3; k++) {
  const cheap = timeToLevel(k, OPT)
  const only = timeToLevel(k, { ...OPT, ids: ['danLu'] })
  console.log(
    `  第 ${String(k).padStart(2)} 级  贪心 累计 ${dur(cheap).padStart(9)} 本级 ${dur(cheap - acc).padStart(9)}` +
      `   只堆炉子 累计 ${dur(only).padStart(9)} 本级 ${dur(only - accF).padStart(9)}`,
  )
  acc = cheap
  accF = only
}

const ANCHORS = [
  ['刚解锁探索', 1e22],
  ['法宝收齐那阵', 1e24],
  ['再挂两千世', 1e26],
  ['4000 世终局', 1e30],
]

console.log(`\n【各档构筑摸到结丹线要挂多久】定标 = 门槛压在 ${dur(BUDGET)} 那一点，门槛之前那一格还没买上，所以"挂满"这列在定标档显示 11 或 12 都算同一件事`)
for (const [name, flow] of ANCHORS) {
  const t = timeToLevel(TARGET, { ...OPT, flowBase: flow })
  const r = runPillLife({ ...OPT, flowBase: flow, budget: BUDGET })
  console.log(
    `  ${name.padEnd(14)} 灵气/秒 ${flow.toExponential(0).padStart(6)}  炉子第 ${TARGET} 级 ${dur(t).padStart(9)}` +
      `   挂 ${dur(BUDGET)} 买到 炉${String(r.lv.danLu).padStart(2)} 火${String(r.lv.huoHou).padStart(2)}  丹/秒 ${r.rate.toExponential(2)}`,
  )
}

console.log('\n【时间律】同一格要挂多久：t 该按 1/√流量 走，t·√流量 是个常数')
for (const [, flow] of ANCHORS) {
  const t = timeToLevel(TARGET, { ...OPT, flowBase: flow })
  console.log(`  灵气/秒 ${flow.toExponential(0).padStart(6)}  炉子第 ${TARGET} 级 ${dur(t).padStart(9)}   t·√流量 ${(t * Math.sqrt(flow)).toExponential(2)}`)
}

console.log(`\n【丹房该不该做乘法】把灵气反哺换成别的形状，门槛 = 灵气/秒 摸到 1e28（定标档的千倍）`)
const flowGate = (budget, shape) => runPillLife({
  ...OPT, budget, ids: PILL_IDS, qiShape: shape,
}).flow
for (const [label, shape] of [['不反哺', QI_SHAPE.none], [`加法 每级+${Math.round(QI_PER * 100)}%`, QI_SHAPE.add], ['乘法 每级×1.05', QI_SHAPE.x105], ['乘法 每级×1.2', QI_SHAPE.x12]]) {
  let lo = 0
  let hi = 3e12
  const reached = flowGate(hi, shape) >= 1e28
  if (reached) {
    for (let i = 0; i < 70; i++) {
      const mid = (lo + hi) / 2
      if (flowGate(mid, shape) >= 1e28) hi = mid
      else lo = mid
    }
  }
  const r = runPillLife({ ...OPT, budget: reached ? hi : 3e12, ids: PILL_IDS, qiShape: shape })
  console.log(`  ${label.padEnd(16)} ${reached ? dur(hi).padStart(10) : '∞（超过 9.5 万年，墙咬住）'}   炉${r.lv.danLu} 火${r.lv.huoHou} 房${r.lv.danFang}`)
}
