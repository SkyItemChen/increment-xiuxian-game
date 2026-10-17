// 元婴的价目表与凹性：三档元神、三档斗法、神念建筑、神悟台/斗战胜悟、metaMult。
// 全部 import src/game/元婴.ts 的真实表，不在 sim 里另抄一份。
//
// 用法：node --import ./sim/ts-hook.mjs sim/yuan-gear-check.mjs
import {
  YUAN_MODES, FIGHT_MODES, SHENWU_LINES, FIGHT_INSIGHT_LINES,
  YUAN_BUILDING_COST_GROWTH, SHENWU_COST_GROWTH, GENERAL_COST_GROWTH, FIGHT_INSIGHT_COST_GROWTH,
  SHENNIAN_BASE, SHENNIAN_GROWTH,
  yuanBuildingCost, shenWuCost, generalCost, fightInsightCost, geometricCost,
  shenNianPerSecond, metaMultOf, warSoulPerSecond, fightWaveCap, warSoulPerKill,
} from '../src/game/元婴.ts'

const HOUR = 3600
const DAY = 86400
const fmt = (x) => (x >= 1e6 ? x.toExponential(2) : x.toFixed(2))
const dur = (s) => {
  if (!Number.isFinite(s)) return '∞'
  if (s < 60) return `${s.toFixed(1)} 秒`
  if (s < 3600) return `${(s / 60).toFixed(1)} 分`
  if (s < DAY) return `${(s / 3600).toFixed(2)} 小时`
  if (s < 365 * DAY) return `${(s / DAY).toFixed(2)} 天`
  return `${(s / (365 * DAY)).toExponential(2)} 年`
}

/* ------------------------------------------------------------ 元神三档凹性 */

console.log('【元神三档凹性】每多要 1 点元神，付出的留存资源必须更贵')
console.log('  档位        元神倍率   丹留守  渣留守  返哺留守')
for (const m of YUAN_MODES) {
  console.log(`  ${m.name.padEnd(4)}  ×${m.yuanMul.toFixed(2).padStart(5)}    ${(m.danKeep * 100).toFixed(0).padStart(3)}%   ${(m.dregKeep * 100).toFixed(0).padStart(3)}%   ${(m.qiKeep * 100).toFixed(0).padStart(3)}%`)
}

function marginalPairs(modes, keys) {
  const out = []
  for (let i = 1; i < modes.length; i++) {
    const a = modes[i - 1]
    const b = modes[i]
    const dy = b.yuanMul - a.yuanMul
    out.push({ from: a.name, to: b.name, dy, cost: Object.fromEntries(keys.map((k) => [k, (a[k] - b[k]) / dy])) })
  }
  return out
}

const RES = ['danKeep', 'dregKeep', 'qiKeep']
const RES_NAME = { danKeep: '丹', dregKeep: '渣', qiKeep: '返哺' }
const pairs = marginalPairs(YUAN_MODES, RES)
for (const [i, p] of pairs.entries()) {
  const parts = RES.map((k) => `${RES_NAME[k]} ${p.cost[k].toFixed(3)}`)
  console.log(`  ${p.from} → ${p.to}：多 ${p.dy.toFixed(1)} 倍元神，边际代价 ${parts.join(' · ')}`)
  if (i > 0) {
    const prev = pairs[i - 1]
    for (const k of RES) {
      const ok = p.cost[k] > prev.cost[k]
      if (!ok) console.log(`    ✗ ${RES_NAME[k]} 的边际代价没有走高（${prev.cost[k].toFixed(3)} → ${p.cost[k].toFixed(3)}）`)
    }
  }
}
const allRising = pairs.slice(1).every((p, i) => RES.every((k) => p.cost[k] > pairs[i].cost[k]))
console.log(`  结论：${allRising ? '✓ 三档严格凹，夺舍拿 3.20 是可行的最猛一档' : '✗ 不凹，必须改倍率'}`)

