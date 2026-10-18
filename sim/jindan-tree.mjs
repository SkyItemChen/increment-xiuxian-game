// 丹纹树模拟。数值直接读 src/game/词条与属性.ts，别在这里留第二份表。
// 用法：node --import ./sim/ts-hook.mjs sim/jindan-tree.mjs
//
// 规矩：
//  1. 结丹每层给 1 点丹纹，结丹里程碑再额外添几点（第 1/2/3/5/8 层共 17 点）；
//  2. 四枝各 22 级，枝内第 n 级价 n 点（1+2+…+22 = 253 点满一枝，四枝 1012 点）；
//  3. 点法全手点，不接自动化——先升哪一枝就是这层唯一的策略。
//
// 时间模型沿用 realm-timeline.mjs：结丹倍率 M 把丹炉段按 1/√M、攒灵气段按 1/M 缩；
// 丹道只加出丹，所以只缩丹炉段；返元加灵气，丹炉段按 1/√、攒灵气段按 1/ 缩。
import {
  JINDAN_MILESTONES,
  JINDAN_TREE,
  JINDAN_TREE_MAX,
  JINDAN_TREE_PER_LAYER,
  jindanInsightPerLayer,
  jindanTreeCost,
  LIANQI_UPGRADES,
  PILL_ANCHOR_SECONDS,
  REBIRTH_TREE,
  TREASURES,
} from '../src/game/词条与属性.ts'
import { jindanReturnMult, jindanRitualSeconds } from '../src/game/金丹丹炉.ts'
import { totalBonus } from '../src/game/挑战.ts'
import { exploreCost } from '../src/game/explore.ts'
import { mergeMods, runLife, treeMods, treasureMods, dur } from './life-engine.mjs'

const powerOf = (id) => JINDAN_TREE.find((b) => b.id === id).power

/** 枝内从 lv 升到 lv+1 的价 */
const nextCost = (lv) => jindanTreeCost(lv)
/** 点到 lv 级的累计价 */
const cumulativeCost = (lv) => (lv * (lv + 1)) / 2
/** 手上 points 点最多把这个枝点到几级 */
function maxLevelWith(points) {
  let lv = 0
  while (lv < JINDAN_TREE_MAX && cumulativeCost(lv + 1) <= points) lv++
  return lv
}

const initialLevels = () => Object.fromEntries(JINDAN_TREE.map((b) => [b.id, 0]))

function buyOne(st, id) {
  const lv = st.levels[id]
  if (lv >= JINDAN_TREE_MAX) return false
  const c = nextCost(lv)
  if (st.points < c) return false
  st.points -= c
  st.levels[id] += 1
  return true
}

/**
 * 点法：
 *  - none：不点，当对照；
 *  - <枝 id>：严格优先——只往这一枝里点，点数不够下一级就攒着，点满再轮到第二枝；
 *  - balanced：四枝轮流买“下一级最便宜”的那一格。
 */
function spend(strategy, st) {
  if (strategy === 'none') return
  if (strategy === 'balanced') {
    for (;;) {
      let best = null
      for (const b of JINDAN_TREE) {
        const lv = st.levels[b.id]
        if (lv >= JINDAN_TREE_MAX) continue
        const c = nextCost(lv)
        if (c <= st.points && (best === null || c < best.c)) best = { id: b.id, c }
      }
      if (!best) return
      st.points -= best.c
      st.levels[best.id] += 1
    }
  }
  const order =
    strategy === 'danDao' ? ['danDao', 'fanYuan', 'shiHai', 'luHuo']
    : strategy === 'fanYuan' ? ['fanYuan', 'danDao', 'shiHai', 'luHuo']
    : strategy === 'shiHai' ? ['shiHai', 'fanYuan', 'danDao', 'luHuo']
    : ['luHuo', 'fanYuan', 'danDao', 'shiHai']
  // 严格优先：只碰第一枝还没满的，点数不够就攒着，不往低优先枝漏
  const id = order.find((x) => st.levels[x] < JINDAN_TREE_MAX)
  if (!id) return
  while (buyOne(st, id)) { /* 点到点不动为止 */ }
}

const qiBonus = (st) => 1 + st.levels.fanYuan * powerOf('fanYuan')
const danBonus = (st) => 1 + st.levels.danDao * powerOf('danDao')

// 和 realm-timeline.mjs 同一个锚：法宝收齐 + 根骨各 Lv.8 的一世摸到 1e30
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

const flowLog = endFlowLog10(life30, mods8)
const FURNACE_PHASE = PILL_ANCHOR_SECONDS / 10 ** (flowLog / 2)
const base100 = runLife({ mods: mods8, target: 1e100, capSeconds: Infinity })

