import { BigNumber } from './BigNumber'
import {
  JIEDAN_RETURN_PER,
  PILL_ANCHOR_SECONDS,
  PILL_CONVERT_BASE,
  PILL_LINES,
  PILL_PRICE_EXP,
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
 * 结丹 n 层给的回溯倍率。它和道基、淬炼共用同一条**全部灵气产出**的加法轴——
 * 挂在这条轴上才拿得到"一世时长严格除以 (1 + 层数)"那条性质，因为它乘在整份产出上。
 */
export function jindanReturnMult(n: number): number {
  return 1 + JIEDAN_RETURN_PER * Math.max(0, Math.floor(n))
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
