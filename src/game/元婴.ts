/**
 * 元婴境界的纯数学层：元神三模式、大突破阈值/结算、metaMult、神念与斗法。
 *
 * 这个模块**不碰 state**，sim 直接 import；词条量全部摆在这一张表里。
 * 0.22 起运行时已经接上（`state.ts` 的 `yuanState()` / `yuanBreak()` / 神悟台 / 斗法），
 * 但读写的入口仍然只有 `state.ts` 一处——这里只负责算式，界面与存档都不许另算一份。
 *
 * 两个必须先说清的口径：
 * 1. `pillAnchor` 在 state 里存的是 **log10(灵气/秒)**，不是灵气/秒本身。
 *    本模块所有 `anchorLog` 参数都按这个口径；要看裸流量就 `10 ** anchorLog`。
 * 2. 元神产量走**平方根变体**（推荐）：`√(锚 × 1e40) × 1e-10`。
 *    公式与原来的 `锚 × 1e-5` 在锚 = 1e30 时完全相等，区别在于锚继续涨时：
 *      - 线性版：产量 ∝ 锚，阈值 ∝ √锚 ⇒ 突破时长 ∝ 1/√锚，锚涨 1e18 倍就快 1e9 倍；
 *      - 平方根版：产量 ∝ √锚，阈值 ∝ √锚 ⇒ 时长与锚无关，永远钉在 62 小时。
 *    目标时长 14~62h 只有在平方根版下才对所有构筑成立；线性版在 1e100 门槛处
 *    实测锚约 1e47.6（树 Lv.15）到 1e58.4（法宝 Lv.15），首次突破会变成毫秒级。
 *    见 `sim/yuan-anchor.mjs` 的两版对照。
 */

/* ------------------------------------------------------------ 门槛与标定 */

/**
 * 元婴的门槛：累计灵气到过 **1e80**（对数口径）。
 *
 * **这是唯一一处写这个数的地方，也是一个可以随时调的数**：
 * 改它，`realms.ts` 的境界阈值（元婴那一行的 `breakThrough`）、结婴的判定、
 * 页面上那条进度条会一起跟着动。运行时别处一律读这个常量，不许再写一遍 1e80。
 *
 * 为什么按累计灵气（`totalEarned`）而不是手上存量：
 * 破境、结丹、探索都会把手上的灵气散干净，用余量当门槛等于"每一世都得重新攒一次才准看元婴"。
 * 累计那一笔只涨不跌，语义上正好是"修到这个份上，元婴自然该成了"。
 *
 * 取 80 而不是设计稿原先排的 100：1e100 是结丹整条链跑完才摸得到的数，
 * 而元婴要在结丹还在推的时候就先开张；80 是用户拍板的过渡值，等实测觉得早/晚，
 * 只改这一个常量，再跑 `sim/yuan-runtime-check.mjs` 看门槛与结丹节奏对不对得上。
 */
export const YUAN_UNLOCK_LOG10 = 80

/**
 * 元婴**页**的准入门槛：结丹至少一层。
 *
 * 这张标签下不止试炼，还有炼神/神悟/斗法；但那三区的门是**结婴**（`YUAN_UNLOCK_LOG10`），
 * 不是这张标签的门。标签本身只按结丹层数开，理由是试炼要在结婴之前就能打——
 * 它是道基之外的另一条增量来源，把它锁到 1e80 之后等于让玩家少一种玩法。
 *
 * 元婴本体已经接上运行时（0.22），`realmIndex` 能到 3 了；这条门槛仍不动，
 * 因为它管的是"页面什么时候出现"，不是"元婴什么时候成"。
 */
export const YUAN_GATE_JINDAN_LAYER = 1

/** 定标锚：设计稿写的 pillAnchor = 1e30（金丹线那一点），不是元婴门槛处的实际锚 */
export const YUAN_CAL_ANCHOR_LOG10 = 30

/** 守神首次大突破的目标时长：62 小时 */
export const YUAN_FIRST_BREAK_SECONDS = 62 * 3600

/**
 * 阈值常量。由 `t = K × 10^(25 - anchorLog/2)` 在锚 = 1e30、守神、62h 反解：
 *   K = 223200 / 10^10 = 2.232e-5
 * 平方根变体下 `t = K × 1e10 / 模式倍率`，与锚无关。
 */
export const YUAN_K = 2.232e-5

