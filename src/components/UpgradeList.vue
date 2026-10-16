<script setup lang="ts">
import { computed } from 'vue'
import {
  buyAllFromEnd,
  buyUpgrade,
  fmt,
  quoteOf,
  rebirthMods,
  shown,
  state,
  upgradeIsFree,
} from '../game/state'
import { effectText, upgradeCurrent, type UpgradeDef } from '../game/词条与属性'

/** 法门清单由境界标签页传入，练气/筑基共用这一套列表 */
const props = defineProps<{ defs: UpgradeDef[] }>()

/** 每条法门右侧两颗按钮：1X 买一级，最大 按当前灵气买到顶 */
const rows = computed(() => {
  const { outputAdd } = rebirthMods()
  return props.defs.map((def) => {
    const one = quoteOf(def.id, 1)!
    const max = quoteOf(def.id, 'max')!
    return {
      def,
      level: state.levels[def.id] ?? 0,
      oneText: fmt(one.cost),
      canOne: shown.spirit.gte(one.cost),
      // 一级都买不起时报价会被夹成 1 级，靠"买不买得起"把最大按钮关掉
      canMax: shown.spirit.gte(max.cost),
      free: upgradeIsFree(def.id),
      current: upgradeCurrent(def, state.levels, props.defs, state.settings.numberFormat, outputAdd),
    }
  })
})

/** 「不取一毫」这条成就是被动的：达标就把灵气省下，界面上得说清楚为什么钱没少 */
const anyFree = computed(() => rows.value.some((row) => row.free))

/** 一键购买：这个存档破进过一次筑基就永久解锁，探索把本世清零也不该收回去 */
const buyAllUnlocked = computed(() => state.realmIndex >= 1)
const canBuyAll = computed(() => buyAllUnlocked.value && rows.value.some((r) => r.canMax))

function onBuyAll(): void {
  buyAllFromEnd(props.defs.map((def) => def.id))
}
</script>

<template>
  <div class="upgrades">
    <div class="head">
      <h2 class="heading">法 门</h2>
      <button
        v-if="buyAllUnlocked"
        class="all"
        type="button"
        :class="{ ready: canBuyAll }"
        :disabled="!canBuyAll"
        @click="onBuyAll"
      >一 键 购 买</button>
    </div>

    <p v-if="anyFree" class="perk">成就「不取一毫」已生效：灵气够这一层的价就悟得进去，点下去灵气不会少。</p>

    <ul class="list">
      <li v-for="row in rows" :key="row.def.id" class="item">
        <div class="info">
          <p class="name">
            {{ row.def.name }}
            <span class="lv">Lv.{{ row.level }}</span>
          </p>
          <p class="effect">
            {{ effectText(row.def, state.settings.numberFormat) }} · 当前 {{ row.current }}
          </p>
        </div>
        <div class="buys">
          <button
            class="buy"
            type="button"
            :class="{ ready: row.canOne }"
            :disabled="!row.canOne"
            @click="buyUpgrade(row.def.id, 1)"
          >
            <span class="cost">{{ row.oneText }}</span>
            <span class="cost-label">{{ row.free ? '灵气达标 · 不扣' : '灵气 · 1 层' }}</span>
          </button>
          <button
            class="buy"
            type="button"
            :class="{ ready: row.canMax }"
            :disabled="!row.canMax"
            @click="buyUpgrade(row.def.id, 'max')"
          >
            <span class="max-label">最 大</span>
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.upgrades {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 14px;
  flex: none;
}

.heading {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 10px;
  color: var(--ink-dim);
}

/* 成就生效那一行：灵气为什么点了不会少，得写在脸上 */
.perk {
  margin: -6px 0 12px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
  letter-spacing: 0.5px;
  color: var(--accent-deep);
}

/* 一键购买：从最后一行往前扫，贵的优先 */
.all {
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
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: var(--surface-flat);
}

.info {
  min-width: 0;
}

.name {
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
  margin-top: 3px;
  font-size: 12px;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

.buys {
  flex: none;
  display: flex;
  gap: 6px;
}

.buy {
  cursor: pointer;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 96px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-raised);
  color: var(--ink-faint);
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.08s ease;
}

.buy.ready {
  border-color: var(--sky-line);
  background: var(--sky-wash);
  color: var(--sky-deep);
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

.cost {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.cost-label {
  font-size: 11px;
  letter-spacing: 1px;
}

/* 最大那颗只写"最 大"：报价跟着灵气实时跳动没意义；占位撑满和 1X 一样宽 */
.max-label {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 1px;
}
</style>
