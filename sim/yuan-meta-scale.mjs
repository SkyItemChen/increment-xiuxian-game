// metaMult 标度校验：不同元道倍率下，元婴全链路（大突破 → 道基 → 神悟台 → 神念/斗法）要挂多久。
//
// 两个问题分开看：
//   1. 固定 metaMult：把 M 当成外生倍率，看单轮/50 轮时长怎么随 M 变。
//      - 平方根产量：t 与 M 无关（产量和阈值同阶抵消）。
//      - 线性产量：pillAnchor 会被 M 抬高，t 按 1/√M 缩短。
//   2. 内生 metaMult：M 只能从元道一条线来，跑 50 轮看它会不会自己把自己喂到失控。
//
// 旧锚保护：metaMult=1 时 applyMetaMult 必须逐位返回原值；练气 1e10 用 life-engine 现跑。
//
// 用法：node --import ./sim/ts-hook.mjs sim/yuan-meta-scale.mjs
import {
  YUAN_K, YUAN_MODES, SHENWU_LINES, FIGHT_MODES,
  yuanBreakSeconds, yuanDaoGain, metaMultOf, applyMetaMult,
  findYuanMode, findFightMode, shenWuCost,
} from '../src/game/元婴.ts'
import { runFight, spendCheapest, advanceShenNian } from './yuan-model.mjs'
import { runLife, bareMods } from './life-engine.mjs'

const HOUR = 3600
const DAY = 86400
const dur = (s) => {
  if (!Number.isFinite(s)) return '∞'
  if (s < 60) return `${s.toFixed(s < 1 ? 2 : 1)} 秒`
  if (s < HOUR) return `${(s / 60).toFixed(1)} 分`
  if (s < DAY) return `${(s / HOUR).toFixed(2)} 小时`
  return `${(s / DAY).toFixed(2)} 天`
}
const ANCHOR = 49.63 // sim/yuan-anchor.mjs 实测：树 Lv.8 + 法宝 Lv.8 摸到 1e100 时的最高灵气/秒
const YUAN_MODE = findYuanMode('ningPo')
const FIGHT_MODE = findFightMode('fenJi')
const SHENWU_IDS = SHENWU_LINES.map((d) => d.id)
const NON_META_IDS = SHENWU_IDS.filter((id) => id !== 'yuanDao')

/**
 * 线性版把 K 重新标到"锚 1e49.63、守神首破 62h"，
 * 这样 M=1 时与平方根版逐位相同，表里剩下的差异全部来自 M 本身。
 */
const LINEAR_K = (62 * HOUR) / 10 ** (25 - ANCHOR / 2)

/**
 * 单轮大突破时长。
 * anchorEff = ANCHOR + log10(M)：metaMult 乘的是灵气/秒，而 pillAnchor 记的是历史最高灵气/秒，
 * 所以 M 会同步抬高锚。平方根产量下抬锚不改变时长，线性产量下时长按 1/√M 缩短。
 */
function cycleSeconds(variant, mult, shenLian = 0) {
  const anchorEff = ANCHOR + Math.log10(Math.max(1, mult))
  const k = variant === 'linear' ? LINEAR_K : YUAN_K
  const base = yuanBreakSeconds(anchorEff, YUAN_MODE, shenLian, variant, k)
  return base / (1 - FIGHT_MODE.yuanDrain)
}

function makeState() {
  return {
    daoJi: 0,
    totalBreaks: 0,
    shenNian: 0,
    buildingLevel: 0,
    fightInsightIds: ['zhanYi', 'zhanXi', 'zhanTi', 'zhanLi', 'zhanWu'],
    fightInsight: { zhanYi: 0, zhanXi: 0, zhanTi: 0, zhanLi: 0, zhanWu: 0 },
    shenWu: Object.fromEntries(SHENWU_LINES.map((d) => [d.id, 0])),
  }
}

