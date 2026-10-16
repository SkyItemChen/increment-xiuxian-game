import { exploreGate, previewExplore, state, buyRebirth } from '../src/game/state.ts'
import { EXPLORE_UNLOCK_POINTS } from '../src/game/explore.ts'

const costOf = (lv) => Math.max(1, Math.ceil(1.5 ** lv))
// 树已经不限等了，这里按改版前的旧上限（25/25/15/10/10，共 85 级）算一个历史参照
let full = 0
for (const cap of [25, 25, 15, 10, 10]) for (let lv = 0; lv < cap; lv++) full += costOf(lv)
console.log(`旧上限那棵 85 级的树全满要 ${full} 筑基点`)

console.log(`门槛 ${EXPLORE_UNLOCK_POINTS} 点`)
state.points = 500
state.pointsEarned = 40
console.log('  累计 40：', JSON.stringify(exploreGate()), '· previewExplore =', previewExplore())
state.pointsEarned = 100
console.log('  累计 100：', JSON.stringify(exploreGate()), '· previewExplore 有货 =', previewExplore() !== null)
state.pointsEarned = 0
state.explores = 1
console.log('  挖过一次：', JSON.stringify(exploreGate()))
state.explores = 0
state.points = 3
console.log('  解锁后手上只剩 3 点，最大购买：', buyRebirth('daoJi'), '→ 道基', state.rebirth.daoJi, '· 零头', state.points)
