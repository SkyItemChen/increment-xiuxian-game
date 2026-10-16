import { BigNumber } from './BigNumber'
import type { UpgradeDef } from './词条与属性'
import { LIANQI_UPGRADES, POINT_PASS_UNLOCK_QI } from './词条与属性'

/** 境界标签页里摆的内容 */
export type RealmPage =
  /** 吐纳 + 法门 + 破境，灵气从这里来 */
  | 'cultivate'
  /** 转生树，花筑基点 */
  | 'rebirth'
  /** 丹炉三条线，花丹；结丹那颗按钮也在这页 */
  | 'pill'
  /** 内容还没做，只给一句占位文案 */
  | 'todo'

export interface Realm {
  id: string
  name: string
  /** 内容还没做时的占位文案 */
  teaser: string
  /** 突破到此境界所需的存量灵气；练气为 null 表示入门即得 */
  breakThrough: BigNumber | null
  page: RealmPage
  /** 本境界的法门；只在 page 为 cultivate 时有内容 */
  upgrades: UpgradeDef[]
}

/**
 * 修行只发生在练气这一页：一世攒够灵气就在那儿破境转生，破完回到练气重攒，
 * 筑基页专职花筑基点。所以 realmIndex 只表示"标签开到第几境"，修行境的破境永远只往筑基那一档结算——
 * 金丹往上要按各自那一层的资源算，丹炉链已接上（page 为 'pill'），元婴往上的链还没做。
 *
 * 转生线 1e10 是模拟定下来的实数：练气一世约 40 分钟摸到它。
 * 金丹压在 1e30（同一个数登记在 `词条与属性.ts` 的 `POINT_PASS_UNLOCK_QI`，成就与这条线共用；`sim/jindan.mjs 30` 量的）：筑基层灵气没有别的去处，境界阈值买的其实是"这一世要挂多久不动"，
 * 而主循环把一次帧长夹在 1 小时，所以门槛得落在挂得动的区间里。满法宝各档实测：刚解锁探索 63 天（明说这时候不许结丹），
 * 法宝刚收齐 21.7 小时、有「不取一毫」3 小时（睡前挂一晚回来能结丹），再往上的树只剩几分钟——它是筑基毕业的盖章，不是又一次爬坡。
 * 1e30 从此是**保底**：结丹真正要过的是丹炉那条链（门槛 = 丹炉第 12 级，见 `词条与属性.ts` 文末与 `sim/jindan-anchor.mjs`），
 * 灵气这条只管"开不开得起炉"，两条一条管存量、一条管流量。丹炉链的运行时接好后，金丹这一页就是那条链的面板。
 *
 * 再往上的境界按**指数翻倍**排：1e30 → 1e100 → 1e300 → 1e600 → 1e1200 → 1e2400 → 1e4800。
 * 这不是拍出来的美观，是这条曲线的用途：相邻两境的跨度按 70 → 200 → 300 → 600 → 1200 → 2400 个数量级涨，
 * 同一台机器挂到死也凑不出下一个跨度，所以**每一境都必须新开一条链**（丹 → 器 → 阵 → …），
 * 靠新链自己的复利才走得动。数值上这些还是占位阈值，等每境的链做出来再按金丹同样的口径实测一遍。
 * 超过 1e308 就不能再写 `BigNumber.from(1e4800)`——那个字面量是 Infinity——所以一律走 `fromLog10`；
 * double 的指数字段本身能撑到 1e308，显示上 1e1000 起进 E 记法、指数再过 1e6 进 F/G（见 `BigNumber.ts` 头注）。
 */
export const REALMS: Realm[] = [
  { id: 'lianqi', name: '练气', breakThrough: null, page: 'cultivate', upgrades: LIANQI_UPGRADES,
    teaser: '引气入体，踏入仙途的第一步。' },
  { id: 'zhuji', name: '筑基', breakThrough: BigNumber.from(1e10), page: 'rebirth', upgrades: [],
    teaser: '筑基成，方可纳灵气于丹田不散。' },
  { id: 'jindan', name: '金丹', breakThrough: BigNumber.from(POINT_PASS_UNLOCK_QI), page: 'pill', upgrades: [],
    teaser: '金丹凝结，寿元大增。' },
  { id: 'yuanying', name: '元婴', breakThrough: BigNumber.fromLog10(100), page: 'todo', upgrades: [],
    teaser: '元婴出窍，神游太虚。' },
  { id: 'huashen', name: '化神', breakThrough: BigNumber.fromLog10(300), page: 'todo', upgrades: [],
    teaser: '化神之后，可窥天地法则。' },
  { id: 'lianxu', name: '炼虚', breakThrough: BigNumber.fromLog10(600), page: 'todo', upgrades: [],
    teaser: '炼虚合道，一念万里。' },
  { id: 'heti', name: '合体', breakThrough: BigNumber.fromLog10(1200), page: 'todo', upgrades: [],
    teaser: '精气神三者合一。' },
  { id: 'dacheng', name: '大乘', breakThrough: BigNumber.fromLog10(2400), page: 'todo', upgrades: [],
    teaser: '大乘圆满，只欠一步。' },
  { id: 'dujie', name: '渡劫', breakThrough: BigNumber.fromLog10(4800), page: 'todo', upgrades: [],
    teaser: '渡得过是仙，渡不过是灰。' },
]

/** 修行的那一境：灵气、法门、破境按钮都归它，一世一世在这里循环 */
export const CULTIVATE_INDEX = 0

/** 已开放标签页的境界（逐级开放，不跳级） */
export function visibleRealms(realmIndex: number): Realm[] {
  return REALMS.slice(0, Math.min(realmIndex + 1, REALMS.length))
}

/** 从 realmIndex 再进一步要突破到的境界；已至渡劫则 null */
export function nextRealm(realmIndex: number): Realm | null {
  return REALMS[realmIndex + 1] ?? null
}

/** 修行境往哪一境破——也就是转生的目标境界，一世一世都是它 */
export function breakRealm(): Realm | null {
  return nextRealm(CULTIVATE_INDEX)
}

export function findRealm(id: string): Realm | undefined {
  return REALMS.find((r) => r.id === id)
}
