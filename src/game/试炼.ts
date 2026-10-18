import {
  TRIALS,
  TRIAL_GATE_JINDAN,
  addBonus,
  noBonus,
  type Bonus,
  type TrialDef,
} from './词条与属性'

/**
 * 试炼的纯数学层：debuff 怎么折成倍数、位图怎么记账、奖励怎么并进那本总账。
 *
 * 奖励只有两笔，**没有筑基点**（0.22 定稿）：永久乘算加成（`trialBonus`）与道基
 * （`trialDaoJiOf` / `trialDaoJiTotal`）。原来的 `trialPointsOf / trialPointsAt /
 * trialPointLoops` 已经删掉——试炼的准入是结丹 1 层，那时筑基点早已按秒自动进账，
 * 一笔一次性点数只等于"多挂几分钟"，跟散掉一世再爬回来完全不对等。理由见 `TRIALS` 的头注。
 *
 * 这个模块**不碰 state**，`sim/trial-check.mjs` 直接 import 它核对落点——
 * 和 `挑战.ts`、`金丹丹炉.ts`、`元婴.ts` 同一条规矩：判定与数值这一头，界面那一头。
 */

/** 不在试炼里。存档里用 -1 表示，用 0 会与「第一道试炼」撞车 */
export const NO_TRIAL = -1

export function findTrialIndex(id: string): number {
  return TRIALS.findIndex((d) => d.id === id)
}

export function trialAt(index: number): TrialDef | null {
  return index >= 0 && index < TRIALS.length ? TRIALS[index] : null
}

/* ------------------------------------------------------------ 位图记账 */

/**
 * 已完成的试炼用位图存：一位一道，下标就是 `TRIALS` 的位置。
 * 用位图而不是数组，是因为存档是定长数组、每个位置只放一个数；
 * 四道试炼只占一个 number，往后加试炼也不用动存档结构（上限 31 道）。
 */
export function trialCompleted(bitmap: number, index: number): boolean {
  if (index < 0 || index >= TRIALS.length) return false
  return ((bitmap >>> index) & 1) === 1
}

/** 记一道试炼已完成。幂等：重复记不会把别的位弄丢 */
export function markTrialDone(bitmap: number, index: number): number {
  if (index < 0 || index >= TRIALS.length) return bitmap
  return (bitmap | (1 << index)) >>> 0
}

export function trialDoneCount(bitmap: number): number {
  let n = 0
  for (let i = 0; i < TRIALS.length; i++) if (trialCompleted(bitmap, i)) n++
  return n
}

/* ------------------------------------------------------------ 结丹门槛 */

/**
 * 这一道要结到第几层丹才开。表里没写就退回第一档，老档与老调用不会因为少了这个字段而全关。
 * 门槛是**逐条**的，不是全局一个常数——见 `TrialDef.minJindan` 的注释。
 */
export function trialMinJindan(def: TrialDef | null): number {
  if (!def) return TRIAL_GATE_JINDAN
  const n = Math.floor(Number(def.minJindan ?? TRIAL_GATE_JINDAN))
  return Number.isFinite(n) ? Math.max(0, n) : TRIAL_GATE_JINDAN
}

/** 眼下的结丹层数够不够开这一道 */
export function trialJindanOpen(def: TrialDef | null, jindan: number): boolean {
  const have = Number.isFinite(jindan) ? Math.floor(jindan) : 0
  return have >= trialMinJindan(def)
}

/**
 * 整页的解锁门槛 = 四道里最浅的那一条，也应当等于元婴页的门票
 * （`元婴.ts` 的 `YUAN_GATE_JINDAN_LAYER`）。
 * **不要再在运行时里写死 `need = 1`**：那样表里的 `minJindan` 就只是装饰，
 * 四道试炼会永远同进同出，"某道要结到第几层才开"这件事根本落不了地。
 */
export function trialGateJindan(defs: TrialDef[]): number {
  if (defs.length === 0) return TRIAL_GATE_JINDAN
  return defs.reduce((a, d) => Math.min(a, trialMinJindan(d)), Infinity)
}

/** 门槛念法，界面念"需 结丹 3 层"用。层数不比境界名，没有需要兜底的下标 */
export function trialGateName(minJindan: number): string {
  return `结丹 ${Math.max(0, Math.floor(minJindan))} 层`
}


/**
 * 产出乘数。只认 `output` 那一档，其余两种按 1 返回——
 * 挂在 `recompute()` 里，所以灵气与丹一起降，玩家看到的是"每秒变少了"。
 */
export function trialOutputMul(index: number): number {
  const def = trialAt(index)
  if (!def) return 1
  return def.debuff.kind === 'output' ? def.debuff.mul : 1
}

