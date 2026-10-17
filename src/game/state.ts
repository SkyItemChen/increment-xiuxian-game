import { reactive, ref, watch } from 'vue'
import { BigNumber } from './BigNumber'
import type { NumberStyle } from './BigNumber'
import { breakRealm, CULTIVATE_INDEX, REALMS } from './realms'
import type { Realm } from './realms'
import { bulkCost, LEVEL_CEILING, maxAffordable, productionOf } from './upgrades'
import { pointsForLoop, rebirthCost } from './rebirth'
import { drawCount, exploreCost, EXPLORE_UNLOCK_POINTS, freshSeed, insightOfStake, luckOf, nextRoll, openRarities, rarityOdds, rollExplore } from './explore'
import type { ExploreMods, ExploreOutcome } from './explore'
import {
  FURNACE_ID,
  jindanReturnMult,
  pillBulkCostLog10,
  pillCostLog10,
  pillFlowLog10,
  pillMaxLevels,
  pillRate,
  pillWaitSeconds,
} from './金丹丹炉'
import {
  autoBuyInterval,
  bustChance,
  danYieldMult,
  dregYieldMult,
  pointPassMult,
  pullBulkCostLog10,
  pullCostLog10,
  pullMaxCount,
  qiAxisAdd,
  rollSpirit,
  spiritEnergyAdd,
  type SpiritRoll,
} from './凝练'
import {
  achievementUnlocked,
  challengeMark,
  danBonusAdd,
  dregBonusMult,
  energyBonusAdd,
  milestoneUnlocked,
  passBonusMult,
  qiBonusAdd,
  totalBonus,
  type BonusCounters,
} from './挑战'
import {
  ALL_UPGRADES,
  ACHIEVEMENTS,
  AUTO_BUY_UNLOCK_POINTS,
  BUST_FLOOR,
  CHALLENGES,
  DEFAULT_PILL_MODE,
  EXPLORE_TREE,
  FREE_UPGRADE_UNLOCK_INSIGHT,
  findExplore,
  findPill,
  findPillMode,
  findRebirth,
  findUpgrade,
  GATHER_CRIT_MULT,
  JIEDAN_FURNACE_LEVEL,
  JINDAN_MILESTONES,
  JINDAN_TREE,
  JINDAN_TREE_PER_LAYER,
  findJindanTree,
  jindanInsightPerLayer,
  jindanTreeCost,
  jindanTreeSpent as treeSpent,
  metricLabel,
  OFFLINE_CAP_SECONDS,
  OFFLINE_REPORT_SECONDS,
  ONLINE_FRAME_MAX_SECONDS,
  PILL_AUTO_UNLOCK_LAYERS,
  PILL_LINES,
  PILL_MODES,
  POINT_PASS_RATE,
  PULL_AUTO_UNLOCK_TURNS,
  realmRank,
  REBIRTH_TREE,
  SPIRITS,
  spiritCurrent,
  TREASURES,
  type AchievementDef,
  type Bonus,
  type ChallengeDef,
  type ExploreDef,
  type JindanTreeDef,
  type MilestoneDef,
  type PillLineDef,
  type PillModeDef,
  type PillModeId,
  type RebirthDef,
  type SpiritDef,
  type UpgradeDef,
} from './词条与属性'

/** 游戏阶段：开始画面 → 游戏中 */
export type GamePhase = 'start' | 'playing'

/** 一次参悟几级；'max' 按当前灵气算到顶。档位固定在每条法门的右侧，不再有全局切换 */
export type BuyAmount = 1 | 'max'

export const SAVE_INTERVALS = [5, 10, 30, 60] as const
export type SaveInterval = (typeof SAVE_INTERVALS)[number]

export const NUMBER_FORMATS: readonly NumberStyle[] = ['letter', 'scientific']
export const NUMBER_FORMAT_LABELS: Record<NumberStyle, string> = {
  letter: '字母计数法',
  scientific: '科学计数法',
}

/**
 * 全局速度的档位。它是测试用的时间倍率：整条时间轴一起加速，
 * 吐纳格子、法门产出、累计时长都按它走，只用来把"两小时"压成"两分钟"看节奏。
 * 正式玩法一律 ×1，玩家侧看不到这个选项。
 */
export const GLOBAL_SPEEDS = [1, 2, 5, 10, 50, 100] as const
export type GlobalSpeed = (typeof GLOBAL_SPEEDS)[number]

/**
 * 吐纳进度条的基准时长（秒）。吐纳速度词条不改变每笔结算额，只让这一格来得更勤，
 * 所以它是全局收益倍率；第一世根基 1 灵气/秒时，起手第一格正好给 5 灵气。
 */
export const GATHER_PERIOD = 5

/**
 * 丹的结算周期（秒）。出丹是条连续的流，不像吐纳那样有进度条要喂，攒够一格才落一次账，
 * 为的是别每帧都动一次 BigNumber；面板上看不见这一格，玩家只看到丹在涨。
 */
export const PILL_PERIOD = 5

/**
 * 筑基点按秒折的结算周期（秒）。折进来的是小数、账上只落整数，所以按这一格攒零头（`state.loopBanked`），
 * 攒满一点才进筑基点。摆 1 秒是为了让界面上"每秒给多少"和真实入账对得上。
 */
export const POINT_PERIOD = 1

/**
 * 先天根基 = 一入门就自带的那份灵气/秒，不参悟任何法门也在，和法门堆出来的产出是两笔账。
 * 它是个**固定的起手数**：以前按第几世翻（一世 ×100，封顶 1e6），用户觉得太夸张，2026-10-15 改成定值，
 * 来世快慢全部交给根骨树的倍率——所以道基那条现在乘的是"全部灵气产出"，不再只乘根基。
 */
export const GATHER_BASE = 1

export interface Settings {
  autoSave: boolean
  autoSaveEvery: SaveInterval
  /** 数字显示记法 */
  numberFormat: NumberStyle
  /** 全局速度：主循环时间轴的倍率，只在测试区里调 */
  globalSpeed: GlobalSpeed
  /** 练气法门自动购买：系统替玩家把灵气花掉，破境仍然必须亲手按。五颗自动化开关一律默认关闭 */
  autoBuyCultivate: boolean
  /** 丹炉三条线的自动购买：同样只代买，结丹永远亲手按 */
  autoBuyPill: boolean
  /** 根骨五条的自动购买：五条合计 40 级之后才让拨 */
  autoBuyRebirth: boolean
  /** 鉴宝台四条的自动购买：四条合计 24 级之后才让拨。见识只能靠手动押一铲才有，所以这一条不会把探索那颗按钮架空 */
  autoBuyExplore: boolean
  /** 凝练转盘的自动抽取：只花废渣，不散任何家当，所以它和丹炉那条一样归"代买" */
  autoBuyPull: boolean
}

export interface GameState {
  phase: GamePhase
  /** 灵气存量（可花费） */
  spirit: BigNumber
  /** 累计获得的灵气（跨转生，只做统计） */
  totalEarned: BigNumber
  /** 本世获得的灵气，突破后清零。筑基点按它结算 */
  loopEarned: BigNumber
  /** 灵气获取速率（每秒），已含根基与速度 */
  spiritPerSecond: BigNumber
  /** 进度条走满一次吐纳结算的灵气，与速度无关 */
  spiritPerGather: BigNumber
  /** 速度倍率，由 speed-mult 法门连乘 */
  gatherSpeed: number
  /** 当前这一格吐纳实际要走的秒数 = 基准 / 速度 */
  gatherSeconds: number
  /** 本次吐纳已积攒的进度，0..1，只给进度条用 */
  gatherProgress: number
  /** 已开放到第几境，对应 REALMS，决定哪些标签页可见；破境只把它开到筑基 */
  realmIndex: number
  /** 破过几次境，即"第几世"（0 = 第一世）。只用来记账，不再决定先天根基 */
  loops: number
  /** 各法门等级 */
  levels: Record<string, number>
  /** 可用筑基点 */
  points: number
  /** 破境累计攒到的筑基点：花掉、探索清掉都不减，探索的门槛看它 */
  pointsEarned: number
  /** 按秒折进来的零头（不足 1 点的部分）：筑基点是整数，小数攒在这儿，攒满一点才落账 */
  loopBanked: number
  /** 根骨五条的等级。破境保留，探索也保留（2026-10-16 改的：只有修行那一层会散去） */
  rebirth: Record<string, number>
  /** 各法宝层数。探索挖出来的家当，跟着玩家一世一世走 */
  treasures: Record<string, number>
  /** 探索过几次，只做统计 */
  explores: number
  /** 见识（探索经验）：挖到已圆满的法宝才攒，拿去买鉴宝台那四条 */
  insight: number
  /** 累计攒到的见识：买鉴宝台花掉不减，成就看它 */
  insightEarned: number
  /** 鉴宝台各条的等级。破境和探索都不清——它是探索这层的永久进度 */
  exploreLevels: Record<string, number>
  /** 丹存量（可花费）。破境、探索、结丹都不散——它是金丹那一层的钱 */
  dan: BigNumber
  /** 出丹速率（每秒），已含炉子、火候、武火与挑战白给的那几成。炸炉不吃这一条，它是"炼成时给多少" */
  danPerSecond: BigNumber
  /** 丹炉三条线的等级 */
  pillLevels: Record<string, number>
  /** 炼丹用的火候：静心 / 常态 / 狂躁，切换它要存档（换档不该在刷新页面后被"纠正"回常态） */
  pillMode: PillModeId
  /** 这一炉走到的进度，0..1，只给进度条用 */
  pillProgress: number
  /** 丹药废渣（凝练转盘的门票）。和丹一样，散功不散它 */
  dreg: BigNumber
  /** 七道丹道精神的等级。抽到已抽过的就叠一级，全部永久 */
  spirits: Record<string, number>
  /** 抽过几次转盘：抽卡价按它往上走，所以废渣这条线也只有一条涨价的墙 */
  pulls: number
  /** 结过几次丹。首层产出 ×2、之后每层 ×1.25，所以一世时长大约被这个倍率除掉 */
  jindan: number
  /** 丹纹四枝的等级。点数从结丹层数与结丹里程碑来，点法由玩家定，不接自动化 */
  jindanTree: Record<string, number>
  /** 定价用的锚：见过的最高灵气/秒（log10）。只涨不跌，所以"自废流量再买丹"讨不到便宜 */
  pillAnchor: number
  /** 抽取序列的游标：预览与结算共用它，取消再点开不会重抽 */
  seed: number
  /** 紫金葫芦的会心概率，recompute() 折出来给主循环和界面用 */
  gatherCritChance: number
  /** 累计吐纳次数 */
  totalGathers: number
  /** 游戏内累计时间（秒） */
  totalTime: number
  settings: Settings
  /** 最近一次写入存档的时间戳 */
  savedAt: number
}

const SAVE_KEY = 'xiuxian.save.v1'
/** 某个版本把上面这个键名里的 "ave" 写成了省略号，进度存在那儿，读档时接管过来 */
const SALVAGE_KEY = 'xiuxian.s…e.v1'

/** 一份干净的进度：开局和"格式化数据"都用它 */
function freshState(): GameState {
  return {
    phase: 'start',
    spirit: BigNumber.zero(),
    totalEarned: BigNumber.zero(),
    loopEarned: BigNumber.zero(),
    spiritPerSecond: BigNumber.from(1),
    spiritPerGather: BigNumber.from(GATHER_PERIOD),
    gatherSpeed: 1,
    gatherSeconds: GATHER_PERIOD,
    gatherProgress: 0,
    realmIndex: 0,
    loops: 0,
    levels: {},
    points: 0,
    pointsEarned: 0,
    loopBanked: 0,
    rebirth: {},
    treasures: {},
    explores: 0,
    insight: 0,
    insightEarned: 0,
    exploreLevels: {},
    dan: BigNumber.zero(),
    danPerSecond: BigNumber.zero(),
    pillLevels: {},
    pillMode: DEFAULT_PILL_MODE,
    pillProgress: 0,
    dreg: BigNumber.zero(),
    spirits: {},
    pulls: 0,
    jindan: 0,
    jindanTree: {},
    pillAnchor: 0,
    seed: freshSeed(),
    gatherCritChance: 0,
    totalGathers: 0,
    totalTime: 0,
    settings: {
      autoSave: true, autoSaveEvery: 10, numberFormat: 'letter', globalSpeed: 1,
      autoBuyCultivate: false, autoBuyPill: false, autoBuyRebirth: false, autoBuyExplore: false,
      autoBuyPull: false,
    },
    savedAt: 0,
  }
}

export const state = reactive<GameState>(freshState())

/** 本地是否已有存档，用于决定开始按钮文案 */
export const hasSave = ref(false)

/**
 * 展示用快照。主循环每帧都在结算，但数字不必每帧都跳：
 * 每 0.2 秒采样一次，跳太快根本看不清；参悟、突破则立刻刷新，保证点了就有反馈。
 */
export const shown = reactive({
  spirit: BigNumber.zero(),
  totalEarned: BigNumber.zero(),
  loopEarned: BigNumber.zero(),
  dan: BigNumber.zero(),
  dreg: BigNumber.zero(),
  totalTime: 0,
})

