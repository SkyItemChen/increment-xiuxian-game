import { BigNumber } from './BigNumber'
import {
  JIEDAN_FIRST_MULT,
  JIEDAN_GROWTH_FLOOR,
  JIEDAN_GROWTH_PER_MARK,
  JIEDAN_LAYER_CAP,
  JIEDAN_RETURN_GROWTH,
  JIEDAN_RITUAL_DAN,
  JIEDAN_RITUAL_FLOOR,
  JIEDAN_RITUAL_PER_MARK,
  JIEDAN_RITUAL_QI,
  JIEDAN_RITUAL_RAMP,
  JINDAN_MILESTONES,
  JINDAN_TREE,
  JINDAN_TREE_MAX,
  JINDAN_TREE_PER_LAYER,
  PILL_ANCHOR_SECONDS,
  PILL_CONVERT_BASE,
  PILL_LINES,
  PILL_PRICE_EXP,
  POINT_PASS_UNLOCK_QI,
  type PillLineDef,
} from './词条与属性'

/**
 * 丹炉链的算法：灵气流量折成丹、丹买三条线、结丹换回溯。
 * 词条本身（名字、每级效果、涨幅、造价比例）都在 [词条与属性.ts](./词条与属性.ts)，改数值去那边改。
 *
 * 这个模块**不碰 state**，一律收等级表和流量，所以 `sim/` 能直接 import 它核对价格，
 * 不必在模拟里留第二份价目表。
 */

/** 定标档的产量（log10 丹/秒）：灵气/秒 1e24 那一档构筑 × 转化率，整条链的绝对量只锚在这里 */
const CAL_RATE_LOG10 = Math.log10(1e24 * PILL_CONVERT_BASE)

/** 灵气/秒（log10）折成"转化后的产量"log10 —— 丹房不在这里，它走灵气那条加法轴 */
export function pillFlowLog10(spiritLog10: number): number {
  return spiritLog10 + Math.log10(PILL_CONVERT_BASE)
}

/** 结丹线看的那条乘法线：词条里 kind 为 dan-mul 的只有丹炉，所以别处不再写死 'danLu' */
export const FURNACE_ID = PILL_LINES.find((d) => d.kind === 'dan-mul')?.id ?? 'danLu'

/**
 * 实际出丹速率 = 灵气/秒 × 转化 × 火候的加法 × 炉子的乘法。
 * 火候和丹房都是 `1 + 每级 × 级数`，只有炉子按级倍率——反哺做成乘法时墙直接塌（`sim/jindan-anchor.mjs` 末段）。
 */
export function pillRate(spiritPerSecond: BigNumber, levels: Record<string, number>): BigNumber {
  let convAdd = 0
  let furnaceLog = 0
  for (const def of PILL_LINES) {
    const lv = levels[def.id] ?? 0
    if (!lv) continue
    if (def.kind === 'conv-add') convAdd += def.power * lv
    else if (def.kind === 'dan-mul') furnaceLog += lv * Math.log10(def.power)
  }
  return spiritPerSecond
    .mulNumber(PILL_CONVERT_BASE * (1 + convAdd))
    .mul(BigNumber.fromLog10(furnaceLog))
}

/** 丹房折给灵气那条加法轴的额度（和道基、淬炼共用同一条轴） */
export function pillQiAdd(levels: Record<string, number>): number {
  let add = 0
  for (const def of PILL_LINES) {
    if (def.kind !== 'qi-add') continue
    add += def.power * (levels[def.id] ?? 0)
  }
  return add
}

/**
 * 结丹 n 层给的回溯倍率：首层 ×2，之后每层 ×1.25。
 * 它乘在整份灵气产出上，所以第 k 世（已结 k 层）的时长大约被它除掉——乘法轴才追得上 1e100。
 */
export function jindanReturnMult(n: number): number {
  const layer = Math.min(JIEDAN_LAYER_CAP, Math.max(0, Math.floor(n)))
  return layer === 0 ? 1 : JIEDAN_FIRST_MULT * JIEDAN_RETURN_GROWTH ** (layer - 1)
}

/* ------------------------------------------------------------ 结丹成本 */

