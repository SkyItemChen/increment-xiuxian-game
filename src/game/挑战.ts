import {
  ACHIEVEMENTS,
  CHALLENGES,
  JINDAN_MILESTONES,
  JINDAN_TREE,
  SPIRITS,
  addBonus,
  noBonus,
  type AchievementDef,
  type AchievementMetric,
  type Bonus,
  type ChallengeDef,
  type ChallengeNeed,
  type MilestoneDef,
} from './词条与属性'
import type { SpiritLevels } from './凝练'

/**
 * 挑战、结丹里程碑、加属性成就，再加丹纹四枝——合起来的一本账。
 * 表本身在 [词条与属性.ts](./词条与属性.ts)，这个模块**不碰 state**，
 * 只收一笔笔累计的数（`BonusCounters`）再把达成与否、白给多少一并算出来，
 * 所以 `sim/challenge-check.mjs` 能直接 import 它核对落点（和 `金丹丹炉.ts`、`凝练.ts` 同一条规矩）。
 *
 * 三条设计约束：
 * 1. **门槛只读只涨不跌的那几笔账**——三条线的等级、累计抽数、七道精神的等级、已结层数、累计探索/见识/灵气。
 *    散功（结丹、押探索）清的是手上的灵气与法门修为，这些账一笔都不清，所以达成之后不会又锁回去。
 * 2. **好处一律落在链上现成的五条轴**（见词条里 `Bonus` 那段），不新起第六条算法轴。
 * 3. **零存档字段**：三张表的好处都是从别的字段推出来的；只有丹纹等级要存，因为那是玩家亲手点的选择。
 */

/** 判定要读的那几笔累计。灵气那一笔动不动上百位，折成 log10 交进来就够比较了 */
export interface BonusCounters {
  pillLevels: Record<string, number>
  spirits: SpiritLevels
  pulls: number
  jindan: number
  insightEarned: number
  explores: number
  /** 累计筑基点 */
  pointsEarned: number
  /** 根骨五条合计等级 */
  rootLevels: number
  /** 鉴宝台四条合计等级 */
  benchLevels: number
  /** 已收到的法宝件数（按件算，不按层算） */
  treasures: number
  /** 累计灵气到过多少（log10） */
  qiLog10: number
  /** 丹纹四枝的等级。丹纹是玩家花点数点出来的，不在这三张表的累计账里 */
  jindanTree?: Record<string, number>
}

/** 成就看的那笔账如今是多少；qi 那一笔走 log10，由 `achievementUnlocked` 自己分派 */
export function metricValue(metric: AchievementMetric | undefined, c: BonusCounters): number {
  if (metric === 'insight') return c.insightEarned
  if (metric === 'layers') return c.jindan
  if (metric === 'turns') return c.pulls
  if (metric === 'explores') return c.explores
  if (metric === 'root') return c.rootLevels
  if (metric === 'bench') return c.benchLevels
  if (metric === 'treasures') return c.treasures
  return c.pointsEarned
}

/** 一条成就达成没有。这是唯一的判定口径：成就页那行进度、这里的好处聚合都走它 */
export function achievementUnlocked(def: AchievementDef, c: BonusCounters): boolean {
  if (def.metric === 'qi') return c.qiLog10 >= Math.log10(def.need)
  return metricValue(def.metric, c) >= def.need
}

/** 挑战的刻度：现在到哪、要多少，两头同单位（级 / 次 / 道），界面就照这一对画进度 */
export interface ChallengeMark {
  now: number
  need: number
}

/** 把一条达成条件折成一对可比的数 */
export function challengeMark(need: ChallengeNeed, c: BonusCounters): ChallengeMark {
  if (need.kind === 'pill') return { now: c.pillLevels[need.line] ?? 0, need: need.level }
  if (need.kind === 'pulls') return { now: c.pulls, need: need.count }
  const hit = SPIRITS.filter((d) => (c.spirits[d.id] ?? 0) >= need.each).length
  return { now: hit, need: need.of }
}

export function challengeUnlocked(def: ChallengeDef, c: BonusCounters): boolean {
  const mark = challengeMark(def.need, c)
  return mark.now >= mark.need
}

export function milestoneUnlocked(def: MilestoneDef, c: BonusCounters): boolean {
  return c.jindan >= def.layer
}

/**
 * 三张表 + 丹纹四枝合起来的加成。达成几条就添几笔，没达成的连 0 都不添。
 * 丹纹是玩家亲手点的永久等级，所以它不进 `JINDAN_MILESTONES` 那种按层数推导的表，
 * 而是在这里和另外三张表并进同一本账——产出公式只认 `activeBonus()`，不另开私房倍率。
 */
export function totalBonus(c: BonusCounters): Bonus {
  let sum = noBonus()
  for (const def of CHALLENGES) if (challengeUnlocked(def, c)) sum = addBonus(sum, def.bonus)
  for (const def of JINDAN_MILESTONES) if (milestoneUnlocked(def, c)) sum = addBonus(sum, def.bonus)
  for (const def of ACHIEVEMENTS) if (def.bonus && achievementUnlocked(def, c)) sum = addBonus(sum, def.bonus)
  const tree = c.jindanTree ?? {}
  const treeBonus = noBonus()
  for (const def of JINDAN_TREE) {
    const lv = Math.min(def.cap, Math.max(0, Math.floor(tree[def.id] ?? 0)))
    if (!lv) continue
    if (def.kind === 'dan-add') treeBonus.danAdd = (treeBonus.danAdd ?? 0) + def.power * lv
    else if (def.kind === 'energy-add') treeBonus.energyAdd = (treeBonus.energyAdd ?? 0) + def.power * lv
    else if (def.kind === 'dreg-add') treeBonus.dregMul = (treeBonus.dregMul ?? 1) * (1 + def.power * lv)
  }
  return addBonus(sum, treeBonus)
}

/** 出丹那条加法：白给的几成丹和武火添在同一个加数上 */
export function danBonusAdd(b: Bonus): number {
  return b.danAdd ?? 0
}

/** 灵气返哺那条加法轴上白给的一笔（和丹房、通灵共用同一个加数） */
export function qiBonusAdd(b: Bonus): number {
  return b.qiAdd ?? 0
}

/** 全部产出那条加法轴上白给的一笔（和道基、淬炼、养气共用同一个加数） */
export function energyBonusAdd(b: Bonus): number {
  return b.energyAdd ?? 0
}

/** 炸一炉赔的废渣整体乘这个数 */
export function dregBonusMult(b: Bonus): number {
  return b.dregMul ?? 1
}

/** 按秒折给玩家的筑基点整体乘这个数 */
export function passBonusMult(b: Bonus): number {
  return b.passMul ?? 1
}
