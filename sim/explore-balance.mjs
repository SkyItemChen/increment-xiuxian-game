// 把探索的押注改成「押注买铲数」或「固定门票」之后，这一层的节奏还剩多少。
// 七个方案都保留定过的形状「把筑基点压上去换一批法宝」，差别只在三处：铲数由谁定、一次真正花掉多少点、挖完余款还在不在手上。
//   B0 现状    押全部；铲数 = 1 + 铁铲；押的点每 10 点折 1 见识 → 押 1 点和押 100 点只是交税，没有决策
//   B1 硬顶    押全部；铲数 = min(1 + 铁铲, floor(押注 / STEP))；押过头的部分纯烧掉
//   B2 软顶    同 B1，但押过头的部分仍按 10:1 折见识（不为零，明显比买铲亏）
//   B3 门票    押全部；铲数照铁铲给满，只是手上要先有 STEP 点才让挖
//   B4 轮价    押全部；门槛抬成 STEP ×(1+铁铲)——"想挖满这一轮就先攒够这么多"
//   B5 收门票  只收 STEP ×(1+铁铲) 那一笔，余款留在手上；铲数照铁铲给满
//   B6 平价    只收 STEP 点，余款留在手上；铲数照铁铲给满
// 点数一押就清零 ⇒ 一世最多押一次，探索次数被破境次数钉住；而根骨等级要跨世攒钱才买得起，所以"挖不挖"直接动到 1e36。
// 用 policy 摆出两种打法：
//   crumbs  根骨优先，买完的零头才押去挖（省着点树的人）
//   reserve 先留下"够挖一次"的那一笔再点根骨（把探索当固定开销的人，也是自动化的判据）
// 用法：node --import ./sim/ts-hook.mjs sim/explore-balance.mjs [步长=10,20,40] [世数=4000] [种子]
import { EXPLORE_TREE, TREASURES } from '../src/game/词条与属性.ts'
import {
  EXPLORE_UNLOCK_POINTS, exploreCost, insightOf, luckOf, NO_EXPLORE_MODS, openRarities, rarityOdds, rollExplore,
} from '../src/game/explore.ts'
import {
  GATE, dur, greedyTree, mergeMods, pointsOf, runLife, treeLevels, treeMods, treasureMods,
} from './life-engine.mjs'

const TARGET_LOG = 36
const STEPS = (process.argv[2] ?? '10,20,40').split(',').map(Number)
const LIVES = Number(process.argv[3] ?? 4000)
const SEED0 = Number(process.argv[4] ?? 20261016)
const LAYERS = TREASURES.reduce((a, t) => a + t.cap, 0)

/** 见识摊平着买四条，返回花剩的零头（和 src/game/state.ts 的一键购买同一条贪心） */
function buyBench(bench, bank) {
  let left = bank
  for (;;) {
    let pick = ''
    let price = Infinity
    for (const def of EXPLORE_TREE) {
      const c = exploreCost(bench[def.id] ?? 0)
      if (c <= left && c < price) { pick = def.id; price = c }
    }
    if (!pick) return left
    bench[pick] = (bench[pick] ?? 0) + 1
    left -= price
  }
}

/**
 * 这一次押注怎么算：能不能挖（`ok` 为假就整世不动手）、挖几铲 `n`、真正花掉 `fee` 点、
 * 挖完手上还剩 `left` 点、押上去的点折 `stake` 见识（10:1，收资按 gain 加成，同 explore.ts 的 insightOfStake）。
 */
function planOf(variant, points, tieChanLv, step, gain) {
  const cap = 1 + tieChanLv
  const round = step * cap
  const fold = (p) => Math.round((p / 10) * gain)
  const byStake = Math.min(cap, Math.floor(points / step))
  switch (variant) {
    case 'B0': return points >= 1 ? { n: cap, fee: points, left: 0, stake: fold(points) } : null
    case 'B1': return points >= step ? { n: byStake, fee: points, left: 0, stake: 0 } : null
    case 'B2': return points >= step ? { n: byStake, fee: points, left: 0, stake: fold(Math.max(0, points - byStake * step)) } : null
    case 'B3': return points >= step ? { n: cap, fee: points, left: 0, stake: fold(points) } : null
    case 'B4': return points >= round ? { n: cap, fee: points, left: 0, stake: fold(points) } : null
    case 'B5': return points >= round ? { n: cap, fee: round, left: points - round, stake: fold(round) } : null
    case 'B6': return points >= step ? { n: cap, fee: step, left: points - step, stake: fold(step) } : null
  }
  throw new Error(`未知方案 ${variant}`)
}

/** reserve 打法要先留在手上那一笔；B5/B6 的余款本来就留在手上，不必再算 */
function reserveOf(variant, points, tieChanLv, step) {
  const cap = 1 + tieChanLv
  if (variant === 'B1' || variant === 'B2') return step * Math.min(cap, Math.floor(points / step))
  if (variant === 'B3' || variant === 'B6') return step
  return step * cap
}

