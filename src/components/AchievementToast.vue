<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { achievementNotices } from '../game/state'

/**
 * 成就达成的报条：挂在屏幕正上方、灵气读数那一带，念完自己退。
 * 只报"哪条成就成了、它给什么"，不飘任何收益数字——数字照旧只在静态文字里看。
 * 队列一次只摆一条，报完（点掉或到点）再摆下一条。
 */
const SHOW_MS = 6200

const current = computed(() => achievementNotices.value[0] ?? null)
const shown = ref(false)
let timer = 0

watch(
  current,
  (notice) => {
    window.clearTimeout(timer)
    if (!notice) {
      shown.value = false
      return
    }
    shown.value = true
    timer = window.setTimeout(dismiss, SHOW_MS)
  },
  { immediate: true },
)

function dismiss(): void {
  window.clearTimeout(timer)
  achievementNotices.value.shift()
}

onUnmounted(() => window.clearTimeout(timer))
</script>

<template>
  <Transition name="notice">
    <div v-if="shown && current" class="achievement-notice" role="status" aria-live="polite">
      <button class="close" type="button" aria-label="关闭成就通知" @click="dismiss">×</button>
      <div class="body">
        <p class="tip">❖ 达 成 成 就</p>
        <p class="name">{{ current.name }}</p>
        <p class="gain">{{ current.desc }}</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 屏幕正上方、灵气读数那一带：半透明浮着，不把底下的数字闷死 */
.achievement-notice {
  position: fixed;
  top: 76px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  width: min(500px, calc(100vw - 32px));
  padding: 15px 24px 17px 50px;
  border: 1px solid var(--accent-line);
  border-radius: 14px;
  background: var(--surface-frosted);
  backdrop-filter: blur(14px);
  box-shadow: 0 12px 34px rgba(22, 57, 94, 0.18);
}

/* X 在左上角：小方块，和整屏的厚按钮同一套按压手感 */
.close {
  position: absolute;
  top: 9px;
  left: 9px;
  cursor: pointer;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--ink-dim);
  font-size: 18px;
  line-height: 1;
  font-family: inherit;
  transition: color 0.16s ease, border-color 0.16s ease, background 0.16s ease, transform 0.06s ease;
}

.close:hover {
  color: var(--ink);
  border-color: var(--line-strong);
  background: var(--tint);
}

.close:active {
  transform: translateY(1px);
}

.body {
  min-width: 0;
}

.tip {
  margin: 0;
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--accent-deep);
}

.name {
  margin: 4px 0 0;
  font-size: 17px;
  letter-spacing: 3px;
  color: var(--ink);
  font-family: var(--font-kai);
}

.gain {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  letter-spacing: 0.5px;
  color: var(--ink-dim);
}

/* 从灵气读数上方探出来，报完淡回去 */
.notice-enter-active,
.notice-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
  transform: translate(-50%, -12px);
}

@media (max-width: 560px) {
  .achievement-notice {
    top: 68px;
    width: calc(100vw - 24px);
  }
}
</style>