const DISPLAY_INTERVAL = 0.2
let displayAcc = DISPLAY_INTERVAL

export function refreshDisplay(): void {
  shown.spirit = state.spirit.clone()
  shown.totalEarned = state.totalEarned.clone()
  shown.loopEarned = state.loopEarned.clone()
  shown.dan = state.dan.clone()
  shown.dreg = state.dreg.clone()
  shown.totalTime = state.totalTime
  displayAcc = 0
  // 这里是一切数值结算的收口，成就报条就搭在这儿比对新旧
  checkAchievements()
}

/** 全局数字显示：记法跟随设置，界面上的数字都走这里 */
export function fmt(n: BigNumber, decimals = 2): string {
  return n.format(decimals, state.settings.numberFormat)
}

/**
 * 普通 number（见识、筑基点、押注、价目这些账）也走同一套记法。
 * 后台存的还是 number，只是摆到界面上得跟灵气一样缩写，别再甩一串原始长数字撑爆框。
 */
export function fmtNum(n: number, decimals = 2): string {
  return BigNumber.from(n).format(decimals, state.settings.numberFormat)
}

/**
 * 根骨树折算出的修正量。加法累计，不叠乘——
 * 筑基点是线性收益，树内再做乘法就等于把上一世的下限乘进下一世，正反馈会回来。
 */
export interface RebirthMods {
  /** 道基：全部灵气产出的加法加成 */
  globalAdd: number
  /** 灵根：只管法门那份灵气/秒 */
  outputAdd: number
  /** 悟性：法门涨价幅度的按比例削减 */
  growthCut: number
  /** 慧根：一次吐纳会心的概率，和紫金葫芦共用一个池 */
  critChance: number
  /** 缘法：每次破境多给的筑基点 */
  pointAdd: number
}

export function rebirthMods(): RebirthMods {
  const mods: RebirthMods = {
    globalAdd: 0, outputAdd: 0, growthCut: 0, critChance: 0, pointAdd: 0,
  }
  for (const def of REBIRTH_TREE) {
    const lv = state.rebirth[def.id] ?? 0
    if (!lv) continue
    const value = def.power * lv
    switch (def.kind) {
      case 'global-add':
        mods.globalAdd += value
        break
      case 'output-add':
        mods.outputAdd += value
        break
      case 'cost-cut':
        mods.growthCut += value
        break
      case 'crit-add':
        mods.critChance += value
        break
      case 'point-add':
        mods.pointAdd += value
        break
    }
  }
  return mods
}

/**
 * 法宝折出来的那一份底子。它和根骨树的分工是：树是"这一层的永久强化、破境与探索都不散"，
 * 法宝是"探索带出来的家当"，两条都不吃彼此——树的道基乘全部灵气产出，聚宝盆补的是另一笔底子。
 * 2026-10-16 起淬炼不再缩放这里的 power——
 * power 就是词条自己那份，理由写在 [词条与属性.ts](./词条与属性.ts) 的鉴宝台注释里。
 */
export interface TreasureMods {
  /** 聚宝盆那类：直接补灵气/秒，不吃法门倍率 */
  autoBase: number
  /** 乾坤鼎：把含先天根基的总产出连乘起来，存在 log 空间 */
  autoMultLog: number
  /** 青竹笛：吐纳速度，和法门的 speed-mult 同一条乘算链 */
  speedLog: number
  /** 玄铜镜：法门涨价幅度的按比例削减，与悟性共用一个额度 */
  growthCut: number
  /** 紫金葫芦：一次吐纳会心的概率 */
  critChance: number
  /** 混沌钟：每次破境多给的筑基点 */
  pointBack: number
}

export function treasureMods(): TreasureMods {
  const mods: TreasureMods = {
    autoBase: 0, autoMultLog: 0, speedLog: 0, growthCut: 0, critChance: 0, pointBack: 0,
  }
  // switch 而不是 if 链：新加 kind 时漏分支会报错，顺着 else 掉进 pointBack 那种账可太难查
  for (const def of TREASURES) {
    const lv = state.treasures[def.id] ?? 0
    if (!lv) continue
    const power = def.power
    switch (def.kind) {
      case 'auto-base':
        mods.autoBase += power * lv
        break
      case 'auto-mult':
        mods.autoMultLog += lv * Math.log10(power)
        break
      case 'speed-mult':
        mods.speedLog += lv * Math.log10(power)
        break
      case 'cost-cut':
        mods.growthCut += power * lv
        break
      case 'gather-crit':
        mods.critChance += power * lv
        break
      case 'point-back':
        // 筑基点是整数，按四舍五入落账
        mods.pointBack += Math.round(power * lv)
        break
      case 'explore-luck':
        break // 机会倍率由 explore.ts 的 luckOf 现算，不参与产出结算
    }
  }
  return mods
}

/**
 * 鉴宝台（花见识的那四条）折出来的修正量。
 * 破境和探索都清不掉它，所以它是探索这层的永久进度——自动化要判断"该不该再押一轮"也只看这些数。
 */
export function exploreMods(): ExploreMods {
  const mods: ExploreMods = { yanLi: 0, energyAdd: 0, tieChan: 0, insightGain: 0 }
  for (const def of EXPLORE_TREE) {
    const lv = state.exploreLevels[def.id] ?? 0
    if (!lv) continue
    switch (def.kind) {
      case 'luck':
        // 眼力要的是等级本身：权重按它一级一级爬，倍率再乘它的 power
        mods.yanLi = lv
        break
      case 'energy-add':
        mods.energyAdd += def.power * lv
        break
      case 'draw-add':
        mods.tieChan = lv
        break
      case 'insight-gain':
        mods.insightGain += def.power * lv
        break
    }
  }
  return mods
}

/** 鉴宝台的一行报价 */
export interface ExploreQuote {
  def: ExploreDef
  level: number
  cost: number
  /** 手里的见识一次能把它往上推几级 */
  maxLevels: number
}

/**
 * 预算够就往上爬，爬到买不起为止。两棵树没有等级上限了，墙由价格竖着（每层 ×1.5/×1.6 递增）。
 * 逐级累加而不是用等比求和：这两棵树的价格是 `ceil(power^lv)`，取整后不满足等比闭式解，
 * 闭式解报出来的级数会虚高一两级。天花板只留一条防溢出保险丝，防的是改过内存的存档。
 */
const TREE_LEVEL_CEILING = 1e5
function levelsWithinBudget(costOf: (lv: number) => number, level: number, budget: number): number {
  let left = budget
  let n = 0
  while (level + n < TREE_LEVEL_CEILING) {
    const c = costOf(level + n)
    if (!(c <= left)) break
    left -= c
    n += 1
  }
  return n
}

/** 从 level 起连买 count 级的总价 */
function totalCost(costOf: (lv: number) => number, level: number, count: number): number {
  let sum = 0
  for (let i = 0; i < count; i++) sum += costOf(level + i)
  return sum
}

/**
 * 一键购买的走法：每一口都只挑"下一级最便宜"的那一行，摊平等级。
 * 根骨五条、鉴宝台四条各自共用同一条价目曲线，所以法门那一套「从末尾往前买满」在这里是亏的——
 * 末尾那行会把整个钱包吃光，其余几行一级都摸不到。摊平才和 sim/lives.mjs 调数值用的贪心一致。
 * 就地改 levels，由调用方扣钱。
 */
function spreadCheapest(
  levels: Record<string, number>,
  defs: { id: string }[],
  costOf: (lv: number) => number,
  budget: number,
): { spent: number; count: number } {
  let left = budget
  let count = 0
  while (count < TREE_LEVEL_CEILING) {
    let pick = ''
    let price = Infinity
    for (const def of defs) {
      const lv = levels[def.id] ?? 0
      if (lv >= TREE_LEVEL_CEILING) continue
      const c = costOf(lv)
      if (c <= left && c < price) {
        pick = def.id
        price = c
      }
    }
    if (!pick) break
    levels[pick] = (levels[pick] ?? 0) + 1
    left -= price
    count += 1
  }
  return { spent: budget - left, count }
}

export function exploreRows(): ExploreQuote[] {
  return EXPLORE_TREE.map((def) => {
    const level = state.exploreLevels[def.id] ?? 0
    return {
      def,
      level,
      cost: exploreCost(level),
      maxLevels: levelsWithinBudget(exploreCost, level, state.insight),
    }
  })
}

/** 参悟鉴宝台：一次买 1 级，或把手上的见识全花在这条上，买得起才扣 */
export function buyExplore(id: string, amount: BuyAmount = 1): boolean {
  const def = findExplore(id)
  if (!def) return false
  const level = state.exploreLevels[id] ?? 0
  const count = amount === 'max' ? levelsWithinBudget(exploreCost, level, state.insight) : amount
  if (count < 1) return false
  const cost = totalCost(exploreCost, level, count)
  if (state.insight < cost) return false
  state.insight -= cost
  state.exploreLevels[id] = level + count
  recompute()
  refreshDisplay()
  return true
}

/** 一键购买鉴宝台：把见识摊到四条上；一级都买不起时什么都不做 */
export function buyAllExplore(): boolean {
  const r = spreadCheapest(state.exploreLevels, EXPLORE_TREE, exploreCost, state.insight)
  if (!r.count) return false
  state.insight -= r.spent
  recompute()
  refreshDisplay()
  return true
}

/** 法门涨价幅度的总削减：悟性买来的 + 玄铜镜给的 */
export function priceCut(): number {
  return rebirthMods().growthCut + treasureMods().growthCut
}

/**
 * 挑战、结丹里程碑、加属性成就这三张表要读的那几笔累计。
 * 摆在 state 这一头、判定放在 [挑战.ts](./挑战.ts)：那个模块收数不算账，`sim/` 才能拿同一份表跑同一套判定。
 * 每一条读的都是只涨不跌的账——散功清的是手上的灵气与法门修为，这些一笔都不动。
 */
function counters(): BonusCounters {
  return {
    pillLevels: state.pillLevels,
    spirits: state.spirits,
    pulls: state.pulls,
    jindan: state.jindan,
    insightEarned: state.insightEarned,
    explores: state.explores,
    pointsEarned: state.pointsEarned,
    rootLevels: Object.values(state.rebirth).reduce((a, b) => a + b, 0),
    benchLevels: Object.values(state.exploreLevels).reduce((a, b) => a + b, 0),
    treasures: Object.values(state.treasures).filter((lv) => lv > 0).length,
    qiLog10: state.totalEarned.log10(),
    gathers: state.totalGathers,
    playMinutes: Math.floor(state.totalTime / 60),
    jindanTree: state.jindanTree,
  }
}

/** 眼下一共白给多少。没有存档字段、也不缓存：达成与否随时从上面那几笔账推出来 */
export function activeBonus(): Bonus {
  return totalBonus(counters())
}

/**
 * 由法门等级重算产出。
 * 每个境界各自结算再累加：练气的聚灵阵眼只改写练气自己的单级加成，不会顺带把筑基也放大，
 * 否则乘法法门跨境界叠加会让产出爆掉境界阈值。根基倍率与速度则跨境界连乘，升级不白买。
 * 灵根给法门那份灵气/秒加加成，道基连先天根基和法宝一起乘——两条的分工就在这。
 * 法宝是探索带出来的家当，聚宝盆补在产出里、乾坤鼎把总产出连乘起来。
 * 丹房挂在道基那条加法轴上；结丹回溯是另一条独立的乘法（首层 ×2、之后每层 ×1.25）。
 * 两条都乘在整份产出上，所以一世时长被它们除掉——结丹要靠乘法轴才够得着元婴门槛。
 * 挑战、结丹里程碑、加属性成就、丹纹四枝白给的那几笔（`activeBonus()`）也添在这几条现成的轴上，不新起第六条轴。
 * 练气一世 20 分钟的定标落在五条法门各自的 power 上（见 `词条与属性.ts`），这里不再另乘基准倍率。
 */
export function recompute(): void {
  const { globalAdd, outputAdd, critChance } = rebirthMods()
  const t = treasureMods()
  const bonus = activeBonus()
  // 淬炼改版后和道基共用这条加法轴（两个货币买同一条轴的先例是悟性与玄铜镜）
  const energyAdd = globalAdd + exploreMods().energyAdd
  let perSecond = BigNumber.zero()
  let gatherMult = BigNumber.from(1)
  let speed = 1
  for (const realm of REALMS) {
    if (realm.upgrades.length === 0) continue
    const p = productionOf(state.levels, realm.upgrades, outputAdd)
    perSecond = perSecond.add(p.perSecond)
    gatherMult = gatherMult.mul(p.gatherMult)
    speed *= p.speedMult.toNumber()
  }
  const back =
    (1 + energyAdd + spiritEnergyAdd(state.spirits) + energyBonusAdd(bonus)) *
    jindanReturnMult(state.jindan) *
    (1 + qiAxisAdd(state.pillLevels, state.spirits) + qiBonusAdd(bonus))
  const rate = BigNumber.from(GATHER_BASE)
    .mul(gatherMult)
    .add(perSecond)
    .add(new BigNumber(t.autoBase, 0))
    .mul(BigNumber.fromLog10(t.autoMultLog))
    .mulNumber(back)
  state.gatherCritChance = Math.min(t.critChance + critChance, 1)
  state.gatherSpeed = speed * BigNumber.fromLog10(t.speedLog).toNumber()
  state.gatherSeconds = GATHER_PERIOD / state.gatherSpeed
  state.spiritPerGather = rate.mulNumber(GATHER_PERIOD)
  state.spiritPerSecond = rate.mulNumber(state.gatherSpeed)
  // 定价锚只涨不跌：故意自废流量（押一铲探索）再来买丹讨不到便宜
  const flow = state.spiritPerSecond.log10()
  if (flow > state.pillAnchor) state.pillAnchor = flow
  // 武火那几成丹之外，挑战/里程碑/成就白给的几成也添在同一个加数上
  state.danPerSecond = pillRate(state.spiritPerSecond, state.pillLevels).mulNumber(
    danYieldMult(state.spirits) + danBonusAdd(bonus),
  )
}

