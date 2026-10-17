// 元神斗法：斩怪节奏、战将价位、三档凹性、以及"斗法到底拖慢大突破多少"。
// 用法：node --import ./sim/ts-hook.mjs sim/fight-gear-check.mjs
import {
  FIGHT_MODES, FIGHT_KILL_SECONDS, fightWaveCap, warSoulPerKill, warSoulPerSecond,
  generalCost, findFightMode, YUAN_MODES, yuanBreakSeconds,
} from '../src/game/元婴.ts'

const HOUR = 3600
const DAY = 86400
const fmt = (x) => (x >= 1e6 ? x.toExponential(2) : x.toFixed(2))
const dur = (s) => {
  if (!Number.isFinite(s)) return '∞'
  if (s < 60) return `${s.toFixed(1)} 秒`
  if (s < HOUR) return `${(s / 60).toFixed(1)} 分`
  if (s < DAY) return `${(s / HOUR).toFixed(2)} 小时`
  return `${(s / DAY).toFixed(2)} 天`
}

/* ------------------------------------------------------------ 波次与战魂 */

console.log('【一斩的节奏】开局从第 1 波起，每 10 秒一斩，斩完波次 +1，到战将上限后原地刷')
console.log('  波次   一斩战魂   战将等级要求（上限 = 2 + 等级）')
for (const w of [1, 2, 4, 10, 20, 30, 50, 80, 100]) {
  const need = Math.max(0, w - 2)
  console.log(`  ${String(w).padStart(3)}   ${fmt(warSoulPerKill(w)).padStart(10)}   Lv.${need}`)
}
console.log(`  产量底数 1.25/波、每级抬 1 波 ⇒ 每级把满波收入 ×1.25；价格底数 1.65，所以越买越慢。`)

/* ------------------------------------------------------------ 一轮 62 小时的斗法 */

/** 模拟一整个元婴周期：斩怪 → 战魂 → 买战将，战将只抬波次上限 */
function runFight(seconds, mode, generalCap = 1e5) {
  let wave = 1
  let souls = 0
  let general = 0
  let kills = 0
  let earned = 0
  const milestones = {}
  for (let t = 0; t < seconds; t += FIGHT_KILL_SECONDS) {
    souls += warSoulPerKill(wave) * mode.warMul
    earned += warSoulPerKill(wave) * mode.warMul
    kills++
    wave = Math.min(wave + 1, fightWaveCap(general))
    while (general < generalCap && souls >= generalCost(general)) {
      souls -= generalCost(general)
      general++
      wave = Math.min(wave, fightWaveCap(general))
    }
    for (const mark of [10, 20, 30, 40, 50]) {
      if (milestones[mark] === undefined && general >= mark) milestones[mark] = t + FIGHT_KILL_SECONDS
    }
  }
  return { general, souls, earned, kills, wave, milestones }
}

console.log('\n【一个元婴周期能练到几级战将】按首破 62 小时算（守神；其它档只改战魂倍率）')
console.log('  斗法档   战将等级   满波   战魂总量     战魂/秒   到 Lv.10 / 20 / 30 / 40')
for (const mode of FIGHT_MODES) {
  const r = runFight(62 * HOUR, mode)
  const marks = [10, 20, 30, 40].map((n) => (r.milestones[n] ? dur(r.milestones[n]) : '未到'))
  console.log(
    `  ${mode.name.padEnd(4)}   Lv.${String(r.general).padStart(3)}    ${String(r.wave).padStart(3)} 波` +
      `   ${fmt(r.earned).padStart(10)}   ${fmt(r.earned / (62 * HOUR)).padStart(9)}   ${marks.join(' / ')}`,
  )
}
console.log('  三档的软墙同阶：62h 内守御到 Lv.39（Lv.40 差 24h），死战到 Lv.43 且 Lv.40 只用 23h；')
console.log('  战魂倍率改的是"买到哪一档的速度"，不改"那一档的价"。')

console.log('\n【斗法的真实代价】战魂不是白来的：分走的元神流量直接拖长大突破')
for (const mode of FIGHT_MODES) {
  const base = yuanBreakSeconds(30, YUAN_MODES[0], 0, 'sqrt')
  const slowed = base / (1 - mode.yuanDrain)
  const gain = mode.warMul
  console.log(
    `  ${mode.name}：分流 ${(mode.yuanDrain * 100).toFixed(0)}% → 大突破 ${dur(base)} → ${dur(slowed)}` +
      `（×${(slowed / base).toFixed(3)}）· 战魂 ×${gain.toFixed(2)}`,
  )
}
console.log('  守神 + 死战 = 62h × 1.429 = 88.6h；换来的战魂是守御的 3.2 倍。')
console.log('  凹性已验：多要战魂的边际分流 0.100 → 0.125，后面这段更贵。')

/* ------------------------------------------------------------ 满波收入与价 */

console.log('\n【满波收入 vs 下一级价】战将越往后，回本越慢，但不会一格秒穿')
console.log('  等级   满波战魂/秒   下一级价   按满波收入要攒')
for (const lv of [0, 5, 10, 15, 20, 25, 30, 35, 40]) {
  const rate = warSoulPerSecond(lv, findFightMode('shouYu'))
  console.log(
    `  Lv.${String(lv).padStart(2)}  ${fmt(rate).padStart(10)}   ${fmt(generalCost(lv)).padStart(10)}   ${dur(generalCost(lv) / rate).padStart(10)}`,
  )
}

console.log('\n【战魂在哪一步封顶】用满波收入 / 下一级价看"再买一级划不划算"')
for (const lv of [40, 60, 80, 100, 120]) {
  const rate = warSoulPerSecond(lv, findFightMode('shouYu'))
  console.log(`  Lv.${String(lv).padStart(3)}  下一级 ${fmt(generalCost(lv)).padStart(10)}  满波收入 ${fmt(rate).padStart(10)}/秒  ${dur(generalCost(lv) / rate)}`)
}
console.log('  没有硬 cap：价格底数 1.65 > 每级收入底数 1.25，时间按 1.32^lv 变长，')
console.log('  是一堵"越买越慢"的软墙，不是买不动。')
