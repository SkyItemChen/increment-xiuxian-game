// 一世模拟：`node sim/balance.mjs` 直接跑，改动法门表/转生树/门槛之后用来复核节奏。
// 买法门的近似 = "哪条买得起就买最便宜的一级"，对应活跃玩家一路点 MAX。
import { runLife, GATE } from './first-life-lib.mjs'

const mins = (s) => (s / 60).toFixed(1)
const row = (label, r) =>
  console.log(
    `${label.padEnd(30)} ${mins(r.t).padStart(6)} 分   破境累计 ${r.loop.toExponential(2)}   点数 ${Math.max(1, Math.floor((Math.log10(r.loop) - Math.log10(GATE)) ** 2))}`,
  )

console.log('一世 = 攒到 1e10 灵气。先天根基固定 1 灵气/秒，来世快慢全看根骨树买了几级。\n')
console.log('— 单条对照（空树一世 40.3 分）—')
for (const lv of [1, 2, 3, 5, 10, 25]) {
  row(`道基 Lv.${lv}（+20% 全部产出/级）`, runLife({ globalAdd: 0.2 * lv }))
  row(`灵根 Lv.${lv}（+50% 法门/级）`, runLife({ outputAdd: 0.5 * lv }))
}
for (const lv of [1, 3, 5, 10]) {
  row(`慧根 Lv.${lv}（+5% 会心/级）`, runLife({ crit: 0.05 * lv }))
  row(`悟性 Lv.${lv}（−2% 涨价/级）`, runLife({ cut: 0.02 * lv }))
}
console.log('\n— 中期一把（道基 5 + 灵根 5 + 慧根 5 + 悟性 5）—')
row('四条各 5 级', runLife({ globalAdd: 0.75, outputAdd: 2.5, crit: 0.25, cut: 0.1 }))
console.log('\n— 后期满仓（道基 25 + 灵根 25 + 慧根 10 + 悟性 15）—')
row('四条买满', runLife({ globalAdd: 3.75, outputAdd: 12.5, crit: 0.5, cut: 0.3 }))
