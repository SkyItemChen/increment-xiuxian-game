/**
 * 涨价削减的自限性校验 —— 决定"金丹之后数值会不会爆"的那条线。
 *
 * 乘法法门每级花 `growth` 倍、换 `power` 倍。等级由流量顶出来（L ≈ log(S)/log(growth)），
 * 所以流量对这些等级的弹性是
 *
 *     E = log10(power) / log10(growthEff)
 *
 * 几条乘法线一起乘，**ΣE < 1** 时流量有不动点；ΣE ≥ 1 时"越买越赚"，等级与流量互抬，
 * 一路冲到 F500 那种指数上亿的档位。悟性/玄铜镜砍的是 growth，砍狠了 E 就翻上来，
 * 所以 `growthCutOf` 必须给 log 涨幅留一条地板（`MAX_LOG_CUT`）。
 *
 * 用法：node --import ./sim/ts-hook.mjs sim/rebirth-cut-check.mjs
 */
import { LIANQI_UPGRADES, REBIRTH_TREE, TREASURES } from '../src/game/词条与属性.ts'
import { growthCutOf, MAX_LOG_CUT } from '../src/game/rebirth.ts'

const MUL_KINDS = new Set(['auto-power', 'auto-mult', 'speed-mult'])
const LINES = LIANQI_UPGRADES.filter((d) => MUL_KINDS.has(d.kind))

/** 高段（30 级之后）的涨价幅度：那一段才是玩家真正停留的地方 */
const highGrowth = (d) => {
  const segs = d.segments ?? []
  return segs.length ? segs[segs.length - 1].growth : d.growth
}

const E = (power, growth) => Math.log10(power) / Math.log10(growth)

/** 一路削到底（cut=1）时 ΣE 最大，先算这一头 */
function sumE(cut) {
  return LINES.reduce((acc, d) => acc + E(d.power, growthCutOf(cut, highGrowth(d))), 0)
}

let ok = true
const check = (label, pass) => {
  if (!pass) ok = false
  console.log(`${pass ? '✓' : '✗'} ${label}`)
}

console.log('三条乘法法门：高段涨价 / 每级收益 / 原始 E')
for (const d of LINES) {
  console.log(
    `  ${d.name.padEnd(5, '　')} g=${String(highGrowth(d)).padStart(2)} · p=${d.power} · E=${E(d.power, highGrowth(d)).toFixed(3)}`,
  )
}

console.log('\n削减 → ΣE（>1 就是复利暴走）')
for (const cut of [0, 0.3, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1]) {
  const s = sumE(cut)
  console.log(`  ${(cut * 100).toFixed(0).padStart(3)}%  ΣE=${s.toFixed(3)} ${s >= 1 ? '★ 爆' : ''}`)
}

console.log('\n地板（log 涨幅最多砍 %.2f）落到哪一级悟性：', MAX_LOG_CUT)
const wuXing = REBIRTH_TREE.find((d) => d.id === 'wuXing')
const mirror = TREASURES.find((d) => d.kind === 'cost-cut')
const baseCut = mirror ? mirror.power * mirror.cap : 0
for (const d of LINES) {
  const g = highGrowth(d)
  const cutCap = 1 - Math.pow(g, 1 - MAX_LOG_CUT) / g
  const lv = Math.max(0, (cutCap - baseCut) / wuXing.power)
  console.log(`  ${d.name}：最多砍 ${(cutCap * 100).toFixed(1)}% → 悟性 ${lv.toFixed(1)} 级封顶`)
}

console.log('')
check('削到 0% 时 ΣE < 1（原始表本身攒得住）', sumE(0) < 1)
check('削到 100% 时 ΣE 仍 < 1（价格削减不给复利开口子）', sumE(1) < 1)
check(`削到 100% 时 ΣE ≤ 0.75（留出余量，别贴着 1 走）`, sumE(1) <= 0.75)

// 定案（0.15）：悟性到顶后不再有收益，是刻意的。
// 地板一旦咬合，再往上砍多少都改不动 ΣE——这正是"等级过高也不会复发"的形式化表述。
check(
  '地板咬合后，继续加大削减不再改变 ΣE（等级再高也一样）',
  [0.8, 0.9, 1].every((cut) => Math.abs(sumE(cut) - sumE(1)) < 1e-12),
)

// 中段（10~30 级）g 更低，ΣE 会破 1——那一段只有 20 级，攒出来的倍率有界，不算失控；
// 这里把它算清楚摆着，免得以后有人看到 ΣE>1 误判成 bug。
const midSum = LINES.reduce((acc, d) => {
  const seg = (d.segments ?? [])[0]
  if (!seg) return acc
  return acc + E(d.power, growthCutOf(1, seg.growth))
}, 0)
const midGain = LINES.reduce((acc, d) => {
  const seg = (d.segments ?? [])[0]
  return seg ? acc + 20 * Math.log10(d.power) : acc
}, 0)
console.log(
  `\n中段（10~30 级）：ΣE=${midSum.toFixed(2)}（>1），但只有 20 级可买，` +
    `这一段最多多攒 1e${midGain.toFixed(0)}，有界`,
)

console.log(ok ? '\n全部通过' : '\n有不成立的地方')
process.exitCode = ok ? 0 : 1
