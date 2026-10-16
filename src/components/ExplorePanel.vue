<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  buyAllExplore,
  buyExplore,
  explore,
  exploreOdds,
  exploreRows,
  fmtNum,
  needExploreConfirm,
  previewExplore,
  state,
  type ExploreQuote,
} from '../game/state'
import type { ExploreOutcome } from '../game/explore'
import {
  RARITY_LABELS,
  RARITY_ORDER,
  TREASURES,
  exploreCurrent,
  treasureCurrent,
} from '../game/词条与属性'
import ExploreDialog from './ExploreDialog.vue'

/**
 * 探索这一层：押上全部筑基点挖法宝，重复的折成见识，见识再买鉴宝台的永久强化。
 * 鉴宝台和法宝清单都不随破境清零，探索也不清——这一层的进度只往上走。
 */
const dig = computed(() => exploreOdds())
const canDig = computed(() => state.points >= 1)
const digSub = computed(() =>
  canDig.value
    ? `押上 ${fmtNum(dig.value.stake)} 点 · 挖 ${dig.value.count} 件 · 换 ${fmtNum(dig.value.stakeInsight)} 见识`
    : '手上还没有筑基点，先去练气攒一世',
)
const digOddsText = computed(() =>
  RARITY_ORDER.map((r) => `${RARITY_LABELS[r]} ${Math.round(dig.value.odds[r] * 100)}%`).join(' · '),
)

const outcome = ref<ExploreOutcome | null>(null)

function onDig(): void {
  // 挖满五铲就不摊开清单：预览与结算共用同一串种子，跳过那一段不会改结果
  if (!needExploreConfirm()) {
    explore()
    return
  }
  const p = previewExplore()
  if (p) outcome.value = p
}

function onConfirmDig(): void {
  outcome.value = null
  explore()
}

const insightText = computed(() => fmtNum(state.insight))
const rows = computed<ExploreQuote[]>(() => exploreRows())
/** 一级都买不起时按钮关着；能买就交给 buyAllExplore 去摊平四条 */
const canBuyAll = computed(() => rows.value.some((r) => r.maxLevels >= 1))

const ownedText = computed(() => {
  const n = TREASURES.filter((def) => (state.treasures[def.id] ?? 0) > 0).length
  return `已收 ${n} / ${TREASURES.length} 件`
})

/** 清单摊成一整面墙：按品质排好序，让 grid 自己去铺满任意宽度 */
const vault = computed(() =>
  RARITY_ORDER.flatMap((rarity) => TREASURES.filter((def) => def.rarity === rarity)),
)

function levelOf(id: string): number {
  return state.treasures[id] ?? 0
}
</script>

<template>
  <div class="explore-page">
    <section class="column core">
      <div class="wallet">
        <p class="wallet-label">见 识</p>
        <p class="wallet-value">{{ insightText }}</p>
        <p class="wallet-hint">押上去的筑基点、挖到已圆满的法宝，都折成见识</p>
      </div>

      <div class="dig">
        <button
          class="explore"
          type="button"
          :class="{ ready: canDig }"
          :disabled="!canDig"
          @click="onDig"
        >
          <span class="dig-label">遗 迹 探 索</span>
          <span class="dig-sub">{{ digSub }}</span>
        </button>
        <p class="dig-odds">{{ digOddsText }}</p>
      </div>
    </section>

    <section class="column bench">
      <div class="bench-head">
        <h2 class="heading">鉴 宝 台</h2>
        <button
          class="all"
          type="button"
          :class="{ ready: canBuyAll }"
          :disabled="!canBuyAll"
          @click="buyAllExplore()"
        >一 键 购 买</button>
      </div>
      <ul class="list">
        <li v-for="row in rows" :key="row.def.id" class="item">
          <div class="info">
            <p class="name">
              {{ row.def.name }}
              <span class="lv">Lv.{{ row.level }}</span>
            </p>
            <p class="effect">{{ row.def.effect }} · 当前 {{ exploreCurrent(row.def, row.level) }}</p>
          </div>
          <div class="buys">
            <button
              class="buy"
              type="button"
              :class="{ ready: state.insight >= row.cost }"
              :disabled="state.insight < row.cost"
              @click="buyExplore(row.def.id, 1)"
            >{{ fmtNum(row.cost) }} 识</button>
            <button
              class="buy"
              type="button"
              :class="{ ready: row.maxLevels >= 1 }"
              :disabled="row.maxLevels < 1"
              @click="buyExplore(row.def.id, 'max')"
            >最 大</button>
          </div>
        </li>
      </ul>
    </section>

    <section class="column vault">
      <div class="vault-head">
        <h2 class="heading">法 宝</h2>
        <p class="vault-count">{{ ownedText }}</p>
      </div>
      <p class="gloss">探索挖出来的家当，破境与探索都清不掉它；同一件再挖到就往上叠一层。</p>
      <ul class="cards">
        <li
          v-for="def in vault"
          :key="def.id"
          class="card"
          :class="[`rar-edge-${def.rarity}`, { found: levelOf(def.id) > 0 }]"
        >
          <p class="card-name">
            <span class="rar" :class="`rar-${def.rarity}`">{{ RARITY_LABELS[def.rarity] }}</span>
            {{ def.name }}
            <span class="lv">
              Lv.{{ levelOf(def.id) }}<span class="cap">/{{ def.cap }}</span>
            </span>
          </p>
          <p class="card-effect">{{ def.effect }}</p>
          <p class="card-now">
            {{ treasureCurrent(def, state.treasures, state.settings.numberFormat) }}
          </p>
          <p class="card-lore">{{ def.lore }}</p>
        </li>
      </ul>
    </section>

    <ExploreDialog v-if="outcome" :outcome="outcome" @cancel="outcome = null" @confirm="onConfirmDig" />
  </div>
