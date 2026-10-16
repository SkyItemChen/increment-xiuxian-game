// 离线收益（闭关）：两帧之间空出的墙钟，折成产出补上。钉四件事——
//   1. 只补产出。代买一栏都不跑：离线不该把法门、丹炉、根骨、鉴宝台、转盘买空；
//   2. 不加游玩时间。顶栏那个数是"人在这儿修了多久"，挂着不管的时辰不记在它头上；
//   3. 封顶 8 小时，且不跟在线那一帧重复计账（同一秒只结一次）；
//   4. 结的账跟在线挂着一模一样：吐纳按整周期、丹一炉一炉、筑基点按秒折。
// 跑的全是运行时函数，sim 里不留第二份产出式子。
// 用法：node --import ./sim/ts-hook.mjs sim/offline-check.mjs
import { BigNumber } from '../src/game/BigNumber.ts'
import {
  findPillMode,
  OFFLINE_CAP_SECONDS,
  OFFLINE_REPORT_SECONDS,
  ONLINE_FRAME_MAX_SECONDS,
} from '../src/game/词条与属性.ts'
import { bustChance, dregYieldMult } from '../src/game/凝练.ts'
import {
  PILL_PERIOD,
  exportSave,
  fmt,
  importSave,
  offlineIdleSeconds,
  offlineReport,
  pillUnlocked,
  recompute,
  settleAwayGap,
  settleOffline,
  state,
} from '../src/game/state.ts'

const HOUR = 3600
const ok = (b) => (b ? '✓' : '✗')

/**
 * 摆状态并把周期零头清干净：运行时只有读档才把两格进度归零，
 * 所以这里绕一圈存档（导出再原样贴回来），顺手也验了一次"这些账带得动存档"。
 */
function stage(cfg) {
  Object.assign(state, cfg)
  recompute()
  importSave(exportSave())
}

/** 练气一世：手上灵气摆到 qiLog，丹炉还没开张 */
function atLianqi(qiLog, levels = { lianqi_tuNa: 12, lianqi_zhouTian: 6 }) {
  stage({
    phase: 'playing',
    realmIndex: 0,
    levels,
    spirit: new BigNumber(1, qiLog),
    totalEarned: new BigNumber(1, qiLog),
    loopEarned: new BigNumber(1, qiLog),
    pillLevels: {},
    jindan: 0,
    pillAnchor: 0,
    dan: BigNumber.zero(),
    dreg: BigNumber.zero(),
    points: 0,
    pointsEarned: 0,
    loopBanked: 0,
    totalGathers: 0,
    totalTime: 0,
    treasures: {},
    spirits: {},
    pulls: 0,
    explores: 0,
    insight: 0,
    insightEarned: 0,
    exploreLevels: {},
    rebirth: {},
  })
}

/** 金丹已开张：灵气过线、炉子第 12 级，丹与废渣都攒得动 */
function atJindan(qiLog) {
  atLianqi(qiLog, { lianqi_tuNa: 30, lianqi_zhouTian: 18, lianqi_ziFu: 8 })
  stage({
    pillLevels: { danLu: 12, huoHou: 4, danFang: 0 },
    pillMode: 'steady',
    pillAnchor: 1e4,
    spirits: { wuHuo: 3, shouYi: 2 },
  })
}

console.log(
  `闭关封顶 ${OFFLINE_CAP_SECONDS / HOUR} 小时 · 在线一帧最长按 ${ONLINE_FRAME_MAX_SECONDS} 秒算` +
    ` · 满 ${OFFLINE_REPORT_SECONDS} 秒才弹出关字据`,
)

/* ------------------------------------------------- 一 · 封顶与不重不漏 */

console.log('\n【一 · 墙钟空档怎么折】这一帧已按在线走过的秒数要先扣掉，免得同一秒结两遍')
const gaps = [
  [8 * HOUR, ONLINE_FRAME_MAX_SECONDS, 8 * HOUR - ONLINE_FRAME_MAX_SECONDS, '切后台八小时'],
  [100 * HOUR, ONLINE_FRAME_MAX_SECONDS, OFFLINE_CAP_SECONDS, '整三天没打开：封顶到八小时'],
  [8 * HOUR + 600, ONLINE_FRAME_MAX_SECONDS, OFFLINE_CAP_SECONDS, '再多一分钟也不给，墙就砌在这儿'],
  [3, ONLINE_FRAME_MAX_SECONDS, 0, '一次普通掉帧：还不够一秒闭关，不补'],
  [-999, 0, 0, '系统时钟被拨回去：不给凭空的进项'],
  [0, 0, 0, '同一毫秒里再问一次：什么都没有'],
]
for (const [away, credited, want, note] of gaps) {
  const got = offlineIdleSeconds(away, credited)
  console.log(
    `  空档 ${away.toFixed(0).padStart(5)} 秒 · 在线走了 ${credited} 秒 → 离线补 ${got.toFixed(0).padStart(5)} 秒` +
      ` ${ok(got === want)}（${note}）`,
  )
}