function earn(gain: BigNumber): void {
  if (gain.isZero) return
  state.spirit = state.spirit.add(gain)
  state.totalEarned = state.totalEarned.add(gain)
  state.loopEarned = state.loopEarned.add(gain)
}

/** 踏入仙途：从开始画面进入游戏，吐纳进度条从头开始走 */
export function startGame(): void {
  gatherAcc = 0
  state.gatherProgress = 0
  state.phase = 'playing'
}

/** 一档购买报价。法门没有等级上限，买不买得起只看灵气 */
export interface Quote {
  count: number
  cost: BigNumber
}

/** 按当前购买档位算出"买几级、花多少"，供列表展示 */
export function quoteOf(id: string, amount: BuyAmount): Quote | null {
  const def = findUpgrade(id)
  if (!def) return null
  const growthCut = priceCut()
  const level = state.levels[def.id] ?? 0
  let count: number
  if (amount === 'max') {
    // 用快照算，保证按钮显示的"买得起"和真实余额方向一致（只会保守，不会虚报）
    count = maxAffordable(def, level, shown.spirit.log10(), growthCut)
    if (count < 1) count = 1
  } else {
    count = amount
  }
  return { count, cost: bulkCost(def, level, count, growthCut) }
}

/** 参悟法门：一次买 1 级或把买得起的全买了，买得起才扣 */
export function buyUpgrade(id: string, amount: BuyAmount = 1): boolean {
  const def = findUpgrade(id)
  if (!def) return false
  const growthCut = priceCut()
  const level = state.levels[def.id] ?? 0
  let count = amount === 'max' ? maxAffordable(def, level, state.spirit.log10(), growthCut) : amount
  if (count < 1) return false
  // maxAffordable 是闭式解，浮点误差可能多算一级，逐级回退到真实买得起的数量
  let price = bulkCost(def, level, count, growthCut)
  while (count > 1 && !state.spirit.gte(price)) {
    count -= 1
    price = bulkCost(def, level, count, growthCut)
  }
  if (!state.spirit.gte(price)) return false
  // 「不取一毫」免掉的是灵气这份开销，价目表照旧当墙：灵气没攒到这一层的价，仍然悟不进去
  if (!upgradeIsFree(def.id)) state.spirit = state.spirit.sub(price)
  state.levels[def.id] = level + count
  recompute()
  refreshDisplay()
  return true
}

/**
 * 一键购买：从列表最后一行往前，逐行把买得起的全买了。
 * 贵的排在后面，所以先给贵的让路——同样的灵气，买最后一行涨得最多。
 * 返回是否真的买到了东西，一行都买不起就什么都不做。
 */
export function buyAllFromEnd(ids: string[]): boolean {
  let bought = false
  for (const id of [...ids].reverse()) {
    if (buyUpgrade(id, 'max')) bought = true
  }
  return bought
}

const CULTIVATE_IDS = REALMS[CULTIVATE_INDEX].upgrades.map((def) => def.id)

/**
 * 自动化：替玩家把练气法门的花费跑掉，从列表末尾往前买，跟一键购买同一个贪心。
 * 系统只代跑"买"这一件事——破境清档永远要亲手按，所以这里绝不碰 breakThrough。
 */
function runAutoBuy(): void {
  buyAllFromEnd(CULTIVATE_IDS)
}

/** 成就行：达成只看累计那笔账，花掉、探索清零都不退回去 */
export interface AchievementRow {
  def: AchievementDef
  unlocked: boolean
  /** 没达成时成就页念这一句；达成了留空 */
  progress: string
}

/** 成就看的那几笔小账如今有多少（累计灵气那一笔走 BigNumber，由 achievementRow 自己判） */
function achievementEarned(metric: AchievementDef['metric']): number {
  if (metric === 'insight') return state.insightEarned
  if (metric === 'layers') return state.jindan
  if (metric === 'turns') return state.pulls
  if (metric === 'explores') return state.explores
  if (metric === 'root') return Object.values(state.rebirth).reduce((a, b) => a + b, 0)
  if (metric === 'bench') return Object.values(state.exploreLevels).reduce((a, b) => a + b, 0)
  if (metric === 'treasures') return Object.values(state.treasures).filter((lv) => lv > 0).length
  if (metric === 'gathers') return state.totalGathers
  if (metric === 'playtime') return Math.floor(state.totalTime / 60)
  return state.pointsEarned
}

/**
 * 一条成就的达成与进度。达成与否走 `挑战.ts` 那唯一一份判定——白给的好处也照它添。
 * 除了灵气那一笔，账都是小数目，直接念"还差几个"；灵气动不动上百位，做减法念出来没人看得懂，
 * 所以那一笔把门槛和如今两头各报一遍。
 */
function achievementRow(def: AchievementDef): AchievementRow {
  const unlocked = achievementUnlocked(def, counters())
  if (def.metric === 'qi') {
    const need = BigNumber.from(def.need)
    if (unlocked) return { def, unlocked: true, progress: '' }
    return { def, unlocked: false, progress: `灵气攒到 ${fmt(need)} 就开 · 如今 ${fmt(state.totalEarned)}` }
  }
  const left = def.need - achievementEarned(def.metric)
  if (left <= 0) return { def, unlocked: true, progress: '' }
  return { def, unlocked: false, progress: `还差 ${left} ${metricLabel(def.metric)}` }
}

/** 成就页那面账本：按境界从练气往下排，同一境内照词条写的顺序 */
export function achievementRows(): AchievementRow[] {
  return ACHIEVEMENTS.map(achievementRow).sort((a, b) => realmRank(a.def.realm) - realmRank(b.def.realm))
}

/** 一条刚达成的成就，摆在屏角念一声用 */
export interface AchievementNotice {
  id: string
  name: string
  desc: string
}

/**
 * 新达成成就的报条队列。成就是推出来的、不存字段，所以要跨帧比一比才知道哪条是"这一下才达成"。
 * 记一份已达成的 id 集合，`refreshDisplay` 每次结算时对一遍，多出来的就压进队列由界面逐条报掉。
 */
export const achievementNotices = ref<AchievementNotice[]>([])

let knownAchievements = new Set<string>()
let achievementsSeeded = false

/**
 * 洗掉比对基准：读档、导入、格式化之后，现有的达成一律认作"本来就是"，
 * 只有往后新达成的才报——否则读一份老存档会把它里面积累的几十条一次性全报出来。
 */
export function reseedAchievements(): void {
  knownAchievements = new Set()
  achievementsSeeded = false
  achievementNotices.value.length = 0
}

/** 比一比这一下新达成了哪几条。第一次进来只认基准、不报，免得读档时炸一串 */
function checkAchievements(): void {
  const c = counters()
  const unlocked = ACHIEVEMENTS.filter((def) => achievementUnlocked(def, c))
  if (!achievementsSeeded) {
    for (const def of unlocked) knownAchievements.add(def.id)
    achievementsSeeded = true
    return
  }
  for (const def of unlocked) {
    if (knownAchievements.has(def.id)) continue
    knownAchievements.add(def.id)
    achievementNotices.value.push({ id: def.id, name: def.name, desc: def.desc })
  }
}

/** 金丹页「挑战」那一栏的一行 */
export interface ChallengeRow {
  def: ChallengeDef
  /** 现在到哪一格，与 need 同单位 */
  now: number
  need: number
  unlocked: boolean
  /** 没达成时念这一句；达成了留空 */
  progress: string
}

/** 三档条件各有各的刻度：三条线数级、转盘数次、精神数那道 */
function needUnit(need: ChallengeDef['need']): string {
  if (need.kind === 'pill') return '级'
  if (need.kind === 'pulls') return '次'
  return '道'
}

/** 挑战那一栏：五条各报"现在到哪 / 还差多少"，判定与白给的好处同走 `挑战.ts` */
export function challengeRows(): ChallengeRow[] {
  const c = counters()
  return CHALLENGES.map((def) => {
    const mark = challengeMark(def.need, c)
    const left = mark.need - mark.now
    return {
      def,
      now: mark.now,
      need: mark.need,
      unlocked: left <= 0,
      progress: left <= 0 ? '' : `还差 ${left} ${needUnit(def.need)}`,
    }
  })
}

/** 结丹里程碑的一行 */
export interface MilestoneRow {
  def: MilestoneDef
  unlocked: boolean
  progress: string
}

/** 已结几层丹对上的那一串台阶 */
export function milestoneRows(): MilestoneRow[] {
  const c = counters()
  return JINDAN_MILESTONES.map((def) => {
    const unlocked = milestoneUnlocked(def, c)
    return { def, unlocked, progress: unlocked ? '' : `还要再结 ${def.layer - c.jindan} 层` }
  })
}

/**
 * 眼下这三张表一共白给多少，一行一句大白话。
 * 加法的几条写成"多几成"，乘法的几条写成"几倍"——界面上不出现 ×1.5 这种实现层的写法。
 */
export function bonusSummary(): string[] {
  const b = activeBonus()
  const pct = (v: number) => `+${Math.round(v * 100)}%`
  const times = (v: number) => `${v.toFixed(2)} 倍`
  const out: string[] = []
  if (b.danAdd) out.push(`每一炉的丹 ${pct(b.danAdd)}`)
  if (b.qiAdd) out.push(`丹炼回灵气 ${pct(b.qiAdd)}`)
  if (b.energyAdd) out.push(`灵气产出 ${pct(b.energyAdd)}`)
  if ((b.dregMul ?? 1) !== 1) out.push(`炸炉赔的废渣 ${times(b.dregMul ?? 1)}`)
  if ((b.passMul ?? 1) !== 1) out.push(`每秒进的筑基点 ${times(b.passMul ?? 1)}`)
  return out
}

/** 累计见识够不够开"参悟不耗灵气"这条成就 */
export function freeUpgradeGate(): { unlocked: boolean; earned: number; need: number } {
  const earned = state.insightEarned
  return { unlocked: earned >= FREE_UPGRADE_UNLOCK_INSIGHT, earned, need: FREE_UPGRADE_UNLOCK_INSIGHT }
}

/**
 * 这一条法门买下来要不要真的扣灵气。成就是被动的、没有开关，
 * 而且只管修行境那几条法门——筑基往上没有法门列表，将来加别境时别顺手把免费扩过去。
 */
export function upgradeIsFree(id: string): boolean {
  return freeUpgradeGate().unlocked && CULTIVATE_IDS.includes(id)
}

/**
 * 自动参悟的解锁门槛：第一条成就——累计攒够这些筑基点。
 * 和探索那个门槛同一个口径，看累计不看手上余额，花掉也不会把开关再锁回去。
 */
export function autoBuyGate(): { unlocked: boolean; earned: number; need: number } {
  const earned = state.pointsEarned
  return { unlocked: earned >= AUTO_BUY_UNLOCK_POINTS, earned, need: AUTO_BUY_UNLOCK_POINTS }
}

/** 开关拨上、成就也到了，主循环才真的代买 */
export function autoBuyActive(): boolean {
  return state.settings.autoBuyCultivate && autoBuyGate().unlocked
}

/**
 * 破境那张字据摆到哪一笔账上就不再问第二遍。看的是**累计筑基点**——
 * 第一世只有一两点，攒到这个数已经把同一张纸看过六七遍了；
 * 而且它不随探索清零，挖完宝回来也不用重新问一遍。
 */
export const BREAK_CONFIRM_POINTS = 20

/** 摆过五铲之后，那张摊开的清单不再生成：挖到的法宝一直挂在墙上，看得见 */
export const EXPLORE_CONFIRM_LESSONS = 5

/** 调用方自己决定"那就不摆字据，直接办事"——按的还是玩家这一下 */
export function needBreakConfirm(): boolean {
  return state.pointsEarned < BREAK_CONFIRM_POINTS
}

export function needExploreConfirm(): boolean {
  return state.explores < EXPLORE_CONFIRM_LESSONS
}