/**
 * 结丹成本 = 1e30 × Π(每层涨幅)，每层涨幅由**丹纹总等级**决定（0.18 改）。
 *
 * 老口径是 `1e30 × 1.15^(层−1) × 补差C`：常数涨幅 1.15 + 一个按"参考点法"算的补差倍率。
 * 那套的问题在于补差 σ=1 把丹纹收益整份抵掉——点与不点总时长只差 10%，丹纹等于没有。
 * 现在把丹纹直接接到"每层涨幅"上：0 级 = 1.25（正好抵掉回溯，每层耗时恒定），
 * 42 级压到封底 1.00（门槛不再涨）。层数永远推得动这条原则没变，变的是"推多快归丹纹管"。
 */

/** 结丹成本的第一层门槛（log10）：沿用金丹那道 1e30，与境界门槛是同一个数，不另立新常数 */
export const JIEDAN_COST_BASE_LOG10 = Math.log10(POINT_PASS_UNLOCK_QI)

/** 丹纹总等级 → 这一层的门槛涨幅。0 级 ×1.25，42 级压到封底 ×1.00 */
export function jindanGrowthAt(totalLevels: number): number {
  const t = Math.max(0, Math.floor(Number.isFinite(totalLevels) ? totalLevels : 0))
  return Math.max(JIEDAN_GROWTH_FLOOR, JIEDAN_RETURN_GROWTH - JIEDAN_GROWTH_PER_MARK * t)
}

/**
 * 结到第 layer 层时手上的丹纹点数（每层 1 点，里程碑再添几笔）。
 * 与 `state.ts` 的 `jindanTreeEarned()` 是同一条账，只是那边读运行时、这边读层数——
 * 门槛要能只拿层数算出来，所以不能去读玩家真实花掉的点数。
 */
export function jindanMarksAt(layer: number): number {
  const n = Math.max(1, Math.floor(layer))
  let marks = n * JINDAN_TREE_PER_LAYER
  for (const ms of JINDAN_MILESTONES) if (n >= ms.layer) marks += ms.marks ?? 0
  return marks
}

/** 四枝能点到的最多总级数（4 × 22 = 88） */
const MAX_TOTAL_LEVEL = JINDAN_TREE.length * JINDAN_TREE_MAX

/**
 * 给定点数，按"每级价 n 点、只买当下最便宜的那枝"能点到多少总级。
 * 价格是凸的，所以这条贪心就是"同样点数买到最多总级"的唯一解——
 * 丹纹的策略价值有一半长在这里：想压涨幅，就得把点补在最短的那枝上。
 */
function greedyTotalLevel(points: number): number {
  const lv = JINDAN_TREE.map(() => 0)
  let rest = Math.max(0, Math.floor(points))
  for (;;) {
    let best = -1
    for (let i = 0; i < lv.length; i++) {
      if (lv[i] >= JINDAN_TREE_MAX) continue
      if (best < 0 || lv[i] < lv[best]) best = i
    }
    if (best < 0) break
    const price = lv[best] + 1
    if (rest < price) break
    rest -= price
    lv[best] += 1
  }
  return lv.reduce((a, b) => a + b, 0)
}

/** 门槛曲线要用到的层数上限（多留两层给"再下一层"的展示） */
const LAYER_LIMIT = JIEDAN_LAYER_CAP + 2

/**
 * 预计算：第 i 层结完时按贪心能到的总级，以及它的前缀和。
 * 门槛只依赖"层数 + 当前总级"两个现存字段，所以能在这里一次算干净，
 * 运行时是 O(1)，既不新增存档字段，也不留历史依赖。
 */
const GREEDY_TOTAL: number[] = new Array(LAYER_LIMIT + 1).fill(0)
const PREFIX_LOG: number[] = new Array(LAYER_LIMIT + 1).fill(0)
{
  for (let i = 1; i <= LAYER_LIMIT; i++) {
    GREEDY_TOTAL[i] = greedyTotalLevel(jindanMarksAt(i))
    PREFIX_LOG[i] = PREFIX_LOG[i - 1] + Math.log10(jindanGrowthAt(GREEDY_TOTAL[i]))
  }
}