</template>

<style scoped>
.explore-page {
  min-height: 100%;
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
  padding: 26px 28px 28px;
  text-align: center;
}

.bench {
  padding: 24px 24px 26px;
}

.bench-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.bench-head .heading {
  margin-bottom: 0;
  text-align: left;
}

/* 一键购买：和练气页那颗是同一颗按钮，四条同价所以买法是摊平 */
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

/* 横屏：左边探索右边鉴宝台，法宝清单横摊在最后一行 */
@media (min-width: 900px) {
  .explore-page {
    grid-template-columns: minmax(360px, 0.9fr) 1.1fr;
    grid-template-rows: minmax(0, 1fr) auto;
    align-items: stretch;
  }

  .core {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .vault {
    grid-column: 1 / -1;
  }
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

.wallet-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ink-faint);
}

.gloss {
  margin: -8px 0 16px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-faint);
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

.lv .cap {
  color: var(--ink-faint);
}

.effect {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

/* 两颗按钮：左边按价买一级，右边把手上的见识全压在这条上 */
.buys {
  flex: none;
  display: flex;
  gap: 6px;
}

.buy {
  flex: none;
  cursor: pointer;
  min-width: 62px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-raised);
  color: var(--ink-faint);
  font-size: 14px;
  letter-spacing: 2px;
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

/* 探索：押上全部筑基点，长方形厚按钮，和练气页的破境是一对 */
.dig {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px dashed var(--line-soft);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.explore {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-flat);
  box-shadow: 0 6px 0 rgba(150, 180, 210, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  color: var(--ink-faint);
  font-family: inherit;
  transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.08s ease;
}

.explore.ready {
  border-color: var(--accent-line);
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 55%, var(--accent-deep) 100%);
  color: var(--ink-invert);
  box-shadow:
    0 6px 0 var(--edge-accent),
    0 0 22px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.32);
}

.explore.ready:hover {
  filter: brightness(1.06) saturate(1.08);
}

.explore.ready:active {
  transform: translateY(5px);
  box-shadow:
    0 1px 0 var(--edge-accent),
    0 0 14px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.explore:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.dig-label {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 5px;
  text-indent: 5px;
}

.dig-sub {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.explore.ready .dig-sub {
  color: rgba(255, 255, 255, 0.82);
}

.dig-odds {
  font-size: 12px;
  color: var(--sky-deep);
  font-variant-numeric: tabular-nums;
}

/* 法宝清单 */
.vault {
  padding: 22px 24px 24px;
}

.vault-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 14px;
}

.vault-head .heading {
  margin-bottom: 0;
  text-align: left;
}

.vault-count {
  font-size: 12px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

/* 用 auto-fit 而不是 auto-fill：后者会按宽度造出空轨道，三件凡品右边留一大片白 */
.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 10px;
}

.card {
  padding: 10px 12px;
  border: 1px dashed var(--line);
  border-left-width: 3px;
  border-radius: 12px;
  background: var(--surface-flat);
  opacity: 0.72;
}

.rar-edge-fan {
  border-left-color: var(--r-fan);
}

.rar-edge-ling {
  border-left-color: var(--r-ling);
}

.rar-edge-xian {
  border-left-color: var(--r-xian);
}

.card.found {
  border-style: solid;
  border-color: var(--line-strong);
  border-left-style: solid;
  background: var(--surface-raised);
  opacity: 1;
}

.card-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  letter-spacing: 1px;
  color: var(--ink);
}

.card-name .lv {
  font-size: 12px;
  letter-spacing: 0;
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}

.card-effect {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-dim);
}

.card-now {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--sky-deep);
  font-variant-numeric: tabular-nums;
}

.card-lore {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-faint);
}
</style>
