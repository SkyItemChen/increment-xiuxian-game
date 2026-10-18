<script setup lang="ts">
import { computed } from 'vue'
import {
  buyFightInsight,
  buyGeneral,
  fightInsightRows,
  fightState,
  fmtNum,
  setFightMode,
} from '../game/state'
import { FIGHT_MODES, type FightModeId } from '../game/元婴'

/**
 * 斗法：纯后台的一个节拍器——每 10 秒一斩，斩到第几波由战将等级决定。
 *
 * 两条货币分得很清：**战魂**只买战将（本世，大突破清空），**神念**只买战悟（跨世）。
 * 三档的取舍是"分走多少元神"：越猛战魂越多，但大突破要多等。
 * 解锁看累计道基 40 点，只涨不跌，所以散功不会把它关回去。
 */
const s = computed(() => fightState())
const rows = computed(() => fightInsightRows())

const gateProgress = computed(() => {
  const f = s.value
  if (f.unlocked) return 100
  return Math.round(Math.min(Math.max(f.daoJiEarned / f.need, 0), 1) * 100)
})

const canBuyGeneral = computed(
  () => s.value.unlocked && Number.isFinite(s.value.generalCost) && s.value.warSoul >= s.value.generalCost,
)

function pick(id: FightModeId): void {
  setFightMode(id)
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}
</script>

<template>
  <div class="fight">
    <section v-if="!s.unlocked" class="board">
      <div class="head">
        <p class="title">斗 法 未 开</p>
        <span class="badge">未 开</span>
      </div>
      <p class="note">
        斗法要<b>累计道基 {{ s.need }}</b> 才开：那是一条只涨不跌的账，大突破一次一点起，
        等得越久给得越多。眼下 {{ fmtNum(s.daoJiEarned) }} / {{ s.need }}。
      </p>
      <div class="bar" role="progressbar" :aria-valuenow="gateProgress">
        <i :style="{ width: `${gateProgress}%` }"></i>
      </div>
      <p class="note faint">
        为什么不先开：斗法会分走元神，前期分走的那一份直接拖慢大突破；
        道基攒到这个数，说明玩家已经走过几轮、知道自己在拿什么换什么。
      </p>
    </section>

    <template v-else>
      <section class="board">
        <div class="wallets">
          <div class="wallet">
            <p class="wallet-label">战 魂</p>
            <p class="wallet-value">{{ fmtNum(s.warSoul) }}</p>
            <p class="wallet-rate">每秒 {{ fmtNum(s.perSecond) }}</p>
          </div>
          <div class="wallet aside">
            <p class="wallet-label">战 将</p>
            <p class="wallet-value small">Lv.{{ s.general }}</p>
            <p class="wallet-rate">斩到第 {{ s.wave }} 波 · 一刀 {{ fmtNum(s.perKill) }}</p>
          </div>
          <div class="wallet aside">
            <p class="wallet-label">元 神 分 流</p>
            <p class="wallet-value small">{{ pct(s.drain) }}</p>
            <p class="wallet-rate">这一份不计入大突破</p>
          </div>
        </div>

        <div class="modes" role="group" aria-label="斗法">
          <button
            v-for="m in FIGHT_MODES"
            :key="m.id"
            type="button"
            class="mode"
            :class="{ on: s.mode.id === m.id }"
            @click="pick(m.id)"
          >{{ m.name }}</button>
        </div>
        <p class="mode-line">
          {{ s.mode.desc }} · 战魂 ×{{ s.mode.warMul.toFixed(2) }} ·
          分走元神 {{ pct(s.mode.yuanDrain) }}（大突破要多等约 {{ (1 / (1 - s.mode.yuanDrain)).toFixed(2) }} 倍）
        </p>

        <div class="buy-row">
          <div class="buy-text">
            <p class="buy-name">战将 · Lv.{{ s.general }}</p>
            <p class="note faint">每级抬一波上限，价 ×1.65/级；本世的等级，大突破后归零。</p>
          </div>
          <button
            class="buy"
            type="button"
            :class="{ ready: canBuyGeneral }"
            :disabled="!canBuyGeneral"
            @click="buyGeneral()"
          >{{ fmtNum(s.generalCost) }} 战魂</button>
        </div>
      </section>

      <section class="board">
        <div class="head">
          <p class="title">战 悟</p>
          <span class="badge">神念 {{ fmtNum(s.shenNian) }}</span>
        </div>
        <p class="note">
          五条全部折回旧五轴，每级 +2%（乘法那两条是 ×1.02/级），比神悟台小一号——
          神念到后期很宽，量大了会把旧轴直接推平。价格 ×1.75/级，花的是<b>神念</b>（元神宫产的）。
        </p>
      </section>

      <ul class="list">
        <li v-for="row in rows" :key="row.def.id" class="item">
          <div class="info">
            <p class="name">
              {{ row.def.name }}
              <span class="lv">Lv.{{ row.level }}</span>
            </p>
            <p class="effect">{{ row.def.effect }}</p>
            <p class="now">
              {{ row.level > 0 ? `当前 ${row.current} · 下一级 ${row.next}` : `下一级起 ${row.next}` }}
            </p>
          </div>
          <button
            class="buy"
            type="button"
            :class="{ ready: row.affordable }"
            :disabled="!row.affordable"
            @click="buyFightInsight(row.def.id)"
          >{{ fmtNum(row.cost) }} 神念</button>
        </li>
      </ul>

      <p class="foot">
        战魂与大突破一起清空；战悟、神念、元神宫、道基都跟着你走。
      </p>
    </template>
  </div>
</template>

<style scoped>
.fight {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.board {
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title {
  margin: 0;
  font-size: 16px;
  letter-spacing: 5px;
  color: var(--accent-deep);
  font-family: var(--font-kai);
}

.badge {
  padding: 2px 9px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--ink-faint);
  font-size: 11px;
  letter-spacing: 1px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.9;
  color: var(--ink-dim);
}

.note.faint {
  color: var(--ink-faint);
}

.note b {
  color: var(--accent-deep);
}

.bar {
  margin-top: 12px;
  height: 8px;
  border-radius: 5px;
  background: var(--tint);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, var(--accent-soft), var(--accent-deep));
  transition: width 0.3s ease;
}

.wallets {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

.wallet {
  flex: 1 1 140px;
  min-width: 0;
}

.wallet-label {
  margin: 0;
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--ink-faint);
}

.wallet-value {
  margin: 4px 0 0;
  font-size: 28px;
  line-height: 1.1;
  font-weight: 600;
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.wallet.aside .wallet-value {
  font-size: 22px;
  color: var(--sky-deep);
}

.wallet-value.small {
  font-size: 22px;
}

.wallet-rate {
  margin: 6px 0 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.modes {
  margin-top: 16px;
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

.mode-line {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

.buy-row {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.buy-text {
  min-width: 0;
}

.buy-name {
  margin: 0;
  font-size: 14px;
  color: var(--ink);
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
}

.now {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.buy {
  flex: none;
  cursor: pointer;
  min-width: 92px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-raised);
  color: var(--ink-faint);
  font-size: 13px;
  letter-spacing: 1px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}

.buy.ready {
  border-color: var(--accent-line);
  background: var(--accent-wash);
  color: var(--accent-deep);
}

.buy.ready:hover {
  background: var(--tint-hover);
}

.buy:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.foot {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.5px;
  color: var(--ink-faint);
}

@media (min-width: 900px) {
  .fight {
    max-width: 900px;
  }
}
</style>
