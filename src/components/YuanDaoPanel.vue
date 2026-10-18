<script setup lang="ts">
import { computed } from 'vue'
import { buyShenWu, fmtNum, shenWuRows, yuanState } from '../game/state'

/**
 * 神悟台：花元婴道基点八条。
 *
 * 前三条是元婴自己的轴（神炼 → 元神产量、洞明 → 道基、元道 → 总倍率），
 * 后五条折回旧五轴，不新起第六条算法轴——加成的落点在 `挑战.ts` 的 `shenWuBonus()`。
 * 价格 `1.8^级`，50 点道基按"买最便宜"大约每条到 Lv.3，所以先点哪条是有取舍的。
 */
const s = computed(() => yuanState())
const rows = computed(() => shenWuRows())

/** 元道那一条单独念一遍：它是全表唯一产 metaMult 的地方，玩家得看得见现在乘到几 */
const metaText = computed(() => {
  const lv = rows.value.find((r) => r.def.id === 'yuanDao')?.level ?? 0
  return `×${(1.1 ** lv).toFixed(2)}`
})
</script>

<template>
  <div class="dao">
    <section class="board">
      <div class="head">
        <p class="title">神 悟 台</p>
        <span class="badge">道基 {{ fmtNum(s.daoJi) }}</span>
      </div>
      <p class="note">
        道基只从大突破来，一次 1 点起（等得越久给得越多）。八条各自计级、价格 ×1.8/级，
        所以"先点哪条"就是这一层唯一的策略：赶元神点神炼，赶旧链点玄功，赶长期点元道。
      </p>
      <p class="note faint">
        元道总倍率眼下 <b>{{ metaText }}</b>，它乘在灵气产出最外层，于是出丹与废渣跟着一起放大；
        元神、神念、战魂不吃这个倍率。
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
          @click="buyShenWu(row.def.id)"
        >{{ fmtNum(row.cost) }} 道基</button>
      </li>
    </ul>

    <p class="foot">
      道基不会因为大突破、结丹、探索而减少；这八条点过就永久。
    </p>
  </div>
</template>

<style scoped>
.dao {
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
  min-width: 96px;
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
  .dao {
    max-width: 900px;
  }
}
</style>