/** SPLIT[L] = 第一个"贪心总级超过 L"的层号；超过之后各层一律按 L 的涨幅算 */
const SPLIT: number[] = new Array(MAX_TOTAL_LEVEL + 1).fill(LAYER_LIMIT)
{
  let i = 1
  for (let L = 0; L <= MAX_TOTAL_LEVEL; L++) {
    while (i <= LAYER_LIMIT && GREEDY_TOTAL[i] <= L) i++
    SPLIT[L] = i
  }
}

const clampTotal = (n: number) => Math.min(MAX_TOTAL_LEVEL, Math.max(0, Math.floor(Number.isFinite(n) ? n : 0)))

/**
 * 老阶梯（0.18 那套）：第 layer 层 = 1e30 × Π(已走过各层的涨幅)。
 * 已走过的层按"当时贪心能到的总级"记账（玩家点得比贪心少时一律按他的现等级算，
 * 所以攒着不点是全程按浅丹纹付账，不会因为囤点而占便宜）。
 *
 * 0.19 之后它只剩"早盘保底"这一个职责：灵气/秒不到 1e28 时，产量项还压不过 1e30，
 * 前二十层的手感与 0.18 完全一致；过了那条线就交给 `jindanRitualSeconds` 定的秒数。
 */
export function jindanLadderLog10(layer: number, totalLevels: number): number {
  const n = Math.min(JIEDAN_LAYER_CAP, Math.max(1, Math.floor(layer)))
  if (n <= 1) return JIEDAN_COST_BASE_LOG10
  const L = clampTotal(totalLevels)
  const last = n - 1
  const cut = Math.min(last, SPLIT[L] - 1)
  return JIEDAN_COST_BASE_LOG10 + PREFIX_LOG[cut] + (last - cut) * Math.log10(jindanGrowthAt(L))
}

/** 丹纹对仪式秒数的折扣：每级 −1%，封底 ×0.5 */
function ritualFactor(totalLevels: number): number {
  return Math.max(JIEDAN_RITUAL_FLOOR, 1 - JIEDAN_RITUAL_PER_MARK * clampTotal(totalLevels))
}

/** 结丹仪式秒数的**增幅**部分：第 1 层 1，每层 ×(1 + 0.002) */
function ritualRamp(layer: number): number {
  const n = Math.min(JIEDAN_LAYER_CAP, Math.max(1, Math.floor(layer)))
  return Math.pow(1 + JIEDAN_RITUAL_RAMP, n - 1)
}

/** 第 layer 层要攒多少秒的灵气产量。门槛 = 灵气/秒 × 这个数 */
export function jindanRitualSeconds(layer: number, totalLevels: number): number {
  return JIEDAN_RITUAL_QI * ritualRamp(layer) * ritualFactor(totalLevels)
}

/** 第 layer 层要攒多少秒的丹产量 */
export function jindanDanRitualSeconds(layer: number, totalLevels: number): number {
  return JIEDAN_RITUAL_DAN * ritualRamp(layer) * ritualFactor(totalLevels)
}

/**
 * 第 layer 层结丹要的灵气（log10）= max(老阶梯, 历史最高灵气/秒 × 仪式秒数)。
 *
 * `flowLog10` 传 -Infinity（或干脆不传）时只剩老阶梯——`sim/` 里那几份只关心阶梯的脚本
 * 因此不用改签名。真正跑游戏时由 `state.ts` 把 `state.pillAnchor` 传进来。
 */
export function jindanCostLog10(
  layer: number,
  totalLevels: number,
  flowLog10: number = -Infinity,
): number {
  const ladder = jindanLadderLog10(layer, totalLevels)
  if (!Number.isFinite(flowLog10)) return ladder
  const ritual = flowLog10 + Math.log10(jindanRitualSeconds(layer, totalLevels))
  return Math.max(ladder, ritual)
}

/** 第 layer 层结丹要的灵气 */
export function jindanCost(layer: number, totalLevels: number, flowLog10: number = -Infinity): BigNumber {
  return BigNumber.fromLog10(jindanCostLog10(layer, totalLevels, flowLog10))
}

/**
 * 第 layer 层结丹要焚的丹（log10）= 丹/秒 × 丹仪式秒数。
 *
 * 这里读的是丹自己的产量，不是灵气产量：丹炉（×2/级）越多攒得越快，
 * 所以这条闸不会变成"炉子越厚越难结"的死墙。丹/秒为 0（没起炉）时返回 -Infinity，
 * 上层按"没有丹闸"处理——那种情况下丹炉等级那道门本来就没过。
 */