function run(variant, step, policy) {
  const lv = {}
  const bench = {}
  const treasures = Object.fromEntries(TREASURES.map((t) => [t.id, 0]))
  const modsOf = () => {
    const m = treeMods(lv)
    m.energyAdd = 0.05 * (bench.cuiLian ?? 0)
    return mergeMods(m, treasureMods(treasures))
  }
  const exploreModsOf = () => ({
    ...NO_EXPLORE_MODS,
    yanLi: bench.yanLi ?? 0,
    insightGain: 0.2 * (bench.shouZi ?? 0),
  })

  let seed = SEED0
  let points = 0
  let bank = 0
  let earned = 0
  let insightTotal = 0
  let fromStake = 0
  let fromShovel = 0
  let digs = 0
  let shovelTotal = 0
  let capHits = 0
  let skipped = 0
  let seconds = 0
  const marks = {}
  const layerCount = () => TREASURES.reduce((a, t) => a + Math.min(t.cap, treasures[t.id] ?? 0), 0)
  const perLife = []

  for (let life = 0; life < LIVES; life++) {
    const mods = modsOf()
    const r = runLife({ mods, target: GATE })
    if (r.timedOut) break
    seconds += r.t
    const got = pointsOf(r.earned, life, mods.pointAdd)
    earned += got
    points += got
    perLife.push(got)

    const unlocked = earned >= EXPLORE_UNLOCK_POINTS
    if (policy === 'reserve' && unlocked) {
      const want = reserveOf(variant, points, bench.tieChan ?? 0, step)
      points = want + greedyTree(points - want, lv)
    } else {
      points = greedyTree(points, lv)
    }

    const em = exploreModsOf()
    const p = planOf(variant, points, bench.tieChan ?? 0, step, 1 + em.insightGain)
    if (unlocked && p) {
      const out = rollExplore(points, seed, treasures, { ...em, tieChan: p.n - 1 })
      seed = out.seed
      for (const [id, level] of Object.entries(out.levels)) treasures[id] = level
      bank += out.insight + p.stake
      insightTotal += out.insight + p.stake
      fromStake += p.stake
      fromShovel += out.insight
      points = p.left
      digs++
      shovelTotal += p.n
      if (p.n >= 1 + (bench.tieChan ?? 0)) capHits++
      bank = buyBench(bench, bank)
    } else if (unlocked) {
      skipped++
    }
    if (!marks.all && TREASURES.every((t) => (treasures[t.id] ?? 0) >= t.cap)) marks.all = seconds
  }

  const em = exploreModsOf()
  const odds = rarityOdds(em.yanLi, luckOf(treasures, em), openRarities(treasures))
  const perShovel = odds.fan * insightOf('fan', em) + odds.ling * insightOf('ling', em) + odds.xian * insightOf('xian', em)
  const end = runLife({ mods: modsOf(), target: 10 ** TARGET_LOG })
  const late = perLife.slice(-200)
  return {
    variant, step, policy, digs, skipped,
    capRate: digs ? capHits / digs : 0,
    avgShovel: digs ? shovelTotal / digs : 0,
    layers: layerCount(), insightTotal, fromStake, fromShovel, seconds,
    bench: { ...bench }, tree: treeLevels(lv), marks, perShovel,
    perLifeEarly: perLife[0] ?? 0,
    perLifeLate: late.length ? late.reduce((a, b) => a + b, 0) / late.length : 0,
    e36: end.timedOut ? null : end.t,
  }
}

const VARIANTS = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']
const rows = []
// B0 永远押全部，两种打法是同一条路，摆一次就够
const b0 = run('B0', 0, 'crumbs')
rows.push(b0, { ...b0, policy: 'reserve' })
for (const policy of ['crumbs', 'reserve']) {
  for (const step of STEPS) {
    // 余款留得住的方案没有"先留一笔"这种第二种打法
    const list = policy === 'reserve' ? VARIANTS.filter((v) => v !== 'B5' && v !== 'B6') : VARIANTS
    for (const variant of list) rows.push(run(variant, step, policy))
  }
}

console.log(`${LAYERS} 层法宝 · 鉴宝台 1.6^lv · 根骨不限等 · 摸到 1e10 就破境，跑 ${LIVES} 世，种子 ${SEED0}`)
console.log('押了就清零 ⇒ 一世最多押一次：探索次数 ≤ 破境次数；根骨要跨世攒钱，所以"挖不挖"直接动到 1e36\n')
console.log('打法    方案 步长 探索次数 弃挖世  铲/次  达顶率 法宝层数    见识(押|铲) 每世点(早/晚) 根骨 鉴宝台四条              满池     一铲期望  挂到 1e36')
for (const r of rows) {
  const lv = EXPLORE_TREE.map((d) => `${d.name}${r.bench[d.id] ?? 0}`).join('')
  console.log(
    `${r.policy.padEnd(7)} ${r.variant} ${String(r.variant === 'B0' ? '—' : r.step).padStart(4)} ${String(r.digs).padStart(7)}` +
    ` ${String(r.skipped).padStart(6)} ${r.avgShovel.toFixed(2).padStart(6)} ${(r.capRate * 100).toFixed(0).padStart(5)}%` +
    ` ${String(r.layers).padStart(6)}/${LAYERS}` +
    ` ${(r.insightTotal / 1e4).toFixed(1).padStart(6)}万(${(r.fromStake / 1e4).toFixed(1)}|${(r.fromShovel / 1e4).toFixed(1)})` +
    ` ${String(Math.round(r.perLifeEarly)).padStart(4)}/${r.perLifeLate.toFixed(1).padStart(5)}` +
    ` ${String(r.tree).padStart(4)} ${lv.padEnd(21)}` +
    ` ${String(r.marks.all ? dur(r.marks.all) : '未到').padStart(7)}` +
    ` ${r.perShovel.toFixed(1).padStart(7)}  ${r.e36 === null ? '撞上限' : dur(r.e36)}`,
  )
}
console.log('\n注：见识括号里左边是押注折的、右边是"挖到已圆满法宝"改攒的；根骨那一列是五条根骨行的总级数。')
console.log('达顶率＝押注真能挖满 1+铁铲 铲的比例。B1/B2 把铲数交给押注之后，后期每世只有 20 来点，封顶基本碰不到。')
