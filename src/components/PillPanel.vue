<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  buyAllPill,
  buyPill,
  fmt,
  fmtNum,
  jindanBreak,
  jindanState,
  jindanTreePoints,
  needJindanConfirm,
  pillBatch,
  pillBuyIds,
  pillRows,
  previewJindan,
  setPillMode,
  shown,
  state,
  type JindanPreview,
  type PillBatchQuote,
  type PillQuote,
} from '../game/state'
import { pillCurrent, PILL_MODES, type PillModeId } from '../game/词条与属性'
import JindanDialog from './JindanDialog.vue'
import ChallengePanel from './ChallengePanel.vue'
import JindanTreePanel from './JindanTreePanel.vue'
import NinglianPanel from './NinglianPanel.vue'

/**
 * 金丹页 = 丹炉三条线 + 火候三档 + 凝练转盘 + 挑战与结丹里程碑 + 丹纹四枝。
 * 灵气进炉出丹，丹买炉子、火候、丹房；炸炉赔出来的废渣抽丹道精神。
 * 炉子炼到第 12 级、手上又攒够那一世灵气，才结得成丹——结丹永远亲手按。
 * 旁边那一栏「挑战」摆的是走过一遍这条链之后白给的好处，被动生效、不用领取；
 * 「丹纹」吃的是结丹层数与里程碑发下的点数，先点哪一枝由玩家自己挑。
 */
const subTab = ref<'furnace' | 'ninglian' | 'challenge' | 'tree'>('furnace')

const danText = computed(() => fmt(shown.dan))
const danRateText = computed(() => fmt(state.danPerSecond))
const dregText = computed(() => fmt(shown.dreg))
const spiritText = computed(() => fmt(shown.spirit))
const layerText = computed(() => fmtNum(state.jindan))

/** 火候那一排：三档并排，选中那档的效果与炸炉率写在下面一句 */
const batch = computed<PillBatchQuote>(() => pillBatch())
const bustText = computed(() => `${(batch.value.bust * 100).toFixed(0)}%`)
/** 守一压到地板时，三档的炸炉率变成同一个数——不说这句，玩家以为火候按钮坏了 */
const flooredText = computed(() => (batch.value.floored ? '（守一压到底了，三档一样稳）' : ''))
const batchDanText = computed(() => fmt(batch.value.dan))
const batchDregText = computed(() => fmt(batch.value.dreg))
const modeDesc = computed(() => batch.value.mode.desc)
const progressWidth = computed(() => `${Math.round(state.pillProgress * 100)}%`)

function pickMode(id: PillModeId): void {
  setPillMode(id)
}

const rows = computed<PillQuote[]>(() => pillRows())
// 亮不亮看的是同一份口径：结丹线之前丹房买不动，别让它一个人把按钮点亮
const canBuyAll = computed(() => {
  const ids = pillBuyIds()
  return rows.value.some((r) => ids.includes(r.def.id) && r.maxLevels >= 1)
})

const gate = computed(() => jindanState())
const lacking = computed(() => Math.max(0, gate.value.need - gate.value.furnace))

const fasterText = computed(() => {
  const n = gate.value.mult - 1
  return n <= 1 ? '快一倍' : `快 ${fmtNum(n)} 倍`
})

/** 秒数写法：仪式动辄两三分钟，别把 147 直接甩出来 */
function secText(s: number): string {
  if (!Number.isFinite(s)) return '—'
  if (s < 90) return `${Math.round(s)} 秒`
  return `${(s / 60).toFixed(1)} 分`
}

/** 差几级炉子就说炉子，炉子够了才轮到灵气与丹——三道闸别混成一句"还没到" */
const gateSubText = computed(() => {
  const g = gate.value
  if (g.ready) return `结为第 ${state.jindan + 1} 层金丹 · 往后修行${fasterText.value}`
  if (lacking.value > 0) return `丹炉要炼到第 ${g.need} 级，还差 ${lacking.value} 级`
  if (!g.danFloor.isZero && !state.dan.gte(g.danFloor)) {
    return `还要焚 ${fmt(g.danFloor)} 丹（约 ${secText(g.danRitualSeconds)} 丹产）`
  }
  return `手上要有 ${fmt(g.floor)} 灵气（约 ${secText(g.ritualSeconds)} 产量）`
})

