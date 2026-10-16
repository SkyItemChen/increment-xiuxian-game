<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { achievementNotices } from '../game/state'

/**
 * 成就达成的报条：不挡手地挂在屏角，念完自己退。
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
      <span class="seal">❖</span>
      <div class="body">
        <p class="tip">达 成 成 就</p>
        <p class="name">{{ current.name }}</p>
        <p class="gain">{{ current.desc }}</p>
      </div>
      <button class="ok" type="button" @click="dismiss">知 道 了</button>
    </div>
  </Transition>
</template>

<style scoped>
/* 屏角一条，浮在最上层，鼠标能直接点它那颗按钮 */
.achievement-notice {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 40;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  max-width: 420px;
  padding: 16px 18px;
  border: 1px solid var(--accent-line);
  border-radius: 16px;
  background: var(--surface);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-panel), 0 10px 30px rgba(22, 57, 94, 0.22);
}

.seal {
  flex: none;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  background: var(--accent-wash);
  color: var(--accent-deep);
  font-size: 16px;
}

.body {
  flex: 1 1 auto;
  min-width: 0;
}

.tip {
  margin: 0;
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--accent-deep);
}

.name {
  margin: 3px 0 0;
  font-size: 16px;
  letter-spacing: 3px;
  color: var(--ink);
  font-family: var(--font-kai);
}

.gain {
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0.5px;
  color: var(--ink-dim);
}

/* 知道了是颗点击控件：长方形厚按钮 + 按压位移，和别处一样 */
.ok {
  flex: none;
  align-self: center;
  cursor: pointer;
  padding: 8px 14px;
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 100%);
  color: var(--ink-invert);
  font-size: 12px;
  letter-spacing: 2px;
  font-family: inherit;
  box-shadow: 0 3px 0 var(--edge-accent), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  transition: filter 0.18s ease, transform 0.08s ease, box-shadow 0.08s ease;
}

.ok:hover {
  filter: brightness(1.06) saturate(1.08);
}

.ok:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--edge-accent), inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

/* 从右边滑进来，报完淡出去 */
.notice-enter-active,
.notice-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

@media (max-width: 560px) {
  .achievement-notice {
    left: 16px;
    right: 16px;
    max-width: none;
  }
}
</style>