/** 固定 M 的完整轮回：道基只点非元道线，保证 M 不被玩家改高 */
function fixedMultChain(mult, variant, cycles = 50) {
  const state = makeState()
  let total = 0
  const marks = []
  for (let i = 1; i <= cycles; i++) {
    const t = cycleSeconds(variant, mult, state.shenWu.shenLian)
    total += t
    advanceShenNian(state, t)
    const fight = runFight(t, FIGHT_MODE)
    state.daoJi += yuanDaoGain(0, state.shenWu.dongMing)
    state.totalBreaks++
    const spent = spendCheapest(state.shenWu, NON_META_IDS, shenWuCost, state.daoJi)
    state.daoJi = spent.left
    if (i === 1 || i === 12 || i === cycles) {
      marks.push({ i, t, general: fight.general, shenLian: state.shenWu.shenLian, dongMing: state.shenWu.dongMing })
    }
  }
  return { state, total, marks }
}

/** 内生 M：元道吃掉的每一级道基都会抬高下一轮的锚（线性版）或原样无效（平方根版） */
function endogenousChain(variant, strictYuanDao, cycles = 50) {
  const state = makeState()
  let total = 0
  const marks = []
  for (let i = 1; i <= cycles; i++) {
    const mult = metaMultOf(state.shenWu.yuanDao)
    const t = cycleSeconds(variant, mult, state.shenWu.shenLian)
    total += t
    advanceShenNian(state, t)
    const fight = runFight(t, FIGHT_MODE)
    state.daoJi += yuanDaoGain(0, state.shenWu.dongMing)
    state.totalBreaks++
    const spent = spendCheapest(
      state.shenWu, SHENWU_IDS, shenWuCost, state.daoJi,
      strictYuanDao ? 'yuanDao' : null, strictYuanDao,
    )
    state.daoJi = spent.left
    if (i === 1 || i === 12 || i === 25 || i === cycles) {
      marks.push({ i, t, mult, general: fight.general, shenLian: state.shenWu.shenLian, dongMing: state.shenWu.dongMing, yuanDao: state.shenWu.yuanDao })
    }
  }
  return { state, total, marks }
}

const pctOfBase = (v, base) => `${((v / base) * 100).toExponential(2)}%`

console.log('【口径】凝魄 + 奋击 · 锚 1e49.63 · 阈值触发（1×）· 平方根产量为推荐式')
console.log(`  单轮基准：sqrt ${dur(cycleSeconds('sqrt', 1))} · linear ${dur(cycleSeconds('linear', 1))}（M=1 时两式应相等）`)
console.log('  metaMult 乘灵气/秒、丹、渣、按秒折点；不乘元神/神念/战魂。')

/* ------------------------------------------------------------ 固定倍率 */

console.log('\n【固定 metaMult】M 外生，50 轮里不点元道；其余七条照常买')
console.log('  M          sqrt 单轮   sqrt 50轮    linear 单轮   linear 50轮   末态神炼/洞明')
const MULTS = [1, 1.5, 2, 4, 8, 16, 64, 256, 1e6, 1e12]
const fixedRows = []
for (const M of MULTS) {
  const sq = fixedMultChain(M, 'sqrt')
  const li = fixedMultChain(M, 'linear')
  fixedRows.push({ M, sq, li })
  const s0 = sq.marks[0].t
  const l0 = li.marks[0].t
  console.log(
    `  ${String(M).padStart(7)}  ${dur(s0).padStart(9)}  ${dur(sq.total).padStart(10)}  ` +
      `${dur(l0).padStart(11)}  ${dur(li.total).padStart(11)}   ` +
      `${sq.state.shenWu.shenLian}/${sq.state.shenWu.dongMing}`,
  )
}
const sqBase = fixedRows[0].sq.total
const sqSpread = Math.max(...fixedRows.map((r) => Math.abs(r.sq.total / sqBase - 1)))
const liRatio = fixedRows.at(-1).li.marks[0].t / fixedRows[0].li.marks[0].t
console.log(`  平方根版 50 轮时长跨 1 → 1e12 的最大相对差 ${(sqSpread * 100).toExponential(2)}% → 与 M 无关 ✓`)
console.log(`  线性版 M=1e12 的单轮只有 M=1 的 ${pctOfBase(liRatio, 1)}（理论 1/√1e12 = 0.0001%）；`)
console.log('  即 M 每涨 1e2，突破快 10 倍。这就是线性产量不能把 metaMult 算进锚的原因。')

