// 事件驱动的练气一世模拟器：两次购买之间产出速率是常数，所以直接跳到"下一个买得起的瞬间"，
// 比 0.2 秒步进快几个数量级，而且对"攒到就买"这个策略是精确解。
// 价目表直接 import src/game/upgrades.ts 的那几个 log10 纯函数，分段涨幅不在仓库里留第二份镜像。
import { LIANQI_UPGRADES, REBIRTH_TREE, TREASURES, GATHER_CRIT_MULT } from '../src/game/词条与属性.ts'
import { rebirthCost } from '../src/game/rebirth.ts'
import { levelCostLog10, bulkCostLog10, maxAffordable } from '../src/game/upgrades.ts'

export const GATE = 1e10
const CRIT_GAIN = GATHER_CRIT_MULT - 1

/** 第 lv+1 级的价格（log10） */
const nextCostLog = levelCostLog10

/** 空树空宝时用的默认修正量 */
export function bareMods() {
  return {
    globalAdd: 0, energyAdd: 0, outputAdd: 0, cut: 0, crit: 0, pointAdd: 0,
    tAutoBase: 0, tAutoMultLog: 0, tSpeedLog: 0,
  }
}

export function treeMods(rebirth) {
  const m = bareMods()
  for (const def of REBIRTH_TREE) {
    const lv = rebirth[def.id] ?? 0
    if (!lv) continue
    const v = def.power * lv
    if (def.kind === 'global-add') m.globalAdd += v
    else if (def.kind === 'output-add') m.outputAdd += v
    else if (def.kind === 'cost-cut') m.cut += v
    else if (def.kind === 'crit-add') m.crit += v
    else if (def.kind === 'point-add') m.pointAdd += v
  }
  return m
}

/** 法宝按层数吃满（探索那一层的抽卡节奏不在这里算，只当上限看）。淬炼改版后不再缩放 power */
export function treasureMods(treasures) {
  const m = bareMods()
  for (const def of TREASURES) {
    const lv = treasures[def.id] ?? 0
    if (!lv) continue
    const power = def.power
    if (def.kind === 'auto-base') m.tAutoBase += power * lv
    else if (def.kind === 'auto-mult') m.tAutoMultLog += lv * Math.log10(power)
    else if (def.kind === 'speed-mult') m.tSpeedLog += lv * Math.log10(power)
    else if (def.kind === 'cost-cut') m.cut += power * lv
    else if (def.kind === 'gather-crit') m.crit += power * lv
    else if (def.kind === 'point-back') m.pointAdd += Math.round(power * lv)
  }
  return m
}

export function mergeMods(a, b) {
  const o = { ...a }
  for (const k of Object.keys(o)) o[k] = (o[k] || 0) + (b[k] || 0)
  return o
}

/**
 * 一世：从 spirit0 起攒到 target，中途把买得起的法门全买了。
 * items 可以换成一张改过分段表的副本，用来看"高段涨幅"这一个旋钮单独值多少年。
 * free=true 是成就「不取一毫」：价目表照旧当门槛，但灵气一分不扣——
 * end 对应一键购买/自动化（每行各自按累计造价算能买几级），cheap 对应把 1 层按钮连点（只看下一级单价）。
 */
