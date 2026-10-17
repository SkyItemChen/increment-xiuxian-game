// 丹炉链的回归检查：跑的全是运行时那套式子，sim 里不镜像价目表，也不留第二份贪心买法。
// 用法：node --import ./sim/ts-hook.mjs sim/pill-check.mjs
// 盯四件事：① 定标档挂满 12 小时正好摸到炉子第 12 级 ② 一世时长按 1/√流量 走
// ③ 定价锚只涨不跌，自废流量讨不到便宜 ④ 结丹回溯是乘法，一世时长按倍率缩
import { BigNumber } from '../src/game/BigNumber.ts'
import {
  JIEDAN_FURNACE_LEVEL,
  LIANQI_UPGRADES,
  PILL_ANCHOR_SECONDS,
  PILL_LINES,
} from '../src/game/词条与属性.ts'
import { FURNACE_ID, jindanReturnMult, pillCostLog10, pillFlowLog10 } from '../src/game/金丹丹炉.ts'
import { pillRows, recompute, state } from '../src/game/state.ts'
import { GATE, bareMods, dur, runLife } from './life-engine.mjs'
import { DAN_IDS, PILL_IDS, runPillLife, timeToLevel } from './pill-life.mjs'

const CAL_FLOW = 1e24
const ANCHORS = [1e22, 1e24, 1e26, 1e30]
const BUDGET = 12 * 3600

/** 按游戏里那颗一键购买的买法（跳过丹房）要挂多久 */
const gate = (k, flow = CAL_FLOW) => timeToLevel(k, { flowBase: flow })
/** 只堆炉子，一条道走到黑 */
const onlyFurnace = (k, flow = CAL_FLOW) => timeToLevel(k, { flowBase: flow, ids: [FURNACE_ID] })

console.log(`定标档 灵气/秒 ${CAL_FLOW.toExponential(0)} · 全局绝对量 PILL_ANCHOR_SECONDS = ${PILL_ANCHOR_SECONDS.toExponential(3)} 秒`)

console.log('\n【结丹线】定标档按贪心买法，炉子每一级要挂多久')
for (const k of [JIEDAN_FURNACE_LEVEL - 2, JIEDAN_FURNACE_LEVEL - 1, JIEDAN_FURNACE_LEVEL, JIEDAN_FURNACE_LEVEL + 1]) {
  console.log(`  第 ${String(k).padStart(2)} 级  贪心 ${dur(gate(k)).padStart(9)}   只堆炉子 ${dur(onlyFurnace(k)).padStart(9)}`)
}
const hours = gate(JIEDAN_FURNACE_LEVEL) / 3600
console.log(`  → 结丹线 ${hours.toFixed(1)} 小时，${hours >= 10 && hours <= 14 ? '还在「挂一晚」那条带里 ✓' : 'PILL_ANCHOR_SECONDS 跑偏了，重跑 sim/jindan-anchor.mjs ✗'}`)

console.log('\n【时间律】一世时长该按 1/√流量 走：t × √流量 是个常数')
for (const flow of ANCHORS) {
  const t = gate(JIEDAN_FURNACE_LEVEL, flow)
  const r = runPillLife({ flowBase: flow, budget: BUDGET })
  console.log(
    `  灵气/秒 ${flow.toExponential(0).padStart(6)}  炉子第 ${JIEDAN_FURNACE_LEVEL} 级要 ${dur(t).padStart(9)}` +
      `   t·√流量 ${(t * Math.sqrt(flow)).toExponential(2)}` +
      `   挂满 12 小时：炉${String(r.lv.danLu).padStart(2)} 火${String(r.lv.huoHou).padStart(2)} 房${String(r.lv.danFang).padStart(2)}`,
  )
}

console.log('\n【一键购买什么时候才碰丹房】同一份 12 小时：三条都买（陷阱）vs 游戏里那颗（过了结丹线才买丹房）')
for (const flow of ANCHORS) {
  const three = runPillLife({ flowBase: flow, budget: BUDGET, ids: PILL_IDS })
  const game = runPillLife({ flowBase: flow, budget: BUDGET, ids: DAN_IDS, afterGate: PILL_IDS })
  const f = (r) => `炉${String(r.lv.danLu).padStart(2)} 火${String(r.lv.huoHou).padStart(2)} 房${String(r.lv.danFang).padStart(2)}`
  const verdict = (r) => (r.lv.danLu >= JIEDAN_FURNACE_LEVEL ? '过线 ✓' : `差 ${JIEDAN_FURNACE_LEVEL - r.lv.danLu} 级`)
  console.log(
    `  灵气/秒 ${flow.toExponential(0).padStart(6)}  三条都买 ${f(three)} ${verdict(three)}` +
      `   游戏里这颗 ${f(game)} ${verdict(game)}`,
  )
}

