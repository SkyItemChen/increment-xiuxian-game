import { rebirthCost } from '../src/game/rebirth.ts'
import { exploreCost } from '../src/game/explore.ts'

/** 和 src/game/state.ts 对齐：树和鉴宝台都没有等级上限了，只剩一根保险丝 */
const CEILING = 1e5

function levelsWithinBudget(costOf, level, budget) {
  let left = budget, n = 0
  while (level + n < CEILING) { const c = costOf(level + n); if (!(c <= left)) break; left -= c; n += 1 }
  return n
}
function totalCost(costOf, level, count) { let s = 0; for (let i = 0; i < count; i++) s += costOf(level + i); return s }

for (const [name, costOf] of [['根骨 rebirthCost', rebirthCost], ['鉴宝台 exploreCost', exploreCost]]) {
  console.log(`\n${name}`)
  for (const purse of [0, 1, 2, 3, 9, 24, 100, 1000]) {
    for (const lv of [0, 3]) {
      const n = levelsWithinBudget(costOf, lv, purse)
      const spend = totalCost(costOf, lv, n)
      console.log(`  口袋 ${String(purse).padStart(4)} · Lv.${lv} → 买 ${n} 级，花 ${spend}${n ? `，下一级要 ${costOf(lv + n)}` : ''}`)
    }
  }
}
