// 高数量级那一段路要多久：一世挂到底 vs 一世一世破境点根骨树。模拟核心在 sim/life-engine.mjs。
// 用法：node --import ./sim/ts-hook.mjs sim/e36.mjs [cal|a|b|c|all] [淬炼等级=0] [目标数量级=36]
import { LIANQI_UPGRADES, REBIRTH_TREE, TREASURES } from '../src/game/词条与属性.ts'
import { EXPLORE_UNLOCK_POINTS } from '../src/game/explore.ts'
import {
  GATE, bareMods, treeMods, treasureMods, mergeMods, runLife,
  dur, pointsOf, greedyTree, treeLevels,
} from './life-engine.mjs'

const ITEMS = LIANQI_UPGRADES
const TARGET_LOG = Number(process.argv[4] ?? 36)
// 淬炼现在是灵气产出加成，不再是法宝倍率：这里按等级直接 +5%/级，命令行第 3 个参数控制
const CUI_LIAN = Number(process.argv[3] ?? 0)

/* ---------------------------------------------------------------- 场景 */

function scenarioA(policy) {
  const r = runLife({ mods: bareMods(), target: 10 ** TARGET_LOG, policy })
  console.log(`\n【A】空树空宝，一世挂到 1e${TARGET_LOG}（${policy === 'end' ? '倒序买满=自动化口径' : '谁便宜买谁'}）`)
  console.log(`  ${r.timedOut ? '撞上限未完' : '达成'} · 共 ${dur(r.t)} · ${r.steps} 步`)
  console.log(`  ${r.marks.map(([d, t]) => `1e${d} · ${dur(t)}`).join(' | ')}`)
  console.log(`  末尾法门：${ITEMS.map((i) => `${i.id}:${r.lv[i.id]}`).join(' ')}`)
}

/** 一世一世破境把根骨树往上点，最后挂到目标；holdDecades = 每次多攒几个数量级才破；free = 成就「不取一毫」 */
function scenarioB(holdDecades, { withTreasures = false, cuiLianLv = CUI_LIAN, lives = 4000, free = false, policy = 'cheap' } = {}) {
  const lv = {}
  const treasures = Object.fromEntries(TREASURES.map((t) => [t.id, t.cap]))
  // 树没有等级上限了，所以按世数停；淬炼等级由命令行第 3 个参数指定
  let points = 0
  let earned = 0
  let loops = 0
  let total = 0
  const log = []
  for (let life = 0; life < lives; life++) {
    let mods = treeMods(lv)
    mods.energyAdd = 0.05 * cuiLianLv
    if (withTreasures) mods = mergeMods(mods, treasureMods(treasures))
    const r = runLife({ mods, target: GATE * 10 ** holdDecades, free, policy })
    if (r.timedOut) {
      log.push(`第 ${life + 1} 世挂到 ${dur(r.t)} 仍未到 1e${10 + holdDecades}：树停在这里`)
      break
    }
    total += r.t
    const got = pointsOf(r.earned, loops, mods.pointAdd)
    loops++
    earned += got
    points = greedyTree(points + got, lv)
    if (life < 6 || (life + 1) % 200 === 0) {
      log.push(
        `第 ${String(life + 1).padStart(4)} 世 ${dur(r.t).padStart(9)} · 本世累计 1e${Math.log10(r.earned).toFixed(2)}` +
          ` · 拿 ${String(got).padStart(4)} 点` +
          ` · 树共 ${treeLevels(lv)} 级 [${REBIRTH_TREE.map((x) => `${x.id}${lv[x.id] ?? 0}`).join(' ')}]`,
      )
    }
  }
  let mods = treeMods(lv)
  mods.energyAdd = 0.05 * cuiLianLv
  if (withTreasures) mods = mergeMods(mods, treasureMods(treasures))
  const r = runLife({ mods, target: 10 ** TARGET_LOG, free, policy })
  console.log(
    `\n【B${withTreasures ? '·法宝全吃满' : ''}${free ? '·不取一毫' : ''}` +
      `${policy === 'end' ? '·一键购买口径' : ''}】每次多攒 ${holdDecades} 个数量级才破境` +
      `，淬炼 ${cuiLianLv} 级（+${Math.round(cuiLianLv * 5)}% 产出），跑了 ${loops} 世之后再挂到 1e${TARGET_LOG}`,
  )
  for (const l of log) console.log(`  ${l}`)
  console.log(
    `  树 [${REBIRTH_TREE.map((x) => `${x.id}${lv[x.id] ?? 0}`).join(' ')}]` +
      ` · 累计 ${earned} 筑基点 · 破境 ${loops} 次 · 点树共花 ${dur(total)}`,
  )
  console.log(`  最后一世挂到 1e${TARGET_LOG}：${r.timedOut ? `撞上限未完（${dur(r.t)}）` : dur(r.t)}`)
  console.log(
    `  合计 ${dur(total + r.t)} · 手上筑基点 ${points} · 法门 ${ITEMS.map((i) => `${i.id}:${r.lv[i.id]}`).join(' ')}`,
  )
  if (r.marks.length) console.log(`  最后一世轨迹：${r.marks.map(([d, t]) => `1e${d}·${dur(t)}`).join(' | ')}`)
  return { total: total + r.t, points, earned, loops, lv, holdDecades, free, policy, withTreasures }
}

const which = (process.argv[2] || 'all').toLowerCase()
if (which === 'cal' || which === 'all' || which === 'd') {
  console.log('校准：一世摸到 1e10 要多久（基准 15.0 分）')
  for (const free of which === 'd' ? [false, true] : [false]) {
    for (const p of ['cheap', 'end']) {
      const r = runLife({ mods: bareMods(), target: GATE, policy: p, free })
      console.log(
        `  ${free ? '不取一毫' : '照价扣灵气'} · ${p}：${dur(r.t)} · ${r.steps} 步` +
          ` · 本世累计 1e${Math.log10(r.earned).toFixed(2)} · 法门 ${ITEMS.map((i) => `${i.id}:${r.lv[i.id]}`).join(' ')}`,
      )
    }
  }
}
if (which === 'a' || which === 'all') {
  scenarioA('cheap')
  scenarioA('end')
}
if (which === 'b' || which === 'all') {
  scenarioB(0)
  console.log(`  探索要累计 ${EXPLORE_UNLOCK_POINTS} 筑基点才解锁；见识（鉴宝台的钱）来自重复法宝，本轮没模拟抽卡节奏`)
  scenarioB(3)
  scenarioB(0, { withTreasures: true })
  scenarioB(3, { withTreasures: true })
}
if (which === 'd') {
  // 成就「不取一毫」把练气唯一的灵气去处拆掉：同一条树、同一个 1e36，只比扣不扣灵气
  for (const hold of [0, 3]) {
    scenarioB(hold, { free: false })
    scenarioB(hold, { free: true })
    scenarioB(hold, { withTreasures: true, free: false })
    scenarioB(hold, { withTreasures: true, free: true })
  }
}
if (which === 'c' || which === 'all') {
  scenarioB(3, { withTreasures: true })
}
