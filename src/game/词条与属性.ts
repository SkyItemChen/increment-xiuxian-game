import { BigNumber } from './BigNumber'
import type { NumberStyle } from './BigNumber'

/**
 * 词条与属性 —— 全游戏的数值词汇表集中在这一个文件。
 * 想知道"有哪些词条、每条的 power 是什么意思、现在这张表是什么量级"，读这里就够。
 * 算法不在这儿：价格与产出在 `upgrades.ts`，筑基点折算在 `rebirth.ts`，境界与页面归属在 `realms.ts`。
 *
 * 页面归属（境界标签页各摆什么）：
 *   练气 = 吐纳 + 法门 + 破境按钮，灵气只从这里来，一世一世在这里循环（金丹开张后破境换成按秒折算）；
 *   筑基 = 根骨树 + 探索，花筑基点；探索押的是手上还没花的点数，散去的是修行那一层（法门与灵气），
 *          根骨树买过的等级不散（2026-10-16 改的）；
 *   金丹 = 丹炉三条线 + 火候三档 + 凝练转盘，花丹与废渣；灵气流量按一成打底炼成丹，
 *          一炉一炉出丹，有概率炸炉折成废渣，废渣抽丹道精神（永久 buff）。
 *          结丹散去的还是修行那一层（2026-10-16 接的运行时，算式在 `金丹丹炉.ts` 与 `凝练.ts`，定标在 `sim/jindan-anchor.mjs`）；
 *   元婴及以后 = 界面还没做，只按"每一境都得新开一条链"排着阈值（见下）。
 *
 * 转生线（修行境攒够灵气就能破境，可以反复）：筑基 1e10 —— 实测练气一世 40.3 分钟，终局约 2.7e7 灵气/秒。
 *   金丹一开张这条线就改成按秒折算：破境那颗按钮不再摆，破境本该给的点数每秒给玩家一成（文末 POINT_PASS_RATE）。
 * 筑基点按"这一世比门槛多攒出几个数量级"线性结算：一个数量级 **3 点**，摸到门槛就破给 2 点，
 * 每破一次境再折算 0.25 个数量级（8 世封顶），所以一世比一世厚（公式在 `rebirth.ts`）。
 * 树头几级的开销 `1, 1, 2, 3, 5, 8, 12…` 一世一世攒得动，25 级满点是几万点的长线目标。
 * 金丹已经压到实测的 1e30（见 `realms.ts` 上面那段），它现在只是**保底**——结丹真过的是丹炉那条链（文末丹炉链）。
 * 再往后的阈值按指数翻倍排：元婴 1e100 · 化神 1e300 · 炼虚 1e600 · 合体 1e1200 · 大乘 1e2400 · 渡劫 1e4800，
 * 跨度一路 70 → 200 → 300 → 600 → 1200 → 2400 个数量级，摆明了不让"挂同一台机器"过关——每一境都得新开一条链。
 *
 * 吐纳：进度条走满 5 秒结算一笔（基准周期 `GATHER_PERIOD` 在 state.ts），
 *   每笔 = 灵气/秒 × 5，全局收益 = 灵气/秒 × 吐纳速度。
 *   先天根基 = 起手那份 1 灵气/秒，**不再按第几世翻**（2026-10-15 用户拍板：一世 ×100 太夸张）。
 *   它的作用只剩"没参悟法门也有进项"，来世变快靠的是根骨树买出来的倍率。
 *
 * 法门**没有等级上限**，墙由价格竖起来：乘法类每级涨价 12~20 倍、单级收益只给 ×1.5~×2，
 * 于是下一级要攒的时间每级翻 3~5 倍，不转生根本买不起。
 *
 * 「全局速度」不是法门词条，是设置里的调试倍率（`state.settings.globalSpeed`）：
 * 它把主循环的时间轴整体加速，吐纳、产出、累计时长一起变快，只在测数值时用。
 * 法门层里承担"全局放大"的是 speed-mult，两者相乘，不必再造一条重复的词条。
 */

/**
 * 法门的作用方式。power 的含义随 kind 变化：
 *  - auto-base   每级 +power 灵气/秒，数值会被同境界的 auto-power 法门再乘一层
 *  - auto-power  每级把所有 auto-base 的灵气/秒 ×power —— 即"改变另一个法门的公式"
 *  - auto-mult   每级把灵气/秒总量 ×power，不碰先天根基
 *  - gather-mult 每级把先天根基 ×power。先天根基 = 入门就自带的那份灵气/秒，不参悟任何法门也在，
 *                和法门堆出来的产出是两笔账；它是个固定的 1 灵气/秒，算式在 `state.ts` 的 GATHER_BASE。
 *  - speed-mult  每级把吐纳速度 ×power。速度是全局倍率：同一笔结算额来得更勤，
 *                先天根基与法门产出一并放大，所以 power 要比 auto-mult 更收紧。
 *  新境界直接在这张表里挑词条，不必再加 kind。
 *
 * gather-mult 眼下还是没有法门在用：先天根基只是起手那 1 灵气/秒，法门终局能堆到 2.7e7 灵气/秒，
 * 放大根基等于放大一条零。这条 kind 要等有"只放大根基"的玩法再做，否则买它等于买一条空词条。
 *
 * 给玩家看的说法统一成"每级 +N%"，不写 ×1.25 这种乘法式；
 * 代码里的 kind 名保持乘法语义，两者别混。
 */
export type UpgradeKind =
  | 'auto-base'
  | 'auto-power'
  | 'auto-mult'
  | 'gather-mult'
  | 'speed-mult'

/**
 * 涨价曲线的一段：从第 `at` 级起，每级的涨价幅度换成 `growth`。
 * 一条法门的墙因此可以分段竖——低段照旧，中段松一档（给挂机的玩家一条能爬的坡），
 * 高段再收紧（把远期目标留住）。不填段表就一路用 `UpgradeDef.growth`。
 */
export interface GrowthSegment {
  /** 从第几级开始生效（0 级起算，`at` 级本身按新涨幅要价） */
  at: number
  growth: number
}

/** 一条法门的属性：名字 + 词条 + 三个数字 */
export interface UpgradeDef {
  id: string
  name: string
  /** 乘法类的一句话说明；auto-base 的单级产出由 effectText 现算 */
  effect?: string
  kind: UpgradeKind
  /** 首级价格（灵气） */
  base: number
  /** 每升一级价格的倍数 —— 这就是那堵墙 */
  growth: number
  /** 每级的收益，含义见 UpgradeKind */
  power: number
  /** 分段涨价，按 `at` 升序读；不填就等于一路用 growth */
  segments?: GrowthSegment[]
}

