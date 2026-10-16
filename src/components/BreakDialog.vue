<script setup lang="ts">
import { computed } from 'vue'
import { fmt, fmtNum, state, type BreakPreview } from '../game/state'

/** 突破确认弹窗：把"这一世清掉什么、换到什么"摊开来说，玩家点确认才真清 */
const props = defineProps<{ preview: BreakPreview }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()

const wipedText = computed(() =>
  props.preview.wiped.map((w) => `${w.def.name} Lv.${w.level}`).join('、'),
)

const noneText = computed(() => props.preview.wiped.length === 0)

/** 弹窗在 breakThrough() 之前算好，所以来世就是 loops+1 */
const nextLifeText = computed(() => fmtNum(state.loops + 2))
</script>

<template>
  <div class="mask" @click.self="emit('cancel')">
    <section class="dialog" role="dialog" aria-label="突破确认">
      <h2 class="title">突 破 {{ preview.realm.name }}</h2>

      <div class="block lose">
        <p class="block-head">此 世 归 零</p>
        <ul class="lines">
          <li>
            <span class="key">散去灵气</span>
            <span class="val">{{ fmt(preview.spirit) }}</span>
          </li>
          <li v-if="!noneText">
            <span class="key">法门修为</span>
            <span class="val tiny">{{ wipedText }}</span>
          </li>
          <li v-else>
            <span class="key">法门修为</span>
            <span class="val">本世尚未参悟</span>
          </li>
        </ul>
      </div>

      <div class="block gain">
        <p class="block-head">破 境 所 得</p>
        <ul class="lines">
          <li>
            <span class="key">境界</span>
            <span class="val">{{ preview.realm.name }} 已开放，筑基点去那一页花掉</span>
          </li>
          <li>
            <span class="key">筑基点</span>
            <span class="val strong">+{{ fmtNum(preview.points) }}</span>
          </li>
          <li v-if="preview.bonus">
            <span class="key">缘法 · 法宝</span>
            <span class="val strong">+{{ preview.bonus }}</span>
          </li>
          <li>
            <span class="key">转世</span>
            <span class="val">第 {{ nextLifeText }} 世重来，根骨的强化都跟着走</span>
          </li>
        </ul>
        <p class="note">筑基点买来的强化不会被下一次破境清掉；境界标签也会一直留着。</p>
      </div>

      <footer class="foot">
        <button class="cancel" type="button" @click="emit('cancel')">再想想</button>
        <button class="confirm" type="button" @click="emit('confirm')">破 境</button>
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
