// 元婴定标：解 K、量三档首破时长、并把"线性产量 vs 平方根产量"的差别摆出来。
// 数学全部来自 src/game/元婴.ts；旧锚用 sim/life-engine.mjs 现跑，不在这里留第二份价目表。
//
// 用法：node --import ./sim/ts-hook.mjs sim/yuan-anchor.mjs
import {
  YUAN_K, YUAN_CAL_ANCHOR_LOG10, YUAN_FIRST_BREAK_SECONDS,
  YUAN_MODES, yuanBreakSeconds, yuanRateLog10, yuanThresholdLog10,
} from '../src/game/元婴.ts'
import { TREASURES, LIANQI_UPGRADES } from '../src/game/词条与属性.ts'
import { runLife, treeMods, treasureMods, mergeMods, bareMods, dur } from './life-engine.mjs'

const HOUR = 3600

/** 从一生结束时的等级表反推灵气/秒（log10），与 life-engine 的 incomeLog 同一条式子 */
function endFlowLog10(r, mods) {
  let autoBase = 0
  let powerLog = 0
  let multLog = 0
  let speedLog = 0
  for (const it of LIANQI_UPGRADES) {
    const n = r.lv[it.id] || 0
    if (!n) continue
    if (it.kind === 'auto-base') autoBase += it.power * n
    else if (it.kind === 'auto-power') powerLog += n * Math.log10(it.power)
    else if (it.kind === 'auto-mult') multLog += n * Math.log10(it.power)
    else speedLog += n * Math.log10(it.power)
  }
  const perSecond = autoBase * 10 ** powerLog * 10 ** multLog * (1 + mods.outputAdd)
  const rateLog = Math.log10(
    (1 + mods.tAutoBase + perSecond) * 10 ** mods.tAutoMultLog * (1 + mods.globalAdd + mods.energyAdd),
  )
  return rateLog + mods.tSpeedLog + speedLog
}

console.log('【定标】t = K × 10^(25 − 锚/2) / 模式倍率（线性版）· 平方根版下 t = K × 1e10 / 模式倍率')
console.log(`  K = ${YUAN_K.toExponential(3)} · 定标锚 1e${YUAN_CAL_ANCHOR_LOG10} · 守神目标 ${dur(YUAN_FIRST_BREAK_SECONDS)}`)
console.log(`  阈值 log10 = log${YUAN_K.toExponential(3)} + 0.5 × (锚 + 40)`)

console.log('\n【三档首破】定标锚 1e30（设计稿口径）· 神炼 0 级')
for (const m of YUAN_MODES) {
  const sqrt = yuanBreakSeconds(YUAN_CAL_ANCHOR_LOG10, m, 0, 'sqrt')
  console.log(`  ${m.name} ×${m.yuanMul.toFixed(2)}  平方根版 ${dur(sqrt).padStart(9)}`)
}
console.log('  三档目标 62 / 31 / 14 小时彼此对不上：2.20 与 4.50 的倍率比是 2.05 与 2.04，')
console.log('  要 31h 就得 凝魄 ×2、要 14h 就得 夺舍 ×4.43；设计稿取整成了 2.20 / 4.50，')
console.log('  所以 62h 锚只能保住 守神，另外两档落在 28.2h / 13.6h（夺舍取 3.20 时是 19.4h，见凹性脚本）。')

console.log('\n【线性产量 × 实际锚】设计稿原式：产量 = 锚 × 1e-5，阈值 = K√(锚 × 1e40)')
console.log('  锚涨得越快，首破越短——因为产量按锚一次方走，阈值只按平方根走')
const ANCHORS = [30, 36, 40, 47.6, 58.4]
for (const a of ANCHORS) {
  const cells = YUAN_MODES.map((m) => `${m.name} ${dur(yuanBreakSeconds(a, m, 0, 'linear'))}`)
  console.log(`  锚 1e${String(a).padEnd(4)}  ${cells.join(' · ')}`)
}
console.log('  1e47.6 / 1e58.4 是旧文档误当成"摸到 1e100 时"的锚；现跑的单世在 1e31 秒上限处只到 1e49.6 / 1e58.4：')
console.log('  线性版在这两个锚上首破已经是 10^-4 ~ 10^-12 秒，14~62h 的目标完全失效。')

console.log('\n【平方根产量】推荐式：产量 = √(锚 × 1e40) × 1e-10，阈值不变')
console.log('  产量与阈值同阶，首破与锚无关：守神 62.0h / 凝魄 28.2h / 夺舍 19.4h')
for (const a of ANCHORS) {
  const cells = YUAN_MODES.map((m) => `${m.name} ${dur(yuanBreakSeconds(a, m, 0, 'sqrt'))}`)
  console.log(`  锚 1e${String(a).padEnd(4)}  ${cells.join(' · ')}`)
}

console.log('\n【门槛处的实际锚】单世挂到 1e100：撞 1e31 秒上限就停，读数必须看 timedOut')
const TRE = Object.fromEntries(TREASURES.map((t) => [t.id, t.cap]))
const YEAR_SECONDS = 365.25 * 86400
for (const lv of [8, 15]) {
  const mods = mergeMods(
    treeMods({ daoJi: lv, lingGen: lv, wuXing: lv, huiGen: lv, yuanFa: lv }),
    treasureMods(Object.fromEntries(TREASURES.map((t) => [t.id, Math.min(lv, t.cap)]))),
  )
  const r = runLife({ mods, target: 1e100, capSeconds: 1e31 })
  const flow = endFlowLog10(r, mods)
  const earned = Math.log10(Math.max(1, r.earned))
  if (r.timedOut) {
    // 1e100 存量 / 当前流量 = 还要多少秒；换成 log10(年) 免得 dur 把 1e42 年写成一身"万亿年"
    const moreYearsLog = 100 - flow - Math.log10(YEAR_SECONDS)
    console.log(
      `  树 Lv.${lv} + 法宝 Lv.${Math.min(lv, 8)}：没到 1e100 —— 1e31 秒上限时累计产出 1e${earned.toFixed(2)}、` +
        `流量 1e${flow.toFixed(2)}/秒；单世再挂约 1e${moreYearsLog.toFixed(1)} 年也到不了。`,
    )
  } else {
    console.log(
      `  树 Lv.${lv} + 法宝 Lv.${Math.min(lv, 8)}：到 1e100 用了 ${dur(r.t)} · 结束流量 1e${flow.toFixed(2)}` +
        ` · 线性版首破 ${dur(yuanBreakSeconds(flow, YUAN_MODES[0], 0, 'linear'))}`,
    )
  }
}
console.log('  注：这里的"到不了"是旧链自己的单世增长律（乘法轴未接入前）——结丹回溯已改成首层 ×2、之后 ×1.25，');
console.log('  约 405 层攒出 1e39 倍后，最后一世就能把累计灵气推过 1e100（见 sim/realm-timeline.mjs）。');

console.log('\n【旧锚复核】metaMult 不接进运行时，旧脚本读数不动')
const bare = runLife({ mods: bareMods(), target: 1e10 })
console.log(`  空树空宝 练气 1e10：${dur(bare.t)}（基准 15.0 分，${(bare.t / 60).toFixed(2)} 分）`)
const flow30 = yuanRateLog10(30, YUAN_MODES[0], 0, 'sqrt')
console.log(
  `  定标锚检查：平方根产量 1e${flow30.toFixed(3)}/秒（设计稿要求 1e25）·` +
    ` 阈值 1e${yuanThresholdLog10(30).toFixed(3)} · 首破 ${dur(yuanBreakSeconds(30, YUAN_MODES[0], 0, 'sqrt'))}`,
)
