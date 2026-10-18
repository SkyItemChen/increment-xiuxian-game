// 丹纹机制对照：0.17（补差口径）vs 0.18（涨幅刹车口径）的配速差。
// **这是一份历史记录**：0.19 起门槛改按"产量 × 仪式秒数"定价，现行口径见 `sim/jindan-balance-audit.mjs`；
// 下面 0.18 那一列现在只剩"老阶梯"的含义，不再等于真实节奏。
// 用法：node --import ./sim/ts-hook.mjs sim/jindan-marks-audit.mjs
//
// 0.17 的公式已经不在代码里了，这里按当时的定义复刻一份**只用于对照**：
//   cost(n) = 1e30 × 1.15^(n−1) × C(n)，C(n) = 参考点法收益(n) / 参考点法收益(1)。
// 0.18 直接问 `jindanCostLog10(layer, total)`，不在这里另算。
// 断言型校验在 `sim/jindan-cost-check.mjs`，这个脚本只负责把"变了多少"摆出来。
import {
  JIEDAN_RETURN_GROWTH,
  JINDAN_MILESTONES,
  JINDAN_TREE,
  JINDAN_TREE_MAX,
  JINDAN_TREE_PER_LAYER,
  LIANQI_UPGRADES,
  PILL_ANCHOR_SECONDS,
  REBIRTH_TREE,
  TREASURES,
} from '../src/game/词条与属性.ts'
import {
  JIEDAN_COST_BASE_LOG10,
  jindanCostLog10,
  jindanGrowthAt,
  jindanMarksAt,
  jindanReturnMult,
} from '../src/game/金丹丹炉.ts'
import { mergeMods, runLife, treeMods, treasureMods, dur } from './life-engine.mjs'

/* ------------------------------------------------ 时间锚 */

const FULL_TREASURES = Object.fromEntries(TREASURES.map((t) => [t.id, t.cap]))
const treeAt = (lv) => Object.fromEntries(REBIRTH_TREE.map((r) => [r.id, lv]))
const mods8 = mergeMods(treeMods(treeAt(8)), treasureMods(FULL_TREASURES))
const life30 = runLife({ mods: mods8, target: 1e30 })
const T0 = life30.t

function endFlowLog10(r, mods) {
  let autoBase = 0
  let powerLog = 0
  let multLog = 0
  let speedLog = 0
  for (const it of LIANQI_UPGRADES) {
    const n = r.lv[it.id] ?? 0
    if (!n) continue
    if (it.kind === 'auto-base') autoBase += it.power * n
    else if (it.kind === 'auto-power') powerLog += n * Math.log10(it.power)
    else if (it.kind === 'auto-mult') multLog += n * Math.log10(it.power)
    else if (it.kind === 'speed-mult') speedLog += n * Math.log10(it.power)
  }
  const perSecond = autoBase * 10 ** powerLog * 10 ** multLog * (1 + mods.outputAdd)
  const rateLog = Math.log10(
    (1 + mods.tAutoBase + perSecond) * 10 ** mods.tAutoMultLog * (1 + mods.globalAdd + mods.energyAdd),
  )
  return rateLog + mods.tSpeedLog + speedLog
}

const FURNACE_PHASE = PILL_ANCHOR_SECONDS / 10 ** (endFlowLog10(life30, mods8) / 2)

const powerOf = (id) => JINDAN_TREE.find((b) => b.id === id).power
const qiBonus = (lv) => 1 + (lv.fanYuan ?? 0) * powerOf('fanYuan')
const danBonus = (lv) => 1 + (lv.danDao ?? 0) * powerOf('danDao')
const totalOf = (lv) => JINDAN_TREE.reduce((a, d) => a + (lv[d.id] ?? 0), 0)

function pointsForLayer(layer) {
  let gain = JINDAN_TREE_PER_LAYER
  for (const ms of JINDAN_MILESTONES) if (ms.layer === layer) gain += ms.marks ?? 0
  return gain
}

function lifeSeconds(k, lv, costMult) {
  const m = jindanReturnMult(k)
  const qi = qiBonus(lv)
  const furnace = FURNACE_PHASE / Math.sqrt(m * qi) / danBonus(lv)
  return furnace + ((T0 - FURNACE_PHASE) * costMult) / (m * qi)
}

/* ------------------------------------------------ 0.17 的历史复刻（仅对照用） */

/** 参考点法：点数平分给丹道与返元，每枝能点到几级 */
function referenceLevel(marks) {
  const perBranch = Math.max(0, marks) / 2
  return Math.max(0, Math.min(JINDAN_TREE_MAX, Math.floor((Math.sqrt(1 + 8 * perBranch) - 1) / 2)))
}

function referenceIncome(layer) {
  const lv = referenceLevel(jindanMarksAt(layer))
  return (1 + 0.04 * lv) * (1 + 0.03 * lv)
}

