/**
 * BigNumber —— 为增量游戏设计的大数系统。
 *
 * 用「尾数 + 指数」表示任意大的数：value = mantissa * 10^exponent，
 * 其中 mantissa ∈ [1, 10)，exponent 为 double（上限约 1e308）。
 *
 * 显示记法（中文修仙语境）由调用方选：
 *   - 字母计数法 letter      ：每 3 个数量级进一位；K…No 之后接 aa、ab…zz，再往上退回科学计数
 *   - 科学计数法 scientific  ：1e7 之前保持普通数字，之后写成 1.23e7
 *   - 两者共用的大数尾巴：
 *       < 1e1000  ：科学计数 1.23e456
 *       指数 <1e6 ：E 记法，如 1.50E100000（即 1.5 × 10^100000）
 *       指数≥1e6  ：F 记法，如 2.00F100（即 2 × 10^(100×10^6) = 2e1e8），
 *                   之后每 1e6 进一位字母：F → G → H …
 */

/** 数字显示记法，供玩家在设置里切换 */
export type NumberStyle = 'letter' | 'scientific'

/** 科学计数法的切换阈值：1e7 以下玩家更想看清具体数字 */
const SCIENTIFIC_FROM = 7

/** 单字母段：K 对应 1e3 … No 对应 1e30 */
const LETTERS = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No']
/** 双字母段从第 11 级（1e33）起，aa → zz 一共 676 级 */
const LETTER_DOUBLE_FROM = LETTERS.length + 1
const LETTER_DOUBLE_COUNT = 26 * 26
const LETTER_MAX_TIER = LETTER_DOUBLE_FROM + LETTER_DOUBLE_COUNT - 1
const TIER_LETTERS = 'EFGHIJKLMNOPQRSTUVWXYZ'

export class BigNumber {
  /** 尾数，规范到 [1, 10) */
  m: number
  /** 指数，double，可为 0 */
  e: number

  constructor(m = 0, e = 0) {
    this.m = m
    this.e = e
    this.normalize()
  }

  static zero(): BigNumber {
    return new BigNumber(0, 0)
  }

  static from(n: number): BigNumber {
    return new BigNumber(n, 0)
  }

  /** 由 log10 值构造，用于 price = base × growth^level 这类指数级公式 */
  static fromLog10(log: number): BigNumber {
    if (!Number.isFinite(log)) return new BigNumber(1, Number.MAX_VALUE)
    const e = Math.floor(log)
    return new BigNumber(Math.pow(10, log - e), e)
  }

  clone(): BigNumber {
    return new BigNumber(this.m, this.e)
  }

  /** 归一化：保证 1 ≤ m < 10，并处理 0。内部使用，不加 private 以便穿过 Vue 的响应式代理 */
  normalize(): void {
    if (this.m === 0 || !Number.isFinite(this.m)) {
      this.m = 0
      this.e = 0
      return
    }
    if (!Number.isFinite(this.e)) {
      // 指数溢出（达到 double 上限），按极限值处理
      this.e = Number.MAX_VALUE
      return
    }
    const exp = Math.floor(Math.log10(Math.abs(this.m)))
    if (exp !== 0) {
      this.m /= Math.pow(10, exp)
      this.e += exp
    }
    // 修正浮点误差：m 可能略微越界
    if (Math.abs(this.m) >= 10) {
      this.m /= 10
      this.e += 1
    } else if (Math.abs(this.m) < 1 && this.m !== 0) {
      this.m *= 10
      this.e -= 1
    }
  }

  get isZero(): boolean {
    return this.m === 0
  }

  cmp(other: BigNumber): number {
    if (this.isZero && other.isZero) return 0
    if (this.isZero) return -1
    if (other.isZero) return 1
    if (this.e !== other.e) return this.e < other.e ? -1 : 1
    return this.m < other.m ? -1 : this.m > other.m ? 1 : 0
  }

  /** 加法：增量游戏最常用的运算 */
  add(other: BigNumber): BigNumber {
    if (other.isZero) return this.clone()
    if (this.isZero) return other.clone()
    if (this.e === other.e) {
      return new BigNumber(this.m + other.m, this.e)
    }
    const diff = Math.abs(this.e - other.e)
    // 差距超过 15 个数量级时，小项无意义
    if (diff > 15) {
      return this.e > other.e ? this.clone() : other.clone()
    }
    const [big, small] = this.e > other.e ? [this, other] : [other, this]
    return new BigNumber(big.m + small.m / Math.pow(10, diff), big.e)
  }

  /** 加上一个小数（来自每次 tick 的时间片收益） */
  addNumber(n: number): BigNumber {
    return this.add(new BigNumber(n, 0))
  }

  mulNumber(n: number): BigNumber {
    return new BigNumber(this.m * n, this.e)
  }

  mul(other: BigNumber): BigNumber {
    if (this.isZero || other.isZero) return BigNumber.zero()
    return new BigNumber(this.m * other.m, this.e + other.e)
  }

  /** 减法；增量游戏里只用于"花得起才扣"，结果为负时归零 */
  sub(other: BigNumber): BigNumber {
    if (other.isZero) return this.clone()
    if (this.cmp(other) <= 0) return BigNumber.zero()
    const diff = this.e - other.e
    if (diff > 15) return this.clone()
    if (diff === 0) return new BigNumber(this.m - other.m, this.e)
    return new BigNumber(this.m - other.m / Math.pow(10, diff), this.e)
  }

