// 金丹这一层到底给灵气多少？把丹房与七道精神放回运行时那套式子里跑一世，
// 逐笔账念出来：灵气乘数 = (1 + 丹房 + 通灵) × (1 + 养气)，对照结丹那一层的 ×2。
//
// 用法：node --import ./sim/ts-hook.mjs sim/jindan-qi.mjs
//
// 这里只多带一条废渣账，价格、出丹、炸炉、抽卡价全 import 运行时，不留第二份表。
import { BigNumber } from '../src/game/BigNumber.ts'
import {
  JIEDAN_FURNACE_LEVEL,
  SPIRITS,
  findPill,
  findPillMode,
} from '../src/game/词条与属性.ts'
import { pillCostLog10, pillFlowLog10, pillRate } from '../src/game/金丹丹炉.ts'
import {
  bustChance,
  danYieldMult,
  dregYieldMult,
  pullCostLog10,
  qiAxisAdd,
  rollSpirit,
  spiritEnergyAdd,
} from '../src/game/凝练.ts'
import { LV0, DAN_IDS, AFTER_GATE_IDS, runPillLife, searchShift } from './pill-life.mjs'
import { dur } from './life-engine.mjs'

const CAL_FLOW = 1e24
const shift = searchShift((s) => runPillLife({ flowBase: CAL_FLOW, budget: 12 * 3600, shift: s }).lv.danLu >= 12)
const MODE = findPillMode('steady')

/**
 * 一世：灵气/秒按 flowBase 起手，贪心把丹花掉；同时按当前火候攒废渣、攒够就抽一下。
 * 灵气乘数走的是运行时那条 back 轴：丹房与通灵共用加数，养气叠道基那条。
 */
function runLife({ flowBase, budget, mode = MODE, seed = 20261016, wheel = true }) {
  const lv = { ...LV0 }
  const sp = Object.fromEntries(SPIRITS.map((d) => [d.id, 0]))
  let dan = 0
  let dreg = 0
  let t = 0
  let pulls = 0
  let rs = seed
  let bestFlow = flowBase
  const qiMult = () => 1 + qiAxisAdd(lv, sp)
  const enMult = () => 1 + spiritEnergyAdd(sp)
  const flow = () => flowBase * qiMult() * enMult()
  const anchor = () => {
    const f = flow()
    if (f > bestFlow) bestFlow = f
    return bestFlow
  }
  const priceLog = (id) => pillCostLog10(findPill(id), lv[id], pillFlowLog10(Math.log10(anchor()))) + shift
  const nominal = () => pillRate(BigNumber.from(flow()), lv).mulNumber(danYieldMult(sp)).toNumber()
  /** 和运行时 dregFlow() 同一个口径：抽卡价看定标产量与武火，不看这一炉实际出多少 */
  const dregFlow = () => pillFlowLog10(Math.log10(anchor())) + Math.log10(danYieldMult(sp))

  let steps = 0
  for (; steps < 400000 && t < budget; steps++) {
    // 运行时那颗一键购买的口径：炉子没过结丹线，丹房根本不进这一口
    const ids = lv.danLu >= JIEDAN_FURNACE_LEVEL ? AFTER_GATE_IDS : DAN_IDS
    let pick = null
    for (const id of ids) if (pick === null || priceLog(id) < priceLog(pick)) pick = id
    const bust = bustChance(mode, sp)
    const nom = nominal()
    const danRate = nom * mode.yieldMult * (1 - bust)
    const dregRate = nom * bust * dregYieldMult(mode, sp)
    if (!Number.isFinite(danRate) || danRate <= 0) break

    const buyCost = 10 ** priceLog(pick)
    const buyWait = (buyCost - dan) / danRate
    const pullCost = BigNumber.fromLog10(pullCostLog10(pulls, dregFlow())).toNumber()
    const pullWait = wheel ? (pullCost - dreg) / dregRate : Infinity

    if (buyWait <= pullWait) {
      const dt = Math.max(0, buyWait)
      if (t + dt > budget) break
      t += dt
      dreg += dt * dregRate
      dan = buyCost
      lv[pick]++
      continue
    }
    const dt = Math.max(0, pullWait)
    if (t + dt > budget) break
    t += dt
    dreg += dt * dregRate
    dreg = pullCost
    const roll = rollSpirit(rs, sp)
    rs = roll.seed
    if (!roll.maxed) sp[roll.def.id] = roll.level
    pulls++
  }
  return {
    lv, sp, t, pulls, steps,
    flow: flow(),
    qi: qiMult(),
    en: enMult(),
    mult: qiMult() * enMult(),
    rate: pillRate(BigNumber.from(flow()), lv).mulNumber(danYieldMult(sp)).toNumber(),
  }
}

