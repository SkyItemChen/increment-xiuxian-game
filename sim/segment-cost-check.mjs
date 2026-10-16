// 分段涨价的回归测试：拿最笨的"一级一级乘"去对闭式解，两种表（有段/没段）都要一致。
import { LIANQI_UPGRADES } from '../src/game/词条与属性.ts'
import { growthAt, levelCostLog10, bulkCostLog10, maxAffordable } from '../src/game/upgrades.ts'
import { growthCutOf } from '../src/game/rebirth.ts'

/** 笨办法：第 lv+1 级的价格（double，小等级下够用） */
function bruteCost(def, lv, cut = 0) {
  let c = def.base
  for (let k = 0; k < lv; k++) c *= growthCutOf(cut, growthAt(def, k))
  return c
}

const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))
let fails = 0
const check = (name, ok, detail = '') => {
  if (!ok) fails++
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' · ' + detail : ''}`)
}

// 1. 单价：有段没段都要和笨办法对上。测试点从段表本身推出来，改拐点不用再动这个文件
const edgeLevels = (def) => {
  const set = new Set([0, 1, 5, 120])
  for (const s of def.segments ?? []) for (const k of [s.at - 1, s.at, s.at + 1]) if (k >= 0) set.add(k)
  return [...set].sort((a, b) => a - b)
}
for (const def of LIANQI_UPGRADES) {
  for (const lv of edgeLevels(def)) {
    const want = Math.log10(bruteCost(def, lv))
    const got = levelCostLog10(def, lv)
    if (!near(want, got, 1e-12)) check(`${def.id} 第 ${lv + 1} 级单价`, false, `期望 1e${want} 实得 1e${got}`)
  }
}
check('单价 = 笨办法逐级累乘（拐点前后各一级都查）', fails === 0)

// 2. 总价：连买跨段，起点同样从段表推
const before = fails
for (const def of LIANQI_UPGRADES) {
  const starts = [0, 5, 7, ...(def.segments ?? []).map((s) => s.at - 2)]
  for (const [level, count] of starts.flatMap((lv) => [[lv, 1], [lv, 3], [lv, 12], [lv, 40]])) {
    let sum = 0
    for (let k = level; k < level + count; k++) sum += bruteCost(def, k)
    const got = 10 ** bulkCostLog10(def, level, count)
    if (!near(sum, got, 1e-9)) check(`${def.id} 从 ${level} 起买 ${count} 级`, false, `期望 ${sum.toExponential(6)} 实得 ${got.toExponential(6)}`)
  }
}
check('总价 = 笨办法逐级相加（含跨段）', fails === before)

// 3. 最大可买：和"一级一级试"完全一致，悟性削减开着也要一致
const beforeMax = fails
for (const def of LIANQI_UPGRADES) {
  for (const cut of [0, 0.2, 0.42]) {
    for (const haveLog of [0.5, 1, 1.778, 2.2, 3, 5, 12, 26, 36, 60.5]) {
      let lv = 0
      let left = 10 ** haveLog
      for (;;) {
        const c = bruteCost(def, lv, cut)
        if (c > left) break
        left -= c
        lv++
      }
      const got = maxAffordable(def, 0, haveLog, cut)
      if (got !== lv) check(`${def.id} 削减 ${cut} 持有 1e${haveLog}`, false, `笨办法 ${lv} 级 · 闭式解 ${got} 级`)
    }
  }
}
check('最大可买 = 笨办法一级一级试（含削减与跨段）', fails === beforeMax)

// 4. 没配段的法门必须和改版前一模一样：老式 base·g^lv 闭式解
const plain = { id: 'x', name: '无段', kind: 'auto-power', base: 60, growth: 20, power: 2 }
const oldBulk = (level, count) => {
  const g = plain.growth
  const x = count * Math.log10(g)
  const geo = x > 0.5 ? x + Math.log10(1 - 10 ** -x) - Math.log10(g - 1) : Math.log10((g ** count - 1) / (g - 1))
  return Math.log10(plain.base) + level * Math.log10(g) + geo
}
const sameBulk = [[0, 1], [0, 7], [3, 4], [40, 90]].every(([l, c]) => near(oldBulk(l, c), bulkCostLog10(plain, l, c), 1e-12))
const oldMax = (haveLog) => {
  const g = plain.growth
  const y = haveLog + Math.log10(g - 1) - Math.log10(plain.base)
  const arg = y > 0 ? y + Math.log10(1 + 10 ** -y) : Math.log10(1 + 10 ** y)
  return Math.max(0, Math.floor(arg / Math.log10(g)))
}
const sameMax = [1, 2, 5, 11, 30, 55].every((h) => oldMax(h) === maxAffordable(plain, 0, h))
check('不填 segments 时与改版前逐位相同', sameBulk && sameMax)

// 5. 段表本身读得对：每条法门在每个拐点前后都要换到表里写的那个涨幅
const badEdges = []
for (const def of LIANQI_UPGRADES) {
  let want = def.growth
  for (const seg of def.segments ?? []) {
    if (growthAt(def, seg.at - 1) !== want) badEdges.push(`${def.id} 第 ${seg.at} 级前应该是 ${want}`)
    want = seg.growth
    if (growthAt(def, seg.at) !== want) badEdges.push(`${def.id} 第 ${seg.at + 1} 级应该是 ${want}`)
  }
}
check('每条法门的拐点前后涨幅都按段表切换', badEdges.length === 0, badEdges.join(' / '))

console.log(fails === 0 ? '\n全部通过' : `\n失败 ${fails} 项`)