/**
 * 法门单价乘数。挂在报价与购买两处，**首级也一起涨**——
 * 只抬后续涨幅的话，前几级几乎没感觉，而试炼要的是从头到尾都贵。
 */
export function trialPriceMul(index: number): number {
  const def = trialAt(index)
  if (!def) return 1
  return def.debuff.kind === 'price' ? def.debuff.mul : 1
}

/**
 * 吐纳周期乘数。挂在 `gatherSeconds` 上，不碰每笔金额——
 * 所以它压的是"跳得多快"，不是"每跳给多少"，和产出那条降法是两种手感。
 */
export function trialPeriodMul(index: number): number {
  const def = trialAt(index)
  if (!def) return 1
  return def.debuff.kind === 'period' ? def.debuff.mul : 1
}

/**
 * 这道试炼让同一段路慢多少倍。界面只念这一个数，因为倍率换算太绕：
 *   output ×0.25 → 慢 4 倍（每秒只剩四分之一）
 *   price  ×3    → 慢 3 倍（买同样等级要多花三倍灵气）
 *   period ×2    → 慢 2 倍（吐纳格子走一半）
 * 三种都折成"时间倍数"，玩家才比得出哪一道更狠。
 */
export function trialSlowFactor(def: TrialDef): number {
  const d = def.debuff
  if (d.kind === 'output') return d.mul > 0 ? 1 / d.mul : Infinity
  return d.mul
}

/* ------------------------------------------------------------ 目标与判定 */

/**
 * 进试炼那一刻把目标钉下来：**爬回自己的高度**，但不低于筑基那道门。
 *
 * 取 `max(下限, 进入时的本世累计)` 而不是"进入时累计 × 某个系数"：
 * 系数会让高玩与新手的目标差出几个数量级，而"爬回原处"对所有人在语义上是同一件事——
 * 你在 debuff 下重新走到刚才那一步，就算过关。
 */
export function trialTargetOf(loopEarnedLog10: number, floorLog10: number): number {
  if (!Number.isFinite(loopEarnedLog10)) return floorLog10
  return Math.max(floorLog10, loopEarnedLog10)
}

/** 这一局过没过：本世累计灵气重新爬回目标 */
export function trialMet(loopEarnedLog10: number, targetLog10: number): boolean {
  return Number.isFinite(loopEarnedLog10) && loopEarnedLog10 >= targetLog10
}

/**
 * 进度 0..1，按 **log10 比例**画。
 * 目标动不动差几十个数量级，线性比例会永远贴着 0——和破境那条进度条同一个道理。
 */
export function trialProgress(loopEarnedLog10: number, targetLog10: number): number {
  if (!(targetLog10 > 0)) return 1
  const now = Number.isFinite(loopEarnedLog10) ? Math.max(0, loopEarnedLog10) : 0
  return Math.min(1, Math.max(0, now / targetLog10))
}

/* ------------------------------------------------------------ 奖励聚合 */

/**
 * 已完成的试炼白给的那几笔。和挑战、里程碑、成就并进同一本账（`totalBonus()`），
 * 所以产出公式只认 `activeBonus()`，试炼不另开一条私房倍率。
 */
export function trialBonus(bitmap: number): Bonus {
  let sum = noBonus()
  for (let i = 0; i < TRIALS.length; i++) {
    if (!trialCompleted(bitmap, i)) continue
    sum = addBonus(sum, TRIALS[i].bonus)
  }
  return sum
}

/* ------------------------------------------------------------ 元婴那道账 */

/**
 * 这道试炼在结婴之后给多少道基。表里没写或写坏一律 0——
 * 道基是稀缺货币，宁可少发也不能因为一个坏值凭空多出一笔。
 */
export function trialDaoJiOf(def: TrialDef | null): number {
  if (!def) return 0
  const n = Number(def.daoJi)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n)
}

/**
 * 已过的这几道一共欠玩家多少道基（`breakIntoYuan()` 补发用）。
 *
 * 为什么按位图现推、不新加一个"已结清"标记：结婴只做一次
 * （`breakIntoYuan()` 开头就挡 `yuanRealmOpen()`），所以"结婴那一刻把已过的补一遍"
 * 天然只发生一次；结婴之后再完成的，由 `settleTrial()` 当场发。
 * 两条路不重叠，也就不需要新的存档格。
 */
export function trialDaoJiTotal(bitmap: number): number {
  let sum = 0
  for (let i = 0; i < TRIALS.length; i++) {
    if (!trialCompleted(bitmap, i)) continue
    sum += trialDaoJiOf(TRIALS[i])
  }
  return sum
}
