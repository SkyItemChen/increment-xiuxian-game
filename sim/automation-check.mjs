import { REALMS, CULTIVATE_INDEX } from '../src/game/realms.ts'
import { BigNumber } from '../src/game/BigNumber.ts'
import { achievementRows, autoBuyActive, autoBuyGate, autoBuyPillActive, autoPull, autoPullActive, buyAllFromEnd, exportSave, importSave, pullQuote, state } from '../src/game/state.ts'

const ids = REALMS[CULTIVATE_INDEX].upgrades.map((def) => def.id)

// 1. 存档往返还上：开着存、清成默认、读回来应该还是开的
state.settings.autoBuyCultivate = true
const on = exportSave()
state.settings.autoBuyCultivate = false
console.log('开→存→读：', importSave(on), '→', state.settings.autoBuyCultivate)

// 2. 存档里 flags 那一格丢了自动购买位：读进来必须回到关
const code = JSON.parse(atob(on))
code[18] = code[18] & ~2
console.log('老存档（flags 没这一位）：', importSave(btoa(JSON.stringify(code))), '→', state.settings.autoBuyCultivate)

// 3. 成就门槛：累计 19 点不开、20 点开；开关没拨也不算在跑
state.settings.autoBuyCultivate = false
state.pointsEarned = 19
console.log('累计 19：', JSON.stringify(autoBuyGate()), '· 在跑 =', autoBuyActive())
state.pointsEarned = 20
console.log('累计 20：', JSON.stringify(autoBuyGate()), '· 开关没拨，在跑 =', autoBuyActive())
state.settings.autoBuyCultivate = true
console.log('累计 20 + 拨上开关：在跑 =', autoBuyActive())
state.points = 0
console.log('把 20 点全花光（余额 0）：在跑 =', autoBuyActive(), '· 成就页 =', JSON.stringify(achievementRows()[0]))

// 4. 代买只花灵气、只涨法门等级，绝不碰破境该管的东西
state.settings.autoBuyCultivate = true
importSave(on)
state.spirit = new BigNumber(5, 12)
state.loops = 3
state.points = 7
state.pointsEarned = 40
state.realmIndex = 1
const before = { loops: state.loops, points: state.points, realmIndex: state.realmIndex }
const bought = buyAllFromEnd(ids)
const levels = ids.map((id) => state.levels[id] ?? 0)
console.log('代买跑到：', bought, '· 灵气剩', state.spirit.format(2), '· 等级', levels.join('/'))
console.log(
  '世数/筑基点/标签有没有被偷改：',
  state.loops === before.loops && state.points === before.points && state.realmIndex === before.realmIndex,
)

// 5. 穷到一层都买不起：什么都不该发生
state.spirit = BigNumber.zero()
for (const id of ids) state.levels[id] = 0
console.log('灵气为 0 时代买：', buyAllFromEnd(ids), '· 等级', ids.map((id) => state.levels[id]).join('/'))

// 6. 丹炉代买走的是「一丹在手」那条：累计灵气过了 1e30 也不算，得亲手结过一层丹
state.settings.autoBuyPill = true
const pass = () => achievementRows().find((row) => row.def.id === 'pointPass')
const pillRow = () => achievementRows().find((row) => row.def.id === 'autoBuyPill')
state.jindan = 0
state.totalEarned = BigNumber.from(1e29)
console.log('累计灵气 1e29、结丹 0 层：', JSON.stringify(pass()), '· 丹炉代买在跑 =', autoBuyPillActive())
state.totalEarned = BigNumber.from(1e30)
console.log('累计灵气 1e30、结丹还是 0 层：代买在跑 =', autoBuyPillActive(), '·', JSON.stringify(pillRow()))
state.jindan = 1
console.log('结过一层丹：', JSON.stringify(pillRow()), '· 代买在跑 =', autoBuyPillActive())

// 7. 成就页与自动化页同一个顺序：练气 → 筑基 → 金丹，丹炉那条不许再往前挤
console.log(
  '成就页顺序：',
  achievementRows().map((row) => `${row.def.realm}·${row.def.name}${row.unlocked ? '✓' : '✗'}`).join(' → '),
)

// 8. 转盘代抽走的是「转过一圈」那条：得自己转满 50 次，之后才让盘子替玩家转
//    这条最要紧的是"什么都不多碰"——丹、灵气、筑基点、结丹层数一个都不许动，
//    结丹与探索押注仍然只归玩家按。
state.settings.autoBuyPull = true
state.jindan = 2
state.pulls = 0
state.spirits = {}
state.dreg = BigNumber.zero()
state.dan = new BigNumber(9, 20)
state.spirit = new BigNumber(5, 12)
state.points = 7
console.log('零渣、开关拨上：在跑 =', autoPullActive(), '· 代抽 =', autoPull(), '· 抽过', state.pulls, '次')
state.pulls = 49
state.dreg = new BigNumber(5, 25)
console.log('转过 49 次、渣够：', JSON.stringify(achievementRows().find((r) => r.def.id === 'autoBuyPull')), '· 在跑 =', autoPullActive(), '· 代抽 =', autoPull())
state.pulls = 50
console.log('转过 50 次：在跑 =', autoPullActive())
const untouched = {
  danM: state.dan.m, danE: state.dan.e,
  qiM: state.spirit.m, qiE: state.spirit.e,
  points: state.points, jindan: state.jindan,
}
const pulled = autoPull()
const spun = Object.entries(state.spirits)
  .filter(([, lv]) => lv > 0)
  .map(([id, lv]) => `${id} Lv.${lv}`)
  .join(' ')
console.log(
  '有渣时代抽：', pulled, '· 抽过', state.pulls, '次 ·', spun || '一道没中', '· 剩渣', state.dreg.format(2),
)
console.log(
  '丹/灵气/筑基点/结丹层数有没有被偷改：',
  state.dan.m === untouched.danM && state.dan.e === untouched.danE &&
    state.spirit.m === untouched.qiM && state.spirit.e === untouched.qiE &&
    state.points === untouched.points && state.jindan === untouched.jindan,
)
console.log('渣见底后再按：', autoPull(), '· 抽过', state.pulls, '次 · 还能连抽', pullQuote().maxCount, '下')
// 抽数这笔账不会被散功清掉：结丹层数归 0、灵气散干净，转过的那一大圈还认
state.jindan = 0
state.totalEarned = BigNumber.from(1e29)
state.dreg = new BigNumber(5, 25)
console.log('散功之后（结丹 0 层）：在跑 =', autoPullActive(), '· 代抽 =', autoPull(), '· 抽过', state.pulls, '次')
