import { drawCount, insightOfStake, luckOf, NO_EXPLORE_MODS, rarityOdds, rollExplore } from '../src/game/explore.ts'

const pct = (v) => `${(v * 100).toFixed(1)}%`

console.log('眼力等级 → 出土概率（凡 / 灵 / 仙），玉碟未得')
for (let lv = 0; lv <= 10; lv++) {
  const mods = { ...NO_EXPLORE_MODS, yanLi: lv }
  const o = rarityOdds(lv, luckOf({}, mods))
  console.log(`  Lv.${String(lv).padStart(2)}  ${pct(o.fan)} / ${pct(o.ling)} / ${pct(o.xian)}`)
}

// 淬炼改成灵气产出加成了，它不再进 luck——这张表只该随玉碟和眼力动
console.log('\n同一张表，仙品两件收满后再叠：玉碟 Lv.3')
for (const lv of [0, 3, 5, 8, 10]) {
  const mods = { ...NO_EXPLORE_MODS, yanLi: lv, energyAdd: 0.05 * 20 }
  const luck = luckOf({ zaoHuaYuDie: 3 }, mods)
  const o = rarityOdds(lv, luck)
  console.log(`  眼力 Lv.${String(lv).padStart(2)}  ${pct(o.fan)} / ${pct(o.ling)} / ${pct(o.xian)} · luck ${luck.toFixed(2)}`)
}

console.log('\n铲数与押注折算')
for (const tieChan of [0, 1, 2, 3]) {
  const mods = { ...NO_EXPLORE_MODS, tieChan }
  console.log(`  铁铲 Lv.${tieChan}：挖 ${drawCount(mods)} 铲`)
}
for (const stake of [1, 4, 9, 10, 49, 100, 500, 2000]) {
  console.log(`  押 ${String(stake).padStart(4)} 点 → ${insightOfStake(stake, NO_EXPLORE_MODS)} 见识`)
}

console.log('\n确定性抽查：同一 (points, seed, 法宝, mods) 两次结果一致')
const a = rollExplore(7, 123456789, {}, { ...NO_EXPLORE_MODS, yanLi: 6, tieChan: 2 })
const b = rollExplore(7, 123456789, {}, { ...NO_EXPLORE_MODS, yanLi: 6, tieChan: 2 })
console.log('  ', JSON.stringify(a.draws.map((d) => `${d.def.name}:${d.level}`)), a.stakeInsight, a.seed === b.seed && a.draws.length === b.draws.length ? '一致' : '不一致')
