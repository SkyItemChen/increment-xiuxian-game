<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  NUMBER_FORMATS,
  NUMBER_FORMAT_LABELS,
  SAVE_INTERVALS,
  resetGame,
  saveGame,
  state,
} from '../game/state'
import SaveDialog from './SaveDialog.vue'

/**
 * 设置是一整页，不再是盖在修行画面上的弹窗——存档文本要地方摊开看。
 * 开发用的那几样（全局速度、发资源）已经搬去测试页，这一页只剩玩家真要动的东西。
 * 主循环挂在 App 上，所以停在这一页时灵气照涨，返回就是接着练。
 */
const emit = defineEmits<{ back: [] }>()

const savedText = computed(() => {
  if (!state.savedAt) return '尚未保存'
  return new Date(state.savedAt).toLocaleTimeString('zh-CN', { hour12: false })
})

const dialog = ref<'export' | 'import' | null>(null)

const note = ref('')
let noteTimer = 0

function say(text: string): void {
  note.value = text
  window.clearTimeout(noteTimer)
  noteTimer = window.setTimeout(() => {
    note.value = ''
  }, 8000)
}

/** 格式化不可撤销：第一下只把按钮扳成待确认，五秒内再点一次才真清 */
const armed = ref(false)
let disarm = 0

function onWipe(): void {
  if (!armed.value) {
    armed.value = true
    disarm = window.setTimeout(() => {
      armed.value = false
    }, 5000)
    return
  }
  window.clearTimeout(disarm)
  armed.value = false
  resetGame()
  say('进度已抹平，从第一世重新开始')
}
</script>

<template>
  <div class="settings-page">
    <header class="topbar">
      <span class="brand">设 置</span>
      <button class="back" type="button" @click="emit('back')">
        <span class="back-arrow">←</span>
        <span>返 回 修 行</span>
      </button>
    </header>

    <main class="stage">
      <div class="grid">
        <section class="column">
          <h2 class="heading">存 档</h2>
          <p class="gloss">进度可以带走，也可以换一份进来。两边都是同一段文本，认得这游戏存的东西就行。</p>

          <div class="row">
            <div class="row-text">
              <p class="name">导出存档</p>
              <p class="desc">打开后把当前进度摊在文本框里，复制到剪贴板或存成文件</p>
            </div>
            <button class="action" type="button" @click="dialog = 'export'">导 出</button>
          </div>

          <div class="row">
            <div class="row-text">
              <p class="name">导入存档</p>
              <p class="desc">粘贴一段存档文本，或从剪贴板、文件里读；确认后才覆盖当前进度</p>
            </div>
            <button class="action" type="button" @click="dialog = 'import'">导 入</button>
          </div>

          <div class="row">
            <div class="row-text">
              <p class="name">上次保存</p>
              <p class="desc">{{ savedText }}</p>
            </div>
            <button class="action" type="button" @click="saveGame">立即保存</button>
          </div>

          <p v-if="note" class="note">{{ note }}</p>
        </section>

        <section class="column">
          <h2 class="heading">偏 好</h2>
          <p class="gloss">这几样是本地的偏好，不算修为，格式化也抹不掉它们。</p>

          <div class="row">
            <div class="row-text">
              <p class="name">自动保存</p>
              <p class="desc">按间隔把进度写入浏览器本地存档</p>
            </div>
            <label class="switch">
              <input v-model="state.settings.autoSave" type="checkbox" />
              <span class="track"></span>
            </label>
          </div>

          <div class="row col">
            <p class="name">保存间隔</p>
            <div class="seg">
              <button
                v-for="sec in SAVE_INTERVALS"
                :key="sec"
                type="button"
                class="seg-item"
                :class="{ on: state.settings.autoSaveEvery === sec }"
                :disabled="!state.settings.autoSave"
                @click="state.settings.autoSaveEvery = sec"
              >{{ sec }} 秒</button>
            </div>
          </div>

          <div class="row col">
            <div class="row-text">
              <p class="name">数字记法</p>
              <p class="desc">字母计数法用 K/M/B/T 缩写；科学计数法在数值达到 1e7 后写成 1.23e7</p>
            </div>
            <div class="seg two">
              <button
                v-for="f in NUMBER_FORMATS"
                :key="f"
                type="button"
                class="seg-item"
                :class="{ on: state.settings.numberFormat === f }"
                @click="state.settings.numberFormat = f"
              >{{ NUMBER_FORMAT_LABELS[f] }}</button>
            </div>
          </div>

        </section>

        <section class="column danger">
          <h2 class="heading">格 式 化</h2>
          <p class="gloss">抹掉存档，灵气、法门、筑基点全部回到开局。上面的偏好会留着。这一步撤不回来。</p>
          <button
            class="action wipe"
            :class="{ armed }"
            type="button"
            @click="onWipe"
          >{{ armed ? '再点一次确认清除' : '格 式 化' }}</button>
        </section>

      </div>
    </main>

    <SaveDialog
      v-if="dialog"
      :mode="dialog"
      @notice="say"
      @close="dialog = null"
    />
  </div>
