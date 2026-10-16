// 【已作废，2026-10-16】这条脚本在价目表还在 sim 里自己摊一份的时候写的，绝对基准价与 ratio 都和运行时不一致了。
// 定标与实测改看 sim/jindan-anchor.mjs，它直接 import src/game/金丹丹炉.ts 那套式子；运行时也用同一套。
// 留着只当"为什么不能把反哺做成乘法"那段对照，别再照它取数。
// 丹炉链：灵气 →（丹炉 + 火候）→ 丹，三条线都用**丹**付账。
// 只跑 float，不用 BigNumber；灵气/秒取 sim/jindan.mjs 的实测锚点。
import { dur } from './life-engine.mjs'

/** 转化率基准：炉子吞掉手上流量的一成 */
const CONV = 0.1

/** 定标锚点：造价基准按这一档构筑定 */
const CAL_FLOW = 1e24

/**
 * 三条线，同一个效果走加算（倍率 = 1 + 每级 × 级数），只有炉子是乘法：
 *   炉子   每级丹/秒 ×2，造价 ×30
 *   火候   每级转化率 +5%，造价 ×10，第 1 级 = 炉子的 3 倍
 *   丹房   每级把丹回哺成练气灵气 +5%，造价 ×3，第 1 级 = 炉子的 10 倍
 */
const P = {
  MUL: 2,
  PRICE_G: 30,
  FIRE: 0.05,
  FIRE_G: 10,
  FIRE_B: 3,
  FOOD: 0.05,
  FOOD_G: 3,
  FOOD_B: 10,
}

/** sim/jindan.mjs 实测的各档灵气/秒（同一份 1e28 灵气各档要挂多久 → 折算出当时的流量） */
const ANCHORS = [
  { name: '刚解锁探索', flow: 1e22 },
  { name: '法宝收齐那阵', flow: 1e24 },
  { name: '再挂两千世', flow: 1e26 },
  { name: '4000 世终局', flow: 1e30 },
]

const GROWTH = { 炉子: P.PRICE_G, 火候: P.FIRE_G, 丹房: P.FOOD_G }

/**
 * 一世：手里只有 flow 这一份灵气流量，在 budget 秒里看三条线各能买到几级。
 * policy：'cheap' 哪条最便宜买哪条（= 游戏里那颗一键购买的贪心）· 'furnace' 只堆炉子 ·
 *         'furnaceFood' 只比炉子和丹房 · 'nofood' 只比炉子和火候
 * priceExp：造价按 (flow / 定标档)^exp 缩放，0 = 绝对丹数，1 = 完全跟着流量走
 */
function refine({ flow, budget, base = {}, policy = 'cheap', priceExp = 0, food = null }) {
  const lv = { 炉子: 0, 火候: 0, 丹房: 0 }
  const back = () => (food === null ? 1 + P.FOOD * lv.丹房 : food(lv.丹房))
  const rate = () => flow * CONV * (1 + P.FIRE * lv.火候) * P.MUL ** lv.炉子 * back()
  const scale = (flow / CAL_FLOW) ** priceExp
  const cost = (name) => base[name] * GROWTH[name] ** lv[name] * scale
  const NAMES = {
    cheap: ['炉子', '火候', '丹房'],
    furnace: ['炉子'],
    nofood: ['炉子', '火候'],
    furnaceFood: ['炉子', '丹房'],
  }
  let dan = 0
  let t = 0
  for (let steps = 0; t < budget && steps < 8000; steps++) {
    let pick = NAMES[policy][0]
    for (const n of NAMES[policy]) if (cost(n) < cost(pick)) pick = n
    const c = cost(pick)
    if (c > dan) {
      const dt = (c - dan) / rate()
      if (t + dt > budget) break
      dan += rate() * dt
      t += dt
      continue
    }
    dan -= c
    lv[pick]++
  }
  return { lv, t, dan, rate: rate() }
}

const BUDGETS = [30 * 60, 3 * 3600, 12 * 3600, 3 * 86400]
const head = (b) => dur(b).padStart(9)
const row = (lv) => `炉${String(lv.炉子).padStart(2)} 火${String(lv.火候).padStart(2)} 房${String(lv.丹房).padStart(2)}`
const withBase = (b) => ({ 炉子: b, 火候: b * P.FIRE_B, 丹房: b * P.FOOD_B })

const N = 12
/** 反推基准价：让定标档挂满 12 小时正好摸到炉子第 N 级 */
function calibrate(targetLevel, budget, flow) {
  let lo = 1e-9
  let hi = 1e30
  for (let i = 0; i < 110; i++) {
    const mid = Math.sqrt(lo * hi)
    if (refine({ flow, budget, base: withBase(mid), policy: 'furnace' }).lv.炉子 >= targetLevel) lo = mid
    else hi = mid
  }
  return Math.sqrt(lo * hi)
}

