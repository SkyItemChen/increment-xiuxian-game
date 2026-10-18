<script setup lang="ts">
import { computed } from 'vue'
import {
  buyJindanTree,
  jindanState,
  jindanTreeEarned,
  jindanTreePoints,
  jindanTreeRows,
  jindanTreeSpent,
  jindanTreeTotalLevels,
  type JindanTreeRow,
} from '../game/state'
import { jindanRitualSeconds } from '../game/金丹丹炉'

/**
 * 金丹页第四栏：丹纹四枝。
 * 点数只从结丹层数与结丹里程碑来——每结一层给一点，里程碑再额外添几点。
 * 四枝各自往上点，先点哪一枝就是这一层的策略，所以这里没有一键、也没有代点。
 *
 * 丹纹的用处写在结丹仪式上：四枝的**总等级**每级把仪式缩短 1%（最多省一半）。
 * 每级价 n 点是凸的，所以"补最短的那枝"能买到最多总等级——这一栏唯一的算法就在这里。
 */
const emit = defineEmits<{ back: [] }>()

const rows = computed<JindanTreeRow[]>(() => jindanTreeRows())
const points = computed(() => jindanTreePoints())
const earned = computed(() => jindanTreeEarned())
const spent = computed(() => jindanTreeSpent())
const depth = computed(() => jindanTreeTotalLevels())
const gate = computed(() => jindanState())
/** 眼下这一层要攒多少秒；再点一级能缩到多少（封底后不再变） */
const seconds = computed(() => jindanRitualSeconds(gate.value.layer, depth.value))
const nextSeconds = computed(() => jindanRitualSeconds(gate.value.layer, depth.value + 1))
const capped = computed(() => nextSeconds.value >= seconds.value - 1e-6)
</script>

<template>
  <div class="tree">
    <section class="column">
      <div class="head">
        <h2 class="heading">丹 纹</h2>
        <span class="tally">余 {{ points }} 点</span>
      </div>

      <p class="ledger">
        已得 <b>{{ earned }}</b> 点 · 已点 <b>{{ spent }}</b> 点
      </p>

      <p class="brake">
        丹纹 <b>{{ depth }}</b> 级 · 结丹仪式 <b>{{ seconds.toFixed(0) }} 秒</b>
        <span class="hint">{{
          capped ? '已缩到封底（一半），再点不再变' : `再点一级 → ${nextSeconds.toFixed(0)} 秒`
        }}</span>
      </p>

      <ul class="list">
        <li v-for="row in rows" :key="row.def.id" class="item" :class="{ maxed: row.maxed }">
          <div class="info">
            <p class="name">
              {{ row.def.name }}
              <span class="lv">Lv.{{ row.level }}</span>
            </p>
            <p class="effect">眼下：{{ row.current }}</p>
            <p class="next">下一级：{{ row.next }}</p>
          </div>
          <button
            class="buy"
            type="button"
            :class="{ ready: row.affordable }"
            :disabled="!row.affordable"
            @click="buyJindanTree(row.def.id)"
          >{{ row.maxed ? '已 点 满' : `${row.cost} 点` }}</button>
        </li>
      </ul>

      <p class="note">
        每结一层金丹给 1 点，结到第 1、2、3、5、8 层时里程碑再额外添 2、2、3、4、6 点。
        点数只增不减，这一世散掉的灵气与法门修为不影响丹纹。
      </p>
      <p class="note">
        丹纹管的是<b>结丹这一炉要攒多久</b>：每一点总等级把仪式缩短 1%，攒到 42 级省一半（封底）。
        门槛等于「你自己的产量 × 仪式秒数」，所以丹纹省下的每一秒，都是实打实的提前一层。
        每级价是「第几级就几点」，所以想让总级最多，就得补在最短的那枝上。
      </p>
      <p class="note">
        丹道与返元顺带抬产出，识海让往后每一层结丹多攒见识，炉火多出废渣。
        没有代点，也没有洗点——点下去就跟着金丹一起留着。
      </p>
      <button class="back" type="button" @click="emit('back')">回 丹 炉</button>
    </section>
  </div>
</template>

<style scoped>
.column {
  padding: 24px 24px 26px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.heading {
  margin: 0;
  font-size: 16px;
  letter-spacing: 6px;
  color: var(--accent);
  font-family: var(--font-kai);
  font-weight: 600;
}

/* 手上还剩多少点：和挑战页那颗计数是同一枚 */
.tally {
  padding: 3px 10px;
  border: 1px solid var(--accent-line);
  border-radius: 8px;
  background: var(--accent-wash);
  color: var(--accent-deep);
  font-size: 12px;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}

.ledger {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}

.ledger b {
  color: var(--sky-deep);
  font-size: 14px;
}

/* 丹纹深度 → 结丹每层涨幅：这一栏唯一要盯的数，给它一行独立的底色 */
.brake {
  margin: 10px 0 0;
  padding: 8px 12px;
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  background: var(--accent-wash);
  font-size: 13px;
  letter-spacing: 0.5px;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

.brake b {
  color: var(--accent-deep);
  font-weight: 500;
}

.hint {
  margin-left: 6px;
  color: var(--ink-faint);
  font-size: 12px;
}

.list {
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

@media (min-width: 900px) {
  .list {
    grid-template-columns: 1fr 1fr;
  }
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-raised);
}

.item.maxed {
  border-color: var(--accent-line);
  background: var(--accent-wash);
}

.info {
  min-width: 0;
}

.name {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 15px;
  letter-spacing: 2px;
  color: var(--ink);
  font-family: var(--font-kai);
}

.lv {
  font-size: 12px;
  letter-spacing: 0;
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
}

.effect {
  margin: 6px 0 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}

.next {
  margin: 3px 0 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
}

.item.maxed .next {
  color: var(--ink-faint);
}

.buy {
  flex: none;
  cursor: pointer;
  min-width: 88px;
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
  line-height: 1.8;
  color: var(--ink-faint);
}

.back {
  cursor: pointer;
  margin-top: 16px;
  padding: 9px 20px;
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 100%);
  color: var(--ink-invert);
  font-size: 13px;
  letter-spacing: 3px;
  text-indent: 3px;
  font-family: var(--font-kai);
  box-shadow: 0 4px 0 var(--edge-accent), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  transition: filter 0.18s ease, transform 0.08s ease, box-shadow 0.08s ease;
}

.back:hover {
  filter: brightness(1.06) saturate(1.08);
}

.back:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--edge-accent), inset 0 1px 0 rgba(255, 255, 255, 0.24);
}
</style>