/** 炉子还差几级是整数刻度，够了之后改看灵气 / 丹那条 log 进度 */
const gateProgress = computed(() => {
  const g = gate.value
  if (g.ready) return 100
  if (lacking.value > 0) return Math.round((g.furnace / g.need) * 100)
  if (!g.danFloor.isZero && !state.dan.gte(g.danFloor)) {
    const ratio = state.dan.log10() / g.danFloor.log10()
    return Math.round(Math.min(Math.max(ratio, 0), 1) * 100)
  }
  const ratio = shown.spirit.log10() / g.floor.log10()
  return Math.round(Math.min(Math.max(ratio, 0), 1) * 100)
})

/**
 * 老档提醒：0.17 的丹纹对结丹没有收益，很多玩家的 97 点一分没点。
 * 0.18 之后这 97 点直接压着门槛，所以"一层都没点"必须显式喊一声，
 * 否则他们读档只会觉得"怎么突然变慢了"。
 */
const unspentText = computed(() => {
  const g = gate.value
  if (g.depth > 0 || state.jindan < 2) return ''
  const points = jindanTreePoints()
  if (points < 1) return ''
  return `手上 ${points} 点丹纹一分没点：结丹仪式要 ${secText(g.ritualSeconds)}，去丹纹页点掉能立刻缩短`
})

/**
 * 结丹成本那行：门槛 = max(老阶梯, 历史最高产量 × 仪式秒数)，再单列一道丹闸。
 * 这里必须把"约几分钟产量"念出来——绝对数字（1e65 还是 1e35）对玩家没有意义，
 * 有意义的是"按下去之前要攒多久"，以及"丹纹能把这几分钟压到多少"。
 */
const costText = computed(() => {
  const g = gate.value
  const qi = `门槛 ${fmt(g.floor)} 灵气（约 ${secText(g.ritualSeconds)} 产量）`
  const dan = g.danFloor.isZero ? '丹闸未开' : `焚 ${fmt(g.danFloor)} 丹（约 ${secText(g.danRitualSeconds)} 丹产）`
  return `第 ${g.layer} 层 · ${qi} · ${dan}`
})

/** 下一级还要等多久。这一段是丹炉页唯一真正要念的数，别写成"买不起" */
function etaText(s: number): string {
  if (!Number.isFinite(s)) return '这一格还早'
  if (s <= 0) return '这一格现成'
  if (s < 60) return `${Math.ceil(s)} 秒`
  if (s < 3600) return `${(s / 60).toFixed(1)} 分`
  if (s < 86400) return `${(s / 3600).toFixed(1)} 小时`
  const day = s / 86400
  if (day < 365) return `${day.toFixed(1)} 天`
  const year = day / 365
  if (year < 1e4) return `${Math.round(year).toLocaleString('en-US')} 年`
  if (year < 1e8) return `${(year / 1e4).toFixed(1)} 万年`
  if (year < 1e12) return `${(year / 1e8).toFixed(1)} 亿年`
  // 再往上就是"这一世肯定轮不到"的意思了，位数别失控
  return `${(year / 1e12).toExponential(1)} 兆年`
}

function currentText(row: PillQuote): string {
  return pillCurrent(row.def, row.level, state.settings.numberFormat)
}

const preview = ref<JindanPreview | null>(null)

function onJindan(): void {
  // 结成过一层就不再摆字据，但这一世仍然是玩家这一下按掉的
  if (!needJindanConfirm()) {
    onConfirmJindan()
    return
  }
  preview.value = previewJindan()
}

function onConfirmJindan(): void {
  preview.value = null
  jindanBreak()
}
</script>

