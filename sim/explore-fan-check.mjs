// 凡品一共 22 层，是七件法宝里最厚的一档；眼力一抬，灵品/仙品的权重把它挤到 1% 以下，
// 以前只能靠"抽到已圆满的档换见识"慢慢熬。现在凡品没收齐时吃 20% 占比下限，
// 这个脚本量的是：把凡品挖满到底要几次探索。
// 玉碟会在过程中出土，所以 luck 跟着状态走——跑的是真 rollExplore，不是先验概率。
// 用法：node --import ./sim/ts-hook.mjs sim/explore-fan-check.mjs [每格种子数=200]
import { TREASURES } from '../src/game/词条与属性.ts'
import { luckOf, NO_EXPLORE_MODS, openRarities, rarityOdds, rarityWeights, rollExplore } from '../src/game/explore.ts'

const TRIALS = Number(process.argv[2] ?? 200)
const FAN = TREASURES.filter((t) => t.rarity === 'fan')
const FAN_CAP = FAN.reduce((a, t) => a + t.cap, 0)
const pct = (v) => `${(v * 100).toFixed(1)}%`

function fanDone(levels) {
  return FAN.every((t) => (levels[t.id] ?? 0) >= t.cap)
}

/** 从空手开始反复挖，返回把凡品挖满用了多少次探索 */
function tillFanDone(yanLi, tieChan, die, trial) {
  const mods = { ...NO_EXPLORE_MODS, yanLi, tieChan }
  let levels = die ? { zaoHuaYuDie: die } : {}
  let seed = (0x9e3779b9 ^ ((trial + 1) * 2654435761)) >>> 0
  for (let n = 1; n <= 100000; n++) {
    const out = rollExplore(0, seed, levels, mods)
    seed = out.seed
    levels = out.levels
    if (fanDone(levels)) return n
  }
  return Infinity
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

console.log(`凡品 ${FAN_CAP} 层（聚宝盆 8 / 玄铜镜 6 / 青竹笛 8）· 每格 ${TRIALS} 个种子 · 一次探索 = 一次破境\n`)
console.log('眼力 铁铲 玉碟  起始(凡/灵/仙)        下限前凡品  收齐凡品探索(中位/最长)  折算铲数')
for (const die of [0, 3]) {
  for (const yanLi of [0, 4, 10, 20, 40, 60]) {
    for (const tieChan of [0, 3, 9]) {
      const mods = { ...NO_EXPLORE_MODS, yanLi, tieChan }
      const startLevels = die ? { zaoHuaYuDie: die } : {}
      const odds = rarityOdds(yanLi, luckOf(startLevels, mods), openRarities(startLevels))
      // 下限没生效时的凡品占比：凡品基权重恒为 1，把灵/仙两档的权重拿回来直接归一化
      const w = rarityWeights(yanLi, luckOf(startLevels, mods), { fan: false, ling: true, xian: true })
      const rawFan = 1 / (1 + w.ling + w.xian)
      const runs = Array.from({ length: TRIALS }, (_, i) => tillFanDone(yanLi, tieChan, die, i))
      const worst = runs.reduce((a, b) => Math.max(a, b), 0)
      const shovel = 1 + tieChan
      console.log(
        `${String(yanLi).padStart(4)} ${String(tieChan).padStart(4)} ${String(die).padStart(4)}` +
        `  ${pct(odds.fan).padStart(6)}/${pct(odds.ling).padStart(6)}/${pct(odds.xian).padStart(6)}` +
        `  ${pct(rawFan).padStart(9)}` +
        `  ${String(Math.round(median(runs))).padStart(10)}/${String(worst === Infinity ? '—' : worst).padStart(6)}` +
        `  ${String(Math.round(median(runs) * shovel)).padStart(8)}`,
      )
    }
  }
}
console.log('\n"下限前凡品"＝没加 20% 保底、把凡品权重从归一化里拿掉后它原本的占比；')
console.log('"折算铲数"＝中位探索次数 × 每次铲数，也就是这 22 层实际花掉的抽数。')
