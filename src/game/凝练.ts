import { BigNumber } from './BigNumber'
import { nextRoll } from './explore'
import { pillQiAdd } from './金丹丹炉'
import {
  AUTO_BUY_MIN_INTERVAL,
  BUST_FLOOR,
  PULL_BASE_SECONDS,
  PULL_GROWTH,
  SPIRITS,
  type PillModeDef,
  type SpiritDef,
  type SpiritKind,
} from './词条与属性'

/**
 * 凝练 —— 一炉一炉炼丹、炸炉折成废渣、废渣转一道丹道精神。
 * 词条本身（三档火候的数值、七道精神的 power 与权重）都在 [词条与属性.ts](./词条与属性.ts)。
 *
 * 这个模块**不碰 state**，一律收等级表和流量，所以 `sim/` 能直接 import 它核对，
 * 不必在模拟里留第二份表（和 `金丹丹炉.ts` 同一条规矩）。
 *
 * 三条设计约束，改数值前先读一遍：
 * 1. **炸炉不是纯惩罚，是换币**。炸了的那一炉按「这一炉该出的丹」折成废渣，
 *    三档因此只是三种「丹换废渣」的汇率（见 PILL_MODES 上面那段），不存在一档压死另两档。
 * 2. **七道精神全从零起加，且只借现有的轴**。通灵叠进丹房那条灵气加法轴、养气叠进道基那条，
 *    于是平方根定价与一世时长公式一并继承了现成的自惩罚，不用再验一遍墙会不会塌。
 * 3. **敏手是唯一改了"节奏"的**，它除的是自动购买的时间轴，除到 AUTO_BUY_MIN_INTERVAL 就停；
 *    定息是唯一的纯乘数 buff，所以它带 cap——按秒折点那条进项本来被对数压平，
 *    乘上去只可能把那条坡抬高一截，不可能利滚利。
 */

/** 七道精神的等级表（缺省当 0 读） */
export type SpiritLevels = Record<string, number>

/** 加法类精神共用一条式子：每级 power × 级数。守一/敏手/定息是乘法类，不走这里 */
export function spiritAdd(levels: SpiritLevels, kind: SpiritKind): number {
  let add = 0
  for (const def of SPIRITS) {
    if (def.kind !== kind) continue
    add += def.power * (levels[def.id] ?? 0)
  }
  return add
}

/** 级数已经封顶的那几条：把超出 cap 的部分读回来，改表也不会让老存档溢出 */
function capped(levels: SpiritLevels, def: SpiritDef): number {
  const lv = levels[def.id] ?? 0
  return def.cap === undefined ? lv : Math.min(lv, def.cap)
}

/** 精神折出的乘法倍率（敏手、定息这两条），没有级数时是 1 */
export function spiritMul(levels: SpiritLevels, kind: SpiritKind): number {
  let mult = 1
  for (const def of SPIRITS) {
    if (def.kind !== kind) continue
    mult *= Math.pow(def.power, capped(levels, def))
  }
  return mult
}

/** 武火：这一炉该出的丹乘这个数 */
export function danYieldMult(levels: SpiritLevels): number {
  return 1 + spiritAdd(levels, 'dan-add')
}

/**
 * 炸炉概率：档位定的底子 × 守一每级 ×0.8，地板 BUST_FLOOR。
 * 留地板是玩法决定：炸炉归零等于废渣归零，转盘这条线就不能被一条精神整个关掉。
 */
export function bustChance(mode: PillModeDef, levels: SpiritLevels): number {
  let mult = 1
  for (const def of SPIRITS) {
    if (def.kind !== 'bust-cut') continue
    mult *= Math.pow(1 - def.power, capped(levels, def))
  }
  return Math.max(BUST_FLOOR, mode.bust * mult)
}

/** 回甘：炸一炉赔的废渣 = 该出的丹 × 档位的 dregMult × 这个数 */
export function dregYieldMult(mode: PillModeDef, levels: SpiritLevels): number {
  return mode.dregMult * (1 + spiritAdd(levels, 'dreg-add'))
}

