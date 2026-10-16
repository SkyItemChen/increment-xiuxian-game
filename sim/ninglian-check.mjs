// 凝练这条链的回归检查：跑的仍是运行时那套式子（src/game/凝练.ts 与 词条与属性.ts），sim 里不镜像表。
// 用法：node --import ./sim/ts-hook.mjs sim/ninglian-check.mjs
// 盯五件事：① 三档火候只是"丹换废渣"的汇率，不存在一档压死另两档
// ② 守一把炸炉率压到地板就停，废渣这条线不会被一条精神整个关掉
// ③ 转盘权重摊成一整圈，且抽出来的分布对得上权重
// ④ 抽卡价按 ×1.15 涨：抽得起多少写得很直白，长线不会一天见底
// ⑤ 七道精神各归各的轴，谁也没把另一条轴重算一遍
import {
  BUST_FLOOR,
  PILL_MODES,
  PULL_BASE_SECONDS,
  PULL_GROWTH,
  SPIRITS,
  findPillMode,
} from '../src/game/词条与属性.ts'
import {
  autoBuyInterval,
  bustChance,
  danYieldMult,
  dregYieldMult,
  pullBulkCostLog10,
  pullCostLog10,
  pullMaxCount,
  qiAxisAdd,
  rollSpirit,
  spiritMul,
} from '../src/game/凝练.ts'

const NO = {}

console.log('【三档火候的汇率】一炉该出的丹记 1，看每一档平均落下的丹与渣')
const rows = PILL_MODES.map((m) => {
  const bust = bustChance(m, NO)
  const dreg = dregYieldMult(m, NO)
  return { m, yield: m.yieldMult, bust, dan: m.yieldMult * (1 - bust),渣: bust * dreg }
})
for (const r of rows) {
  console.log(
    `  ${r.m.name}  出丹 ×${r.yield.toFixed(2)}  炸炉 ${(r.bust * 100).toFixed(0)}%  →  ` +
      `期望丹 ${r.dan.toFixed(3)} 炉 · 期望渣 ${r.渣.toFixed(3)} 炉`,
  )
}

console.log('\n【边际汇率】换到下一档要拿多少丹去换渣——一路变贵，中间那格才没被压死')
const steps = []
for (let i = 1; i < rows.length; i++) {
  const dDan = rows[i - 1].dan - rows[i].dan
  const dDreg = rows[i].渣 - rows[i - 1].渣
  steps.push(dDan / dDreg)
  console.log(
    `  ${rows[i - 1].m.name} → ${rows[i].m.name}：少 ${dDan.toFixed(3)} 炉丹、多 ${dDreg.toFixed(3)} 炉渣` +
      `  ⇒ 1 渣要 ${steps[steps.length - 1].toFixed(2)} 炉丹`,
  )
}
// 火候随时能换，所以"半档静点半档狂躁"是玩家真做得出来的混合。
// 只要每多要一份渣付的丹变便宜，中间那档就落在混合线的下方＝白摆的一格。
const concave = steps.every((v, i) => i === 0 || v > steps[i - 1])
const monotone = rows.every((r, i) => i === 0 || (r.dan < rows[i - 1].dan && r.渣 > rows[i - 1].渣))
console.log(`  丹一路减、渣一路增 = ${monotone ? '✓' : '✗ 有一档连这条都不满足'}`)
console.log(
  `  1 渣的价钱一路变贵 = ${concave ? '✓ 中间那档买得着' : '✗ 混合静心和狂躁就能压死中间那档，改表'}`,
)

// 守一从 0 级一路叠到压平三档：每一层都重算一遍这三个点，逐层都要是凹的
function frontier(levels) {
  const pts = PILL_MODES.map((m) => {
    const bust = bustChance(m, levels)
    return { dan: m.yieldMult * (1 - bust), 渣: bust * dregYieldMult(m, levels) }
  })
  const price = (a, b) => (a.dan - b.dan) / (b.渣 - a.渣)
  const p1 = price(pts[0], pts[1])
  const p2 = price(pts[1], pts[2])
  const ok = pts[1].dan < pts[0].dan && pts[1].渣 > pts[0].渣 && p2 > p1 && p1 > 0
  return { p1, p2, ok }
}
console.log('\n【逐层复核】守一每一级下的三档前沿，价钱（丹/渣）必须两段都在、且后段更贵')
let bad = 0
for (let lv = 0; lv <= 20; lv++) {
  const f = frontier({ shouYi: lv })
  if (!f.ok) bad += 1
  if (lv % 2 === 0 || !f.ok) {
    console.log(
      `  守一 Lv.${String(lv).padStart(2)}  1 渣：静心→常态 ${f.p1.toFixed(2)} 丹 · 常态→狂躁 ${f.p2.toFixed(2)} 丹` +
        `  ${f.ok ? '✓' : '✗ 中间那格被混着炼压死了'}`,
    )
  }
}
console.log(`  二十一层里压死的层数：${bad}${bad === 0 ? ' ✓ 任何守一进度下三档都各有用处' : ' ✗ 改表'}`)

console.log('\n【守一的地板】炸炉压到底也不归零，转盘始终有门票')
for (const m of PILL_MODES) {
  const line = []
  for (const lv of [0, 1, 2, 4, 6, 8, 12]) line.push(`${lv}:${(bustChance(m, { shouYi: lv }) * 100).toFixed(1)}%`)
  console.log(`  ${m.name}（底子 ${(m.bust * 100).toFixed(0)}%）  ${line.join('  ')}   地板 ${(BUST_FLOOR * 100).toFixed(0)}%`)
}