export function jindanDanCostLog10(
  layer: number,
  totalLevels: number,
  danRateLog10: number,
): number {
  if (!Number.isFinite(danRateLog10)) return -Infinity
  return danRateLog10 + Math.log10(jindanDanRitualSeconds(layer, totalLevels))
}

/** 下一层比这一层贵多少倍：就是当前丹纹深度对应的涨幅 */
export function jindanCostGrowth(totalLevels: number): number {
  return jindanGrowthAt(totalLevels)
}

/**
 * 第 level+1 级的单价（log10 丹）= 平方根(定标产量 × 当前产量) × 本行秒数 × 涨价^level。
 * 定稿那条 0.5 次方缩放就藏在平方根里：取 0 是绝对丹数（构筑厚了就一格秒过），
 * 取 1 等于让流量自己给自己定价（构筑再厚也只是原地）。
 */
export function pillCostLog10(def: PillLineDef, level: number, flowLog10: number): number {
  const scale = PILL_PRICE_EXP * flowLog10 + (1 - PILL_PRICE_EXP) * CAL_RATE_LOG10
  return Math.log10(PILL_ANCHOR_SECONDS * def.ratio) + scale + level * Math.log10(def.growth)
}

export function pillCost(def: PillLineDef, level: number, flowLog10: number): BigNumber {
  return BigNumber.fromLog10(pillCostLog10(def, level, flowLog10))
}

/** 等比数列前 n 项和（log10）。g^n 会溢出 double，所以全程留在 log 空间 */
function geoSumLog10(g: number, n: number): number {
  const x = n * Math.log10(g)
  if (x > 0.5) return x + Math.log10(1 - Math.pow(10, -x)) - Math.log10(g - 1)
  return Math.log10((Math.pow(g, n) - 1) / (g - 1))
}

/** 从 level 起连买 count 级的总价（log10 丹） */
export function pillBulkCostLog10(def: PillLineDef, level: number, count: number, flowLog10: number): number {
  if (count <= 0) return -Infinity
  return pillCostLog10(def, level, flowLog10) + geoSumLog10(def.growth, count)
}

/** 单次 MAX 的天花板：这三条墙的涨价远快过收益，一辈子摸不到零头，纯粹防改过内存的存档 */
const PILL_LEVEL_CEILING = 1e5

/** 手里有 haveLog10 这么多丹，从 level 起最多还买得起几级 */
export function pillMaxLevels(def: PillLineDef, level: number, haveLog10: number, flowLog10: number): number {
  if (!Number.isFinite(haveLog10)) return 0
  const headroom = haveLog10 - pillCostLog10(def, level, flowLog10)
  if (headroom < 0) return 0
  const y = headroom + Math.log10(def.growth - 1)
  // log10(1 + 10^y)：y 大时直接是 y，y 负得深时才走 10^y 那条加法
  const log = y > 0 ? y + Math.log10(1 + Math.pow(10, -y)) : Math.log10(1 + Math.pow(10, y))
  return Math.min(Math.floor(log / Math.log10(def.growth)), PILL_LEVEL_CEILING - level)
}

/**
 * 下一级还要等多久（秒）：把"攒到那一格的价"这段路按当前丹/秒折成时间。
 * 买得起返回 0；出丹停了返回 ∞——面板上这两种写法不一样（一个是"现在就买"，一个是"炉子熄了"）。
 */
export function pillWaitSeconds(
  def: PillLineDef,
  level: number,
  haveLog10: number,
  rateLog10: number,
  flowLog10: number,
): number {
  const price = pillCostLog10(def, level, flowLog10)
  if (haveLog10 >= price) return 0
  const gap = price - rateLog10
  if (gap > 300) return Infinity
  // 1 − 10^(have−price)：贴近 0 时靠 -expm1，否则两段浮点误差会把等待算成 0 秒
  const near = Math.max(haveLog10 - price, -20)
  const frac = near === -Infinity ? 1 : -Math.expm1(near * Math.LN10)
  return Math.pow(10, gap) * frac
}