/**
 * 练气期五大法门。
 *
 * 没有等级上限，墙由价格竖起来。每条法门对产出的提升记作 p^级、要价的涨幅记作 g^级，
 * 于是"可达产出"约等于灵气的 (log p / log g) 次幂：只要这个指数小于 1，法门就永远追不上
 * 自己的价格。这里三条乘法类一路走到底的话分别是 .031 / .231 / .150，合计 .412，
 * 玩家走到破境线时下一级要攒 3 分，再往下 11 分、32 分、97 分——不用 cap 也走不出练气。
 *
 * 2026-10-16 加了 `segments`：同一条法门的 g 允许按等级区间换档，墙从"一堵"变成"几段"。
 * 三条乘法类的中段松一档（g 换成 4 / 6 / 5，E 抬到 .124 / .386 / .270，合计 .78），高段把 g 换回
 * 原值，拐点统一摆在 30 级。低段拐点 10/10/12 与高段拐点 30 都落在"一世摸到 1e10 时才 7/6/8 级"
 * 之外，所以 40 分钟这个锚点一点没动（实测仍是 40.2 分）。
 * 两条加法类（吐纳引气、紫府开辟）不加段：它们的 E 本来就是 0，墙不在它们身上。
 *
 * 实测（空树空宝、一世挂到底，`node --import ./sim/ts-hook.mjs sim/e36.mjs a`）：
 * 1e10 · 40 分 / 1e20 · 1.5 年 / 1e26 · 79 年 / 1e30 · 1181 年 / 1e33 · 4 万年 / 1e36 · 160 万年。
 * 对比一路不分段：1e20 要 20.9 年、1e36 要 200 亿年。**分段买到的不是把墙拆掉，是把悬崖改成斜坡**——
 * 中量级便宜了一个数量级还多，30 级以后每个数量级的等待重新按 2~3 倍递增。
 * 高段拐点必须落在玩家真会走到的等级里：早先摆在 50/60 级，一世最多到 47/38/40 级，那段完全咬不到，
 * 结果只剩中段的软化，1e36 从 200 亿年塌到 5.85 万年。扫参见 `sim/segment-scan.mjs`。
 *
 * 定下的节奏（贪心买入模拟）：一世 40 分钟摸到 1e10，全程约 88 次参悟。
 */
export const LIANQI_UPGRADES: UpgradeDef[] = [
  { id: 'lianqi_tuNa', name: '吐纳引气', kind: 'auto-base', base: 10, growth: 1.55, power: 6 },
  {
    id: 'lianqi_ningQi', name: '凝气成珠', effect: '每级吐纳速度 +8%，进度条走得更快', kind: 'speed-mult',
    base: 150, growth: 12, power: 1.08, segments: [{ at: 12, growth: 4 }, { at: 30, growth: 12 }],
  },
  {
    id: 'lianqi_juLing', name: '聚灵阵眼', effect: '每级让吐纳引气、紫府开辟的效果翻倍', kind: 'auto-power',
    base: 60, growth: 20, power: 2, segments: [{ at: 10, growth: 6 }, { at: 30, growth: 20 }],
  },
  {
    id: 'lianqi_zhouTian', name: '周天运转', effect: '每级灵气/秒 +50%', kind: 'auto-mult',
    base: 3e3, growth: 15, power: 1.5, segments: [{ at: 10, growth: 5 }, { at: 30, growth: 15 }],
  },
  { id: 'lianqi_ziFu', name: '紫府开辟', kind: 'auto-base', base: 2e4, growth: 3, power: 1500 },
]

/**
 * 筑基期原本也有一张五行法门表（按 1e36 的门槛调出来的两小时节奏）。
 * 筑基页改成转生树之后它失去了唯一入口，整张表已删；要复用的话词条与练气同构，
 * 只需把量级重新按那一境的门槛排一遍——上一版的加法类单级要给到 6e14、3e17 灵气/秒。
 */

/** 全部境界的法门，按 id 查等级、结算花费都走这张表 */
export const ALL_UPGRADES: UpgradeDef[] = [...LIANQI_UPGRADES]

export function findUpgrade(id: string): UpgradeDef | undefined {
  return ALL_UPGRADES.find((d) => d.id === id)
}

/**
 * 给玩家看的单级说明。auto-base 的数字由大数格式化现算，
 * 跟着玩家的记法设置走——法门一旦跨到高位数量级，写死中文数字必定和界面打架。
 */
export function effectText(def: UpgradeDef, style: NumberStyle): string {
  if (def.kind === 'auto-base') return `每级 +${BigNumber.from(def.power).format(2, style)} 灵气/秒`
  return def.effect ?? ''
}

/** 该法门当前的实际贡献，用于列表展示 */
export function upgradeCurrent(
  def: UpgradeDef,
  levels: Record<string, number>,
  defs: UpgradeDef[],
  style: NumberStyle = 'letter',
  outputAdd = 0,
): string {
  const lv = levels[def.id] ?? 0
  if (!lv) return '尚未参悟'
  const pow = (b: number, n: number) => BigNumber.fromLog10(n * Math.log10(b)).format(2, style)
  switch (def.kind) {
    case 'auto-base': {
      const boost = defs
        .filter((d) => d.kind === 'auto-power')
        .reduce((log, d) => log + (levels[d.id] ?? 0) * Math.log10(d.power), 0)
      const value = new BigNumber(def.power * lv, 0)
        .mul(BigNumber.fromLog10(boost))
        .mulNumber(1 + outputAdd)
      return `${value.format(2, style)} 灵气/秒`
    }
    case 'auto-power':
      return `增幅 ×${pow(def.power, lv)}`
    case 'auto-mult':
      return `灵气/秒 ×${pow(def.power, lv)}`
    case 'gather-mult':
      return `先天根基 ×${pow(def.power, lv)}`
    case 'speed-mult':
      return `吐纳速度 ×${pow(def.power, lv)}`
  }
}

/**
 * 根骨树（旧称转生树）的作用方式。power 一律**加法**累加，不在树内叠乘——
 * 筑基点是线性产出，树内部再做成乘法就等于把上一世的下限乘进下一世，正反馈又会回来。
 *  - global-add  全部灵气产出（先天根基 + 法门 + 法宝）×(1 + power×等级)
 *  - output-add  只有法门那份灵气/秒 ×(1 + power×等级)，管不到聚宝盆
 *  - cost-cut    每个法门的涨价幅度乘 (1 − power×等级)，砍的是百分比不是绝对值。
 *               早先按绝对值砍（−0.012/级）实测完全咬不动墙，而砍绝对值又会把
 *               吐纳引气这种本来只要 ×1.55 的法门砍成降价商品，所以改成按比例。
 *  - crit-add    每级给 power 的机会让一次吐纳收益 ×GATHER_CRIT_MULT，和紫金葫芦共用一个概率池
 *  - point-add   每次破境多给 power×等级 个筑基点，和混沌钟同一笔账
 *
 * 五条在一世时长上都量过（空树一世 40.3 分）：灵根 Lv.1 → 26.9、道基 Lv.1 → 33.6、
 * 慧根 Lv.1 → 38.0、悟性 Lv.1 → 38.3，第一条点下去就有明显反馈。
 */
export type RebirthKind = 'global-add' | 'output-add' | 'cost-cut' | 'crit-add' | 'point-add'

export interface RebirthDef {
  id: string
  name: string
  effect: string
  kind: RebirthKind
  power: number
}

/**
 * 五条永久强化，破境和探索都不散（探索原先会把它们一起推翻，2026-10-16 用户改成保留）。
 * 2026-10-16 撤掉了等级上限：这五条全是**加法收益 + 几何涨价**，等级 ≈ log(筑基点)，
 * 本身就是一堵对数墙——吐纳引气同样的构造挂到 1e36 才 184 级、只值 1104 灵气/秒。
 * 有 cap 的时候那层天花板是多余的，撤掉之后第 26 级道基照样买得起，只是要等的那笔点数
 * 按 ×1.5/级 递增，永远点不满也永远 runaway 不起来。
 */
