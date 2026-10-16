// 金丹那条线该压在哪：满法宝 + 不同阶段的根骨树，一世从 0 攒起，看越过 1e36 之后每一档要多久。
// 用法：node --import ./sim/ts-hook.mjs sim/jindan.mjs [终点数量级=60]
import { LIANQI_UPGRADES, REBIRTH_TREE, TREASURES } from '../src/game/词条与属性.ts'
import { treeMods, treasureMods, mergeMods, runLife, dur } from './life-engine.mjs'

const ITEMS = LIANQI_UPGRADES
const END = Number(process.argv[2] ?? 60)
const TRE = Object.fromEntries(TREASURES.map((t) => [t.id, t.cap]))

/** 根骨树的几个台阶：sim/e36.mjs 那条 4000 世阶梯上取几刀 */
const STAGES = [
  ['刚解锁探索', { daoJi: 2, lingGen: 2, wuXing: 2, huiGen: 2, yuanFa: 2 }],
  ['法宝收齐那阵', { daoJi: 8, lingGen: 8, wuXing: 8, huiGen: 8, yuanFa: 8 }],
  ['再挂两千世', { daoJi: 15, lingGen: 15, wuXing: 15, huiGen: 15, yuanFa: 15 }],
  ['4000 世终局', { daoJi: 24, lingGen: 24, wuXing: 24, huiGen: 24, yuanFa: 23 }],
]

const show = (marks) =>
  [15, 20, 22, 24, 26, 28, 30, 32, 36, 40, 45, 50]
    .map((d) => {
      const hit = marks.find(([m]) => m === d)
      return `1e${d}:${hit ? dur(hit[1]) : '—'}`
    })
    .join(' ')

console.log(`满法宝（层数吃满）+ 各阶段根骨树，一世从 0 攒到 1e${END}`)
for (const [name, rebirth] of STAGES) {
  for (const free of [false, true]) {
    const mods = mergeMods(treeMods(rebirth), treasureMods(TRE))
    const r = runLife({ mods, target: 10 ** END, free })
    console.log(
      `\n  ${name} · ${free ? '不取一毫' : '照价扣灵气'}` +
        `：${r.timedOut ? `撞上限（${dur(r.t)}）` : dur(r.t)}` +
        ` · 法门 ${ITEMS.map((i) => `${i.id.split('_')[1]}:${r.lv[i.id]}`).join(' ')}`,
    )
    console.log(`    ${show(r.marks)}`)
  }
}