const BUDGETS = [12 * 3600, 86400, 3 * 86400, 10 * 86400, 30 * 86400, 100 * 86400, 1000 * 86400, 3e4 * 86400]

console.log(`【只算丹房】过结丹线之后连丹房一起买，灵气乘数 = 1 + ${Math.round(0.05 * 100)}% × 级数（定标档 灵气/秒 ${CAL_FLOW.toExponential(0)}，火候常态）`)
for (const b of BUDGETS) {
  const r = runLife({ flowBase: CAL_FLOW, budget: b, wheel: false })
  console.log(
    `  挂 ${dur(b).padStart(9)}  炉${String(r.lv.danLu).padStart(2)} 火${String(r.lv.huoHou).padStart(2)} 房${String(r.lv.danFang).padStart(3)}` +
      `   灵气 ×${r.qi.toFixed(2)}（比上一层多 ${((r.qi - 1) * 100).toFixed(0)}%）  丹/秒 ${r.rate.toExponential(2)}`,
  )
}

console.log('\n【丹房 + 转盘】废渣攒够就抽，七道按权重落；通灵与养气都回到灵气那两条轴')
let prev = null
for (const b of BUDGETS) {
  const r = runLife({ flowBase: CAL_FLOW, budget: b })
  const per = prev ? (b - prev.t) / Math.max(1, r.lv.danFang - prev.lv.danFang) : 0
  console.log(
    `  挂 ${dur(b).padStart(9)}  抽${String(r.pulls).padStart(3)} 次` +
      `  房${String(r.lv.danFang).padStart(3)} 通灵${String(r.sp.tongLing).padStart(3)} 养气${String(r.sp.yangQi).padStart(3)} 武火${String(r.sp.wuHuo).padStart(3)} 守一 Lv.${r.sp.shouYi}` +
      `   灵气 ×${r.mult.toFixed(2)} = 丹房通灵 ×${r.qi.toFixed(2)} × 养气 ×${r.en.toFixed(2)}` +
      `${prev && r.lv.danFang > prev.lv.danFang ? `   丹房这格要挂 ${dur(per)}` : ''}`,
  )
  prev = r
}

console.log('\n【跟结丹一层比】一层结丹把整份产出 ×2、一世时长除以 2，而且是永久')
for (const b of BUDGETS) {
  const r = runLife({ flowBase: CAL_FLOW, budget: b })
  console.log(
    `  挂 ${dur(b).padStart(9)}  金丹这一层给灵气 ×${r.mult.toFixed(2)}（= 结丹 ${Math.log2(r.mult).toFixed(2)} 层的量）`,
  )
}

console.log('\n【构构筑厚一档】灵气/秒 1e26 那一档（挂两千世）同一张表，看延后与否有没有差')
for (const b of [12 * 3600, 3 * 86400, 30 * 86400]) {
  const r = runLife({ flowBase: 1e26, budget: b })
  console.log(
    `  挂 ${dur(b).padStart(9)}  抽${String(r.pulls).padStart(3)} 次  房${String(r.lv.danFang).padStart(2)} 通灵${String(r.sp.tongLing).padStart(3)} 养气${String(r.sp.yangQi).padStart(3)}` +
      `   灵气 ×${r.mult.toFixed(2)}  丹/秒 ${r.rate.toExponential(2)}`,
  )
}