export const REBIRTH_TREE: RebirthDef[] = [
  { id: 'daoJi', name: '道基', effect: '每级 +20% 全部灵气产出', kind: 'global-add', power: 0.2 },
  { id: 'lingGen', name: '灵根', effect: '每级 +50% 法门灵气/秒', kind: 'output-add', power: 0.5 },
  { id: 'wuXing', name: '悟性', effect: '每级让法门涨价幅度少涨 2%', kind: 'cost-cut', power: 0.02 },
  { id: 'huiGen', name: '慧根', effect: '每级 +5% 机会让一次吐纳收益 ×3', kind: 'crit-add', power: 0.05 },
  { id: 'yuanFa', name: '缘法', effect: '每级让筑基点进项多 1 点', kind: 'point-add', power: 1 },
]

export function findRebirth(id: string): RebirthDef | undefined {
  return REBIRTH_TREE.find((d) => d.id === id)
}

/* ------------------------------------------------------------------ 法宝 */

/** 法宝的三档来头：探索出土时按这个分档抽 */
export type TreasureRarity = 'fan' | 'ling' | 'xian'

export const RARITY_LABELS: Record<TreasureRarity, string> = {
  fan: '凡品',
  ling: '灵品',
  xian: '仙品',
}

/** 抽到已圆满的法宝时改攒见识：探索这一层自己的经验，不折回筑基点 */
export const RARITY_INSIGHT: Record<TreasureRarity, number> = {
  fan: 1,
  ling: 3,
  xian: 8,
}

/* ------------------------------------------------------------------ 探索经验 */

/**
 * 见识（探索经验）能买的东西。这一层的升级**破境和探索都不会清**——
 * 它买的不是某一世的战力，而是"以后每一铲都挖得更好"，所以是探索这层的永久进度。
 * 2026-10-15 改版：押多少筑基点既不加铲数也不加概率，铲数与概率全在这一栏里买。
 *  - luck         眼力等级，灵品/仙品的出土权重按它一级一级爬，同时也是出土机会的乘数
 *  - energy-add   淬炼：每级给全部灵气产出一个加法额度。**它不再碰法宝的 power**——
 *                 原来 `power × (1 + 0.05×淬炼)` 会跟着层数一起进对数轴，等于把淬炼等级
 *                 乘进层数那条指数轴上（实测法宝满层 + 淬炼 20 级时，1e36 的每个数量级都是 0 分钟）。
 *                 法宝七件的 power 量纲差四个数量级（聚宝盆 200 / 玄铜镜 0.02），
 *                 字面意义上"往 power 上加数"也没法统一，所以只能整条搬出法宝轴。
 *                 与道基共用一条轴是有意为之：先例是悟性与玄铜镜共用 cost-cut，两个货币买同一条轴。
 *  - insight-gain 折回的见识按百分比变多
 *  - draw-add     铁铲：每级在首铲之外多挖一铲
 */
export type ExploreKind = 'luck' | 'energy-add' | 'insight-gain' | 'draw-add'

export interface ExploreDef {
  id: string
  name: string
  effect: string
  kind: ExploreKind
  power: number
}

/**
 * 鉴宝台的四条永久强化，花见识。和根骨树同一条撤 cap 的理由：四条全是加法收益 + 每层 ×1.6 涨价，
 * 等级 ≈ log(见识)，价格自己就是天花板。
 */
export const EXPLORE_TREE: ExploreDef[] = [
  { id: 'yanLi', name: '眼力', effect: '识得箱底宝。每级出土机会 +10%，四级起可见仙品', kind: 'luck', power: 0.1 },
  { id: 'cuiLian', name: '淬炼', effect: '凡铁也炼出光。每级 +5% 全部灵气产出', kind: 'energy-add', power: 0.05 },
  { id: 'shouZi', name: '收资', effect: '出门多讨些。每级多攒 20% 见识', kind: 'insight-gain', power: 0.2 },
  { id: 'tieChan', name: '铁铲', effect: '手快铲也多。每级多挖一铲', kind: 'draw-add', power: 1 },
]

export function findExplore(id: string): ExploreDef | undefined {
  return EXPLORE_TREE.find((d) => d.id === id)
}

/** 鉴宝台那一行"当前" */
export function exploreCurrent(def: ExploreDef, lv: number): string {
  if (!lv) return '尚未参悟'
  const total = def.power * lv
  switch (def.kind) {
    case 'luck':
      return `出土机会 ×${(1 + total).toFixed(2)}`
    case 'energy-add':
      return `灵气产出 +${Math.round(total * 100)}%`
    case 'insight-gain':
      return `见识收入 +${Math.round(total * 100)}%`
    case 'draw-add':
      return `一次挖 ${1 + total} 铲`
  }
}

/**
 * 法宝的作用方式。前三条和法门、转生树同构，后四条是法宝独有的维度——
 * 探索这套玩法之所以值做一次重置，全靠这四条给玩家新的可优化对象。
 *  - auto-base    每层 +power 灵气/秒。它不吃法门倍率，定位是"下一世开局不挨饿"
 *  - auto-mult    每层把灵气/秒总量 ×power，先天根基也算在内
 *  - speed-mult   每层把吐纳速度 ×power，和法门的 speed-mult 同一条乘算链
 *  - cost-cut     每层把法门涨价幅度按 power 的比例砍下来，和悟性共用一个削减额度
 *  - gather-crit  【新】每层有 power 的机会让一次吐纳的收益 ×critMult。挂机的即时反馈
 *  - point-back   【新】每层让每次破境多给 power 个筑基点，把探索层的收益接回第二层
 *  - explore-luck 【新】每层把灵品的出土机会抬一倍、仙品抬两倍，形成"越探越会探"的回路
 */
export type TreasureKind =
  | 'auto-base'
  | 'auto-mult'
  | 'speed-mult'
  | 'cost-cut'
  | 'gather-crit'
  | 'point-back'
  | 'explore-luck'

export interface TreasureDef {
  id: string
  name: string
  rarity: TreasureRarity
  kind: TreasureKind
  /** 每层的收益，含义见 TreasureKind */
  power: number
  /** 能叠几层——抽到已满的法宝会改返筑基点 */
  cap: number
  /** 给玩家看的一句话说明 */
  effect: string
  /** 一句话来历，摆在家谱里撑气氛 */
  lore: string
}

/**
 * 七件法宝。凡品三条各占一个老维度、层数给得宽；灵品两条开始给新维度；
 * 仙品两条只有三层，但直接改探索本身。
 *
 * 定层数上限是为了让"重复抽到"还有意义又不至于失控：乘法类（auto-mult / speed-mult）
 * 一旦不封顶，几次好运气就能把一世压到几分钟，探索反而把玩法探没了。
 */
export const TREASURES: TreasureDef[] = [
  { id: 'juBaoPen', name: '聚宝盆', rarity: 'fan', kind: 'auto-base', power: 200, cap: 8,
    effect: '每层 +200 灵气/秒', lore: '盆里取之不竭，开局那几天不必再挨饿。' },
  { id: 'xuanTongJing', name: '玄铜镜', rarity: 'fan', kind: 'cost-cut', power: 0.02, cap: 6,
    effect: '每层让法门涨价幅度少涨 2%', lore: '镜中照见关窍，参悟起来少走弯路。' },
  { id: 'qingZhuDi', name: '青竹笛', rarity: 'fan', kind: 'speed-mult', power: 1.12, cap: 8,
    effect: '每层吐纳速度 +12%', lore: '笛声一起，气息自己就跟着走了。' },
  { id: 'qianKunDing', name: '乾坤鼎', rarity: 'ling', kind: 'auto-mult', power: 2, cap: 5,
    effect: '每层灵气/秒翻倍', lore: '鼎中自有一方天地，灵气养得住。' },
  { id: 'ziJinHuLu', name: '紫金葫芦', rarity: 'ling', kind: 'gather-crit', power: 0.1, cap: 5,
    effect: '每层有 10% 机会让一次吐纳的收益 ×3', lore: '喊一声名字，应者即被收进去。' },
  { id: 'hunDunZhong', name: '混沌钟', rarity: 'xian', kind: 'point-back', power: 2, cap: 3,
    effect: '每层破境时多给 2 筑基点', lore: '钟声一响，天地初开的东西都记下了。' },
  { id: 'zaoHuaYuDie', name: '造化玉碟', rarity: 'xian', kind: 'explore-luck', power: 0.6, cap: 3,
    effect: '每层让好宝物的出土机会 +60%，仙品涨得比这更快', lore: '造化都写在上面，只是没人读得全。' },
]

