// 结丹难度与资源规模的审计：0.19 之后门槛按"产量 × 仪式秒数"定价。
// 只读游戏里的纯函数，不改任何数值。
// 运行：node --import ./sim/ts-hook.mjs sim/jindan-balance-audit.mjs
import {
  jindanCostLog10,
  jindanCostGrowth,
  jindanDanCostLog10,
  jindanDanRitualSeconds,
  jindanLadderLog10,
  jindanMarksAt,
  jindanReturnMult,
  jindanRitualSeconds,
  JIEDAN_COST_BASE_LOG10,
} from '../src/game/金丹丹炉.ts'
import {
  JIEDAN_RETURN_GROWTH,
  JIEDAN_RITUAL_DAN,
  JIEDAN_RITUAL_QI,
  JINDAN_TREE,
  JINDAN_TREE_MAX,
} from '../src/game/词条与属性.ts'

const h = (s) => (s / 3600).toFixed(2)

/** 与实现同一条贪心：每级价 n 点，只买当下最便宜的那枝 */
function greedy(points) {
  const lv = JINDAN_TREE.map(() => 0)
  let rest = Math.floor(points)
  for (;;) {
    let b = -1
    for (let i = 0; i < lv.length; i++) {
      if (lv[i] >= JINDAN_TREE_MAX) continue
      if (b < 0 || lv[i] < lv[b]) b = i
    }
    if (b < 0) break
    const price = lv[b] + 1
    if (rest < price) break
    rest -= price
    lv[b] += 1
  }
  return lv.reduce((a, b) => a + b, 0)
}

const LAYERS = [1, 8, 20, 50, 80, 104, 200, 300, 405]

console.log('【一】0.18 老阶梯：门槛是层数的纯函数，必然被复利淹没')
console.log('  层   丹纹点  深度   每层涨幅    老门槛      回溯倍率     相对宽松')
let prev = null
for (const n of LAYERS) {
  const marks = jindanMarksAt(n)
  const depth = greedy(marks)
  const gate = jindanLadderLog10(n, depth)
  const ret = Math.log10(jindanReturnMult(n))
  const slack = ret - (gate - JIEDAN_COST_BASE_LOG10)
  const line =
    `  ${String(n).padStart(3)}  ${String(marks).padStart(5)}  ${String(depth).padStart(3)}` +
    `   ×${jindanCostGrowth(depth).toFixed(3)}   1e${gate.toFixed(2)}` +
    `   ×1e${ret.toFixed(1)}`.padEnd(14) +
    `   1e${slack.toFixed(1)}`
  console.log(line + (prev === null ? '' : `（+1e${(slack - prev).toFixed(1)}）`))
  prev = slack
}

console.log('\n【二】104 层：新门槛改成"产量 × 仪式秒数"')
{
  const depth = greedy(jindanMarksAt(104))
  const ladder = jindanLadderLog10(104, depth)
  const t = jindanRitualSeconds(104, depth)
  const td = jindanDanRitualSeconds(104, depth)
  console.log(`  老阶梯         1e${ladder.toFixed(2)}（= 2.56e35，与玩家实测一致）`)
  console.log(`  仪式秒数       灵气 ${t.toFixed(1)} 秒 · 丹 ${td.toFixed(1)} 秒（丹纹 ${depth} 级）`)
  for (const flow of [24, 45, 63, 70]) {
    const gate = jindanCostLog10(104, depth, flow)
    console.log(`  产量 1e${flow}/s → 门槛 1e${gate.toFixed(2)}${flow === 63 ? '   ← 玩家手上 1e65' : ''}`)
  }
  console.log(`  丹门槛 = 丹/秒 × ${td.toFixed(1)} 秒；结丹后丹清零`)
}

console.log('\n【三】门槛永远贴着"若干秒产量"（不再随产量失控）')
console.log('  层   仪式(0纹)  仪式(42纹)   门槛@1e24    门槛@1e45    门槛@1e63')
for (const n of LAYERS) {
  const cells = [24, 45, 63].map((f) => `1e${jindanCostLog10(n, 0, f).toFixed(1)}`.padStart(10))
  console.log(
    `  ${String(n).padStart(3)}  ${jindanRitualSeconds(n, 0).toFixed(0).padStart(7)}s` +
      `  ${jindanRitualSeconds(n, 42).toFixed(0).padStart(7)}s   ${cells.join('  ')}`,
  )
}