/** 已结 k 层时这一世要多久；st 是开局时就该点好的丹纹（实际是每层点一次，见 simulate） */
function lifeSeconds(k, st) {
  const m = jindanReturnMult(k)
  const qi = qiBonus(st)
  const furnace = FURNACE_PHASE / Math.sqrt(m * qi) / danBonus(st)
  // 0.19：攒灵气那一段就是"仪式秒数"——门槛 = 本世产量 × T，所以等多久由 T 说了算，
  // T 又只由层数与丹纹总等级定（每级 −1%，封底一半）。
  // 注意：门槛与产量同比例涨，所以返元/丹道那点产出加成**不会**缩短等待——能缩短的只有总等级。
  const total = JINDAN_TREE.reduce((a, b) => a + (st.levels[b.id] ?? 0), 0)
  return furnace + jindanRitualSeconds(k + 1, total)
}

/** 结算这一层到手的丹纹点：每层底数 + 这一层里程碑那几笔 */
function pointsForLayer(layer) {
  let gain = JINDAN_TREE_PER_LAYER
  for (const ms of JINDAN_MILESTONES) {
    if (ms.layer === layer) gain += ms.marks ?? 0
  }
  return gain
}

/** 一层一层结：先按当前丹纹算这一世，结完给点，再按点法花掉。 */
function simulate(strategy, layers) {
  const st = { levels: initialLevels(), points: 0 }
  let t = 0
  let insight = 0
  const marks = []
  for (let k = 0; k < layers; k++) {
    t += lifeSeconds(k, st)
    insight += jindanInsightPerLayer(st.levels)
    st.points += pointsForLayer(k + 1)
    spend(strategy, st)
    if ([1, 3, 5, 8, 12, 20, 50, 100, 200, 405, 1000].includes(k + 1)) {
      marks.push({ layer: k + 1, t, insight, points: st.points, levels: { ...st.levels } })
    }
  }
  const push = base100.t / (jindanReturnMult(layers) * qiBonus(st))
  return { strategy, layers, t, insight, push, total: t + push, st, marks }
}

