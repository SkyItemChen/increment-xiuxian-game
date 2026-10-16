import {
  RARITY_INSIGHT,
  RARITY_ORDER,
  TREASURES,
  findExplore,
  findTreasure,
  type TreasureDef,
  type TreasureRarity,
} from './词条与属性'

/**
 * 探索：把筑基点一把押光，换几件法宝回来。
 *
 * 三条规矩定死了这层的形状（2026-10-15 改版第 3 条；第 2 条 2026-10-16 又改过一次）：
 *  1. 押上全部筑基点——点数不是零花钱，是一次探索的本金；
 *  2. 探索完只散去**修行那一层**：练气的法门与手上的灵气清零，筑基的根骨树保留（法宝也留）——
 *     所以这一铲是"换个活法"，不是把两层的家当一起推翻；
 *  3. **押多少点都不改抽奖数量，也不改出土概率**。铲数只看铁铲，概率只看眼力；
 *     押上去的点数只折成见识，见识再去买这两栏。想要好东西就得先把鉴宝台抬起来。
 *
 * 抽到已圆满的法宝另外再攒**见识**（探索经验）。见识买鉴宝台那四条永久强化，
 * 它们连探索本身都不清——这一层的进度只往上走。
 *
 * 抽取全程走 state.seed 这条确定性序列：预览算出来的结果和确认后落账的完全是同一批，
 * 玩家取消再点开也不会重抽。也因此自动化能替玩家跑这套决策。
 */

/** xorshift32：整条探索线只有这一个随机源，存档里留一个整数就能重放 */
export function nextRoll(seed: number): [number, number] {
  let x = (seed | 0) || 0x9e3779b9
  x ^= (x << 13) >>> 0
  x ^= x >>> 17
  x ^= (x << 5) >>> 0
  x >>>= 0
  return [x / 0x100000000, x]
}

/** 开局种子：只用一次 Math.random，之后就再没有不可复现的数 */
export function freshSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ 0x5bf03635) >>> 0
}

/**
 * 灵品/仙品的权重。凡品恒为 1 打底，**两档都按眼力等级一级一级往上爬**：
 *  眼力 Lv.0 只出凡品，Lv.1–3 灵品渐多，Lv.4 起仙品才可能出土
 * 权重封顶（灵 6 / 仙 3）是玩法决定的：不设顶，鉴宝台买满就每一铲都是仙品，探索层直接结束。
 *
 * 造化玉碟叠出来的 `luck` 仍按两档不对称吃：灵品一层、仙品两层。
 * 同倍率乘上去只压得动凡品占比，仙品被灵品压着，玩家会觉得这条词条是空的。
 */
const LING_PER_LEVEL = 0.35
const LING_CAP = 6
/** 眼力到第 4 级（Lv.3 之上）才开始出仙品 */
export const XIAN_START_YANLI = 3
const XIAN_PER_LEVEL = 0.3
const XIAN_CAP = 3

/** 鉴宝台买出来的四条修正量，缺省就是"一条都没参悟" */
export interface ExploreMods {
  /** 眼力等级：灵品/仙品的出土权重按它爬，同时是出土机会的乘数 */
  yanLi: number
  /** 淬炼：全部灵气产出的加法额度（0.05 表示 +5%），不再缩放法宝的 power */
  energyAdd: number
  /** 铁铲等级：首铲之外还能多挖几铲 */
  tieChan: number
  /** 收资：折回的见识按百分比变多 */
  insightGain: number
}

export const NO_EXPLORE_MODS: ExploreMods = { yanLi: 0, energyAdd: 0, tieChan: 0, insightGain: 0 }

/** 造化玉碟 × 眼力 叠出来的机会倍率 */
export function luckOf(treasureLevels: Record<string, number>, mods: ExploreMods): number {
  const die = findTreasure('zaoHuaYuDie')
  const yanLiDef = findExplore('yanLi')
  if (!die || !yanLiDef) return 1
  return (1 + die.power * (treasureLevels[die.id] ?? 0)) * (1 + yanLiDef.power * mods.yanLi)
}

export function rarityWeights(yanLi: number, luck: number): Record<TreasureRarity, number> {
  const lv = Math.max(yanLi, 0)
  return {
    fan: 1,
    ling: Math.min(LING_PER_LEVEL * lv, LING_CAP) * luck,
    xian: lv <= XIAN_START_YANLI
      ? 0
      : Math.min(XIAN_PER_LEVEL * (lv - XIAN_START_YANLI), XIAN_CAP) * luck * luck,
  }
}

/** 界面用：各品质的出土概率（0..1） */
export function rarityOdds(yanLi: number, luck: number): Record<TreasureRarity, number> {
  const w = rarityWeights(yanLi, luck)
  const total = w.fan + w.ling + w.xian
  return { fan: w.fan / total, ling: w.ling / total, xian: w.xian / total }
}

