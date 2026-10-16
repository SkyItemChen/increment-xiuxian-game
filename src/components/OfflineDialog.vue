<script setup lang="ts">
import { computed } from 'vue'
import { fmt, fmtNum, type OfflineReport } from '../game/state'

/**
 * 「出关」字据：人不在的这一段补齐的进项，一张纸念完。
 * 只念数目，不念倍率、不念速率公式——玩家要的是"我这一趟关没白闭"。
 */
const props = defineProps<{ report: OfflineReport }>()
const emit = defineEmits<{ close: [] }>()

/** 闭关时长念成大白话：几小时几分、几分、几秒 */
const spanText = computed(() => {
  const s = Math.floor(props.report.seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`
  if (m > 0) return `${m} 分`
  return `${s} 秒`
})

const danText = computed(() =>
  props.report.batches > 0 ? `${fmt(props.report.dan)}（开了 ${props.report.batches} 炉）` : '',
)
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <section class="dialog" role="dialog" aria-label="出关">
      <h2 class="title">出 关</h2>

      <div class="block gain">
        <p class="block-head">闭 关 所 得</p>
        <ul class="lines">
          <li>
            <span class="key">这一趟闭关</span>
            <span class="val strong">{{ spanText }}</span>
          </li>
          <li v-if="!report.qi.isZero">
            <span class="key">灵气进了</span>
            <span class="val">{{ fmt(report.qi) }}</span>
          </li>
          <li v-if="report.gathers > 0">
            <span class="key">吐纳</span>
            <span class="val">{{ fmtNum(report.gathers) }} 次</span>
          </li>
          <li v-if="danText">
            <span class="key">丹炼成</span>
            <span class="val">{{ danText }}</span>
          </li>
          <li v-if="!report.dreg.isZero">
            <span class="key">炸炉剩下</span>
            <span class="val">{{ fmt(report.dreg) }}</span>
          </li>
          <li v-if="report.points > 0">
            <span class="key">筑基点折进</span>
            <span class="val">{{ fmtNum(report.points) }} 点</span>
          </li>
        </ul>
        <p class="note">
          人不在的这一段，只有吐纳、炼丹、按秒换筑基点这三件事还在跑。买法门、买丹炉、转盘子那些得你在场。
        </p>
      </div>

      <footer class="foot">
        <button class="confirm" type="button" @click="emit('close')">知 道 了</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 32;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--veil);
  backdrop-filter: blur(3px);
  animation: fade-in 0.18s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.dialog {
  width: min(440px, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 22px 26px 24px;
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, var(--bg-mid) 100%);
  box-shadow: var(--shadow-panel);
}

.title {
  margin: 0 0 18px;
  font-size: 19px;
  line-height: 1.4;
  letter-spacing: 5px;
  text-align: center;
  color: var(--accent-deep);
  font-family: var(--font-kai);
}

.block {
  padding: 14px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: var(--surface-flat);
}

.block.gain {
  border-color: var(--gain-line);
  background: var(--gain-wash);
}

.block-head {
  margin: 0 0 10px;
  font-size: 13px;
  letter-spacing: 4px;
  color: var(--gain);
}

.lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.lines li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 14px;
  font-size: 14px;
}

.key {
  flex: none;
  color: var(--ink-faint);
  letter-spacing: 1px;
}

.val {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.val.strong {
  font-size: 18px;
  font-weight: 600;
  color: var(--gain);
}

.note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-faint);
}

.foot {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.confirm {
  cursor: pointer;
  flex: 1;
  padding: 13px 0;
  border: 1px solid var(--accent-line);
  border-radius: 12px;
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 55%, var(--accent-deep) 100%);
  box-shadow: 0 5px 0 var(--edge-accent), inset 0 1px 0 rgba(255, 255, 255, 0.32);
  color: var(--ink-invert);
  font-size: 15px;
  letter-spacing: 4px;
  text-indent: 4px;
  font-family: inherit;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.08s ease;
}

.confirm:hover {
  filter: brightness(1.06) saturate(1.08);
}

.confirm:active {
  transform: translateY(4px);
  box-shadow: 0 1px 0 var(--edge-accent), inset 0 1px 0 rgba(255, 255, 255, 0.24);
}
</style>