const fmtLevels = (lv) => JINDAN_TREE.map((b) => `${b.name}${lv[b.id] ?? 0}`).join(' · ')
const fmtPct = (x) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`

console.log('【丹纹树】结丹每层 1 点；四枝各 22 级，第 n 级价 n 点；满一枝 253 点，四枝 1012 点')
for (const b of JINDAN_TREE) console.log(`  ${b.name}：${b.effect}（满级 ${JINDAN_TREE_MAX} 级）`)
console.log(
  `  里程碑加点：${JINDAN_MILESTONES.map((m) => `第 ${m.layer} 层 +${m.marks ?? 0}`).join(' · ')}` +
    ` · 结到第 8 层共 ${8 + JINDAN_MILESTONES.reduce((a, m) => a + (m.marks ?? 0), 0)} 点`,
)
const baseRun = simulate('none', 405)
console.log(`  当前时间锚：首丹 ${dur(T0)}（丹炉段 ${dur(FURNACE_PHASE)}）· 405 层约 ${(baseRun.t / 3600).toFixed(2)} 小时`)
console.log(`  支点：不加丹纹的一世摸到 1e100 要 1e${Math.log10(base100.t / (365.25 * 86400)).toFixed(0)} 年`)

console.log('\n【点数从哪来】405 层给 405 + 17 = 422 点，1000 层给 1017 点')
for (const m of baseRun.marks.filter((x) => x.layer <= 405)) {
  const earned = m.layer + JINDAN_MILESTONES.filter((ms) => ms.layer <= m.layer).reduce((a, ms) => a + (ms.marks ?? 0), 0)
  console.log(
    `  第 ${String(m.layer).padStart(3)} 层：累计 ${dur(m.t).padStart(9)} · 累计 ${String(earned).padStart(3)} 点 · 单枝最多点到 ${maxLevelWith(earned)} 级`,
  )
}

const HEAD405 = '【405 层 · 五种点法分别点到什么程度】422 点 = 一枝点满(253) + 另一枝 17 级(153)，余 16 点攒着等下一级(18)'
console.log('\n' + HEAD405)
const strategies = [
  ['none', '不点'],
  ['fanYuan', '返元优先'],
  ['danDao', '丹道优先'],
  ['shiHai', '识海优先'],
  ['luHuo', '炉火优先'],
  ['balanced', '四枝轮点'],
]
const runs405 = strategies.map(([id]) => simulate(id, 405))
for (const r of runs405) {
  const label = strategies.find(([id]) => id === r.strategy)[1]
  console.log(
    `  ${label.padEnd(5, '　')}：${fmtLevels(r.st.levels).padEnd(34)}` +
      `灵气 ${fmtPct(qiBonus(r.st) - 1).padStart(4)} · 出丹 ${fmtPct(danBonus(r.st) - 1).padStart(4)}` +
      ` · 废渣 ${fmtPct(r.st.levels.luHuo * powerOf('luHuo')).padStart(4)} · 见识 ${String(Math.round(r.insight)).padStart(4)}` +
      ` · 405 层 ${(r.t / 3600).toFixed(2)} 小时`,
  )
}

console.log('\n【1000 层 · 四枝全满还剩多少】1017 点，四枝全满要 1012 点')
const runs1000 = ['fanYuan', 'shiHai', 'balanced'].map((s) => simulate(s, 1000))
for (const r of runs1000) {
  const label = r.strategy === 'balanced' ? '四枝轮点' : r.strategy === 'fanYuan' ? '返元优先' : '识海优先'
  console.log(
    `  ${label}：${fmtLevels(r.st.levels)} · 剩 ${r.st.points} 点 · 累计 ${(r.t / 3600).toFixed(2)} 小时 · 见识 ${Math.round(r.insight)}`,
  )
}

// 鉴宝台的门槛与满额：四条线各 24 级的总价（从 0 级买起，逐级 exploreCost）
const bench = (lv) => exploreCost(lv)
const benchGate = 4 * [0, 1, 2, 3, 4, 5].reduce((a, lv) => a + bench(lv), 0) // 四条各 6 级 = 合计 24 级
const benchFull = 4 * Array.from({ length: 24 }, (_, lv) => bench(lv)).reduce((a, b) => a + b, 0)
console.log('\n【自动见识够不够】结丹给的基础见识 vs 鉴宝台价目')
console.log(`  鉴宝台代买门槛（四条各 6 级，合计 24 级）约 ${benchGate} 见识；四条各 24 级全满约 ${benchFull} 见识`)
for (const r of runs405) {
  const label = strategies.find(([id]) => id === r.strategy)[1]
  const ratio = (r.insight / benchFull) * 100
  console.log(
    `  ${label.padEnd(5, '　')}：405 层共 ${String(Math.round(r.insight)).padStart(4)} 见识` +
      ` · 够门槛 ${(r.insight / benchGate).toFixed(1)} 遍 · 占满额 ${ratio.toFixed(2)}%`,
  )
}

console.log(`\n【返元每级给多少才不碰 ${(baseRun.t / 3600).toFixed(1)} 小时】返元优先、405 层、只改每级加成`)
for (const p of [0.01, 0.02, 0.03, 0.04, 0.05]) {
  // 临时把返元 power 换掉再跑一遍
  const def = JINDAN_TREE.find((b) => b.id === 'fanYuan')
  const old = def.power
  def.power = p
  const r = simulate('fanYuan', 405)
  def.power = old
  console.log(
    `  每级 ${fmtPct(p).padStart(4)}（满级 ${fmtPct(p * 22).padStart(4)}）：405 层 ${(r.t / 3600).toFixed(2)} 小时` +
      ` · 比不点少 ${((1 - r.t / baseRun.t) * 100).toFixed(1)}%`,
  )
}

console.log('\n【四枝全点的账进总轴】不走私房倍率，和挑战、里程碑、成就并进同一本')
const bareCounters = {
  pillLevels: {},
  spirits: {},
  pulls: 0,
  jindan: 0,
  insightEarned: 0,
  explores: 0,
  pointsEarned: 0,
  rootLevels: 0,
  benchLevels: 0,
  treasures: 0,
  qiLog10: 0,
}
const fullTree = Object.fromEntries(JINDAN_TREE.map((b) => [b.id, JINDAN_TREE_MAX]))
const treeOnly = totalBonus({ ...bareCounters, jindanTree: fullTree })
console.log(
  `  四枝全满（不带挑战/成就）：出丹 ${fmtPct(treeOnly.danAdd ?? 0)} · 灵气产出 ${fmtPct(treeOnly.energyAdd ?? 0)}` +
    ` · 废渣 ×${(treeOnly.dregMul ?? 1).toFixed(2)}（识海不占轴，直接进见识）`,
)

console.log('\n【结论】')
console.log('  1. 前段很轻：第 20 层累计约 0.68 小时、第 100 层约 3.7 小时；422 点里约 385 点落在最后四分之一。')
console.log('  2. 0.19 起丹纹缩的是"仪式秒数"（每级 −1%，封底一半），而总等级只认级数、不认喂在哪枝，')
console.log('     所以四枝轮点（总级最多）最快：12.56h vs 一主一副 15.62h vs 不点 20.77h。')
console.log('  3. 识海优先把 405 层的结丹见识抬到一千六百多，仍只是鉴宝台满额的千分之几，不会一次买穿。')
console.log('  4. 四枝全满要 1012 点，正好落在 1000 层附近：405 层是"一主一副"，1000 层才谈"全满"。')
console.log('  5. 完全不点也不是走不动：每层 2～4.5 分钟、405 层 20.8 小时（`sim/jindan-balance-audit.mjs` 盯着这条）。')