export function runLife({
  mods, target, items = LIANQI_UPGRADES, spirit0 = 0, policy = 'cheap', capSeconds = 1e18, free = false,
}) {
  const lv = Object.fromEntries(items.map((i) => [i.id, 0]))
  let spirit = spirit0
  let earned = spirit0
  let t = 0
  const marks = []
  let nextMark = 10

  /** 法门那一份灵气/秒；灵根只管法门这一份，所以 (1+outputAdd) 只挂在 perSecond 上 */
  const incomeLog = () => {
    let autoBase = 0
    let powerLog = 0
    let multLog = 0
    let speedLog = 0
    for (const it of items) {
      const n = lv[it.id]
      if (!n) continue
      if (it.kind === 'auto-base') autoBase += it.power * n
      else if (it.kind === 'auto-power') powerLog += n * Math.log10(it.power)
      else if (it.kind === 'auto-mult') multLog += n * Math.log10(it.power)
      else speedLog += n * Math.log10(it.power)
    }
    const perSecond = autoBase * 10 ** powerLog * 10 ** multLog * (1 + mods.outputAdd)
    const rate =
      (1 + mods.tAutoBase + perSecond) * 10 ** mods.tAutoMultLog * (1 + mods.globalAdd + mods.energyAdd)
    const speed = 10 ** (mods.tSpeedLog + speedLog)
    const crit = 1 + Math.min(mods.crit, 1) * CRIT_GAIN
    return Math.log10(rate * speed * crit)
  }

  /** 把手上的灵气能换的法门全换掉，返回剩下的灵气 */
  const buy = () => {
    // 闭式解在"灵气刚好等于造价"这一点上会向下取整成 0 级（游戏里同一条式子也有这个毛病），
    // 事件驱动的跳步正好每次踩在这个点上，所以这里给一点容差
    const have = Math.log10(spirit) + 1e-9
    if (policy === 'end') {
      // 与游戏里同一条 maxAffordable（分段版：一段一段往前走，跨段时把剩的灵气带进下一段）
      for (const it of [...items].reverse()) {
        const n = maxAffordable(it, lv[it.id], have, mods.cut)
        if (n <= 0) continue
        const c = bulkCostLog10(it, lv[it.id], n, mods.cut)
        if (!free) spirit -= 10 ** c
        lv[it.id] += n
      }
      return
    }
    for (;;) {
      let best = null
      for (const it of items) {
        const c = nextCostLog(it, lv[it.id], mods.cut)
        if (c <= have && (best === null || c < best.c)) best = { it, c }
      }
      if (!best) return
      if (!free) spirit -= 10 ** best.c
      lv[best.it.id] += 1
    }
  }

  // 走速是全局倍率，买一级就得重算，跟着 buy() 一起更新
  let speedLog = 0
  const reindex = () => {
    speedLog = 0
    for (const it of items) if (it.kind === 'speed-mult') speedLog += (lv[it.id] || 0) * Math.log10(it.power)
  }

  const L = () => (spirit > 0 ? Math.log10(spirit) : -Infinity)

  buy()
  reindex()
  const targetLog = Math.log10(target)
  let steps = 0
  while (L() < targetLog && t < capSeconds) {
    steps++
    if (steps > 5e6) return { timedOut: true, tooManySteps: true, t, spirit, earned, lv }
    let cheapLog = Infinity
    for (const it of items) cheapLog = Math.min(cheapLog, nextCostLog(it, lv[it.id], mods.cut))
    // 下一个事件：要么够买下一级，要么够到目标
    const eventLog = Math.min(cheapLog, targetLog)
    if (!Number.isFinite(eventLog) || eventLog > 320) return { timedOut: true, t, spirit, earned, lv }
    const il = incomeLog()
    if (il < -100) return { timedOut: true, t, spirit, earned, lv }
    const rate = 10 ** il
    const need = 10 ** eventLog - spirit
    const dt = need / rate
    t += dt
    spirit += need
    earned += need
    while (nextMark <= eventLog && nextMark <= targetLog) {
      marks.push([nextMark, t])
      nextMark++
    }
    buy()
    reindex()
  }
  while (nextMark <= targetLog) {
    marks.push([nextMark, t])
    nextMark++
  }
  return { timedOut: t >= capSeconds, t, spirit, earned, lv, marks, steps }
}

const YEAR = 365.25 * 86400
export function dur(s) {
  if (!Number.isFinite(s)) return '∞'
  if (s < 3600) return `${(s / 60).toFixed(1)} 分`
  if (s < 86400) return `${(s / 3600).toFixed(2)} 小时`
  if (s < YEAR) return `${(s / 86400).toFixed(2)} 天`
  const y = s / YEAR
  if (y < 1e4) return `${y.toFixed(1)} 年`
  if (y < 1e8) return `${(y / 1e4).toFixed(2)} 万年`
  if (y < 1e12) return `${(y / 1e8).toFixed(2)} 亿年`
  return `${(y / 1e12).toFixed(2)} 万亿年`
}

/** 破境折算的筑基点，和 rebirth.ts 的 pointsForLoop 同一条式子（纯 double 版） */
export function pointsOf(earned, loops, extra) {
  const over = Math.log10(earned) - 10 + 0.25 * Math.min(loops, 8)
  return over < 0 ? 0 : Math.max(1, Math.floor(3 * over)) + extra
}

/**
 * 贪心买最便宜的一级。树没有等级上限了，所以也没有"点满"这个终点——
 * 要停就按世数或按累计时长停（见 sim/e36.mjs 的 scenarioB）。
 */
export function greedyTree(points, lv) {
  let left = points
  for (;;) {
    let best = null
    for (const r of REBIRTH_TREE) {
      const c = rebirthCost(lv[r.id] ?? 0)
      if (c <= left && (best === null || c < best.c)) best = { id: r.id, c }
    }
    if (!best) return left
    left -= best.c
    lv[best.id] = (lv[best.id] ?? 0) + 1
  }
}

export const treeLevels = (lv) => REBIRTH_TREE.reduce((a, r) => a + (lv[r.id] ?? 0), 0)