console.log('\n【反例】设计稿的夺舍 ×4.50 与 55% 凝魄留存')
const bad = YUAN_MODES.map((m) => (m.id === 'duoShe' ? { ...m, yuanMul: 4.5 } : m))
const badPairs = marginalPairs(bad, RES)
for (const [i, p] of badPairs.entries()) {
  console.log(`  ${p.from} → ${p.to}：丹 ${p.cost.danKeep.toFixed(3)} · 渣 ${p.cost.dregKeep.toFixed(3)} · 返哺 ${p.cost.qiKeep.toFixed(3)}`)
  if (i > 0) {
    const prev = badPairs[i - 1]
    const fails = RES.filter((k) => p.cost[k] <= prev.cost[k]).map((k) => RES_NAME[k])
    console.log(`    ${fails.length ? `✗ ${fails.join('、')} 的边际代价反而下降` : '✓'}`)
  }
}
console.log('  数学上：凝魄→夺舍多给 2.3 倍元神，却只多付 35% 丹，边际代价 0.292 → 0.152。')
console.log('  要让 4.50 也凹，凝魄倍率至少要到 2.75，31h 的目标同时作废。二选一，优先凹性。')

/* ------------------------------------------------------------ 斗法三档凹性 */

console.log('\n【斗法三档凹性】每多要 1 点战魂，分走的元神流量必须更贵')
console.log('  档位        战魂倍率   元神分流')
for (const m of FIGHT_MODES) {
  console.log(`  ${m.name.padEnd(4)}  ×${m.warMul.toFixed(2).padStart(5)}    ${(m.yuanDrain * 100).toFixed(0).padStart(3)}%`)
}
let prevCost = -1
let fightConcave = true
for (let i = 1; i < FIGHT_MODES.length; i++) {
  const a = FIGHT_MODES[i - 1]
  const b = FIGHT_MODES[i]
  const cost = (b.yuanDrain - a.yuanDrain) / (b.warMul - a.warMul)
  const ok = cost > prevCost
  if (!ok) fightConcave = false
  console.log(`  ${a.name} → ${b.name}：多 ${(b.warMul - a.warMul).toFixed(1)} 倍战魂，边际分流 ${cost.toFixed(3)} ${ok ? '✓' : '✗'}`)
  prevCost = cost
}
console.log(`  结论：${fightConcave ? '✓ 三档凹' : '✗ 不凹'}；死战把大突破时间拉长 1/(1−0.30)=1.43 倍`)

/* ------------------------------------------------------------ 神念建筑 */

console.log('\n【神念建筑】造价 ×1.7/级，产量 ×1.15/级；下一级要等的时间按 1.48 倍走')
console.log('  等级   下一级造价   神念/秒     本级要挂')
for (const lv of [0, 1, 2, 5, 10, 13, 15, 20, 25, 30, 35, 40]) {
  const cost = yuanBuildingCost(lv)
  const prod = shenNianPerSecond(lv)
  console.log(
    `  Lv.${String(lv).padStart(2)}  ${fmt(cost).padStart(10)}  ${prod.toFixed(4).padStart(8)}   ${dur(cost / prod).padStart(10)}`,
  )
}
console.log(`  Lv.0 自带 ${SHENNIAN_BASE}/秒，第一级 20 秒就能买；否则这条线没有启动资金。`)

/** 只买建筑、事件驱动跳到买得起的瞬间，看 62 小时能到几级 */
function buildingAfter(seconds) {
  let lv = 0
  let t = 0
  while (t < seconds) {
    const cost = yuanBuildingCost(lv)
    const wait = cost / shenNianPerSecond(lv)
    if (!Number.isFinite(wait) || t + wait > seconds) break
    t += wait
    lv++
  }
  return { lv, t, remain: seconds - t, prod: shenNianPerSecond(lv) }
}
for (const h of [14, 62, 24 * 30]) {
  const r = buildingAfter(h * HOUR)
  console.log(`  挂 ${String(h).padStart(3)} 小时：建筑 Lv.${r.lv} · 产量 ${r.prod.toFixed(3)} 神念/秒 · 本级已挂 ${dur(r.t)}`)
}
console.log(`  对照：斗战胜悟第一条 Lv.5 的累计价 ${Array.from({ length: 5 }, (_, i) => fightInsightCost(i)).reduce((a, b) => a + b, 0)} 神念`)

