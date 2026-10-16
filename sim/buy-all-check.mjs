// 一键购买（根骨五条 / 鉴宝台四条）：要摊平等级、不许超支、买不起时一级都不动。
// 这两层的行全部共用同一条价目曲线，所以「把某一行买满」是亏的——这里验的就是没亏。
import { buyAllExplore, buyAllRebirth, buyExplore, buyRebirth, exploreRows, rebirthRows, state } from '../src/game/state.ts'

let fails = 0
function ok(cond, label) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fails += 1
}

const idsOf = (defs) => defs.map((d) => d.def.id)
const levelsOf = (levels, ids) => ids.map((id) => levels[id] ?? 0)
const spread = (v) => Math.max(...v) - Math.min(...v)
/** 买完之后不该还剩着够买任意一行的下一级的钱 */
function leftoversAreDead(levels, ids, base) {
  const left = levels === state.rebirth ? state.points : state.insight
  const cheapest = Math.min(...ids.map((id) => Math.max(1, Math.ceil(base ** (levels[id] ?? 0)))))
  return { left, cheapest, ok: left < cheapest }
}

/* ---------------------------------------------------------- 根骨 */
console.log('\n根骨五条（每级 1.5^lv 筑基点）')
const treeIds = idsOf(rebirthRows())
for (const purse of [0, 1, 3, 24, 100, 1000, 100000]) {
  for (const id of treeIds) state.rebirth[id] = 0
  state.points = purse
  const bought = buyAllRebirth()
  const v = levelsOf(state.rebirth, treeIds)
  const r = leftoversAreDead(state.rebirth, treeIds, 1.5)
  ok(bought === (purse >= 1), `口袋 ${String(purse).padStart(6)} → ${bought ? '买到了' : '一级都买不起，返回 false'}`)
  ok(r.left >= 0 && spread(v) <= 1 && r.ok,
    `口袋 ${String(purse).padStart(6)} → [${v.join(',')}] 极差 ${spread(v)} · 余额 ${r.left} < 最便宜下一级 ${r.cheapest}`)
}

// 同样这 24 点，单按「最大」只会喂饱一条
for (const id of treeIds) state.rebirth[id] = 0
state.points = 24
buyAllRebirth()
const spreadCount = levelsOf(state.rebirth, treeIds).filter((n) => n > 0).length
for (const id of treeIds) state.rebirth[id] = 0
state.points = 24
buyRebirth('daoJi', 'max')
const singleCount = levelsOf(state.rebirth, treeIds).filter((n) => n > 0).length
ok(spreadCount > singleCount, `24 点：一键动了 ${spreadCount} 条，单按最大只动 ${singleCount} 条`)

/* ---------------------------------------------------------- 鉴宝台 */
console.log('\n鉴宝台四条（每级 1.6^lv 见识）')
const benchIds = idsOf(exploreRows())
for (const purse of [0, 1, 24, 100, 1000]) {
  for (const id of benchIds) state.exploreLevels[id] = 0
  state.insight = purse
  const bought = buyAllExplore()
  const v = levelsOf(state.exploreLevels, benchIds)
  const r = leftoversAreDead(state.exploreLevels, benchIds, 1.6)
  ok(bought === (purse >= 1), `口袋 ${String(purse).padStart(4)} → ${bought ? '买到了' : '一级都买不起，返回 false'}`)
  ok(r.left >= 0 && spread(v) <= 1 && r.ok,
    `口袋 ${String(purse).padStart(4)} → [${v.join(',')}] 极差 ${spread(v)} · 余额 ${r.left} < 最便宜下一级 ${r.cheapest}`)
}

/* ---------------------------------------------------------- 接在已有等级后面 */
console.log('\n已经点过几级之后再接着买')
for (const id of treeIds) state.rebirth[id] = 0
state.rebirth.wuXing = 4
state.points = 20
buyAllRebirth()
const after = levelsOf(state.rebirth, treeIds)
ok(after[treeIds.indexOf('wuXing')] <= 5, `悟性已经 Lv.4，一键不该把它顶过头（现在 ${after[treeIds.indexOf('wuXing')]}）`)
ok(spread(after) <= 2, `贵的行让完路再补，极差仍然只有 ${spread(after)} [${after.join(',')}]`)

for (const id of benchIds) state.exploreLevels[id] = 0
state.exploreLevels.tieChan = 3
state.insight = 30
buyAllExplore()
const benchAfter = levelsOf(state.exploreLevels, benchIds)
ok((benchAfter[benchIds.indexOf('tieChan')] ?? 0) <= 4, `铁铲已经 Lv.3，一键不该把它顶过头（现在 ${benchAfter[benchIds.indexOf('tieChan')]}）`)
ok(buyExplore('tieChan', 1) || state.insight < 5, '一键之后手动那一颗仍然按自己的价走')

console.log(fails === 0 ? '\n全部通过' : `\n${fails} 项没过`)
process.exit(fails === 0 ? 0 : 1)