const BASE = withBase(calibrate(N, 12 * 3600, CAL_FLOW))
console.log(`定标：让「法宝收齐那阵」（灵气/秒 1e24）挂满 12 小时正好摸到炉子第 ${N} 级`)
for (const k of ['炉子', '火候', '丹房']) {
  const eff = k === '炉子' ? `丹/秒 ×${P.MUL}` : k === '火候' ? `转化 +${(P.FIRE * 100).toFixed(0)}%` : `灵气 +${(P.FOOD * 100).toFixed(0)}%`
  console.log(`  ${k} 第 1 级 = ${BASE[k].toExponential(2)} 丹 · 每级 ${eff}（加法叠） · 涨价 ×${GROWTH[k]}`)
}

console.log('\n【绝对丹数定价】门槛 = 炉子第 12 级，四档构筑各能买到哪（贪心：哪条最便宜买哪条）')
console.log('  构筑'.padEnd(14) + BUDGETS.map((b) => head(b)).join(' | '))
for (const a of ANCHORS) {
  const cells = BUDGETS.map((b) => row(refine({ flow: a.flow, budget: b, base: BASE }).lv).padStart(13))
  console.log(`  ${a.name.padEnd(12)}${cells.join(' | ')}`)
}

console.log('\n【每多一级要等多久】定标档只堆炉子——面板上该摆的是"下一级"这一格')
let acc = 0
for (let k = 1; k <= 15; k++) {
  let lo = 0
  let hi = 1e12
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2
    if (refine({ flow: CAL_FLOW, budget: mid, base: BASE, policy: 'furnace' }).lv.炉子 >= k) hi = mid
    else lo = mid
  }
  console.log(`  第 ${String(k).padStart(2)} 级  累计 ${dur(hi).padStart(9)}   本级 ${dur(hi - acc).padStart(9)}`)
  acc = hi
}

console.log('\n【火候和丹房会不会包吃钱包】定标档挂 12 小时')
for (const [policy, label] of [['cheap', '贪最便宜  '], ['nofood', '不买丹房  '], ['furnace', '只堆炉子  ']]) {
  const r = refine({ flow: CAL_FLOW, budget: 12 * 3600, base: BASE, policy })
  console.log(`  ${label} ${row(r.lv)}   丹/秒 ${r.rate.toExponential(2)}`)
}
for (const fb of [1, 3, 10, 30]) {
  const r = refine({ flow: CAL_FLOW, budget: 12 * 3600, base: { ...BASE, 火候: BASE.炉子 * fb } })
  console.log(`  火候第 1 级 = 炉子 ×${String(fb).padStart(2)}  ${row(r.lv)}   丹/秒 ${r.rate.toExponential(2)}`)
}

console.log('\n【造价该不该跟着流量缩放】同一份 12 小时，各档构筑跑到炉子第几级')
console.log('  构筑'.padEnd(14) + [0, 0.5, 1].map((e) => `exp=${e}`.padStart(9)).join(''))
for (const a of ANCHORS) {
  const cells = [0, 0.5, 1].map((e) => `炉${refine({ flow: a.flow, budget: 12 * 3600, base: BASE, priceExp: e }).lv.炉子}`.padStart(9))
  console.log(`  ${a.name.padEnd(12)}${cells.join('')}`)
}

/** 二分：丹/秒摸到 target 要挂多久（只比炉子和丹房两条线） */
function timeTo(target, shape, flow = CAL_FLOW) {
  const food = shape === 'none' ? () => 1
    : shape === 'add' ? null
    : shape === 'x105' ? (b) => 1.05 ** b
    : shape === 'x12' ? (b) => 1.2 ** b
    : (b) => 2 ** b
  let lo = 0
  let hi = 3e9
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2
    const r = refine({ flow, budget: mid, base: BASE, policy: shape === 'none' ? 'furnace' : 'furnaceFood', food })
    if (r.rate >= target) hi = mid
    else lo = mid
  }
  return hi >= 3e9 ? Infinity : hi
}

console.log('\n【丹房只能加法】门槛 = 丹/秒 ≥ 1e28，把反哺换成别的形状（∞ = 超过 95 年预算）')
for (const [label, shape] of [['不反哺', 'none'], ['加法 每级+5%', 'add'], ['乘法 每级×1.05', 'x105'], ['乘法 每级×1.2', 'x12'], ['乘法 每级×2', 'x2']]) {
  const t = timeTo(1e28, shape)
  console.log(`  ${label.padEnd(16)} ${t === Infinity ? '∞（墙咬住）' : dur(t)}`)
}
