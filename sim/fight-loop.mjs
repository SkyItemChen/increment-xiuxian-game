// 战斗 + 元婴完整轮回：元神 → 大突破 → 道基 → 神悟台 → metaMult，外加神念建筑/战悟与斗法。
// 用平方根产量（推荐式）跑 50 轮，再拿线性产量重新标定后跑一遍做反馈对照。
// 用法：node --import ./sim/ts-hook.mjs sim/fight-loop.mjs
import {
  YUAN_K, YUAN_MODES, FIGHT_MODES, SHENWU_LINES, FIGHT_INSIGHT_LINES,
  yuanBreakSeconds, yuanDaoGain, metaMultOf, applyMetaMult,
  findYuanMode, findFightMode, shenWuCost, SHENWU_COST_GROWTH,
  AUTO_BREAK_UNLOCKS_AT,
} from '../src/game/元婴.ts'
import { runFight, spendCheapest, advanceShenNian } from './yuan-model.mjs'

const HOUR = 3600
const DAY = 86400
const ANCHOR = 49.63 // sim/yuan-anchor.mjs 实测：树 Lv.8 + 法宝 Lv.8 摸到 1e100 时的最高灵气/秒
const SHENWU_IDS = SHENWU_LINES.map((d) => d.id)
const dur = (s) => {
  if (!Number.isFinite(s)) return '∞'
  if (s < 60) return `${s.toFixed(1)} 秒`
  if (s < HOUR) return `${(s / 60).toFixed(1)} 分`
  if (s < DAY) return `${(s / HOUR).toFixed(2)} 小时`
  return `${(s / DAY).toFixed(2)} 天`
}

function makeState() {
  return {
    daoJi: 0,
    totalBreaks: 0,
    shenNian: 0,
    buildingLevel: 0,
    fightInsightIds: FIGHT_INSIGHT_LINES.map((d) => d.id),
    fightInsight: Object.fromEntries(FIGHT_INSIGHT_LINES.map((d) => [d.id, 0])),
    shenWu: Object.fromEntries(SHENWU_LINES.map((d) => [d.id, 0])),
  }
}

/**
 * variant='sqrt'：推荐式，产量 ∝ √锚，突破时长与 metaMult 无关。
 * variant='linear'：设计稿原式，产量 ∝ 锚；这里把 K 重新标到"首破 62h"，只看倍率涨起来后会不会自己加速。
 */
function runCycles({ variant, cycles, yuanMode, fightMode, focusYuanDao = false }) {
  const state = makeState()
  const rows = []
  const baseK =
    variant === 'linear' ? (62 * HOUR) / 10 ** (25 - ANCHOR / 2) : YUAN_K
  for (let i = 1; i <= cycles; i++) {
    const mult = metaMultOf(state.shenWu.yuanDao)
    const anchorEff = variant === 'linear' ? ANCHOR + Math.log10(mult) : ANCHOR
    const base = yuanBreakSeconds(anchorEff, yuanMode, state.shenWu.shenLian, variant, baseK)
    const t = base / (1 - fightMode.yuanDrain)
    advanceShenNian(state, t)
    const fight = runFight(t, fightMode)
    // 阈值触发：over = 0，道基 = 1 × 洞明乘数
    const gain = yuanDaoGain(0, state.shenWu.dongMing)
    state.daoJi += gain
    state.totalBreaks++
    const spent = spendCheapest(state.shenWu, SHENWU_IDS, shenWuCost, state.daoJi, focusYuanDao ? 'yuanDao' : null, focusYuanDao)
    state.daoJi = spent.left
    rows.push({
      i, t, gain, mult, yuanDao: state.shenWu.yuanDao,
      shenLian: state.shenWu.shenLian, dongMing: state.shenWu.dongMing,
      daoJi: state.daoJi, building: state.buildingLevel, general: fight.general,
      shenNian: state.shenNian,
    })
  }
  return { state, rows }
}

console.log('【口径】锚 1e49.63（实测门槛流量）· 平方根产量 · 阈值触发（1×）· 神悟台"买最便宜"')
console.log(`  K = ${YUAN_K.toExponential(3)} · 守神首破 ${dur(yuanBreakSeconds(ANCHOR, findYuanMode('shouShen'), 0, 'sqrt'))}`)
console.log('  metaMult 只从元道一条线来；本模型里它不乘元神/神念，只乘旧链产出。')

/* ------------------------------------------------------------ 50 轮主循环 */