<template>
  <div class="jindan">
    <nav class="sub-tabs" aria-label="金丹">
      <button
        type="button"
        class="sub-tab"
        :class="{ on: subTab === 'furnace' }"
        @click="subTab = 'furnace'"
      >丹 炉</button>
      <button
        type="button"
        class="sub-tab"
        :class="{ on: subTab === 'ninglian' }"
        @click="subTab = 'ninglian'"
      >凝 练</button>
      <button
        type="button"
        class="sub-tab"
        :class="{ on: subTab === 'challenge' }"
        @click="subTab = 'challenge'"
      >挑 战</button>
      <button
        type="button"
        class="sub-tab"
        :class="{ on: subTab === 'tree' }"
        @click="subTab = 'tree'"
      >丹 纹</button>
    </nav>

    <NinglianPanel v-if="subTab === 'ninglian'" @back="subTab = 'furnace'" />
    <ChallengePanel v-else-if="subTab === 'challenge'" @back="subTab = 'furnace'" />
    <JindanTreePanel v-else-if="subTab === 'tree'" @back="subTab = 'furnace'" />

    <div v-else class="pill">
      <section class="column core">
        <div class="wallets">
          <div class="wallet">
            <p class="wallet-label">丹</p>
            <p class="wallet-value">{{ danText }}</p>
            <p class="wallet-rate">炼成一炉 {{ batchDanText }}</p>
          </div>
          <div class="wallet aside">
            <p class="wallet-label">废 渣</p>
            <p class="wallet-value small">{{ dregText }}</p>
            <p class="wallet-rate">每秒出 {{ danRateText }} 丹</p>
          </div>
        </div>

        <div class="fire">
          <div class="modes" role="group" aria-label="火候">
            <button
              v-for="m in PILL_MODES"
              :key="m.id"
              type="button"
              class="mode"
              :class="{ on: batch.mode.id === m.id }"
              @click="pickMode(m.id)"
            >{{ m.name }}</button>
          </div>
          <p class="fire-line">
            {{ modeDesc }} · 一炉 {{ batchDanText }} 丹 · 炸炉率 <b>{{ bustText }}</b>{{ flooredText }} · 炸了赔 {{ batchDregText }} 废渣
          </p>
          <div
            class="batch-bar"
            role="progressbar"
            :aria-valuenow="Math.round(state.pillProgress * 100)"
            aria-label="这一炉炼到几成"
          >
            <i :style="{ width: progressWidth }"></i>
          </div>
          <p class="batch-note">
            {{ batch.mode.id === 'serene' ? '这一档出丹最多，结丹线量的就是它。' : '要赶结丹就切回静心，那一档出丹最多。' }}
            进度条走满一炉就结算一次。
          </p>
        </div>

        <p class="ledger">
          手上灵气 {{ spiritText }}<br />
          已结金丹 <b>{{ layerText }}</b> 层
        </p>

        <div class="gate">
          <button
            class="jiedan"
            type="button"
            :class="{ ready: gate.ready }"
            :disabled="!gate.ready"
            @click="onJindan"
          >
            <span class="break-label">结 丹</span>
            <span class="break-sub">{{ gateSubText }}</span>
          </button>
          <span class="gate-bar"><i :style="{ width: `${gateProgress}%` }"></i></span>
          <p class="gate-note">
            散掉的是这一世的灵气、丹与法门修为；炉子、丹房、根骨、法宝、废渣一分不动。
          </p>
          <p class="gate-note cost">{{ costText }}</p>
          <p v-if="unspentText" class="gate-note warn">{{ unspentText }}</p>
        </div>
      </section>

      <section class="column side">
        <div class="head">
          <h2 class="heading">丹 炉</h2>
          <button
            class="all"
            type="button"
            :class="{ ready: canBuyAll }"
            :disabled="!canBuyAll"
            @click="buyAllPill()"
          >一 键 购 买</button>
        </div>
        <ul class="list">
          <li v-for="row in rows" :key="row.def.id" class="item">
            <div class="info">
              <p class="name">
                {{ row.def.name }}
                <span class="lv">Lv.{{ row.level }}</span>
              </p>
              <p class="effect">{{ row.def.effect }} · 当前 {{ currentText(row) }}</p>
              <p class="wait">{{ etaText(row.wait) }}</p>
            </div>
            <div class="buys">
              <button
                class="buy"
                type="button"
                :class="{ ready: state.dan.gte(row.cost) }"
                :disabled="!state.dan.gte(row.cost)"
                @click="buyPill(row.def.id, 1)"
              >{{ fmt(row.cost) }} 丹</button>
              <button
                class="buy"
                type="button"
                :class="{ ready: row.maxLevels >= 1 }"
                :disabled="row.maxLevels < 1"
                @click="buyPill(row.def.id, 'max')"
              >最 大</button>
            </div>
          </li>
        </ul>
        <p class="note">
          丹炉的价按你练得最猛的那一阵算，故意放慢不会占便宜。越往后每一格要等得越久，
          炉子那一行涨得最快。
        </p>
        <p class="note">
          丹房不直接多出丹，先把丹花在它身上会拖慢结丹，所以炉子炼到第 {{ gate.need }} 级之前，
          一键不替你起丹房；过了这一道线，一键就顺手把它一起添上。
        </p>
        <p class="note">
          要废渣就去旁边「凝练」那一页抽丹道精神。挑狂躁炼得最野、赔得最多，
          只是那一档出的丹少，结丹要等得更久。
        </p>
      </section>
    </div>

    <JindanDialog
      v-if="preview"
      :preview="preview"
      @cancel="preview = null"
      @confirm="onConfirmJindan"
    />
  </div>
