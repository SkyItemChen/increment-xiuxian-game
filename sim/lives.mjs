// 一世一世连着模拟：破境拿筑基点 → 花筑基点买根骨树 → 下一世更快、攒得更多。
// 结论：只要"摸到门槛就破"，over 一世一世都卡在 0.72~0.77，所以纯靠 over 的公式必然看着像定数；
// 增长得靠玩家肯多挂一会儿，而树让同样的数量级越来越便宜。
import { runLife, GATE, pointsForOver } from './first-life-lib.mjs'

const ROWS = [
  { id: 'daoJi', cost: 1.5 },
  { id: 'lingGen', cost: 1.5 },
  { id: 'wuXing', cost: 1.5 },
  { id: 'huiGen', cost: 1.5 },
  { id: 'yuanFa', cost: 1.5 },
]
const costOf = (lv) => Math.max(1, Math.ceil(1.5 ** lv))
/** 和 src/game/state.ts 的 TREE_LEVEL_CEILING 同一个保险丝：树没有上限，靠价格自己收 */
const CEILING = 1e5

function treeMods(lv) {
  return {
    globalAdd: 0.2 * (lv.daoJi ?? 0),
    outputAdd: 0.5 * (lv.lingGen ?? 0),
    cut: 0.02 * (lv.wuXing ?? 0),
    crit: 0.05 * (lv.huiGen ?? 0),
    pointAdd: lv.yuanFa ?? 0,
  }
}

/** 贪心买最便宜的一级，代表只按性价比点树的玩家 */
function spend(points, lv) {
  let left = points
  for (;;) {
    let best = null
    for (const r of ROWS) {
      const cur = lv[r.id] ?? 0
      if (cur >= CEILING) continue
      const c = costOf(cur)
      if (c <= left && (best === null || c < best.c)) best = { id: r.id, c }
    }
    if (!best) return left
    left -= best.c
    lv[best.id] = (lv[best.id] ?? 0) + 1
  }
}

const overOf = (loop) => Math.log10(loop) - Math.log10(GATE)

const FORMULAS = {
  '现行 线性×3 + 道行加成': (loops) => (o) => pointsForOver(o, loops),
  '参考 纯线性（无道行加成）': () => (o) => pointsForOver(o, 0),
  '参考 平方（改版前）': () => (o) => Math.max(1, Math.floor(o * o)),
}

function play(makePoints, lives = 12) {
  const lv = {}
  const rows = []
  let leftover = 0
  for (let i = 0; i < lives; i++) {
    const m = treeMods(lv)
    const r = runLife({ ...m, capSeconds: 3e7 })
    const over = overOf(r.loop)
    const base = r.timedOut ? 0 : makePoints(i)(Math.max(0, over))
    const gained = base + m.pointAdd
    leftover = spend(gained, lv)
    rows.push({
      life: i + 1,
      min: r.timedOut ? null : r.t / 60,
      over,
      base,
      bonus: m.pointAdd,
      gained,
      total: Object.values(lv).reduce((a, b) => a + b, 0),
      tree: ROWS.map((x) => `${x.id}${lv[x.id] ?? 0}`).join(' '),
    })
  }
  return rows
}

for (const [name, make] of Object.entries(FORMULAS)) {
  console.log(`\n${name}`)
  for (const r of play(make)) {
    console.log(
      `  第${String(r.life).padStart(2)}世 ${r.min === null ? '  超时' : `${r.min.toFixed(1).padStart(6)} 分`}` +
      ` · 多 ${r.over.toFixed(2)} 量级 · 点 ${String(r.base).padStart(3)}+${r.bonus}=${String(r.gained).padStart(3)}` +
      ` · 树共 ${String(r.total).padStart(3)} 级 [${r.tree}]`,
    )
  }
}