console.log('\n【回甘与武火】都是加法，级数乘上去，不碰别的轴')
for (const lv of [0, 5, 10, 20]) {
  const m = findPillMode('wild')
  console.log(
    `  Lv.${String(lv).padStart(2)}  出丹 ×${danYieldMult({ wuHuo: lv }).toFixed(2)}` +
      `   狂躁那一炸赔 ${dregYieldMult(m, { huiGan: lv }).toFixed(2)} 炉`,
  )
}

console.log('\n【转盘权重】七道摊成一整圈，抽两万次的频率该和权重对得上')
const total = SPIRITS.reduce((a, d) => a + d.weight, 0)
let seed = 0x1234abc
const counts = Object.fromEntries(SPIRITS.map((d) => [d.id, 0]))
for (let i = 0; i < 20000; i++) {
  const r = rollSpirit(seed, NO)
  seed = r.seed
  counts[r.def.id] += 1
}
const rel = []
for (const d of SPIRITS) {
  const want = d.weight / total
  const got = counts[d.id] / 20000
  rel.push(Math.abs(got - want) / want)
  console.log(
    `  ${d.name}  权重 ${String(d.weight).padStart(2)} 该 ${(want * 100).toFixed(1)}%` +
      `   实测 ${(got * 100).toFixed(1)}%  差 ${(((got - want) / want) * 100).toFixed(1)}%`,
  )
}
// 两万掷的抽样噪声：p=0.08 那道约 ±2.4%（绝对），换算成相对偏差就是 ±30%。
// 这条线只用来抓"权重整个接错"级别的错，不拿单次种子的运气当回归。
const worst = Math.max(...rel)
console.log(
  `  最大相对偏差 ${(worst * 100).toFixed(1)}% = ${worst < 0.3 ? '✓ 在抽样噪声内（换种子会晃，别当 bug）' : '✗ 权重接错了'}`,
)

console.log('\n【抽满 cap】敏手与定息各有顶，抽到顶还收废渣、等级不动')
// 直接把这道摆到顶上，再连掷两万下：落到它头上的那些次该全部报 maxed，且等级一格不动
for (const id of ['minShou', 'dingXi']) {
  const def = SPIRITS.find((d) => d.id === id)
  const s = { [id]: def.cap }
  let hit = 0
  let maxed = 0
  for (let i = 0; i < 20000; i++) {
    const r = rollSpirit(seed, s)
    seed = r.seed
    if (r.def.id !== id) continue
    hit += 1
    if (r.maxed && r.level === def.cap) maxed += 1
  }
  console.log(
    `  ${def.name} 顶 Lv.${def.cap}：两万掷里落到它头上 ${hit} 次（该 ${((def.weight / total) * 20000).toFixed(0)} 次），` +
      `其中报 maxed、等级还是 Lv.${def.cap} 的 ${maxed} 次${hit === maxed ? ' ✓ 全中' : ' ✗ 有漏'}`,
  )
}

console.log('\n【抽卡价】第 N 次要多少废渣（按"半秒出丹流量"定标，×1.15 往上爬）')
const FLOW = Math.log10(1e23)
for (const n of [1, 10, 30, 60, 100, 200]) {
  const one = pullCostLog10(n - 1, FLOW)
  const all = pullBulkCostLog10(n, 0, FLOW)
  console.log(
    `  第 ${String(n).padStart(3)} 次 1e${one.toFixed(2)} 渣` +
      `   前 ${String(n).padStart(3)} 次共 1e${all.toFixed(2)} 渣` +
      `   第 ${n} 次是起步价的 ${Math.pow(PULL_GROWTH, n - 1).toExponential(2)} 倍（起步 = ${PULL_BASE_SECONDS} 秒出丹流量）`,
  )
}
// 只抽一次时"前 N 次共"必须正好等于"第 N 次"，否则连抽比单抽贵，是定价写歪了
const single = pullCostLog10(0, FLOW) === pullBulkCostLog10(1, 0, FLOW)
console.log(`  首抽单抽价 = 连抽 1 次总价 → ${single ? '✓' : '✗ 连抽口径与单抽不一致'}`)
// 抽得起几次：手上 1000 倍起步价，看能连抽多远
for (const have of [1, 10, 100, 1000, 1e6]) {
  const n = pullMaxCount(0, Math.log10(have * PULL_BASE_SECONDS * 1e23), FLOW)
  console.log(`  手上 ${have} 倍起步价的渣 → 一次能抽 ${n} 下（×${PULL_GROWTH}/次 的墙在这儿）`)
}

console.log('\n【各归各的轴】通灵叠进丹房那条加法、养气与敏手/定息各管一条，谁也没重算谁')
const lv = { tongLing: 4, danFang: 7, minShou: 2, dingXi: 20, shouYi: 3, wuHuo: 5, huiGan: 6 }
console.log(`  灵气加法轴：丹房 7 级 + 通灵 4 级 = ${qiAxisAdd({ danFang: 7 }, { tongLing: 4}).toFixed(2)}（该是 0.35+0.20=0.55）`)
console.log(`  代买间隔：0.2 秒 ÷ 敏手 Lv.2 = ${autoBuyInterval(lv, 0.2).toFixed(3)} 秒（地板 0.05）`)
console.log(`  按秒折点：定息 Lv.20 = ×${spiritMul(lv, 'pass-add').toFixed(1)}，Lv.30 也还是 ×${spiritMul({ ...lv, dingXi: 30 }, 'pass-add').toFixed(1)}（cap 咬住了）`)
console.log(`  出丹：武火 Lv.5 = ×${danYieldMult(lv).toFixed(2)} · 狂躁那一炸赔 ${dregYieldMult(findPillMode('wild'), lv).toFixed(2)} 炉`)