/* ------------------------------------------------------------ 神悟台 / 战悟 */

console.log('\n【神悟台】花元婴道基，价 ×1.8/级；八条线各自计级')
for (const d of SHENWU_LINES) {
  const costs = [0, 1, 2, 4, 6, 8].map((lv) => shenWuCost(lv))
  console.log(`  ${d.name}（${d.effect}）  前七级价 ${costs.join(' / ')}`)
}
console.log('  metaMult：0 级 = 1，Lv.10 = ' + metaMultOf(10).toFixed(2) + '，Lv.20 = ' + metaMultOf(20).toExponential(2))
console.log('  八条线都从 1 起价；50 点道基按"买最便宜"大约能把每条点到 Lv.3~4，')
console.log('  按 62h 一轮、每轮 1~3 点算，两个月的 20~30 轮正好把元道推到 Lv.5~7（M ≈ 1.6~2.0）。')

console.log('\n【斗战胜悟】花神念，价 ×1.75/级；五条全部映射旧五轴')
for (const d of FIGHT_INSIGHT_LINES) {
  const costs = [0, 1, 2, 4, 6, 8].map((lv) => fightInsightCost(lv))
  console.log(`  ${d.name}（${d.effect}）  前七级价 ${costs.join(' / ')}`)
}
console.log('  战悟只映射旧五轴，不碰 metaMult——斗法不能成为元道倍率的第二条产线。')

/* ------------------------------------------------------------ 战魂与战将 */

console.log('\n【战将】花本世战魂，价 ×1.65/级；每级把斩怪波次上限抬 1 波')
console.log('  等级   下一级价   波次上限   满波战魂/秒（守御）   累计价')
for (const lv of [0, 1, 5, 10, 15, 20, 30, 40, 50]) {
  let acc = 0
  for (let i = 0; i < lv; i++) acc += generalCost(i)
  const cap = fightWaveCap(lv)
  console.log(
    `  Lv.${String(lv).padStart(2)}  ${fmt(generalCost(lv)).padStart(9)}   ${String(cap).padStart(3)} 波` +
      `       ${fmt(warSoulPerSecond(lv, FIGHT_MODES[0])).padStart(10)}        ${fmt(acc).padStart(10)}`,
  )
}
console.log('  满波战魂/秒按 10 秒一斩算；开局从第 2 波爬起，实际收入略低。')
console.log(`  价格与产量都按指数走，产量底数 1.25 < 价格底数 1.65，本级耗时按 1.32^lv 变长，不会一格秒穿。`)

/* ------------------------------------------------------------ 表完整性 */

console.log('\n【表完整性】旧五轴各至少一条元婴来源，metaMult 只有一条产线')
const axisCount = { danAdd: 0, qiAdd: 0, energyAdd: 0, dregMul: 0, passMul: 0, meta: 0 }
for (const d of [...SHENWU_LINES, ...FIGHT_INSIGHT_LINES]) axisCount[d.kind] = (axisCount[d.kind] ?? 0) + 1
for (const k of ['danAdd', 'qiAdd', 'energyAdd', 'dregMul', 'passMul', 'meta']) {
  console.log(`  ${k.padEnd(9)} ${axisCount[k] ?? 0} 条 ${(axisCount[k] ?? 0) > 0 ? '✓' : '✗'}`)
}
console.log(`  价格底数：建筑 ×${YUAN_BUILDING_COST_GROWTH} · 神悟 ×${SHENWU_COST_GROWTH} · 战将 ×${GENERAL_COST_GROWTH} · 战悟 ×${FIGHT_INSIGHT_COST_GROWTH}`)