/**
 * 转生的门槛：修行境攒够灵气就能破，破完回到修行境重攒，一世一世反复。
 * 不按 state.realmIndex 往后推——筑基之上的破境要按筑基自己的资源算，那套还没做。
 * 金丹开张之后这一条直接归 null：那颗按钮撤了，收益换成按秒折筑基点（`pointPassPerSecond`），
 * 于是破境的预览、结算、界面三头一起关掉，不用在每处各写一个条件。
 */
export function realmToBreakThrough(): { realm: Realm; reached: boolean } | null {
  if (pointPassActive()) return null
  const realm = breakRealm()
  if (!realm) return null
  return { realm, reached: state.spirit.gte(realm.breakThrough as BigNumber) }
}

/**
 * 破境即转生：踏进下一境的同时，修行境的法门修为与手上灵气一并清零，换来筑基点。
 * 正反馈环（聚灵阵眼 × 紫府开辟）因此断在每一世内部，不会一世一世乘下去。
 */
export interface BreakPreview {
  realm: Realm
  /** 本世将清空的法门，只列出已有等级的 */
  wiped: { def: UpgradeDef; level: number }[]
  /** 将被清空的气数 */
  spirit: BigNumber
  /** 这一世折算出的筑基点（不含加成） */
  points: number
  /** 缘法与混沌钟这类"每次破境多给几点"在破境时额外补给点数 */
  bonus: number
}

/** 破境额外那笔点数：缘法买来的 + 混沌钟给的，预览、结算、界面共用一个算式 */
export function breakBonus(): number {
  return rebirthMods().pointAdd + treasureMods().pointBack
}

/**
 * 金丹一开张，练气就不再破境。散掉一整世的灵气只换一笔筑基点，这件事改成按秒折给之后有两处松动：
 * 一是灵气不再需要在"拿去破境"和"留着炼丹、留着结丹"之间挑一头，二是玩家不必一世一世回来按同一颗按钮。
 * 折算走的还是 `rebirth.ts` 那条式子，只是读的那笔账换成**累计灵气**：散功（结丹、探索）不该把这条进项
 * 一起打回零，它只跟着"一共修来多少灵气"走。折出去的点数不回灵气那笔账，所以这条进项一点复利都没有——
 * 灵气多攒十个数量级，每秒才多给 0.03 点。比例摆在词条 `POINT_PASS_RATE`，后面别的词条要改就改那一个数。
 * 这一条在成就页上叫「不劳而获」，玩家能在账本里看到它是哪一笔账换来的。
 */
export function pointPassActive(): boolean {
  return pillUnlocked()
}

/** 按一笔累计灵气折出的筑基点——就是金丹之前按下破境那颗按钮拿到的那个数 */
export function pointLump(earned: BigNumber): number {
  const realm = breakRealm()
  if (!realm) return 0
  return pointsForLoop(earned, realm.breakThrough as BigNumber, state.loops) + breakBonus()
}

/** 每秒折给玩家的筑基点（未取整），界面念的就是这个数。定息把它往上乘，cap 在词条表里；火候到家那条挑战也乘在这一条上 */
export function pointPassPerSecond(): number {
  if (!pointPassActive()) return 0
  return (
    pointLump(state.totalEarned) * POINT_PASS_RATE * pointPassMult(state.spirits) * passBonusMult(activeBonus())
  )
}

/**
 * 把按秒攒下来的零头落成整数筑基点，返回落了几个。
 * 账上的点数一直是整数，探索那颗按钮押的是 `floor(点数)`，零头单放在 loopBanked 里就不会啃到本金。
 */
function accruePoints(raw: number): number {
  if (!(raw > 0)) return 0
  state.loopBanked += raw
  const whole = Math.floor(state.loopBanked)
  if (whole < 1) return 0
  state.loopBanked -= whole
  state.points += whole
  state.pointsEarned += whole
  return whole
}

/** 结算这一段游戏时间该折进来的筑基点（整数个），主循环按 POINT_PERIOD 一格一次；`sim/passive-check.mjs` 也走这一条 */
export function settlePointPass(seconds: number): number {
  if (!pointPassActive() || !(seconds > 0)) return 0
  return accruePoints(pointPassPerSecond() * seconds)
}

/** 破境前的结算：给确认弹窗看"清掉什么、拿到什么"；条件不满足返回 null */
export function previewBreakThrough(): BreakPreview | null {
  const next = realmToBreakThrough()
  if (!next || !next.reached) return null
  const wiped = REALMS[CULTIVATE_INDEX].upgrades
    .map((def) => ({ def, level: state.levels[def.id] ?? 0 }))
    .filter((row) => row.level > 0)
  return {
    realm: next.realm,
    wiped,
    spirit: state.spirit.clone(),
    points: pointsForLoop(state.loopEarned, next.realm.breakThrough as BigNumber, state.loops),
    bonus: breakBonus(),
  }
}

/**
 * 确认破境：清零修行境本世的一切、入账筑基点。
 * 标签只开到转生树那一境就停住，再往上的境界要等筑基资源那套做出来才谈。
 */
export function breakThrough(): boolean {
  const preview = previewBreakThrough()
  if (!preview) return false
  for (const row of preview.wiped) state.levels[row.def.id] = 0
  state.spirit = BigNumber.zero()
  state.loopEarned = BigNumber.zero()
  state.points += preview.points + preview.bonus
  state.pointsEarned += preview.points + preview.bonus
  state.loops += 1
  state.realmIndex = Math.max(state.realmIndex, CULTIVATE_INDEX + 1)
  recompute()
  refreshDisplay()
  saveGame()
  return true
}

/** 转生树的一行报价 */
export interface RebirthQuote {
  def: RebirthDef
  level: number
  cost: number
  /** 手里的筑基点一次能把它往上推几级 */
  maxLevels: number
}

export function rebirthRows(): RebirthQuote[] {
  return REBIRTH_TREE.map((def) => {
    const level = state.rebirth[def.id] ?? 0
    return {
      def,
      level,
      cost: rebirthCost(level),
      maxLevels: levelsWithinBudget(rebirthCost, level, state.points),
    }
  })
}

/** 悟性买到的价格削减，法门列表标出折后价 */
export function rebirthGrowthCut(def: RebirthDef): number {
  return def.power * (state.rebirth[def.id] ?? 0)
}

/** 参悟根骨：一次买 1 级，或把手上的筑基点全花在这条上，买得起才扣 */
export function buyRebirth(id: string, amount: BuyAmount = 1): boolean {
  const def = findRebirth(id)
  if (!def) return false
  const level = state.rebirth[id] ?? 0
  const count = amount === 'max' ? levelsWithinBudget(rebirthCost, level, state.points) : amount
  if (count < 1) return false
  const cost = totalCost(rebirthCost, level, count)
  if (state.points < cost) return false
  state.points -= cost
  state.rebirth[id] = level + count
  recompute()
  refreshDisplay()
  return true
}

/** 一键购买根骨：把筑基点摊到五条上；一级都买不起时什么都不做 */
export function buyAllRebirth(): boolean {
  const r = spreadCheapest(state.rebirth, REBIRTH_TREE, rebirthCost, state.points)
  if (!r.count) return false
  state.points -= r.spent
  recompute()
  refreshDisplay()
  return true
}

/**
 * 探索的门槛：累计攒够 EXPLORE_UNLOCK_POINTS 筑基点才开启。
 * 摸的是"一共攒到多少"而不是"手上还剩多少"——押注会把点数清零，用余额当门槛会让已解锁的人退回锁上。
 * 挖过一次（explores > 0）也算开启，读档时那份下界兜得住老存档。
 */
export function exploreGate(): { unlocked: boolean; earned: number; need: number } {
  const earned = state.pointsEarned
  return { unlocked: earned >= EXPLORE_UNLOCK_POINTS || state.explores > 0, earned, need: EXPLORE_UNLOCK_POINTS }
}

/**
 * 探索前该看见的东西：押上的本金、能挖几铲、各品质的概率、押注折回的见识。
 * 与 previewExplore() 同源，界面直接摆出来，不做"猜猜看"。
 * 铲数与概率都只看鉴宝台的等级，押多少点都不会让它们变——点数只换成见识。
 */
export function exploreOdds(): {
  stake: number
  count: number
  odds: ExploreOutcome['odds']
  stakeInsight: number
  insight: number
} {
  const mods = exploreMods()
  return {
    stake: state.points,
    count: drawCount(mods),
    odds: rarityOdds(mods.yanLi, luckOf(state.treasures, mods), openRarities(state.treasures)),
    stakeInsight: insightOfStake(Math.floor(state.points), mods),
    insight: state.insight,
  }
}

/** 探索的结算预览：结果由 state.seed 决定，反复点开都是同一批 */
export function previewExplore(): ExploreOutcome | null {
  if (!exploreGate().unlocked || state.points < 1) return null
  return rollExplore(state.points, state.seed, state.treasures, exploreMods())
}

/**
 * 一铲下去翻掉的是**修行那一层**：练气的法门、手上的灵气与筑基点清零，
 * 换回来的只有法宝与见识。根骨树不再散去（2026-10-16 用户改的）——
 * 买过的等级跟着玩家走，押上去的只是手上还没花的点数。
 * 点数按 10:1 折成见识，挖到已圆满的法宝再另外攒一笔。
 */
export function explore(): boolean {
  const outcome = previewExplore()
  if (!outcome) return false
  state.spirit = BigNumber.zero()
  state.loopEarned = BigNumber.zero()
  state.levels = {}
  state.treasures = outcome.levels
  state.points = 0
  state.insight += outcome.insight + outcome.stakeInsight
  state.insightEarned += outcome.insight + outcome.stakeInsight
  state.loops = 0
  state.explores += 1
  state.seed = outcome.seed
  gatherAcc = 0
  state.gatherProgress = 0
  recompute()
  refreshDisplay()
  saveGame()
  return true
}

/* ------------------------------------------------------------------ 丹炉 */

/** 金丹那一境：结丹的保底灵气和标签页位置都从 REALMS 上取，不在这儿再写一遍 1e30 */
const JINDAN_INDEX = REALMS.findIndex((r) => r.id === 'jindan')
const JIEDAN_FLOOR = REALMS[JINDAN_INDEX].breakThrough as BigNumber

/**
 * 丹炉开张的门槛：累计修来的灵气到过金丹那条保底（1e30）。
 * 看累计不看手上——破境和探索都会把灵气散干净，用余额当门槛等于每一世都要重新攒够一次才让看炉子。
 * 这条线只管**看得见**：金丹那一页摆出来、按秒折点开工。代买不在这里发，
 * 丹炉要结过一层丹（成就「一丹在手」）、转盘要自己转过 50 次（「转过一圈」）才交给系统。
 */
export function pillUnlocked(): boolean {
  return state.totalEarned.gte(JIEDAN_FLOOR) || state.jindan > 0
}

/**
 * 境界标签开到第几境。金丹那一页在**结丹之前**就要摆出来——丹炉是在那一页上买的，
 * 等结完丹才给标签等于让玩家找不到炉子。
 */
export function realmTabDepth(): number {
  return Math.max(state.realmIndex, pillUnlocked() ? JINDAN_INDEX : 0)
}

/** 丹炉那一页的一行报价 */
export interface PillQuote {
  def: PillLineDef
  level: number
  cost: BigNumber
  /** 手里的丹一次能把它往上推几级 */
  maxLevels: number
  /** 下一级还要等多久（秒）：买得起是 0，炉子熄了是 Infinity */
  wait: number
}

/** 定价锚折成转化后的产量：三条线的价都挂在这一个数上 */
function pillFlow(): number {
  return pillFlowLog10(state.pillAnchor)
}

/**
 * 面板念的"下一级还要等多久"该按**期望**算：火候催得快那一截、炸炉吃掉的那一截都要扣进去，
 * 否则狂躁档上写的"3 分"实际要等 5 分。`state.danPerSecond` 是炼成时的速率，不含这两笔。
 */
function danExpectPerSecond(): BigNumber {
  const mode = findPillMode(state.pillMode)
  return state.danPerSecond.mulNumber(mode.yieldMult * (1 - bustChance(mode, state.spirits)))
}

export function pillRows(): PillQuote[] {
  const have = state.dan.log10()
  const rate = danExpectPerSecond().log10()
  const flow = pillFlow()
  return PILL_LINES.map((def) => {
    const level = state.pillLevels[def.id] ?? 0
    return {
      def,
      level,
      cost: BigNumber.fromLog10(pillCostLog10(def, level, flow)),
      maxLevels: pillMaxLevels(def, level, have, flow),
      wait: pillWaitSeconds(def, level, have, rate, flow),
    }
  })
}

/** 参悟丹炉：一次买 1 级或把手上的丹全压在这条上，买得起才扣 */
export function buyPill(id: string, amount: BuyAmount = 1): boolean {
  const def = findPill(id)
  if (!def) return false
  const flow = pillFlow()
  const level = state.pillLevels[id] ?? 0
  const count = amount === 'max' ? pillMaxLevels(def, level, state.dan.log10(), flow) : amount
  if (count < 1) return false
  const cost = BigNumber.fromLog10(pillBulkCostLog10(def, level, count, flow))
  if (!state.dan.gte(cost)) return false
  state.dan = state.dan.sub(cost)
  state.pillLevels[id] = level + count
  recompute()
  refreshDisplay()
  return true
}