/**
 * 灵气那条返哺加法轴的总量：丹房 + 通灵共用一个加数。
 * 它们乘在**全部灵气产出**上，所以被平方根定价一起吃回去（丹房那条自惩罚同样管着通灵）。
 */
export function qiAxisAdd(pillLevels: Record<string, number>, spiritLevels: SpiritLevels): number {
  return pillQiAdd(pillLevels) + spiritAdd(spiritLevels, 'qi-add')
}

/** 养气折进道基那条全局加法轴的额度 */
export function spiritEnergyAdd(levels: SpiritLevels): number {
  return spiritAdd(levels, 'energy-add')
}

/** 敏手：自动购买的时间轴除到这个数，再快也只到地板 */
export function autoBuyInterval(levels: SpiritLevels, base: number): number {
  return Math.max(AUTO_BUY_MIN_INTERVAL, base / spiritMul(levels, 'auto-cut'))
}

/** 定息：按秒折给玩家的筑基点比例乘这个数 */
export function pointPassMult(levels: SpiritLevels): number {
  return spiritMul(levels, 'pass-add')
}

/** 抽一次要多少废渣（log10）：第 count+1 次 = 定标秒数 × 抽卡流量 × 涨价^count */
export function pullCostLog10(count: number, flowLog10: number): number {
  return Math.log10(PULL_BASE_SECONDS) + flowLog10 + count * Math.log10(PULL_GROWTH)
}

export function pullCost(count: number, flowLog10: number): BigNumber {
  return BigNumber.fromLog10(pullCostLog10(count, flowLog10))
}

/** 连抽 n 次的总价（log10）。和丹炉那条一样全程留在 log 空间 */
export function pullBulkCostLog10(count: number, start: number, flowLog10: number): number {
  if (count <= 0) return -Infinity
  return pullCostLog10(start, flowLog10) + geoSumLog10(PULL_GROWTH, count)
}

function geoSumLog10(g: number, n: number): number {
  const x = n * Math.log10(g)
  if (x > 0.5) return x + Math.log10(1 - Math.pow(10, -x)) - Math.log10(g - 1)
  return Math.log10((Math.pow(g, n) - 1) / (g - 1))
}

/** 手上这么多废渣，从第 start 次起最多还抽得起几次 */
export function pullMaxCount(start: number, haveLog10: number, flowLog10: number): number {
  if (!Number.isFinite(haveLog10)) return 0
  const headroom = haveLog10 - pullCostLog10(start, flowLog10)
  if (headroom < 0) return 0
  const y = headroom + Math.log10(PULL_GROWTH - 1)
  const log = y > 0 ? y + Math.log10(1 + Math.pow(10, -y)) : Math.log10(1 + Math.pow(10, y))
  return Math.max(0, Math.floor(log / Math.log10(PULL_GROWTH)))
}

/** 一转的结果：抽到哪道、叠到第几级，以及该写回种子的下一个值 */
export interface SpiritRoll {
  def: SpiritDef
  /** 抽完之后这道精神是几级 */
  level: number
  /** 抽满 cap 的那道又被抽到：等级不动，废渣照样花掉（转盘没有"退货"） */
  maxed: boolean
  seed: number
}

/**
 * 掷一转。权重写在词条表里（和为 100，但这里按实际总和归一，改表不必同步常数）。
 * 走 state.seed 那条确定性序列：预览与结算共用同一串，取消再点开不会重抽（和探索同一口径）。
 */
export function rollSpirit(seed: number, levels: SpiritLevels): SpiritRoll {
  const total = SPIRITS.reduce((a, d) => a + d.weight, 0)
  let roll: number
  ;[roll, seed] = nextRoll(seed)
  let acc = 0
  let hit = SPIRITS[0]!
  for (const def of SPIRITS) {
    acc += def.weight / total
    if (roll < acc) {
      hit = def
      break
    }
  }
  const now = levels[hit.id] ?? 0
  const maxed = hit.cap !== undefined && now >= hit.cap
  return { def: hit, level: maxed ? now : now + 1, maxed, seed }
}