/* --------------------------------------------------------- 二 · 账平 */

console.log('\n【二 · 账平】离线补的产出必须等于"速率 × 整周期数"，一口不吞、一口不多')
atLianqi(6)
const rate = state.spiritPerSecond.clone()
const period = state.gatherSeconds
const cycles = Math.floor((8 * HOUR) / period)
const rep = settleOffline(8 * HOUR)
const should = state.spiritPerGather.mulNumber(cycles)
console.log(
  `  灵气/秒 ${fmt(rate)} · 吐纳一格 ${period.toFixed(3)} 秒 · 闭关 8 小时 → 进账 ${fmt(rep.qi)}`,
)
console.log(
  `  应得（${cycles} 格 × 每格 ${fmt(state.spiritPerGather)}）= ${fmt(should)} ` +
    `→ 账平 ${ok(rep.qi.cmp(should) === 0)} · 次数对上 ${ok(rep.gathers === cycles && state.totalGathers === cycles)}`,
)
console.log(
  `  尾巴上那 ${((8 * HOUR - cycles * period)).toFixed(2)} 秒不满一格，留在进度条上：` +
    `进度 ${(state.gatherProgress * 100).toFixed(1)}% ${ok(state.gatherProgress < 1)}`,
)
console.log(
  `  丹炉没开张：丹 ${fmt(rep.dan)} · 废渣 ${fmt(rep.dreg)} · 筑基点 ${rep.points} 点` +
    ` ${ok(!pillUnlocked() && rep.dan.isZero && rep.dreg.isZero && rep.points === 0)}` +
    ` —— 跟在线同一只手掐的，不攒没人看得见的丹`,
)

console.log('\n  零头不丢：把八小时切成 96 段短闭关，累计账要跟一次长的分毫不差')
atLianqi(6)
const chunk = (8 * HOUR) / 96
let splitQi = BigNumber.zero()
let splitCycles = 0
for (let i = 0; i < 96; i++) {
  const one = settleOffline(chunk)
  splitQi = splitQi.add(one.qi)
  splitCycles += one.gathers
}
const drift = (splitQi.toNumber() - rep.qi.toNumber()) / rep.qi.toNumber()
console.log(
  `  96 段各 ${(chunk / 60).toFixed(1)} 分钟 → ${fmt(splitQi)}（${splitCycles} 次吐纳）` +
    ` vs 一次八小时 ${fmt(rep.qi)}（${rep.gathers} 次）`,
)
console.log(
  `  次数一分不差 ${ok(splitCycles === rep.gathers)} · 灵气相对差 ${drift.toExponential(2)}` +
    `（大数加法对齐尾数留下的浮点毛刺，不是吞账）${ok(Math.abs(drift) < 1e-12)}`,
)

/* --------------------------------------------- 三 · 代买一栏都不跑 */

console.log('\n【三 · 代买不跑】五个开关全拨开，闭关八小时也不能替玩家买一样东西')
atJindan(30)
state.settings = {
  ...state.settings,
  autoSave: false,
  autoBuyCultivate: true,
  autoBuyPill: true,
  autoBuyRebirth: true,
  autoBuyExplore: true,
  autoBuyPull: true,
}
state.points = 5000
state.insight = 400
state.insightEarned = 400
state.dreg = new BigNumber(5, 20)
state.pulls = 0
stage({})
const snap = () =>
  JSON.stringify([
    state.levels, state.pillLevels, state.rebirth, state.exploreLevels, state.spirits,
    state.insight, state.pulls, state.jindan, state.explores,
  ])
const before = snap()
const qiBefore = state.spirit.clone()
const dregBefore = state.dreg.clone()
const pointsBefore = state.points
const off = settleOffline(8 * HOUR)
const after = snap()
console.log(`  闭关前：${before.slice(0, 76)}…`)
console.log(`  闭关后：${after.slice(0, 76)}…`)
console.log(
  `  该玩家自己拿主意的东西一个没动 ${ok(before === after)}` +
    `（法门/丹炉/根骨/鉴宝/精神/见识/抽数/结丹/探索九笔全对）`,
)
console.log(
  `  筑基点只进不出：压着手 ${pointsBefore} 点，闭关后 ${state.points} 点 = ${pointsBefore} + 折进 ${off.points}` +
    ` ${ok(state.points === pointsBefore + off.points)} —— 一分没花，替玩家攒着等他回来花`,
)
console.log(
  `  废渣只进不出：旧底 ${fmt(dregBefore)} 上又添炸炉新出的 ${fmt(off.dreg)}，转盘一次没转、没替玩家抽走` +
    ` ${ok(state.dreg.cmp(dregBefore.add(off.dreg)) === 0 && state.pulls === 0)}`,
)
console.log(
  `  灵气也只进不出：${fmt(qiBefore)} → ${fmt(state.spirit)} ${ok(state.spirit.cmp(qiBefore.add(off.qi)) === 0)}` +
    `（进账 ${fmt(off.qi)}，在这档流量下已够不上尾数，账是按 ${fmt(qiBefore.add(off.qi))} 那个方向走的）`,
)
console.log(
  `  丹照常炼：开 ${off.batches} 炉（${(8 * HOUR) / PILL_PERIOD} 炉整）→ 丹 ${fmt(off.dan)} · 废渣 ${fmt(off.dreg)}`,
)
const mode = findPillMode(state.pillMode)
const nominal = state.danPerSecond.mulNumber(PILL_PERIOD * off.batches)
const back = off.dan.mulNumber(1 / mode.yieldMult).add(off.dreg.mulNumber(1 / dregYieldMult(mode, state.spirits)))
console.log(
  `  一炉不是成就是炸，两笔账折回名义出丹：名义 ${fmt(nominal)} vs 折回 ${fmt(back)} ` +
    `· 差 ${(back.log10() - nominal.log10()).toFixed(10)} 个数量级 ${ok(Math.abs(back.log10() - nominal.log10()) < 1e-9)}` +
    `（炸炉机会 ${(bustChance(mode, state.spirits) * 100).toFixed(0)}%）`,
)

