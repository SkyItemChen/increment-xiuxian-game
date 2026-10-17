<script setup lang="ts">
import { computed } from 'vue'
import { fmt, fmtNum, state } from '../game/state'
import type { ExploreOutcome } from '../game/explore'
import { RARITY_LABELS, RARITY_ORDER, type TreasureDef, type TreasureRarity } from '../game/词条与属性'

/**
 * 探索确认弹窗。结果在打开前就由 state.seed 抽好了，所以这里摆出来的就是落账的那一批——
 * 玩家可以反复点开对比，取消不会改命。
 */
const props = defineProps<{ outcome: ExploreOutcome }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()

const spiritText = computed(() => fmt(state.spirit))

/** 概率给到一位小数就够看了，再多是假精度 */
function pct(v: number): string {
  return `${Math.round(v * 1000) / 10}%`
}

const odds = computed(() =>
  RARITY_ORDER.map((r) => `${RARITY_LABELS[r]} ${pct(props.outcome.odds[r])}`).join(' · '),
)

const emptyText = computed(() => props.outcome.draws.length === 0)

/** 三档权重全是 0：能挖的档都收齐了，剩下的品质眼力还够不着，这一铲只换见识 */
const dry = computed(() => {
  const o = props.outcome.odds
  return o.fan + o.ling + o.xian <= 0
})

/** 一行摊平的战利品 */
interface Stack {
  def: TreasureDef
  rarity: TreasureRarity
  count: number
  from: number
  to: number
}

/**
 * 同一件连挖到几次只摊成一行：三行"乾坤鼎 第1/2/3层"看着像三件不同的东西，
 * 玩家真正要看见的是它从几层涨到几层。
 */
const stacks = computed<Stack[]>(() => {
  const map = new Map<string, Stack>()
  for (const d of props.outcome.draws) {
    const row = map.get(d.def.id)
    if (row) row.to += 1
    else map.set(d.def.id, { def: d.def, rarity: d.rarity, count: 1, from: d.level - 1, to: d.level })
  }
  return [...map.values()]
})
</script>

<template>
  <div class="mask" @click.self="emit('cancel')">
    <section class="dialog" role="dialog" aria-label="探索确认">
      <h2 class="title">遗 迹 探 索</h2>

      <div class="block lose">
        <p class="block-head">押 上 全 部</p>
        <ul class="lines">
          <li>
            <span class="key">筑基点</span>
            <span class="val strong">{{ fmtNum(outcome.stake) }} 点</span>
          </li>
          <li>
            <span class="key">散去灵气</span>
            <span class="val">{{ spiritText }}</span>
          </li>
          <li>
            <span class="key">法门修为</span>
            <span class="val">全部清零</span>
          </li>
        </ul>
      </div>

      <div class="block gain">
        <p class="block-head">此 行 所 得</p>
        <ul v-if="!emptyText" class="loot">
          <li v-for="s in stacks" :key="s.def.id" class="drop">
            <p class="drop-head">
              <span class="rar" :class="`rar-${s.rarity}`">{{ RARITY_LABELS[s.rarity] }}</span>
              <span class="drop-name">{{ s.def.name }}</span>
              <span class="drop-lv">
                <template v-if="s.from">Lv.{{ s.from }} → </template>Lv.{{ s.to }}
              </span>
            </p>
            <p class="drop-effect">{{ s.def.effect }} · {{ s.def.lore }}</p>
          </li>
        </ul>
        <p v-else class="loot-empty">
          {{ dry ? '眼力还够不着剩下的法宝，这一铲只攒见识。' : '这一带的法宝都已收齐，这一铲只攒见识。' }}
        </p>
        <ul class="lines">
          <li v-if="!dry">
            <span class="key">出土机会</span>
            <span class="val tiny">{{ odds }}</span>
          </li>
          <li v-else>
            <span class="key">出土机会</span>
            <span class="val tiny">没有可挖的档</span>
          </li>
          <li>
            <span class="key">押注折算</span>
            <span class="val">+{{ fmtNum(outcome.stakeInsight) }} 见识</span>
          </li>
          <li v-if="outcome.insight">
            <span class="key">圆满折算</span>
            <span class="val">+{{ fmtNum(outcome.insight) }} 见识</span>
          </li>
        </ul>
        <p class="note">法宝与鉴宝台跟着你一世一世走，下一次探索、下一次破境都清不掉它们。</p>
      </div>

      <footer class="foot">
        <button class="cancel" type="button" @click="emit('cancel')">再想想</button>
        <button class="confirm" type="button" @click="emit('confirm')">探 索</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 30;
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
  width: min(460px, 100%);
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

.block + .block {
  margin-top: 12px;
}

.block.lose {
  border-color: var(--lose-line);
  background: var(--lose-wash);
}

.block.gain {
  border-color: var(--gain-line);
  background: var(--gain-wash);
}

.block-head {
  margin: 0 0 10px;
  font-size: 13px;
  letter-spacing: 4px;
  color: var(--ink-dim);
}

.block.lose .block-head {
  color: var(--lose);
}

.block.gain .block-head {
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

.val.tiny {
  font-size: 12px;
  color: var(--ink-dim);
}

.val.strong {
  font-size: 18px;
  font-weight: 600;
  color: var(--lose);
}

/* 战利品：挖到什么先说清楚，再摆概率 */
.loot {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.drop {
  padding: 10px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  background: var(--surface-raised);
}

.drop-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drop-name {
  font-size: 15px;
  letter-spacing: 1px;
  color: var(--ink);
}

.drop-lv {
  margin-left: auto;
  font-size: 12px;
  color: var(--accent-deep);
  font-variant-numeric: tabular-nums;
}

.drop-effect {
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-dim);
}

.loot-empty {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--ink-dim);
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

.cancel,
.confirm {
  cursor: pointer;
  flex: 1;
  padding: 13px 0;
  border-radius: 12px;
  font-size: 15px;
  letter-spacing: 4px;
  text-indent: 4px;
  font-family: inherit;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.08s ease;
}

.cancel {
  border: 1px solid var(--line);
  background: var(--surface-flat);
  color: var(--ink-dim);
}

.cancel:hover {
  border-color: var(--line-strong);
  color: var(--ink);
}

.confirm {
  border: 1px solid var(--accent-line);
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 55%, var(--accent-deep) 100%);
  box-shadow: 0 5px 0 var(--edge-accent), inset 0 1px 0 rgba(255, 255, 255, 0.32);
  color: var(--ink-invert);
}

.confirm:hover {
  filter: brightness(1.06) saturate(1.08);
}

.confirm:active {
  transform: translateY(4px);
  box-shadow: 0 1px 0 var(--edge-accent), inset 0 1px 0 rgba(255, 255, 255, 0.24);
}
</style>