/** 紫金葫芦一次会心给几倍——概率按层叠，倍率固定，免得两个数字一起飘 */
export const GATHER_CRIT_MULT = 3

export function findTreasure(id: string): TreasureDef | undefined {
  return TREASURES.find((d) => d.id === id)
}

/** 法宝清单按品质分组摆出来时的顺序：凡 → 灵 → 仙 */
export const RARITY_ORDER: TreasureRarity[] = ['fan', 'ling', 'xian']

/** 该法宝当前的实际效果，家谱上那行"当前"。淬炼改版后法宝的 power 就是它自己那份，不再整体缩放 */
export function treasureCurrent(
  def: TreasureDef,
  levels: Record<string, number>,
  style: NumberStyle = 'letter',
): string {
  const lv = levels[def.id] ?? 0
  if (!lv) return '尚未寻得'
  const power = def.power
  const pow = (b: number, n: number) => BigNumber.fromLog10(n * Math.log10(b)).format(2, style)
  switch (def.kind) {
    case 'auto-base':
      return `${new BigNumber(power * lv, 0).format(2, style)} 灵气/秒`
    case 'auto-mult':
      return `灵气/秒 ×${pow(power, lv)}`
    case 'speed-mult':
      return `吐纳速度 ×${pow(power, lv)}`
    case 'cost-cut':
      return `涨价幅度 −${Math.round(power * lv * 100)}%`
    case 'gather-crit':
      return `${Math.round(power * lv * 100)}% 机会 ×${GATHER_CRIT_MULT}`
    case 'point-back':
      return `每次破境 +${Math.round(power * lv * 10) / 10} 点`
    case 'explore-luck': {
      const l = 1 + power * lv
      return `灵品机会 ×${l.toFixed(1)} · 仙品 ×${(l * l).toFixed(1)}`
    }
  }
}

/**
 * 挑战、里程碑、成就这三张表共用的"白给好处"的形状——**只有这五条轴**，
 * 每条都是链上现成的加数或乘数，新玩法不许另起第六条：
 *  - danAdd    添在 `凝练.ts` 的 `danYieldMult` 那同一个加数上，等于武火那种"每一炉多炼几成丹"
 *  - qiAdd     加进丹房那条灵气返哺加法轴（和丹房、通灵共用一个加数，一起被 √定价吃回去）
 *  - energyAdd 加进道基/淬炼/结丹那条全部产出加法轴
 *  - dregMul   炸一炉赔的废渣整体乘这个数（只喂转盘，转盘不竖墙）
 *  - passMul   按秒折给玩家的筑基点整体乘这个数（那条进项本来就被对数压平）
 *
 * 加法的几条是"再往同一个加数上添一笔"，乘法的几条出厂是 1，所以聚合从 `noBonus()` 起累加。
 */
export interface Bonus {
  danAdd?: number
  qiAdd?: number
  energyAdd?: number
  dregMul?: number
  passMul?: number
}

/** 聚合的起点：三条加法清零、两条乘法置一 */
export function noBonus(): Bonus {
  return { danAdd: 0, qiAdd: 0, energyAdd: 0, dregMul: 1, passMul: 1 }
}

/** 把一条好处并进取和的那本账（加法轴相加、乘法轴相乘），不改传入的对象 */
export function addBonus(sum: Bonus, add: Bonus): Bonus {
  return {
    danAdd: (sum.danAdd ?? 0) + (add.danAdd ?? 0),
    qiAdd: (sum.qiAdd ?? 0) + (add.qiAdd ?? 0),
    energyAdd: (sum.energyAdd ?? 0) + (add.energyAdd ?? 0),
    dregMul: (sum.dregMul ?? 1) * (add.dregMul ?? 1),
    passMul: (sum.passMul ?? 1) * (add.passMul ?? 1),
  }
}

/**
 * 成就看的都是**历史累计**：花掉不减、探索清零也不减，
 * 所以解锁一次就一直开着，不会把已经交给系统代跑的活又收回来。
 * realm 记这条成就算在哪一境头上，成就页照它从上往下排——练气的在前，金丹的在后。
 *
 * 头六条成就是"解锁自动化"那一类，好处长在 `state.ts` 的门槛函数上，所以不带 bonus；
 * 后九条是加属性的，bonus 走下面 `Bonus` 那五条现成的轴，达成之后被动生效、没有领取那一步。
 * 这九条的好处**在金丹开张之前一律不咬合**（出丹、废渣、按秒折点这三样本来就只有金丹之后才有账），
 * 所以练气那 40 分钟的锚点一条都碰不着；门槛也全摆在金丹这条链上能看到的那几笔累计里。
 * 九条好处分两档：前四条是"头一遍走完这条链"的，后五条是链条上再深一截的，
 * 五条轴一条不落各补一笔，所以没有哪条轴只有挑战和里程碑在撑。
 */
export interface AchievementDef {
  id: string
  name: string
  /** 达成之后玩家拿到什么，界面直接念这句 */
  desc: string
  /** 解锁要看的那笔累计的数目 */
  need: number
  /** 看哪一笔累计：默认是累计筑基点，探索那条看累计见识，金丹那条看累计灵气 */
  metric?: AchievementMetric
  realm: AchievementRealm
  bonus?: Bonus
}

/** 成就的进度来源；layers 看已结成的金丹层数，只涨不跌；qi 看累计灵气到过多少；turns 看累计转过多少次凝练；explores 看累计押过多少次铲 */
export type AchievementMetric = 'points' | 'insight' | 'layers' | 'qi' | 'turns' | 'explores'

/** 成就挂在哪一境名下 */
export type AchievementRealm = '练气' | '筑基' | '金丹'

/** 成就页那个从上往下的顺序；往后加境界或加新档成就时在这里登记一笔就行 */
export const REALM_SEQUENCE: AchievementRealm[] = ['练气', '筑基', '金丹']

/** 这条成就排在第几档 */
export function realmRank(realm: AchievementRealm): number {
  return REALM_SEQUENCE.indexOf(realm)
}

/** 攒到 20 筑基点就把练气法门的参悟交给系统代跑 */
export const AUTO_BUY_UNLOCK_POINTS = 20

/** 探索攒到 20 见识，参悟法门就只问灵气够不够、不再真的扣 */
export const FREE_UPGRADE_UNLOCK_INSIGHT = 20

/**
 * 金丹那道破境线摆在同一个数上：累计灵气到过它，练气就不必再一世一世破境了，
 * 筑基点改成按秒自动进账。
 * `realms.ts` 里金丹的 breakThrough 用的正是这一个数，两边不会走岔。
 * 丹炉与凝练的代买**不挂在这条线上**（往下看 `PILL_AUTO_UNLOCK_LAYERS`）——这条线只管按秒折点。
 */
