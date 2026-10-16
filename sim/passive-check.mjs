// 金丹开张之后：练气不再破境，改为每秒按累计灵气折给筑基点。
// 这里量四件事——每秒到底折给多少、会不会变成复利滚雪球、破境那颗按钮是不是真关死了、
// 结丹三层这个门槛要挂多久。全部走运行时函数，不在这里另立一份价目表。
// 用法：node --import ./sim/ts-hook.mjs sim/passive-check.mjs
import { BigNumber } from '../src/game/BigNumber.ts'
import { POINT_PASS_RATE, JIEDAN_AUTO_UNLOCK_LAYERS, REBIRTH_TREE, EXPLORE_TREE, TREASURES } from '../src/game/词条与属性.ts'
import { REALMS } from '../src/game/realms.ts'
import { rebirthCost } from '../src/game/rebirth.ts'
import { exploreCost, NO_EXPLORE_MODS } from '../src/game/explore.ts'
import {
  state, pointLump, pointPassPerSecond, settlePointPass, realmToBreakThrough, pillUnlocked, recompute,
} from '../src/game/state.ts'
import { bareMods, mergeMods, treeMods, treasureMods, runLife, dur } from './life-engine.mjs'

const GOLDEN = REALMS.find((r) => r.id === 'jindan')
const JINDAN_LOG = GOLDEN.breakThrough.log10()
const DAY = 86400

/** 把存档摆成"金丹刚开张"的样子：灵气过 1e30、丹炉第 12 级、还没结过丹 */
function atPillStart(qiLog = JINDAN_LOG) {
  state.loops = 8
  state.spirit = new BigNumber(1, qiLog)
  state.loopEarned = state.totalEarned = new BigNumber(1, qiLog)
  state.pillLevels = { danLu: 12, huoHou: 0, danFang: 0 }
  state.jindan = 0
  state.pillAnchor = 1e4
  state.points = 0
  state.pointsEarned = 0
  state.loopBanked = 0
  recompute()
}

/** 挂 hours 小时落袋多少整点（先清零头，量的是这一段里的进出） */
function accrue(hours) {
  const before = state.points
  state.loopBanked = 0
  settlePointPass(hours * 3600)
  return state.points - before
}

/** 价目表还能读到的最高一级（rebirthCost/exploreCost 涨到溢出 double 就封顶） */
function lastReadableLv(costOf) {
  let lv = 0
  while (lv < 5000 && Number.isFinite(costOf(lv))) lv++
  return lv
}

console.log(`折给比例 ${POINT_PASS_RATE * 100}% · 结丹 ${JIEDAN_AUTO_UNLOCK_LAYERS} 层解锁代买 · 筑基门槛 1e10，金丹门槛 1e${JINDAN_LOG}`)
console.log('小知识留的口子在这儿：比例只有 POINT_PASS_RATE 这一个数，后续词条要改就改它。')

/* ------------------------------------------------------ 每秒折给多少 */

console.log('\n【每秒折给多少】基数 = 破境那一笔（pointsForLoop(累计灵气) + 破境加餐），一世挂到哪就到哪')
atPillStart()
for (const d of [30, 36, 40, 45, 50, 60, 100]) {
  state.totalEarned = state.loopEarned = new BigNumber(1, d)
  recompute()
  const per = pointPassPerSecond()
  console.log(
    `  灵气 1e${String(d).padEnd(3)} · 每秒 ${per.toFixed(2)} 点 · 一天 ${(per * DAY).toExponential(2)} 点` +
      ` · 同样这一世手动破一次只给 ${Math.round(per / POINT_PASS_RATE)} 点`,
  )
}

/* ---------------------------------------------------------- 护栏一 */

console.log('\n【护栏一 · 没有复利】折来的筑基点不能反过来喂灵气，否则 1% 秒息一天翻一天')
atPillStart(60)
const qiBefore = state.totalEarned.log10()
const dayIn = accrue(24)
const qiAfter = state.totalEarned.log10()
console.log(
  `  灵气 1e60 挂一天：进账 ${dayIn} 点 · 累计灵气 1e${qiBefore.toFixed(3)} → 1e${qiAfter.toFixed(3)}` +
    `（${qiBefore === qiAfter ? '一点没动：进项不喂灵气' : '竟然被喂大了，护栏塌了'}）`,
)
console.log(
  `  复利对照：要按余额每秒 1% 算，同样一天就翻 1e${Math.round(DAY * Math.log10(1.01))} 倍，根骨树当天点到头` +
    ` —— 所以基数只能挂在累计灵气这条轴上，不做成存款利息`,
)
console.log(`  挂一个月：进账 ${accrue(24 * 30)} 点 · 灵气仍 1e${state.totalEarned.log10().toFixed(3)}`)

