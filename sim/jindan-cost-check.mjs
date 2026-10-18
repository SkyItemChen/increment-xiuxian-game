// 结丹"老阶梯"的长期校验（0.19 之后它只剩早盘保底这一个职责）。
// 真实节奏（仪式秒数、丹闸）由 `sim/jindan-balance-audit.mjs` 盯着，那边才是主口径。
// 数值全部读 src/game/词条与属性.ts 与 金丹丹炉.ts，别在这里留第二份表。
// 用法：node --import ./sim/ts-hook.mjs sim/jindan-cost-check.mjs
import {
  JIEDAN_GROWTH_FLOOR,
  JIEDAN_GROWTH_PER_MARK,
  JIEDAN_RETURN_GROWTH,
  JIEDAN_RITUAL_QI,
  JIEDAN_RITUAL_RAMP,
  JINDAN_MILESTONES,
  JINDAN_TREE_MAX,
  JINDAN_TREE_PER_LAYER,
} from '../src/game/词条与属性.ts'
import {
  JIEDAN_COST_BASE_LOG10,
  jindanCostGrowth,
  jindanCostLog10,
  jindanGrowthAt,
  jindanLadderLog10,
  jindanMarksAt,
  jindanRitualSeconds,
} from '../src/game/金丹丹炉.ts'

let bad = 0
function check(name, ok, extra = '') {
  if (!ok) bad++
  console.log(`  ${ok ? '✓' : '✗'} ${name}${extra ? ' —— ' + extra : ''}`)
}

/** 产量项压过老阶梯的分界：1e30 / T(1) */
const HANDOVER_LOG10 = Math.log10(1e30 / JIEDAN_RITUAL_QI)

console.log('【常量】')
console.log(`  第 1 层门槛 1e${JIEDAN_COST_BASE_LOG10.toFixed(0)} · 0 级涨幅 ×${JIEDAN_RETURN_GROWTH} · 每级 −${JIEDAN_GROWTH_PER_MARK} · 封底 ×${JIEDAN_GROWTH_FLOOR}`)
console.log(`  仪式：${JIEDAN_RITUAL_QI}s 起，每层 ×${1 + JIEDAN_RITUAL_RAMP} · 丹纹每级 −1%，封底一半`)
console.log(`  交接点：灵气/秒 ≈ 1e${HANDOVER_LOG10.toFixed(1)}（低于它由老阶梯管家，高于它由产量管家）`)

console.log('\n【一】第 1 层仍是 1e30，老阶梯不回落')
{
  check('第 1 层 = 1e30（深度 0）', Math.abs(jindanLadderLog10(1, 0) - 30) < 1e-9, `实测 1e${jindanLadderLog10(1, 0).toFixed(6)}`)
  check('第 1 层 = 1e30（深度 88）', Math.abs(jindanLadderLog10(1, 88) - 30) < 1e-9)
  let strict = true
  for (const total of [0, 12, 25]) {
    let prev = -Infinity
    for (let n = 1; n <= 1000; n++) {
      const v = jindanLadderLog10(n, total)
      if (!(v > prev)) strict = false
      prev = v
    }
  }
  check('深度 0/12/25（涨幅 > 1）下 1..1000 层严格递增', strict)
  let flat = true
  for (const total of [44, 88]) {
    let prev = -Infinity
    for (let n = 1; n <= 1000; n++) {
      const v = jindanLadderLog10(n, total)
      if (v < prev - 1e-9) flat = false
      prev = v
    }
  }
  check('深度 44/88（已封底）下门槛不降——涨幅 1.00 就是"不再涨"', flat)
}