for (const focus of [false, true]) {
  const { state, rows } = runCycles({
    variant: 'sqrt', cycles: 50, yuanMode: findYuanMode('ningPo'), fightMode: findFightMode('fenJi'), focusYuanDao: focus,
  })
  console.log(`\n【50 轮 · ${focus ? '元道优先（严格攒钱）' : '八条均衡'}】凝魄 + 奋击`)
  const show = new Set([1, 2, 3, 6, 9, 12, 15, 20, 25, 30, 40, 50])
  for (const r of rows) {
    if (!show.has(r.i)) continue
    const auto = r.i >= AUTO_BREAK_UNLOCKS_AT ? '自动' : '手点'
    console.log(
      `  #${String(r.i).padStart(2)} ${auto}  本轮 ${dur(r.t).padStart(9)}  道基 +${r.gain.toFixed(2).padStart(5)}` +
        `  存 ${r.daoJi.toFixed(2).padStart(6)}  M ×${r.mult.toFixed(2)}` +
        `  神炼${r.shenLian} 洞明${r.dongMing} 元道${r.yuanDao}` +
        `  建筑Lv.${r.building} 战将Lv.${r.general}`,
    )
  }
  const total = rows.reduce((a, r) => a + r.t, 0)
  const m = metaMultOf(state.shenWu.yuanDao)
  console.log(
    `  50 轮合计 ${dur(total)} · 末态 metaMult ×${m.toFixed(2)} · 神悟台 ` +
      SHENWU_LINES.map((d) => `${d.name}${state.shenWu[d.id]}`).join(' '),
  )
  console.log(`  神念余 ${state.shenNian.toFixed(2)} · 建筑 Lv.${state.buildingLevel} · 战悟 ` +
    FIGHT_INSIGHT_LINES.map((d) => `${d.name}${state.fightInsight[d.id]}`).join(' '))
  const monotonic = rows.every((r, i) => i === 0 || r.mult >= rows[i - 1].mult)
  const minT = Math.min(...rows.map((r) => r.t))
  console.log(`  验收：metaMult ${monotonic ? '单调不降 ✓' : '回退 ✗'} · 最短一轮 ${dur(minT)}（不接近 0 ✓）`)
}

/* ------------------------------------------------------------ 线性版的反馈对照 */

console.log('\n【对照 · 线性产量】K 按 1e49.63 重新标到首破 62h，再看 metaMult 自己喂自己')
const lin = runCycles({
  variant: 'linear', cycles: 50, yuanMode: findYuanMode('ningPo'), fightMode: findFightMode('fenJi'), focusYuanDao: true,
})
const linRows = lin.rows
console.log(
  `  第 1 轮 ${dur(linRows[0].t)} · 第 12 轮 ${dur(linRows[11].t)} · 第 50 轮 ${dur(linRows[49].t)}` +
    ` · 末态 M ×${linRows[49].mult.toFixed(2)}`,
)
console.log('  线性版每涨 1 倍 M，突破时长除以 √M；50 轮后 M 只有个位数，所以反馈是"温和加速"而不是失控，')
console.log('  但它与门槛锚强耦合：同一套 K 换个构筑（锚 1e58 vs 1e47）首破会差 1e5 倍。')
console.log('  平方根版把这条耦合拿掉，代价是"流量翻十倍，元婴周期不会变快"——想要变快就点神炼。')

/* ------------------------------------------------------------ 三档循环时长 */

console.log('\n【三档 × 50 轮】不含神炼/洞明，纯首破时长')
for (const ym of YUAN_MODES) {
  for (const fm of FIGHT_MODES) {
    const one = yuanBreakSeconds(ANCHOR, ym, 0, 'sqrt') / (1 - fm.yuanDrain)
    console.log(
      `  ${ym.name} + ${fm.name}：单轮 ${dur(one).padStart(9)} · 12 轮（解锁自动）${dur(one * 12).padStart(9)}` +
        ` · 50 轮 ${dur(one * 50).padStart(9)}`,
    )
  }
}

/* ------------------------------------------------------------ 离线/在线 */

console.log('\n【在线与离线】斗法没有随机数：波次、战魂、战将全由秒数决定')
const mode = findFightMode('fenJi')
const a = runFight(8 * HOUR, mode)
const b = runFight(8 * HOUR, mode)
const c = runFight(24 * HOUR, mode)
console.log(`  在线 8h：${a.kills} 斩 · Lv.${a.general} · 战魂 ${a.earned.toExponential(3)}`)
console.log(`  离线 8h：${b.kills} 斩 · Lv.${b.general} · 战魂 ${b.earned.toExponential(3)} · 逐位一致 ${a.earned === b.earned && a.general === b.general ? '✓' : '✗'}`)
console.log(`  离线 24h（运行时按 8h 封顶）：${c.kills} 斩 · Lv.${c.general} · 战魂 ${c.earned.toExponential(3)}`)
console.log('  注意：上面第三行是"不封顶"的模型值，运行时必须走 OFFLINE_CAP_SECONDS=8h；')
console.log('  斗法离线只补战魂/战将，不补大突破——大突破仍然要玩家回来点，或由自动器在在线时触发。')

/* ------------------------------------------------------------ 旧锚 */

console.log('\n【旧锚】metaMult=1 时 applyMetaMult 原样返回，神悟台 0 级就是基准')
console.log(`  applyMetaMult(1e24, 0) = ${applyMetaMult(1e24, 0).toExponential(3)} ✓`)
console.log(`  神悟台价格底数 ${SHENWU_COST_GROWTH}；元道 0 级 M = ${metaMultOf(0).toFixed(2)}`)
console.log('  接运行时后必须复跑 npm run build、sim/e36.mjs、sim/jindan-anchor.mjs、sim/passive-check.mjs，')
console.log('  并强制 metaMult=1，确认三个旧锚一个数位都不动。')