  gte(other: BigNumber): boolean {
    return this.cmp(other) >= 0
  }

  gt(other: BigNumber): boolean {
    return this.cmp(other) > 0
  }

  log10(): number {
    return this.isZero ? -Infinity : Math.log10(this.m) + this.e
  }

  toNumber(): number {
    if (this.isZero) return 0
    if (this.e > 308) return Infinity
    return this.m * Math.pow(10, this.e)
  }

  /**
   * 格式化输出。
   * @param decimals 小数位数（默认 2）
   * @param style    显示记法，默认字母计数法
   */
  format(decimals = 2, style: NumberStyle = 'letter'): string {
    // 字母记法整条交给 formatLetter；传 log10 是为了 1e308 以上的数不先溢出成 Infinity
    if (style === 'letter') {
      return this.isZero ? formatLetter(0, false, decimals) : formatLetter(this.log10(), true, decimals)
    }
    if (this.isZero) return '0'
    if (this.e < 0) return this.toNumber().toFixed(decimals)
    // 1e7 以下保持能一眼读出的普通写法
    if (this.e < SCIENTIFIC_FROM) {
      const v = this.toNumber()
      // 整数部分不截断，小数最多 decimals 位
      return v.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: v < 100 ? decimals : 0,
      })
    }
    return scientificTail(this.m, this.e, decimals)
  }
}

/**
 * 每 3 个数量级进一档的后缀：1 档 K（1e3）… 10 档 No（1e30），
 * 11 档起改用两位小写字母 aa（1e33）… zz（1e2058），再往上没有后缀。
 */
function letterSuffix(tier: number): string | null {
  if (tier >= 1 && tier <= LETTERS.length) return LETTERS[tier - 1]
  if (tier >= LETTER_DOUBLE_FROM && tier <= LETTER_MAX_TIER) {
    const i = tier - LETTER_DOUBLE_FROM
    return String.fromCharCode(97 + Math.floor(i / 26), 97 + (i % 26))
  }
  return null
}

/**
 * 字母计数法的唯一出口。纯函数，不读状态。
 * @param value   原始数值，或 log10 值
 * @param isLog10 传入的是否为 log10 值（大数用这个避免溢出）
 * @param decimals 保留小数位，默认 2
 */
export function formatLetter(value: number, isLog10 = false, decimals = 2): string {
  let log: number
  if (isLog10) {
    log = value
  } else if (value === 0) {
    return (0).toFixed(decimals)
  } else if (value < 0) {
    return `-${formatLetter(-value, false, decimals)}`
  } else {
    log = Math.log10(value)
  }

  if (!Number.isFinite(log)) {
    if (log > 0) return '∞'
    return (0).toFixed(decimals)
  }

  // 不到 1e3 就直接写出来，整数部分不进字母档
  if (log < 3) {
    const text = Math.pow(10, log).toFixed(decimals)
    // 999.999… 四舍五入成 1000.00 时挪进 K 档，保证整数部分落在 1~999
    return Number(text) >= 1000 ? `${(1).toFixed(decimals)}K` : text
  }

  const tier = Math.floor(log / 3)
  const suffix = tier <= LETTER_MAX_TIER ? letterSuffix(tier) : null
  if (!suffix) {
    const e = Math.floor(log)
    return scientificTail(Math.pow(10, log - e), e, decimals)
  }

  // 尾数按 log10 回算，能落在 1~999 之间，也不会因为原始数值太大而溢出
  let mantissa = Math.pow(10, log - tier * 3)
  let text = mantissa.toFixed(decimals)
  if (Number(text) >= 1000) {
    // 四舍五入把 999.99 顶成 1000.00，整档进一位
    mantissa /= 1000
    text = mantissa.toFixed(decimals)
    const next = letterSuffix(tier + 1)
    if (!next) {
      const e = Math.floor(log)
      return scientificTail(Math.pow(10, log - e), e, decimals)
    }
    return `${text}${next}`
  }
  return `${text}${suffix}`
}

/** 字母段到顶之后（以及科学记法本身）共用的大数尾巴 */
function scientificTail(mantissa: number, exponent: number, decimals: number): string {
  // 指数自身 ≥ 1e6 时，用 F/G/H… 级联记法
  if (exponent >= 1e6) {
    const tierIdx = Math.floor(Math.log10(exponent) / 6) // 0 → F
    const tierExp = Math.pow(10, tierIdx * 6)
    const head = TIER_LETTERS[Math.min(tierIdx, TIER_LETTERS.length - 1)]
    const expRemain = exponent / tierExp // 落在 [1, 1e6) 内
    return `${trim(mantissa, decimals)}${head}${trim(expRemain, decimals)}`
  }
  // 1e1000 之前用普通科学计数，之后进入 E 记法
  if (exponent < 1000) return `${trim(mantissa, decimals)}e${exponent}`
  return `${trim(mantissa, decimals)}E${formatExponent(exponent)}`
}

/** 去除小数末尾多余的零 */
function trim(n: number, decimals: number): string {
  const s = n.toFixed(decimals)
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

/** E 记法的指数按整数原样输出，避免与小数千分位混淆 */
function formatExponent(e: number): string {
  return String(Math.floor(e))
}
