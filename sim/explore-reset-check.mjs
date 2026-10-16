// 探索的重置边界：只散修行那一层，根骨树必须原样留着。
import { BigNumber } from '../src/game/BigNumber'
import { buyRebirth, explore, state } from '../src/game/state.ts'

state.pointsEarned = 100
state.points = 60
state.spirit = new BigNumber(1e8, 0)
state.loopEarned = new BigNumber(1e8, 0)
state.levels = { lianqi_tuNa: 7, lianqi_ziFu: 2 }
console.log('买两根骨：', buyRebirth('daoJi', 3), buyRebirth('lingGen', 2))

const before = { ...state.rebirth }
const spirit = state.spirit.format()
const levels = Object.keys(state.levels).length

console.log('\n挖一铲：', explore())
console.log(`  灵气 ${spirit} → ${state.spirit.format()}（应归零）`)
console.log(`  法门 ${levels} 条 → ${Object.keys(state.levels).length} 条（应归零）`)
console.log(`  手上筑基点 → ${state.points}（应押光）`)
console.log(`  累计筑基点 → ${state.pointsEarned}（应不退）`)
console.log('  根骨树 买前', before, '→ 买后', state.rebirth)
console.log(`  法宝 ${JSON.stringify(state.treasures)} · 见识 ${state.insight} · 探索次数 ${state.explores}`)

const same = JSON.stringify(before) === JSON.stringify(state.rebirth)
const spread = Object.values(state.rebirth).some((n) => n > 0)
const cleared = state.spirit.toNumber() === 0 && Object.keys(state.levels).length === 0 && state.points === 0
console.log(`\n判定：根骨${same ? '原样留着' : '被清掉了（不该）'}${spread ? '且等级还在' : '，但一条都没买上（测不出东西）'}；修行层${cleared ? '已散去' : '没散干净（不该）'}`)
