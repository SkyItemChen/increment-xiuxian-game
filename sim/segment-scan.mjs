// 扫"高段涨幅"这一个旋钮：三条乘法类法门在 at 级之后换成多陡的涨价，值多少年。
// 中段（10/10/12 级起把 20/15/12 降到 6/5/4）保持不动，因为它已经验过不动 20 分钟锚点。
// 用法：node --import ./sim/ts-hook.mjs sim/segment-scan.mjs [目标数量级=36]
import { LIANQI_UPGRADES } from '../src/game/词条与属性.ts'
import { bareMods, runLife, dur } from './life-engine.mjs'

/** 三条乘法类法门各自的中段（与 src/game/词条与属性.ts 同步） */
const MID = {
  lianqi_ningQi: { at: 12, growth: 4 },
  lianqi_juLing: { at: 10, growth: 6 },
  lianqi_zhouTian: { at: 10, growth: 5 },
}

/** 在表里克隆一份；mid=null 表示不分段（回到改版前一路用 growth 的写法） */
function withHigh(highAt, highGrowth) {
  return LIANQI_UPGRADES.map((d) => {
    const mid = MID[d.id]
    if (!mid) return d
    if (highAt === null) return { ...d, segments: undefined }
    return { ...d, segments: [mid, { at: highAt, growth: highGrowth }] }
  })
}

const TARGET_LOG = Number(process.argv[2] ?? 36)
const targets = [10, 20, 30, TARGET_LOG]

console.log(`空树空宝、一世挂到 1e${TARGET_LOG}；第一段照旧（20.2 分摸到 1e10）\n`)
console.log('高段起点  高段涨幅  ' + targets.map((d) => `1e${d}`.padStart(10)).join('') + '   末尾法门(凝气/聚灵/周天)')

const baseline = runLife({ mods: bareMods(), target: 10 ** TARGET_LOG, items: withHigh(null, 0) })
const row = (highAt, highG, r) => {
  if (r.timedOut) return '撞上限未完'
  const at = (d) => {
    const m = r.marks.find(([x]) => x === d)
    return (m ? dur(m[1]) : '—').padStart(10)
  }
  return (
    `${String(highAt).padStart(8)}  ${String(highG).padStart(8)}  ` +
    targets.map((d) => at(d)).join('') +
    `   ${['lianqi_ningQi', 'lianqi_juLing', 'lianqi_zhouTian'].map((id) => r.lv[id]).join('/')}`
  )
}
console.log(row('不分段', '12/20/15', baseline))
console.log(row('无高段', '中段到底', runLife({ mods: bareMods(), target: 10 ** TARGET_LOG, items: withHigh(999, 999) })))
console.log('')

for (const highAt of [15, 20, 30, 50]) {
  for (const highG of [15, 30, 100, 400, 2000]) {
    const r = runLife({ mods: bareMods(), target: 10 ** TARGET_LOG, items: withHigh(highAt, highG) })
    console.log(row(highAt, highG, r))
  }
  console.log('')
}

