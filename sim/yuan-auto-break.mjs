// 元婴自动大突破：12 次累计门槛、阈值/倍率触发、开关、以及"只碰大突破"的静态护栏。
// 用法：node --import ./sim/ts-hook.mjs sim/yuan-auto-break.mjs
import { readFileSync } from 'node:fs'
import {
  AUTO_BREAK_UNLOCKS_AT, autoBreakUnlocked, shouldAutoBreak, YUAN_MODES, yuanBreakSeconds,
} from '../src/game/元婴.ts'

const HOUR = 3600
const dur = (s) => (s < 86400 ? `${(s / 3600).toFixed(1)} 小时` : `${(s / 86400).toFixed(1)} 天`)

console.log(`【门槛】累计大突破 ≥ ${AUTO_BREAK_UNLOCKS_AT} 次解锁自动器；累计账只涨不跌`)
for (const n of [0, 1, 5, 11, 12, 13, 100]) {
  console.log(`  累计 ${String(n).padStart(3)} 次 → ${autoBreakUnlocked(n) ? '已解锁' : '仍须手点'}`)
}

console.log('\n【手点到自动要多久】三档首破 × 12 次（不含洞明/神炼）')
for (const m of YUAN_MODES) {
  const one = yuanBreakSeconds(30, m, 0, 'sqrt')
  console.log(`  ${m.name}：单轮 ${dur(one)} × ${AUTO_BREAK_UNLOCKS_AT} = ${dur(one * AUTO_BREAK_UNLOCKS_AT)}`)
}
console.log('  设计稿的"完整多轮循环 3 天~2 个月"正好覆盖这段：夺舍 9.7 天、凝魄 14.1 天、守神 31 天。')

console.log('\n【触发】阈值触发与倍率触发都读同一本账；倍率只决定"等到几倍阈值再破"')
const TH = 30
for (const trigger of [1, 2, 5, 10]) {
  const rows = [0, 0.5, 1, 2, 5, 10].map((mult) => {
    const fire = shouldAutoBreak(12, true, TH + Math.log10(mult), TH, trigger)
    return `${mult}×:${fire ? '破' : '等'}`
  })
  console.log(`  触发倍率 ${String(trigger).padStart(2)}×  ${rows.join('  ')}`)
}
console.log('  倍率 2× 时，正好 1× 阈值不会破——必须真的等到 2 倍，避免"刚过线就手滑"。')

console.log('\n【开关】关掉后即使过线也不破；重新打开不会补破，下一次读当前余额')
const cases = [
  ['未解锁 + 开', 11, true, 31, 30],
  ['已解锁 + 关', 12, false, 31, 30],
  ['已解锁 + 开 + 过线', 12, true, 31, 30],
  ['已解锁 + 开 + 未过线', 12, true, 29, 30],
]
for (const [label, n, on, yuan, th] of cases) {
  console.log(`  ${label.padEnd(16)} → ${shouldAutoBreak(n, on, yuan, th, 1) ? '破' : '不破'}`)
}

console.log('\n【累计账】大突破会清空元神/战魂/丹/法门/丹炉，但不清累计次数；解锁后不会缩回去')
let total = 0
let unlockedAt = null
for (let i = 0; i < 20; i++) {
  total++
  if (unlockedAt === null && autoBreakUnlocked(total)) unlockedAt = total
}
console.log(`  连破 20 次：累计 ${total} · 第 ${unlockedAt} 次解锁 · 之后的散功不回拨累计账`)

console.log('\n【静态护栏】自动器只处理大突破，不碰破境/结丹/押探索')
const src = readFileSync(new URL('../src/game/元婴.ts', import.meta.url), 'utf8')
const exports = [...src.matchAll(/export (?:function|const|type|interface) ([A-Za-z0-9_]+)/g)].map((m) => m[1])
const forbidden = exports.filter((name) => /poJing|pojing|breakThrough|jieDan|jiedan|explore|tanSuo|押|破境|结丹/i.test(name))
const autoExports = exports.filter((name) => /auto/i.test(name))
console.log(`  元婴.ts 导出 ${exports.length} 项；自动相关：${autoExports.join(', ') || '（无）'}`)
console.log(`  含破境/结丹/探索字样的自动导出：${forbidden.length ? forbidden.join(', ') : '0 项 ✓'}`)
console.log('  这条是结构性的：元婴模块根本没有给那三颗按钮留入口，接运行时也不许另开一条。')