</template>

<style scoped>
.jindan {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 子标签：和筑基页那两个是同一排，摆在这页内容上方 */
.sub-tabs {
  display: flex;
  gap: 8px;
  flex: none;
}

.sub-tab {
  cursor: pointer;
  padding: 6px 20px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--ink-dim);
  font-size: 13px;
  letter-spacing: 3px;
  text-indent: 3px;
  font-family: var(--font-kai);
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.sub-tab:hover {
  color: var(--ink);
}

.sub-tab.on {
  border-color: var(--accent-line);
  background: var(--accent-wash);
  color: var(--accent-deep);
}

.pill {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 22px;
  align-content: start;
}

.column {
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
}

.core {
  padding: 26px 30px;
  text-align: center;
}

.side {
  padding: 24px 24px 26px;
}

/* 横屏：左边丹与结丹，右边三条线，两栏一起铺满宽度。不设 max-width，宽屏就该铺满 */
@media (min-width: 900px) {
  .pill {
    grid-template-columns: minmax(360px, 0.9fr) 1.1fr;
    align-items: stretch;
  }

  .core {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}

.wallets {
  display: flex;
  gap: 18px;
  justify-content: center;
  flex-wrap: wrap;
}

.wallet {
  flex: 1 1 160px;
  max-width: 240px;
}

.wallet-label {
  margin: 0;
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--ink-faint);
}

.wallet-value {
  margin: 4px 0 0;
  font-size: 34px;
  line-height: 1.1;
  font-weight: 600;
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 14px rgba(30, 124, 196, 0.16);
}

/* 废渣是副货币，摆小一号、换个色，别让两笔账抢同一个重音 */
.wallet.aside .wallet-value {
  font-size: 26px;
  color: var(--sky-deep);
}

.wallet-value.small {
  font-size: 26px;
}

.wallet-rate {
  margin: 6px 0 0;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

/* 火候：三颗并排，选中的那颗压下去。它挑的是这一炉走哪条路线 */
.fire {
  margin-top: 20px;
}

.modes {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface-raised);
}

.mode {
  cursor: pointer;
  padding: 8px 22px;
  border: 0;
  border-right: 1px solid var(--line);
  background: transparent;
  color: var(--ink-faint);
  font-size: 14px;
  letter-spacing: 3px;
  text-indent: 3px;
  font-family: var(--font-kai);
  transition: background 0.18s ease, color 0.18s ease;
}

.mode:last-child {
  border-right: 0;
}

.mode:hover {
  color: var(--ink);
}

.mode.on {
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 100%);
  color: var(--ink-invert);
}

