// 从练气到元婴门槛的全链阶段时间。价目与产出全部 import 真实词条，结丹层数走运行时的 jindanReturnMult。
// 用法：node --import ./sim/ts-hook.mjs sim/realm-timeline.mjs
//
// 这里只回答一件事：按现在的数值，玩家每一步要花多久；以及 1e100 那道门槛到底差多远。
import { TREASURES, REBIRTH_TREE, LIANQI_UPGRADES, JIEDAN_FURNACE_LEVEL, PILL_ANCHOR_SECONDS } from '../src/game/词条与属性.ts'
import { jindanReturnMult, jindanRitualSeconds } from '../src/game/金丹丹炉.ts'
import {
  GATE, bareMods, mergeMods, treeMods, treasureMods, runLife, dur, pointsOf, greedyTree,
} from './life-engine.mjs'

const FULL_TREASURES = Object.fromEntries(TREASURES.map((t) => [t.id, t.cap]))
const treeAt = (lv) => Object.fromEntries(REBIRTH_TREE.map((r) => [r.id, lv]))

/** 层数高了以后一世只有零点几秒，别被 dur 的四舍五入压成「0.0 分」 */
const durFine = (s) => (s < 1 ? '一瞬' : s < 60 ? `${s.toFixed(1)} 秒` : dur(s))

/** 累计筑基点目标：一世一世挂到 1e10，点完树继续跑；返回累计时长与世数 */
function toPoints(target) {
  const lv = {}
  let earned = 0
  let points = 0
  let loops = 0
  let t = 0
  while (earned < target && loops < 2000) {
    const mods = treeMods(lv)
    const r = runLife({ mods, target: GATE })
    if (r.timedOut) return { t, earned, loops, lv, timedOut: true }
    t += r.t
    const got = pointsOf(r.earned, loops, mods.pointAdd)
    earned += got
    points += got
    loops++
    points = greedyTree(points, lv)
  }
  return { t, earned, loops, lv }
}

/**
 * 0.19 起结丹门槛按"本世产量 × 仪式秒数"定价，所以一世的"等"就是仪式秒数本身，
 * 前面再加上把法门重新买回来的爬坡段（按丹炉段同一条 1/√M 缩）。
 * 这里按"完全不点丹纹"算（0 级），量出来的是结丹链的**上界**；
 * 丹纹点满能把这串秒数砍掉一半，见 `sim/jindan-balance-audit.mjs`。
 * `PILL_ANCHOR_SECONDS` 从词条里读，别在这里硬编码——0.17 改过这个锚，留第二份就会差出四分之一。
 */
function lifeAt(T0param, n) {
  const m = jindanReturnMult(n)
  return jindanRitualSeconds(n + 1, 0) + FURNACE_PHASE / Math.sqrt(m)
}

/** 结丹第 n 层的累计时长：第 k 世（已结 k 层）的时长按 lifeAt 缩 */
function layerTime(T0param, n) {
  let t = 0
  for (let k = 0; k < n; k++) t += lifeAt(T0param, k)
  return t
}

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

console.log('【阶段一 · 练气与探索】')
const anchor = runLife({ mods: bareMods(), target: GATE })
const pts100 = toPoints(100)
const pts20 = toPoints(20)
console.log(`  空树空宝 一世摸到 1e10：${dur(anchor.t)}（${(anchor.t / 60).toFixed(2)} 分，锚点 15.0 分）`)
console.log(`  累计 ${pts100.earned} 筑基点（探索开启）：${dur(pts100.t)} · ${pts100.loops} 世`)
console.log(`  累计 ${pts20.earned} 筑基点（练气代买）：${dur(pts20.t)} · ${pts20.loops} 世`)

console.log('\n【阶段二 · 金丹存量 1e30】法宝收齐 + 根骨各 Lv.8')
const mods8 = mergeMods(treeMods(treeAt(8)), treasureMods(FULL_TREASURES))
const life30 = runLife({ mods: mods8, target: 1e30 })
const T0 = life30.t
const flowLog8 = endFlowLog10(life30, mods8)
const FURNACE_PHASE = PILL_ANCHOR_SECONDS / 10 ** (flowLog8 / 2)
console.log(
  `  一世摸到 1e30：${dur(T0)} · 收尾流量 1e${flowLog8.toFixed(2)}/秒` +
    ` · 法门 ${Object.entries(life30.lv).map(([id, lv]) => `${id.replace('lianqi_', '')}${lv}`).join(' ')}`,
)
const mods15 = mergeMods(treeMods(treeAt(15)), treasureMods(FULL_TREASURES))
const life30b = runLife({ mods: mods15, target: 1e30 })
console.log(`  根骨各 Lv.15 的同一世：${dur(life30b.t)} · 收尾流量 1e${endFlowLog10(life30b, mods15).toFixed(2)}/秒`)