/** 一铲之下首铲必有，之后每一级铁铲多一铲 */
export function drawCount(mods: ExploreMods): number {
  return 1 + Math.max(mods.tieChan, 0)
}

/** 押上去的筑基点折成见识：每 10 点换 1 见识，押得薄就什么都换不来 */
export const STAKE_PER_INSIGHT = 10

export function insightOfStake(stake: number, mods: ExploreMods): number {
  return Math.round((Math.max(stake, 0) / STAKE_PER_INSIGHT) * (1 + mods.insightGain))
}

/** 一铲折回的见识 = 底数 ×(1 + 收资)，底数见 RARITY_INSIGHT */
export function insightOf(rarity: TreasureRarity, mods: ExploreMods): number {
  return Math.round(RARITY_INSIGHT[rarity] * (1 + mods.insightGain))
}

/**
 * 探索的门槛：累计攒够这么多筑基点才开启遗迹。
 * 看的是"累计攒到"而不是"手上还剩"——点数一押就清零，用余额当门槛会把已经解锁的人再锁回去。
 * 100 这点是 sim/zhuji-hours.mjs 量的：按摸到门槛就破境的最速流程，累计 100 点落在 2.6 小时上下，
 * 正是把玩家从根骨交给法宝的位置；再往后一世只剩几十秒，破境本身已经没内容了。
 */
export const EXPLORE_UNLOCK_POINTS = 100

/** 鉴宝台第 lv+1 层的开销：1 点见识起步，每层 ×1.6 */
export function exploreCost(lv: number): number {
  return Math.max(1, Math.ceil(Math.pow(1.6, lv)))
}

export interface TreasureDraw {
  def: TreasureDef
  rarity: TreasureRarity
  /** 到手后这件是几层 */
  level: number
}

/** 那一铲挖到已圆满的法宝，改攒来的见识 */
export interface TreasureInsight {
  rarity: TreasureRarity
  insight: number
}

export interface ExploreOutcome {
  draws: TreasureDraw[]
  insights: TreasureInsight[]
  /** 结算后该写回的法宝层数表（draws 之外的件保持原样） */
  levels: Record<string, number>
  /** 本次押上去的筑基点 */
  stake: number
  /** 满层法宝这一铲攒下的见识合计 */
  insight: number
  /** 押注本身折算的见识：点数的去处从这里走，不再买铲数也不买概率 */
  stakeInsight: number
  /** 各品质出土概率，弹窗里明明白白摆出来 */
  odds: Record<TreasureRarity, number>
  /** 抽完后该推进到的种子；确认落账时照它写回 */
  seed: number
}

/**
 * 按 (points, seed, 已有法宝, 鉴宝台等级) 算出这一铲挖到什么。纯函数：预览与结算共用，
 * 所以"看一眼再取消"不会改命。押上去的点数只决定 `stakeInsight`，铲数与概率都来自鉴宝台。
 */
export function rollExplore(
  points: number,
  seed: number,
  treasureLevels: Record<string, number>,
  mods: ExploreMods = NO_EXPLORE_MODS,
): ExploreOutcome {
  const stake = Math.floor(points)
  const luck = luckOf(treasureLevels, mods)
  const odds = rarityOdds(mods.yanLi, luck)
  const weights = rarityWeights(mods.yanLi, luck)
  const total = weights.fan + weights.ling + weights.xian
  const owned = { ...treasureLevels }
  const byRarity: Record<TreasureRarity, TreasureDef[]> = { fan: [], ling: [], xian: [] }
  for (const def of TREASURES) byRarity[def.rarity].push(def)

  let next = seed
  const draws: TreasureDraw[] = []
  const insights: TreasureInsight[] = []
  let insight = 0

  for (let i = 0; i < drawCount(mods); i++) {
    let roll: number
    ;[roll, next] = nextRoll(next)
    let acc = 0
    let hit: TreasureRarity = 'fan'
    for (const rarity of RARITY_ORDER) {
      acc += weights[rarity] / total
      if (roll < acc) {
        hit = rarity
        break
      }
    }
    // 只挖还没圆满的，挖到过手的自然不重复
    const pool = byRarity[hit].filter((def) => (owned[def.id] ?? 0) < def.cap)
    if (pool.length === 0) {
      // 整档都收集齐了：这一铲不空手，改攒见识
      const gained = insightOf(hit, mods)
      insight += gained
      insights.push({ rarity: hit, insight: gained })
      continue
    }
    let pick: number
    ;[pick, next] = nextRoll(next)
    const def = pool[Math.min(pool.length - 1, Math.floor(pick * pool.length))]!
    owned[def.id] = (owned[def.id] ?? 0) + 1
    draws.push({ def, rarity: hit, level: owned[def.id] })
  }

  return { draws, insights, levels: owned, stake, insight, stakeInsight: insightOfStake(stake, mods), odds, seed: next }
}