export const POINT_PASS_UNLOCK_QI = 1e30

/**
 * 结到第几层丹，系统才开始替玩家买丹炉那三条线。
 * 摆在第 1 层是玩法决定：**头一整世（连那 12 小时的结丹线）都得玩家自己点**。
 * 那一段是整个金丹最好看的部分——火候要自己挑、丹房该不该起要自己拿主意，
 * 而代买的贪心只看谁便宜，过早接管会把这一段直接跑成结果（`sim/jindan-qi.mjs`：过线那一刻它一口气把丹房堆到 34 级）。
 * 结完一层，该看的都看过了，剩下的就是把丹花掉，交给系统。
 */
export const PILL_AUTO_UNLOCK_LAYERS = 1

/**
 * 自己转过多少次凝练，盘子才开始替玩家转。
 * 抽卡价 ×1.15/次很软，废渣一有就是连成一串地抽（定标档挂满 12 小时能转 125 次），
 * 所以头 50 次留给玩家——七道精神各看过好几遍、知道自己想要哪道，才谈得上让别人代劳。
 * 看的是累计抽数 `state.pulls`：散功、结丹都不清它，拨回去也锁不住。
 */
export const PULL_AUTO_UNLOCK_TURNS = 50

/**
 * 结到第几层丹，系统才开始替玩家买根骨与鉴宝台。
 * 这一档不看筑基点、只看层数：金丹那一层的钱（丹）要挂够一整世才攒得出下一层，
 * 层数因此是"玩家真在金丹这条链上走过几遭"的账。摆在三层是量出来的（`sim/passive-check.mjs`）：
 * 第一层丹刚结上手就忙——丹房要起、炉子要往上炼；到第三层时一世只剩原来三分之一长，
 * 筑基点那条线的账（根骨、鉴宝台）已经摊不开点了，正好交给系统。
 * 押探索、结丹这两颗按钮不在这条豁免里，照旧永远手动。
 */
export const JIEDAN_AUTO_UNLOCK_LAYERS = 3

/**
 * 闭关（人不在这儿、游戏还在跑）最多补多少秒——按**墙钟**算，不吃全局速度。
 * 摆在 8 小时是"睡一觉回来有得收，但不用天天挂着"：一整天不打开也拿满，
 * 连着几天不看也只是 8 小时，不会攒成一笔谁也数不清的巨款。
 */
export const OFFLINE_CAP_SECONDS = 8 * 3600

/**
 * 一帧最多算作"在线"的秒数。超过这一段就不算在线了：切后台、浏览器节流、调试器停顿
 * 都会让两帧之间空出一大截，那截走**离线结算**（只补产出，代买一栏不跑、游玩时间也不加）。
 * 摆在 5 秒是留给正常掉帧的余量——浏览器最狠的节流也就一秒一帧。
 */
export const ONLINE_FRAME_MAX_SECONDS = 5

/**
 * 闭关满这么多秒才弹那张「出关」字据。
 * 一次掉帧、一次切标签不该打扰玩家，所以进项照收、字据只在大段闭关后念一遍。
 */
export const OFFLINE_REPORT_SECONDS = 60

/**
 * 加属性那四条成就的门槛。四条各读一笔只涨不跌的累计账，都摆在金丹这条链上：
 * 灵气那一笔要过结丹门槛再攒一千倍，见识那一笔换成"结到第 12 层"——抽卡那条墙很硬，
 * 累计凝练能摸到 170 次的玩家本来就已经把这条链走过好几遍了。
 */
export const BONUS_QI_NEED = 1e33
export const BONUS_TURNS_NEED = 170
export const BONUS_EXPLORE_NEED = 30
export const BONUS_LAYER_NEED = 12

/**
 * 第二档那五条加属性成就的门槛：各比同轴的前一条再深一截，五条轴一条不落。
 * 只用层数、累计灵气、累计探索这三笔账——它们都跟着产出一起涨，往后总能摸到，
 * 练气那 40 分钟与结丹那条 12 小时的线也碰不着。
 * 独独不再摆累计凝练：转盘价按"见过的最高出丹流量"定标、废渣供给也拿同一把尺涨，两边约掉，
 * 所以 time-to-N 抽几乎与流量无关（实测 150 抽≈12 天、170 抽≈4 个月、260 抽≈数年、400 抽挂满 3e13 秒也到不了）。
 * 头一档里聚沙成塔那条压在 170 抽上，已经是这条墙上人还够得着的最后一格，往后再不往上加抽数门槛。
 */
export const BONUS_EXPLORE_DEEP = 60
export const BONUS_LAYER_DEEP = 16
export const BONUS_QI_DEEP = 1e36
export const BONUS_LAYER_PEAK = 24
export const BONUS_QI_PEAK = 1e39

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'autoBuyCultivate',
    name: '无为而治',
    desc: '练气法门自动购买',
    need: AUTO_BUY_UNLOCK_POINTS,
    realm: '练气',
  },
  {
    id: 'freeUpgradeCultivate',
    name: '不取一毫',
    desc: '参悟练气法门不耗灵气',
    need: FREE_UPGRADE_UNLOCK_INSIGHT,
    metric: 'insight',
    realm: '练气',
  },
  {
    id: 'autoBuyTrees',
    name: '丹成三转',
    desc: '筑基根骨、鉴宝台自动购买',
    need: JIEDAN_AUTO_UNLOCK_LAYERS,
    metric: 'layers',
    realm: '筑基',
  },
  {
    id: 'pointPass',
    name: '不劳而获',
    desc: '练气免破境，筑基点按秒进账',
    need: POINT_PASS_UNLOCK_QI,
    metric: 'qi',
    realm: '金丹',
  },
  {
    id: 'autoBuyPill',
    name: '一丹在手',
    desc: '丹炉、火候、丹房自动购买',
    need: PILL_AUTO_UNLOCK_LAYERS,
    metric: 'layers',
    realm: '金丹',
  },
  {
    id: 'autoBuyPull',
    name: '转过一圈',
    desc: '凝练转盘自动抽取',
    need: PULL_AUTO_UNLOCK_TURNS,
    metric: 'turns',
    realm: '金丹',
  },
  /**
   * 下面九条是加属性的，好处落在那五条现成的轴上，也都碰不着练气那条 40 分钟的锚：
   * 出丹、废渣、按秒折点这三笔账本来就只有金丹开张之后才有。
   * 头四条各读一笔（累计灵气 1e33 / 累计凝练 170 / 累计探索 30 / 结到第 12 层），是头一遍走完这条链；
   * 后五条各再深一截，五条轴一条不落——废渣那一条原本只有挑战和里程碑在给。
   * 第二档一律不读抽数（理由见上面那串常量），改成再往层数、累计灵气、累计探索里挖。
   */
  {
    id: 'bonusDanYield',
    name: '海纳百川',
    desc: '每一炉的丹 +20%',
    need: BONUS_QI_NEED,
    metric: 'qi',
    realm: '金丹',
    bonus: { danAdd: 0.2 },
  },
  {
    id: 'bonusQiReturn',
    name: '聚沙成塔',
    desc: '丹炼回灵气 +20%',
    need: BONUS_TURNS_NEED,
    metric: 'turns',
    realm: '金丹',
    bonus: { qiAdd: 0.2 },
  },
  {
    id: 'bonusPointPass',
    name: '踏破铁鞋',
    desc: '每秒进的筑基点 1.50 倍',
    need: BONUS_EXPLORE_NEED,
    metric: 'explores',
    realm: '金丹',
    bonus: { passMul: 1.5 },
  },
  {
    id: 'bonusEnergyAdd',
    name: '丹成一品',
    desc: '灵气产出 +50%',
    need: BONUS_LAYER_NEED,
    metric: 'layers',
    realm: '金丹',
    bonus: { energyAdd: 0.5 },
  },
  {
    id: 'bonusDregMul',
    name: '返本还元',
    desc: '炸炉赔的废渣 1.25 倍',
    need: BONUS_EXPLORE_DEEP,
    metric: 'explores',
    realm: '金丹',
    bonus: { dregMul: 1.25 },
  },
  {
    id: 'bonusDanMore',
    name: '鼎中三昧',
    desc: '每一炉的丹 +35%',
    need: BONUS_LAYER_DEEP,
    metric: 'layers',
    realm: '金丹',
    bonus: { danAdd: 0.35 },
  },
  {
    id: 'bonusPassMore',
    name: '跬步千里',
    desc: '每秒进的筑基点 2.50 倍',
    need: BONUS_QI_DEEP,
    metric: 'qi',
    realm: '金丹',
    bonus: { passMul: 2.5 },
  },
  {
    id: 'bonusQiMore',
    name: '灵源不竭',
    desc: '丹炼回灵气 +35%',
    need: BONUS_LAYER_PEAK,
    metric: 'layers',
    realm: '金丹',
    bonus: { qiAdd: 0.35 },
  },
  {
    id: 'bonusEnergyMore',
    name: '气冲霄汉',
    desc: '灵气产出 +75%',
    need: BONUS_QI_PEAK,
    metric: 'qi',
    realm: '金丹',
    bonus: { energyAdd: 0.75 },
  },
]

