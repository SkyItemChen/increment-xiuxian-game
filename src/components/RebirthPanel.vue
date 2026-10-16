<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  breakBonus,
  buyAllRebirth,
  buyRebirth,
  exploreGate,
  fmt,
  fmtNum,
  pillUnlocked,
  pointPassPerSecond,
  rebirthGrowthCut,
  rebirthRows,
  realmToBreakThrough,
  shown,
  state,
  type RebirthQuote,
} from '../game/state'
import { pointsForLoop } from '../game/rebirth'
import { REALMS } from '../game/realms'
import { GATHER_CRIT_MULT, JIEDAN_FURNACE_LEVEL, POINT_PASS_RATE } from '../game/词条与属性'
import ExplorePanel from './ExplorePanel.vue'

/**
 * 筑基页 = 两个子标签。根骨这一页花筑基点买永久强化，探索那一页押上点数换法宝，
 * 两边各有一套自己的货币，所以分开摆；切标签不会丢状态，探索的确认弹窗在 ExplorePanel 里。
 */
const subTab = ref<'gengu' | 'explore'>('gengu')

/** 探索那一页要攒够筑基点才开门；没开时标签照摆，只是点不动，进度写在标签下面 */
const gate = computed(() => exploreGate())

function pickExplore(): void {
  if (gate.value.unlocked) subTab.value = 'explore'
}

/** 破境攒来的筑基点在这里花掉，买到的等级不随下一次破境清零 */
const pointsText = computed(() => fmtNum(state.points))
const loopText = computed(() => fmt(shown.loopEarned))
const lifeText = computed(() => fmtNum(state.loops + 1))
const nextGate = computed(() => realmToBreakThrough())

const nextPoints = computed(() => {
  const need = nextGate.value?.realm.breakThrough
  return need ? pointsForLoop(shown.loopEarned, need, state.loops) + breakBonus() : 0
})

/** 破境退役之后这一页要念的另一笔账：每秒折给多少筑基点 */
const passText = computed(() => pointPassPerSecond().toFixed(2))

/** 金丹那一页开没开炉：开着就不用在这儿提示下一步了 */
const pillOpen = computed(() => pillUnlocked())
const beyondFloorText = computed(() => {
  const floor = REALMS[2]?.breakThrough
  return floor ? fmt(floor) : ''
})
const furnaceNeedText = computed(() => JIEDAN_FURNACE_LEVEL)

const rows = computed<RebirthQuote[]>(() => rebirthRows())
/** 一级都买不起时按钮关着；能买就交给 buyAllRebirth 去摊平五条 */
const canBuyAll = computed(() => rows.value.some((r) => r.maxLevels >= 1))

function currentText(row: RebirthQuote): string {
  if (!row.level) return '尚未参悟'
  const scale = 1 + row.def.power * row.level
  switch (row.def.kind) {
    case 'global-add':
      return `全部灵气产出 ×${scale.toFixed(2)}`
    case 'output-add':
      return `法门灵气/秒 ×${scale.toFixed(2)}`
    case 'cost-cut':
      return `涨价幅度 −${Math.round(rebirthGrowthCut(row.def) * 100)}%`
    case 'crit-add':
      return `${Math.round(scale * 100 - 100)}% 机会 ×${GATHER_CRIT_MULT}`
    case 'point-add':
      // 破境还在时缘法是按次结算的；金丹之后同一笔账改成按秒折给
      return pillOpen.value
        ? `每秒多给 ${(row.def.power * row.level * POINT_PASS_RATE).toFixed(2)} 点`
        : `每次破境 +${row.def.power * row.level} 点`
  }
}
</script>

<template>
  <div class="zhuji">
    <nav class="sub-tabs" aria-label="筑基">
      <button
        type="button"
        class="sub-tab"
        :class="{ on: subTab === 'gengu' }"
        @click="subTab = 'gengu'"
      >根 骨</button>
      <button
        type="button"
        class="sub-tab"
        :class="{ on: subTab === 'explore', locked: !gate.unlocked }"
        :disabled="!gate.unlocked"
        @click="pickExplore"
      >探 索</button>
    </nav>

    <p v-if="!gate.unlocked" class="lock-hint">
      遗迹还没开启 · 破境一共攒满 {{ gate.need }} 筑基点就能进去，现已攒 {{ gate.earned }} 点
    </p>

    <div v-if="subTab === 'gengu'" class="rebirth">
      <section class="column core">
        <div class="wallet">
          <p class="wallet-label">筑 基 点</p>
          <p class="wallet-value">{{ pointsText }}</p>
        </div>
        <p v-if="nextGate || pillOpen" class="ledger">
          第 {{ lifeText }} 世 · 本世累计 {{ loopText }} 灵气<br />
          <template v-if="nextGate">此刻回练气破境可得 <b>{{ nextPoints }}</b> 点</template>
          <template v-else>金丹已成 · 不必再破境，每秒自动进账 <b>{{ passText }}</b> 点</template>
        </p>

        <div v-if="!pillOpen" class="soon">
          <span class="soon-label">金 丹 还 没 开 炉</span>
          <span class="soon-sub">本世灵气攒到过 {{ beyondFloorText }}，旁边就多出「金丹」那一页；炉子炼到第 {{ furnaceNeedText }} 级就能结丹</span>
        </div>
      </section>

      <section class="column side">
        <div class="gengu-head">
          <h2 class="heading">根 骨</h2>
          <button
            class="all"
            type="button"
            :class="{ ready: canBuyAll }"
            :disabled="!canBuyAll"
            @click="buyAllRebirth()"
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
            </div>
            <div class="buys">
              <button
                class="buy"
                type="button"
                :class="{ ready: state.points >= row.cost }"
                :disabled="state.points < row.cost"
                @click="buyRebirth(row.def.id, 1)"
              >{{ fmtNum(row.cost) }} 点</button>
              <button
                class="buy"
                type="button"
                :class="{ ready: row.maxLevels >= 1 }"
                :disabled="row.maxLevels < 1"
                @click="buyRebirth(row.def.id, 'max')"
              >最 大</button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <ExplorePanel v-else />
  </div>
</template>

<style scoped>
.zhuji {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 子标签：比境界标签小一号，摆在这页内容的上方 */
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

/* 没攒够点数时探索标签点不动，只当个路标 */
.sub-tab.locked {
  cursor: not-allowed;
  color: var(--ink-faint);
  opacity: 0.6;
}

.lock-hint {
  margin: -8px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.rebirth {
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
  padding: 28px 30px;
  text-align: center;
}

.side {
  padding: 24px 24px 26px;
}

.gengu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.gengu-head .heading {
  margin-bottom: 0;
  text-align: left;
}

/* 一键购买：和练气页那颗是同一颗按钮，五条同价所以买法是摊平 */
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

/* 横屏：左边钱袋右边根骨树，两栏一起铺满宽度。不设 max-width，宽屏就该铺满 */
@media (min-width: 900px) {
  .rebirth {
    grid-template-columns: minmax(360px, 0.9fr) 1.1fr;
    align-items: stretch;
  }

  .core {
    display: flex;
    flex-direction: column;
    justify-content: center;
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

/* 还没开放的那一境：摆着，但明说现在点不了 */
.soon {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 18px;
  border: 1px dashed var(--line-strong);
  border-radius: 14px;
  background: var(--surface-flat);
}

.soon-label {
  font-size: 15px;
  letter-spacing: 5px;
  color: var(--ink-dim);
}

.soon-sub {
  font-size: 12px;
  letter-spacing: 1px;
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

.effect {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

/* 两颗按钮：左边按价买一级，右边把手上的筑基点全压在这条上 */
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
</style>