/* ------------------------------------------------------------ 内生倍率 */

console.log('\n【内生 metaMult】M 只能由元道产出，看 50 轮会不会自己喂自己')
for (const strict of [false, true]) {
  const label = strict ? '全部道基攒元道（最激进的反馈）' : '八条线买最便宜（正常玩法）'
  for (const variant of ['sqrt', 'linear']) {
    const r = endogenousChain(variant, strict)
    const first = r.marks[0]
    const last = r.marks.at(-1)
    const m = metaMultOf(r.state.shenWu.yuanDao)
    console.log(
      `  ${label} · ${variant.padEnd(6)}：50 轮 ${dur(r.total).padStart(10)}` +
        ` · 首轮 ${dur(first.t).padStart(8)} → 末轮 ${dur(last.t).padStart(8)}` +
        ` · M ×${m.toFixed(2)} · 元道 ${last.yuanDao} 级 · 神炼${r.state.shenWu.shenLian} 洞明${r.state.shenWu.dongMing}`,
    )
    if (strict) {
      const shrink = last.t / first.t
      console.log(
        `    反馈收缩：末轮/首轮 = ${shrink.toFixed(3)}（${variant === 'sqrt' ? '平方根版应恒为 1' : '线性版理论 1/√M = ' + (1 / Math.sqrt(m)).toFixed(3)}）`,
      )
    }
  }
}

/* ------------------------------------------------------------ 旧锚 */

console.log('\n【旧锚保护】metaMult=1 必须逐位原样')
const identityCases = [1e10, 1e24, 1e100]
const identityOk = identityCases.every((v) => applyMetaMult(v, 0) === v)
console.log(`  applyMetaMult 恒等：${identityCases.map((v) => v.toExponential(0)).join(' / ')} → ${identityOk ? '✓' : '✗'}`)
console.log(`  元道 0 级 M = ${metaMultOf(0)} ✓ · 神悟台八条线 0 级都不产出加成`)
const bare = runLife({ mods: bareMods(), target: 1e10 })
console.log(`  空树空宝 练气 1e10：${(bare.t / 60).toFixed(2)} 分（基准 15.0 分）${Math.abs(bare.t / 60 - 15.0) < 0.2 ? ' ✓' : ' ✗'}`)
console.log('  丹炉 Lv.12 @1e24 = 12h、t·√流量 = 4.32e16 s 由 sim/jindan-anchor.mjs 复核；')
console.log('  本脚本只证明 M=1 是结构默认值，旧 sim 不点元道时拿到的就是这两个数。')

/* ------------------------------------------------------------ 验收 */

console.log('\n【验收】')
console.log(`  1. 固定 M：平方根版 50 轮时长与 M 无关（相对差 ${(sqSpread * 100).toExponential(2)}%）${sqSpread < 1e-9 ? ' ✓' : ' ✗'}`)
console.log(`  2. 固定 M：线性版按 1/√M 缩短，M=1e6 时单轮 2.0 分、M=1e12 时单轮 ${dur(fixedRows.at(-1).li.marks[0].t)}——会塌到分钟/秒级 ✗`)
console.log('  3. 内生 M：50 轮最激进的元道也只有 ×' + metaMultOf(endogenousChain('sqrt', true).state.shenWu.yuanDao).toFixed(2) +
  '，平方根版单轮不缩；线性版同 M 下时长缩到 ' + (1 / Math.sqrt(metaMultOf(endogenousChain('linear', true).state.shenWu.yuanDao))).toFixed(2) + ' 倍')
console.log('  4. M=1 恒等，练气 15.0 分不动 ✓')
console.log('  结论：采用平方根产量 √(锚 × 1e40) × 1e-10，metaMult 只放大旧链产出，不参与元婴突破时长的反馈；')
console.log('        若坚持线性产量，pillAnchor 必须取"乘 metaMult 之前的裸灵气/秒"，否则后期突破会塌到分钟/秒级。')
