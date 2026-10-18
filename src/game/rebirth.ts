import type { BigNumber } from './BigNumber'

/**
 * 转生的数学：花多少点、一世折算多少点、悟性怎么削涨价。
 * 树里那三条（道基/灵根/悟性）的数值定义在 [词条与属性.ts](./词条与属性.ts)。
 */

/** 涨价幅度砍到底也得留 1.25 倍/级，再低法门就成降价商品，价格墙直接塌掉 */
export const MIN_GROWTH = 1.25

/**
 * 削减最多砍掉多少"log10 涨幅"。三分之一 → 每级涨价最多从 g 降到 g^(2/3)。
 *
 * 这条线不是手感，是**存在性**。乘法法门（聚灵阵眼 ×2.03/级、周天运转 ×1.53/级、
 * 凝气成珠 ×1.1/级）的自限性全靠一个量：
 *
 *     E = log10(每级收益) / log10(每级涨价)
 *
 * 攒得住的前提是三条 E 之和 < 1——低于 1 时"等级 ∝ log(流量)"，流量有一个不动点；
 * 一旦等于 1 以上，"每级只花 g 倍、却换回 p 倍"，买得越多越赚，等级与流量互相抬，
 * 没有任何东西能停住它。原来靠 `MIN_GROWTH = 1.25` 兜底是**不够的**：E 的分母是每级涨价，
 * 而 1.25 比法门的收益倍率（2.03 / 1.53）还小，等于允许"越买越赚"。
 *
 * 实测：悟性 + 玄铜镜的削减到 79% 时 ΣE 就摸到 1.007，之后灵气在一小时里从 1e87 冲到 1e5000000
 * （F500 那一档）。把 log 涨幅的削减锁在三分之一，ΣE 顶到 1.5 × 0.432 = 0.65，
 * 不动点被按回来了，同时悟性仍能给出 60% 上下的真实折扣（见 `sim/rebirth-cut-check.mjs`）。
 */
export const MAX_LOG_CUT = 1 / 3

/** 第 lv+1 层的开销：1 筑基点起步，每层 ×1.5 */
export function rebirthCost(lv: number): number {
  return Math.max(1, Math.ceil(Math.pow(1.5, lv)))
}

/** 每多攒出一个数量级给几点。取 3 是模拟夹出来的：前三世就算硬挂到 1e13 也只到 9 点，落在 1–10 区间里 */
export const POINTS_PER_DECADE = 3

/** 破一次境，前世之道多折算 0.25 个数量级；记满 8 世封顶（等于 +2 个数量级、也就是 +6 点） */
export const LOOP_ECHO = 0.25
export const LOOP_ECHO_CAP = 8

/**
 * 这一世折算出的筑基点——按**比破境门槛多攒出多少个数量级**结算，不是按绝对累计。
 *
 * `over = log10(本世累计) − log10(门槛) + 0.25 × min(已破境次数, 8)`，点数 = `3 × over` 向下取整、最少 1：
 *  摸到门槛就破（空树一世约 20 分钟，累计都是 1e10.7）→ **2 点**
 *  多攒到 1e11 / 1e12 / 1e13 → 3 / 6 / 9 点
 * 上不封顶，多攒一个数量级就固定多 3 点。
 *
 * 为什么改成线性：模拟发现"手上够到门槛就破"那一刻的 over **一世一世几乎不变**（树空 0.72、树满 0.77），
 * 所以纯靠 over 的公式不管几次方，在玩家眼里都是一个定数。线性把"多挂一会儿"变成稳定的加价
 * （一个数量级 3 点，不像平方那样越往后越离谱），`LOOP_ECHO` 再让下一次破境比上一次容易多拿一点；
 * 两样合起来才既随灵气涨、又一世比一世厚。道行加成封顶在 8 世，为的是让后期的头仍归"这一世攒了多少灵气"。
 *
 * 另一个口径"按灵气绝对值线性给"试过就否了：法门等级无上限，挂一周能堆到 1e30，
 * 那一下就是几十万点，根骨树当天见底。
 */
export function pointsForLoop(loop: BigNumber, gate: BigNumber, loops = 0): number {
  const over = loop.log10() - gate.log10() + LOOP_ECHO * Math.min(Math.max(loops, 0), LOOP_ECHO_CAP)
  // 够不到门槛就一世无成：破境条件保证真结算时 over ≥ 0，这里只是别让负数翻上去
  if (over < 0) return 0
  return Math.max(1, Math.floor(POINTS_PER_DECADE * over))
}

/**
 * 该法门的实际涨价幅度：悟性与玄铜镜砍的是百分比。
 * 两道地板取高的那道：`MIN_GROWTH` 防"越买越便宜"，`growth^(1-MAX_LOG_CUT)` 防"越买越赚"。
 */
export function growthCutOf(cut: number, growth: number): number {
  return Math.max(growth * (1 - cut), MIN_GROWTH, Math.pow(growth, 1 - MAX_LOG_CUT))
}