/** 平方根变体的产量常数：`√(锚 × 1e40) × 1e-10`，在锚 1e30 时等于 1e25/秒 */
export const YUAN_SQRT_SHIFT = 1e-10

/** 线性版（设计稿原式）：`锚 × 1e-5`。只留给 sim 做对照，运行时不要用它 */
export const YUAN_LINEAR_SHIFT = 1e-5

export type YuanRateVariant = 'sqrt' | 'linear'

/* ------------------------------------------------------------ 元神三模式 */

export type YuanModeId = 'shouShen' | 'ningPo' | 'duoShe'

export interface YuanModeDef {
  id: YuanModeId
  name: string
  /** 元神产量倍率 */
  yuanMul: number
  /** 丹的流量留存（不消耗存量丹，只分走这一秒新出的那部分） */
  danKeep: number
  /** 废渣的流量留存 */
  dregKeep: number
  /** 丹炼回灵气那条返哺的留存 */
  qiKeep: number
  desc: string
}

/**
 * 三档的凹性已由 `sim/yuan-gear-check.mjs` 验过：
 * 每多要 1 点元神，付出的丹/渣/返哺都更贵。
 *
 * 夺舍取 3.20 而不是设计稿的 4.50：4.50 与 55% 的凝魄留存一起会**数学上不可能凹**——
 * 凝魄→夺舍多给 2.3 倍元神，却只多付 35% 丹，边际代价反而从 0.292 掉到 0.152。
 * 要保留 4.50 就得把凝魄倍率抬到 2.75 以上（那 `凝魄 ≈ 31h` 的目标也一起没了）。
 */
export const YUAN_MODES: YuanModeDef[] = [
  { id: 'shouShen', name: '守神', yuanMul: 1.0, danKeep: 0.9, dregKeep: 0.9, qiKeep: 1.0, desc: '按部就班地炼神，旧链几乎不受影响' },
  { id: 'ningPo', name: '凝魄', yuanMul: 2.2, danKeep: 0.55, dregKeep: 0.5, qiKeep: 0.7, desc: '拿一半的丹与渣去凝神，突破快一倍' },
  { id: 'duoShe', name: '夺舍', yuanMul: 3.2, danKeep: 0.2, dregKeep: 0.15, qiKeep: 0.4, desc: '把旧链压到最低，元神最猛；丹与渣几乎全让出去' },
]

export function findYuanMode(id: YuanModeId): YuanModeDef {
  return YUAN_MODES.find((d) => d.id === id) ?? YUAN_MODES[0]
}

/* ------------------------------------------------------------ 产量与阈值 */

/** 元神产量（log10/秒） */
export function yuanRateLog10(
  anchorLog: number,
  mode: YuanModeDef,
  shenLianLevel = 0,
  variant: YuanRateVariant = 'sqrt',
): number {
  const base =
    variant === 'sqrt'
      ? 0.5 * (anchorLog + 40) + Math.log10(YUAN_SQRT_SHIFT)
      : anchorLog + Math.log10(YUAN_LINEAR_SHIFT)
  return base + Math.log10(mode.yuanMul * (1 + 0.05 * shenLianLevel))
}

/** 大突破阈值（log10）。k 默认是定稿常量，sim 做"换锚重标"对照时可传别的值 */
export function yuanThresholdLog10(anchorLog: number, k = YUAN_K): number {
  return Math.log10(k) + 0.5 * (anchorLog + 40)
}

/** 到首次大突破要挂多久（秒）。平方根变体下与锚无关 */
export function yuanBreakSeconds(
  anchorLog: number,
  mode: YuanModeDef,
  shenLianLevel = 0,
  variant: YuanRateVariant = 'sqrt',
  k = YUAN_K,
): number {
  const log = yuanThresholdLog10(anchorLog, k) - yuanRateLog10(anchorLog, mode, shenLianLevel, variant)
  return 10 ** log
}

/**
 * 大突破结算：
 *   超过阈值的倍数 over = max(0, 累计元神 / 阈值 - 1)
 *   道基 = max(1, floor(2.8 × over)) × (1 + 0.04 × 洞明)
 * over 取**线性倍数**而不是 log10 位数：设计稿的 `2.8 × over` 只有在 over 是倍数时量级才对，
 * 若按位数算，挂到 10 倍阈值（多花 9 倍时间）才多给 1 点，等待永远不划算。
 * 洞明的乘数放在 floor **外面**（设计稿原样）：这样 1× 阈值破也吃得到洞明，
 * 代价是道基允许小数；存档按 0.01 精度存即可。
 */
