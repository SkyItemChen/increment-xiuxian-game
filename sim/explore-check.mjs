import { TREASURES } from '../src/game/词条与属性.ts'
import { drawCount, insightOfStake, luckOf, NO_EXPLORE_MODS, openRarities, rarityOdds, rollExplore } from '../src/game/explore.ts'

const pct = (v) => `${(v * 100).toFixed(1)}%`

console.log('眼力等级 → 出土概率（凡 / 灵 / 仙），玉碟未得')
for (let lv = 0; lv <= 10; lv++) {
  const mods = { ...NO_EXPLORE_MODS, yanLi: lv }
  const o = rarityOdds(lv, luckOf({}, mods))
  console.log(`  Lv.${String(lv).padStart(2)}  ${pct(o.fan)} / ${pct(o.ling)} / ${pct(o.xian)}`)
}

// 淬炼改成灵气产出加成了，它不再进 luck——这张表只该随玉碟和眼力动
console.log('\n凡品一件没收 vs 凡品全收满（玉碟 Lv.3）：下限只护着没收齐的那段时间')
const fanDone = Object.fromEntries(TREASURES.filter((t) => t.rarity === 'fan').map((t) => [t.id, t.cap]))
for (const lv of [0, 1, 4, 10, 20, 40, 60]) {
  const mods = { ...NO_EXPLORE_MODS, yanLi: lv }
  const luck = luckOf({ zaoHuaYuDie: 3 }, mods)
  const before = rarityOdds(lv, luck, openRarities({}))
  const after = rarityOdds(lv, luck, openRarities(fanDone))
  console.log(
    `  眼力 Lv.${String(lv).padStart(2)}  未收齐 ${pct(before.fan)} / ${pct(before.ling)} / ${pct(before.xian)}` +
    `   凡品满 ${pct(after.fan)} / ${pct(after.ling)} / ${pct(after.xian)}`,
  )
}
console.log('  凡品满、眼力又不到 Lv.1 时三档权重都是 0：那一铲只攒见识，灵品仍要靠眼力解锁。')

console.log('\n空档顺延：凡品只差一层、眼力 10、10 铲，不该有空铲')
const almost = { ...fanDone, juBaoPen: (fanDone.juBaoPen ?? 0) - 1 }
const mods10 = { ...NO_EXPLORE_MODS, yanLi: 10, tieChan: 9 }
let emptyShots = 0
for (let s = 1; s <= 200; s++) {
  const out = rollExplore(0, (s * 2654435761) >>> 0, almost, mods10)
  if (out.draws.length < drawCount(mods10)) emptyShots++
}
console.log(`  200 次里空铲 ${emptyShots} 次（该 0 次：凡品收满后顺延到灵/仙）`)

console.log('\n凡品收满、眼力 Lv.0：1 铲只换见识')
const dry = rollExplore(0, 123456789, fanDone, NO_EXPLORE_MODS)
console.log(`  出土 ${dry.draws.length} 件 / 换见识 ${dry.insights.length} 次（该 0 / 1）`)

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