/** 进度条上那笔账对玩家叫什么名字 */
export function metricLabel(metric: AchievementMetric | undefined): string {
  if (metric === 'insight') return '见识'
  if (metric === 'layers') return '次结丹'
  if (metric === 'turns') return '次凝练'
  if (metric === 'explores') return '次探索'
  return '筑基点'
}

/**
 * 丹炉链：灵气进炉、出丹，三条线全部用**丹**付账（定标的脚本是 `sim/jindan-anchor.mjs`，
 * 运行时用的是 src/game/金丹丹炉.ts 那套式子——两边同一条数学，sim 不再镜像一份价目表）。
 *
 * 四条规矩都是量出来的，不是拍的（`sim/jindan-anchor.mjs` 与 `sim/pill-check.mjs`，两边都跑运行时那套式子）：
 * 1. **造价取"定标产量与当前产量的几何平均 × 秒数"**（就是那条 0.5 次方）。实测这条链严格 obey
 *    「一世时长 ∝ 1/√流量」：`t·√流量` 在四档构筑间是个常数 4.32e16 秒。两个极端都不行——
 *    纯绝对丹数（exp=0）让结丹线在四档构筑间漂一整个万次量级，纯跟随流量（exp=1）把四档全压成 12 小时，
 *    构筑再厚也只是原地。0.5 次方量出来的落点是：炉子第 12 级 = 5.0 天 / 12.0 小时 / 1.2 小时 / 0.7 分
 *    （灵气/秒 1e22 / 1e24 / 1e26 / 1e30）。
 * 2. **同一个效果走加算**（倍率 = 1 + 每级 × 级数），只有炉子是乘法。
 *    再加一条护栏：定价看的是**见过的最高灵气/秒**，于是丹房那条自反哺回路变成自惩罚——
 *    反哺买得越厚，后面每一格丹炉的价按 √灵气 一起涨。门槛摆"灵气/秒 摸到 1e28"（定标档的千倍）实测：
 *    不反哺、加法每级 +5%、乘法每级 ×1.05 全都 ∞（9.5 万年预算顶穿），只有 ×1.2 要 125 年才开始咬墙。
 * 3. **时间全压在最后几级**：定标档按游戏里的贪心买法（丹炉 + 火候），炉子第 10 级 3.4 分、第 11 级 1.06 小时、
 *    第 12 级 12.0 小时、第 13 级 9.5 天、第 14 级 106 天。只堆炉子每一级都要更慢（第 12 级 18 小时）。
 *    所以面板上该念的是"下一级要等多久"，结丹线写成炉子第 12 级（定标档刚好挂一晚）。
 * 4. **一键购买在结丹线之前不碰丹房**：丹房不直接多出丹，而它 ×3 的涨价让贪心（只看谁便宜、不看谁划算）
 *    一口接一口买下去，实测定标档挂满 12 小时：三条都买停在炉 11，跳过丹房才过线。
 *    炉子一旦过了第 12 级就反过来——门槛已踩过，多余的丹留着也是留着，于是那一行也进这一口。
 *    口径写在 `state.ts` 的 `pillBuyIds`，`sim/pill-check.mjs` 两头都盯着（线前不许碰、线后必须会买）。
 *
 * 丹房那条**不是结丹的手段**——它是结完丹之后让下一世快起来的回溯线，所以第 1 级最贵。
 */
export type PillKind = 'dan-mul' | 'conv-add' | 'qi-add'

export interface PillLineDef {
  id: string
  name: string
  /** 给玩家看的那句，别露实现层的词 */
  effect: string
  kind: PillKind
  /** 每级的量：炉子是倍率，另两条是加法（0.05 = 半成） */
  power: number
  /** 下一级翻几倍价 */
  growth: number
  /** 第 1 级相对丹炉的造价倍数（火候 3 倍、丹房 9 倍）；绝对量另有全局常数 PILL_ANCHOR_SECONDS */
  ratio: number
}

/** 炉子吞掉流量的一成打底，火候把它往上抬 */
export const PILL_CONVERT_BASE = 0.1

/** 造价按当前产量的 0.5 次方缩放（1 = 完全跟着流量走，构筑再厚也只是原地；0 = 绝对丹数，厚了就一格秒过） */
export const PILL_PRICE_EXP = 0.5

/**
 * 定标档（灵气/秒 1e24）丹炉第 1 级的秒数——整条链唯一的绝对量，其余全是比值。
 * 由 `sim/jindan-anchor.mjs` 反解出来："挂满 12 小时正好摸到炉子第 12 级"，按游戏里那颗一键购买的贪心解
 * （只挑丹炉与火候两条，只堆炉子要 18 小时）。数字小得离谱是因为定标档本身就有 1e23 丹/秒：
 * 墙靠每级 ×30 的涨价竖起来，不靠起点价。改了 CAL_FLOW、结丹线或三条线的 ratio/growth 就重跑那个脚本取新值。
 */
export const PILL_ANCHOR_SECONDS = 6.977e-9

/** 结丹线：丹炉第 12 级。定标档（灵气/秒 1e24）挂满 12 小时正好摸到 */
export const JIEDAN_FURNACE_LEVEL = 12

/** 结丹一层给全部灵气产出的加法额度：+100%/层，和道基、淬炼同一条轴，所以一世时长严格除以 (1 + 层数) */
export const JIEDAN_RETURN_PER = 1