export function yuanDaoGain(overYuan: number, dongMingLevel = 0): number {
  if (!(overYuan > 0)) return 1 * (1 + 0.04 * dongMingLevel)
  const raw = Math.max(1, Math.floor(2.8 * overYuan))
  return raw * (1 + 0.04 * dongMingLevel)
}

/** 同上，输入用 log10，避免大数在 double 里溢出 */
export function yuanDaoGainLog10(totalLog10: number, thresholdLog10: number, dongMingLevel = 0): number {
  const diff = totalLog10 - thresholdLog10
  // 没到线也把洞明算上：`yuanDaoGain(0, 洞明)` 本来就乘，两处口径必须一致
  if (!(diff > 0)) return yuanDaoGain(0, dongMingLevel)
  if (diff > 15) return Number.MAX_SAFE_INTEGER
  return yuanDaoGain(10 ** diff - 1, dongMingLevel)
}

/* ------------------------------------------------------------ 价格曲线 */

/** 几何涨价：max(1, ceil(g^lv))。超过 1e300 返回 Infinity，由调用方当"摸不到"处理 */
export function geometricCost(growth: number, level: number): number {
  const log = level * Math.log10(growth)
  if (log > 300) return Infinity
  return Math.max(1, Math.ceil(10 ** log))
}

/** 等比数列前 n 项和（log10） */
export function geometricSumLog10(growth: number, level: number, count: number): number {
  if (count <= 0) return -Infinity
  const g = Math.log10(growth)
  const first = level * g
  if (first > 300) return Infinity
  const ratio = count * g
  if (ratio > 300) return first + ratio - Math.log10(growth - 1)
  return first + Math.log10((growth ** count - 1) / (growth - 1))
}

export const YUAN_BUILDING_COST_GROWTH = 1.7
export const SHENWU_COST_GROWTH = 1.8
export const GENERAL_COST_GROWTH = 1.65
export const FIGHT_INSIGHT_COST_GROWTH = 1.75

export const yuanBuildingCost = (lv: number): number => geometricCost(YUAN_BUILDING_COST_GROWTH, lv)
export const shenWuCost = (lv: number): number => geometricCost(SHENWU_COST_GROWTH, lv)
export const generalCost = (lv: number): number => geometricCost(GENERAL_COST_GROWTH, lv)
export const fightInsightCost = (lv: number): number => geometricCost(FIGHT_INSIGHT_COST_GROWTH, lv)

/* ------------------------------------------------------------ 神念与建筑 */

/**
 * 元神建筑：每级产神念。造价 ×1.7/级，产量 ×1.15/级，
 * 于是下一级要等的时间按 (1.7/1.15) ≈ 1.48 倍往上走，是一堵对数墙而不是复利。
 * 0.05 是建议值，由 `sim/yuan-gear-check.mjs` 反解：第一个元婴周期挂 62 小时
 * 大约够把建筑点到 Lv.13 左右，不会一晚上买穿。
 *
 * Lv.0 也产 0.05/秒：第一级要 1 神念，若 0 级一分不产，这条线永远启动不了。
 * 相当于"草庐自带一点香火"，不是白送一级。
 */
export const SHENNIAN_BASE = 0.05
export const SHENNIAN_GROWTH = 1.15

export function shenNianPerSecond(level: number): number {
  return SHENNIAN_BASE * SHENNIAN_GROWTH ** Math.max(0, level)
}

/* ------------------------------------------------------------ 神悟台与斗战胜悟 */

export type ShenWuKind = 'yuan' | 'daoji' | 'meta' | 'danAdd' | 'qiAdd' | 'energyAdd' | 'dregMul' | 'passMul'

export interface ShenWuLineDef {
  id: string
  name: string
  /** 给玩家看的那句 */
  effect: string
  kind: ShenWuKind
  /** 加法按每级加数；乘法按每级倍率（1.05 = ×1.05/级） */
  power: number
}

/**
 * 神悟台：花元婴道基。前三条是元婴自己的轴，后五条全部映射旧五轴（不新起轴）。
 * metaMult 只在这一条线上产出，默认 level 0 ⇒ 1.0，所以旧 sim 不点它时一个数位都不动。
 */