/**
 * 一键购买丹炉：每口只挑下一级最便宜的那条。
 * 根骨、鉴宝台那种"五条同一条价目曲线所以摊平"在这儿用不上——三条线的涨幅各是各的（×30 / ×10 / ×3）。
 *
 * **结丹线之前不碰丹房**：它抬的是灵气那条轴，被它抬起来的流量又按平方根把每一格丹炉的价一起抬高，
 * 而它 ×3 的涨价让贪心一口接一口买下去（贪心只看谁便宜，不看谁划算），实测定标档挂满 12 小时：
 * 三条都买停在炉 11，跳过丹房才过线（`sim/pill-check.mjs`）。
 * 炉子一旦过了第 12 级就反过来——门槛已经踩过，多余的丹留着也是留着，丹房那点灵气加成
 * 正好把下一世连本带利加快，所以从这一刻起一键替玩家把它一起添上。
 */
const DAN_BUY_IDS = PILL_LINES.filter((d) => d.kind !== 'qi-add').map((d) => d.id)
const ALL_PILL_IDS = PILL_LINES.map((d) => d.id)

/** 这一刻一键能挑哪几条线：炉子过了结丹线，丹房才进这一口。面板上那颗按钮亮不亮也看这个 */
export function pillBuyIds(): string[] {
  return (state.pillLevels[FURNACE_ID] ?? 0) >= JIEDAN_FURNACE_LEVEL ? ALL_PILL_IDS : DAN_BUY_IDS
}

export function buyAllPill(): boolean {
  const flow = pillFlow()
  let bought = false
  for (let step = 0; step < 1000; step++) {
    let pick = ''
    let price = Infinity
    for (const id of pillBuyIds()) {
      const def = findPill(id)
      if (!def) continue
      const c = pillCostLog10(def, state.pillLevels[id] ?? 0, flow)
      if (c < price) {
        pick = id
        price = c
      }
    }
    if (!pick || state.dan.log10() < price) break
    if (!buyPill(pick, 1)) break
    bought = true
  }
  return bought
}

/**
 * 丹炉代买的门槛：结过一层丹才发（成就「一丹在手」，门槛级数在词条里）。
 * 头一整世——那 12 小时的结丹线、火候怎么选、丹房该不该起——都是玩家自己的活；
 * 代买的贪心只看谁便宜，过早接管会在过线那一刻把丹房一口气堆到三十几级（`sim/jindan-qi.mjs`）。
 * 看的是 `state.jindan`：散功与探索都清不掉它，拨回去也锁不住。
 */
export function autoBuyPillGate(): { unlocked: boolean; earned: number; need: number } {
  return {
    unlocked: state.jindan >= PILL_AUTO_UNLOCK_LAYERS,
    earned: state.jindan,
    need: PILL_AUTO_UNLOCK_LAYERS,
  }
}

/** 开关拨上、成就也到了，主循环才真的代买丹炉——和练气代买同一句式子 */
export function autoBuyPillActive(): boolean {
  return state.settings.autoBuyPill && autoBuyPillGate().unlocked
}

/**
 * 火候。三档是三种「丹换废渣」的汇率，切换不改存档、随时可换（表在词条 `PILL_MODES`）。
 * 面板上摆的是三颗并排的按钮，按下去只换下一炉起走的那条路线。
 */
/** 这一炉的账面：炼成给多少、炸了赔多少、炸炉率几成 */
export interface PillBatchQuote {
  mode: PillModeDef
  /** 这一炉炼成给多少丹 */
  dan: BigNumber
  /** 这一炉炸了赔多少废渣 */
  dreg: BigNumber
  /** 炸炉概率，已扣守一 */
  bust: number
  /** 守一把这一档的炸炉压到地板上了：三档变得一样稳，这话得跟玩家说清楚 */
  floored: boolean
}

/** 火候那一排下面念的一句：这一炉炼成给多少、炸了赔多少、炸炉率如今是多少 */
export function pillBatch(): PillBatchQuote {
  const mode = findPillMode(state.pillMode)
  const bust = bustChance(mode, state.spirits)
  const dan = state.danPerSecond.mulNumber(PILL_PERIOD * mode.yieldMult)
  // 渣按"这一炉该出的丹"折，所以先把 yieldMult 除掉，回到该出丹那一档；
  // 百转成渣、见微知著那两条白给的赔率整体乘在这一笔上
  const dreg = dan.mulNumber((dregYieldMult(mode, state.spirits) * dregBonusMult(activeBonus())) / mode.yieldMult)
  return { mode, dan, dreg, bust, floored: bust <= BUST_FLOOR }
}

/** 换火候。三档随时能换，换的只是下一炉起走哪条路线，不动任何账面 */
export function setPillMode(id: PillModeId): void {
  if (state.pillMode === id) return
  state.pillMode = id
  refreshDisplay()
}

/**
 * 丹药废渣：炸炉折出来的那笔，只用来抽凝练转盘。
 * 转盘的价格按"见过的最高出丹流量"定标（和丹炉同一条路子，反正那条锚只涨不跌），
 * 所以它不需要另设一个锚。
 */
function dregFlow(): number {
  const bonus = activeBonus()
  return pillFlowLog10(state.pillAnchor) + Math.log10(danYieldMult(state.spirits) + danBonusAdd(bonus))
}

/** 抽一次转盘的报价 */
export interface PullQuote {
  /** 下一次要多少废渣 */
  cost: BigNumber
  /** 手上的渣一次能连抽几次 */
  maxCount: number
  /** 已经抽过几次（转盘上的价就是按它往上爬的） */
  pulls: number
}

export function pullQuote(): PullQuote {
  const flow = dregFlow()
  return {
    cost: BigNumber.fromLog10(pullCostLog10(state.pulls, flow)),
    maxCount: pullMaxCount(state.pulls, state.dreg.log10(), flow),
    pulls: state.pulls,
  }
}

/** 七道精神的一行：等级、权重（=转盘上占多大一格）、现在给了多少 */
export interface SpiritQuote {
  def: SpiritDef
  level: number
  /** 这一道在转盘上占的比例 */
  chance: number
  current: string
}

export function spiritRows(): SpiritQuote[] {
  const total = SPIRITS.reduce((a, d) => a + d.weight, 0)
  return SPIRITS.map((def) => ({
    def,
    level: state.spirits[def.id] ?? 0,
    chance: def.weight / total,
    current: spiritCurrent(def, state.spirits[def.id] ?? 0, state.settings.numberFormat),
  }))
}

/**
 * 抽转盘：花废渣、掷一转、把那道精神叠一级。一次点几抽都行，价格按抽数往上爬。
 * 抽满 cap 的那两道（敏手、定息）照样收渣、等级不动——转盘不退货，这条写在 `凝练.ts`。
 * 每一掷都走 state.seed 那条确定性序列（和探索同一口径），所以"看一眼再取消"不存在，
 * 自动化替玩家抽也是同一串结果。
 */
export function pull(count: number | 'max' = 1): SpiritRoll[] {
  if (!pullUnlocked()) return []
  const flow = dregFlow()
  const want = count === 'max' ? pullMaxCount(state.pulls, state.dreg.log10(), flow) : Math.floor(count)
  if (want < 1) return []
  const total = pullBulkCostLog10(want, state.pulls, flow)
  if (!(state.dreg.log10() >= total)) return []
  const hits: SpiritRoll[] = []
  for (let i = 0; i < want; i++) {
    const r = rollSpirit(state.seed, state.spirits)
    state.seed = r.seed
    state.spirits[r.def.id] = r.level
    hits.push(r)
  }
  // 整笔一次扣干净：逐抽扣会因浮点误差差出一枚，而"抽得起最后一抽却扣不上"最难看
  state.dreg = state.dreg.sub(BigNumber.fromLog10(total))
  state.pulls += want
  recompute()
  refreshDisplay()
  return hits
}

/**
 * 代抽的门槛：自己转过这么多次才发（成就「转过一圈」，次数在词条里）。
 * 抽卡价只 ×1.15/次，废渣一有就是连着十几抽停不下来，所以头一圈留给玩家自己转——
 * 七道精神各看过好几遍、知道自己想先喂哪一道，才谈得上让盘子替自己转。
 * 看的是累计抽数 `state.pulls`，结丹与散功都不清它。
 */
export function autoPullGate(): { unlocked: boolean; earned: number; need: number } {
  return {
    unlocked: state.pulls >= PULL_AUTO_UNLOCK_TURNS,
    earned: state.pulls,
    need: PULL_AUTO_UNLOCK_TURNS,
  }
}

/** 开关拨上、成就也到了，主循环才真的代抽 */
export function autoPullActive(): boolean {
  return state.settings.autoBuyPull && autoPullGate().unlocked
}

/** 替玩家把抽得起的都抽掉（主循环每个代买间隔走一次） */
export function autoPull(): boolean {
  if (!autoPullActive()) return false
  if (!(state.dreg.log10() >= pullCostLog10(state.pulls, dregFlow()))) return false
  return pull('max').length > 0
}

/** 转盘开没开张：丹炉一开张，废渣就开始有了，转盘跟着一起摆出来 */
export function pullUnlocked(): boolean {
  return pillUnlocked()
}

/** 一条成就自己那本账：解锁看 `挑战.ts` 的唯一判定，进度照同一笔累计念 */
function achievementGate(id: string): { unlocked: boolean; earned: number; need: number } {
  const def = ACHIEVEMENTS.find((d) => d.id === id)
  if (!def) return { unlocked: false, earned: 0, need: 1 }
  return {
    unlocked: achievementUnlocked(def, counters()),
    earned: achievementEarned(def.metric),
    need: def.need,
  }
}

/**
 * 根骨与鉴宝台的代买各看各的成就，两条门槛彻底分开：
 * 根骨看五条合计等级，鉴宝台看四条合计等级，先满哪条就先放开哪条。
 * 代买只把手上的钱花掉——押探索那一铲、结丹那一下永远还是玩家按的。
 * 鉴宝台这条尤其不会把探索架空：见识只有押了探索才产得出来，系统能花它、产不出它。
 */
export function autoBuyRebirthGate(): { unlocked: boolean; earned: number; need: number } {
  return achievementGate('autoBuyRebirth')
}

export function autoBuyExploreGate(): { unlocked: boolean; earned: number; need: number } {
  return achievementGate('autoBuyExplore')
}

/** 开关拨上、成就也到了，主循环才真的代买 */
export function autoBuyRebirthActive(): boolean {
  return state.settings.autoBuyRebirth && autoBuyRebirthGate().unlocked
}

export function autoBuyExploreTreeActive(): boolean {
  return state.settings.autoBuyExplore && autoBuyExploreGate().unlocked
}

/**
 * 读档后把没解锁的自动化开关拨回关闭。
 * 开关本身存在存档里，旧档或手改的档可能带着"成就没达成却开着"的状态；
 * 这里按同一份成就判定收一遍，保证界面上永远不会出现这种开关。
 */
function syncAutomationSettings(): void {
  if (!autoBuyGate().unlocked) state.settings.autoBuyCultivate = false
  if (!autoBuyPillGate().unlocked) state.settings.autoBuyPill = false
  if (!autoBuyRebirthGate().unlocked) state.settings.autoBuyRebirth = false
  if (!autoBuyExploreGate().unlocked) state.settings.autoBuyExplore = false
  if (!autoPullGate().unlocked) state.settings.autoBuyPull = false
}

/** 结丹的账面：门槛差多少、结成之后产出乘几 */
export function jindanState(): {
  ready: boolean
  furnace: number
  need: number
  floor: BigNumber
  spirit: BigNumber
  mult: number
} {
  const furnace = state.pillLevels[FURNACE_ID] ?? 0
  return {
    ready: furnace >= JIEDAN_FURNACE_LEVEL && state.spirit.gte(JIEDAN_FLOOR),
    furnace,
    need: JIEDAN_FURNACE_LEVEL,
    floor: JIEDAN_FLOOR,
    spirit: state.spirit,
    mult: jindanReturnMult(state.jindan + 1),
  }
}

/**
 * 结丹那张字据摆到哪一笔账上就不再问第二遍。看的是**已结成的层数**——
 * 第一层要散掉整世攒来的灵气，玩家得先看一眼代价；结成过一层就知道这一笔怎么算，之后点一下就结。
 * 层数只涨不跌（探索、破境都不散它），所以不会出现"清了一趟又要重新问"。
 */
export function needJindanConfirm(): boolean {
  return state.jindan < 1
}

/** 结丹那张字据 */
export interface JindanPreview {
  /** 结成之后是第几层 */
  layer: number
  furnace: number
  /** 散去的那笔灵气 */
  spirit: BigNumber
  /** 本世将清空的法门，只列出已有等级的 */
  wiped: { def: UpgradeDef; level: number }[]
  /** 下一世的灵气产出乘这个倍率 */
  mult: number
  /** 结成这一层另给的见识：底数 1 点，识海每 5 级再添 1 点 */
  insightGain: number
}

