// 破境之后继续攒，看"多攒一个数量级"各要多久——筑基点按 over 线性给，这条曲线就是它的真实价目表。
// 注意两条线要分清：破境的判定是**手上持有** 1e10，点数结算看**本世累计**，两者差着一截。
import { ITEMS, CRIT_MULT, nextCost, pointsForOver } from './first-life-lib.mjs'

const GATE = 1e10
const MARKS = [1e10, 1e11, 1e12, 1e13, 1e14, 1e15]

export function ladder({ outputAdd = 0, globalAdd = 0, floorBase = 1, cut = 0, crit = 0, capSeconds = 3e7 } = {}) {
  const lv = Object.fromEntries(ITEMS.map((i) => [i.id, 0]))
  let spirit = 0
  let loop = 0
  let t = 0
  let mark = 0
  let canBreak = null
  const hits = []

  const income = () => {
    let autoBase = 0
    let p = 1
    let m = 1
    let s = 1
    for (const it of ITEMS) {
      const n = lv[it.id]
      if (!n) continue
      if (it.kind === 'auto-base') autoBase += it.power * n
      else if (it.kind === 'auto-power') p *= it.power ** n
      else if (it.kind === 'auto-mult') m *= it.power ** n
      else s *= it.power ** n
    }
    return (autoBase * p * m + floorBase) * (1 + outputAdd) * (1 + globalAdd) * s * (1 + crit * (CRIT_MULT - 1))
  }

  while (t < capSeconds && mark < MARKS.length) {
    const gain = income() * 0.2
    spirit += gain
    loop += gain
    t += 0.2
    for (;;) {
      let best = null
      for (const it of ITEMS) {
        const c = nextCost(it, lv[it.id], cut)
        if (c <= spirit && (best === null || c < best.c)) best = { id: it.id, c }
      }
      if (!best) break
      spirit -= best.c
      lv[best.id] += 1
    }
    if (canBreak === null && spirit >= GATE) canBreak = { t, loop }
    if (loop >= MARKS[mark]) {
      const over = Math.log10(loop) - Math.log10(GATE)
      hits.push({ mark: MARKS[mark], t, over, points: pointsForOver(over), perSecond: income() })
      mark += 1
    }
  }
  return { canBreak, hits }
}

if (process.argv[1] && process.argv[1].endsWith('points-ladder.mjs')) {
  const mins = (s) => (s / 60).toFixed(1).padStart(7)
  const run = (label, opts) => {
    const { canBreak, hits } = ladder(opts)
    console.log(`\n${label}`)
    console.log(`  能破境（持有 1e10）：${mins(canBreak.t)} 分 · 此时本世累计 ${canBreak.loop.toExponential(2)} → ${pts(canBreak.loop)} 点`)
    for (const h of hits) {
      console.log(`  累计到 1e${Math.log10(h.mark)}：${mins(h.t)} 分 · ${String(h.points).padStart(3)} 点 · 比门槛多 ${h.over.toFixed(2)} 个数量级 · ${h.perSecond.toExponential(2)}/秒`)
    }
  }
  const pts = (loop) => pointsForOver(Math.log10(loop) - Math.log10(GATE))
  run('常速一世（先天根基 1，根骨树空）', {})
  run('灵根 25（灵气/秒 ×13.5）', { outputAdd: 12.5 })
  run('道基 25 + 灵根 25 + 慧根 10 + 悟性 15', {
    globalAdd: 3.75,
    outputAdd: 12.5,
    crit: 0.5,
    cut: 0.3,
  })
}