console.log(`\n【过了结丹线，一键要会自己起丹房】定标档挂 ${dur(3 * 86400)}（线后余量）`)
const post = runPillLife({ flowBase: CAL_FLOW, budget: 3 * 86400, ids: DAN_IDS, afterGate: PILL_IDS })
const never = runPillLife({ flowBase: CAL_FLOW, budget: 3 * 86400, ids: DAN_IDS })
const row2 = (r) => `炉${String(r.lv.danLu).padStart(2)} 火${String(r.lv.huoHou).padStart(2)} 房${String(r.lv.danFang).padStart(2)}  丹/秒 ${r.rate.toExponential(2)}`
console.log(`  游戏里这颗 ${row2(post)}`)
console.log(`  永远不买丹房 ${row2(never)}  ${post.lv.danFang > 0 ? '→ 线后丹房确实进了一键 ✓' : '→ 线后丹房仍没被买，规则没生效 ✗'}`)

console.log('\n【防自废】定价锚 = 见过的最高灵气/秒，只涨不跌')
const quiet = pillCostLog10(PILL_LINES[0], 0, pillFlowLog10(Math.log10(1e20)))
const loud = pillCostLog10(PILL_LINES[0], 0, pillFlowLog10(Math.log10(1e24)))
console.log(`  照当前流量定价：流量掉到 1e20 时第 1 级便宜 ${(10 ** (loud - quiet)).toExponential(1)} 倍——这条路被锚堵着`)
// 走一遍运行时：把流量抬起来、再散掉，看价格有没有跟着掉
state.totalEarned = new BigNumber(2, 30)
let level = 0
for (let n = 1; n <= 400 && state.spiritPerSecond.log10() < 24; n++) {
  level = n
  for (const def of LIANQI_UPGRADES) state.levels[def.id] = n
  recompute()
}
const upFlow = state.spiritPerSecond.log10()
const upAnchor = state.pillAnchor
const upPrice = pillRows()[0].cost.log10()
for (const def of LIANQI_UPGRADES) state.levels[def.id] = 0
recompute()
console.log(
  `  法门 Lv.${level} 时灵气/秒 1e${upFlow.toFixed(1)} → 锚 ${upAnchor.toFixed(2)}；散光后灵气/秒 1e${state.spiritPerSecond.log10().toFixed(1)}，` +
    `锚仍是 ${state.pillAnchor.toFixed(2)} · 炉子第 1 级仍是 1e${pillRows()[0].cost.log10().toFixed(2)} 丹` +
    ` ${state.pillAnchor === upAnchor && pillRows()[0].cost.log10() === upPrice ? '✓' : '✗ 锚被流量带下去了'}`,
)

console.log('\n【回溯是乘法】首层 ×2、之后每层 ×1.25，一世时长按倍率缩')
const lifeAt = (n) => {
  const mods = bareMods()
  mods.globalAdd = jindanReturnMult(n) - 1
  return runLife({ mods, target: GATE }).t
}
const base = lifeAt(0)
for (const n of [0, 1, 2, 3]) {
  console.log(`  第 ${n} 层金丹（灵气产出 ×${jindanReturnMult(n).toFixed(2)}）：攒到 1e10 要 ${dur(lifeAt(n)).padStart(9)}`)
}
for (const n of [1, 2, 3]) {
  const ratio = lifeAt(n) / base
  const want = 1 / jindanReturnMult(n)
  // 只要求"除得干净"，不要求浮点位数完全相等
  console.log(`  ×${jindanReturnMult(n).toFixed(2)} 那一趟除下来是 ${ratio.toFixed(6)}，该等于 ${want.toFixed(6)} ${Math.abs(ratio - want) / want < 1e-6 ? '✓' : '✗'}`)
}