console.log('\n  按秒折筑基点照常跑（它是产出，不是"买"）：')
atJindan(30)
const pWhole = settleOffline(8 * HOUR).points
atJindan(30)
let pSplit = 0
for (let i = 0; i < 480; i++) pSplit += settleOffline((8 * HOUR) / 480).points
console.log(
  `  一次八小时 ${pWhole} 点 vs 拆 480 段 ${pSplit} 点 ${ok(pWhole === pSplit)}` +
    ` —— 零头记在 loopBanked（现在 ${state.loopBanked.toFixed(6)}），切成两段的闭关啃不掉它`,
)

/* -------------------------------------------------- 四 · 不吃游玩时间 */

console.log('\n【四 · 游玩时间不吃离线】顶栏念的是在线时长，闭关不往里添')
atJindan(30)
const played = state.totalTime
settleOffline(8 * HOUR)
console.log(
  `  闭关前 ${played} 秒 → 闭关后 ${state.totalTime} 秒 ${ok(state.totalTime === played)}` +
    ` · 只有 tick 的 dt 加它，而 dt 的真实帧长封顶 ${ONLINE_FRAME_MAX_SECONDS} 秒`,
)

/* ---------------------------------------------------- 五 · 八小时值多少 */

console.log('\n【五 · 八小时到底给多少】睡一觉与整月不打开，落在同一个数上')
const STAGES = [
  ['练气起手', () => atLianqi(3)],
  ['筑基路上', () => atLianqi(10, { lianqi_tuNa: 22, lianqi_zhouTian: 12, lianqi_ziFu: 4 })],
  ['金丹线 1e30', () => atJindan(30)],
  ['灵气 1e60', () => atJindan(60)],
]
for (const [name, setup] of STAGES) {
  setup()
  const r = settleOffline(offlineIdleSeconds(8 * HOUR, 0))
  setup()
  const r3 = settleOffline(offlineIdleSeconds(100 * HOUR, 0))
  console.log(
    `  ${name.padEnd(12)} · 闭关 8 小时：灵气 ${fmt(r.qi)} · 丹 ${fmt(r.dan)} · 废渣 ${fmt(r.dreg)} · 筑基点 ${r.points} 点`,
  )
  console.log(
    `    整三天没打开：灵气 ${fmt(r3.qi)} → ${r3.qi.cmp(r.qi) === 0 ? '跟八小时一模一样，封顶吃住了' : '竟超过了八小时那一档，封顶漏了'}`,
  )
}

console.log('\n【六 · 测速档不掺和】全局速度是给测试加速的，只该放大"人在这儿"的那几帧')
for (const speed of [1, 10, 100]) {
  atJindan(30)
  state.settings.globalSpeed = speed
  recompute()
  importSave(exportSave())
  offlineReport.value = null
  const settled = settleAwayGap(100 * HOUR, ONLINE_FRAME_MAX_SECONDS)
  const card = offlineReport.value
  console.log(
    `  速度 ×${String(speed).padStart(3)} · 墙钟空档一百小时 → 补 ${settled} 秒（${(settled / HOUR).toFixed(2)} 小时）` +
      ` · 字据念 ${(card.seconds / HOUR).toFixed(2)} 小时 · 灵气 ${fmt(card.qi)}` +
      ` ${ok(settled === OFFLINE_CAP_SECONDS && card.seconds === OFFLINE_CAP_SECONDS)}`,
  )
}
console.log('  这一条是修出来的：以前这里乘了 globalSpeed，测试档拧到 100 就把 8 小时的顶变成三天。')

console.log('\n  一句话：闭关给的是"挂在那儿本来就该有的那一串产出"，不给的是"替你把点数花掉"。')
