// 金丹这三张表（挑战 / 结丹里程碑 / 加属性成就）的回归检查。
// 表与判定一律 import 运行时那两份（src/game/词条与属性.ts 与 src/game/挑战.ts），sim 里不留第二份表。
//
// 用法：node --import ./sim/ts-hook.mjs sim/challenge-check.mjs
// 盯四件事：
//   ① 五档挑战的落点：按运行时那套贪心买法，各档流量要挂多久才摸得到那一格
//   ② 每条好处只咬自己那条轴，别把另一条重算一遍
//   ③ 达成不可回退：往那几笔累计里加量，已达成的一条不会又锁回去
//   ④ 废渣赔率被这些表整体乘大之后，火候三档的凹性还在（中间那格不许被压死）
import {
  ACHIEVEMENTS,
  CHALLENGES,
  JINDAN_MILESTONES,
  PILL_MODES,
  SPIRITS,
  findPillMode,
  noBonus,
} from '../src/game/词条与属性.ts'
import { bustChance, danYieldMult, dregYieldMult, pullMaxCount, rollSpirit } from '../src/game/凝练.ts'
import { achievementUnlocked, challengeMark, challengeUnlocked, milestoneUnlocked, totalBonus } from '../src/game/挑战.ts'
import { runPillLife, DAN_IDS, PILL_IDS, QI_SHAPE } from './pill-life.mjs'
import { dur } from './life-engine.mjs'

/** 空账一本：所有累计都从 0 起，也就是"金丹刚开张"的那个玩家 */
const ZERO = {
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
  qiLog10: -Infinity,
}

/** 结丹线之前的贪心和运行时那颗一键购买同一条口径：过线之前只买丹炉与火候 */
const OPT = { shift: 0, ids: DAN_IDS, afterGate: PILL_IDS, qiShape: QI_SHAPE.add }

/** 二分：这一档流量按贪心买法，predicate 第一次成立时的预算（秒）；顶到 hi 还不成立就报 ∞ */
function timeTo(predicate, o = {}, hi = 3e12) {
  if (!predicate(runPillLife({ ...OPT, ...o, budget: hi }))) return Infinity
  let lo = 0
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (predicate(runPillLife({ ...OPT, ...o, budget: mid }))) hi = mid
    else lo = mid
  }
  return hi
}

/**
 * 挂 T 秒抽得起几次。渣/秒 = 炼成速率 × 炸炉率 × 赔率（常态那档实测 0.27 炉渣/炉），
 * 抽卡价按"见过的最高出丹流量"定标——这条链上的加成还没达成，所以定价用空账那一本。
 */
function pullsIn(seconds, rate, anchorLog, spirits) {
  const mode = findPillMode('steady')
  const have = Math.log10(rate * seconds * bustChance(mode, spirits) * dregYieldMult(mode, spirits))
  const flow = anchorLog + Math.log10(danYieldMult(spirits))
  return pullMaxCount(0, have, flow)
}

/** 一路抽到"任意 of 道各 each 级"要抽几次：掷的是运行时那串确定性序列，取三个种子的中位数 */
function pullsForSpirits(each, of, seeds = [7, 99, 2026]) {
  const runs = seeds.map((start) => {
    const levels = {}
    let seed = start
    let n = 0
    for (; n < 1e6; n++) {
      if (SPIRITS.reduce((a, d) => a + ((levels[d.id] ?? 0) >= each ? 1 : 0), 0) >= of) break
      const hit = rollSpirit(seed, levels)
      levels[hit.def.id] = hit.level
      seed = hit.seed
    }
    return n
  })
  return Math.round(runs.sort((a, b) => a - b)[runs.length >> 1])
}

const FLOWS = [
  ['定标（炉 12 = 12 小时）', 1e24],
  ['灵气/秒 1e26', 1e26],
  ['灵气/秒 1e28', 1e28],
  ['终局 1e30', 1e30],
]

console.log('【五档挑战的落点】按运行时那套贪心买法，各档流量要挂多久')
console.log(`  结过 n 层丹之后，这一世的灵气/秒 ≈ 定标流量 × jindanReturnMult(n)；左列仍是各档的实际流量`)
console.log(`  ${''.padEnd(30)}${FLOWS.map(([name]) => name.padStart(13)).join('')}`)
for (const def of CHALLENGES) {
  const need = def.need
  const cells = FLOWS.map(([, flow]) => {
    if (need.kind === 'pill') {
      const t = timeTo((r) => r.lv[need.line] >= need.level, { flowBase: flow })
      return Number.isFinite(t) ? dur(t) : '∞'
    }
    const want = need.kind === 'pulls' ? need.count : pullsForSpirits(need.each, need.of)
    const ok = (b) => {
      const r = runPillLife({ ...OPT, flowBase: flow, budget: b })
      return pullsIn(b, r.rate, r.anchorLog, {}) >= want
    }
    if (!ok(3e12)) return '∞'
    let lo = 0
    let hi = 3e12
    for (let i = 0; i < 45; i++) {
      const mid = (lo + hi) / 2
      if (ok(mid)) hi = mid
      else lo = mid
    }
    return need.kind === 'pulls' ? dur(hi) : `${dur(hi)}（抽 ${want} 次）`
  })
  console.log(`  ${def.name} ${def.hint.padEnd(22)}${cells.map((v) => v.padStart(13)).join('')}`)
}

