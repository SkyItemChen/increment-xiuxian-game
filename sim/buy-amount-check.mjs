import { buyExplore, buyRebirth, exploreRows, rebirthRows, state } from '../src/game/state.ts'

state.points = 9
console.log('手上 9 点 ·', rebirthRows().map((r) => `${r.def.name} ${r.cost}点/最大${r.maxLevels}级`).join(' · '))
console.log('  买 1 级道基：', buyRebirth('daoJi', 1), '→ 道基', state.rebirth.daoJi, '· 剩', state.points)
console.log('  买最大灵根：', buyRebirth('lingGen', 'max'), '→ 灵根', state.rebirth.lingGen, '· 剩', state.points)
console.log('  买 5 级悟性（点数不够）：', buyRebirth('wuXing', 5), '→ 悟性', state.rebirth.wuXing ?? 0)

state.points = 0
state.insight = 24
console.log('手上 24 识 ·', exploreRows().map((r) => `${r.def.name} ${r.cost}识/最大${r.maxLevels}级`).join(' · '))
console.log('  买 1 级眼力：', buyExplore('yanLi', 1), '→ 眼力', state.exploreLevels.yanLi, '· 剩', state.insight)
console.log('  买最大眼力：', buyExplore('yanLi', 'max'), '→ 眼力', state.exploreLevels.yanLi, '· 剩', state.insight)