.fire-line {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

.fire-line b {
  color: var(--sky-deep);
}

/* 这一炉炼到几成：和练气页那条进度条是同一根 */
.batch-bar {
  margin: 12px auto 0;
  height: 8px;
  width: 100%;
  max-width: 300px;
  border-radius: 5px;
  background: var(--tint);
  overflow: hidden;
}

.batch-bar i {
  display: block;
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, var(--accent-soft), var(--accent-deep));
  transition: width 0.12s linear;
}

.batch-note {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ink-faint);
}

.ledger {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.9;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.ledger b {
  color: var(--sky-deep);
  font-size: 14px;
}

/* 结丹：长方形厚按钮，和练气页那颗破境是同一颗 */
.gate {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.jiedan {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 18px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-flat);
  box-shadow: 0 6px 0 rgba(150, 180, 210, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  color: var(--ink-faint);
  transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.08s ease;
}

.jiedan.ready {
  border-color: var(--accent-line);
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 55%, var(--accent-deep) 100%);
  color: var(--ink-invert);
  box-shadow:
    0 6px 0 var(--edge-accent),
    0 0 22px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.32);
}

.jiedan.ready:hover {
  filter: brightness(1.06) saturate(1.08);
}

.jiedan.ready:active {
  transform: translateY(5px);
  box-shadow:
    0 1px 0 var(--edge-accent),
    0 0 14px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.jiedan.ready .break-sub {
  color: rgba(255, 255, 255, 0.82);
}

.jiedan:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.break-label {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 6px;
}

.break-sub {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.gate-bar {
  height: 4px;
  border-radius: 3px;
  background: var(--tint);
  overflow: hidden;
}

.gate-bar i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--accent-soft), var(--accent-deep));
  transition: width 0.3s ease;
}

.gate-note {
  margin: 0;
  font-size: 12px;
  letter-spacing: 1px;
  text-align: center;
  color: var(--ink-faint);
}

/* 成本那行是数字，别跟着上面那句"散掉什么"一起淡下去 */
.gate-note.cost {
  margin-top: 4px;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

/* 攒着丹纹不点的提醒：它是这一栏唯一"该做没做"的事，用告警色而不是淡灰 */
.gate-note.warn {
  margin-top: 6px;
  color: var(--lose);
  line-height: 1.6;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.head .heading {
  margin-bottom: 0;
  text-align: left;
}

.heading {
  margin: 0 0 18px;
  font-size: 17px;
  letter-spacing: 6px;
  text-indent: 6px;
  color: var(--accent-deep);
  font-family: var(--font-kai);
  text-align: center;
}

/* 一键购买：和根骨、鉴宝台那颗是同一颗按钮 */
.all {
  flex: none;
  cursor: pointer;
  padding: 7px 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-raised);
  color: var(--ink-faint);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 3px;
  font-family: inherit;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.08s ease;
}

.all.ready {
  border-color: var(--accent-line);
  background: var(--accent-wash);
  color: var(--accent-deep);
}

.all.ready:hover {
  background: var(--tint-hover);
}

.all.ready:active {
  transform: translateY(2px);
}

.all:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: var(--surface-flat);
}

.info {
  min-width: 0;
}

.name {
  margin: 0;
  font-size: 16px;
  letter-spacing: 2px;
  color: var(--ink);
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.lv {
  font-size: 12px;
  letter-spacing: 0;
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
}

.effect {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

/* 这一句是丹炉页的主线：下一级要等多久 */
.wait {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.buys {
  flex: none;
  display: flex;
  gap: 6px;
}

.buy {
  flex: none;
  cursor: pointer;
  min-width: 76px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-raised);
  color: var(--ink-faint);
  font-size: 14px;
  letter-spacing: 1px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.08s ease;
}

.buy.ready {
  border-color: var(--accent-line);
  background: var(--accent-wash);
  color: var(--accent-deep);
}

.buy.ready:hover {
  background: var(--tint-hover);
}

.buy.ready:active {
  transform: translateY(2px);
}

.buy:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.note {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-faint);
}
</style>