/**
 * 金丹开张之后，练气不再破境：每秒按这个比例把筑基点折到玩家账上（1%）。
 * 基数走的是破境过去那条折算式子（`rebirth.ts` 的 pointsForLoop），读的是**累计灵气**而不是手上余额——
 * 后续要靠别的词条改这个数（结丹层数、丹房、法宝都能往上加一笔），所以它摆在词条表里，不写在算式旁边。
 *
 * 为什么基数不能是"手上筑基点"：那就是复利，每秒 1% 等于 70 秒翻一倍，挂一晚（8 小时）是 1e40 倍，
 * 根骨树那点 ×1.5/级的价目表当天见底。按现在这个基数，折出去的点数不回灵气那笔账，一条复利都没有：
 * 灵气多攒十个数量级，每秒才多给 0.03 点，是被对数压平的一条坡（量的脚本 `sim/passive-check.mjs`）。
 * 读累计而不是本世，是因为散功（结丹、探索）会把本世灵气清零——那条进项不该跟着一起归零。
 */
export const POINT_PASS_RATE = 0.01

export const PILL_LINES: PillLineDef[] = [
  { id: 'danLu', name: '丹炉', effect: '一炉催一炉。每级出丹翻一倍', kind: 'dan-mul', power: 2, growth: 30, ratio: 1 },
  { id: 'huoHou', name: '火候', effect: '火头拿捏准。每级多炼出 5% 丹', kind: 'conv-add', power: 0.05, growth: 10, ratio: 3 },
  { id: 'danFang', name: '丹房', effect: '丹气回哺自身。每级修行 +5%', kind: 'qi-add', power: 0.05, growth: 3, ratio: 9 },
]

export function findPill(id: string): PillLineDef | undefined {
  return PILL_LINES.find((d) => d.id === id)
}

/** 丹炉链那一行"当前" */
export function pillCurrent(def: PillLineDef, lv: number, style: NumberStyle = 'letter'): string {
  if (!lv) {
    // 三条线各有各的"没起步"，一律写"尚未起炉"会变成丹房那一行也在说炉子
    switch (def.kind) {
      case 'dan-mul': return '一座炉子也没有'
      case 'conv-add': return '火还没点着'
      case 'qi-add': return '丹房还没造'
    }
  }
  switch (def.kind) {
    case 'dan-mul':
      return `出丹 ×${BigNumber.fromLog10(lv * Math.log10(def.power)).format(2, style)}`
    case 'conv-add':
    case 'qi-add':
      return `+${Math.round(def.power * lv * 100)}%`
  }
}

/**
 * 火候三档 —— 炼丹的节奏，不是境界（境界在这游戏里指练气/筑基/金丹，别撞名）。
 * 一炉一炉出丹，每一炉按 `bust` 概率炸炉：炸了那一炉的丹一分不得，改按 `dregMult` 赔成**丹药废渣**。
 * 废渣是凝练转盘的门票，转盘抽的是丹道精神（永久 buff）。
 *
 * 这三档是三种「丹换废渣」的汇率，不是由弱到强：
 * 丹买炉子、炉子第 12 级是结丹线，那条墙的价按 ×30/级 涨，所以丹每一枚都贵；
 * 废渣买的是永久 buff，攒得慢但不竖墙。要冲结丹就静心，要养转盘就狂躁，常态是中间那一格。
 * 三档的期望（按"该出一炉丹"记 1）实测摆在这，`sim/ninglian-check.mjs` 盯着：
 *   静心 丹 0.980 渣 0.024 · 常态 丹 0.799 渣 0.270 · 狂躁 丹 0.540 渣 0.475
 *
 * **中间那格不许被压死**——这条是改表时的硬规矩。火候随时能换，所以玩家可以半炉静心半炉狂躁，
 * 只要"静心↔狂躁"那条直线在常态之上冒出来，常态就是白摆的一格。判据是每多要一份渣所付的丹
 * 一路变贵（这里 0.74 → 1.26 丹/渣），也就是炸炉率要**减速**往上涨、赔率也别加速太狠。
 * 上一版把狂躁的赔率给到 ×5，渣从 0.26 跳到 1.40，中间那格当场被压死——数字好看，账是错的。
 * 两头都算：Lv.0 是一条前沿，守一一路压到地板时三档会挨到一起，所以 `sim` 从 Lv.0 逐层扫到 Lv.20，
 * 每一层都要重新验一遍这两段价钱。
 *
 * 定标那条 12 小时的结丹线量的是**静心不炸炉**那一档（`sim/jindan-anchor.mjs` 跑的是名义速率）；
 * 换成常态要挂 15 小时、狂躁要 22 小时，这是换废渣的代价，不用再反解常数。
 */
export type PillModeId = 'serene' | 'steady' | 'wild'

export interface PillModeDef {
  id: PillModeId
  name: string
  /** 这一炉炼成时，出丹量乘这个数 */
  yieldMult: number
  /** 炸炉概率 */
  bust: number
  /** 炸一炉赔的废渣 = 这一炉**该出的丹** × 这个数 */
  dregMult: number
  /** 面板上那一句大白话 */
  desc: string
}

export const PILL_MODES: PillModeDef[] = [
  { id: 'serene', name: '静心', yieldMult: 1.0, bust: 0.02, dregMult: 1.2, desc: '稳稳当当地炼，几乎不炸炉，一天下来丹最多' },
  { id: 'steady', name: '常态', yieldMult: 0.94, bust: 0.15, dregMult: 1.8, desc: '炉火催快些，炸得多了、赔得也多了' },
  { id: 'wild', name: '狂躁', yieldMult: 0.72, bust: 0.25, dregMult: 1.9, desc: '出丹最少，废渣给得最狠' },
]

/** 起手那一档：不预设玩家读过汇率，先给他中间那格 */
export const DEFAULT_PILL_MODE: PillModeId = 'steady'

export function findPillMode(id: PillModeId | undefined): PillModeDef {
  return PILL_MODES.find((d) => d.id === id) ?? PILL_MODES[1]
}

/** 守一减到底也留 2%：炸炉归零等于废渣这条线归零，转盘不能再没有门票 */
export const BUST_FLOOR = 0.02

/**
 * 丹道精神 —— 凝练转盘上的七道，抽到已抽过的就往上叠一级。
 * 全是从**零起加**的永久 buff：抽到才有、没抽到就是 0，所以每条的起点效果都不小（+5%/级）。
 * 它们只借现有的几条轴出力，不新起算法轴——照根骨与淬炼共用灵气加法轴的先例：
 *  - dan-add   这一炉该出的丹（抬 `金丹丹炉.ts` 的转化率那条加法）
 *  - bust-cut  炸炉率按级乘 0.8 往下减，见 BUST_FLOOR
 *  - dreg-add  炸一炉赔的废渣（抬 PILL_MODES 里的 dregMult）
 *  - qi-add    丹房那条灵气返哺轴（和丹房同一条加数，共用现成的平方根涨价自惩罚）
 *  - energy-add 道基/淬炼那条全部产出加法轴
 *  - auto-cut  系统代买的时间轴（只有这一条是"除"，除完有地板，见 AUTO_BUY_MIN_INTERVAL）
 *  - pass-add  按秒折给玩家的筑基点比例（POINT_PASS_RATE 的乘数，有 cap）
 *
 * weight 是转盘上的份数，和为 100。两条改时间轴的（敏手、定息）只有金丹之后的玩家看得懂，
 * 所以各压到 8 份；武火直接喂结丹那条墙，给到 22 份。
 */
export type SpiritKind =
  | 'dan-add'
  | 'bust-cut'
  | 'dreg-add'
  | 'qi-add'
  | 'energy-add'
  | 'auto-cut'
  | 'pass-add'