</template>

<style scoped>
.settings-page {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: clip;
  background:
    radial-gradient(ellipse at 50% -20%, rgba(150, 205, 245, 0.4) 0%, transparent 55%),
    linear-gradient(180deg, var(--bg-top) 0%, var(--bg-mid) 60%, var(--bg-low) 100%);
  color: var(--ink);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 28px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-flat);
}

.brand {
  font-size: 18px;
  letter-spacing: 8px;
  color: var(--accent);
  font-family: var(--font-kai);
}

/* 返回是个厚按钮，和修行页那些点击控件一个做法 */
.back {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 100%);
  color: var(--ink-invert);
  font-size: 13px;
  letter-spacing: 2px;
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

.back-arrow {
  font-size: 15px;
  line-height: 1;
}

.stage {
  flex: 1;
  min-height: 0;
  padding: 22px 28px 28px;
  overflow: auto;
}

/* 卡片自己数列：宽屏铺满，窄屏退回单列，不套居中 max-width */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 20px;
  align-items: start;
}

.column {
  padding: 22px 24px 24px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-panel);
}

.heading {
  margin: 0;
  font-size: 16px;
  letter-spacing: 6px;
  color: var(--accent-deep);
  font-family: var(--font-kai);
}

.gloss {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-faint);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--line-soft);
}

.row.col {
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.row-text {
  min-width: 0;
}

.name {
  margin: 0;
  font-size: 15px;
  letter-spacing: 1px;
  color: var(--ink);
}

.desc {
  margin: 5px 0 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--ink-faint);
  line-height: 1.6;
}


.note {
  margin: 16px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  background: var(--accent-wash);
  color: var(--accent-deep);
  font-size: 12px;
  letter-spacing: 0.5px;
  line-height: 1.6;
}

.action {
  flex: none;
  cursor: pointer;
  padding: 9px 18px;
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  background: var(--accent-wash);
  color: var(--accent-deep);
  font-size: 13px;
  letter-spacing: 2px;
  font-family: inherit;
  transition: background 0.2s ease;
}

.action:hover {
  background: var(--tint-hover);
}

.switch {
  position: relative;
  flex: none;
  width: 52px;
  height: 28px;
}

.switch input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--line-strong);
  transition: background 0.22s ease;
  pointer-events: none;
}

.track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(22, 57, 94, 0.3);
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.switch input:checked + .track {
  background: var(--accent);
}

.switch input:checked + .track::after {
  transform: translateX(24px);
}

.switch input:focus-visible + .track {
  outline: 2px solid var(--accent-line);
  outline-offset: 2px;
}

.seg {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.seg.two {
  grid-template-columns: repeat(2, 1fr);
}


.seg-item {
  cursor: pointer;
  padding: 10px 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-flat);
  color: var(--ink-dim);
  font-size: 13px;
  font-family: inherit;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.seg-item:hover:not(:disabled) {
  border-color: var(--accent-line);
}

.seg-item.on {
  border-color: var(--accent-line);
  background: var(--accent);
  color: var(--ink-invert);
}

.seg-item:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

/* 危险区单独一块红边，免得和正经设置混在一起 */
.danger {
  border-color: var(--lose-line);
}

.wipe {
  margin-top: 16px;
  border-color: var(--line);
  background: var(--surface-flat);
  color: var(--ink-dim);
}

.wipe:hover {
  border-color: var(--lose-line);
  background: var(--lose-wash);
  color: var(--lose);
}

.wipe.armed {
  border-color: var(--lose-line);
  background: var(--lose-wash);
  color: var(--lose);
  letter-spacing: 0.5px;
}

@media (max-height: 700px) {
  .stage {
    padding: 14px 20px 18px;
  }

  .column {
    padding: 16px 18px 18px;
  }
}
</style>