console.log('\n【二】0 级 ×1.25，42 级压到封底，之后不再变')
{
  check('深度 0 → ×1.25', Math.abs(jindanGrowthAt(0) - JIEDAN_RETURN_GROWTH) < 1e-12, `×${jindanGrowthAt(0).toFixed(4)}`)
  check('深度 42 → ×1.00', Math.abs(jindanGrowthAt(42) - 1) < 1e-12, `×${jindanGrowthAt(42).toFixed(4)}`)
  check('深度 88 仍 ×1.00（不倒着降）', Math.abs(jindanGrowthAt(88) - 1) < 1e-12)
  let mono = true
  for (let t = 1; t <= 88; t++) if (jindanGrowthAt(t) > jindanGrowthAt(t - 1)) mono = false
  check('深度越高涨幅单调不增', mono)
  check('面板读数与函数同源', Math.abs(jindanCostGrowth(25) - jindanGrowthAt(25)) < 1e-12)
  check('负数/NaN 深度按 0 处理', jindanGrowthAt(-5) === JIEDAN_RETURN_GROWTH && jindanGrowthAt(NaN) === JIEDAN_RETURN_GROWTH)
}

console.log('\n【三】早盘由老阶梯管家，产量过线后由仪式秒数接管')
{
  let ladder = true
  let ritual = true
  for (const n of [1, 8, 20, 50, 104, 405]) {
    if (Math.abs(jindanCostLog10(n, 25, HANDOVER_LOG10 - 3) - jindanLadderLog10(n, 25)) > 1e-9) ladder = false
    // 产量抬到 1e68：这个档位下仪式项在每一层都压过老阶梯（405 层的老阶梯约 1e46）
    const want = HANDOVER_LOG10 + 40 + Math.log10(jindanRitualSeconds(n, 25))
    if (Math.abs(jindanCostLog10(n, 25, HANDOVER_LOG10 + 40) - want) > 1e-9) ritual = false
  }
  check(`产量 < 1e${HANDOVER_LOG10.toFixed(0)}/s 时门槛 = 老阶梯`, ladder)
  check(`产量 1e${(HANDOVER_LOG10 + 40).toFixed(0)}/s 时门槛 = 产量 × 仪式秒数`, ritual)
  check('不传产量时退回老阶梯（sim 兼容）', Math.abs(jindanCostLog10(104, 25) - jindanLadderLog10(104, 25)) < 1e-12)
  let mono = true
  for (let f = 20; f <= 90; f++) {
    if (jindanCostLog10(104, 25, f + 1) < jindanCostLog10(104, 25, f) - 1e-9) mono = false
  }
  check('门槛对产量单调不减（产量高了不会更便宜）', mono)
}

console.log('\n【四】极端层数与坏档')
{
  const vals = [1, 10, 100, 500, 999, 1000].map((n) => jindanLadderLog10(n, 44))
  const ok = vals.every((v) => Number.isFinite(v)) && vals.every((v, i) => i === 0 || v >= vals[i - 1] - 1e-9)
  check('1..1000 层全部有限且不回落（深度 44，已封底）', ok, `第 1000 层 1e${jindanLadderLog10(1000, 44).toFixed(1)}`)
  check('超出层数上限后夹住', Math.abs(jindanLadderLog10(1e9, 44) - jindanLadderLog10(1000, 44)) < 1e-9)
  check('深度超上限按 88 级夹住', Math.abs(jindanLadderLog10(200, 1e6) - jindanLadderLog10(200, 88)) < 1e-9)
  check('丹纹点数曲线与运行时同源', jindanMarksAt(8) === 8 + 17, `第 8 层 ${jindanMarksAt(8)} 点`)
  check('层数上限后仪式秒数夹住', Math.abs(jindanRitualSeconds(1e9, 0) - jindanRitualSeconds(1000, 0)) < 1e-9)
}

console.log('\n【五】旧档：不点丹纹会慢，点了立刻见效')
{
  const raw = jindanRitualSeconds(80, 0)
  const spent = jindanRitualSeconds(80, 25)
  check('80 层 0 级丹纹的仪式秒数高于 25 级', raw > spent, `${raw.toFixed(0)}s > ${spent.toFixed(0)}s`)
  let ok = true
  for (const n of [2, 20, 80, 405, 1000]) {
    let prev = Infinity
    for (let t = 0; t <= 88; t += 4) {
      const v = jindanRitualSeconds(n, t)
      if (v > prev + 1e-9) ok = false
      prev = v
    }
  }
  check('任何层数下仪式秒数随丹纹深度单调不增', ok)
}

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条未通过`)