export function previewJindan(): JindanPreview | null {
  const g = jindanState()
  if (!g.ready) return null
  const wiped = REALMS[CULTIVATE_INDEX].upgrades
    .map((def) => ({ def, level: state.levels[def.id] ?? 0 }))
    .filter((row) => row.level > 0)
  return {
    layer: state.jindan + 1,
    furnace: g.furnace,
    spirit: state.spirit.clone(),
    wiped,
    mult: g.mult,
    insightGain: jindanInsightPerLayer(state.jindanTree),
  }
}

/**
 * 结丹：散掉的还是**修行那一层**——法门与手上灵气清零，根骨、法宝、鉴宝台、丹和三条线都跟着走。
 * 手上那笔灵气是硬代价：攒够 1e30 存量才结得成，这一世就一分也花不到别处去。
 * 累计灵气不清零，所以按秒折给那条进项（`pointPassPerSecond`）跨得过结丹。
 * 每结一层另给一笔见识——底数 1 点，识海那一枝再往上添，让见识不必只靠押探索。
 * 自动化不碰这里（和破境同一条规矩），这颗按钮永远由玩家按。
 */
export function jindanBreak(): boolean {
  const p = previewJindan()
  if (!p) return false
  state.levels = {}
  state.spirit = BigNumber.zero()
  state.loopEarned = BigNumber.zero()
  state.jindan = p.layer
  state.insight += p.insightGain
  state.insightEarned += p.insightGain
  state.realmIndex = Math.max(state.realmIndex, JINDAN_INDEX)
  gatherAcc = 0
  state.gatherProgress = 0
  recompute()
  refreshDisplay()
  saveGame()
  return true
}

/** 结丹与结丹里程碑一共发过多少丹纹点；层数与里程碑都只涨不跌，所以可以随时回算 */
export function jindanTreeEarned(): number {
  let earned = state.jindan * JINDAN_TREE_PER_LAYER
  for (const def of JINDAN_MILESTONES) {
    if (state.jindan >= def.layer) earned += def.marks ?? 0
  }
  return earned
}

/** 已经点在四枝上的丹纹点 */
export function jindanTreeSpent(): number {
  return treeSpent(state.jindanTree)
}

/** 手上还剩多少丹纹点。和筑基点一样，先算累计再减花掉，不另存一栏 */
export function jindanTreePoints(): number {
  return Math.max(0, Math.floor(jindanTreeEarned() - jindanTreeSpent()))
}

export interface JindanTreeRow {
  def: JindanTreeDef
  level: number
  cost: number
  current: string
  next: string
  maxed: boolean
  affordable: boolean
}

/** 一枝当前/下一级念成大白话；识海要把"还差几级跳一档"写出来，否则点一级看不出变化 */
function treeEffectText(def: JindanTreeDef, level: number): string {
  if (def.kind === 'insight-add') {
    const perLayer = JINDAN_TREE_PER_LAYER + Math.floor(level * def.power)
    if (level >= def.cap) return `每层结丹共攒 ${perLayer} 点见识`
    const step = Math.max(1, Math.round(1 / def.power))
    return `每层结丹攒 ${perLayer} 点，再 ${step - (level % step)} 级多 1 点`
  }
  if (level <= 0) return '尚未参悟'
  if (def.kind === 'dreg-add') return `废渣 +${Math.round(def.power * level * 100)}%`
  if (def.kind === 'energy-add') return `灵气产出 +${Math.round(def.power * level * 100)}%`
  return `出丹 +${Math.round(def.power * level * 100)}%`
}

/** 丹纹四枝的行：价钱、当前效果、下一级效果都在这里算好，界面只负责摆 */
export function jindanTreeRows(): JindanTreeRow[] {
  const points = jindanTreePoints()
  return JINDAN_TREE.map((def) => {
    const level = Math.min(def.cap, Math.max(0, Math.floor(state.jindanTree[def.id] ?? 0)))
    const maxed = level >= def.cap
    const cost = maxed ? 0 : jindanTreeCost(level)
    return {
      def,
      level,
      cost,
      current: treeEffectText(def, level),
      next: maxed ? '已点满' : treeEffectText(def, level + 1),
      maxed,
      affordable: !maxed && points >= cost,
    }
  })
}

/**
 * 点一级丹纹。点数只从结丹与里程碑来，所以这里没有"买多少级"的档位，
 * 也没有自动化——先升哪一枝就是这一层唯一的策略，交给系统代点等于把玩法删掉。
 */
export function buyJindanTree(id: string): boolean {
  const def = findJindanTree(id)
  if (!def) return false
  const level = Math.min(def.cap, Math.max(0, Math.floor(state.jindanTree[id] ?? 0)))
  if (level >= def.cap) return false
  const cost = jindanTreeCost(level)
  if (jindanTreePoints() < cost) return false
  state.jindanTree[id] = level + 1
  recompute()
  refreshDisplay()
  return true
}

/**
 * 测试用的一键补灵气：把灵气灌到下一个破境线（没有可破的境界就翻一千倍）。
 * 只为跳过挂机去看后面的界面，正式玩法用不上。
 */
export function devFillSpirit(): void {
  const next = realmToBreakThrough()?.realm
  const target = next?.breakThrough ?? state.spirit.mulNumber(1000)
  if (target.gt(state.spirit)) earn(target.sub(state.spirit))
  recompute()
  refreshDisplay()
}

/** 测试页用：按填进去的数字灌一笔灵气，不走破境线 */
export function devAddSpirit(n: number): void {
  if (!(n > 0)) return
  earn(new BigNumber(n, 0))
  recompute()
  refreshDisplay()
}

/** 测试页用：白给筑基点，用来验转生树各档买满后的数值 */
export function devAddPoints(n = 100): void {
  state.points += n
  // 累计那一栏也得跟着涨：成就和探索的门槛看的是累计，只加手上会白给一趟
  state.pointsEarned += n
  refreshDisplay()
}

/** 测试用：白给见识，用来验鉴宝台各档买满后的数值 */
export function devAddInsight(n = 100): void {
  state.insight += n
  // 和筑基点同一个道理：成就看累计，只加手上就白给一趟
  state.insightEarned += n
  refreshDisplay()
}

/**
 * 测试用：白给废渣，用来验凝练转盘那七道精神各档抽满后的效果。
 * 和给丹同一个道理，顺手把标签开到金丹，不然灌了也没处花。
 */
export function devAddDreg(n = 100): void {
  if (!(n > 0)) return
  state.dreg = state.dreg.add(new BigNumber(n, 0))
  state.realmIndex = Math.max(state.realmIndex, JINDAN_INDEX)
  refreshDisplay()
}

/**
 * 测试用：白给丹，用来验丹炉三条线各档买满后的墙。
 * 只进丹炉页才看得到的那条货币，所以顺手把标签也开到金丹，不然灌了也没处花。
 */
export function devAddDan(n = 100): void {
  if (!(n > 0)) return
  state.dan = state.dan.add(new BigNumber(n, 0))
  state.realmIndex = Math.max(state.realmIndex, JINDAN_INDEX)
  refreshDisplay()
}

/**
 * 存档码写成**定长数组**，键名一个都不落：位置就是字段名。摊平后转 base64，
 * 浏览器本地存的那份和导出给玩家的那份是同一个东西。
 *
 *   [0] 版本 · [1] 灵气 [2] 累计灵气 [3] 本世灵气（大数都是 [尾数, 指数]）
 *   [4] 境界标签 [5] 世数 [6] 手上筑基点 [7] 累计筑基点 [8] 探索次数 [9] 见识
 *   [10] 种子 [11] 吐纳次数 [12] 修行时长（秒，两位小数）[13] 保存时刻
 *   [14] 法门等级 [15] 根骨等级 [16] 法宝层数 [17] 鉴宝台等级（都按各自词条表的顺序摆）
 *   [18] 偏好位标（自动保存 1、法门代买 2、丹炉代买 4、根骨代买 8、鉴宝台代买 16、转盘代抽 32）
 *   [19] 保存间隔下标 [20] 记法下标 [21] 全局速度下标
 *   [22] 累计见识 [23] 丹存量 [24] 结丹层数 [25] 定价锚（灵气/秒的 log10）[26] 丹炉三条线等级
 *   [27] 筑基点零头（按秒折算攒下的那不足 1 点，四位小数）
 *   [28] 废渣存量 [29] 抽过的次数 [30] 七道丹道精神等级 [31] 火候档位下标
 *   [32] 丹纹四枝等级（按 JINDAN_TREE 的顺序摆）
 *
 * 键名占掉快一半长度，所以新字段**只往后加、别插队**——位置就是格式，插中间等于把所有存档读坏。
 *
 * v14 没有加字段，只做一次偏好迁移：v13 及更早的档读进来时把五颗自动化开关全部归零。
 * v15 再收一次口：v14 及更早一律全关——v14 曾短暂存在过"根骨/鉴宝台拆开但读档还没收开关"的档，
 * 玩家手里可能已经导出过那种码，所以再给一版一次性归零；自动保存那一位照旧保留。
 * v16 加丹纹四枝 [32]；点数不存（按结丹层数与里程碑现算），老档读进来四枝全空。
 */
const SAVE_VERSION = 16

/** 读档用的键控结构：定长数组解出来就是这个形状 */
interface SaveData {
  v: number
  spirit: [number, number]
  totalEarned: [number, number]
  loopEarned: [number, number]
  realmIndex: number
  loops: number
  levels: Record<string, number>
  points: number
  pointsEarned: number
  /** 按秒折算攒下的不足 1 点的零头。老存档没这一栏，读进来当 0，最多损失一点入账时间 */
  loopBanked: number
  rebirth: Record<string, number>
  treasures: Record<string, number>
  explores: number
  insight: number
  insightEarned: number
  exploreLevels: Record<string, number>
  dan: [number, number]
  pillLevels: Record<string, number>
  /** 火候：三档里挑的哪一档。老存档没这一栏，读进来按起手那档（常态）算 */
  pillMode: PillModeId
  /** 丹药废渣（凝练转盘的门票） */
  dreg: [number, number]
  spirits: Record<string, number>
  /** 抽过的次数：抽卡价按它往上爬，所以它必须存 */
  pulls: number
  jindan: number
  /** 丹纹四枝的等级：只存等级，点数由结丹层数与里程碑现算 */
  jindanTree: Record<string, number>
  /** 定价锚：见过的最高灵气/秒。老存档没这一栏，读进来由 recompute() 按当前流量补 */
  pillAnchor: number
  seed: number
  totalGathers: number
  totalTime: number
  settings: Settings
  savedAt: number
}

/** 只取 m/e 两个字段，避开 reactive 代理后丢失类方法的问题 */
function toParts(n: { m: number; e: number }): [number, number] {
  return [n.m, n.e]
}

function fromParts(p: [number, number] | undefined): BigNumber {
  return p ? new BigNumber(p[0], p[1]) : BigNumber.zero()
}

/** 境界标签只可能是 0..REALMS.length-1；越界一律夹回两端 */
function realmIndexOf(d: Partial<SaveData>): number {
  return Math.min(Math.max(Math.floor(d.realmIndex ?? 0), 0), REALMS.length - 1)
}

/**
 * 等级栏按词条表下标摆，尾部的 0 全砍掉——没人买过的表就是空数组。
 * 读的时候只认表里存在的下标，多出来的位置（新版本往表头加了东西）直接丢。
 */
function encodeLevels(defs: { id: string }[], levels: Record<string, number>): number[] {
  const out = defs.map((def) => Math.floor(levels[def.id] ?? 0))
  while (out.length > 0 && out[out.length - 1] === 0) out.pop()
  return out
}

function decodeLevels(
  defs: { id: string; cap?: number }[],
  raw: unknown,
): Record<string, number> {
  const levels: Record<string, number> = {}
  if (!Array.isArray(raw)) return levels
  for (let i = 0; i < raw.length; i++) {
    const def = defs[i]
    if (!def) break
    const lv = Math.floor(Number(raw[i]))
    if (lv > 0) levels[def.id] = Math.min(lv, def.cap ?? LEVEL_CEILING)
  }
  return levels
}

/** 当前进度摊成一份存档对象。落盘、下载、复制都走这里，别写三遍字段 */
function snapshot(): SaveData {
  return {
    v: SAVE_VERSION,
    spirit: toParts(state.spirit),
    totalEarned: toParts(state.totalEarned),
    loopEarned: toParts(state.loopEarned),
    realmIndex: state.realmIndex,
    loops: state.loops,
    levels: { ...state.levels },
    points: state.points,
    pointsEarned: state.pointsEarned,
    loopBanked: state.loopBanked,
    rebirth: { ...state.rebirth },
    treasures: { ...state.treasures },
    explores: state.explores,
    insight: state.insight,
    insightEarned: state.insightEarned,
    exploreLevels: { ...state.exploreLevels },
    dan: toParts(state.dan),
    pillLevels: { ...state.pillLevels },
    pillMode: state.pillMode,
    dreg: toParts(state.dreg),
    spirits: { ...state.spirits },
    pulls: state.pulls,
    jindan: state.jindan,
    jindanTree: { ...state.jindanTree },
    pillAnchor: state.pillAnchor,
    seed: state.seed,
    totalGathers: state.totalGathers,
    totalTime: state.totalTime,
    settings: { ...state.settings },
    savedAt: Date.now(),
  }
}