/* ---------------------------------------------------------- 护栏二 */

console.log('\n【护栏二 · 破境已撤】按钮、字据、结算得一起关死，别留半扇窗')
atPillStart()
const realm = realmToBreakThrough()
console.log(
  `  金丹已开张（pillUnlocked=${pillUnlocked()}）→ realmToBreakThrough() 给 ${realm === null ? 'null，三头一起关' : realm.realm.name}` +
    ` · 每秒折给 ${pointPassPerSecond().toFixed(2)} 点`,
)
state.totalEarned = state.loopEarned = new BigNumber(1, JINDAN_LOG - 1)
recompute()
const back = realmToBreakThrough()
console.log(
  `  累计灵气退回 1e${JINDAN_LOG - 1}（金丹还没开张）→ ${back ? back.realm.name + ' 照旧可破' : 'null'}` +
    ` · 每秒折给 ${pointPassPerSecond()} 点（停工）`,
)
console.log('  注：这条进项跟着 pillUnlocked() 走，而它看的是累计灵气到过 1e30；结丹散功也不回退，所以开关只朝一个方向翻')

/* ---------------------------------------------------------- 护栏三 */

console.log('\n【护栏三 · 零头不啃本金】点数始终是整数，探索押注 floor(points) 不能被折给的小数坑掉')
atPillStart()
const per = pointPassPerSecond()
let sum = 0
let dirty = 0
for (let i = 0; i < 4000; i++) {
  sum += settlePointPass(1)
  if (!Number.isInteger(state.points) || !Number.isInteger(state.pointsEarned)) dirty++
}
const exact = per * 4000
console.log(
  `  每秒 ${per.toFixed(3)} 点这种非整数速率，逐秒结 4000 次：落袋 ${sum} 点 · 零头 ${state.loopBanked.toFixed(4)}` +
    `（${state.loopBanked >= 0 && state.loopBanked < 1 ? '规规矩矩待在 0..1' : '跑出 0..1 了'}）`,
)
console.log(
  `  应得 ${exact.toFixed(4)} = 落袋 ${sum} + 在路上 ${state.loopBanked.toFixed(4)} → ` +
    `${Math.abs(exact - sum - state.loopBanked) < 1e-6 ? '账平，一点不吞' : '对不上，有零头被啃掉'}` +
    ` · 整数校验：${dirty === 0 ? '全程没有半个点' : `有 ${dirty} 次不是整数，砸了`}`,
)
state.points = 3
state.loopBanked = 0.9
const got = settlePointPass(1)
console.log(
  `  手上 3 点 + 0.9 零头再过 1 秒：进账 ${got} 点 → ${state.points} 点 · 零头 ${state.loopBanked.toFixed(4)}` +
    ` · floor(points)=${Math.floor(state.points)}（探索押的就是这个数）`,
)

/* ---------------------------------------------------------- 护栏四 */