console.log('\n【好处各归各的轴】一本账一本账地开，看每条好处是不是只咬自己那一条')
const probes = [
  ['谁都没达成', {}],
  ['只结到第 8 层', { jindan: 8 }],
  ['只有三条线炼满', { pillLevels: { danLu: 99, huoHou: 99, danFang: 99 } }],
  ['只把转盘抽到底（连带百转成渣那条挑战）', { pulls: 1e6 }],
  ['只把七道精神参悟到底', { spirits: Object.fromEntries(SPIRITS.map((s) => [s.id, 99])) }],
  ['加属性成就全开（抽数那几条顺带咬合）', { qiLog10: 40, pulls: 1e6, explores: 99, jindan: 40, rootLevels: 99, benchLevels: 99, treasures: 7 }],
]
for (const [label, part] of probes) {
  const b = totalBonus({ ...ZERO, ...part })
  console.log(
    `  ${label.padEnd(34)} 出丹 +${(b.danAdd * 100).toFixed(0)}%  返哺 +${(b.qiAdd * 100).toFixed(0)}%  ` +
      `灵气 +${(b.energyAdd * 100).toFixed(0)}%  渣 ×${b.dregMul.toFixed(2)}  折点 ×${b.passMul.toFixed(2)}`,
  )
}

const ALL = totalBonus({
  ...ZERO,
  pillLevels: { danLu: 99, huoHou: 99, danFang: 99 },
  pulls: 1e6,
  spirits: Object.fromEntries(SPIRITS.map((s) => [s.id, 99])),
  jindan: 99,
  insightEarned: 1e4,
  explores: 1e4,
  pointsEarned: 1e6,
  qiLog10: 99,
})
console.log(
  `\n【全开的总账】出丹 +${Math.round(ALL.danAdd * 100)}% · 丹炼回灵气 +${Math.round(ALL.qiAdd * 100)}%` +
    ` · 灵气产出 +${Math.round(ALL.energyAdd * 100)}% · 废渣 ×${ALL.dregMul.toFixed(2)} · 每秒折点 ×${ALL.passMul.toFixed(2)}`,
)

console.log('\n【不可回退】累计只往上加，已达成的一条不该在下一步又锁回去')
const LOW = { ...ZERO, pillLevels: { danLu: 13, huoHou: 18, danFang: 35 }, pulls: 150, jindan: 3, qiLog10: 33, explores: 30, spirits: Object.fromEntries(SPIRITS.map((s) => [s.id, 20])), rootLevels: 40, benchLevels: 24, treasures: 3 }
const HIGH = { ...LOW, pillLevels: { danLu: 30, huoHou: 30, danFang: 40 }, pulls: 900, jindan: 12, insightEarned: 400, rootLevels: 80, benchLevels: 60, treasures: 7 }
let regress = []
for (const def of CHALLENGES) {
  if (challengeUnlocked(def, LOW) && !challengeUnlocked(def, HIGH)) regress.push(`挑战 ${def.name}`)
}
for (const def of JINDAN_MILESTONES) {
  if (milestoneUnlocked(def, LOW) && !milestoneUnlocked(def, HIGH)) regress.push(`里程碑 第 ${def.layer} 层`)
}
for (const def of ACHIEVEMENTS.filter((d) => d.bonus)) {
  if (achievementUnlocked(def, LOW) && !achievementUnlocked(def, HIGH)) regress.push(`成就 ${def.name}`)
}
console.log(`  ${regress.length ? '✗ 退回去的：' + regress.join('、') : '✓ 一条都没退'}`)

console.log('\n【中间那格不许被压死】废渣赔率被这三张表整体乘大，凹性该一点不动')
const mult = ALL.dregMul
console.log(`  乘的是全开那本账：废渣 ×${mult.toFixed(2)}`)
const edge = PILL_MODES.map((m) => ({
  dan: m.yieldMult * (1 - bustChance(m, {})),
  zha: bustChance(m, {}) * dregYieldMult(m, {}) * mult,
}))
for (const [i, m] of PILL_MODES.entries()) {
  console.log(`  ${m.name}  炸炉 ${(bustChance(m, {}) * 100).toFixed(0)}%  →  期望丹 ${edge[i].dan.toFixed(3)} 炉 · 期望渣 ${edge[i].zha.toFixed(3)} 炉`)
}
const marginal = []
for (let i = 1; i < edge.length; i++) marginal.push((edge[i - 1].dan - edge[i].dan) / (edge[i].zha - edge[i - 1].zha))
const concave = marginal.every((v, j) => j === 0 || v > marginal[j - 1])
console.log(`  1 渣要几炉丹：${marginal.map((v) => v.toFixed(2)).join(' → ')}  一路变贵 = ${concave ? '✓' : '✗ 中间那格被压死了'}`)

console.log('\n【里程碑的台阶】')
for (const def of JINDAN_MILESTONES) {
  console.log(`  第 ${String(def.layer).padStart(2)} 层 ${def.reward.padEnd(22)} 结到就达成 = ${milestoneUnlocked(def, { ...ZERO, jindan: def.layer }) ? '✓' : '✗'}`)
}
const clean = totalBonus(ZERO)
console.log(`\n  空账上一档都不该生效：${clean.danAdd === 0 && clean.qiAdd === 0 && clean.energyAdd === 0 && clean.dregMul === 1 && clean.passMul === 1 ? '✓' : '✗ 有白给没门槛就咬合了'}`)
console.log(`  和 noBonus() 同一本起点账：${JSON.stringify(clean) === JSON.stringify(noBonus()) ? '✓' : '✗'}`)
console.log(`  加属性成就那 ${ACHIEVEMENTS.filter((d) => d.bonus).length} 条：${ACHIEVEMENTS.filter((d) => d.bonus).map((d) => `${d.name}[${d.metric} ${d.need}] ${d.desc}`).join(' · ')}`)
console.log(`  挑战在高构筑那本的刻度：${CHALLENGES.map((d) => `${d.name} ${JSON.stringify(challengeMark(d.need, HIGH))}`).join(' · ')}`)