/** 存档对象摊成定长数组：位置就是字段名，键名一个都不写 */
function toCode(d: SaveData): (number | number[])[] {
  const flags =
    (d.settings.autoSave ? 1 : 0) |
    (d.settings.autoBuyCultivate ? 2 : 0) |
    (d.settings.autoBuyPill ? 4 : 0) |
    (d.settings.autoBuyRebirth ? 8 : 0) |
    (d.settings.autoBuyExplore ? 16 : 0) |
    (d.settings.autoBuyPull ? 32 : 0)
  return [
    d.v,
    d.spirit,
    d.totalEarned,
    d.loopEarned,
    d.realmIndex,
    d.loops,
    d.points,
    d.pointsEarned,
    d.explores,
    d.insight,
    d.seed,
    d.totalGathers,
    Math.round(d.totalTime * 100) / 100,
    d.savedAt,
    encodeLevels(ALL_UPGRADES, d.levels),
    encodeLevels(REBIRTH_TREE, d.rebirth),
    encodeLevels(TREASURES, d.treasures),
    encodeLevels(EXPLORE_TREE, d.exploreLevels),
    flags,
    SAVE_INTERVALS.indexOf(d.settings.autoSaveEvery),
    NUMBER_FORMATS.indexOf(d.settings.numberFormat),
    GLOBAL_SPEEDS.indexOf(d.settings.globalSpeed),
    d.insightEarned,
    d.dan,
    d.jindan,
    Math.round(d.pillAnchor * 1e4) / 1e4,
    encodeLevels(PILL_LINES, d.pillLevels),
    Math.round(d.loopBanked * 1e4) / 1e4,
    d.dreg,
    d.pulls,
    encodeLevels(SPIRITS, d.spirits),
    PILL_MODES.findIndex((m) => m.id === d.pillMode),
    encodeLevels(JINDAN_TREE, d.jindanTree),
  ]
}

/** 下标越界（改了档位表顺序的老存档码）就回到默认档 */
function at<T>(table: readonly T[], index: unknown, fallback: T): T {
  const i = Math.floor(Number(index))
  return i >= 0 && i < table.length ? table[i] : fallback
}

/** 定长数组收回存档对象。缺位的字段一律按"没有"处理，不接受 NaN */
function fromCode(a: unknown[]): Partial<SaveData> {
  const v = Math.floor(Number(a[0]))
  const rawFlags = Math.floor(Number(a[18])) || 0
  // v15 起五颗自动化开关重新默认关闭：保留自动保存那一位，其余全抹掉
  const flags = v >= 15 ? rawFlags : rawFlags & ~(2 | 4 | 8 | 16 | 32)
  return {
    v,
    spirit: a[1] as [number, number],
    totalEarned: a[2] as [number, number],
    loopEarned: a[3] as [number, number],
    realmIndex: Math.floor(Number(a[4])) || 0,
    loops: Math.max(0, Math.floor(Number(a[5])) || 0),
    points: Math.max(0, Math.floor(Number(a[6])) || 0),
    pointsEarned: Math.max(0, Math.floor(Number(a[7])) || 0),
    loopBanked: Math.max(0, Math.min(1, Number(a[27]) || 0)),
    explores: Math.max(0, Math.floor(Number(a[8])) || 0),
    insight: Math.max(0, Math.floor(Number(a[9])) || 0),
    insightEarned: Math.max(0, Math.floor(Number(a[22])) || 0),
    dan: a[23] as [number, number],
    jindan: Math.max(0, Math.floor(Number(a[24])) || 0),
    jindanTree: decodeLevels(JINDAN_TREE, a[32]),
    pillAnchor: Math.max(0, Number(a[25]) || 0),
    pillLevels: decodeLevels(PILL_LINES, a[26]),
    dreg: a[28] as [number, number],
    pulls: Math.max(0, Math.floor(Number(a[29])) || 0),
    spirits: decodeLevels(SPIRITS, a[30]),
    pillMode: at(PILL_MODES, a[31], PILL_MODES[1]).id,
    seed: Math.floor(Number(a[10])) || 0,
    totalGathers: Math.max(0, Math.floor(Number(a[11])) || 0),
    totalTime: Math.max(0, Number(a[12]) || 0),
    savedAt: Math.max(0, Number(a[13]) || 0),
    levels: decodeLevels(ALL_UPGRADES, a[14]),
    rebirth: decodeLevels(REBIRTH_TREE, a[15]),
    treasures: decodeLevels(TREASURES, a[16]),
    exploreLevels: decodeLevels(EXPLORE_TREE, a[17]),
    settings: {
      autoSave: (flags & 1) !== 0,
      autoBuyCultivate: (flags & 2) !== 0,
      autoBuyPill: (flags & 4) !== 0,
      autoBuyRebirth: (flags & 8) !== 0,
      autoBuyExplore: (flags & 16) !== 0,
      autoBuyPull: (flags & 32) !== 0,
      autoSaveEvery: at<SaveInterval>(SAVE_INTERVALS, a[19], 10),
      numberFormat: at<NumberStyle>(NUMBER_FORMATS, a[20], 'letter'),
      globalSpeed: at<GlobalSpeed>(GLOBAL_SPEEDS, a[21], 1),
    },
  }
}

/** 一份存档摊平成存档码文本（定长数组 + base64），本地和导出用同一个形状 */
function encodeSave(d: SaveData): string {
  return toBase64(JSON.stringify(toCode(d)))
}

export function saveGame(): void {
  const data = snapshot()
  try {
    localStorage.setItem(SAVE_KEY, encodeSave(data))
    state.savedAt = data.savedAt
    hasSave.value = true
  } catch {
    // 无痕模式或配额已满时放弃写入，不打断修行
  }
}

/** 一份存档写回 state。每一栏都过一遍 clamp，所以只可能拒收、不可能写坏 */
function applySave(d: Partial<SaveData>): boolean {
  if (!d.v || !Array.isArray(d.spirit)) return false
  state.spirit = fromParts(d.spirit)
  state.totalEarned = fromParts(d.totalEarned)
  state.loopEarned = fromParts(d.loopEarned)
  state.levels = d.levels ?? {}
  state.rebirth = d.rebirth ?? {}
  state.treasures = d.treasures ?? {}
  state.explores = d.explores ?? 0
  state.insight = d.insight ?? 0
  // 老存档没有这一栏，按"手上还剩的见识"兜底：不可能比余额更少，宁可多认一点成就进度也不把它锁回去
  state.insightEarned = Math.max(d.insightEarned ?? 0, state.insight)
  state.exploreLevels = d.exploreLevels ?? {}
  state.dan = fromParts(d.dan)
  state.pillLevels = d.pillLevels ?? {}
  state.dreg = fromParts(d.dreg)
  state.spirits = d.spirits ?? {}
  state.pulls = Math.max(0, Math.floor(d.pulls ?? 0))
  state.pillMode = d.pillMode ?? DEFAULT_PILL_MODE
  state.jindan = Math.max(0, Math.floor(d.jindan ?? 0))
  // 四枝等级按现算的点数收口：花掉的比挣到的多，只可能是改过的档，整棵清空
  state.jindanTree = d.jindanTree ?? {}
  if (treeSpent(state.jindanTree) > jindanTreeEarned()) state.jindanTree = {}
  // 定价锚取"存档里的"和"当前流量"的较大者：老存档没这一栏，读档那次 recompute 会把它补上
  state.pillAnchor = Math.max(0, d.pillAnchor ?? 0)
  // 种子是 0 就重开一串，别让 xorshift 卡在不动的零上
  state.seed = d.seed || freshSeed()
  state.points = d.points ?? 0
  // 累计筑基点不可能少于手上的：成就判定不能被一个改过的存档绕过下限
  state.pointsEarned = Math.max(d.pointsEarned ?? 0, state.points)
  state.loopBanked = d.loopBanked ?? 0
  state.realmIndex = realmIndexOf(d)
  state.loops = d.loops ?? 0
  state.totalGathers = d.totalGathers ?? 0
  state.totalTime = d.totalTime ?? 0
  if (d.settings) state.settings = d.settings
  state.savedAt = d.savedAt ?? 0
  // 读档那一刻把墙钟起点挪到"现在"：贴进来的存档里那个时间戳是别人家的闭关，
  // 不能顺手当成离线收益发给玩家。真正该补的那一段由 bootGameLoop 自己认。
  lastReal = Date.now()
  gatherAcc = 0
  state.gatherProgress = 0
  danAcc = 0
  state.pillProgress = 0
  recompute()
  // 门槛没到的自动化开关一律关掉：旧档读进来不该自己跑起来
  syncAutomationSettings()
  // 换了一份进度，比对基准要跟着换：这份档里早就达成的成就别再报一遍
  reseedAchievements()
  refreshDisplay()
  hasSave.value = true
  return true
}

/**
 * 存档文本先转成 base64 再交给玩家：整段只剩字母和数字，
 * 聊天框、剪贴板、记事本都不会把大括号或引号吃掉，也不会被自动纠错改成别字。
 * 这只是编码不是加密——想保护内容得另说，眼下要的是"抄得走、贴得回"。
 */