export const SHENWU_LINES: ShenWuLineDef[] = [
  { id: 'shenLian', name: '神炼', effect: '元神产出 +5%', kind: 'yuan', power: 0.05 },
  { id: 'dongMing', name: '洞明', effect: '大突破道基 +4%', kind: 'daoji', power: 0.04 },
  { id: 'yuanDao', name: '元道', effect: '元道总倍率 ×1.10', kind: 'meta', power: 0.1 },
  { id: 'danXin', name: '丹心', effect: '每一炉的丹 +10%', kind: 'danAdd', power: 0.1 },
  { id: 'fanBu', name: '返哺', effect: '丹炼回灵气 +10%', kind: 'qiAdd', power: 0.1 },
  { id: 'xuanGong', name: '玄功', effect: '灵气产出 +10%', kind: 'energyAdd', power: 0.1 },
  { id: 'juZha', name: '聚渣', effect: '炸炉废渣 ×1.05', kind: 'dregMul', power: 0.05 },
  { id: 'xiXing', name: '息行', effect: '按秒折点 ×1.05', kind: 'passMul', power: 0.05 },
]

export function findShenWu(id: string): ShenWuLineDef | undefined {
  return SHENWU_LINES.find((d) => d.id === id)
}

/** metaMult = 1.10^元道等级；0 级 = 1，旧锚不受影响 */
export function metaMultOf(yuanDaoLevel: number): number {
  return 1.1 ** yuanDaoLevel
}

/** 斗战胜悟：花神念，永久。五条全部映射旧五轴；每级量压得比神悟台小，因为神念到后期很宽 */
export const FIGHT_INSIGHT_LINES: ShenWuLineDef[] = [
  { id: 'zhanYi', name: '战意', effect: '每一炉的丹 +2%', kind: 'danAdd', power: 0.02 },
  { id: 'zhanXi', name: '战息', effect: '丹炼回灵气 +2%', kind: 'qiAdd', power: 0.02 },
  { id: 'zhanTi', name: '战体', effect: '灵气产出 +2%', kind: 'energyAdd', power: 0.02 },
  { id: 'zhanLi', name: '战利', effect: '炸炉废渣 ×1.02', kind: 'dregMul', power: 0.02 },
  { id: 'zhanWu', name: '战悟', effect: '按秒折点 ×1.02', kind: 'passMul', power: 0.02 },
]

export function findFightInsight(id: string): ShenWuLineDef | undefined {
  return FIGHT_INSIGHT_LINES.find((d) => d.id === id)
}

/* ------------------------------------------------------------ 元神斗法 */

export type FightModeId = 'shouYu' | 'fenJi' | 'siZhan'

export interface FightModeDef {
  id: FightModeId
  name: string
  /** 战魂产出倍率 */
  warMul: number
  /** 从元神流量里分走多少（这部分不能计入大突破） */
  yuanDrain: number
  desc: string
}

/**
 * 三档凹性：每多 1 点战魂，分走的元神流量更贵。
 *   守御→奋击：0.10 / 1.00 = 0.100
 *   奋击→死战：0.15 / 1.20 = 0.125
 * 守御不能是不分流：0 分流会让第一段边际代价变成 0.15，后一段 0.136，当场不凹。
 */
export const FIGHT_MODES: FightModeDef[] = [
  { id: 'shouYu', name: '守御', warMul: 1.0, yuanDrain: 0.05, desc: '只分半成元神，战魂最少，突破几乎不受影响' },
  { id: 'fenJi', name: '奋击', warMul: 2.0, yuanDrain: 0.15, desc: '分一成半元神，战魂翻倍' },
  { id: 'siZhan', name: '死战', warMul: 3.2, yuanDrain: 0.3, desc: '分三成元神，战魂最猛，突破要多等四成时间' },
]

export function findFightMode(id: FightModeId): FightModeDef {
  return FIGHT_MODES.find((d) => d.id === id) ?? FIGHT_MODES[0]
}

/** 斗法解锁：累计元婴道基（只涨不跌）≥ 40 */
export const FIGHT_UNLOCK_TOTAL_DAOJI = 40

/** 一斩 10 秒：后台固定节拍，不点怪，只切档 */
export const FIGHT_KILL_SECONDS = 10