console.log(`\n【护栏四 · 结丹 ${JIEDAN_AUTO_UNLOCK_LAYERS} 层要挂多久】门槛 = 丹炉 Lv.12 + 灵气 1e${JINDAN_LOG} 存量`)
const TRE = Object.fromEntries(TREASURES.map((t) => [t.id, t.cap]))
const END_LOG = JINDAN_LOG
const LAYERS = [1, 2, 3, 6, 12]
const STAGES = [
  ['法宝都没收', null],
  ['法宝刚收齐', { daoJi: 8, lingGen: 8, wuXing: 8, huiGen: 8, yuanFa: 8 }],
  ['再挂两千世', { daoJi: 15, lingGen: 15, wuXing: 15, huiGen: 15, yuanFa: 15 }],
]
const runs = []
for (const [stageName, rebirth] of STAGES) {
  const mods = rebirth ? mergeMods(treeMods(rebirth), treasureMods(TRE)) : mergeMods(bareMods(), NO_EXPLORE_MODS)
  const r = runLife({ mods, target: 10 ** END_LOG })
  // 把这一世末尾的存档摆出来，问运行时"按秒折给到底给多少"——加餐（缘法、混沌钟）由 pointLump 自己算
  atPillStart(END_LOG)
  state.rebirth = { ...(rebirth ?? {}) }
  if (rebirth) state.treasures = { ...TRE }
  recompute()
  const lump = pointLump(state.totalEarned)
  const rate = pointPassPerSecond()
  runs.push({ stageName, T: r.t, lump, rate })
  console.log(`  ${stageName} · 一世挂到 1e${END_LOG} 要 ${dur(r.t)} → 手动破境 ${lump} 点 → 每秒折给 ${rate.toFixed(2)} 点`)
  for (const k of LAYERS) {
    // 每结一层回溯 +100%，下一世时长严格除以 (1+n)：第 n 层累计 = r.t ×(2 − 2^(1−n))
    console.log(`    到第 ${String(k).padStart(2)} 层：累计 ${dur(r.t * (2 - 2 ** (1 - k)))}`)
  }
}
console.log(
  '  注：第一行是"金丹存量门槛过了但法宝一条没收"的路，1166 年——结丹事实上要求先把法宝收齐；' +
    '丹炉链（定标档挂 12 小时过 Lv.12）与攒这一世灵气并行挂，所以常态路线（第二行）的第一层比它短。',
)
console.log('     三层就是"在金丹这条链上走过三遭"，一天半的账，不是又要挂三年。')

/* -------------------------------------------------- 对照·旧流程给多少 */

console.log('\n【对照 · 旧流程同样这段时间给多少】手动破一次只结算一笔，还得把整世灵气散掉')
for (const it of runs) {
  const drip = it.rate * it.T
  console.log(
    `  ${it.stageName} · 一世 ${dur(it.T)}：旧规矩 ${it.lump} 点（散掉 1e${END_LOG} 灵气换）` +
      ` vs 按秒折给 ${drip.toFixed(0)} 点 = ${Math.round(drip / it.lump)} 倍`,
  )
}
atPillStart(END_LOG)
const dayIn2 = accrue(24)
// 一天的进项够把道基从 0 级点到哪一级（×1.5/级，累计付账）
let lv = 0
let bill = 0
while (Number.isFinite(rebirthCost(lv)) && bill + rebirthCost(lv) <= dayIn2) {
  bill += rebirthCost(lv)
  lv++
}
console.log(
  `  这倍数就是"不必重复参与旧东西"折成的价：灵气 1e${END_LOG} 时一天进项 ${dayIn2} 点，` +
    `第一天能把道基点到 Lv.${lv}（花掉 ${bill} 点），之后一个月才动一级——正反馈跑不出来`,
)

/* ------------------------------------------------------ 顺带·两张树 */

console.log('\n【顺带 · 代买解锁的两张树】免掉的是重复点击，天花板看价目表还在不在 double 里')
console.log(
  `  根骨 ${REBIRTH_TREE.map((t) => t.name).join('/')} · ×1.5/级，double 读到 Lv.${lastReadableLv(rebirthCost)}`,
)
console.log(
  `  鉴宝 ${EXPLORE_TREE.map((t) => t.name).join('/')} · ×1.6/级更陡，Lv.${lastReadableLv(exploreCost)} 封顶；` +
    `摸到 Lv.12 得押 ${exploreCost(11)} 点一把`,
)
const toLv6 = Array.from({ length: 6 }, (_, lv) => exploreCost(lv)).reduce((a, b) => a + b, 0) * EXPLORE_TREE.length
console.log(
  `  鉴宝台四条线从零各买到 Lv.6 一共 ${toLv6} 点，而灵气 1e60 时一天进项就有 ${dayIn} 点：` +
    `代买免掉的正是"每天回来把这四条再点一遍"这种重复点击`,
)
console.log('  押注那一下没动：把筑基点全压上去抽一铲仍是人手按的，结丹和探索两个门槛照旧要玩家自己走过去')