export interface SpiritDef {
  id: string
  name: string
  /** 给玩家看的那句，别露实现层的词 */
  effect: string
  kind: SpiritKind
  /** 每级的量：加法的按 power 乘级数，乘法的把 power 当"每级除以它" */
  power: number
  /** 转盘上的份数 */
  weight: number
  /** 只给那两条改时间轴的设顶；其余无顶，墙由抽卡价竖起来 */
  cap?: number
}

export const SPIRITS: SpiritDef[] = [
  { id: 'wuHuo', name: '武火', effect: '再添一把火。每一炉多炼出 5% 丹', kind: 'dan-add', power: 0.05, weight: 22 },
  { id: 'shouYi', name: '守一', effect: '心定炉不炸。每级炸炉率降 20%', kind: 'bust-cut', power: 0.2, weight: 18 },
  { id: 'huiGan', name: '回甘', effect: '炸了也回甘。每级多赔 15% 废渣', kind: 'dreg-add', power: 0.15, weight: 18 },
  { id: 'tongLing', name: '通灵', effect: '丹灵通经脉。每级修行 +5%', kind: 'qi-add', power: 0.05, weight: 14 },
  { id: 'yangQi', name: '养气', effect: '气养周身畅。每级灵气 +5%', kind: 'energy-add', power: 0.05, weight: 12 },
  { id: 'minShou', name: '敏手', effect: '手快如风。代买更快（只能参悟两层）', kind: 'auto-cut', power: 1.33, weight: 8, cap: 2 },
  { id: 'dingXi', name: '定息', effect: '气沉息自定。每秒折的筑基点更多（最多二十层）', kind: 'pass-add', power: 1.25, weight: 8, cap: 20 },
]

/** 抽一次要多少废渣：第 1 次 = 半秒的出丹流量，往后每次 ×1.15 */
export const PULL_BASE_SECONDS = 0.5

/** 抽卡价的涨价。×1.15 比丹炉的 ×30 软得多——转盘不竖墙，只把"多少抽"摊成一条长线 */
export const PULL_GROWTH = 1.15

/** 敏手除到底的地板：0.05 秒已经比一帧还短，再快只是空转 */
export const AUTO_BUY_MIN_INTERVAL = 0.05

/** 转盘那一栏里"这道精神现在给了多少" */
export function spiritCurrent(def: SpiritDef, lv: number, style: NumberStyle = 'letter'): string {
  if (!lv) return '尚未参悟'
  switch (def.kind) {
    case 'dan-add':
    case 'dreg-add':
    case 'qi-add':
    case 'energy-add':
      return `+${Math.round(def.power * lv * 100)}%`
    case 'bust-cut':
      return `炸炉 ×${Math.pow(1 - def.power, lv).toFixed(2)}`
    case 'auto-cut':
      return `快 ${Math.round((Math.pow(def.power, lv) - 1) * 100)}%`
    case 'pass-add':
      return `×${BigNumber.fromLog10(lv * Math.log10(def.power)).format(2, style)}`
  }
}

/**
 * 金丹的挑战 —— 五条"这条链真走过一遍"的凭据，达成就白给一条现成轴上的好处。
 * 摆在丹炉页旁边那一栏，被动生效、没有领取那一步，也没有存档字段：
 * 五条门槛读的全是**只涨不跌**的那几笔账（三条线的等级、累计抽数、七道精神的等级——
 * 结丹和散功都不清它们），所以一旦达成就不会又锁回去。
 *
 * 好处一律借用链上现成的轴（见 `Bonus` 那段），不新起第六条算法轴。落点由 `sim/challenge-check.mjs` 量，
 * 按定标档（灵气/秒 1e24，也就是"结丹线挂满 12 小时"那一档）一路往上挂，五档实测：
 * 三道精神各 20 级要抽 124 次 ≈ 16 小时（正是一整晚那一格），丹房第 35 级约 2 天，火候第 18 级约 4 天，
 * 炉子第 13 级约 10 天，抽满 150 次约 12 天——抽卡那条墙按 ×1.15/次 竖起来，是这五档里最硬的一条。
 * 流量再往上（结层数、起丹房都抬流量）这四档一起缩短，谁也没被摆成"一辈子摸不到"。
 */
export type ChallengeNeed =
  | { kind: 'pill'; line: string; level: number }
  | { kind: 'pulls'; count: number }
  | /** 任意 of 道精神各参悟到 each 级 */ { kind: 'spirits'; each: number; of: number }

export interface ChallengeDef {
  id: string
  name: string
  need: ChallengeNeed
  /** 界面上念的那句达成条件 */
  hint: string
  /** 达成之后白给什么，玩家看得懂的那句 */
  reward: string
  bonus: Bonus
}

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'luHuoChunQing',
    name: '炉火纯青',
    need: { kind: 'pill', line: 'danLu', level: 13 },
    hint: '丹炉炼到第 13 级',
    reward: '每一炉的丹 +25%',
    bonus: { danAdd: 0.25 },
  },
  {
    id: 'huoHouDaoJia',
    name: '火候到家',
    need: { kind: 'pill', line: 'huoHou', level: 18 },
    hint: '火候炼到第 18 级',
    reward: '每秒进的筑基点 1.50 倍',
    bonus: { passMul: 1.5 },
  },
  {
    id: 'danFangGuangKai',
    name: '丹房广开',
    need: { kind: 'pill', line: 'danFang', level: 35 },
    hint: '丹房炼到第 35 级',
    reward: '丹炼回灵气 +25%',
    bonus: { qiAdd: 0.25 },
  },
  {
    id: 'baiZhuanChengZha',
    name: '百转成渣',
    need: { kind: 'pulls', count: 150 },
    hint: '累计凝练转过 150 次',
    reward: '炸炉赔的废渣 1.50 倍',
    bonus: { dregMul: 1.5 },
  },
  {
    id: 'wenWuJianXiu',
    name: '文武兼修',
    need: { kind: 'spirits', each: 20, of: 3 },
    hint: '任意三道丹道精神各参悟到第 20 级',
    reward: '灵气产出 +25%',
    bonus: { energyAdd: 0.25 },
  },
]

/**
 * 结丹的里程碑 —— 层数本身已经给"全部灵气产出 ×(1+层数)"那笔大账（`JIEDAN_RETURN_PER`），
 * 这一栏只在几个台阶上再补一笔现成轴上的好处，让每一层不止是"下一世短一截"。
 * 台阶摆得开的理由是层数越往上越费灵气：每一层都要重新把手上的灵气攒回 1e30 那道线，
 * 而下一世的长度严格除以 (1+层数)，所以第 8 层大约只是第 1 层的几分之一那么久。
 */
export interface MilestoneDef {
  id: string
  /** 已结成第几层丹才算这一档 */
  layer: number
  reward: string
  bonus: Bonus
}

export const JINDAN_MILESTONES: MilestoneDef[] = [
  { id: 'msLayer1', layer: 1, reward: '每一炉的丹 +10%', bonus: { danAdd: 0.1 } },
  { id: 'msLayer2', layer: 2, reward: '炸炉赔的废渣 1.25 倍', bonus: { dregMul: 1.25 } },
  { id: 'msLayer3', layer: 3, reward: '丹炼回灵气 +15%', bonus: { qiAdd: 0.15 } },
  { id: 'msLayer5', layer: 5, reward: '灵气产出 +25%', bonus: { energyAdd: 0.25 } },
  { id: 'msLayer8', layer: 8, reward: '每秒进的筑基点 1.50 倍', bonus: { passMul: 1.5 } },
]