console.log('\n【四】累计结丹耗时（每层按仪式秒数计）')
for (const depth of [0, 21, 42]) {
  let t = 0
  let t104 = 0
  for (let n = 1; n <= 405; n++) {
    t += jindanRitualSeconds(n, depth)
    if (n <= 104) t104 += jindanRitualSeconds(n, depth)
  }
  console.log(`  丹纹 ${String(depth).padStart(2)} 级：到 104 层 ${h(t104)} 小时 · 到 405 层 ${h(t)} 小时`)
}

console.log('\n【五】丹闸：结丹焚丹 = 丹/秒 × 丹仪式秒数，且清零')
for (const n of [1, 20, 104, 405]) {
  console.log(
    `  第 ${String(n).padStart(3)} 层：${jindanDanRitualSeconds(n, 0).toFixed(0)} 秒丹产` +
      `（丹纹 42 级 ${jindanDanRitualSeconds(n, 42).toFixed(0)} 秒）`,
  )
}

console.log('\n【六】断言')
const ok = []
{
  let mono = true
  // 只到 999：1000 是层数上限，第 1001 层会被 clamp 回来
  for (let n = 1; n < 1000; n++) {
    if (!(jindanRitualSeconds(n + 1, 0) > jindanRitualSeconds(n, 0))) mono = false
    if (!(jindanLadderLog10(n + 1, 30) >= jindanLadderLog10(n, 30))) mono = false
  }
  ok.push(['仪式秒数与老阶梯在 1..1000 层严格不减', mono])

  let ratio = true
  for (const flow of [25, 40, 63, 70]) {
    for (const n of [20, 104, 405]) {
      const gate = jindanCostLog10(n, 29, flow)
      const t = jindanRitualSeconds(n, 29)
      // 门槛要么是老阶梯（产量太低），要么正好等于 产量 × 秒数
      const ritual = flow + Math.log10(t)
      if (Math.abs(gate - Math.max(jindanLadderLog10(n, 29), ritual)) > 1e-9) ratio = false
    }
  }
  ok.push(['门槛 = max(老阶梯, 产量 × 仪式秒数)', ratio])

  let monoFlow = true
  for (let f = 20; f <= 80; f++) {
    if (jindanCostLog10(104, 29, f + 1) < jindanCostLog10(104, 29, f) - 1e-9) monoFlow = false
  }
  ok.push(['门槛对产量单调不减（产量高了不会更便宜）', monoFlow])

  ok.push(['丹纹只缩不涨（42 级 < 0 级）', jindanRitualSeconds(104, 42) < jindanRitualSeconds(104, 0)])
  ok.push(['丹纹封底 ×0.5', Math.abs(jindanRitualSeconds(104, 999) / jindanRitualSeconds(104, 0) - 0.5) < 1e-9])
  ok.push(['每层涨幅上界仍等于回溯 1.25', Math.abs(jindanCostGrowth(0) - JIEDAN_RETURN_GROWTH) < 1e-12])
  ok.push(['老门槛复现玩家实测 1e35.4', Math.abs(jindanLadderLog10(104, greedy(jindanMarksAt(104))) - 35.4) < 0.15])
  ok.push(['丹通道有产量时有限、没起炉时为 −∞', Number.isFinite(jindanDanCostLog10(104, 29, 65)) && jindanDanCostLog10(104, 29, -Infinity) === -Infinity])
}
for (const [name, pass] of ok) console.log(`  ${pass ? '✓' : '✗'} ${name}`)

console.log(`\n  当前常量：仪式 ${JIEDAN_RITUAL_QI}s 灵气 / ${JIEDAN_RITUAL_DAN}s 丹，丹纹封底后 1e65 那档约 ${jindanRitualSeconds(104, 999).toFixed(0)} 秒一层`)