console.log('\n【阶段三 · 丹炉结丹线】')
console.log(`  丹炉 Lv.${JIEDAN_FURNACE_LEVEL}：12.00 小时 @ 灵气/秒 1e24 · t×√流量 = 4.32e16 秒（锚点）`)
console.log(`  本档收尾流量 1e${flowLog8.toFixed(2)}/秒 → 炉子那段约 ${dur(FURNACE_PHASE)}，剩余 ${dur(T0 - FURNACE_PHASE)} 攒灵气`)
console.log('  首丹之后每一层的门槛改成“炉 ≥12 + 手上 max(老阶梯, 本世产量 × 仪式秒数)”，炉子等级不散，涨的只有仪式秒数')

console.log('\n【阶段四 · 结丹回溯】首层 ×2、之后每层 ×1.25（每层耗时 = 仪式秒数 + 重建法门的爬坡）')
for (const n of [1, 2, 3, 5, 8, 12, 20, 50, 100, 200, 405]) {
  const m = jindanReturnMult(n)
  console.log(
    `  第 ${String(n).padStart(3)} 层：累计 ${dur(layerTime(T0, n)).padStart(9)} · 这一世 ${durFine(lifeAt(T0, n - 1)).padStart(9)} · 产出 ×1e${Math.log10(m).toFixed(2)}`,
  )
}

console.log('\n【阶段五 · 1e100 怎么到】结丹攒回溯倍率，最后一世不再结丹，直接把累计灵气推过门槛')
const base100 = runLife({ mods: mods8, target: 1e100, capSeconds: Infinity })
console.log(`  空回溯的一世从零摸到 1e100：约 1e${Math.log10(base100.t / (365.25 * 86400)).toFixed(0)} 年——乘法轴要除的就是这个量`)
console.log('  结丹层数   回溯倍率   结丹累计     最后一世      合计')
for (const n of [100, 200, 300, 372, 405]) {
  const m = jindanReturnMult(n)
  const final = base100.t / m
  console.log(
    `  ${String(n).padStart(6)} 层  ×1e${Math.log10(m).toFixed(1).padStart(5)}  ${dur(layerTime(T0, n)).padStart(9)}  ${dur(final).padStart(10)}  ${dur(layerTime(T0, n) + final).padStart(9)}`,
  )
}
console.log('  405 层之后倍率已经够大：再结丹只多点几百下，不再明显省时间；405 下按 1 秒 1 次也只要几分钟。')
console.log(`  早段跟着法门加成上调：首丹 ${dur(T0)}，前三层的累计 ${dur(layerTime(T0, 3))}。`)

console.log('\n【阶段六 · 1e80 结婴（0.22 起的门槛）】')
{
  // 结婴只看累计灵气 1e80，不必先结到 405 层——层数只是"把最后一世的产量抬到门槛之上"。
  // 和阶段五同一个算法：空回溯到 1e80 的耗时除以回溯倍率，再加上逐层结丹的时间，取最小值。
  const base80 = runLife({ mods: mods8, target: 1e80, capSeconds: Infinity })
  console.log(`  空回溯一世到 1e80：${dur(base80.t)}（乘法轴要除的就是这个量）`)
  let best80 = null
  for (let n = 1; n <= 600; n++) {
    const final = base80.t / jindanReturnMult(n)
    const total = layerTime(T0, n) + final
    if (!best80 || total < best80.total) best80 = { n, total, final }
  }
  console.log(
    `  最省：第 ${best80.n} 层 · 结丹 ${dur(layerTime(T0, best80.n))} + 末世 ${dur(best80.final)}` +
      ` = ${dur(best80.total)}`,
  )
  console.log(`  丹纹轮点约 ×0.6：约 ${dur(layerTime(T0, best80.n) * 0.6 + best80.final)}`)
  console.log('  再往上加层只多花时间；405 层是 1e100 的活，结婴用不到。')
}

console.log('\n【对照 · 为什么不是加法】旧口径每层 +100%，到 1e100 要 1e70 层；')
console.log('  丹房那 6%/级同样是加法，堆到 1e70 级也不可达。乘法轴把层数从 1e70 压到 405。')
