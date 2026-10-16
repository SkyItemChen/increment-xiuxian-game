// 筑基阶段的时间尺度：按现在的流程一世一世破下去，累计 2–4 小时能攒到什么地步。
// 纯 double，绝不 import BigNumber；只照抄 src/game 里的价目与结算式子。
import { runLife, GATE, pointsForOver } from './first-life-lib.mjs'

const ROWS = [{ id: 'daoJi' }, { id: 'lingGen' }, { id: 'wuXing' }, { id: 'huiGen' }, { id: 'yuanFa' }]
const costOf = (lv) => Math.max(1, Math.ceil(1.5 ** lv))
/** 和 src/game/state.ts 的 TREE_LEVEL_CEILING 同一个保险丝 */
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

/** 贪心买最便宜的一级，返回花剩的零头 */
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

const total = (lv) => Object.values(lv).reduce((a, b) => a + b, 0)
const detail = (lv) => ROWS.map((r) => `${r.id}${lv[r.id] ?? 0}`).join(' ')

/** wait = 每世摸到门槛后再多挂几个数量级才破境；活跃玩家会等，挂机玩家等得更多 */
function play(wait, hours) {
  const lv = {}
  const rows = []
  let minutes = 0
  let earned = 0
  let bank = 0
  for (let i = 0; i < 4000; i++) {
    const m = treeMods(lv)
    const r = runLife({ ...m, target: GATE * 10 ** wait, capSeconds: 3e7 })
    if (r.timedOut) break
    const over = Math.log10(r.loop) - Math.log10(GATE)
    const gained = pointsForOver(over, i) + m.pointAdd + bank
    bank = spend(gained, lv)
    earned += pointsForOver(over, i) + m.pointAdd
    minutes += r.t / 60
    rows.push({ life: i + 1, min: minutes, sec: r.t, over, gained, earned, levels: total(lv), tree: detail(lv), bank })
    if (minutes >= hours * 60) break
  }
  return rows
}

function checkpoints(rows, label) {
  console.log(`\n${label}`)
  for (const h of [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 3.5, 4]) {
    const i = rows.findIndex((r) => r.min >= h * 60)
    if (i < 0) {
      console.log(`  ${h} 小时：还没跑到`)
      continue
    }
    const r = rows[i]
    console.log(
      `  ${String(h).padStart(4)} 小时 · ${String(r.life).padStart(3)} 世 · 累计 ${String(r.earned).padStart(5)} 点` +
      ` · 树 ${String(r.levels).padStart(3)} 级（改版前满树 85）[${r.tree}] · 零头 ${r.bank}`,
    )
  }
  // 里程碑：树到某级、累计到某点数各要多久
  for (const lvTarget of [10, 20, 30, 40, 60, 85, 120, 200]) {
    const r = rows.find((x) => x.levels >= lvTarget)
    console.log(`    树满 ${String(lvTarget).padStart(2)} 级：${r ? `${r.min.toFixed(0)} 分 / ${r.life} 世 / 累计 ${r.earned} 点` : '4 小时内到不了'}`)
  }
  for (const pTarget of [20, 30, 100, 300, 1000]) {
    const r = rows.find((x) => x.earned >= pTarget)
    console.log(`    累计 ${String(pTarget).padStart(4)} 点：${r ? `${r.min.toFixed(0)} 分 / ${r.life} 世 / 树 ${r.levels} 级` : '4 小时内到不了'}`)
  }
}

for (const wait of [0, 0.5, 1, 2]) {
  const rows = play(wait, 4)
  checkpoints(rows, `每世多挂 ${wait} 个数量级再破境`)
  const show = rows.filter((_, i) => i < 10 || (i + 1) % 10 === 0).slice(0, 24)
  for (const r of show) {
    console.log(
      `    第${String(r.life).padStart(3)}世 累计 ${String(r.min.toFixed(1)).padStart(7)} 分` +
      ` · 本世 ${(r.sec / 60).toFixed(1).padStart(6)} 分 · 多 ${r.over.toFixed(2)} 量级` +
      ` · 进账 ${String(r.gained).padStart(4)} · 树 ${String(r.levels).padStart(3)} 级`,
    )
  }
}