/** 战将每级把可斩的波次上限抬 1 波。抬 2 波时收入每级 ×1.56，会压不住 ×1.65 的价，一晚上能点到 160 级 */
export const FIGHT_WAVE_PER_GENERAL = 1
export const FIGHT_START_WAVE = 2

export function fightWaveCap(generalLevel: number): number {
  return FIGHT_START_WAVE + FIGHT_WAVE_PER_GENERAL * Math.max(0, generalLevel)
}

/** 第 wave 波一斩给多少战魂 */
export function warSoulPerKill(wave: number): number {
  return 5 * 1.25 ** wave
}

/** 稳定在波次上限时，每秒战魂（不含开局爬波） */
export function warSoulPerSecond(generalLevel: number, mode: FightModeDef): number {
  return (warSoulPerKill(fightWaveCap(generalLevel)) / FIGHT_KILL_SECONDS) * mode.warMul
}

/* ------------------------------------------------------------ 自动化 */

/** 累计大突破 ≥ 12 次才发自动器；只涨不跌，散功不回拨 */
export const AUTO_BREAK_UNLOCKS_AT = 12

export function autoBreakUnlocked(totalBreaks: number): boolean {
  return totalBreaks >= AUTO_BREAK_UNLOCKS_AT
}

/** 倍率触发：等到阈值的几倍再破，换更多道基 */
export type AutoBreakTrigger = 1 | 2 | 5 | 10

/**
 * 自动器能选的那几档。**0 表示关**，所以保存的是"倍率"本身而不是下标：
 * 老档读到 0/undefined 就是关，读到别的数由 `normalizeYuanAuto()` 兜回最近的一档。
 */
export const YUAN_AUTO_TRIGGERS: readonly AutoBreakTrigger[] = [1, 2, 5, 10]

/** 存档/界面上那个数收成合法档位；0 与其他越界值一律当"关" */
export function normalizeYuanAuto(raw: unknown): number {
  const n = Math.floor(Number(raw))
  return YUAN_AUTO_TRIGGERS.includes(n as AutoBreakTrigger) ? n : 0
}

export function shouldAutoBreak(
  totalBreaks: number,
  enabled: boolean,
  yuanLog10: number,
  thresholdLog10: number,
  trigger: AutoBreakTrigger = 1,
): boolean {
  if (!enabled || !autoBreakUnlocked(totalBreaks)) return false
  return yuanLog10 >= thresholdLog10 + Math.log10(trigger)
}

/* ------------------------------------------------------------ 运行时用的小换算 */

/** 模式在表里的下标，存档只存这个数；越界退回守神 */
export function yuanModeIndex(id: YuanModeId): number {
  const i = YUAN_MODES.findIndex((m) => m.id === id)
  return i < 0 ? 0 : i
}

/** 下标收回模式定义；越界一律守神 */
export function yuanModeAt(index: unknown): YuanModeDef {
  const i = Math.floor(Number(index))
  return i >= 0 && i < YUAN_MODES.length ? YUAN_MODES[i] : YUAN_MODES[0]
}

/** 斗法档位的下标与反查，规矩同上 */
export function fightModeIndex(id: FightModeId): number {
  const i = FIGHT_MODES.findIndex((m) => m.id === id)
  return i < 0 ? 0 : i
}

export function fightModeAt(index: unknown): FightModeDef {
  const i = Math.floor(Number(index))
  return i >= 0 && i < FIGHT_MODES.length ? FIGHT_MODES[i] : FIGHT_MODES[0]
}

/**
 * 元神实际到账的倍率：斗法分走的那一份不算进大突破。
 * 分流是**乘法**而不是减法——`yuanDrain = 0.3` 就是"只剩七成进元神"，
 * 所以死战的首破时长正好按 1/0.7 ≈ 1.43 倍拉长（§11.10 那张表）。
 */
export function yuanDrainKeep(mode: FightModeDef): number {
  return Math.max(0, Math.min(1, 1 - mode.yuanDrain))
}

/* ------------------------------------------------------------ 旧锚保护 */

/**
 * 只有元道等级 > 0 才乘。旧锚脚本从不点元道，所以 `metaMult=1` 是结构上的默认值，
 * 不是靠调用方记得传参。
 */
export function applyMetaMult(value: number, yuanDaoLevel: number): number {
  return yuanDaoLevel > 0 ? value * metaMultOf(yuanDaoLevel) : value
}
