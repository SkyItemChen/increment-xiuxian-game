import { BigNumber } from './BigNumber'
import { growthCutOf } from './rebirth'
import type { GrowthSegment, UpgradeDef } from './词条与属性'

/**
 * 法门的价与产出怎么算。词条本身、两张法门表、转生树那三条数值都在
 * [词条与属性.ts](./词条与属性.ts)，改数值去那边改。
 */

/** log10((g^n - 1) / (g - 1))，等比数列前 n 项和 */
function geoSumLog10(g: number, n: number): number {
  const x = n * Math.log10(g)
  // x 稍大时 g^n 会溢出 double，改在 log 空间算；1 - 10^-x 在小 x 处精度不足
  if (x > 0.5) return x + Math.log10(1 - Math.pow(10, -x)) - Math.log10(g - 1)
  return Math.log10((Math.pow(g, n) - 1) / (g - 1))
}

/** 两个 log10 相加，全程不落回 double */
function logAdd10(a: number, b: number): number {
  if (a === -Infinity) return b
  if (b === -Infinity) return a
  return Math.max(a, b) + Math.log10(1 + 10 ** -Math.abs(a - b))
}

/** 第 lv+1 级吃哪一段的涨幅（未过削减）：取 at ≤ lv 里 at 最大的那段 */
export function growthAt(def: UpgradeDef, lv: number): number {
  let best: GrowthSegment | null = null
  for (const s of def.segments ?? []) {
    if (lv >= s.at && (best === null || s.at > best.at)) best = s
  }
  return best ? best.growth : def.growth
}

/** 从 lv 级起，当前这段还剩几级可买（后面没有段了就是无穷） */
function runLength(def: UpgradeDef, lv: number): number {
  let next = Infinity
  for (const s of def.segments ?? []) if (s.at > lv && s.at < next) next = s.at
  return next === Infinity ? Infinity : next - lv
}

/** 从 0 级走到 level 级一共吃了多少涨幅（不含 base）：第 level+1 级单价相对 base 的偏移 */
function growthPrefix(def: UpgradeDef, level: number, cut: number): number {
  let left = level
  let lv = 0
  let log = 0
  while (left > 0) {
    const n = Math.min(left, runLength(def, lv))
    log += n * Math.log10(growthCutOf(cut, growthAt(def, lv)))
    left -= n
    lv += n
  }
  return log
}

/** 从 level 起把等级轴按涨价段切开，每次给出 [该段涨幅 g, 段内还剩几级, 段首那一级单价 log10] */
function* runsOf(def: UpgradeDef, level: number, cut: number): Generator<[number, number, number]> {
  let lv = level
  let price = levelCostLog10(def, level, cut)
  for (;;) {
    const g = growthCutOf(cut, growthAt(def, lv))
    const room = runLength(def, lv)
    yield [g, room, price]
    if (!Number.isFinite(room)) return
    price += room * Math.log10(g)
    lv += room
  }
}

/** 第 level+1 级的单价（log10）：base 乘上此前每一级涨幅攒出来的累积量 */
export function levelCostLog10(def: UpgradeDef, level: number, cut = 0): number {
  return Math.log10(def.base) + growthPrefix(def, level, cut)
}

/** 从 level 起连买 count 级的总价（log10）：逐段算完再相加，全程不溢出 double */
export function bulkCostLog10(def: UpgradeDef, level: number, count: number, cut = 0): number {
  let left = count
  let total = -Infinity
  for (const [g, room, price] of runsOf(def, level, cut)) {
    if (left <= 0) break
    const n = Math.min(left, room)
    total = logAdd10(total, price + geoSumLog10(g, n))
    left -= n
  }
  return total
}

/** 从 level 起连买 count 级的总价。cut 是悟性压下来的涨价幅度，只改涨幅，首级价格不动 */
export function bulkCost(def: UpgradeDef, level: number, count: number, cut = 0): BigNumber {
  if (count <= 0) return BigNumber.zero()
  return BigNumber.fromLog10(bulkCostLog10(def, level, count, cut))
}

/**
 * 法门没有等级上限，只留一条天花板防住改过内存的存档：单次 MAX 最多买这么多级，
 * 读档也按它夹紧。正常玩法一辈子摸不到零头，纯粹是给闭式解兜底。
 */
export const LEVEL_CEILING = 1e6

/**
 * 手里有 haveLog10 这么多灵气，从 level 起最多还买得起几级。
 * 逐段推进：每段内仍是那条等比闭式解，段与段之间把花掉的部分在 log 空间减出去。
 */
export function maxAffordable(def: UpgradeDef, level: number, haveLog10: number, cut = 0): number {
  if (!Number.isFinite(haveLog10)) return 0
  let have = haveLog10
  let bought = 0
  for (const [g, room, price] of runsOf(def, level, cut)) {
    if (price > have || bought >= LEVEL_CEILING) break
    const y = have + Math.log10(g - 1) - price
    const logArg = y > 0 ? y + Math.log10(1 + Math.pow(10, -y)) : Math.log10(1 + Math.pow(10, y))
    const n = Math.min(Math.floor(logArg / Math.log10(g)), room, LEVEL_CEILING - bought)
    if (n <= 0) break
    bought += n
    // 花掉这一截：spent ≤ have 所以 d ≤ 0；两个数贴近时得靠 -expm1，否则余额会被算成 0
    const d = price + geoSumLog10(g, n) - have
    have = d >= 0 ? -Infinity : have + Math.log10(-Math.expm1(d * Math.LN10))
    if (!Number.isFinite(have)) break
  }
  return bought
}

export interface Production {
  /** 法门堆出来的灵气/秒 */
  perSecond: BigNumber
  /** 先天根基的倍率，起手那 1 灵气/秒归它放大 */
  gatherMult: BigNumber
  /** 进度条速度倍率，全局收益乘它 */
  speedMult: BigNumber
}

/** 由全部法门等级推导产出；outputAdd 是灵根那一类加法加成（0.2 表示 +20%） */
export function productionOf(
  levels: Record<string, number>,
  defs: UpgradeDef[],
  outputAdd = 0,
): Production {
  let autoBase = 0
  let powerLog = 0
  let autoMultLog = 0
  let gatherLog = 0
  let speedLog = 0
  for (const def of defs) {
    const lv = levels[def.id] ?? 0
    if (!lv) continue
    if (def.kind === 'auto-base') autoBase += def.power * lv
    else if (def.kind === 'auto-power') powerLog += lv * Math.log10(def.power)
    else if (def.kind === 'auto-mult') autoMultLog += lv * Math.log10(def.power)
    else if (def.kind === 'gather-mult') gatherLog += lv * Math.log10(def.power)
    else speedLog += lv * Math.log10(def.power)
  }
  const perSecond =
    autoBase > 0
      ? new BigNumber(autoBase, 0)
          .mul(BigNumber.fromLog10(powerLog))
          .mul(BigNumber.fromLog10(autoMultLog))
          .mulNumber(1 + outputAdd)
      : BigNumber.zero()
  return {
    perSecond,
    gatherMult: BigNumber.fromLog10(gatherLog),
    speedMult: BigNumber.fromLog10(speedLog),
  }
}