function toBase64(text: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** 解不开就不是存档码，返回 null 交给上层去拒收 */
function fromBase64(code: string): string | null {
  try {
    const binary = atob(code)
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
  } catch {
    return null
  }
}

function parseSave(raw: string): Partial<SaveData> | null {
  const text = raw.trim()
  if (!text) return null
  // 存档码按 76 字符换行存成文件也认；手抖贴了裸数组也照收
  const json = text.startsWith('[') ? text : fromBase64(text.replace(/\s+/g, ''))
  if (!json) return null
  try {
    const code = JSON.parse(json)
    return Array.isArray(code) ? fromCode(code) : null
  } catch {
    return null
  }
}

export function loadGame(): boolean {
  let raw: string | null = null
  let salvage: string | null = null
  try {
    raw = localStorage.getItem(SAVE_KEY)
    if (raw === null) raw = salvage = localStorage.getItem(SALVAGE_KEY)
  } catch {
    return false
  }
  if (!raw) return false
  const d = parseSave(raw)
  if (!d || !applySave(d)) return false
  if (salvage !== null) localStorage.removeItem(SALVAGE_KEY)
  return true
}

/** 存档码：把当前进度摊成定长数组，再转成一串 base64，可以复制走也可以落地成文件 */
export function exportSave(): string {
  return encodeSave(snapshot())
}

/**
 * 外部存档先摊开给玩家看一眼再决定盖不盖：认不出来返回 null。
 * 只读文本、不碰 state，所以"看一眼再取消"真的不会动进度。
 * 念的三样是拍死的：**灵气数量、最后保存时间、游玩时间**——这三笔才分得出"哪份是我要的那一档"，
 * 第几世、筑基点那些换了档也不心疼，摆在眼前只会挤掉真正要看的信息。
 */
export function describeSave(raw: string): string | null {
  const d = parseSave(raw)
  if (!d || !d.v || !Array.isArray(d.spirit)) return null
  const spirit = fmt(fromParts(d.spirit))
  return `灵气 ${spirit} · 保存于 ${savedAtText(Number(d.savedAt) || 0)} · 游玩 ${clockText(Number(d.totalTime) || 0)}`
}

/** 存档里那个毫秒时间戳念成"哪天几点"；老档没这一笔就实话实说 */
function savedAtText(ms: number): string {
  if (!ms) return '未记时'
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 游玩时间和顶栏同一个钟：时:分:秒，小时位不限两位 */
function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

/**
 * 吃一份外部存档文本（剪贴板或文件）。认不出来就返回 false，当前进度一点都不动。
 * 成功后立刻落盘——导入的是玩家的家当，别让下一次自动保存之前崩掉就没了。
 */
export function importSave(raw: string): boolean {
  const d = parseSave(raw)
  if (!d || !applySave(d)) return false
  saveGame()
  return true
}

/**
 * 格式化数据：抹掉本地存档，修行进度打回开局。
 * 设置项（自动保存、记法、全局速度）留着——那是玩家的偏好，不是这一世的修为。
 */
export function resetGame(): void {
  const settings = { ...state.settings }
  try {
    localStorage.removeItem(SAVE_KEY)
    localStorage.removeItem(SALVAGE_KEY)
  } catch {
    // 无痕模式里本来就没存档，内存清干净照样算格式化成功
  }
  Object.assign(state, freshState(), { settings })
  gatherAcc = 0
  danAcc = 0
  lastReal = Date.now()
  offlineReport.value = null
  recompute()
  // 格式化把进度退回开局，已达成的成就也一并退回未达成，比对基准跟着清空
  reseedAchievements()
  refreshDisplay()
  hasSave.value = false
}

let lastTick = performance.now()
let rafId = 0
let autoSaveTimer = 0
/** 本次吐纳已走的秒数，满 state.gatherSeconds 结算一次 */
let gatherAcc = 0
/** 本次炼丹已走的秒数，满 PILL_PERIOD 结算一次丹 */
let danAcc = 0
/** 本次折算已走的秒数，满 POINT_PERIOD 落一次筑基点 */
let pointAcc = POINT_PERIOD
/** 自动购买攒下的游戏时间。敏手会把这个间隔除短，除到底见 AUTO_BUY_MIN_INTERVAL */
const AUTO_BUY_INTERVAL = 0.2
let autoBuyAcc = AUTO_BUY_INTERVAL
let pillBuyAcc = AUTO_BUY_INTERVAL
let treeBuyAcc = AUTO_BUY_INTERVAL
let benchBuyAcc = AUTO_BUY_INTERVAL
let pullBuyAcc = AUTO_BUY_INTERVAL

/** 敏手代买更快（词条 `SPIRITS` 里那条 auto-cut）。四颗代买共用同一个间隔，只改这一个口子 */
function buyStep(): number {
  return autoBuyInterval(state.spirits, AUTO_BUY_INTERVAL)
}

/**
 * 丹一炉一炉结算：每 PILL_PERIOD 秒出一炉，每一炉按火候的炸炉概率掷一次。
 * 炸了那一炉的丹一分不得，改按「这一炉该出的丹」折成废渣（词条 `PILL_MODES` 的 dregMult）。
 * 丹炉没开张就一炉不炼——省得攒出一炉没人看得见的丹，也把"解锁那一刻补一大笔"这条路堵掉。
 */
function settlePillBatches(cycles: number): void {
  const mode = findPillMode(state.pillMode)
  const bust = bustChance(mode, state.spirits)
  // 先只掷概率：绝大多数帧都是"没炸"，那一段乘法一次做完，炸了才逐炉走 BigNumber
  let busts = 0
  for (let i = 0; i < cycles; i++) {
    let roll: number
    ;[roll, state.seed] = nextRoll(state.seed)
    if (roll < bust) busts += 1
  }
  const ok = cycles - busts
  if (ok > 0) state.dan = state.dan.add(state.danPerSecond.mulNumber(ok * PILL_PERIOD * mode.yieldMult))
  if (busts > 0)
    state.dreg = state.dreg.add(
      state.danPerSecond.mulNumber(
        PILL_PERIOD * dregYieldMult(mode, state.spirits) * dregBonusMult(activeBonus()) * busts,
      ),
    )
}
/** 上一次结过账的墙钟时刻（毫秒）。闭关那一段就是从这里数到"现在" */
let lastReal = Date.now()

/** 一段闭关补进来的进项：「出关」字据念的就是这几个数 */
export interface OfflineReport {
  /** 这一段闭关的墙钟秒数：封顶 `OFFLINE_CAP_SECONDS`，**不吃全局速度**（那是测试用的测速档） */
  seconds: number
  /** 吐纳进来的灵气 */
  qi: BigNumber
  /** 吐纳了几次 */
  gathers: number
  /** 开了几炉（炸掉的也算） */
  batches: number
  /** 炼成的丹 */
  dan: BigNumber
  /** 炸出来的废渣 */
  dreg: BigNumber
  /** 按秒折进来的筑基点 */
  points: number
}

/** 闭关进项。非空就摆那张「出关」字据，玩家点掉它 */
export const offlineReport = ref<OfflineReport | null>(null)

/**
 * 离线补账：只补产出，**代买一栏都不跑**（不碰等级、不花钱、不结丹不探索），
 * 也不加游玩时间——顶栏那个数是"人在这儿修行了多久"，挂着不管的时辰不该记在它头上。
 * 走的仍是主循环那三笔账：吐纳按整周期结算、会心照旧一颗一颗掷，
 * 丹一炉一炉炼，筑基点按秒折。所以离线挂机跟"一倍速在线挂着"等价，只差代买——
 * 传进来的秒数就是墙钟秒数，测速档不掺和（见 `settleAwayGap`）。
 */
export function settleOffline(seconds: number): OfflineReport {
  const rep: OfflineReport = {
    seconds: Math.max(0, seconds),
    qi: BigNumber.zero(),
    gathers: 0,
    batches: 0,
    dan: BigNumber.zero(),
    dreg: BigNumber.zero(),
    points: 0,
  }
  if (!(rep.seconds > 0)) return rep

  const period = state.gatherSeconds
  const cycles = Math.floor((gatherAcc += rep.seconds) / period)
  if (cycles > 0) {
    gatherAcc -= cycles * period
    let crits = 0
    const chance = state.gatherCritChance
    if (chance > 0) {
      for (let i = 0; i < cycles; i++) {
        let roll: number
        ;[roll, state.seed] = nextRoll(state.seed)
        if (roll < chance) crits += 1
      }
    }
    const gain = state.spiritPerGather
      .mulNumber(cycles - crits)
      .add(state.spiritPerGather.mulNumber(crits * GATHER_CRIT_MULT))
    earn(gain)
    state.totalGathers += cycles
    rep.qi = gain
    rep.gathers = cycles
  }
  state.gatherProgress = gatherAcc / period

  // 丹炉没开张就一炉不炼，跟在线那条规矩一样：不攒没人看得见的丹
  if (pillUnlocked()) {
    const batches = Math.floor((danAcc += rep.seconds) / PILL_PERIOD)
    if (batches > 0) {
      danAcc -= batches * PILL_PERIOD
      const danBefore = state.dan.clone()
      const dregBefore = state.dreg.clone()
      settlePillBatches(batches)
      rep.batches = batches
      rep.dan = state.dan.sub(danBefore)
      rep.dreg = state.dreg.sub(dregBefore)
    }
    state.pillProgress = danAcc / PILL_PERIOD
  }

  if (pointPassActive()) {
    pointAcc += rep.seconds
    if (pointAcc >= POINT_PERIOD) {
      rep.points = settlePointPass(pointAcc)
      pointAcc = 0
    }
  }
  return rep
}

/** 两笔进项并成一张字据：闭关期间又空出一段，接着念，不另开一张 */
function mergeOffline(base: OfflineReport, add: OfflineReport): OfflineReport {
  return {
    seconds: base.seconds + add.seconds,
    qi: base.qi.add(add.qi),
    gathers: base.gathers + add.gathers,
    batches: base.batches + add.batches,
    dan: base.dan.add(add.dan),
    dreg: base.dreg.add(add.dreg),
    points: base.points + add.points,
  }
}

/**
 * 墙钟空档该折成多少秒闭关：先扣掉这一帧已经按在线走过的，再封顶。
 * 两头共用同一个起点，所以那一段既不会被算两遍、也不会被漏掉。
 */
export function offlineIdleSeconds(awaySeconds: number, creditedSeconds: number): number {
  return Math.min(Math.max(awaySeconds - creditedSeconds, 0), OFFLINE_CAP_SECONDS)
}

/**
 * 把一段墙钟空档结掉：先扣掉这一帧已按在线走过的，再封顶，剩下的整段折成离线产出。
 * **离线不吃全局速度**——那一档是给测试加速用的，只该放大"人在这儿"的那几帧；
 * 闭关要是也跟着翻，测速档拧到 100 就能把 8 小时的顶变成三天，字据上的数也没法看。
 * 闭关不满一秒不值得走一遍结算，满不了一张字据也不去打扰玩家。返回真正补上的秒数。
 */
export function settleAwayGap(awaySeconds: number, creditedSeconds: number): number {
  const idle = offlineIdleSeconds(awaySeconds, creditedSeconds)
  if (idle < 1) return 0
  const rep = settleOffline(idle)
  if (rep.seconds >= OFFLINE_REPORT_SECONDS) {
    const kept = offlineReport.value
    offlineReport.value = kept ? mergeOffline(kept, rep) : rep
  }
  return idle
}

/**
 * 每一帧对一次墙钟。返回"这一帧补过账"，让主循环立刻把数字换新，不用等下一次展示节拍。
 */
function absorbAwayGap(credited: number): boolean {
  const now = Date.now()
  const settled = settleAwayGap((now - lastReal) / 1000, credited)
  lastReal = now
  return settled > 0
}

/** 主循环：在线那一帧走满 `ONLINE_FRAME_MAX_SECONDS` 就到此为止，多出来的空档改走离线结算 */
function tick(now: number): void {
  // 真实帧长先夹住（再长的空档不算"在线"，交给闭关那一段），再乘全局速度——
  // 加速只作用在游戏时间轴上，现实里的掉帧不会被放大成几十倍
  const real = Math.min((now - lastTick) / 1000, ONLINE_FRAME_MAX_SECONDS)
  lastTick = now
  const dt = real * state.settings.globalSpeed

  if (state.phase === 'playing' && dt > 0) {
    state.totalTime += dt
    const period = state.gatherSeconds
    const cycles = Math.floor((gatherAcc += dt) / period)
    if (cycles > 0) {
      gatherAcc -= cycles * period
      // 紫金葫芦的会心按次数逐次掷，同一串种子重放得出同一个结果
      let crits = 0
      const chance = state.gatherCritChance
      if (chance > 0) {
        for (let i = 0; i < cycles; i++) {
          let roll: number
          ;[roll, state.seed] = nextRoll(state.seed)
          if (roll < chance) crits += 1
        }
      }
      const gain = state.spiritPerGather
        .mulNumber(cycles - crits)
        .add(state.spiritPerGather.mulNumber(crits * GATHER_CRIT_MULT))
      earn(gain)
      state.totalGathers += cycles
    }
    state.gatherProgress = gatherAcc / period
    // 丹按出丹速率一炉一炉结算，独立于吐纳那一格。丹炉没开张就一炉不炼，
    // 免得攒出一炉子没人看得见的丹，也把"解锁那一刻补一大笔"这条路堵掉
    if (pillUnlocked()) {
      const cycles = Math.floor((danAcc += dt) / PILL_PERIOD)
      if (cycles > 0) {
        danAcc -= cycles * PILL_PERIOD
        settlePillBatches(cycles)
      }
      state.pillProgress = danAcc / PILL_PERIOD
    } else {
      danAcc = 0
      state.pillProgress = 0
    }
    // 金丹之后破境那颗按钮撤了，破境过去该给的那笔筑基点改按秒折进来。
    // 基数读的是累计灵气，跟点数本身无关，所以这条进项不会利滚利
    if (pointPassActive()) {
      pointAcc += dt
      if (pointAcc >= POINT_PERIOD) {
        if (settlePointPass(pointAcc)) refreshDisplay()
        pointAcc = 0
      }
    } else {
      pointAcc = 0
    }
    if (autoBuyActive()) {
      // 自动购买不必每帧都试：攒到代买间隔再扫一遍，省下满屏的重算
      autoBuyAcc += dt
      if (autoBuyAcc >= buyStep()) {
        autoBuyAcc = 0
        runAutoBuy()
      }
    }
    if (autoBuyPillActive()) {
      pillBuyAcc += dt
      if (pillBuyAcc >= buyStep()) {
        pillBuyAcc = 0
        buyAllPill()
      }
    }
    if (autoBuyRebirthActive()) {
      treeBuyAcc += dt
      if (treeBuyAcc >= buyStep()) {
        treeBuyAcc = 0
        buyAllRebirth()
      }
    }
    if (autoBuyExploreTreeActive()) {
      benchBuyAcc += dt
      if (benchBuyAcc >= buyStep()) {
        benchBuyAcc = 0
        buyAllExplore()
      }
    }
    if (autoPullActive()) {
      pullBuyAcc += dt
      if (pullBuyAcc >= buyStep()) {
        pullBuyAcc = 0
        autoPull()
      }
    }
    displayAcc += dt
    // 补过闭关的账就当场把数字换新；没补过照旧走展示节拍，不必每帧重算
    if (absorbAwayGap(real) || displayAcc >= DISPLAY_INTERVAL) refreshDisplay()
  }

  rafId = requestAnimationFrame(tick)
}

function restartAutoSave(): void {
  if (autoSaveTimer) clearInterval(autoSaveTimer)
  autoSaveTimer = 0
  if (!state.settings.autoSave) return
  autoSaveTimer = window.setInterval(saveGame, state.settings.autoSaveEvery * 1000)
}

function onVisibility(): void {
  if (document.visibilityState === 'hidden') saveGame()
}

watch(
  [() => state.settings.autoSave, () => state.settings.autoSaveEvery],
  restartAutoSave,
)

export function bootGameLoop(): void {
  const loaded = loadGame()
  // 闭关从"上一次写档的那一刻"数起。没存过档（或时间戳在未来）就从此刻数起，
  // 免得新玩家一进来先领一笔凭空的进项
  lastReal = loaded && state.savedAt > 0 ? Math.min(state.savedAt, Date.now()) : Date.now()
  restartAutoSave()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('beforeunload', saveGame)
  lastTick = performance.now()
  rafId = requestAnimationFrame(tick)
}

export function stopGameLoop(): void {
  cancelAnimationFrame(rafId)
  if (autoSaveTimer) clearInterval(autoSaveTimer)
  autoSaveTimer = 0
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('beforeunload', saveGame)
  saveGame()
}