function oldCostOffset(layer) {
  return referenceIncome(layer) / referenceIncome(1)
}

function oldCostMult(layer) {
  return 10 ** ((layer - 1) * Math.log10(1.15)) * oldCostOffset(layer)
}

/* ------------------------------------------------ 点法 */

const PROD = ['danDao', 'fanYuan']

function spend(st, pool) {
  for (;;) {
    let best = null
    for (const id of pool) {
      const lv = st.lv[id] ?? 0
      if (lv >= JINDAN_TREE_MAX) continue
      const c = lv + 1
      if (c <= st.points && (best === null || c < best.c)) best = { id, c }
    }
    if (!best) return
    st.points -= best.c
    st.lv[best.id] += 1
  }
}

/** version: 'old' 走 0.17 的 1.15+补差；'new' 走 0.18 的涨幅刹车 */
function simulate(version, strategy, layers) {
  const st = { lv: Object.fromEntries(JINDAN_TREE.map((b) => [b.id, 0])), points: 0 }
  let t = 0
  const rows = []
  for (let k = 0; k < layers; k++) {
    const costMult =
      version === 'old'
        ? oldCostMult(k + 1)
        : 10 ** (jindanCostLog10(k + 1, totalOf(st.lv)) - JIEDAN_COST_BASE_LOG10)
    const sec = lifeSeconds(k, st.lv, costMult)
    t += sec
    if ((k + 1) % 20 === 0 || k < 3) rows.push({ layer: k + 1, sec, t, total: totalOf(st.lv) })
    st.points += pointsForLayer(k + 1)
    if (strategy === 'prod') spend(st, PROD)
    else if (strategy === 'bal') spend(st, JINDAN_TREE.map((b) => b.id))
  }
  return { t, st, rows, total: totalOf(st.lv) }
}

/* ------------------------------------------------ 输出 */

const h = (s) => `${(s / 3600).toFixed(2)}h`

console.log('【0.17 vs 0.18】同一套时间锚、同一份点数曲线，只换门槛公式')
console.log(`  锚：根骨各 8 级 + 法宝收齐，一世摸到 1e30 用 ${dur(T0)}（丹炉段 ${dur(FURNACE_PHASE)}）`)

console.log('\n【一】80 层 / 405 层的总时长')
console.log('        口径                     80 层     405 层')
for (const [ver, label] of [['old', '0.17'], ['new', '0.18']]) {
  for (const [strategy, name] of [['none', '不点丹纹'], ['prod', '生产枝优先'], ['bal', '四枝均衡']]) {
    const r80 = simulate(ver, strategy, 80)
    const r405 = simulate(ver, strategy, 405)
    console.log(
      `  ${label}   ${name.padEnd(10, '　')}   ${h(r80.t).padStart(7)}   ${h(r405.t).padStart(8)}`,
    )
  }
}

console.log('\n【二】"点与不点"的差距（这条就是丹纹有没有意义的判据）')
for (const [ver, label] of [['old', '0.17'], ['new', '0.18']]) {
  const n80 = simulate(ver, 'none', 80)
  const b80 = simulate(ver, 'bal', 80)
  const n405 = simulate(ver, 'none', 405)
  const b405 = simulate(ver, 'bal', 405)
  console.log(
    `  ${label}：80 层 ×${(n80.t / b80.t).toFixed(2)} · 405 层 ×${(n405.t / b405.t).toFixed(2)}`,
  )
}

console.log('\n【三】0.18 下不点的单层耗时（应当是一条平线）')
{
  const r = simulate('new', 'none', 100)
  for (const m of r.rows) console.log(`  第 ${String(m.layer).padStart(3)} 层：${dur(m.sec).padStart(9)} · 累计 ${dur(m.t)}`)
}

console.log('\n【四】0.18 下均衡点法的逐段（涨幅随深度往下走）')
{
  const r = simulate('new', 'bal', 405)
  console.log('   层  丹纹总级   每层涨幅   这一层          累计')
  for (const m of r.rows) {
    console.log(
      `  ${String(m.layer).padStart(4)}   ${String(m.total).padStart(3)} 级` +
        `     ×${jindanGrowthAt(m.total).toFixed(3)}` +
        `     ${dur(m.sec).padStart(9)}   ${dur(m.t).padStart(10)}`,
    )
  }
}

console.log('\n【五】几个关键常数')
console.log(`  0 级涨幅 ×${JIEDAN_RETURN_GROWTH} · 42 级封底 ×1.00 · 0.18 的 80 层"不点/均衡"倍数目标 ≥ 3.5`)
console.log(`  四枝满级 ${JINDAN_TREE.length * JINDAN_TREE_MAX} 级；405 层给 ${jindanMarksAt(405)} 点，1000 层给 ${jindanMarksAt(1000)} 点`)
